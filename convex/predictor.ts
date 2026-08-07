// Public API + internal persistence for the AI Predictor.
// Public queries/mutations are read/write for the predictor UI. Internal
// mutations (marked `internal`) are called only by the SMOA orchestrator.

import { query, mutation, action, internalMutation, internalAction, internalQuery } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';

const sportId = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('rally'),
  v.literal('hockey'),
  v.literal('baseball')
);

const dayStatus = v.union(
  v.literal('pending'),
  v.literal('refreshing'),
  v.literal('ready'),
  v.literal('partial'),
  v.literal('stale'),
  v.literal('error')
);

const runStatus = v.union(
  v.literal('pending'),
  v.literal('running'),
  v.literal('complete'),
  v.literal('error')
);

// ── Public queries ────────────────────────────────────────────────────────────

export const getDay = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

export const listMatches = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('asc')
      .collect();
  }
});

// Range view for the AI Predictor date picker: every cached match for a sport
// whose cache day falls inside [fromDay, toDay]. Matches are stored under their
// dayKey (the day the agent ran for), NOT their kickoff startTime — a scraped or
// synthetic fixture's startTime can land on the next calendar day, so querying by
// startTime silently returned nothing. Day-key range matches listDaysInRange and
// the per-day grouping the homepage renders.
export const listMatchesInRange = query({
  args: { sportId, fromDay: v.string(), toDay: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).gte('dayKey', args.fromDay).lte('dayKey', args.toDay))
      .order('asc')
      .collect();
  }
});

// Day-cache status for every day in a window (inclusive dayKey bounds). Lets the
// homepage show which of the 1–7 days actually have cached data/verdicts.
export const listDaysInRange = query({
  args: { sportId, fromDay: v.string(), toDay: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).gte('dayKey', args.fromDay).lte('dayKey', args.toDay))
      .order('asc')
      .collect();
  }
});

export const getVerdict = query({
  args: { dayKey: v.string(), matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorVerdicts')
      .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', args.matchId))
      .first();
  }
});

export const getDailyPnlSummary = query({
  args: { dayKey: v.string(), filter: v.optional(v.union(v.literal('ALL'), v.literal('MONEYLINE'), v.literal('SPREAD'), v.literal('TOTAL'))) },
  handler: async (ctx, args) => {
    const filter = args.filter ?? 'ALL';
    return await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day_filter', (q) => q.eq('dayKey', args.dayKey).eq('filter', filter))
      .first();
  }
});

export const saveDailyPnlSummary = mutation({
  args: {
    dayKey: v.string(),
    filter: v.union(v.literal('ALL'), v.literal('MONEYLINE'), v.literal('SPREAD'), v.literal('TOTAL')),
    overallWinRatePct: v.number(),
    overallUnitsPnl: v.number(),
    overallRoiPct: v.number(),
    rows: v.any()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day_filter', (q) => q.eq('dayKey', args.dayKey).eq('filter', args.filter))
      .first();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        overallWinRatePct: args.overallWinRatePct,
        overallUnitsPnl: args.overallUnitsPnl,
        overallRoiPct: args.overallRoiPct,
        rows: args.rows,
        updatedAt: now
      });
      return existing._id;
    } else {
      return await ctx.db.insert('aiPredictorStats', {
        dayKey: args.dayKey,
        filter: args.filter,
        overallWinRatePct: args.overallWinRatePct,
        overallUnitsPnl: args.overallUnitsPnl,
        overallRoiPct: args.overallRoiPct,
        rows: args.rows,
        updatedAt: now
      });
    }
  }
});

