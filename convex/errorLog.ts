// ── Lightweight ring-buffer error log ─────────────────────────────────────────
// Storage-efficient error capture: a capped number of rows per source (default
// 50 per source). New errors evict the OLDEST row for that same source, so
// `errorLog` never grows — it is a fixed-size window, not an append-only log.
// Covers client (window.onerror), edge functions, and any Convex caller that
// pipes errors in; Convex-side failures are recorded by the orchestrator and
// cron wrappers too.
//
// Storage impact: bounded at MAX_PER_SOURCE rows × number of sources. At the
// default cap this is a few hundred short rows, flat forever.

import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';

export const MAX_PER_SOURCE = 50;

export const recordError = internalMutation({
  args: {
    source: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    meta: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert('errorLog', {
      source: args.source.slice(0, 60),
      message: String(args.message || 'unknown').slice(0, 500),
      stack: args.stack ? String(args.stack).slice(0, 2000) : undefined,
      meta: args.meta ?? undefined,
      createdAt: now
    });
    // Ring-buffer eviction for this source.
    const rows = await ctx.db
      .query('errorLog')
      .withIndex('by_source_time', (q) => q.eq('source', args.source.slice(0, 60)))
      .order('desc')
      .collect();
    if (rows.length > MAX_PER_SOURCE) {
      for (const row of rows.slice(MAX_PER_SOURCE)) await ctx.db.delete(row._id);
    }
    return { ok: true };
  }
});

/** Client/edge-facing error capture. Rate-limited via the ring buffer itself. */
export const report = mutation({
  args: {
    source: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    meta: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.errorLog.recordError, {
      source: args.source,
      message: args.message,
      stack: args.stack,
      meta: args.meta
    });
    return { ok: true };
  }
});

/** Recent errors, newest first (ops dashboard / health endpoint). */
export const recent = query({
  args: { source: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 100);
    if (args.source) {
      return ctx.db
        .query('errorLog')
        .withIndex('by_source_time', (q) => q.eq('source', args.source!))
        .order('desc')
        .take(limit);
    }
    return ctx.db.query('errorLog').withIndex('by_time', (q) => q.gt('createdAt', 0)).order('desc').take(limit);
  }
});
