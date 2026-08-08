import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

// Auto-saved per-sport screener drafts. Owners are either a real Convex user
// identity (when an auth token is attached) or an anonymous browser session id.
// Drafts let a user's in-progress work follow them across devices/browsers.

const sportId = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('rally'),
  v.literal('hockey'),
  v.literal('instant-football'),
  v.literal('instant-basketball'),
  v.literal('vfootball'),
  v.literal('baseball'),
  v.literal('americanfootball'),
  v.literal('rugby'),
  v.literal('cricket'),
  v.literal('mma'),
  v.literal('volleyball')
);

export const get = query({
  args: {
    sportId,
    sessionId: v.string(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject ?? args.userId;

    // 1. Prefer the user-owned draft (real identity or user-arg).
    if (effectiveUserId) {
      const userDraft = await ctx.db
        .query('drafts')
        .withIndex('by_user_sport', (q) => q.eq('userId', effectiveUserId).eq('sportId', args.sportId))
        .order('desc')
        .first();
      if (userDraft) return userDraft;
    }

    // 2. Fall back to the anonymous session draft.
    return await ctx.db
      .query('drafts')
      .withIndex('by_session_sport', (q) => q.eq('sessionId', args.sessionId).eq('sportId', args.sportId))
      .order('desc')
      .first();
  }
});

export const save = mutation({
  args: {
    sportId,
    sessionId: v.string(),
    userId: v.optional(v.string()),
    scopes: v.any()
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject ?? args.userId;
    const owner = effectiveUserId ?? args.sessionId;
    const now = Date.now();

    const existing = await ctx.db
      .query('drafts')
      .withIndex('by_owner_sport', (q) => q.eq('owner', owner).eq('sportId', args.sportId))
      .order('desc')
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        sessionId: args.sessionId,
        userId: effectiveUserId,
        scopes: args.scopes,
        updatedAt: now
      });
      return existing._id;
    }

    return await ctx.db.insert('drafts', {
      owner,
      sessionId: args.sessionId,
      userId: effectiveUserId,
      sportId: args.sportId,
      scopes: args.scopes,
      updatedAt: now
    });
  }
});

export const remove = mutation({
  args: {
    sportId,
    sessionId: v.string(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject ?? args.userId;
    const owner = effectiveUserId ?? args.sessionId;

    const existing = await ctx.db
      .query('drafts')
      .withIndex('by_owner_sport', (q) => q.eq('owner', owner).eq('sportId', args.sportId))
      .order('desc')
      .first();

    if (existing) await ctx.db.delete(existing._id);
    return null;
  }
});