export const getActiveRun = query({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorRuns')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

// ── Public mutation: user-triggered refresh ───────────────────────────────────

export const startRefresh = mutation({
  args: { sportId, dayKey: v.string(), incremental: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const incremental = args.incremental ?? false;
    const runId = `run_${incremental ? 'inc_' : ''}${args.sportId}_${args.dayKey}_${now}`;

    const existing = await ctx.db
      .query('predictorRuns')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();

    if (existing && existing.status === 'running') return { runId: existing.runId, alreadyRunning: true };

    await ctx.db.insert('predictorRuns', {
      runId,
      dayKey: args.dayKey,
      sportId: args.sportId,
      progress: 0,
      stage: 'Queued',
      status: 'running',
      startedAt: now,
      updatedAt: now
    });

    await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first()
      .then(async (day) => {
        if (day) {
          await ctx.db.patch(day._id, { status: 'refreshing', runId, updatedAt: now });
        } else {
          await ctx.db.insert('predictorDays', {
            dayKey: args.dayKey,
            sportId: args.sportId,
            status: 'refreshing',
            expiresAt: now + 24 * 60 * 60 * 1000,
            runId,
            cap: 250,
            sourcesUsed: [],
            createdAt: now,
            updatedAt: now
          });
        }
      });

    // Fire-and-forget: kick off the orchestrator without blocking the mutation.
    // If scheduling fails (e.g. the internal action is missing/not deployed),
    // degrade the run/day to 'error' gracefully instead of 500-ing the mutation.
    try {
      if (incremental) {
        ctx.scheduler.runAfter(0, internal.predictorOrchestrator.runIncrementalRefreshInternal, {
          sportId: args.sportId,
          dayKey: args.dayKey,
          runId
        });
      } else {
        ctx.scheduler.runAfter(0, internal.predictorOrchestrator.runRefreshInternal, {
          sportId: args.sportId,
          dayKey: args.dayKey,
          runId
        });
      }
    } catch (err: any) {
      console.error('[predictor] failed to schedule refresh:', err?.message || err);
      await ctx.db
        .query('predictorRuns')
        .withIndex('by_runId', (q) => q.eq('runId', runId))
        .first()
        .then(async (run) => {
          if (run) {
            await ctx.db.patch(run._id, {
              status: 'error',
              stage: 'Failed',
              message: String(err?.message || err).slice(0, 300),
              completedAt: Date.now(),
              updatedAt: Date.now()
            });
          }
        });
      await ctx.db
        .query('predictorDays')
        .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
        .order('desc')
        .first()
        .then(async (day) => {
          if (day) {
            await ctx.db.patch(day._id, { status: 'error', message: String(err?.message || err).slice(0, 300), updatedAt: Date.now() });
          }
        });
    }

    return { runId, alreadyRunning: false };
  }
});

// ── Internal mutations (orchestrator-only) ────────────────────────────────────

export const updateRun = internalMutation({
  args: {
    runId: v.string(),
    progress: v.number(),
    stage: v.string(),
    status: v.optional(runStatus),
    message: v.optional(v.string()),
    completedAt: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const run = await ctx.db
      .query('predictorRuns')
      .withIndex('by_runId', (q) => q.eq('runId', args.runId))
      .first();
    if (!run) return;
    await ctx.db.patch(run._id, {
      progress: Math.max(0, Math.min(100, Math.round(args.progress))),
      stage: args.stage,
      status: args.status ?? run.status,
      message: args.message ?? run.message,
      completedAt: args.completedAt ?? run.completedAt,
      updatedAt: Date.now()
    });
  }
});

export const upsertDay = internalMutation({
  args: {
    sportId,
    dayKey: v.string(),
    status: dayStatus,
    runId: v.optional(v.string()),
    cap: v.optional(v.number()),
    sourcesUsed: v.optional(v.array(v.string())),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        runId: args.runId ?? existing.runId,
        cap: args.cap ?? existing.cap,
        sourcesUsed: args.sourcesUsed ?? existing.sourcesUsed,
        message: args.message,
        lastRefreshAt: args.status === 'ready' || args.status === 'partial' ? now : existing.lastRefreshAt,
        updatedAt: now
      });
      return existing._id;
    }
    return await ctx.db.insert('predictorDays', {
      dayKey: args.dayKey,
      sportId: args.sportId,
      status: args.status,
      runId: args.runId,
      cap: args.cap ?? 250,
      sourcesUsed: args.sourcesUsed ?? [],
      message: args.message,
      expiresAt: now + 24 * 60 * 60 * 1000,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const replaceMatches = internalMutation({
  args: {
    sportId,
    dayKey: v.string(),
    matches: v.array(
      v.object({
        matchId: v.string(),
        league: v.string(),
        homeTeam: v.string(),
        awayTeam: v.string(),
        startTime: v.number(),
        source: v.string(),
        marketsAvailable: v.array(v.string()),
        scopes: v.any()
      })
    )
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .collect();
    for (const m of existing) await ctx.db.delete(m._id);

    const now = Date.now();
    for (const m of args.matches) {
      await ctx.db.insert('predictorMatches', {
        dayKey: args.dayKey,
        sportId: args.sportId,
        matchId: m.matchId,
        league: m.league,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        startTime: m.startTime,
        source: m.source,
        marketsAvailable: m.marketsAvailable,
        scopes: m.scopes,
        createdAt: now
      });
    }
    return args.matches.length;
  }
});

export const insertVerdicts = internalMutation({
  args: {
    dayKey: v.string(),
    sportId,
    verdicts: v.array(
      v.object({
        matchId: v.string(),
        agentsRun: v.array(v.string()),
        citations: v.array(v.string()),
        floor: v.number(),
        scopeSummary: v.string(),
        llmUsed: v.optional(v.boolean()),
        llmProvider: v.optional(v.string()),
        aiReport: v.optional(v.any())
      })
    )
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    for (const vv of args.verdicts) {
      const existing = await ctx.db
        .query('predictorVerdicts')
        .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', vv.matchId))
        .first();
      const aiReport =
        vv.aiReport && typeof vv.aiReport === 'object'
          ? vv.aiReport
          : {
              verdictSummary: vv.scopeSummary,
              valueAssessment: '',
              riskWarning: '',
              tacticalRecommendation: '',
              crossCheckAnalysis: '',
              crossCheckSteps: [],
              top3Selections: [],
              punterEdge: '',
              bookmakerBiasNote: '',
              stakeAdvice: ''
            };
      const patch = {
        aiReport,
        llmUsed: vv.llmUsed ?? (vv.aiReport ? true : false),
        llmProvider: vv.llmProvider ?? '',
        updatedAt: now
      };
      if (existing) {
        await ctx.db.patch(existing._id, { ...patch, agentsRun: vv.agentsRun, citations: vv.citations });
      } else {
        await ctx.db.insert('predictorVerdicts', {
          dayKey: args.dayKey,
          sportId: args.sportId,
          matchId: vv.matchId,
          ...patch,
          agentsRun: vv.agentsRun,
          citations: vv.citations
        });
      }
    }
    return args.verdicts.length;
  }
});

export const purgeOld = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const oldDays = await ctx.db
      .query('predictorDays')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoff))
      .collect();
    for (const d of oldDays) await ctx.db.delete(d._id);

    const oldMatches = await ctx.db
      .query('predictorMatches')
      .collect()
      .then((items) => items.filter((m) => m.dayKey < cutoff));
    for (const m of oldMatches) await ctx.db.delete(m._id);

    const oldVerdicts = await ctx.db
      .query('predictorVerdicts')
      .collect()
      .then((items) => items.filter((v) => v.dayKey < cutoff));
    for (const v of oldVerdicts) await ctx.db.delete(v._id);

    const oldStats = await ctx.db
      .query('aiPredictorStats')
      .withIndex('by_day', (q) => q.lt('dayKey', cutoff))
      .collect();
    for (const s of oldStats) await ctx.db.delete(s._id);

    const oldRuns = await ctx.db
      .query('predictorRuns')
      .collect()
      .then((items) => items.filter((r) => r.dayKey < cutoff));
    for (const r of oldRuns) await ctx.db.delete(r._id);

    return oldDays.length + oldMatches.length + oldVerdicts.length;
  }
});

