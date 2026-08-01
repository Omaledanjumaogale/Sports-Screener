import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from "@convex-dev/auth/server";

export const SPORT_IDS = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('rally'),
  v.literal('hockey'),
  v.literal('instant-football'),
  v.literal('instant-basketball'),
  v.literal('vfootball'),
  v.literal('baseball')
);

export default defineSchema({
  ...authTables,
  drafts: defineTable({
    owner: v.string(),
    sessionId: v.string(),
    userId: v.optional(v.string()),
    sportId: SPORT_IDS,
    scopes: v.any(),
    updatedAt: v.number()
  })
    .index('by_owner_sport', ['owner', 'sportId'])
    .index('by_session_sport', ['sessionId', 'sportId'])
    .index('by_user_sport', ['userId', 'sportId']),

  savedScreeners: defineTable({
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
    // Free-form verdict payload (headline, chips, topPick, masterLedger,
    // aiInsights, metrics, masterRankings). Stored as `any` so legacy docs and
    // future additions never drift out of sync with the client.
    verdict: v.optional(v.any()),
    sessionId: v.string(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_sport_and_session', ['sportId', 'sessionId', 'createdAt'])
    .index('by_session', ['sessionId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt'])
    .index('by_sport_and_user', ['sportId', 'userId', 'createdAt']),

  userProfiles: defineTable({
    userId: v.optional(v.string()),
    email: v.string(),
    fullName: v.string(),
    mobile: v.string(),
    dob: v.string(),
    stateOfResidence: v.string(),
    consentAccepted: v.boolean(),
    role: v.optional(v.union(v.literal('user'), v.literal('tester'), v.literal('admin'))),
    isTester: v.optional(v.boolean()),
    trialStartsAt: v.optional(v.number()),
    isSubscribed: v.optional(v.boolean()),
    subscriptionExpiresAt: v.optional(v.number()),
    flutterwaveTxRef: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_email', ['email']),

  subscriptions: defineTable({
    email: v.string(),
    userId: v.optional(v.string()),
    txRef: v.string(),
    transactionId: v.optional(v.string()),
    amount: v.number(),
    currency: v.string(),
    status: v.union(v.literal('pending'), v.literal('successful'), v.literal('failed')),
    flwRef: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_email', ['email'])
    .index('by_txRef', ['txRef'])
});
