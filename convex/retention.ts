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

declare const process: { env: Record<string, string | undefined> };

/** Configured retention window in days. 0 (or unset/invalid) = keep forever. */
export function retentionDays(): number {
  const raw = process.env.PREDICTOR_RETENTION_DAYS?.trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * Purge finished matches (and their verdicts) that ended before the retention
 * cutoff. Always a no-op unless PREDICTOR_RETENTION_DAYS is explicitly set —
 * the default policy is indefinite storage.
 */
export const purgeFinishedMatches = internalMutation({
  args: {},
  handler: async (ctx) => {
    const days = retentionDays();
    if (days <= 0) return { purged: 0, verdictsPurged: 0, cutoff: null, policy: 'indefinite' };

    const cutoff = Date.now() - days * 86_400_000;
    const cutoffDay = new Date(cutoff).toISOString().slice(0, 10);

    const all = await ctx.db.query('predictorMatches').collect();
    const staleFinished = all.filter(
      (m) =>
        (m.status === 'finished' || !!m.finalScore) &&
        m.startTime > 0 &&
        m.startTime < cutoff
    );

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
    const oldDays = await ctx.db
      .query('predictorDays')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoffDay))
      .collect();
    for (const d of oldDays) await ctx.db.delete(d._id);

    return { purged: staleFinished.length, verdictsPurged, cutoff, policy: `${days}d` };
  }
});

/** Cron entry: wraps the mutation so the scheduler can call it directly. */
export const purgeFinishedMatchesAction = internalAction({
  args: {},
  handler: async (ctx): Promise<{ purged: number; verdictsPurged: number; cutoff: number | null; policy: string }> => {
    return await ctx.runMutation(internal.retention.purgeFinishedMatches, {});
  }
});
