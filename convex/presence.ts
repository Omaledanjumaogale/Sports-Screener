// ── Native realtime presence ─────────────────────────────────────────────────
// Lightweight heartbeat presence: clients call `updatePresence` every ~30s;
// `listPresence` counts heartbeats younger than the window so the UI can show a
// live "N analysts online" indicator. Stale rows are swept by the cleanup cron.

import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';

/** A client is "online" if it heartbeated within this window. */
export const PRESENCE_WINDOW_MS = 90_000;

export const update = mutation({
  args: { owner: v.string(), sportId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('presence')
      .withIndex('by_owner', (q) => q.eq('owner', args.owner))
      .first();
    const lastSeen = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sportId: args.sportId ?? existing.sportId,
        lastSeen
      });
    } else {
      await ctx.db.insert('presence', { owner: args.owner, sportId: args.sportId, lastSeen });
    }
    return { ok: true, lastSeen };
  }
});

export const list = query({
  args: { sportId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - PRESENCE_WINDOW_MS;
    if (args.sportId) {
      const rows = await ctx.db
        .query('presence')
        .withIndex('by_sport_lastSeen', (q) => q.eq('sportId', args.sportId).gt('lastSeen', cutoff))
        .collect();
      return { online: rows.length };
    }
    const rows = await ctx.db.query('presence').withIndex('by_lastSeen', (q) => q.gt('lastSeen', cutoff)).collect();
    return { online: rows.length };
  }
});

/** Cron helper: delete heartbeats older than the window. */
export const sweepStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_WINDOW_MS;
    const stale = await ctx.db.query('presence').withIndex('by_lastSeen', (q) => q.lt('lastSeen', cutoff)).collect();
    for (const row of stale) await ctx.db.delete(row._id);
    return { swept: stale.length };
  }
});
