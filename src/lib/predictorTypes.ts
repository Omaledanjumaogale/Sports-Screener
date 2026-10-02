import { marketContext, gradeEvidence } from './marketEvidence';
import type { AiAnalysisResult } from './cloudflareAi';

// The AI Predictor covers the sports whose sources deliver fixtures DAILY.
// Rally (table tennis), rugby, cricket, mma and volleyball were removed —
// no registered source provides consistent daily fixtures for them.
export type PredictorSportId =
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'hockey'
  | 'baseball'

export const PREDICTOR_SPORTS: PredictorSportId[] = ['football', 'basketball', 'tennis', 'hockey', 'baseball'];

export function isPredictorSport(id: string | undefined | null): id is PredictorSportId {
  return !!id && (PREDICTOR_SPORTS as string[]).includes(id);
}

export const CANONICAL_SPORT_LEAGUES: Record<PredictorSportId, string[]> = {
  football: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Eredivisie', 'FA Cup', 'Europa League', 'Europa', 'Conference League', 'Championship', 'League One', 'League Two', 'EFL Cup', 'Serie B', 'Segunda Division', 'Segunda', 'Bundesliga 2', 'Ligue 2', 'Primeira Liga', 'Super Lig', 'Liga MX', 'MLS', 'Scottish Premiership', 'Copa Libertadores', 'Copa America', 'World Cup', 'Nations League', 'NPFL'],
  basketball: ['NBA', 'EuroLeague', 'ACB', 'Liga ACB', 'LNB Pro A', 'LNB', 'WNBA', 'NCAAB', 'CBA', 'PBA', 'FIBA', 'Basketball Champions League'],
  tennis: ['ATP', 'WTA', 'Grand Slam', 'Masters 1000', 'ATP Tour', 'WTA Tour', 'Wimbledon', 'Australian Open', 'French Open', 'Roland Garros', 'US Open'],
  hockey: ['NHL', 'KHL', 'SHL', 'Liiga', 'AHL', 'DEL', 'Extraliga', 'Swiss National League'],
  baseball: ['MLB', 'NPB', 'KBO', 'MiLB', 'World Baseball Classic'],
};

const LEAGUE_NORMALIZE_MAP: Record<string, string> = {
  'serie a tim': 'Serie A', 'laliga': 'La Liga', 'la liga santander': 'La Liga',
  'premier': 'Premier League', 'epl': 'Premier League', 'english premier league': 'Premier League',
  'bundesliga 1': 'Bundesliga', '1. bundesliga': 'Bundesliga', 'ligue 1 uber eats': 'Ligue 1',
  'champs': 'Champions League', 'ucl': 'Champions League',
  'uel': 'Europa League', 'europa': 'Europa League',
  'conference': 'Conference League', 'uecl': 'Conference League',
  'mls major league soccer': 'MLS', 'major league soccer': 'MLS',
  'nba regular season': 'NBA', 'nba playoffs': 'NBA',
  'euroleague basketball': 'EuroLeague', 'turkish airlines euroleague': 'EuroLeague',
  'atp masters': 'Masters 1000', 'atp masters 1000': 'Masters 1000'
};

export function canonicalizeLeague(rawLeague: string, sportId?: PredictorSportId): string {
  const raw = String(rawLeague || '').trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (LEAGUE_NORMALIZE_MAP[key]) return LEAGUE_NORMALIZE_MAP[key];
  if (sportId && CANONICAL_SPORT_LEAGUES[sportId]) {
    const pool = CANONICAL_SPORT_LEAGUES[sportId];
    const match = pool.find((canon) => key.includes(canon.toLowerCase()) || canon.toLowerCase().includes(key));
    if (match) return match;
  }
  return raw;
}

export function leagueBelongsToSport(league: string, sportId: PredictorSportId): boolean {
  const normalized = canonicalizeLeague(league, sportId).toLowerCase();
  if (!normalized) return true;
  const pool = CANONICAL_SPORT_LEAGUES[sportId] || [];
  if (pool.length === 0) return true;
  const match = pool.some((canon) => {
    const cl = canon.toLowerCase();
    return normalized.includes(cl) || cl.includes(normalized);
  });
  if (match) return true;
  const otherSports = (Object.keys(CANONICAL_SPORT_LEAGUES) as PredictorSportId[]).filter((s) => s !== sportId);
  for (const other of otherSports) {
    const otherPool = CANONICAL_SPORT_LEAGUES[other] || [];
    const clash = otherPool.some((canon) => {
      const cl = canon.toLowerCase();
      if (cl.length < 4) return false;
      return normalized.includes(cl);
    });
    if (clash) return false;
  }
  return true;
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
  finalScore?: string;
  periodScores?:Record<string,{home:number;away:number}>;
  status?: 'upcoming' | 'inplay' | 'finished';
  createdAt: number;
}

export type GreatMindsModelId =
  | 'claude-opus'
  | 'chatgpt-pro'
  | 'kimi'
  | 'qwen'
  | 'grok';

