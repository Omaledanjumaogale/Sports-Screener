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
  v.literal('baseball'),
  v.literal('americanfootball'),
  v.literal('rugby'),
  v.literal('cricket'),
  v.literal('mma'),
  v.literal('volleyball')
);

export const PREDICTOR_SPORT_IDS = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('rally'),
  v.literal('hockey'),
  v.literal('baseball'),
  v.literal('americanfootball'),
  v.literal('rugby'),
  v.literal('cricket'),
  v.literal('mma'),
  v.literal('volleyball')
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
      v.literal('baseball'),
      v.literal('americanfootball'),
      v.literal('rugby'),
      v.literal('cricket'),
      v.literal('mma'),
      v.literal('volleyball')
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
    .index('by_txRef', ['txRef']),

  predictorDays: defineTable({
    dayKey: v.string(),
    sportId: PREDICTOR_SPORT_IDS,
    status: v.union(
      v.literal('pending'),
      v.literal('refreshing'),
      v.literal('ready'),
      v.literal('partial'),
      v.literal('stale'),
      v.literal('error')
    ),
    lastRefreshAt: v.optional(v.number()),
    expiresAt: v.number(),
    runId: v.optional(v.string()),
    cap: v.number(),
    sourcesUsed: v.array(v.string()),
    message: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_sport_day', ['sportId', 'dayKey'])
    .index('by_day', ['dayKey', 'createdAt']),

  predictorRuns: defineTable({
    runId: v.string(),
    dayKey: v.string(),
    sportId: PREDICTOR_SPORT_IDS,
    progress: v.number(),
    stage: v.string(),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('complete'),
      v.literal('error')
    ),
    message: v.optional(v.string()),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    updatedAt: v.number()
  })
    .index('by_sport_day', ['sportId', 'dayKey', 'startedAt'])
    .index('by_runId', ['runId']),

  predictorMatches: defineTable({
    dayKey: v.string(),
    sportId: PREDICTOR_SPORT_IDS,
    matchId: v.string(),
    league: v.string(),
    homeTeam: v.string(),
    awayTeam: v.string(),
    startTime: v.number(),
    source: v.string(),
    marketsAvailable: v.array(v.string()),
    scopes: v.any(),
    oddsSnapshot: v.optional(v.any()),
    finalScore: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal('upcoming'), v.literal('inplay'), v.literal('finished'))
    ),
    createdAt: v.number()
  })
    .index('by_sport_day', ['sportId', 'dayKey', 'startTime'])
    .index('by_sport_startTime', ['sportId', 'startTime'])
    .index('by_day_match', ['dayKey', 'matchId'])
    .index('by_sport_day_team', ['sportId', 'dayKey', 'homeTeam', 'awayTeam']),

  predictorVerdicts: defineTable({
    dayKey: v.string(),
    sportId: PREDICTOR_SPORT_IDS,
    matchId: v.string(),
    aiReport: v.any(),
    greatMindsDebate: v.optional(v.any()),
    dailyPnlSummary: v.optional(v.any()),
    llmUsed: v.optional(v.boolean()),
    llmProvider: v.optional(v.string()),
    agentsRun: v.array(v.string()),
    citations: v.array(v.string()),
    updatedAt: v.number()
  })
    .index('by_day_match', ['dayKey', 'matchId'])
    .index('by_sport_day', ['sportId', 'dayKey', 'matchId']),

  aiPredictorStats: defineTable({
    dayKey: v.string(),
    sportId: v.optional(PREDICTOR_SPORT_IDS),
    filter: v.union(v.literal('ALL'), v.literal('MONEYLINE'), v.literal('SPREAD'), v.literal('TOTAL')),
    overallWinRatePct: v.number(),
    overallUnitsPnl: v.number(),
    overallRoiPct: v.number(),
    rows: v.any(),
    updatedAt: v.number()
  })
    .index('by_day', ['dayKey'])
    .index('by_day_filter', ['dayKey', 'filter']),

  userPreferences: defineTable({
    userId: v.string(),
    theme: v.union(v.literal('dark'), v.literal('light'), v.literal('system')),
    oddsFormat: v.union(v.literal('decimal'), v.literal('american')),
    notificationsEnabled: v.boolean(),
    updatedAt: v.number()
  }).index('by_user', ['userId'])
});
