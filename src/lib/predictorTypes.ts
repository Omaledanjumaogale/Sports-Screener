import type { AiAnalysisResult } from './cloudflareAi';

export type PredictorSportId =
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'rally'
  | 'hockey'
  | 'baseball'
  | 'americanfootball'
  | 'rugby'
  | 'cricket'
  | 'mma'
  | 'volleyball';

export const PREDICTOR_SPORTS: PredictorSportId[] = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'];

export function isPredictorSport(id: string | undefined | null): id is PredictorSportId {
  return !!id && (PREDICTOR_SPORTS as string[]).includes(id);
}

export function isFootballMatch(m: { league?: string; homeTeam?: string; awayTeam?: string }): boolean {
  const text = `${m.league || ''} ${m.homeTeam || ''} ${m.awayTeam || ''}`.toLowerCase();
  const ttKeywords = ['ittf', 'wtt', 'table tennis', 'ping pong', 'tt cup', 'lebrun', 'harimoto', 'zhendong', 'ma long', 'timo boll', 'ovtcharov', 'chuqin', 'yingsha', 'chen meng', 'calderano', 'aruna', 'moregard', 'jorgic', 'qiu', 'franziska', 'manyu', 'lin gaoyuan', 'liang jingkun'];
  if (ttKeywords.some((k) => text.includes(k))) return false;

  const soccerKeywords = [
    'premier league', 'la liga', 'serie a', 'bundesliga', 'ligue 1', 'ligue 2', 'champions league',
    'europa league', 'conference league', 'championship', 'league one', 'league two', 'eredivisie',
    'primeira liga', 'super lig', 'liga mx', 'mls', 'npfl', 'copa libertadores', 'copa america',
    'fa cup', 'efl cup', 'dfb pokal', 'copa del rey', 'coppa italia', 'soccer', 'football',
    'arsenal', 'chelsea', 'liverpool', 'man city', 'manchester', 'real madrid', 'barcelona',
    'bayern', 'juventus', 'inter', 'milan', 'psg', 'paris sg', 'tottenham', 'everton', 'dortmund',
    'napoli', 'roma', 'benfica', 'porto', 'sporting', 'ajax', 'feyenoord', 'psv', 'celtic', 'rangers',
    'newcastle', 'aston villa', 'west ham', 'brighton', 'wolves', 'fulham', 'brentford', 'crystal palace',
    'leicester', 'southampton', 'leeds', 'nottingham', 'sevilla', 'villarreal', 'real sociedad',
    'athletic club', 'betis', 'getafe', 'valencia', 'osasuna', 'lazio', 'atalanta', 'fiorentina',
    'torino', 'bologna', 'monaco', 'lille', 'marseille', 'lyon', 'rennes', 'nice', 'leipzig',
    'leverkusen', 'frankfurt', 'wolfsburg', 'gladbach'
  ];

  return soccerKeywords.some((k) => text.includes(k));
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
    name: 'Claude Opus 4.0',
    shortName: 'Claude 4.0',
    version: '4.0',
    role: 'The Moderator (Synthesis & Resolution)',
    iconBg: '#d97706',
    badgeColor: '#fbbf24',
    description: 'Manages 5-round debate flow, aggregates consensus, and forces final resolution.'
  },
  {
    id: 'chatgpt-pro',
    name: 'ChatGPT 3.2 Pro',
    shortName: 'ChatGPT Pro',
    version: '3.2 Pro',
    role: 'The Data Scientist (EV & Probability)',
    iconBg: '#10b981',
    badgeColor: '#34d399',
    description: 'Calculates +EV edges via (Probability × DecimalOdds) - 1 and statistical bounds.'
  },
  {
    id: 'kimi',
    name: 'Kimi K2.5',
    shortName: 'Kimi K2.5',
    version: 'K2.5',
    role: 'The Analyst (Historical Trends & Tempo)',
    iconBg: '#3b82f6',
    badgeColor: '#60a5fa',
    description: 'Analyzes team tempo, offensive/defensive ratings, and momentum factors.'
  },
  {
    id: 'qwen',
    name: 'Qwen 3.5',
    shortName: 'Qwen 3.5',
    version: '3.5',
    role: 'The Technician (Line Efficiency & Odds Resistance)',
    iconBg: '#8b5cf6',
    badgeColor: '#a78bfa',
    description: 'Evaluates bookmaker margin resistance, de-vigged splits, and market volume.'
  },
  {
    id: 'grok',
    name: 'Grok 4.2',
    shortName: 'Grok 4.2',
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
}

export interface GreatMindsRound {
  roundNumber: number;
  title: string;
  moderatorSummary: string;
  modelPicks: Record<string, string>;
  dissentingNote?: string;
  winningSelection?: string;
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
  opts?: { homeTeam?: string; awayTeam?: string; marketId?: string }
): SelectionGrade {
  const score = parseFinScore(finalScore);
  if (!score) return null;

  const mkt = market || opts?.marketId || '';
  const lower = mkt.toLowerCase();
  const sel = String(selection || '');

  // Total / over-under markets (main, team, set, player totals).
  if (isTotalMarket(lower)) {
    const side = /home/.test(lower) ? score.home : /away/.test(lower) ? score.away : score.home + score.away;
    const threshold = extractThreshold(sel);
    if (threshold == null) return null;
    const over = /(^|\s)over[\s\S]*/i.test(sel);
    if (over) {
      if (side > threshold) return 'win';
      if (side === threshold) return 'push';
      return 'loss';
    }
    // assume under
    if (side < threshold) return 'win';
    if (side === threshold) return 'push';
    return 'loss';
  }

  // Winner / moneyline.
  if (isWinnerMarket(lower)) {
    const lowerSel = sel.toLowerCase();
    const home = opts?.homeTeam?.toLowerCase();
    const away = opts?.awayTeam?.toLowerCase();
    const isDraw = /(^|\s)draw/i.test(lowerSel);
    if (isDraw) {
      if (score.home === score.away) return 'win';
      return 'loss';
    }
    const isHome = home ? lowerSel.includes(home) : /home|^\d\s|\bteam\s*a\b|^1\b/i.test(lowerSel);
    const isAway = isHome ? false : away ? lowerSel.includes(away) : /away|team\s*b|^2\b/i.test(lowerSel);
    if (isHome) return score.home > score.away ? 'win' : 'loss';
    if (isAway) return score.away > score.home ? 'win' : 'loss';
    return null;
  }

  // Spread / handicap.
  if (isSpreadMarket(lower)) {
    const threshold = extractThreshold(sel);
    if (threshold == null) return null;
    const lowerSel = sel.toLowerCase();
    const home = opts?.homeTeam?.toLowerCase();
    const away = opts?.awayTeam?.toLowerCase();
    const isHome = home ? lowerSel.includes(home) : /home|match|1\b/.test(lowerSel);
    const isAway = home ? lowerSel.includes(away ?? '') : /away|2\b/.test(lowerSel);
    const base = isAway ? score.away : score.home;
    const other = isAway ? score.home : score.away;
    const adjusted = base + threshold;
    if (adjusted > other) return 'win';
    if (adjusted === other) return 'push';
    return 'loss';
  }

  // Unknown market — best-effort numeric line try (push-aware).
  return null;
}

