// Client-side bridge for the AI Predictor. Wraps the Convex predictor API and
// reuses the existing `analyzeScope` engine + `filterHighConfidence` to compute
// live probabilities from the cached scopes (no engine duplication).

import { api, queryConvex, callConvex } from './convexClient';
import { analyzeScope, filterHighConfidence, type Analysis, type ScopeState, type SportId } from './engine';
import { DEFAULT_CONFIDENCE_FLOOR, type PredictorDay, type PredictorMatch, type PredictorRun, type PredictorSportId } from './predictorTypes';

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dayKeyFor(offsetDays: number, base?: Date): string {
  const d = base ? new Date(base) : new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function dayKeyToLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// Start/end of a UTC dayKey in epoch ms.
export function dayBounds(key: string): { from: number; to: number } {
  const [y, m, d] = key.split('-').map(Number);
  const from = Date.UTC(y || 0, (m || 1) - 1, d || 1);
  return { from, to: from + 24 * 60 * 60 * 1000 - 1 };
}

export function predictorSportToSportId(sportId: PredictorSportId): SportId {
  return sportId as SportId;
}

export async function fetchPredictorMatchesInRange(
  sportId: PredictorSportId,
  from: number,
  to: number
): Promise<PredictorMatch[]> {
  return queryConvex<PredictorMatch[]>(api.predictor.listMatchesInRange, { sportId, from, to });
}

export async function fetchPredictorDaysInRange(
  sportId: PredictorSportId,
  fromDay: string,
  toDay: string
): Promise<PredictorDay[]> {
  return queryConvex<PredictorDay[]>(api.predictor.listDaysInRange, { sportId, fromDay, toDay });
}

export async function fetchPredictorDay(sportId: PredictorSportId, dayKey: string): Promise<PredictorDay | null> {
  return queryConvex<PredictorDay | null>(api.predictor.getDay, { sportId, dayKey });
}

export async function fetchPredictorMatches(sportId: PredictorSportId, dayKey: string): Promise<PredictorMatch[]> {
  return queryConvex<PredictorMatch[]>(api.predictor.listMatches, { sportId, dayKey });
}

export async function fetchPredictorVerdict(dayKey: string, matchId: string): Promise<{
  aiReport?: any;
  greatMindsDebate?: any;
  dailyPnlSummary?: any;
  llmUsed?: boolean;
  llmProvider?: string;
} | null> {
  return queryConvex(api.predictor.getVerdict, { dayKey, matchId });
}

export async function fetchDailyPnlSummary(dayKey: string, filter: 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL' = 'ALL') {
  return queryConvex(api.predictor.getDailyPnlSummary, { dayKey, filter });
}

export async function saveDailyPnlSummary(data: {
  dayKey: string;
  filter: 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL';
  overallWinRatePct: number;
  overallUnitsPnl: number;
  overallRoiPct: number;
  rows: any;
}) {
  return callConvex(api.predictor.saveDailyPnlSummary, data);
}

export async function fetchActiveRun(sportId: PredictorSportId, dayKey: string): Promise<PredictorRun | null> {
  return queryConvex<PredictorRun | null>(api.predictor.getActiveRun, { sportId, dayKey });
}

export async function startPredictorRefresh(sportId: PredictorSportId, dayKey: string): Promise<{ runId: string; alreadyRunning: boolean }> {
  return callConvex<{ runId: string; alreadyRunning: boolean }>(api.predictor.startRefresh, { sportId, dayKey });
}

export function emptyAnalysis(): Analysis {
  return {
    headline: 'Unavailable',
    chips: [],
    profiles: [],
    picks: [],
    metrics: [],
    masterLedger: null,
    masterRankings: []
  };
}

// Coerce an arbitrary persisted scope into something the engine can traverse
// without throwing. The predictor only ever stores CachedScope-shaped scopes,
// but stale/corrupt rows must degrade gracefully instead of producing a 500.
function sanitizeScope(raw: unknown): ScopeState {
  if (!raw || typeof raw !== 'object') return { id: '', title: '', teamA: '', teamB: '', markets: {} };
  const s = raw as Record<string, unknown>;
  const markets = (s.markets && typeof s.markets === 'object' ? s.markets : {}) as Record<string, unknown>;
  return {
    id: typeof s.id === 'string' ? s.id : '',
    title: typeof s.title === 'string' ? s.title : '',
    teamA: typeof s.teamA === 'string' ? s.teamA : '',
    teamB: typeof s.teamB === 'string' ? s.teamB : '',
    leaguePreset: typeof s.leaguePreset === 'string' ? s.leaguePreset : undefined,
    markets
  } as ScopeState;
}

// Run the existing deterministic engine over a cached scope and keep only
// selections that clear the confidence floor (Amara Obi's filter).
export function analyzeCachedMatch(match: PredictorMatch, floor = DEFAULT_CONFIDENCE_FLOOR): {
  analysis: Analysis;
  qualifying: ReturnType<typeof filterHighConfidence>;
} {
  const scope = sanitizeScope(match.scopes);
  let analysis: Analysis;
  try {
    analysis = analyzeScope(predictorSportToSportId(match.sportId), scope);
  } catch {
    analysis = emptyAnalysis();
  }
  const qualifying = filterHighConfidence(analysis, floor);
  return { analysis, qualifying };
}
