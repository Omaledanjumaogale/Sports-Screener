// Orchestrator action — the single entry point the SMOA pipeline (Eze Ugo) runs
// inside. Persists every progress tick, upserts the day cache, replaces stored
// matches and writes agent verdicts.

import { action, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { runSmoaPipeline } from './agents/smoa';
import { dailyCap } from './scrapers/sources';

const sportId = v.union(
  v.literal('football'),
  v.literal('basketball'),
  v.literal('tennis'),
  v.literal('rally'),
  v.literal('hockey'),
  v.literal('baseball')
);

const refreshArgs = {
  sportId,
  dayKey: v.string(),
  runId: v.optional(v.string()),
  floor: v.optional(v.number())
};

async function executeRefresh(
  ctx: any,
  args: { sportId: string; dayKey: string; runId?: string; floor?: number }
): Promise<{ ok: boolean; kept: number; runId: string; message: string }> {
  const dayKey = args.dayKey || new Date().toISOString().slice(0, 10);
  const runId = args.runId ?? `run_${args.sportId}_${dayKey}_${Date.now()}`;
  const floor = args.floor ?? 60;
  const cap = dailyCap();

  const report = async (progress: number, stage: string, message?: string) => {
    await ctx.runMutation(internal.predictor.updateRun, {
      runId,
      progress,
      stage,
      message: message ?? ''
    });
  };

  try {
    await ctx.runMutation(internal.predictor.upsertDay, {
      sportId: args.sportId,
      dayKey: dayKey,
      status: 'refreshing',
      runId,
      cap
    });

    const result = await runSmoaPipeline(args.sportId, dayKey, report, floor);

    await ctx.runMutation(internal.predictor.replaceMatches, {
      sportId: args.sportId,
      dayKey: dayKey,
      matches: result.matches.map((m) => ({
        matchId: m.matchId,
        league: m.league,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        startTime: m.startTime,
        source: m.source,
        marketsAvailable: m.markets,
        scopes: m.scope
      }))
    });

    await ctx.runMutation(internal.predictor.insertVerdicts, {
      dayKey: dayKey,
      sportId: args.sportId,
      verdicts: result.matches.map((m) => ({
        matchId: m.matchId,
        agentsRun: result.agentsRun,
        citations: result.citations,
        floor,
        scopeSummary: `${m.homeTeam} vs ${m.awayTeam} (${m.league}) — confidence floor ${floor}%. Analysed by ${result.agentsRun.length} agents across ${result.sourcesUsed.length} sources.`
      }))
    });

    await ctx.runMutation(internal.predictor.upsertDay, {
      sportId: args.sportId,
      dayKey: dayKey,
      status: result.matches.length > 0 ? 'ready' : 'partial',
      runId,
      cap,
      sourcesUsed: result.sourcesUsed,
      message: result.matches.length > 0
        ? `${result.matches.length} matches ready`
        : 'No matches cleared the confidence floor this cycle.'
    });

    await ctx.runMutation(internal.predictor.updateRun, {
      runId,
      progress: 100,
      stage: 'Complete',
      status: 'complete',
      message: `${result.matches.length} matches cached`,
      completedAt: Date.now()
    });

    return { ok: true, kept: result.matches.length, runId, message: 'Refresh complete' };
  } catch (err: any) {
    console.error('[Predictor Orchestrator]', err?.message || err);
    await ctx.runMutation(internal.predictor.updateRun, {
      runId,
      progress: 100,
      stage: 'Failed',
      status: 'error',
      message: String(err?.message || err).slice(0, 300),
      completedAt: Date.now()
    });
    await ctx.runMutation(internal.predictor.upsertDay, {
      sportId: args.sportId,
      dayKey: dayKey,
      status: 'error',
      runId,
      message: String(err?.message || err).slice(0, 300)
    });
    return { ok: false, kept: 0, runId, message: String(err?.message || err).slice(0, 300) };
  }
}

export const runRefresh = action({
  args: refreshArgs,
  handler: async (ctx, args) => executeRefresh(ctx, args)
});

// Internal variant for the cron — avoids exposing an unauthenticated public
// action that starts heavy work.
export const runRefreshInternal = internalAction({
  args: refreshArgs,
  handler: async (ctx, args) => executeRefresh(ctx, args)
});
