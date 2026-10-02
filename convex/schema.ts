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
  v.literal('rugby'),
  v.literal('cricket'),
  v.literal('mma'),
  v.literal('volleyball')
);

export const PREDICTOR_SPORT_IDS = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('hockey'),
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
    }).index('by_email', ['email']).index('by_subscription_expiry', ['isSubscribed', 'subscriptionExpiresAt']),

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

  // ── Tester access codes (single shared tester login, one code per user) ─────
  // The tester EMAIL/PASSWORD is shared and provisioned server-side; a code is
  // what identifies an individual tester. A code is issued by the super admin,
  // claimed when the tester registers their details, then BOUND TO ONE DEVICE on
  // first login (which is also when the trial clock starts).
  testerCodes: defineTable({
    code: v.string(),
      authUserId: v.optional(v.string()),
    // issued   · code handed out, not yet registered
    // claimed  · tester registered their details (may still be awaiting a first login)
    // suspended· temporarily blocked by the admin (keeps the registration + trial clock)
    // revoked  · permanently killed by the admin
    status: v.union(
      v.literal('issued'),
      v.literal('claimed'),
      v.literal('suspended'),
      v.literal('revoked')
    ),
    label: v.optional(v.string()),
    batch: v.optional(v.string()),
    createdBy: v.string(),
    createdAt: v.number(),
    // Registration (collected BEFORE the code can be used to log in).
    fullName: v.optional(v.string()),
    nin: v.optional(v.string()),
    testerEmail: v.optional(v.string()),
    actualEmail: v.optional(v.string()),
    /** One-way fingerprint of the tester's chosen password — never the password. */
    preferredPasswordHash: v.optional(v.string()),
    hasPreferredPassword: v.optional(v.boolean()),
    mobile: v.optional(v.string()),
    stateOfResidence: v.optional(v.string()),
    consentAccepted: v.optional(v.boolean()),
    registeredAt: v.optional(v.number()),
    // Device binding + trial window.
    deviceId: v.optional(v.string()),
    deviceLabel: v.optional(v.string()),
    trialStartsAt: v.optional(v.number()),
    trialExpiresAt: v.optional(v.number()),
    lastLoginAt: v.optional(v.number()),
    loginCount: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
    revokedBy: v.optional(v.string()),
    notes: v.optional(v.string()),
    // ── Admin lifecycle (suspend / re-open a failed claim / approve) ──────────
    /** Set when the code is suspended; the trial clock is untouched. */
    suspendedAt: v.optional(v.number()),
    suspendedBy: v.optional(v.string()),
    suspendReason: v.optional(v.string()),
    /** Last time the admin released a claim so the SAME person could re-register. */
    reactivatedAt: v.optional(v.number()),
    reactivatedBy: v.optional(v.string()),
    /** How many times this code has been re-opened after a failed claim. */
    reopenCount: v.optional(v.number()),
    /**
     * True on a re-opened code once the tester re-submits their details: the
     * admin console flags it for a final approve/reject review. Never blocks
     * login — a re-opened code works the moment it is re-registered.
     */
    needsReview: v.optional(v.boolean()),
    /** Set when the admin confirms the (re-)registration. */
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.string()),
    /** Snapshot of the claim that was released, kept for the admin's reference. */
    previousRegistration: v.optional(
      v.object({
        fullName: v.optional(v.string()),
        actualEmail: v.optional(v.string()),
        mobile: v.optional(v.string()),
        stateOfResidence: v.optional(v.string()),
        registeredAt: v.optional(v.number())
      })
    ),
    /** Accumulated in-app time (ms) across every heartbeat of this code. */
    usageMs: v.optional(v.number())
  })
    .index('by_code', ['code'])
    .index('by_status', ['status'])
    .index('by_device', ['deviceId'])
    .index('by_actualEmail', ['actualEmail'])
    .index('by_status_createdAt', ['status', 'createdAt']),

  // Binds one Convex auth SESSION (the `sub` claim: userId|sessionId) to the
  // tester code + device that opened it, so server-side gates can tell WHICH
  // tester is behind the shared tester login.
  testerSessions: defineTable({
    subject: v.string(),
    userId: v.optional(v.string()),
    code: v.string(),
    deviceId: v.string(),
    deviceLabel: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number(),
    revoked: v.optional(v.boolean()),
    /** Accumulated foreground time (ms) for this session's heartbeats. */
    sessionMs: v.optional(v.number()),
    /** Previous heartbeat timestamp — used to measure the delta. */
    lastBeatAt: v.optional(v.number())
  })
    .index('by_subject', ['subject'])
    .index('by_code', ['code']),

  // Per-identity usage heartbeat: how long each tester / subscriber / anonymous
  // visitor has actually had the app open. One row per owner (JWT subject, or
  // the anonymous session id) — flat and swept by the retention cron.
  usage: defineTable({
    owner: v.string(),
    /** Resolved account email, when the caller is authenticated. */
    email: v.optional(v.string()),
    /** Tester access code, when this identity is behind a tester session. */
    code: v.optional(v.string()),
    role: v.optional(v.union(v.literal('admin'), v.literal('tester'), v.literal('user'), v.literal('anon'))),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    /** Accumulated foreground time in ms (idle gaps are not counted). */
    usageMs: v.number(),
    /** How many sessions/heartbeat runs this owner has opened. */
    sessions: v.number()
  })
    .index('by_owner', ['owner'])
    .index('by_code', ['code'])
    .index('by_email', ['email'])
    .index('by_lastSeen', ['lastSeenAt']),

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
    // Source provenance: the exact page/endpoint the fixture came from. Every
    // ingest path stamps it; the purge sweep treats a stored row without one
    // (AND without odds) as pre-gate legacy data.
    sourceUrl: v.optional(v.string()),
    marketsAvailable: v.array(v.string()),
    scopes: v.any(),
    dataQuality: v.optional(v.string()),
    // Sport identity was proven by the source itself (the sport's own scoped
    // page + a real "Country: League" header). Persisted so the READ path can
    // honour it too — otherwise listMatches re-applied the famous-name
    // fingerprint and hid the minor-league majority of the slate.
    sportPinned: v.optional(v.boolean()),
    oddsSnapshot: v.optional(v.any()),
    finalScore: v.optional(v.string()),
    periodScores:v.optional(v.record(v.string(),v.object({home:v.number(),away:v.number()}))),
    status: v.optional(
      v.union(v.literal('upcoming'), v.literal('inplay'), v.literal('finished'))
    ),
    createdAt: v.number()
  })
    .index('by_sport_day', ['sportId', 'dayKey', 'startTime'])
    .index('by_sport_startTime', ['sportId', 'startTime'])
    .index('by_day_match', ['dayKey', 'matchId'])
    .index('by_sport_day_team', ['sportId', 'dayKey', 'homeTeam', 'awayTeam']),

    predictionEvidence: defineTable({
      dayKey: v.string(), sportId: PREDICTOR_SPORT_IDS, matchId: v.string(),
      capturedAt: v.number(), startTime: v.number(), modelVersion: v.string(),
      source: v.string(), dataQuality: v.optional(v.string()), odds: v.any(), report: v.any(),
      publishedPicks: v.optional(v.array(v.object({marketId:v.string(),marketTitle:v.string(),label:v.string(),probability:v.number(),odds:v.number(),priceVerified:v.optional(v.boolean()),margin:v.optional(v.number()),ev:v.optional(v.number()),confluenceTier:v.optional(v.string())}))),
      decisions: v.optional(v.any()), rulesVersion: v.optional(v.string()),
      periodScores: v.optional(v.record(v.string(),v.object({home:v.number(),away:v.number()}))),
      homeTeam: v.optional(v.string()), awayTeam: v.optional(v.string()), finalScore: v.optional(v.string()), settledAt: v.optional(v.number())
    }).index('by_match', ['sportId', 'dayKey', 'matchId']).index('by_captured', ['capturedAt']).index('by_sport_day', ['sportId','dayKey']),

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

  // The AI-performance DATA BANK (predictorStats.ts). One row per (scope,
  // dayKey): scope 'day' holds that day's accuracy / calibration / Great-Minds /
  // verdict-ranking snapshot over FINISHED matches; scope 'lifetime' (dayKey '')
  // holds the rolling aggregate re-derived from the stored day rows. Every
  // score-sync cycle upserts the day row and rewrites the lifetime row, so the
  // measured record of how the AI's predictions actually performed keeps growing
  // instead of living only in the browser.
  predictorStatsSnapshots: defineTable({
    scope: v.union(v.literal('day'), v.literal('lifetime')),
    dayKey: v.string(),
    settledMatches: v.number(),
    gradedPicks: v.number(),
    data: v.any(),
    updatedAt: v.number()
  })
    .index('by_scope_day', ['scope', 'dayKey'])
    .index('by_day', ['dayKey', 'updatedAt']),

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
    .index('by_expiry', ['expiresAt']),

  betSlips: defineTable({
    owner: v.string(), // userId or sessionId
    sessionId: v.string(),
    userId: v.optional(v.string()),
    /** Account email of the owner — lets the admin console attribute a slip's
     *  graded record (and therefore a strike rate) to a named user. */
    email: v.optional(v.string()),
    userName: v.optional(v.string()), // registered full name for the slip header
    title: v.optional(v.string()), // unique per slip
    stake: v.optional(v.number()), // stake amount
    // Legacy fields from the single-slip model — kept optional so old rows
    // pass schema validation. New slips never write these.
    status: v.optional(v.string()),
    label: v.optional(v.string()),
    sealedAt: v.optional(v.number()),
    items: v.array(v.object({
      sportId: v.string(),
      dayKey: v.string(),
      matchId: v.string(),
      homeTeam: v.string(),
      awayTeam: v.string(),
      league: v.string(),
      marketTitle: v.string(),
      selection: v.string(),
      odds: v.number(),
      publishedPct: v.number(),
      kickoff: v.number(),
      finalScore: v.optional(v.string()),
      grade: v.optional(v.union(v.literal('win'), v.literal('loss'), v.literal('push'), v.literal('void')))
    })),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('by_owner', ['owner'])
    .index('by_email', ['email'])
    .index('by_owner_updated', ['owner', 'updatedAt'])
});
