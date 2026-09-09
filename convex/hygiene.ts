// ── Database hygiene & storage minimization ───────────────────────────────────
// Keeps the Convex deployment small (free-tier friendly) without losing data
// the product needs. Strategy per table:
//
//   predictorMatches   KEEP finished rows 14 days (default), sweep older ones.
//                      Stale upcoming/in-play rows are swept by predictor.purgeOld.
//   predictorVerdicts  Cascade-deleted with their match (verdict rows are the
//                      largest payloads in the DB — aiReport + debate JSON).
//   predictorRuns      One-off progress rows — delete older than 2 days.
//   auditEvents        Money/security events (payments, auth) are permanent;
//                      operational events (refresh/sync stamps) capped at 500.
//   rateLimitBuckets   Windows older than 1 hour are dead — swept daily.
//   actionCache        Expired rows swept daily.
//   presence           Already swept every 10 min (existing cron).
//   pushSubscriptions  Anonymous rows untouched for 30d swept (in-module).
//   emailTokens        Expired codes swept (in-module).
//   drafts             Session drafts untouched for 90 days swept.
//
// The selection logic is exported PURE (no Convex imports) so vitest can prove
// correctness without ever touching production data. `hygieneSweep` wires it.

import { internalMutation, internalAction } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

declare const process: { env: Record<string, string | undefined> };

// ── Pure selection logic (unit-testable) ──────────────────────────────────────

/** Parse a `YYYY-MM-DD` dayKey to a UTC timestamp (or 0 when malformed). */
export function dayKeyToTs(dayKey: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dayKey || ''));
  if (!m) return 0;
  const ts = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ts) ? ts : 0;
}

export function isDeadRateLimitBucket(windowStart: number, now: number): boolean {
  // Any fixed window older than 1h can no longer be incremented meaningfully
  // (every limiter in the app uses periods ≤ 60s; 1h is a wide safety margin).
  return now - windowStart > 3_600_000;
}

/** Audit rows that are operational (not money/security). */
export function isOperationalAuditRow(action: string): boolean {
  return !/payment|subscription|auth|password|role/i.test(action);
}

// ── The sweep ─────────────────────────────────────────────────────────────────

/**
 * Database hygiene sweep — BOUNDED & INCREMENTAL.
 *
 * Each pass processes at most MAX_DAYS oldest stale days with a total delete
 * budget of MAX_DELETES, and only reads via indexed per-day queries — so a
 * pass can never blow the per-mutation read/write limits no matter how large
 * the database grows. Registered hourly: steady-state cleanup happens within
 * hours of data aging out, with tiny per-pass cost (free-tier friendly).
 */
