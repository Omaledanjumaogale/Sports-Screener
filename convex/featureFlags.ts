// ── Feature flags & kill switch ───────────────────────────────────────────────
// Tiny native flag store. Any feature can be disabled instantly (without a
// deploy) by inserting/patching a row; absence of a row defaults to ENABLED so
// the table stays tiny and every check is a single indexed read.
//
// Known flags:
//   predictor  — the whole AI Predictor module (data queries + refresh)
//   payments   — Flutterwave checkout + verification
//   maintenance — global maintenance mode banner (reported by /api/health)

import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import type { QueryCtx } from './_generated/server';
import { requireAdmin } from './access';

/** Read a flag; missing row = enabled (default-open, keeps the table minimal). */
export async function isFeatureEnabled(ctx: QueryCtx, key: string): Promise<boolean> {
  const row = await ctx.db
    .query('featureFlags')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first();
  return row ? row.enabled : true;
}

/** Read-only status snapshot for the ops endpoint / admin UI. */
export const listFlags = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query('featureFlags').collect();
    return rows.map((r) => ({ key: r.key, enabled: r.enabled, note: r.note, updatedAt: r.updatedAt }));
  }
});

/** Admin-only toggle. Creates the row on first use. */
export const setFlag = mutation({
  args: { key: v.string(), enabled: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const key = args.key.trim().toLowerCase();
    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_key', (q) => q.eq('key', key))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled, note: args.note, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('featureFlags', {
      key,
      enabled: args.enabled,
      note: args.note,
      updatedAt: now
    });
  }
});

/** Internal upsert used by deployment bootstrap (no auth context in crons). */
export const setFlagInternal = internalMutation({
  args: { key: v.string(), enabled: v.boolean(), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('featureFlags')
      .withIndex('by_key', (q) => q.eq('key', args.key))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { enabled: args.enabled, note: args.note, updatedAt: now });
      return;
    }
    await ctx.db.insert('featureFlags', { key: args.key, enabled: args.enabled, note: args.note, updatedAt: now });
  }
});
