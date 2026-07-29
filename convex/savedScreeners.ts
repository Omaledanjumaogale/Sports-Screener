import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {
    sportId: v.optional(v.union(
      v.literal('football'),
      v.literal('basketball'),
      v.literal('tennis'),
      v.literal('rally'),
      v.literal('hockey')
    )),
    sessionId: v.string(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let results;
    if (args.userId) {
      if (args.sportId) {
        results = await ctx.db
          .query('savedScreeners')
          .withIndex('by_sport_and_user', (q) =>
            q.eq('sportId', args.sportId!).eq('userId', args.userId!)
          )
          .order('desc')
          .collect();
      } else {
        results = await ctx.db
          .query('savedScreeners')
          .withIndex('by_user', (q) => q.eq('userId', args.userId!))
          .order('desc')
          .collect();
      }
    } else if (args.sportId) {
      results = await ctx.db
        .query('savedScreeners')
        .withIndex('by_sport_and_session', (q) =>
          q.eq('sportId', args.sportId!).eq('sessionId', args.sessionId)
        )
        .order('desc')
        .collect();
    } else {
      results = await ctx.db
        .query('savedScreeners')
        .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
        .order('desc')
        .collect();
    }
    return results;
  }
});

export const get = query({
  args: { id: v.id('savedScreeners') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  }
});

export const save = mutation({
  args: {
    sportId: v.union(
      v.literal('football'),
      v.literal('basketball'),
      v.literal('tennis'),
      v.literal('rally'),
      v.literal('hockey')
    ),
    title: v.string(),
    notes: v.optional(v.string()),
    scopes: v.any(),
    verdict: v.optional(v.any()),
    sessionId: v.string(),
    userId: v.optional(v.string()),
    _id: v.optional(v.id('savedScreeners'))
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args._id) {
      const existing = await ctx.db.get(args._id);
      if (existing && (existing.sessionId === args.sessionId || (args.userId && existing.userId === args.userId))) {
        await ctx.db.patch(args._id, {
          title: args.title,
          notes: args.notes,
          scopes: args.scopes,
          verdict: args.verdict,
          userId: args.userId ?? existing.userId,
          updatedAt: now
        });
        return args._id;
      }
    }
    return await ctx.db.insert('savedScreeners', {
      sportId: args.sportId,
      title: args.title,
      notes: args.notes,
      scopes: args.scopes,
      verdict: args.verdict,
      sessionId: args.sessionId,
      userId: args.userId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const update = mutation({
  args: {
    id: v.id('savedScreeners'),
    sessionId: v.string(),
    userId: v.optional(v.string()),
    title: v.optional(v.string()),
    notes: v.optional(v.string()),
    scopes: v.optional(v.any()),
    verdict: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    if (existing.sessionId !== args.sessionId && (!args.userId || existing.userId !== args.userId)) return null;
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.scopes !== undefined) patch.scopes = args.scopes;
    if (args.verdict !== undefined) patch.verdict = args.verdict;
    if (args.userId !== undefined) patch.userId = args.userId;
    await ctx.db.patch(args.id, patch);
  }
});

export const remove = mutation({
  args: {
    id: v.id('savedScreeners'),
    sessionId: v.string(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (existing && (existing.sessionId === args.sessionId || (args.userId && existing.userId === args.userId))) {
      await ctx.db.delete(args.id);
    }
    return null;
  }
});

