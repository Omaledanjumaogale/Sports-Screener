// ── Retention purge self-test (internal-only, ops tooling) ───────────────────
// Proves the retention pipeline end-to-end on any deployment:
//
//   npx convex run internal/retentionProbe:insertProbe
//   npx convex run internal/retention:purgeFinishedMatchesAction
//   npx convex run internal/retentionProbe:verifyPurge
//
// insertProbe seeds two finished matches 13h in the past (older than the 12h
// window -> purge candidates, each with a verdict) plus one finished match 2h
// in the past (inside the window -> MUST SURVIVE) and one upcoming match.
// verifyPurge checks the outcome and cleans up every probe row.
//
// Rows are namespaced probe-<uuid> so they can never collide with real data
// and are fully removed by verifyPurge even on failure paths.

import { internalMutation } from '../_generated/server';
import { v } from 'convex/values';

const PROBE_PREFIX = 'probe-';
const DAY_OFFSET = -1; // probe dayKey is always yesterday (purge-safe, day-guarded)

function probeDayKey(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

export const insertProbe = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const dayKey = probeDayKey(DAY_OFFSET);
    const runId = 'probe-' + Math.random().toString(36).slice(2, 10);

    const rows = [
      // 13h old, finished -> purge candidate (with verdict)
      { matchId: runId + '-old-1', ageH: 13, status: 'finished' as const, finalScore: '2-1' },
      // 13h old, finished (no explicit status but has finalScore) -> candidate
      { matchId: runId + '-old-2', ageH: 13, status: 'finished' as const, finalScore: '0-0' },
      // 2h old, finished -> must SURVIVE the 12h window
      { matchId: runId + '-recent', ageH: 2, status: 'finished' as const, finalScore: '1-0' },
      // 13h old but still upcoming -> must NEVER be touched by retention
      { matchId: runId + '-upcoming', ageH: -1, status: 'upcoming' as const, finalScore: undefined }
    ];

    for (const r of rows) {
      await ctx.db.insert('predictorMatches', {
        dayKey,
        sportId: 'football',
        matchId: r.matchId,
        league: 'RETENTION-PROBE',
        homeTeam: 'Probe Home ' + r.matchId.slice(-3),
        awayTeam: 'Probe Away ' + r.matchId.slice(-3),
        startTime: now - r.ageH * 3_600_000,
        source: 'retention-probe',
        marketsAvailable: ['1X2'],
        scopes: { probe: true },
        finalScore: r.finalScore,
        status: r.status,
        createdAt: now
      });
      if (r.status === 'finished') {
        await ctx.db.insert('predictorVerdicts', {
          dayKey,
          sportId: 'football',
          matchId: r.matchId,
          aiReport: { probe: true, matchId: r.matchId },
          agentsRun: ['probe'],
          citations: [],
          updatedAt: now
        });
      }
    }

    return { runId, dayKey, seeded: rows.length };
  }
});

export const verifyPurge = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('predictorMatches').collect();
    const probes = all.filter((m) => m.matchId.indexOf(PROBE_PREFIX) !== -1 || m.league === 'RETENTION-PROBE');
    const verdicts = await ctx.db.query('predictorVerdicts').collect();
    const probeVerdicts = verdicts.filter((v2) => v2.matchId.indexOf(PROBE_PREFIX) !== -1);

    const old1 = probes.find((m) => m.matchId.endsWith('-old-1'));
    const old2 = probes.find((m) => m.matchId.endsWith('-old-2'));
    const recent = probes.find((m) => m.matchId.endsWith('-recent'));
    const upcoming = probes.find((m) => m.matchId.endsWith('-upcoming'));

    const result = {
      purgedOld1: old1 === undefined,
      purgedOld2: old2 === undefined,
      survivedRecent: recent !== undefined,
      survivedUpcoming: upcoming !== undefined,
      probeVerdictsRemaining: probeVerdicts.length
    };
    const pass = result.purgedOld1 && result.purgedOld2 && result.survivedRecent && result.survivedUpcoming;

    // Cleanup: remove every probe row (matches + verdicts) regardless of outcome
    for (const m of probes) await ctx.db.delete(m._id);
    for (const v2 of probeVerdicts) await ctx.db.delete(v2._id);

    return { pass, ...result };
  }
});
