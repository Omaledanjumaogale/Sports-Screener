import type { AiAnalysisResult } from './cloudflareAi';

export type PredictorSportId =
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'rally'
  | 'hockey'
  | 'baseball';

export const PREDICTOR_SPORTS: PredictorSportId[] = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball'];

export function isPredictorSport(id: string | undefined | null): id is PredictorSportId {
  return !!id && (PREDICTOR_SPORTS as string[]).includes(id);
}

export interface PredictorMatch {
  _id: string;
  dayKey: string;
  sportId: PredictorSportId;
  matchId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  source: string;
  marketsAvailable: string[];
  scopes: any;
  oddsSnapshot?: any;
  createdAt: number;
}

export interface PredictorVerdict {
  _id: string;
  dayKey: string;
  sportId: PredictorSportId;
  matchId: string;
  aiReport: AiAnalysisResult['insights'];
  agentsRun: string[];
  citations: string[];
  updatedAt: number;
}

export type PredictorDayStatus = 'pending' | 'refreshing' | 'ready' | 'partial' | 'stale' | 'error';

export interface PredictorDay {
  _id: string;
  dayKey: string;
  sportId: PredictorSportId;
  status: PredictorDayStatus;
  lastRefreshAt?: number;
  expiresAt: number;
  runId?: string;
  cap: number;
  sourcesUsed: string[];
  message?: string;
  createdAt: number;
  updatedAt: number;
}

export type PredictorRunStatus = 'pending' | 'running' | 'complete' | 'error';

export interface PredictorRun {
  _id: string;
  runId: string;
  dayKey: string;
  sportId: PredictorSportId;
  progress: number;
  stage: string;
  status: PredictorRunStatus;
  message?: string;
  startedAt: number;
  completedAt?: number;
  updatedAt: number;
}

export const DEFAULT_CONFIDENCE_FLOOR = 60;
