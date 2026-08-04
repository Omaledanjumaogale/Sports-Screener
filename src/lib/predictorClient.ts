// Client-side bridge for the AI Predictor. Wraps the Convex predictor API and
// reuses the existing `analyzeScope` engine + `filterHighConfidence` to compute
// live probabilities from the cached scopes (no engine duplication).

import { api, queryConvex, callConvex } from './convexClient';
import { analyzeScope, filterHighConfidence, type Analysis, type ScopeState, type SportId } from './engine';
import { DEFAULT_CONFIDENCE_FLOOR, type PredictorDay, type PredictorMatch, type PredictorRun, type PredictorSportId } from './predictorTypes';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function predictorSportToSportId(sportId: PredictorSportId): SportId {
  return sportId as SportId;
}

export async function fetchPredictorDay(sportId: PredictorSportId, dayKey: string): Promise<PredictorDay | null> {
  return queryConvex<PredictorDay | null>(api.predictor.getDay, { sportId, dayKey });
}

export async function fetchPredictorMatches(sportId: PredictorSportId, dayKey: string): Promise<PredictorMatch[]> {
  return queryConvex<PredictorMatch[]>(api.predictor.listMatches, { sportId, dayKey });
}

export async function fetchActiveRun(sportId: PredictorSportId, dayKey: string): Promise<PredictorRun | null> {
  return queryConvex<PredictorRun | null>(api.predictor.getActiveRun, { sportId, dayKey });
}

export async function startPredictorRefresh(sportId: PredictorSportId, dayKey: string): Promise<{ runId: string; alreadyRunning: boolean }> {
  return callConvex<{ runId: string; alreadyRunning: boolean }>(api.predictor.startRefresh, { sportId, dayKey });
}

// Run the existing deterministic engine over a cached scope and keep only
// selections that clear the confidence floor (Amara Obi's filter).
export function analyzeCachedMatch(match: PredictorMatch, floor = DEFAULT_CONFIDENCE_FLOOR): {
  analysis: Analysis;
  qualifying: ReturnType<typeof filterHighConfidence>;
} {
  const scope = (match.scopes ?? {}) as ScopeState;
  const analysis = analyzeScope(predictorSportToSportId(match.sportId), scope);
  const qualifying = filterHighConfidence(analysis, floor);
  return { analysis, qualifying };
}