export interface GreatMindsModelDef {
  id: GreatMindsModelId;
  name: string;
  shortName: string;
  version: string;
  role: string;
  iconBg: string;
  badgeColor: string;
  description: string;
}

export const GREAT_MINDS_MODELS: GreatMindsModelDef[] = [
  {
    id: 'claude-opus',
    name: 'Consensus synthesis',
    shortName: 'Consensus model',
    version: '4.0',
    role: 'The Moderator (Synthesis & Resolution)',
    iconBg: '#fbbf24',
    badgeColor: '#fbbf24',
    description: 'Manages 5-round debate flow, aggregates consensus, and forces final resolution.'
  },
  {
    id: 'chatgpt-pro',
    name: 'Probability model',
    shortName: 'Probability model',
    version: '3.2 Pro',
    role: 'The Data Scientist (EV & Probability)',
    iconBg: '#10b981',
    badgeColor: '#34d399',
    description: 'Calculates +EV edges via (Probability × DecimalOdds) - 1 and statistical bounds.'
  },
  {
    id: 'kimi',
    name: 'Tempo model',
    shortName: 'Tempo model',
    version: 'K2.5',
    role: 'The Analyst (Historical Trends & Tempo)',
    iconBg: '#3b82f6',
    badgeColor: '#60a5fa',
    description: 'Analyzes team tempo, offensive/defensive ratings, and momentum factors.'
  },
  {
    id: 'qwen',
    name: 'Market efficiency model',
    shortName: 'Market efficiency model',
    version: '3.5',
    role: 'The Technician (Line Efficiency & Odds Resistance)',
    iconBg: '#8b5cf6',
    badgeColor: '#a78bfa',
    description: 'Evaluates bookmaker margin resistance, de-vigged splits, and market volume.'
  },
  {
    id: 'grok',
    name: 'Risk challenge model',
    shortName: 'Risk challenge model',
    version: '4.2',
    role: 'The Contrarian (Spread & Stale Line Dissent)',
    iconBg: '#ef4444',
    badgeColor: '#f87171',
    description: 'Challenges majority biases, identifies stale spreads, and tests Asian Handicap value.'
  }
];

export interface GreatMindsModelChoice {
  modelId: GreatMindsModelId;
  modelName: string;
  pick: string;
  isAgree: boolean;
  evPercent?: number;
  reasoning?: string;
}

export interface GreatMindsPick {
  market: 'winner' | 'spread' | 'total';
  marketLabel: string;
  selection: string;
  odds: string;
  rawOdds?: number;
  consensusRatio: string; // e.g. '5/5', '4/5', '3/5'
  agreeCount: number;
  totalModels: number;
  status: 'unanimous' | 'strong' | 'majority' | 'split';
  modelChoices: GreatMindsModelChoice[];
  edgeEvPercent: number;
  // Cross-verified Real Win Chance: base engine probability, boosted by the
  // Great AI Minds panel consensus and adjusted by key-metric / research sentiment.
  baseProbabilityPct: number;
  consensusBoostPct: number;
  metricsAdjustmentPct: number;
  realWinChancePct: number;
  verdictTag: string;
  // Multi-stage verification gate (data integrity, computation accuracy,
  // single-team edge). false/absent picks are demoted to "Reference Only" and
  // never count toward Top/Strong/Qualifying signals.
  qualified?: boolean;
  verification?: {
    qualified: boolean;
    stages: { name: string; ok: boolean; note: string }[];
  };
}

export interface GreatMindsRound {
  roundNumber: number;
  title: string;
  moderatorSummary: string;
  modelPicks: Record<string, string>;
  dissentingNote?: string;
  winningSelection?: string;
}

export interface GreatMindsPickVerdict {
  market: string;
  selection: string;
  grade: 'win' | 'loss' | 'push' | 'pending';
  realWinChancePct: number;
}

export interface GreatMindsDebateResult {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  generatedAt: number;
  rounds: GreatMindsRound[];
  consensusPicks: {
    winner: GreatMindsPick;
    spread: GreatMindsPick;
    total: GreatMindsPick;
  };
  overallConsensusRatio: string;
  overallWinRatePct: number;
  overallRoiPct: number;
  overallUnitsPnl: number;
  fullTranscript: string;
  // Unified cross-verified Real Win Chance (weighted across the three markets).
  realWinChancePct: number;
  realWinChanceTag: string;
  spark: string;
  // Post-match resolution data — populated once a final score is available;
  // optional so older stored verdicts (without scores) stay type-safe.
  resolvedVerdict?: {
    totalPicks: number;
    wins: number;
    losses: number;
    pushes: number;
    winRatePct: number;
    pickVerdicts: GreatMindsPickVerdict[];
  };
  finalScore?: string | null;
  matchStatus?: 'upcoming' | 'inplay' | 'finished';
  scoreAvailable?: boolean;
}

