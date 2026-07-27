import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  savedScreeners: defineTable({
    sportId: v.union(
      v.literal('football'),
      v.literal('basketball'),
      v.literal('tennis'),
      v.literal('rally')
    ),
    title: v.string(),
    notes: v.optional(v.string()),
    scopes: v.any(),
    verdict: v.optional(v.object({
      headline: v.string(),
      chips: v.array(v.object({
        label: v.string(),
        value: v.string(),
        status: v.union(v.literal('green'), v.literal('amber'), v.literal('red'), v.literal('empty'))
      })),
      topPick: v.optional(v.object({
        marketId: v.string(),
        marketTitle: v.string(),
        label: v.string(),
        probability: v.number(),
        odds: v.number(),
        ev: v.optional(v.number())
      }))
    })),
    sessionId: v.string(),
    userId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_sport_and_session', ['sportId', 'sessionId', 'createdAt'])
    .index('by_session', ['sessionId', 'createdAt'])
    .index('by_user', ['userId', 'createdAt'])
    .index('by_sport_and_user', ['sportId', 'userId', 'createdAt'])
});
