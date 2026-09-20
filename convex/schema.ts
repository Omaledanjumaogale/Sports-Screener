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
    .index('by_user_sport', ['userId', 'sportId'])
    .index('by_updatedAt', ['updatedAt']),

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
    subscriptionTier: v.optional(v.union(v.literal('punter'), v.literal('master'))),
    flutterwaveTxRef: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index('by_email', ['email']),

  subscriptions: defineTable({
    email: v.string(),
    userId: v.optional(v.string()),
    txRef: v.string(),
    transactionId: v.optional(v.string()),
    tier: v.optional(v.union(v.literal('punter'), v.literal('master'))),
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
    dataQuality: v.optional(v.string()),
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
    // Jev (typesafe/jev) structured evaluation for this match — noul/choice/
    // score answers + engine metadata. Rides the same 12h retention purge.
    jevEvaluation: v.optional(v.any()),
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
    .index('by_day_filter', ['dayKey', 'filter'])
    .index('by_filter', ['filter']),

  userPreferences: defineTable({
    userId: v.string(),
    theme: v.union(v.literal('dark'), v.literal('light'), v.literal('system')),
    oddsFormat: v.union(v.literal('decimal'), v.literal('american')),
    notificationsEnabled: v.boolean(),
    updatedAt: v.number()
  }).index('by_user', ['userId']),

  // ── Enterprise hardening tables (native components) ──────────────────────────
  // Application-layer fixed-window rate limiting. One row per (name, key) per
  // window; mutations read-modify-write the bucket atomically (Convex serializes
  // per-document writes).
  rateLimitBuckets: defineTable({
    name: v.string(),
    key: v.string(),
    windowStart: v.number(),
    count: v.number()
  })
    .index('by_name_key', ['name', 'key'])
    .index('by_window', ['windowStart']),

  // Deterministic action-result cache (LLM verdicts, expensive computations).
  // Keyed by a stable hash of the function name + args; rows expire via TTL.
  actionCache: defineTable({
    cacheKey: v.string(),
    result: v.any(),
    expiresAt: v.number()
  })
    .index('by_cacheKey', ['cacheKey'])
    .index('by_expiresAt', ['expiresAt']),

  // Realtime presence heartbeats (owner = session/user id, per sport scope).
  presence: defineTable({
    owner: v.string(),
    sportId: v.optional(v.string()),
    lastSeen: v.number()
  })
    .index('by_owner', ['owner'])
    .index('by_lastSeen', ['lastSeen'])
    .index('by_sport_lastSeen', ['sportId', 'lastSeen']),

  // Immutable enterprise audit trail (sign-ins, refresh runs, score syncs,
  // payments). Append-only by convention.
  auditEvents: defineTable({
    actor: v.string(),
    action: v.string(),
    subject: v.string(),
    metadata: v.optional(v.any()),
    createdAt: v.number()
  })
    .index('by_createdAt', ['createdAt'])
    .index('by_actor', ['actor'])
    .index('by_action', ['action']),

  // Running lifetime aggregate of graded predictor picks (win/loss/push/units)
  // maintained incrementally by the score-settlement engine.
  predictorTotals: defineTable({
    picks: v.number(),
    wins: v.number(),
    losses: v.number(),
    pushes: v.number(),
    units: v.number(),
    updatedAt: v.number()
  }),

  // ── P0–P2 hardening tables (enterprise wave) ──────────────────────────────────

  // Kill switch / feature flags. Absence of a row = enabled (default-open),
  // so this table stays tiny (one row per known flag at most).
  featureFlags: defineTable({
    key: v.string(),
    enabled: v.boolean(),
    note: v.optional(v.string()),
    updatedAt: v.number()
  }).index('by_key', ['key']),

  // Cron heartbeat: one upserted row per scheduled job. Flat, effectively zero
  // storage, gives /api/health a live view of silent cron failures.
  cronHealth: defineTable({
    job: v.string(),
    ok: v.boolean(),
    note: v.optional(v.string()),
    lastRunAt: v.number()
  }).index('by_job', ['job']),

  // Ring-buffer error log (capped rows per source — see convex/errorLog.ts).
  // Never grows: new errors evict the oldest row for the same source.
  errorLog: defineTable({
    source: v.string(),
    message: v.string(),
    stack: v.optional(v.string()),
    meta: v.optional(v.any()),
    createdAt: v.number()
  })
    .index('by_source_time', ['source', 'createdAt'])
    .index('by_time', ['createdAt']),

  // Browser push subscriptions (one per user device, capped at 5 per user).
  pushSubscriptions: defineTable({
    userId: v.optional(v.string()),
    endpointHash: v.string(),
    endpoint: v.string(),
    keys: v.any(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_user_ep', ['userId', 'endpointHash'])
    .index('by_user', ['userId'])
    .index('by_updated', ['updatedAt']),

  // Single-use password-reset codes (hashed, 30-minute TTL, swept daily).
  emailTokens: defineTable({
    email: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
    createdAt: v.number()
  })
    .index('by_email', ['email'])
    .index('by_expiry', ['expiresAt'])
});