// Internal entry used by the orchestrator's incremental refresh to rebuild
// verdicts from the ALREADY-CACHED matches+scopes (no new API or LLM spend).
export const getCachedMatches = internalQuery({
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorMatches')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('asc')
      .collect();
  }
});

// Internal action entry used by the midnight cron (Emeka Obi's cache cycle).
export const purgeAndMarkStale = internalAction({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const deleted = await ctx.runMutation(internal.predictor.purgeOld, {});
    return { deleted };
  }
});

// ── Bootstrap actions: seed today's cache for all sports when DB is empty ─────

const ALL_SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball'] as const;
type AnySSport = typeof ALL_SPORTS[number];

// Internal: seed a specific sport for today. Called by seedAllSports.
export const seedSportForToday = internalAction({
  args: { sportId: v.union(
    v.literal('football'), v.literal('basketball'), v.literal('tennis'),
    v.literal('rally'), v.literal('hockey'), v.literal('baseball')
  )},
  handler: async (ctx, args): Promise<{ ok: boolean; kept: number }> => {
    const dayKey = new Date().toISOString().slice(0, 10);
    // Check if already cached for today — skip if fresh (status ready/partial/refreshing).
    const existing = await ctx.runQuery(internal.predictor.getDayInternal, {
      sportId: args.sportId as AnySSport,
      dayKey
    });
    if (existing && (existing.status === 'ready' || existing.status === 'partial' || existing.status === 'refreshing')) {
      console.log(`[Bootstrap] ${args.sportId} already cached for ${dayKey} (${existing.status}), skipping.`);
      return { ok: true, kept: 0 };
    }
    // Kick the full pipeline via the orchestrator.
    const result: any = await ctx.runAction(internal.predictorOrchestrator.runRefreshInternal, {
      sportId: args.sportId as AnySSport,
      dayKey,
      floor: 52
    });
    return { ok: result?.ok ?? false, kept: result?.kept ?? 0 };
  }
});

