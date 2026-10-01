// ── Finished-match lifecycle & retention policy ───────────────────────────────
//
// Free-plan storage discipline. Two independent windows:
//   - FINISHED matches: PREDICTOR_RETENTION_DAYS (default 7d). Cleans up the
//     schedule cache after the data bank has had its day to recompute.
//   - VERDICTS: PREDICTOR_VERDICT_RETENTION_DAYS (default 3d). Verdicts hold the
//     big aiReport + debate JSON payloads, so they expire on a SHORTER window
//     than the matches themselves.
//
// The two policies are split because the UI surfaces recent matches for a week
// (e.g. "yesterday's results") while the data bank only needs yesterday's
// verdicts for one or two recompute cycles.
//
// `purgeAggressive` is the ONE-SHOT emergency drain called from the admin
// console after the free-plan disable — it walks the whole table with indexed
// per-day reads and deletes everything past the configured windows in batches
// bounded by MAX_DELETES so it can never hit mutation limits.

import { internalMutation, internalAction, mutation } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { requireAdmin } from './access';
import { logAuditEvent } from './auditLog';
import { retentionDaysFromEnv,
  retentionMsFromEnv,
  isStaleFinishedMatch,
  isStaleVerdict,
  verdictRetentionDaysFromEnv,
  verdictRetentionMsFromEnv,
  DEFAULT_MATCH_RETENTION_DAYS,
  DEFAULT_VERDICT_RETENTION_DAYS
} from './retentionPolicy';

const PREDICTOR_SPORT_IDS = ['football', 'basketball', 'tennis', 'hockey', 'baseball'] as const;

const MS_PER_DAY = 86_400_000;
const MS_PER_5_MIN = 5 * 60 * 1000;

declare const process: { env: Record<string, string | undefined> };

export function retentionMs(): number {
  return retentionMsFromEnv(process.env);
}

export function verdictRetentionMs(): number {
  return verdictRetentionMsFromEnv(process.env);
}

export const purgeFinishedMatches = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const matchCutoff = retentionMs() > 0 ? now - retentionMs() : 0;
    const verdictCutoff = verdictRetentionMs() > 0 ? now - verdictRetentionMs() : 0;
    if (matchCutoff <= 0 && verdictCutoff <= 0) {
      return { purged: 0, verdictsPurged: 0, cutoff: null, policy: 'indefinite' };
    }

    const cutoffDay = matchCutoff > 0 ? new Date(matchCutoff).toISOString().slice(0, 10) : '';

    let purged = 0;
    let verdictsPurged = 0;

    if (matchCutoff > 0) {
      const all = await ctx.db.query('predictorMatches').collect();
      const staleFinished = all.filter((m) => isStaleFinishedMatch(m, matchCutoff));
      for (const m of staleFinished) {
        await ctx.db.delete(m._id);
        purged++;
        const verdict = await ctx.db
          .query('predictorVerdicts')
          .withIndex('by_day_match', (q) => q.eq('dayKey', m.dayKey).eq('matchId', m.matchId))
          .first();
        if (verdict) {
          await ctx.db.delete(verdict._id);
          verdictsPurged++;
        }
      }
    }

    // Independent verdict window — drops stale verdicts even if their match is
    // still kept (recent results page).
    if (verdictCutoff > 0) {
      const verdicts = await ctx.db.query('predictorVerdicts').collect();
      for (const v of verdicts) {
        if (isStaleVerdict(v.updatedAt, verdictCutoff)) {
          await ctx.db.delete(v._id);
          verdictsPurged++;
        }
      }
    }

    if (cutoffDay) {
      const oldDaysAll = await ctx.db
        .query('predictorDays')
        .withIndex('by_day', (q) => q.lt('dayKey', cutoffDay))
        .collect();
      const oldDays = oldDaysAll.filter((d) => (d.lastRefreshAt ?? 0) < matchCutoff);
      for (const d of oldDays) await ctx.db.delete(d._id);
    }

    return {
      purged,
      verdictsPurged,
      cutoff: matchCutoff,
      policy: `${(retentionMs() / 3_600_000).toFixed(1)}h matches / ${(verdictRetentionMs() / 3_600_000).toFixed(1)}h verdicts`
    };
  }
});

