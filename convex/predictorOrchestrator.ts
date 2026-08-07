// Orchestrator action — the single entry point the SMOA pipeline (Eze Ugo) runs
// inside. Persists every progress tick, upserts the day cache, replaces stored
// matches and writes agent verdicts.

import { action, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { runSmoaPipeline } from './agents/smoa';
import { amaraFilter, type NormalizeResult } from './agents/specialists';
import { dailyCap } from './scrapers/sources';
import { FILTER_CONFIDENCE_FLOOR } from './scrapers/normalize';
import { generatePredictorVerdict, type VerdictOutcome } from './llm';

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

// Runs `fn` over `arr` with at most `limit` promises in flight. Kept matches
// can be numerous, so we bound parallel LLM calls to stay under the timeout.
async function mapLimit<T, R>(arr: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(arr.length);
  let idx = 0;
  const workers = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (idx < arr.length) {
      const i = idx++;
      results[i] = await fn(arr[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function executeRefresh(
  ctx: any,
  args: { sportId: string; dayKey: string; runId?: string; floor?: number }
): Promise<{ ok: boolean; kept: number; runId: string; message: string }> {
  const dayKey = args.dayKey || new Date().toISOString().slice(0, 10);
  const runId = args.runId ?? `run_${args.sportId}_${dayKey}_${Date.now()}`;
  const floor = args.floor ?? FILTER_CONFIDENCE_FLOOR;
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

    // Cache EVERY parsed fixture (see smoa.ts) so the schedule always populates.
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

    const verdicts = await mapLimit(result.matches, 4, async (m) => {
      // Generate a full LLM verdict only for matches that cleared the confidence
      // floor (Amara's gate). Everything else gets a deterministic engine-built
      // verdict so the schedule still populates with analysis without exhausting
      // LLM quota on low-signal fixtures.
      const qualifies = result.qualifyingIds.includes(m.matchId);
      const fallbackSummary = qualifies
        ? `${m.homeTeam} vs ${m.awayTeam} (${m.league}) — confidence floor ${floor}%. Analysed by ${result.agentsRun.length} agents across ${result.sourcesUsed.length} sources.`
        : `${m.homeTeam} vs ${m.awayTeam} (${m.league}) — cached for review; no selection cleared the ${floor}% confidence floor.`;

      let llm: VerdictOutcome;
      if (qualifies) {
        llm = await generatePredictorVerdict(
          {
            matchId: m.matchId,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            league: m.league,
            scopes: m.scope,
            sourceUrl: m.sourceUrl,
            citations: result.citations
          },
          { sportId: m.sportId, fallbackSummary }
        );
      } else {
        llm = {
          usedLlm: false,
          provider: 'none',
          model: 'deterministic',
          verdict: {
            verdictSummary: fallbackSummary,
            valueAssessment: 'Below the confidence floor this cycle — treat as reference data, not a recommendation.',
            riskWarning: 'No qualifying selection. Re-verify live odds before considering any bet.',
            tacticalRecommendation: 'Skip or wait for stronger signals from the next refresh cycle.',
            crossCheckAnalysis: 'Match cached from the agent screen but did not clear the probability floor.',
            crossCheckSteps: ['Step 1: Markets scanned across the odds registries.', 'Step 2: De-vigged probabilities computed.', 'Step 3: Confidence floor applied.', 'Step 4: Below floor this cycle.'],
            top3Selections: [],
            punterEdge: 'No edge surfaced above the floor.',
            bookmakerBiasNote: 'Reference data only.',
            stakeAdvice: 'No bet recommended below the confidence floor.'
          },
          summary: fallbackSummary
        };
      }
      return {
        matchId: m.matchId,
        agentsRun: result.agentsRun,
        citations: result.citations,
        floor,
        scopeSummary: llm.summary,
        llmUsed: llm.usedLlm,
        llmProvider: llm.provider,
        aiReport: llm.verdict
      };
    });

    await ctx.runMutation(internal.predictor.insertVerdicts, {
      dayKey: dayKey,
      sportId: args.sportId,
      verdicts
    });

    await ctx.runMutation(internal.predictor.upsertDay, {
      sportId: args.sportId,
      dayKey: dayKey,
      status: result.qualifyingIds.length > 0 ? 'ready' : 'partial',
      runId,
      cap,
      sourcesUsed: result.sourcesUsed,
      message: result.matches.length > 0
        ? result.qualifyingIds.length > 0
          ? `${result.matches.length} matches cached, ${result.qualifyingIds.length} qualifying`
          : `${result.matches.length} matches cached (none cleared the ${floor}% floor)`
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

const incrementalArgs = {
  sportId,
  dayKey: v.string(),
  runId: v.optional(v.string()),
  floor: v.optional(v.number())
};

// Incremental refresh — the Refresh button's path. Rebuilds verdicts and the day
// status ENTIRELY from the ALREADY-CACHED matches + scopes (no live API fetch,
// no provider rotation, no LLM spend). Amara's filter is re-run deterministically
// over the stored scope so the "qualifying" set always reflects current floor
// rules while non-qualifying matches keep their reference verdict. This keeps a
// user tap cheap and instant; the 12-hourly cron remains the only full re-cache.
async function executeIncrementalRefresh(
  ctx: any,
  args: { sportId: string; dayKey: string; runId?: string; floor?: number }
): Promise<{ ok: boolean; kept: number; qualifying: number; runId: string; message: string }> {
  const day = args.dayKey || new Date().toISOString().slice(0, 10);
  const runId = args.runId ?? `run_inc_${args.sportId}_${day}_${Date.now()}`;
  const floor = args.floor ?? FILTER_CONFIDENCE_FLOOR;

  const report = async (progress: number, stage: string, message?: string) => {
    await ctx.runMutation(internal.predictor.updateRun, { runId, progress, stage, message: message ?? '' });
  };

  try {
    await report(10, 'Reading cached scopes');
    const rows = await ctx.runQuery(internal.predictor.getCachedMatches, { sportId: args.sportId, dayKey: day });
    if (!rows || rows.length === 0) {
      throw new Error('No cached matches for this day — run a full refresh first.');
    }
    // Reconstruct Amara-shaped inputs from the cached scopes (markets only) so
    // the gate re-evaluates today's floor with NO provider call.
    const matches = rows.map((m: any) => ({
      matchId: m.matchId,
      scope: { markets: m?.scopes && typeof m.scopes === 'object' ? (m.scopes as any).markets ?? {} : {} }
    }));
    const filter = amaraFilter(matches as any, floor);
    const qualifying = filter.matchIds.length;
    const kept = rows.length;
    await report(40, 'Re-running confidence floor');

    for (const qid of filter.matchIds) {
      const m: any = rows.find((rr: any) => rr.matchId === qid);
      await ctx.runMutation(internal.predictor.insertVerdicts, {
        sportId: args.sportId,
        dayKey: day,
        verdicts: [
          {
            matchId: qid,
            agentsRun: ['Amara Obi (incremental)'],
            citations: [],
            floor,
            scopeSummary: `${m?.homeTeam ?? ''} vs ${m?.awayTeam ?? ''} (${m?.league ?? ''}) — refreshed from cache.`,
            llmUsed: false,
            llmProvider: 'deterministic',
            aiReport: {
              verdictSummary: `${m?.homeTeam ?? ''} vs ${m?.awayTeam ?? ''} — incremental refresh, no live odds refetch.`,
              valueAssessment: 'Rebuilt from cached scopes only.',
              riskWarning: 'live odds before any real stake.',
              tacticalRecommendation: 'await next scheduled full refresh for fresher prices.',
              crossCheckSteps: ['Step 1: Loaded cached scopes.', 'Step 2: Re-ran the de-vig floor.', 'Step 3: Kept qualifying picks.'],
              top3Selections: [],
              punterEdge: 'Unchanged from cache.',
              frenzyBiasNote: 'None recomputed this cycle.',
              stakeAdvice: 'No new stake guidance on an incremental pass.'
            }
          }
        ]
      });
    }

    await ctx.runMutation(internal.predictor.upsertDay, {
      sportId: args.sportId,
      dayKey: day,
      status: qualifying > 0 ? 'ready' : 'partial',
      runId,
      cap: dailyCap(),
      sourcesUsed: ['cache'],
      message: `${kept} matches re-scored from cache (${qualifying} qualifying)`
    });
    await ctx.runMutation(internal.predictor.updateRun, {
      runId,
      progress: 100,
      stage: 'Complete',
      status: 'complete',
      message: `${kept} matches re-scored from cache`,
      completedAt: Date.now()
    });
    return { ok: true, kept, qualifying, runId, message: 'Incremental refresh complete' };
  } catch (err: any) {
    console.error('[Predictor Incremental]', err?.message || err);
    await ctx.runMutation(internal.predictor.updateRun, {
      runId, progress: 100, stage: 'Failed', status: 'error',
      message: String(err?.message || err).slice(0, 300), completedAt: Date.now()
    });
    return { ok: false, kept: 0, qualifying: 0, runId, message: String(err?.message || err).slice(0, 300) };
  }
}

export const runIncrementalRefreshInternal = internalAction({
  args: incrementalArgs,
  handler: async (ctx, args) => executeIncrementalRefresh(ctx, args)
});
