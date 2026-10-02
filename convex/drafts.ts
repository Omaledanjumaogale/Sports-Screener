import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { authenticatedRecordOwner } from './recordOwnership';

// Cloud drafts require verified authentication; anonymous work remains local.
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
    const effectiveUserId = await authenticatedRecordOwner(ctx);

    const subject = (await ctx.auth.getUserIdentity())!.subject;
    for (const owner of new Set([effectiveUserId, subject])) {
      const userDraft = await ctx.db
        .query('drafts')
        .withIndex('by_user_sport', (q) => q.eq('userId', owner).eq('sportId', args.sportId))
        .order('desc')
        .first();
      if (userDraft) return userDraft;
    }

    return null;
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
    const effectiveUserId = await authenticatedRecordOwner(ctx);
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
    const effectiveUserId = await authenticatedRecordOwner(ctx);
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