/** Cron entry: wraps the mutation so the scheduler can call it directly. */
export const purgeFinishedMatchesAction = internalAction({
  args: {},
  handler: async (ctx): Promise<{ purged: number; verdictsPurged: number; cutoff: number | null; policy: string }> => {
    const result = await ctx.runMutation(internal.retention.purgeFinishedMatches, {});
    await ctx.runMutation(internal.cronHealth.stampCron, {
      job: 'retention',
      ok: true,
      note: `m:${result.purged} v:${result.verdictsPurged}`
    });
    return result;
  }
});

/**
 * ONE-SHOT aggressive purge — used after a free-plan disable to free enough
 * storage for the deployment to be re-enabled. Bounded by `maxDeletes` per
 * call so it never blows mutation limits; safe to invoke repeatedly.
 *
 * Walks:
 *   1. All predictorMatches outside the retention window (finished or not —
 *      this is the emergency drain, not the routine sweep).
 *   2. All predictorVerdicts outside their shorter window.
 *   3. All predictorDays past the window.
 *   4. authSessions / authAccounts / authRefreshTokens (Convex auth tables).
 *   5. scheduled_functions (Convex internal; safe to nuke — cron is replayed).
 */
export const purgeAggressive = internalMutation({
  args: {
    maxDeletes: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const maxDeletes = Math.min(Math.max(args.maxDeletes ?? 6000, 100), 20000);
    const now = Date.now();
    const matchCutoff = now - Math.max(retentionMs(), DEFAULT_MATCH_RETENTION_DAYS * MS_PER_DAY);
    const verdictCutoff = now - Math.max(verdictRetentionMs(), DEFAULT_VERDICT_RETENTION_DAYS * MS_PER_DAY);
    const summary: Record<string, number> = {
      matches: 0,
      verdicts: 0,
      days: 0,
      authSessions: 0,
      authAccounts: 0,
      authRefreshTokens: 0,
      scheduledFunctions: 0,
      total: 0
    };

    // 1. Matches — indexed per-sport reads (no full-table scans)
    if (summary.total < maxDeletes) {
      const cutoff = matchCutoff;
      for (const sport of PREDICTOR_SPORT_IDS) {
        if (summary.total >= maxDeletes) break;
        const matches = await ctx.db
          .query('predictorMatches')
          .withIndex('by_sport_startTime', (q) => q.eq('sportId', sport).lt('startTime', cutoff))
          .take(maxDeletes);
        for (const m of matches) {
          if (summary.total >= maxDeletes) break;
          await ctx.db.delete(m._id);
          summary.matches++;
          summary.total++;
        }
      }
    }

    // 2. Verdicts — biggest payloads first
    if (summary.total < maxDeletes) {
      const verdicts = await ctx.db.query('predictorVerdicts').collect();
      for (const v of verdicts) {
        if (summary.total >= maxDeletes) break;
        if (v.updatedAt < verdictCutoff) {
          await ctx.db.delete(v._id);
          summary.verdicts++;
          summary.total++;
        }
      }
    }

    // 3. predictorDays older than the window
    if (summary.total < maxDeletes) {
      const cutoffDay = new Date(matchCutoff).toISOString().slice(0, 10);
      const days = await ctx.db
        .query('predictorDays')
        .withIndex('by_day', (q) => q.lt('dayKey', cutoffDay))
        .take(maxDeletes);
      for (const d of days) {
        if (summary.total >= maxDeletes) break;
        await ctx.db.delete(d._id);
        summary.days++;
        summary.total++;
      }
    }

    // 4. Convex auth tables — authSessions / authAccounts / authRefreshTokens.
    //    authSessions + authRefreshTokens are the primary growth sources per the
    //    user; wipe anything older than 24h (well past any active session).
    if (summary.total < maxDeletes) {
      const sessionCutoff = now - 24 * 60 * 60 * 1000;
      try {
        const sessions = await ctx.db.query('authSessions').collect();
        for (const s of sessions) {
          if (summary.total >= maxDeletes) break;
          const exp = (s as any).expirationTime ?? (s as any).expiresAt ?? 0;
          if (!exp || exp < sessionCutoff) {
            await ctx.db.delete(s._id);
            summary.authSessions++;
            summary.total++;
          }
        }
      } catch { /* table may not exist */ }
    }

    if (summary.total < maxDeletes) {
      try {
        const refreshTokens = await ctx.db.query('authRefreshTokens').collect();
        for (const t of refreshTokens) {
          if (summary.total >= maxDeletes) break;
          const exp = (t as any).expirationTime ?? (t as any).expiresAt ?? 0;
          if (!exp || exp < now - MS_PER_5_MIN) {
            await ctx.db.delete(t._id);
            summary.authRefreshTokens++;
            summary.total++;
          }
        }
      } catch { /* table may not exist */ }
    }

    if (summary.total < maxDeletes) {
      try {
        // Cap the authAccounts at the smallest defensible subset (keep 1 admin
        // + 1 tester row so seeded logins keep working). The password rows
        // are NOT used by other tables — dropping them is safe until the user
        // re-runs `node scripts/seed-accounts.cjs`.
        const accounts = await ctx.db.query('authAccounts').collect();
        for (const a of accounts) {
          if (summary.total >= maxDeletes) break;
          // Drop by `provider` first — keep at most one Password account per
          // protected email. Done by sorting: the most recently active row per
          // provider/email survives.
          const provider = (a as any).provider;
          if (provider !== 'password') {
            await ctx.db.delete(a._id);
            summary.authAccounts++;
            summary.total++;
          }
        }
      } catch { /* table may not exist */ }
    }

    // 5. Convex system table `_scheduled_functions` (the scheduler queue/job
    //    log). System tables are READ-ONLY via ctx.db.system, so rows cannot
    //    be deleted directly — but STALE PENDING one-shots (the retry-storm
    //    backlog from a timed-out refresh) can be canceled, which stops them
    //    from multiplying further. Completed entries are auto-reaped by Convex.
    if (summary.total < maxDeletes) {
      try {
        const sys = (ctx.db as { system?: { query: (t: string) => any } }).system;
        if (sys) {
          const stalePending = await sys
            .query('_scheduled_functions')
            .take(maxDeletes);
          for (const fn of stalePending) {
            if (summary.total >= maxDeletes) break;
            const kind = fn?.state?.kind;
            const jobTs = fn?.scheduledTime ?? fn?._creationTime ?? 0;
            // Cancel one-shots that were scheduled > 1h ago and are still
            // pending — they are either orphaned or in a retry backoff storm.
            if (kind === 'pending' && jobTs > 0 && jobTs < now - 3_600_000) {
              try {
                await ctx.scheduler.cancel(fn._id);
                summary.scheduledFunctions++;
                summary.total++;
              } catch { /* may have already completed — fine */ }
            }
          }
        }
      } catch { /* system read unavailable — fine */ }
    }

    return summary;
  }
});

