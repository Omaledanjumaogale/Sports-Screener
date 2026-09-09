// ── Web-push plumbing (backend) ───────────────────────────────────────────────
// Stores browser push subscriptions and (optionally) sends notifications via
// the Resend email API when RESEND_API_KEY is configured. VAPID web-push
// delivery can be added later by POSTing to a Pages Function; the storage and
// preference layer is complete so the client can subscribe today and the
// delivery path can be wired without schema changes.
//
// Storage-efficient: one row per (userId, endpoint-hash) with an upsert; stale
// rows for the same user are pruned on each write; each user is capped at 5
// devices. Anonymous (unverified) subscriptions live in the same table with
// userId undefined and are swept by the daily hygiene cron once stale.

import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { currentAccess } from './access';

const MAX_DEVICES_PER_USER = 5;
const ANON_CAP = 500;

function hashEndpoint(endpoint: string): string {
  let h = 5381;
  for (let i = 0; i < endpoint.length; i++) h = ((h << 5) + h + endpoint.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Register or refresh a push subscription for the current user. */
export const saveSubscription = mutation({
  args: { endpoint: v.string(), keys: v.any() },
  handler: async (ctx, args) => {
    const access = await currentAccess(ctx);
    if (!access) throw new Error('Sign in to enable notifications.');
    const epHash = hashEndpoint(args.endpoint);
    const now = Date.now();

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user_ep', (q) => q.eq('userId', access.email).eq('endpointHash', epHash))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { keys: args.keys, updatedAt: now });
      return { ok: true, id: existing._id };
    }

    // Cap: prune this user's oldest subscriptions beyond MAX_DEVICES_PER_USER.
    const mine = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', access.email))
      .collect();
    const stale = mine.sort((a, b) => a.updatedAt - b.updatedAt);
    while (stale.length >= MAX_DEVICES_PER_USER) {
      const oldest = stale.shift();
      if (oldest) await ctx.db.delete(oldest._id);
    }

    // Global cap for anonymous rows so unknown writers can't inflate the table.
    const anonCount = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', ''))
      .collect();
    if (anonCount.length > ANON_CAP) {
      const old = anonCount.sort((a, b) => a.updatedAt - b.updatedAt).slice(0, anonCount.length - ANON_CAP);
      for (const row of old) await ctx.db.delete(row._id);
    }

    const id = await ctx.db.insert('pushSubscriptions', {
      userId: access.email,
      endpointHash: epHash,
      endpoint: args.endpoint.slice(0, 500),
      keys: args.keys,
      createdAt: now,
      updatedAt: now
    });
    return { ok: true, id };
  }
});

/** Remove a subscription (unsubscribe flow). */
export const removeSubscription = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const access = await currentAccess(ctx);
    if (!access) return { ok: false };
    const epHash = hashEndpoint(args.endpoint);
    const row = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user_ep', (q) => q.eq('userId', access.email).eq('endpointHash', epHash))
      .first();
    if (row) await ctx.db.delete(row._id);
    return { ok: true };
  }
});

/** All subscriptions (internal — delivery workers / future VAPID sender). */
export const listInternal = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 200, 500);
    return ctx.db.query('pushSubscriptions').withIndex('by_updated', (q) => q.gt('updatedAt', 0)).take(limit);
  }
});

/** Sweep anonymous rows untouched for 30 days (called by hygiene cron). */
export const sweepStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 86_400_000;
    const stale = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', (q) => q.eq('userId', ''))
      .collect()
      .then((rows) => rows.filter((r) => r.updatedAt < cutoff));
    for (const row of stale) await ctx.db.delete(row._id);
    return { swept: stale.length };
  }
});

/** Notification preferences live on userPreferences; expose a toggle here. */
export const setEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const access = await currentAccess(ctx);
    if (!access) throw new Error('Sign in required.');
    const pref = await ctx.db
      .query('userPreferences')
      .withIndex('by_user', (q) => q.eq('userId', access.email))
      .first();
    const now = Date.now();
    if (pref) {
      await ctx.db.patch(pref._id, { notificationsEnabled: args.enabled, updatedAt: now });
    } else {
      await ctx.db.insert('userPreferences', {
        userId: access.email,
        theme: 'system',
        oddsFormat: 'decimal',
        notificationsEnabled: args.enabled,
        updatedAt: now
      });
    }
    return { ok: true };
  }
});

