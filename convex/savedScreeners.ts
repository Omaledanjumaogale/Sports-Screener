import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const list = query({
  args: {
    sportId: v.optional(v.union(
      v.literal('football'),
      v.literal('basketball'),
      v.literal('tennis'),
      v.literal('rally'),
      v.literal('hockey'),
      v.literal('instant-football'),
      v.literal('instant-basketball'),
      v.literal('vfootball'),
      v.literal('baseball')
    )),
    sessionId: v.string(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject ?? args.userId;

    const seen = new Set<string>();
    const merged: any[] = [];
    const push = (doc: any) => {
      if (doc && !seen.has(doc._id)) {
        seen.add(doc._id);
        merged.push(doc);
      }
    };

    // 1. Records owned by the signed-in user (real identity or user-arg).
    if (effectiveUserId) {
      const userDocs = args.sportId
        ? await ctx.db
            .query('savedScreeners')
            .withIndex('by_sport_and_user', (q) =>
              q.eq('sportId', args.sportId!).eq('userId', effectiveUserId!)
            )
            .order('desc')
            .collect()
        : await ctx.db
            .query('savedScreeners')
            .withIndex('by_user', (q) => q.eq('userId', effectiveUserId!))
            .order('desc')
            .collect();
      for (const d of userDocs) push(d);
    }

    // 2. Records owned by this browser session (covers pre-login saves).
    const sessionDocs = args.sportId
      ? await ctx.db
          .query('savedScreeners')
          .withIndex('by_sport_and_session', (q) =>
            q.eq('sportId', args.sportId!).eq('sessionId', args.sessionId)
          )
          .order('desc')
          .collect()
      : await ctx.db
          .query('savedScreeners')
          .withIndex('by_session', (q) => q.eq('sessionId', args.sessionId))
          .order('desc')
          .collect();
    for (const d of sessionDocs) push(d);

    return merged;
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
      v.literal('hockey'),
      v.literal('instant-football'),
      v.literal('instant-basketball'),
      v.literal('vfootball'),
      v.literal('baseball')
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
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject ?? args.userId;
    const now = Date.now();
    if (args._id) {
      const existing = await ctx.db.get(args._id);
      if (existing && (existing.sessionId === args.sessionId || (effectiveUserId && existing.userId === effectiveUserId))) {
        await ctx.db.patch(args._id, {
          title: args.title,
          notes: args.notes,
          scopes: args.scopes,
          verdict: args.verdict,
          userId: effectiveUserId ?? existing.userId,
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
      userId: effectiveUserId,
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
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject ?? args.userId;
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    if (existing.sessionId !== args.sessionId && (!effectiveUserId || existing.userId !== effectiveUserId)) return null;
    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title;
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.scopes !== undefined) patch.scopes = args.scopes;
    if (args.verdict !== undefined) patch.verdict = args.verdict;
    if (effectiveUserId !== undefined) patch.userId = effectiveUserId;
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
    const identity = await ctx.auth.getUserIdentity();
    const effectiveUserId = identity?.subject ?? args.userId;
    const existing = await ctx.db.get(args.id);
    if (existing && (existing.sessionId === args.sessionId || (effectiveUserId && existing.userId === effectiveUserId))) {
      await ctx.db.delete(args.id);
    }
    return null;
  }
});

