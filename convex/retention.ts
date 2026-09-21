// ── Finished-match lifecycle & retention policy ───────────────────────────────
// Completed games are stored INDEFINITELY by default so the app accumulates a
// historical corpus (final scores, verdicts, PnL) for long-term accuracy
// analysis. A periodic retention cron purges OUTDATED finished matches only
// when an explicit retention policy is configured via PREDICTOR_RETENTION_DAYS
// (0 / unset = keep everything forever).
//
// This module intentionally does NOT touch upcoming/in-play rows — those are
// handled by predictor.purgeOld (stale-day sweep). Splitting the two keeps the
// "store all completed games indefinitely" default airtight.

import { internalMutation, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { retentionDaysFromEnv, retentionMsFromEnv, isStaleFinishedMatch } from './retentionPolicy';

const MS_PER_DAY = 86_400_000;

declare const process: { env: Record<string, string | undefined> };

/** Configured retention window in days. 0 (or unset/invalid) = keep forever. */
/** Configured retention window in ms. 0 (or unset/invalid) = keep forever. */
export function retentionMs(): number {
  const ms = retentionMsFromEnv(process.env);
  return ms > 0 ? ms : retentionDaysFromEnv(process.env) * MS_PER_DAY;
}

/**
 * Purge finished matches (and their verdicts) that ended before the retention
   * cutoff before the configured retention window elapses (RETENTION_HOURS /
   * PREDICTOR_RETENTION_DAYS - supports sub-day windows such as 12h). No policy
   * configured = indefinite storage.
 */
export const purgeFinishedMatches = internalMutation({
  args: {},
  handler: async (ctx) => {
    const ms = retentionMs();
    if (ms <= 0) return { purged: 0, verdictsPurged: 0, cutoff: null, policy: 'indefinite' };

    const cutoff = Date.now() - retentionMs();
    const cutoffDay = new Date(cutoff).toISOString().slice(0, 10);

    const all = await ctx.db.query('predictorMatches').collect();
    const staleFinished = all.filter((m) => isStaleFinishedMatch(m, cutoff));

    let verdictsPurged = 0;
    for (const m of staleFinished) {
      await ctx.db.delete(m._id);
      // Cascade: drop the stored verdict for the purged match.
      const verdict = await ctx.db
        .query('predictorVerdicts')
        .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
        .first();
      if (verdict) {
        await ctx.db.delete(verdict._id);
        verdictsPurged += 1;
      }
    }

    // Finished matches older than the retention window no longer need their
    // predictorDays rows (they only describe the schedule cache).
    const oldDaysAll = await ctx.db
      .query('predictorDays')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoffDay))
      .collect();
    const oldDays = oldDaysAll.filter((d) => (d.lastRefreshAt ?? 0) < cutoff);
    for (const d of oldDays) await ctx.db.delete(d._id);

    return { purged: staleFinished.length, verdictsPurged, cutoff, policy: `${(retentionMs() / 3_600_000).toFixed(1)}h` };
  }
});

/** Cron entry: wraps the mutation so the scheduler can call it directly. */
export const purgeFinishedMatchesAction = internalAction({
  args: {},
  handler: async (ctx): Promise<{ purged: number; verdictsPurged: number; cutoff: number | null; policy: string }> => {
    const result = await ctx.runMutation(internal.retention.purgeFinishedMatches, {});
    // Heartbeat for /api/health cron monitoring (async — must not roll back).
    await ctx.runMutation(internal.cronHealth.stampCron, {
      job: 'retention',
      ok: true,
      note: `purged:${result.purged} v:${result.verdictsPurged}`
    });
    return result;
  }
});