// Internal query to check a predictor day without going through public API.
export const getDayInternal = internalQuery({
  args: { sportId: v.union(
    v.literal('football'), v.literal('basketball'), v.literal('tennis'),
    v.literal('rally'), v.literal('hockey'), v.literal('baseball')
  ), dayKey: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorDays')
      .withIndex('by_sport_day', (q) => q.eq('sportId', args.sportId).eq('dayKey', args.dayKey))
      .order('desc')
      .first();
  }
});

// Internal: stagger-seed all 6 sports for today with a 30-second gap between each.
export const seedAllSports = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seeded: number }> => {
    const dayKey = new Date().toISOString().slice(0, 10);
    console.log(`[Bootstrap] Seeding all sports for ${dayKey}…`);
    let seeded = 0;
    const sports: AnySSport[] = [...ALL_SPORTS];
    for (const sp of sports) {
      try {
        await ctx.runAction(internal.predictor.seedSportForToday, { sportId: sp });
        seeded++;
        // Stagger: wait 15 seconds between sports so the LLM/API providers
        // are not hammered simultaneously by 6 parallel pipeline runs.
        await new Promise((r) => setTimeout(r, 15_000));
      } catch (err: any) {
        console.error(`[Bootstrap] Failed to seed ${sp}:`, err?.message || err);
      }
    }
    return { seeded };
  }
});

// Public action: UI-callable — bootstraps today's data for all 6 sports.
// Safe to call multiple times; already-fresh days are skipped.
export const bootstrapToday = action({
  args: {},
  handler: async (ctx): Promise<{ seeded: number; message: string }> => {
    const result: any = await ctx.runAction(internal.predictor.seedAllSports, {});
    return {
      seeded: result?.seeded ?? 0,
      message: `Bootstrap started for ${result?.seeded ?? 0} sport(s). Data will populate over the next few minutes.`
    };
  }
});

