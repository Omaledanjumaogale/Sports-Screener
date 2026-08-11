// Real-time live score synchronization and historical completed match settlement.
// Emeka Obi's score engine: continuously syncs live match scores, updates finished
// match status, and calculates settled PnL statistics on Convex.

import { internalAction, internalMutation, mutation, query } from './_generated/server';
import { internal, api } from './_generated/api';
import { v } from 'convex/values';
import { fetchScoresForDate, fetchHtmlResultScores, scoreIsPlausible } from './apis/sportsApis';
import { watTodayKey, watDayKeyFor } from './scrapers/sources';
import { enforceRateLimit } from './rateLimit';
import { logAuditEvent } from './auditLog';

const PREDICTOR_SPORT_IDS = [
  'football',
  'basketball',
  'tennis',
  'rally',
  'hockey',
  'baseball',
  'americanfootball',
  'rugby',
  'cricket',
  'mma',
  'volleyball'
] as const;

function normalizeName(name: string): string {
  return String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// Internal mutation to update scorelines and status in predictorMatches in batch
export const updateScoresBatch = internalMutation({
  args: {
    updates: v.array(
      v.object({
        dayKey: v.string(),
        matchId: v.string(),
        finalScore: v.string(),
        status: v.union(v.literal('upcoming'), v.literal('inplay'), v.literal('finished'))
      })
    )
  },
  handler: async (ctx, args) => {
    let updatedCount = 0;
    for (const u of args.updates) {
      const match = await ctx.db
        .query('predictorMatches')
        .withIndex('by_day_match', (q) => q.eq('dayKey', u.dayKey).eq('matchId', u.matchId))
        .first();

      if (match) {
        // Final gate: never write a scoreline that is physically impossible for
        // this sport (e.g. a kickoff clock "19:00" misread as football "19 - 0"
        // or a basketball score applied to a football match).
        if (u.finalScore) {
          const p = parseScore(u.finalScore);
          if (p && !scoreIsPlausible(match.sportId, p.home, p.away)) continue;
        }
        if (match.finalScore !== u.finalScore || match.status !== u.status) {
          await ctx.db.patch(match._id, {
            finalScore: u.finalScore,
            status: u.status,
            oddsSnapshot: {
              ...(match.oddsSnapshot ?? {}),
              finalScore: u.finalScore,
              status: u.status
            }
          });
          updatedCount++;
        }
      }
    }
    return updatedCount;
  }
});

// Internal Action: Sync real-time scores for current/today's active matches across all sports
export const syncScoresAction = internalAction({
  args: { dayKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ updated: number }> => {
    const targetDay = args.dayKey || watTodayKey();
    let totalUpdated = 0;

    // Self-heal: purge implausible scorelines (clock-as-score leaks, cross-sport
    // contamination) before this cycle scans — each pass starts from clean data.
    await ctx.runMutation(internal.scores.sanitizeImplausibleScores, {}).catch(() => {});

    for (const sport of PREDICTOR_SPORT_IDS) {
      try {
        const matches = await ctx.runQuery(internal.predictor.getCachedMatches, {
          sportId: sport,
          dayKey: targetDay
        });

        if (!matches || matches.length === 0) continue;

        const fetchedScores = await fetchScoresForDate(sport, targetDay);
        // NOTE: no early-continue when fetchedScores is empty — the HTML
        // result-page failover below is the ONLY path that can resolve a final
        // score when every API layer returns nothing (e.g. reader-key-only
        // sources). Skipping straight to `continue` left finished matches with
        // no scoreline forever.

        const updatesToApply: {
          dayKey: string;
          matchId: string;
          finalScore: string;
          status: 'upcoming' | 'inplay' | 'finished';
        }[] = [];

        const unmatched: { matchId: string; home: string; away: string; dayKey: string }[] = [];

        for (const m of matches) {
          const hk = normalizeName(m.homeTeam);
          const ak = normalizeName(m.awayTeam);

          const found = fetchedScores.find((fs) => {
            const fhk = normalizeName(fs.home);
            const fak = normalizeName(fs.away);
            return (fhk === hk && fak === ak) || (fhk.includes(hk) && fak.includes(ak)) || (hk.includes(fhk) && ak.includes(fak));
          });

          if (found && scorePassesGate(sport, found.finalScore)) {
            updatesToApply.push({
              dayKey: targetDay,
              matchId: m.matchId,
              finalScore: found.finalScore,
              status: found.status
            });
          } else if (
            (m.status !== 'finished' || !m.finalScore) &&
            // Only attempt the HTML result-page fallback for matches that have
            // already kicked off (+1h buffer) — a fixture days in the future
            // cannot have a result, and scanning result pages for it would
            // waste reader quota every 5-minute cycle.
            m.startTime > 0 &&
            m.startTime < Date.now() + 60 * 60 * 1000
          ) {
            unmatched.push({ matchId: m.matchId, home: m.homeTeam, away: m.awayTeam, dayKey: targetDay });
          }
        }

        if (unmatched.length > 0) {
          const htmlScores = await fetchHtmlResultScores(
            sport,
            targetDay,
            unmatched.map((u) => ({ home: u.home, away: u.away }))
          );
          for (const u of unmatched) {
            const fs = htmlScores.find(
              (s) =>
                normalizeName(s.home) === normalizeName(u.home) &&
                normalizeName(s.away) === normalizeName(u.away)
            );
            if (fs && scorePassesGate(sport, fs.finalScore)) {
              updatesToApply.push({
                dayKey: targetDay,
                matchId: u.matchId,
                finalScore: fs.finalScore,
                status: fs.status
              });
            }
          }
        }

        if (updatesToApply.length > 0) {
          const updated = await ctx.runMutation(internal.scores.updateScoresBatch, {
            updates: updatesToApply
          });
          totalUpdated += updated;
        }
      } catch (err: any) {
        console.error(`[ScoresSync] Error syncing scores for ${sport} on ${targetDay}:`, err?.message || err);
      }
    }

    try {
      await ctx.scheduler.runAfter(0, internal.scores.settleDayPnl, { dayKey: targetDay });
    } catch {}

    return { updated: totalUpdated };
  }
});

// Internal Action: Sync past match history for the past 7 days across all sports
export const syncPastHistoryAction = internalAction({
  args: {},
  handler: async (ctx): Promise<{ daysProcessed: number; matchesUpdated: number }> => {
    let daysProcessed = 0;
    let matchesUpdated = 0;

    for (let i = 1; i <= 7; i++) {
      const dayKey = watDayKeyFor(-i);
      daysProcessed++;

      const res = await ctx.runAction(internal.scores.syncScoresAction, { dayKey });
      matchesUpdated += res?.updated ?? 0;
    }

    return { daysProcessed, matchesUpdated };
  }
});

// A numeric scoreline passes only when it is plausible for the sport. Empty
// scorelines (status-only updates such as a transition to in-play before any
// score exists) and non-numeric markers (e.g. "PPD") pass through unchanged;
// updateScoresBatch applies its own plausibility gate to non-empty scores.
function scorePassesGate(sportId: string, finalScore: string): boolean {
  if (!finalScore) return true;
  const p = parseScore(finalScore);
  if (!p) return true;
  return scoreIsPlausible(sportId, p.home, p.away);
}

// ── Implausible-score sanitizer ───────────────────────────────────────────────
// Backstop that scans the cache and strips any stored scoreline that cannot be
// produced by the match's own sport (kickoff-clock misreads like "19 - 0",
// cross-sport contamination like a basketball score on a football match). Such
// rows are demoted to 'upcoming'/'inplay' so the Finished tab never shows them.
// Idempotent and safe to run on every score cycle.
export const sanitizeImplausibleScores = internalMutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query('predictorMatches').collect();
    let fixed = 0;
    for (const m of all) {
      const raw = m.finalScore ?? m.oddsSnapshot?.finalScore;
      if (!raw) continue;
      const p = parseScore(raw);
      if (!p || scoreIsPlausible(m.sportId, p.home, p.away)) continue;

      const started = m.startTime > 0 && m.startTime <= Date.now();
      const nextStatus = started ? 'inplay' : 'upcoming';
      const snap: Record<string, unknown> = { ...(m.oddsSnapshot ?? {}) };
      delete snap.finalScore;
      delete snap.status;
      await ctx.db.patch(m._id, {
        finalScore: undefined,
        status: nextStatus,
        oddsSnapshot: snap
      });
      fixed++;
    }
    return { fixed };
  }
});

