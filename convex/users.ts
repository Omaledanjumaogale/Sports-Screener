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
      isSubscribed: false,
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

export const markSubscribed = mutation({
  args: {
    email: v.string(),
    txRef: v.string(),
    amount: v.optional(v.number()),
    durationDays: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const durationMs = (args.durationDays ?? 30) * 24 * 60 * 60 * 1000;
    const expiresAt = now + durationMs;

    const existingProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        isSubscribed: true,
        subscriptionExpiresAt: expiresAt,
        flutterwaveTxRef: args.txRef,
        updatedAt: now
      });
    }

    // Record subscription transaction
    const existingSub = await ctx.db
      .query('subscriptions')
      .withIndex('by_txRef', (q) => q.eq('txRef', args.txRef))
      .first();

    if (existingSub) {
      await ctx.db.patch(existingSub._id, {
        status: 'successful',
        updatedAt: now
      });
    } else {
      await ctx.db.insert('subscriptions', {
        email: args.email,
        txRef: args.txRef,
        amount: args.amount ?? 5000,
        currency: 'NGN',
        status: 'successful',
        createdAt: now,
        updatedAt: now
      });
    }

    return { success: true, expiresAt };
  }
});

export const checkSubscription = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .first();

    if (!profile) return { isSubscribed: false };

    const now = Date.now();
    const active = !!profile.isSubscribed && (!profile.subscriptionExpiresAt || profile.subscriptionExpiresAt > now);

    return {
      isSubscribed: active,
      expiresAt: profile.subscriptionExpiresAt,
      txRef: profile.flutterwaveTxRef
    };
  }
});