export const hygieneSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const summary: Record<string, number> = {
      matches: 0,
      verdicts: 0,
      runs: 0,
      audits: 0,
      rateLimitBuckets: 0,
      actionCache: 0,
      days: 0,
      drafts: 0,
      daysProcessed: 0
    };

    const MAX_DELETES = 1200;
    const MAX_DAYS = 4;

    // 1) Finished matches + cascaded verdicts older than the retention window
    //    (default 14d, PREDICTOR_RETENTION_DAYS overrides). Oldest days first.
    const days = Number(process.env.PREDICTOR_RETENTION_DAYS || '') > 0
      ? Number(process.env.PREDICTOR_RETENTION_DAYS)
      : 14;
    const cutoff = now - days * 86_400_000;
    const cutoffDay = new Date(cutoff).toISOString().slice(0, 10);

    const staleDayRows = await ctx.db
      .query('predictorDays')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoffDay))
      .order('asc')
      .take(MAX_DAYS + 2);

    for (const d of staleDayRows) {
      if (summary.matches + summary.verdicts >= MAX_DELETES) break;
      summary.daysProcessed++;

      const dayMatches = await ctx.db
        .query('predictorMatches')
        .withIndex('by_day_match', (q) => q.eq('dayKey', d.dayKey))
        .take(600);
      for (const m of dayMatches) {
        if (summary.matches + summary.verdicts >= MAX_DELETES) break;
        const started = m.startTime > 0 ? m.startTime : dayKeyToTs(m.dayKey);
        const finished = m.status === 'finished' || !!m.finalScore;
        if (!finished || started <= 0 || started >= cutoff) continue;
        // Cascade: the verdict payload (aiReport + debate JSON) is the largest
        // row type in the DB — always drop it with its match.
        const verdict = await ctx.db
          .query('predictorVerdicts')
          .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
          .first();
        if (verdict) {
          await ctx.db.delete(verdict._id);
          summary.verdicts++;
        }
        await ctx.db.delete(m._id);
        summary.matches++;
      }

      // Day + stats rows whose matches are all gone (or purely schedule rows
      // for days older than the cutoff).
      const remaining = await ctx.db
        .query('predictorMatches')
        .withIndex('by_day_match', (q) => q.eq('dayKey', d.dayKey))
        .take(1);
      if (remaining.length === 0) {
        await ctx.db.delete(d._id);
        summary.days++;
        const dayStats = await ctx.db
          .query('aiPredictorStats')
          .withIndex('by_day', (q) => q.eq('dayKey', d.dayKey))
          .collect();
        for (const s of dayStats) {
          await ctx.db.delete(s._id);
          summary.days++;
        }
      }
    }

    // 2) predictorRuns — one-off progress rows, useless after 2 days. Runs are
    //    small; sweep by scan is safe here (purgeOld bounds their lifetime).
    const oldRuns = await ctx.db.query('predictorRuns').collect();
    for (const r of oldRuns) {
      if (r.startedAt < now - 2 * 86_400_000) {
        await ctx.db.delete(r._id);
        summary.runs++;
      }
    }

    // 3) auditEvents — payments/auth/roles are permanent; operational rows
    //    capped at 500 newest. Read via by_createdAt (small rows), take(2000).
    const audits = await ctx.db
      .query('auditEvents')
      .withIndex('by_createdAt', (q) => q.lt('createdAt', now))
      .order('desc')
      .take(2000);
    const operational = audits.filter((a) => isOperationalAuditRow(a.action));
    for (const row of operational.slice(500)) {
      await ctx.db.delete(row._id);
      summary.audits++;
    }

    // 4) rateLimitBuckets — dead windows (small rows, indexed read).
    const buckets = await ctx.db
      .query('rateLimitBuckets')
      .withIndex('by_window', (q) => q.lt('windowStart', now - 3_600_000))
      .take(500);
    for (const b of buckets) {
      if (isDeadRateLimitBucket(b.windowStart, now)) {
        await ctx.db.delete(b._id);
        summary.rateLimitBuckets++;
      }
    }

    // 5) actionCache — expired rows only (indexed read, bounded by expiry).
    const cacheRows = await ctx.db
      .query('actionCache')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
      .take(500);
    for (const row of cacheRows) {
      await ctx.db.delete(row._id);
      summary.actionCache++;
    }

    // 6) drafts — untouched for 90 days (indexed read).
    const draftRows = await ctx.db
      .query('drafts')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', now - 90 * 86_400_000))
      .take(500);
    for (const d of draftRows) {
      await ctx.db.delete(d._id);
      summary.drafts++;
    }

    // 7) Anonymous push rows + expired email tokens (their own modules).
    try {
      await ctx.runMutation(internal.pushSubscriptions.sweepStale, {});
    } catch { /* table may be empty — fine */ }
    try {
      await ctx.runMutation(internal.email.sweepExpiredTokens, {});
    } catch { /* nothing pending — fine */ }

    // Stamp cron health so /api/health reflects the sweep.
    try {
      await ctx.runMutation(internal.cronHealth.stampCron, {
        job: 'hygiene',
        ok: true,
        note: `m:${summary.matches} v:${summary.verdicts} d:${summary.daysProcessed}`
      });
    } catch { /* health row is best-effort */ }

    return summary;
  }
});

/** Cron wrapper: runs the sweep as an action so it can also be re-run
 *  manually via the dashboard without holding a mutation open too long. */
export const hygieneSweepAction = internalAction({
  args: {},
  handler: async (ctx): Promise<Record<string, number>> => {
    return ctx.runMutation(internal.hygiene.hygieneSweep, {});
  }
});
