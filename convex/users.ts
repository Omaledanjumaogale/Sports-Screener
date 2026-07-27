import { query, mutation } from './_generated/server';
import { v } from 'convex/values';

export const registerProfile = mutation({
  args: {
    email: v.string(),
    fullName: v.string(),
    mobile: v.string(),
    dob: v.string(),
    stateOfResidence: v.string(),
    consentAccepted: v.boolean(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName: args.fullName,
        mobile: args.mobile,
        dob: args.dob,
        stateOfResidence: args.stateOfResidence,
        consentAccepted: args.consentAccepted,
        userId: args.userId ?? existing.userId,
        updatedAt: now
      });
      return existing._id;
    }

    return await ctx.db.insert('userProfiles', {
      email: args.email,
      fullName: args.fullName,
      mobile: args.mobile,
      dob: args.dob,
      stateOfResidence: args.stateOfResidence,
      consentAccepted: args.consentAccepted,
      userId: args.userId,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const getProfile = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();
  }
});