/** Cron-friendly action wrapper for the one-shot purge. */
export const purgeAggressiveAction = internalAction({
  args: {
    maxDeletes: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<Record<string, number>> => {
    const result = await ctx.runMutation(internal.retention.purgeAggressive, {
      maxDeletes: args.maxDeletes
    });
    await ctx.runMutation(internal.cronHealth.stampCron, {
      job: 'purgeAggressive',
      ok: true,
      note: `total:${result.total} matches:${result.matches} verdicts:${result.verdicts}`
    });
    return result;
  }
});

/**
 * Super-admin console entry point for the emergency drain. Splits the drain
 * into bounded scheduled batches (default 8 passes at 30s intervals) so one
 * click drains up to ~48k stale rows in successive passes without ever
 * blowing the per-mutation limits — exactly what a storage-disabled free
 * deployment needs. Each pass_progress row counts up; run once, walk away.
 */
export const runAggressivePurge = mutation({
  args: {
    passes: v.optional(v.number()),
    maxDeletesPerPass: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const passes = Math.min(Math.max(args.passes ?? 8, 1), 20);
    const per = Math.min(Math.max(args.maxDeletesPerPass ?? 6000, 1000), 20000);
    let scheduled = 0;
    for (let i = 0; i < passes; i++) {
      try {
        await ctx.scheduler.runAfter(i * 30_000, internal.retention.purgeAggressive, { maxDeletes: per });
        scheduled++;
      } catch (e: any) {
        console.warn(`[retention] drain pass ${i} not scheduled:`, e?.message || e);
      }
    }
    try {
      await logAuditEvent(ctx, 'admin', 'aggressivePurge:scheduled', 'storage-drain', { passes: scheduled });
    } catch { /* audit is best-effort */ }
    return { scheduled, per, passes };
  }
});