// ── Server-side PnL settlement ────────────────────────────────────────────────
// After scores sync marks a match finished, Emeka's engine settles every stored
// top-3 selection against the real final score and persists per-day summary
// stats into aiPredictorStats so the Daily PnL summary renders even before the
// browser recomputes it client-side.

type Grade = 'win' | 'loss' | 'push' | null;

function parseScore(score?: string | null): { home: number; away: number } | null {
  if (!score) return null;
  const m = String(score).trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

function isWinnerMarket(market: string): boolean {
  return /winner|moneyline|result|matchwinner|regresult|1x2|match.?.?.?.?winner/i.test(market);
}
function isSpreadMarket(market: string): boolean {
  return /handicap|spread|line|puck|runline|sell/i.test(market);
}
function isTotalMarket(market: string): boolean {
  return /total|over.?under|main|homeAway|game|set.?total|points|goals|runs/i.test(market) && !isSpreadMarket(market);
}
function extractThreshold(text: string): number | null {
  const m = String(text).match(/(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function gradeSelection(
  selection: string,
  market: string,
  finalScore?: string | null,
  opts?: { homeTeam?: string; awayTeam?: string }
): Grade {
  const score = parseScore(finalScore);
  if (!score) return null;

  const lower = String(market || '').toLowerCase();
  const sel = String(selection || '');

  if (isTotalMarket(lower)) {
    const side = /home/.test(lower) ? score.home : /away/.test(lower) ? score.away : score.home + score.away;
    const threshold = extractThreshold(sel);
    if (threshold == null) return null;
    if (/(^|\s)over[\s\S]*/i.test(sel)) {
      if (side > threshold) return 'win';
      if (side === threshold) return 'push';
      return 'loss';
    }
    if (side < threshold) return 'win';
    if (side === threshold) return 'push';
    return 'loss';
  }

  if (isWinnerMarket(lower)) {
    const lowerSel = sel.toLowerCase();
    const home = opts?.homeTeam?.toLowerCase();
    const away = opts?.awayTeam?.toLowerCase();
    if (/(^|\s)draw/i.test(lowerSel)) {
      return score.home === score.away ? 'win' : 'loss';
    }
    const isHome = home ? lowerSel.includes(home) : /home|^\d\s|\bteam\s*a\b|^1\b/i.test(lowerSel);
    const isAway = isHome ? false : away ? lowerSel.includes(away) : /away|team\s*b|^2\b/i.test(lowerSel);
    if (isHome) return score.home > score.away ? 'win' : 'loss';
    if (isAway) return score.away > score.home ? 'win' : 'loss';
    return null;
  }

  if (isSpreadMarket(lower)) {
    const threshold = extractThreshold(sel);
    if (threshold == null) return null;
    const lowerSel = sel.toLowerCase();
    const home = opts?.homeTeam?.toLowerCase();
    const away = opts?.awayTeam?.toLowerCase();
    const isHome = home ? lowerSel.includes(home) : /home|^1\b/.test(lowerSel);
    const isAway = home ? lowerSel.includes(away ?? '') : /away|^2\b/.test(lowerSel);
    const base = isAway ? score.away : score.home;
    const other = isAway ? score.home : score.away;
    const adjusted = base + threshold;
    if (adjusted > other) return 'win';
    if (adjusted === other) return 'push';
    return 'loss';
  }

  return null;
}

const SETTLE_FILTERS = ['ALL', 'MONEYLINE', 'SPREAD', 'TOTAL'] as const;

function marketFilterOf(market: string): 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL' {
  const lower = String(market || '').toLowerCase();
  if (isWinnerMarket(lower)) return 'MONEYLINE';
  if (isSpreadMarket(lower)) return 'SPREAD';
  if (isTotalMarket(lower)) return 'TOTAL';
  return 'ALL';
}

// Internal action: settle every finished match for a day. Reads cached matches +
// verdicts, grades top3 selections into W/L/P and units PnL, and persists per
// day+filter summaries back into aiPredictorStats.
export const settleDayPnl = internalAction({
  args: { dayKey: v.string() },
  handler: async (ctx, args): Promise<{ picks: number; wins: number; losses: number; dayKey: string }> => {
    const dayKey = args.dayKey || watTodayKey();
    let picks = 0;
    let wins = 0;
    let losses = 0;

    const buckets: Record<'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL', { picks: number; wins: number; losses: number; push: number; units: number }> = {
      ALL: { picks: 0, wins: 0, losses: 0, push: 0, units: 0 },
      MONEYLINE: { picks: 0, wins: 0, losses: 0, push: 0, units: 0 },
      SPREAD: { picks: 0, wins: 0, losses: 0, push: 0, units: 0 },
      TOTAL: { picks: 0, wins: 0, losses: 0, push: 0, units: 0 }
    };

    for (const sport of PREDICTOR_SPORT_IDS) {
      try {
        const matches = await ctx.runQuery(internal.predictor.getCachedMatches, { sportId: sport, dayKey });
        if (!matches || matches.length === 0) continue;

        for (const m of matches) {
          if (m.status !== 'finished' || !m.finalScore) continue;
          const verdict = await ctx.runQuery(api.predictor.getVerdict, { dayKey, matchId: m.matchId }).catch(() => null);
          if (!verdict?.aiReport) continue;
          const topN = Array.isArray(verdict.aiReport.top3Selections) ? verdict.aiReport.top3Selections : [];
          if (topN.length === 0) continue;

          for (const t of topN) {
            const selection = String(t?.selection || '');
            const marketTitle = String(t?.marketTitle || 'Core Market');
            const grade = gradeSelection(selection, marketTitle, m.finalScore, { homeTeam: m.homeTeam, awayTeam: m.awayTeam });
            if (!grade) continue;
            const filter = marketFilterOf(marketTitle);
            const all = buckets.ALL;
            const b = buckets[filter];
            b.picks += 1;
            all.picks += 1;
            if (grade === 'win') {
              b.wins += 1;
              all.wins += 1;
              b.units += 0.95;
              all.units += 0.95;
              wins += 1;
            } else if (grade === 'loss') {
              b.losses += 1;
              all.losses += 1;
              b.units -= 1;
              all.units -= 1;
              losses += 1;
            } else {
              b.push += 1;
              all.push += 1;
            }
            picks += 1;
          }
        }
      } catch (err: any) {
        console.error(`[SettlePnl] ${sport}/${dayKey}:`, err?.message || err);
      }
    }

    // Running lifetime aggregate (native aggregate wiring): accumulate this
    // day's graded picks into the single predictorTotals doc so long-term
    // accuracy/PnL counters are maintained incrementally, not re-scanned.
    await ctx
      .runMutation(internal.scores.accumulatePredictorTotals, {
        picks: buckets.ALL.picks,
        wins: buckets.ALL.wins,
        losses: buckets.ALL.losses,
        pushes: buckets.ALL.push,
        units: buckets.ALL.units
      })
      .catch(() => {});

    for (const filter of SETTLE_FILTERS) {
      const b = buckets[filter];
      const winRatePct = b.picks > 0 ? Math.round((b.wins / b.picks) * 100) : 0;
      const roiPct = b.picks > 0 ? Number(((b.units / b.picks) * 100).toFixed(1)) : 0;
      try {
        await ctx.runMutation(api.predictor.saveDailyPnlSummary, {
          dayKey,
          filter,
          overallWinRatePct: winRatePct,
          overallUnitsPnl: Number(b.units.toFixed(1)),
          overallRoiPct: roiPct,
          rows: [
            {
              ratioKey: filter,
              consensusLabel: filter === 'ALL' ? 'OVERALL' : `${filter} CONSENSUS`,
              picksCount: b.picks,
              wins: b.wins,
              losses: b.losses,
              push: b.push,
              winRatePct,
              unitsPnl: Number(b.units.toFixed(1)),
              roiPct
            }
          ]
        });
      } catch (err: any) {
        console.error(`[SettlePnl] persist ${dayKey}/${filter}:`, err?.message || err);
      }
    }

    return { picks, wins, losses, dayKey };
  }
});

// Public mutation to manually trigger score sync for a given day (default:
// today). includePastDays additionally schedules the past 7 days so the
// Finished tab of a multi-day window gets its scorelines settled immediately
// instead of waiting for the 3-hour history cron.
export const triggerScoreSync = mutation({
  args: { dayKey: v.optional(v.string()), includePastDays: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const day = args.dayKey || watTodayKey();

    // Enterprise hardening: cap manual score-sync requests (6/min) so a loop or
    // repeated button mashing can't schedule unlimited sync actions.
    const allowed = await enforceRateLimit(ctx, 'scoreSync', day, 6, 60_000);
    if (!allowed) {
      return { ok: false, message: 'Score sync is rate limited — try again in a moment.' };
    }
    await logAuditEvent(ctx, 'user', 'scores.sync', day, { includePastDays: !!args.includePastDays });

    await ctx.scheduler.runAfter(0, internal.scores.syncScoresAction, { dayKey: day });
    if (args.includePastDays) {
      for (let i = 1; i <= 7; i++) {
        await ctx.scheduler.runAfter(0, internal.scores.syncScoresAction, { dayKey: watDayKeyFor(-i) });
      }
    }
    return { ok: true, message: `Score sync scheduled for ${day}${args.includePastDays ? ' + past 7 days' : ''}` };
  }
});

// ── Running lifetime totals (native aggregate) ────────────────────────────────
// Incrementally maintained counters of every graded pick, updated by
// settleDayPnl. The AccuracyMonitorPanel / PnL summary can read this without
// re-scanning the match cache.
export const accumulatePredictorTotals = internalMutation({
  args: {
    picks: v.number(),
    wins: v.number(),
    losses: v.number(),
    pushes: v.number(),
    units: v.number()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('predictorTotals').first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        picks: existing.picks + args.picks,
        wins: existing.wins + args.wins,
        losses: existing.losses + args.losses,
        pushes: existing.pushes + args.pushes,
        units: Number((existing.units + args.units).toFixed(1)),
        updatedAt: Date.now()
      });
    } else {
      await ctx.db.insert('predictorTotals', {
        picks: args.picks,
        wins: args.wins,
        losses: args.losses,
        pushes: args.pushes,
        units: Number(args.units.toFixed(1)),
        updatedAt: Date.now()
      });
    }
    return { ok: true };
  }
});

export const getPredictorTotals = query({
  args: {},
  handler: async (ctx) => {
    const t = await ctx.db.query('predictorTotals').first();
    return (
      t ?? {
        picks: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        units: 0,
        updatedAt: 0
      }
    );
  }
});
