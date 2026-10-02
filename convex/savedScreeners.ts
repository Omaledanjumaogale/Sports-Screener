import { query, mutation } from './_generated/server';
import { v } from 'convex/values';
import { authenticatedRecordOwner, ownsRecord } from './recordOwnership';

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
      v.literal('baseball'),
      v.literal('rugby'),
      v.literal('cricket'),
      v.literal('mma'),
      v.literal('volleyball')
    )),
    sessionId: v.string(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const effectiveUserId = await authenticatedRecordOwner(ctx);

    const seen = new Set<string>();
    const merged: any[] = [];
    const push = (doc: any) => {
      if (doc && !seen.has(doc._id)) {
        seen.add(doc._id);
        merged.push(doc);
      }
    };

    // Include current-session legacy rows while new writes use stable ownership.
    const subject = (await ctx.auth.getUserIdentity())!.subject;
    for (const owner of new Set([effectiveUserId, subject])) {
      const userDocs = args.sportId
        ? await ctx.db
            .query('savedScreeners')
            .withIndex('by_sport_and_user', (q) =>
              q.eq('sportId', args.sportId!).eq('userId', owner)
            )
            .order('desc')
            .collect()
        : await ctx.db
            .query('savedScreeners')
            .withIndex('by_user', (q) => q.eq('userId', owner))
            .order('desc')
            .collect();
      for (const d of userDocs) push(d);
    }

    return merged;
  }
});

export const get = query({
  args: { id: v.id('savedScreeners') },
  handler: async (ctx, args) => {
    const owner = await authenticatedRecordOwner(ctx);
    const record = await ctx.db.get(args.id);
    return ownsRecord(record, owner) ? record : null;
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
      v.literal('baseball'),
      v.literal('rugby'),
      v.literal('cricket'),
      v.literal('mma'),
      v.literal('volleyball')
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
    const effectiveUserId = await authenticatedRecordOwner(ctx);
    const now = Date.now();
    if (args._id) {
      const existing = await ctx.db.get(args._id);
      if (ownsRecord(existing, effectiveUserId)) {
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
    const effectiveUserId = await authenticatedRecordOwner(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) return null;
    if (!ownsRecord(existing, effectiveUserId)) return null;
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
    const effectiveUserId = await authenticatedRecordOwner(ctx);
    const existing = await ctx.db.get(args.id);
    if (ownsRecord(existing, effectiveUserId)) {
      await ctx.db.delete(args.id);
    }
    return null;
  }
});

