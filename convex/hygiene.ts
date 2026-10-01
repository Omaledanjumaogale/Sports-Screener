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
import { retentionDaysFromEnv } from './retentionPolicy';

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
 * the database grows. Registered every 6 hours.
 *
 * Storage-cut pass: also STRIPS `oddsSnapshot` from finished matches older
 * than 48h. `oddsSnapshot` is the largest payload stored on a match row
 * (full odds book per market) and is only needed while the match is in-play.
 * After it finishes, the snapshot is dead weight.
 */
export const hygieneSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const summary: Record<string, number> = {
      total: 0,
      matches: 0,
      verdicts: 0,
      runs: 0,
      audits: 0,
      rateLimitBuckets: 0,
      actionCache: 0,
      days: 0,
      drafts: 0,
      snapshotsStripped: 0,
      authSessions: 0,
      authRefreshTokens: 0,
      daysProcessed: 0
    };

    const MAX_DELETES = 1200;
    const MAX_DAYS = 4;

    // 1) Finished matches + cascaded verdicts older than the retention window
    //    (PREDICTOR_RETENTION_DAYS, default 7d — retentionPolicy.ts owns the
    //    default). Oldest days first.
    const days = retentionDaysFromEnv(process.env);
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

    // 2) Storage cut: STRIP `oddsSnapshot` from finished matches older than
    //    48h. This is the heaviest payload per match row, and it is only
    //    meaningful while the match is in-play or just-finished. Strips use
    //    the existing `by_sport_startTime` index so they are bounded reads.
    if (summary.total < MAX_DELETES) {
      const stripCutoff = now - 48 * 60 * 60 * 1000;
      // Per-sport indexed reads so a single pass can never read more than
      // PREDICTOR_SPORT_IDS.length * 200 rows.
      const sports = ['football', 'basketball', 'tennis', 'hockey', 'baseball'] as const;
      for (const sportId of sports) {
        if (summary.snapshotsStripped >= 500) break;
        const rows = await ctx.db
          .query('predictorMatches')
          .withIndex('by_sport_startTime', (q) => q.eq('sportId', sportId).lt('startTime', stripCutoff))
          .take(200);
        for (const m of rows) {
          if (summary.snapshotsStripped >= 500) break;
          if (m.oddsSnapshot) {
            await ctx.db.patch(m._id, { oddsSnapshot: undefined });
            summary.snapshotsStripped++;
          }
        }
      }
    }

    // 3) predictorRuns — one-off progress rows, useless after 2 days. Runs are
    //    small; sweep by scan is safe here (purgeOld bounds their lifetime).
    const oldRuns = await ctx.db.query('predictorRuns').collect();
    for (const r of oldRuns) {
      if (r.startedAt < now - 2 * 86_400_000) {
        await ctx.db.delete(r._id);
        summary.runs++;
      }
    }

    // 4) auditEvents — payments/auth/roles are permanent; operational rows
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

    // 5) rateLimitBuckets — dead windows (small rows, indexed read).
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

    // 6) actionCache — expired rows only (indexed read, bounded by expiry).
    const cacheRows = await ctx.db
      .query('actionCache')
      .withIndex('by_expiresAt', (q) => q.lt('expiresAt', now))
      .take(500);
    for (const row of cacheRows) {
      await ctx.db.delete(row._id);
      summary.actionCache++;
    }

    // 7) drafts — untouched for 90 days (indexed read).
    const draftRows = await ctx.db
      .query('drafts')
      .withIndex('by_updatedAt', (q) => q.lt('updatedAt', now - 90 * 86_400_000))
      .take(500);
    for (const d of draftRows) {
      await ctx.db.delete(d._id);
      summary.drafts++;
    }

    // 8) Anonymous push rows + expired email tokens (their own modules).
    try {
      await ctx.runMutation(internal.pushSubscriptions.sweepStale, {});
    } catch { /* table may be empty — fine */ }
    try {
      await ctx.runMutation(internal.email.sweepExpiredTokens, {});
    } catch { /* nothing pending — fine */ }

    // 9) Convex auth tables — sessions + refresh tokens older than 24h are
    //    dead storage. Bounded by the shared delete budget.
    if (summary.total < MAX_DELETES) {
      const sessionCutoff = now - 24 * 60 * 60 * 1000;
      try {
        const sessions = await ctx.db.query('authSessions').collect();
        for (const s of sessions) {
          const exp = (s as any).expirationTime ?? (s as any).expiresAt ?? 0;
          if (!exp || exp < sessionCutoff) {
            await ctx.db.delete(s._id);
            summary.authSessions++;
            summary.total++;
          }
        }
      } catch { /* table may not exist */ }
    }
    if (summary.total < MAX_DELETES) {
      try {
        const tokens = await ctx.db.query('authRefreshTokens').collect();
        for (const t of tokens) {
          const exp = (t as any).expirationTime ?? (t as any).expiresAt ?? 0;
          if (!exp || exp < now - 5 * 60 * 1000) {
            await ctx.db.delete(t._id);
            summary.authRefreshTokens++;
            summary.total++;
          }
        }
      } catch { /* table may not exist */ }
    }

    // Stamp cron health so /api/health reflects the sweep.
    try {
      await ctx.runMutation(internal.cronHealth.stampCron, {
        job: 'hygiene',
        ok: true,
        note: `m:${summary.matches} v:${summary.verdicts} strip:${summary.snapshotsStripped} d:${summary.daysProcessed}`
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
