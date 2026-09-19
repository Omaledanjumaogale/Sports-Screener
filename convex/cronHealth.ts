// ── Cron heartbeat / health tracking ──────────────────────────────────────────
// Every scheduled job stamps a single upserted row per job name. One row per
// job (not per run) keeps the table flat — storage impact is effectively zero
// — while giving ops a live view of whether the pipeline is silently dead.
// `/api/health` reports these so an external uptime monitor (or the dashboard)
// can alert when a cron stops stamping.

import { internalMutation, query } from './_generated/server';
import { v } from 'convex/values';

const ROWS = ['orchestrator', 'scoreSync', 'pastHistory', 'presence', 'retention', 'purge', 'hygiene'] as const;
export type CronRow = (typeof ROWS)[number];

export const stampCron = internalMutation({
  args: {
    job: v.union(...ROWS.map((r) => v.literal(r))),
    ok: v.boolean(),
    note: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('cronHealth')
      .withIndex('by_job', (q) => q.eq('job', args.job))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { ok: args.ok, note: args.note, lastRunAt: now });
    } else {
      await ctx.db.insert('cronHealth', { job: args.job, ok: args.ok, note: args.note, lastRunAt: now });
    }
    return { ok: true };
  }
});

/** Health snapshot used by /api/health and any status dashboard. */
export const getHealth = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('cronHealth').collect();
    const byJob: Record<string, { ok: boolean; lastRunAt: number; note?: string }> = {};
    for (const r of rows) {
      byJob[r.job] = { ok: r.ok, lastRunAt: r.lastRunAt, note: r.note ?? undefined };
    }
    for (const job of ROWS) {
      if (!byJob[job]) byJob[job] = { ok: true, lastRunAt: 0 };
    }
    const now = Date.now();
    const freshness = {
      // 26h: daily jobs may legitimately skip to the next slot.
      daily: 26 * 3600_000,
      // 30 min: 15-min live-score sync with generous jitter allowance.
      frequent: 30 * 60_000,
      // 14h: 12h past-history settlement cycle (cadence + 2h margin).
      history: 14 * 3600_000,
      // 2h: hourly retention purge (cadence + 1h margin).
      retention: 2 * 3600_000
    };
    const isStale = (lastRunAt: number, max: number) => lastRunAt > 0 && now - lastRunAt > max;
    const flags = {
      orchestratorStale: isStale(byJob.orchestrator.lastRunAt, freshness.daily),
      scoreSyncStale: isStale(byJob.scoreSync.lastRunAt, freshness.frequent),
      presenceStale: isStale(byJob.presence.lastRunAt, freshness.frequent),
      retentionStale: isStale(byJob.retention.lastRunAt, freshness.retention),
      purgeStale: isStale(byJob.purge.lastRunAt, freshness.daily),
      pastHistoryStale: isStale(byJob.pastHistory.lastRunAt, freshness.history)
    };
    return { jobs: byJob, flags, now };
  }
});