export interface DailyPnlConsensusRow {
  consensusLabel: string;
  ratioKey: '5/5' | '4/5' | '3/5' | 'ALL';
  picksCount: number;
  wins: number;
  losses: number;
  push: number;
  winRatePct: number;
  unitsPnl: number;
  roiPct: number;
}

export interface GreatMindsStats {
  totalDebatesCount: number;
  unanimousWinRatePct: number;
  strongWinRatePct: number;
  majorityWinRatePct: number;
  topModel: string;
  modelAccuracyMap: Record<string, number>;
}

export type PnlSportFilter = PredictorSportId | 'ALL';
export type PnlMarketFilter = 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL';

export interface DailyPnlSummaryData {
  sportFilter: PnlSportFilter;
  marketFilter: PnlMarketFilter;
  overallWinRatePct: number;
  overallUnitsPnl: number;
  overallRoiPct: number;
  overallRecord: string; // e.g. "11W - 7L (0 picks)"
  rows: DailyPnlConsensusRow[];
  greatMindsStats: GreatMindsStats;
}

export interface PredictorVerdict {
  _id: string;
  dayKey: string;
  sportId: PredictorSportId;
  matchId: string;
  aiReport: AiAnalysisResult['insights'];
  greatMindsDebate?: GreatMindsDebateResult;
  dailyPnlSummary?: DailyPnlSummaryData;
  agentsRun: string[];
  citations: string[];
  updatedAt: number;
}

// ── Persisted AI-performance data bank (predictorStats.ts) ────────────────────
// One accuracy row per grouping (signal band, market family, sport, consensus
// rank, provider, leaderboard entry). `avgPredictedPct` is the mean probability
// the verdict PUBLISHED for the group and `calibrationGapPct` the gap to the
// realised win rate (0 = perfectly calibrated, positive = over-confident).
export interface StatsAccuracyRow {
  group: string;
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRatePct: number;
  avgPredictedPct: number;
  calibrationGapPct: number;
  unitsPnl: number;
  roiPct: number;
}

export interface StatsConsensusSummary {
  filter: 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL';
  winRatePct: number;
  unitsPnl: number;
  roiPct: number;
  rows?: Array<Record<string, unknown>>;
}

export interface StatsSnapshotData {
  overall: StatsAccuracyRow;
  byBand: StatsAccuracyRow[];
  byMarket: StatsAccuracyRow[];
  bySport: StatsAccuracyRow[];
  byRank: StatsAccuracyRow[];
  byProvider: StatsAccuracyRow[];
  rankings: StatsAccuracyRow[];
  settledMatches: number;
  gradedPicks: number;
  consensus?: StatsConsensusSummary[];
  daysAggregated?: number;
  generatedAt: number;
}

export interface PredictorStatsSnapshot {
  _id: string;
  scope: 'day' | 'lifetime';
  dayKey: string;
  settledMatches: number;
  gradedPicks: number;
  data: StatsSnapshotData;
  updatedAt: number;
}

export interface PredictorTotals {
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  units: number;
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

export const DEFAULT_CONFIDENCE_FLOOR = 52;

/** Maximum number of fixtures the AI Predictor may ingest per day (all sports). */
export const PREDICTOR_DAILY_CAP = 1200;

// ── Post-match result grading ─────────────────────────────────────────────────
export type SelectionGrade = 'win' | 'loss' | 'void' | 'push' | null;

export interface ParsedFinalScore {
  home: number;
  away: number;
}

/**
 * Parse a stored final score in the per-sport "2-1" style used by the match
 * cache (e.g. "2-1", "1-1", "6-4"). Returns null when the string is present but
 * not parseable as a numeric scoreline.
 */
export function parseFinScore(value?: string | null): ParsedFinalScore | null {
  if (!value) return null;
  const m = String(value).trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

export function isWinnerMarket(market: string): boolean {
  return /winner|moneyline|result|matchwinner|regresult|1x2|match.?.?.?.?winner/i.test(market);
}
export function isSpreadMarket(market: string): boolean {
  return /handicap|spread|line|puck|runline|sell/i.test(market);
}
export function isTotalMarket(market: string): boolean {
  return /total|over.?under|main|homeAway|game|set.?total|points|goals|runs/i.test(market) && !isSpreadMarket(market);
}

function extractThreshold(text: string): number | null {
  const m = String(text).match(/(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

export function gradeSelection(
  selection: string,
  market: string,
  finalScore?: string | null,
  opts?: { homeTeam?: string; awayTeam?: string; marketId?: string; sportId?:string; periodScores?:Record<string,{home:number;away:number}> }
): SelectionGrade {
  const pick={marketId:opts?.marketId??market,marketTitle:market,label:selection,probability:50,odds:0};
  const context=marketContext(pick);
  if(!['total','handicap','winner'].includes(context.family))return null;
  const grade=gradeEvidence(pick,{sportId:opts?.sportId??'unknown',dayKey:'',matchId:'',homeTeam:opts?.homeTeam,awayTeam:opts?.awayTeam,finalScore:finalScore??undefined,periodScores:opts?.periodScores});
  return grade==='partial'?null:grade;
}
