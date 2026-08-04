// Public API + internal persistence for the AI Predictor.
// Public queries/mutations are read/write for the predictor UI. Internal
// mutations (marked `internal`) are called only by the SMOA orchestrator.

import { query, mutation, internalMutation, internalAction } from './_generated/server';
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

export const getVerdict = query({
  args: { dayKey: v.string(), matchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('predictorVerdicts')
      .withIndex('by_day_match', (q) => q.eq('dayKey', args.dayKey).eq('matchId', args.matchId))
      .first();
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
  args: { sportId, dayKey: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const runId = `run_${args.sportId}_${args.dayKey}_${now}`;

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
      ctx.scheduler.runAfter(0, internal.predictorOrchestrator.runRefreshInternal, {
        sportId: args.sportId,
        dayKey: args.dayKey,
        runId
      });
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
        scopeSummary: v.string()
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
      const aiReport = {
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
      if (existing) {
        await ctx.db.patch(existing._id, {
          agentsRun: vv.agentsRun,
          citations: vv.citations,
          aiReport,
          updatedAt: now
        });
      } else {
        await ctx.db.insert('predictorVerdicts', {
          dayKey: args.dayKey,
          sportId: args.sportId,
          matchId: vv.matchId,
          aiReport,
          agentsRun: vv.agentsRun,
          citations: vv.citations,
          updatedAt: now
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
    return oldDays.length;
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
