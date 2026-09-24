// Orchestrator action — the single entry point the SMOA pipeline (Eze Ugo) runs
// inside. Persists every progress tick, upserts the day cache, replaces stored
// matches and writes agent verdicts.

import { action, internalAction } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { runSmoaPipeline } from './agents/smoa';
import { amaraFilter, type NormalizeResult } from './agents/specialists';
import { dailyCap, watTodayKey } from './scrapers/sources';
import { FILTER_CONFIDENCE_FLOOR } from './scrapers/normalize';
import { generatePredictorVerdict, type VerdictOutcome } from './llm';
import { evaluateMatchWithJev } from './agents/jevEvaluator';
import { evaluateWithJev } from './jev';
import { isFootballMatch, matchBelongsToSport, validateFixture } from './predictor';
import { assessDataQuality, hasRealOdds } from './scrapers/dataQuality';
import { actionCacheKey } from './actionCache';
import { requireMasterPassInAction } from './access';

const sportId = v.union(
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

const refreshArgs = {
  sportId,
  dayKey: v.string(),
  runId: v.optional(v.string()),
  floor: v.optional(v.number()),
  cap: v.optional(v.number())
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
  args: { sportId: string; dayKey: string; runId?: string; floor?: number; cap?: number }
): Promise<{ ok: boolean; kept: number; runId: string; message: string }> {
  const dayKey = args.dayKey || watTodayKey();
  const runId = args.runId ?? `run_${args.sportId}_${dayKey}_${Date.now()}`;
  const floor = args.floor ?? FILTER_CONFIDENCE_FLOOR;
  const cap = args.cap ?? dailyCap();

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

    // Purge any misassigned/wrong sport matches stored under this sport tab
    try {
      await ctx.runMutation(internal.predictor.purgeWrongSportMatchesInternal, { sportId: args.sportId as any });
      await ctx.runMutation(internal.predictor.migrateNonFootballMatchesInternal, {});
    } catch (e) {
      console.warn('[predictorOrchestrator] cleanup warning:', e);
    }

    const result = await runSmoaPipeline(args.sportId, dayKey, report, floor, cap);

    // Apply strict positive sport identity + multi-point fixture validation AND
    // the data-quality showcase gate before storing matches. Teams are rewritten
    // to canonical names so "Man Utd" and "Manchester United" collapse to the
    // same stable matchId; TBD/promo rows (score < 10) are dropped; matches
    // without real odds (post research-fill) are blocked from showcase entirely.
    const qualityReport = (m: any) => assessDataQuality(m, args.sportId);
    // Observability: collect the top gate-rejection reasons so "All N rows
    // blocked" messages say WHY (league mismatch, no fingerprint, etc.).
    const blockedReasons = new Map<string, number>();
    const noteBlocked = (issues: string[]) => {
      for (const iss of issues.slice(0, 2)) {
        const key = iss.length > 60 ? iss.slice(0, 57) + '…' : iss;
        blockedReasons.set(key, (blockedReasons.get(key) ?? 0) + 1);
      }
    };
    const validated = result.matches
      .map((m) => {
        const v = validateFixture(m, args.sportId);
        if (!v.valid) {
          noteBlocked(v.issues);
          return null;
        }
        const q = qualityReport({ ...m, league: v.normalizedLeague || m.league });
        if (!q.eligible) {
          noteBlocked(q.issues);
          return null;
        }
        return {
          ...m,
          dataQuality: q.level,
          league: v.normalizedLeague || m.league,
          homeTeam: v.normalizedHome || m.homeTeam,
          awayTeam: v.normalizedAway || m.awayTeam
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
    const cleanMatches = validated.filter((m) => matchBelongsToSport(m, args.sportId));
    const validIds = new Set(cleanMatches.map((m) => m.matchId));

    // Only matches carrying real odds can produce qualifying picks (Amara's
    // gate enforces the same rule, but this keeps the day-status honest).
    const qualifyingSet = new Set(
      result.qualifyingIds.filter((id) =>
        cleanMatches.some((m) => m.matchId === id && hasRealOdds(m))
      )
    );
    const blockedCount = result.matches.length - cleanMatches.length;


    // Cache EVERY validated fixture so the schedule always populates.
    // PRESERVE GUARD: an empty cycle (sources returned nothing usable — e.g.
    // the morning's fixtures have kicked off and dropped off the listings)
    // must NEVER wipe a healthy existing cache. Keep the prior rows in place
    // (the 15-minute score sync keeps them fresh) and mark the day partial;
    // only replace when this cycle actually produced fixtures.
    let preserveCache = false;
    if (cleanMatches.length === 0) {
      const existingCache = await ctx.runQuery(internal.predictor.getCachedMatches, {
        sportId: args.sportId,
        dayKey
      });
      preserveCache = existingCache.length > 0;
    }

    if (!preserveCache) {
      await ctx.runMutation(internal.predictor.replaceMatches, {
        sportId: args.sportId,
        dayKey: dayKey,
        matches: cleanMatches.map((m) => ({
          matchId: m.matchId,
          league: m.league,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          startTime: m.startTime,
          source: m.source,
          marketsAvailable: m.markets,
          scopes: m.scope,
          dataQuality: m.dataQuality
        }))
      });
    }

    const verdicts = await mapLimit(cleanMatches, 4, async (m) => {
      // Generate a full LLM verdict only for matches that cleared the confidence
      // floor (Amara's gate). Everything else gets a deterministic engine-built
      // verdict so the schedule still populates with analysis without exhausting
      // LLM quota on low-signal fixtures.
      const qualifies = qualifyingSet.has(m.matchId);
      const fallbackSummary = qualifies
        ? `${m.homeTeam} vs ${m.awayTeam} (${m.league}) — confidence floor ${floor}%. Analysed by ${result.agentsRun.length} agents across ${result.sourcesUsed.length} sources.`
        : `${m.homeTeam} vs ${m.awayTeam} (${m.league}) — cached for review; no selection cleared the ${floor}% confidence floor.`;

      let llm: VerdictOutcome;
      let jev: Awaited<ReturnType<typeof evaluateMatchWithJev>> | null = null;
      if (qualifies) {
        // Jev structured evaluation FIRST: typed noul/choice/score decisions
        // over this fixture's de-vigged state. The LLM verdict is then drafted
        // FROM Jev's reads (lead-market routing, value check, risk level).
        jev = await evaluateMatchWithJev({
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          league: m.league,
          scopes: m.scope
        });
        // Enterprise: cache the LLM verdict per (day, match) for 15 minutes so
        // repeat refresh cycles serve the cached analysis instead of paying the
        // LLM again for identical inputs (native action-cache equivalent).
        const cacheKey = actionCacheKey('generatePredictorVerdict', {
          dayKey,
          matchId: m.matchId,
          sportId: m.sportId
        });
        const cached = await ctx.runQuery(internal.actionCache.getCachedActionValue, { cacheKey });
        if (cached) {
          llm = cached as VerdictOutcome;
        } else {
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
            {
              sportId: m.sportId,
              fallbackSummary,
              ...(jev.ok && jev.steering
                ? { jevSteering: jev.steering, jevPhrases: jev.phrases }
                : {})
            }
          );
          await ctx.runMutation(internal.actionCache.setCachedActionValue, {
            cacheKey,
            result: llm,
            ttlMs: 15 * 60_000
          });
        }
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
        aiReport: llm.verdict,
        ...(jev && jev.ok && jev.evaluation
          ? {
              jevEvaluation: {
                engine: jev.engine,
                model: jev.model,
                answers: jev.evaluation.answers,
                usage: jev.evaluation.usage,
                phrases: jev.phrases ?? []
              }
            }
          : {})
      };
    });

    await ctx.runMutation(internal.predictor.insertVerdicts, {
      dayKey: dayKey,
      sportId: args.sportId,
      verdicts
    });

    // Cycle-level Jev evaluation: the structured model audits the WHOLE cycle
    // (web search → scraping → fetch → quality gate → verdicts) and its typed
    // read of the pipeline's bottleneck lands in the day message.
    let jevCycleNote = '';
    try {
      const cycle = await evaluateWithJev(
        `Pipeline cycle for sport "${args.sportId}" on day ${dayKey}: sources consulted ${result.sourcesUsed.length} (${result.sourcesUsed.slice(0, 5).join(', ')}); parsed rows ${result.matches.length}; fixtures passing quality gate ${cleanMatches.length}; rows blocked ${blockedCount}; fixtures with real odds ${qualifyingSet.size}; confidence floor ${floor}%; agents run ${result.agentsRun.length}.`,
        {
          cache_healthy: {
            type: 'noul',
            instructions: 'Is this cycle healthy — did it produce usable cached fixtures for the schedule?',
            criteria: { true: 'At least one fixture passed the quality gate', false: 'Nothing usable was cached this cycle' }
          },
          bottleneck: {
            type: 'choice',
            instructions: 'Which stage most limited this cycle?',
            criteria: {
              sources: 'Source pages failed or returned nothing parseable',
              quality_gate: 'Rows were parsed but blocked by fixture validation / quality rules',
              confidence_floor: 'Fixtures cached but none cleared the confidence floor',
              odds_availability: 'Fixtures cached but real odds were missing',
              none: 'No bottleneck — cycle ran cleanly'
            }
          }
        }
      );
      if (cycle.ok && cycle.evaluation) {
        const a = cycle.evaluation.answers ?? {};
        const healthy = a.cache_healthy && a.cache_healthy.type === 'noul' ? a.cache_healthy.noul >= 0.5 : null;
        const bottleneck = a.bottleneck && a.bottleneck.type === 'choice' ? a.bottleneck.choice : 'unknown';
        jevCycleNote = ` Jev cycle audit: ${healthy === null ? 'cache ?' : healthy ? 'cache healthy' : 'cache unhealthy'}, bottleneck=${bottleneck} (engine ${cycle.evaluation.engine}).`;
      }
    } catch {}

    await ctx.runMutation(internal.predictor.upsertDay, {
      sportId: args.sportId,
      dayKey: dayKey,
      status: qualifyingSet.size > 0 ? 'ready' : 'partial',
      runId,
      cap,
      sourcesUsed: result.sourcesUsed,
      message: (cleanMatches.length > 0
        ? qualifyingSet.size > 0
          ? `${cleanMatches.length} verified matches cached, ${qualifyingSet.size} qualifying${blockedCount ? ` (${blockedCount} blocked by quality gate)` : ''}`
          : `${cleanMatches.length} matches cached (none cleared the ${floor}% floor)`
        : preserveCache
          ? `Sources returned 0 usable fixtures this cycle — existing cache preserved (${(await ctx.runQuery(internal.predictor.getCachedMatches, { sportId: args.sportId, dayKey })).length} matches).${blockedReasons.size ? ` Top reasons: ${Array.from(blockedReasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r, n]) => `${r} ×${n}`).join('; ')}` : ''}`
          : `All ${result.matches.length} parsed rows blocked by the quality gate — no verified fixtures this cycle.${blockedReasons.size ? ` Top reasons: ${Array.from(blockedReasons.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([r, n]) => `${r} ×${n}`).join('; ')}` : ''}`) + jevCycleNote
    });

    await ctx.runMutation(internal.predictor.updateRun, {
      runId,
      progress: 100,
      stage: 'Complete',
      status: 'complete',
      message: `${result.matches.length} matches cached`,
      completedAt: Date.now()
    });

    try {
      await ctx.scheduler.runAfter(0, internal.scores.syncScoresAction, { dayKey });
    } catch {}

    await ctx.scheduler
      .runAfter(0, internal.cronHealth.stampCron, { job: 'orchestrator', ok: true, note: `${args.sportId}/${dayKey} kept:${result.matches.length}` })
      .catch(() => {});
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
    await ctx.scheduler
      .runAfter(0, internal.cronHealth.stampCron, { job: 'orchestrator', ok: false, note: String(err?.message || err).slice(0, 120) })
      .catch(() => {});
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
  handler: async (ctx, args) => {
    // P0 SECURITY: this public action spins up the full scraping + LLM pipeline
    // (real money in API spend). Master Pass + predictor flag enforced here.
    await requireMasterPassInAction(ctx);
    return executeRefresh(ctx, args);
  }
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
  const day = args.dayKey || watTodayKey();
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
