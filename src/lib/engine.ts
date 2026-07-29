export type Status = 'green' | 'amber' | 'red' | 'empty';
export type SportId = 'football' | 'basketball' | 'tennis' | 'rally' | 'hockey';
export type MarketKind = 'ou' | 'handicap' | 'winner' | 'threeway' | 'yesno' | 'correctScore';

export type LedgerVote = 'Agree' | 'Disagree' | 'N/A';
export type ConfluenceTier =
  | 'Tier 1 — High Confluence'
  | 'Tier 2 — Moderate Confluence'
  | 'Tier 3 — Single-Angle'
  | 'Tier 3 — Conflicted'
  | 'No Read';

export interface LinePair {
  line: number | null;
  over: number | null;
  under: number | null;
}

export interface HandicapPair {
  line: number | null;
  sideA: number | null;
  sideB: number | null;
}

export interface MarketInput {
  id: string;
  kind: MarketKind;
  title: string;
  primary?: boolean;
  pairs?: LinePair[];
  handicapPairs?: HandicapPair[];
  odds?: Record<string, number | null>;
}

export interface ScopeState {
  id: string;
  title: string;
  teamA?: string;
  teamB?: string;
  leaguePreset?: string;
  surface?: string;
  format?: string;
  markets: Record<string, MarketInput>;
}

export interface Pick {
  marketId: string;
  marketTitle: string;
  label: string;
  probability: number;
  odds: number;
  margin?: number;
  ev?: number;
  confluenceTier?: ConfluenceTier;
}

export interface Check {
  title: string;
  detail: string;
  status: Status;
  pillText?: string;
}

export interface Profile {
  key: 'A' | 'B' | 'C' | 'D';
  title: string;
  tag?: string;
  score: number;
  completed: number;
  ratio: number;
  status: Status;
  checks: Check[];
  top?: Pick;
}

export interface LedgerRow {
  name: string;
  vote: LedgerVote;
  detail: string;
}

export interface MasterConfluenceLedger {
  candidateLabel: string;
  marketProbability: number | null;
  bookmakerMargin: number | null;
  rows: LedgerRow[];
  agreeCount: number;
  disagreeCount: number;
  naCount: number;
  tier: ConfluenceTier;
  conflictReason?: string;
  missingFields: string[];
}

export interface Analysis {
  headline: string;
  chips: { label: string; value: string; status: Status }[];
  profiles: Profile[];
  picks: Pick[];
  metrics: { label: string; value: string; note?: string; status?: Status }[];
  masterLedger?: MasterConfluenceLedger | null;
  masterRankings?: Pick[];
}

export const oddsOptions: number[] = (() => {
  const opts: number[] = [];
  for (let o = 1.01; o <= 5.00 + 1e-9; o += 0.01) {
    opts.push(round(o, 2));
  }
  for (let o = 5.50; o <= 10.00 + 1e-9; o += 0.50) {
    opts.push(round(o, 2));
  }
  return opts;
})();

export const FOOTBALL_SCORES = ['0-0', '1-0', '0-1', '1-1', '2-0', '0-2', '2-1', '1-2', '2-2'];
export const TENNIS_SET_SCORES = ['6-0', '6-1', '6-2', '6-3', '6-4', '7-5', '7-6', '0-6', '1-6', '2-6', '3-6', '4-6', '5-7', '6-7'];
export const TENNIS_MATCH_SCORES_BO3 = ['2-0', '2-1', '0-2', '1-2'];
export const TENNIS_MATCH_SCORES_BO5 = ['3-0', '3-1', '3-2', '0-3', '1-3', '2-3'];
export const RALLY_SCORES = ['3-0', '3-1', '3-2', '0-3', '1-3', '2-3'];
export const HOCKEY_SCORES_RT = ['0-0', '1-0', '0-1', '1-1', '2-0', '0-2', '2-1', '1-2', '2-2', '3-0', '0-3', 'Other'];
export const HOCKEY_SCORES_P1 = ['0-0', '1-0', '0-1', '1-1', '2-0', '0-2', '2-1', '1-2', '2-2', 'Other'];

export function range(start: number, end: number, step: number): number[] {
  const out: number[] = [];
  for (let n = start; n <= end + 1e-9; n += step) out.push(round(n, 2));
  return out;
}

export function emptyPairs(count: number, lines: number[] = []): LinePair[] {
  return Array.from({ length: count }, (_, i) => ({
    line: lines[i] ?? null,
    over: null,
    under: null
  }));
}

export function emptyHandicaps(count: number, lines: number[] = []): HandicapPair[] {
  return Array.from({ length: count }, (_, i) => ({
    line: lines[i] ?? null,
    sideA: null,
    sideB: null
  }));
}

export function oddsMap(keys: string[]): Record<string, null> {
  return Object.fromEntries(keys.map((key) => [key, null]));
}

function market(id: string, title: string, kind: MarketKind, extra: Partial<MarketInput> = {}): MarketInput {
  return { id, title, kind, ...extra };
}

export function implied(odds?: number | null): number {
  return odds && odds > 1 ? 1 / odds : 0;
}

export function round(value: number, places = 1): number {
  const m = 10 ** places;
  return Math.round(value * m) / m;
}

export function pct(value: number | null | undefined, places = 0): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${round(value, places)}%` : '-';
}

export function normalizeTwo(a?: number | null, b?: number | null) {
  const ia = implied(a);
  const ib = implied(b);
  const sum = ia + ib;
  if (!sum || !a || !b) return null;
  return {
    a: (ia / sum) * 100,
    b: (ib / sum) * 100,
    margin: (sum - 1) * 100
  };
}

export function normalizeN(values: Array<{ key: string; odds: number | null }>) {
  const valid = values.filter((v) => v.odds && v.odds > 1);
  if (valid.length < 2) return null;
  const total = valid.reduce((s, v) => s + implied(v.odds), 0);
  return {
    probs: Object.fromEntries(valid.map((v) => [v.key, (implied(v.odds) / total) * 100])),
    margin: (total - 1) * 100
  };
}

export function statusFromPct(value: number, green = 70, amber = 58): Status {
  if (value >= green) return 'green';
  if (value >= amber) return 'amber';
  return 'red';
}

export function statusFromRatio(value: number, strong = 0.72, borderline = 0.45): Status {
  if (value >= strong) return 'green';
  if (value >= borderline) return 'amber';
  return 'red';
}

export function scoreChecks(checks: Check[], strong = 0.72, borderline = 0.45) {
  const completed = checks.filter((c) => c.status !== 'empty');
  const greens = completed.filter((c) => c.status === 'green').length;
  const ambers = completed.filter((c) => c.status === 'amber').length;
  const score = greens + ambers * 0.5;
  const ratio = completed.length ? score / completed.length : 0;
  return {
    score,
    greens,
    ambers,
    completed: completed.length,
    ratio,
    status: completed.length ? statusFromRatio(ratio, strong, borderline) : ('empty' as Status)
  };
}

export function tier3(v: number, green: number, amber: number, lowIsGreen: boolean): Status {
  if (lowIsGreen) return v <= green ? 'green' : v <= amber ? 'amber' : 'red';
  return v >= green ? 'green' : v >= amber ? 'amber' : 'red';
}

export function analyzeLines(market: MarketInput): Pick[] {
  if (!market.pairs) return [];
  return market.pairs.flatMap((pair) => {
    const norm = normalizeTwo(pair.over, pair.under);
    if (pair.line === null || !pair.over || !pair.under || !norm) return [];
    return [
      {
        marketId: market.id,
        marketTitle: market.title,
        label: `Over ${pair.line}`,
        probability: norm.a,
        odds: pair.over,
        margin: norm.margin
      },
      {
        marketId: market.id,
        marketTitle: market.title,
        label: `Under ${pair.line}`,
        probability: norm.b,
        odds: pair.under,
        margin: norm.margin
      }
    ];
  });
}

export function analyzeHandicap(market: MarketInput, sideALabel = 'Side A', sideBLabel = 'Side B'): Pick[] {
  if (!market.handicapPairs) return [];
  return market.handicapPairs.flatMap((pair) => {
    const norm = normalizeTwo(pair.sideA, pair.sideB);
    if (pair.line === null || !pair.sideA || !pair.sideB || !norm) return [];
    const sign = pair.line > 0 ? '+' : '';
    return [
      {
        marketId: market.id,
        marketTitle: market.title,
        label: `${sideALabel} ${sign}${pair.line}`,
        probability: norm.a,
        odds: pair.sideA,
        margin: norm.margin
      },
      {
        marketId: market.id,
        marketTitle: market.title,
        label: `${sideBLabel} ${pair.line > 0 ? '-' : '+'}${Math.abs(pair.line)}`,
        probability: norm.b,
        odds: pair.sideB,
        margin: norm.margin
      }
    ];
  });
}

export function analyzeOddsMarket(market: MarketInput, labels: Record<string, string>): Pick[] {
  const entries = Object.entries(market.odds ?? {}).filter(([, odds]) => odds && odds > 1) as [string, number][];
  if (entries.length < 2) return [];
  const norm = normalizeN(entries.map(([key, odds]) => ({ key, odds })));
  if (!norm) return [];
  return entries.map(([key, odds]) => ({
    marketId: market.id,
    marketTitle: market.title,
    label: labels[key] ?? key,
    probability: norm.probs[key] ?? 0,
    odds,
    margin: norm.margin
  }));
}

export function bestExpectedLine(lines: LinePair[], zone: number) {
  const complete = lines
    .map((pair) => {
      const norm = normalizeTwo(pair.over, pair.under);
      if (pair.line === null || !pair.over || !pair.under || !norm) return null;
      return { ...pair, normOver: norm.a / 100, normUnder: norm.b / 100, margin: norm.margin };
    })
    .filter(Boolean) as Array<LinePair & { normOver: number; normUnder: number; margin: number }>;

  complete.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  if (!complete.length) return null;
  if (complete.length === 1) {
    return { expected: complete[0].line ?? 0, approx: true, rows: complete, bestOver: null, bestUnder: null };
  }

  let expected: number | null = null;
  for (let i = 0; i < complete.length - 1; i += 1) {
    const a = complete[i];
    const b = complete[i + 1];
    if (a.normOver >= 0.5 && b.normOver <= 0.5 && a.line !== null && b.line !== null) {
      const ratio = (a.normOver - 0.5) / (a.normOver - b.normOver || 1);
      expected = a.line + ratio * (b.line - a.line);
      break;
    }
  }
  if (expected === null) {
    const closest = complete.reduce((best, cur) => (Math.abs(cur.normOver - 0.5) < Math.abs(best.normOver - 0.5) ? cur : best));
    expected = closest.line ?? 0;
  }

  const bestOver =
    complete
      .filter((row) => row.line !== null && row.line < expected! && row.line >= expected! - zone)
      .sort((a, b) => b.normOver - a.normOver)[0] ?? null;
  const bestUnder =
    complete
      .filter((row) => row.line !== null && row.line > expected! && row.line <= expected! + zone)
      .sort((a, b) => b.normUnder - a.normUnder)[0] ?? null;

  return { expected: round(expected, 1), approx: false, rows: complete, bestOver, bestUnder };
}

function profileFromChecks(
  key: Profile['key'],
  title: string,
  checks: Check[],
  strong = 0.72,
  borderline = 0.45,
  top?: Pick,
  tag?: string
): Profile {
  const scored = scoreChecks(checks, strong, borderline);
  return { key, title, tag, ...scored, checks, top };
}

function topPick(picks: Pick[]): Pick | undefined {
  return picks.slice().sort((a, b) => b.probability - a.probability)[0];
}

export function withEv(pick: Pick): Pick {
  return { ...pick, ev: (pick.probability / 100) * pick.odds - 1 };
}

/* ========================= FOOTBALL ========================= */

const FOOTBALL_SCOPE_BASE: Record<string, Record<string, any>> = {
  h1: {
    a1: { green: 69, amber: 60 }, a2: { green: 55, amber: 45 }, a3: { green: 0.75, amber: 1.5 },
    a4: { green: 2.20, amber: 2.60 }, a5: { green: 3.00, amber: 3.50 },
    b1: { green: 75, amber: 65 }, b3: { green: 26, amber: 33 },
    b4: { gLow: 1, gHigh: 2, aLow: 0.5, aHigh: 2.5 }, b5: { green: 12, amber: 8 },
    strong: 0.75, borderline: 0.45, cGreen: 80, cAmber: 65
  },
  h2: {
    a1: { green: 74, amber: 65 }, a2: { green: 60, amber: 50 }, a3: { green: 0.75, amber: 1.5 },
    a4: { green: 2.05, amber: 2.45 }, a5: { green: 3.20, amber: 3.70 },
    b1: { green: 70, amber: 60 }, b3: { green: 32, amber: 38 },
    b4: { gLow: 1, gHigh: 2, aLow: 0.5, aHigh: 2.5 }, b5: { green: 14, amber: 10 },
    strong: 0.75, borderline: 0.45, cGreen: 80, cAmber: 65
  },
  ft: {
    a1: { green: 58, amber: 50 }, a2: { green: 50, amber: 40 }, a3: { green: 1.0, amber: 2.0 },
    a4: { green: 3.00, amber: 3.60 }, a5: { green: 1.90, amber: 2.20 },
    b1: { green: 58, amber: 50 }, b2: { green: 1.85, amber: 2.15 }, b3: { green: 12, amber: 18 },
    b4: { gLow: 1.0, gHigh: 2.5, aLow: 0.5, aHigh: 3.5 }, b5: { green: 14, amber: 9 },
    strong: 0.75, borderline: 0.45, cGreen: 80, cAmber: 65
  }
};

const LEAGUE_DELTA: Record<string, any> = {
  balanced: { note: 'No league adjustment applied.' },
  lowScoring: {
    note: 'Under-side bars eased, Over-side bars raised.',
    a1: { g: -5, a: -5 }, a2: { g: -5, a: -5 }, a4: { g: 0.15, a: 0.15 }, a5: { g: -0.20, a: -0.20 },
    b1: { g: 5, a: 5 }, b3: { g: -2, a: -2 }, b5: { g: -2, a: -2 }
  },
  highScoring: {
    note: 'Over-side bars eased, Under-side bars raised.',
    a1: { g: 5, a: 5 }, a2: { g: 5, a: 5 }, a4: { g: -0.15, a: -0.15 }, a5: { g: 0.20, a: 0.20 },
    b1: { g: -5, a: -5 }, b3: { g: 6, a: 6 }, b5: { g: 2, a: 2 }
  },
  cup: {
    note: 'Per-check bars unchanged; Strong verdict bar raised due to knockout variance.',
    strong: 0.10, cGreen: 5
  }
};

function buildFootballCfg(scopeId: string, presetKey: string) {
  const base = FOOTBALL_SCOPE_BASE[scopeId] ?? FOOTBALL_SCOPE_BASE.h1;
  const cfg = JSON.parse(JSON.stringify(base));
  const delta = LEAGUE_DELTA[presetKey] ?? LEAGUE_DELTA.balanced;
  ['a1', 'a2', 'a4', 'a5', 'b1', 'b2', 'b3', 'b5'].forEach((k) => {
    if (delta[k] && cfg[k]) {
      if (typeof delta[k].g === 'number') cfg[k].green = round(cfg[k].green + delta[k].g);
      if (typeof delta[k].a === 'number') cfg[k].amber = round(cfg[k].amber + delta[k].a);
    }
  });
  if (typeof delta.strong === 'number') cfg.strong = Math.min(0.95, cfg.strong + delta.strong);
  if (typeof delta.cGreen === 'number') cfg.cGreen = Math.min(95, cfg.cGreen + delta.cGreen);
  cfg.note = delta.note || '';
  return cfg;
}

export function analyzeFootball(scope: ScopeState): Analysis {
  const cfg = buildFootballCfg(scope.id, scope.leaguePreset ?? 'balanced');

  const mainTotal = scope.markets.mainTotal;
  const totalPicks = analyzeLines(mainTotal);
  const targetLine = scope.id === 'ft' ? 2.5 : 1.5;
  const primaryLine =
    mainTotal.pairs?.find((row) => row.line === targetLine) ??
    (totalPicks.length ? mainTotal.pairs?.find((row) => row.over && row.under) : undefined);
  const norm = primaryLine ? normalizeTwo(primaryLine.over, primaryLine.under) : null;
  const underProb = norm?.b ?? null;
  const overProb = norm?.a ?? null;

  const grid = analyzeOddsMarket(scope.markets.correctScore, Object.fromEntries([...FOOTBALL_SCORES, 'Other'].map((s) => [s, s])));
  const lowScores = grid.filter((pick) => ['0-0', '1-0', '0-1', '1-1'].includes(pick.label)).reduce((s, pick) => s + pick.probability, 0);
  const nilNil = grid.find((pick) => pick.label === '0-0')?.probability;

  const noneOdds = scope.markets.noneOdds?.odds?.['none'];
  const noneProb = noneOdds ? implied(noneOdds) * 100 : null;

  const rankPicks = [
    ...analyzeOddsMarket(scope.markets.result, { home: 'Home Win', draw: 'Draw', away: 'Away Win' }),
    ...analyzeOddsMarket(scope.markets.doubleChance, { hd: 'Home or Draw', ha: 'Home or Away', da: 'Draw or Away' }),
    ...analyzeHandicap(scope.markets.handicap, 'Home', 'Away')
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  const goalLinePicks = [
    ...totalPicks,
    ...analyzeLines(scope.markets.homeTotal ?? { id: 'homeTotal', kind: 'ou', title: '' }),
    ...analyzeLines(scope.markets.awayTotal ?? { id: 'awayTotal', kind: 'ou', title: '' }),
    ...(scope.id === 'ft'
      ? analyzeOddsMarket(scope.markets.btts ?? { id: 'btts', kind: 'yesno', title: '' }, { yes: 'BTTS Yes (GG)', no: 'BTTS No (NG)' })
      : [])
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  const allFootballPicks = [...rankPicks, ...goalLinePicks].sort((a, b) => b.probability - a.probability);
  const primaryPicks = allFootballPicks.filter((p) => p.marketId === 'mainTotal' || p.marketId === 'result');
  const safestPick = topPick(primaryPicks) ?? topPick(allFootballPicks);
  const bestValuePick =
    primaryPicks.filter((p) => p.probability >= 55).sort((a, b) => (b.ev ?? -99) - (a.ev ?? -99))[0] ?? topPick(allFootballPicks);
  const shapePick = topPick(grid.length ? grid : goalLinePicks);

  const aChecks: Check[] = [
    {
      title: 'Main Under probability',
      detail: underProb === null ? `Select Under/Over ${targetLine} odds to screen.` : `Under ${targetLine} de-vigged probability: ${pct(underProb, 1)}`,
      status: underProb === null ? 'empty' : tier3(underProb, cfg.a1.green, cfg.a1.amber, false)
    },
    {
      title: 'Low-score cluster (grid)',
      detail: grid.length ? `0:0/1:0/0:1/1:1 = ${pct(lowScores, 1)} of CS probability` : 'Enter 5+ correct score cells for normalized read',
      status: grid.length ? tier3(lowScores, cfg.a2.green, cfg.a2.amber, false) : 'empty'
    },
    {
      title: 'Draw price support',
      detail: rankPicks.find((p) => p.label === 'Draw') ? `Draw at ${rankPicks.find((p) => p.label === 'Draw')!.probability.toFixed(1)}%` : 'Enter 1X2 to measure tempo',
      status: rankPicks.find((p) => p.label === 'Draw')?.probability
        ? tier3(rankPicks.find((p) => p.label === 'Draw')!.probability, scope.id === 'ft' ? 25 : 34, scope.id === 'ft' ? 22 : 28, false)
        : 'empty'
    },
    {
      title: scope.id === 'ft' ? '0-0 resistance' : '"None" odds (no goal in half)',
      detail: scope.id === 'ft'
        ? (nilNil !== undefined ? `0-0 priced at ${pct(nilNil, 1)}` : '0-0 correct-score cell needed')
        : (noneProb !== null ? `None priced to ${pct(noneProb, 1)}` : 'Enter None odds for strongest read'),
      status: scope.id === 'ft'
        ? (nilNil !== undefined ? (nilNil >= cfg.a5.green ? 'green' : nilNil >= cfg.a5.amber ? 'amber' : 'red') : 'empty')
        : (noneProb !== null ? tier3(noneProb, cfg.a4.green * 30, cfg.a4.amber * 25, false) : 'empty')
    },
    {
      title: 'Safety fallback',
      detail: rankPicks[0] ? `${rankPicks[0].label} is strongest result-market fallback` : 'Enter 1X2/DC/AH markets',
      status: rankPicks[0] ? statusFromPct(rankPicks[0].probability, cfg.cGreen, cfg.cAmber) : 'empty'
    }
  ];

  const bChecks: Check[] = [
    {
      title: 'Main Over probability',
      detail: overProb === null ? `Select Under/Over ${targetLine} odds to screen.` : `Over ${targetLine} de-vigged probability: ${pct(overProb, 1)}`,
      status: overProb === null ? 'empty' : tier3(overProb, cfg.b1.green, cfg.b1.amber, false)
    },
    {
      title: 'Goal-line / BTTS support',
      detail: goalLinePicks[0] ? `${goalLinePicks[0].label} leads goal markets at ${pct(goalLinePicks[0].probability, 1)}` : 'Add more goal-line or BTTS markets',
      status: goalLinePicks[0] ? statusFromPct(goalLinePicks[0].probability, 70, 58) : 'empty'
    },
    {
      title: '0-0 suppression',
      detail: nilNil !== undefined ? `0-0 priced at ${pct(nilNil, 1)}` : '0-0 correct-score cell needed',
      status: nilNil !== undefined ? (nilNil <= cfg.b3.green ? 'green' : nilNil <= cfg.b3.amber ? 'amber' : 'red') : 'empty'
    },
    {
      title: 'Result pressure (favourite dominance)',
      detail: rankPicks[0] ? `${rankPicks[0].label} leads result markets at ${pct(rankPicks[0].probability, 1)}` : 'Favourite pricing helps Over reads',
      status: rankPicks[0] ? statusFromPct(rankPicks[0].probability, 76, 62) : 'empty'
    },
    {
      title: 'Goal-line breadth',
      detail: `${goalLinePicks.length} goal-related candidate sides ranked`,
      status: goalLinePicks.length >= 9 ? 'green' : goalLinePicks.length >= 5 ? 'amber' : 'empty'
    }
  ];

  const profiles = [
    profileFromChecks('A', 'Safest Selection — lowest margin read', aChecks, cfg.strong, cfg.borderline, safestPick, 'Final Verdict'),
    profileFromChecks('B', 'Best Value — margin-cost ranking', bChecks, cfg.strong, cfg.borderline, bestValuePick, 'Margin Rank'),
    profileFromChecks('C', 'Match-Shape Intelligence (Score-shape)', [], cfg.strong, cfg.borderline, shapePick, 'Shape Read'),
    profileFromChecks('D', 'All Markets Ranking', [], cfg.strong, cfg.borderline, topPick(allFootballPicks), 'All Markets')
  ];

  return {
    ...finishAnalysis(scope, profiles, allFootballPicks, cfg.cGreen, cfg.cAmber),
    metrics: [
      { label: 'Low-score cluster', value: grid.length ? pct(lowScores, 1) : '-', note: '0-0 / 1-0 / 0-1 / 1-1', status: grid.length ? statusFromPct(lowScores, cfg.a2.green, cfg.a2.amber) : 'empty' },
      { label: scope.id === 'ft' ? '0-0 resistance' : 'None odds prob', value: scope.id === 'ft' ? (nilNil !== undefined ? pct(nilNil, 1) : '-') : (noneProb !== null ? pct(noneProb, 1) : '-'), note: scope.id === 'ft' ? 'Nil-nil probability' : 'No goal in half', status: scope.id === 'ft' ? (nilNil !== undefined ? statusFromPct(nilNil, cfg.a5.green, cfg.a5.amber) : 'empty') : (noneProb !== null ? statusFromPct(noneProb, 30, 20) : 'empty') },
      { label: 'Ranked picks', value: String(allFootballPicks.length), note: 'Across 1X2, DC, AH & Totals' },
      { label: 'Best-value EV', value: bestValuePick?.ev !== undefined ? `${round(bestValuePick.ev * 100, 1)}%` : '-', note: 'Margin read, not profit forecast' }
    ]
  };
}

/* ========================= BASKETBALL (MET) ========================= */

export function analyzeBasketball(scope: ScopeState): Analysis {
  const zone = 5;
  const strongSignal = 62;
  const modSignal = 56;
  const teamSumTight = 3;
  const teamSumStrong = 7;

  const total = bestExpectedLine(scope.markets.mainTotal?.pairs ?? [], zone);
  const p1 = bestExpectedLine(scope.markets.homeTotal?.pairs ?? [], zone);
  const p2 = bestExpectedLine(scope.markets.awayTotal?.pairs ?? [], zone);

  const ouPicks = [
    ...analyzeLines(scope.markets.mainTotal ?? { id: 'mainTotal', kind: 'ou', title: '' }),
    ...analyzeLines(scope.markets.homeTotal ?? { id: 'homeTotal', kind: 'ou', title: '' }),
    ...analyzeLines(scope.markets.awayTotal ?? { id: 'awayTotal', kind: 'ou', title: '' })
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  const hdp = scope.markets.handicap;
  const rankPicks = [
    ...(hdp ? analyzeHandicap(hdp, 'Team 1', 'Team 2') : []),
    ...analyzeOddsMarket(scope.markets.winner ?? { id: 'winner', kind: 'winner', title: '' }, { a: 'Team 1 Wins', b: 'Team 2 Wins' })
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  const allBasketballPicks = [...ouPicks, ...rankPicks].sort((a, b) => b.probability - a.probability);
  const primaryPicks = allBasketballPicks.filter((p) => p.marketId === 'mainTotal' || p.marketId === 'winner' || p.marketId === 'homeTotal' || p.marketId === 'awayTotal');
  const safestPick = topPick(primaryPicks) ?? topPick(allBasketballPicks);
  const bestValuePick = primaryPicks.filter((p) => p.probability >= 55).sort((a, b) => (b.ev ?? -99) - (a.ev ?? -99))[0] ?? topPick(allBasketballPicks);

  const combinedDiff = total && p1 && p2 ? round(p1.expected + p2.expected - total.expected, 1) : null;
  const paceProj = total ? round(scope.id === 'q1' ? total.expected * 4 : scope.id === 'h1' ? total.expected * 2 : total.expected, 1) : null;

  const underProb = total?.bestUnder ? (total.bestUnder as any).normUnder * 100 : null;
  const overProb = total?.bestOver ? (total.bestOver as any).normOver * 100 : null;

  const aChecks: Check[] = [
    {
      title: 'Best value-zone Under',
      detail: underProb === null ? 'Add lines around expected points mark' : `Under ${(total?.bestUnder as any)?.line} @ ${pct(underProb, 1)}`,
      status: underProb === null ? 'empty' : statusFromPct(underProb, strongSignal, modSignal)
    },
    {
      title: 'Team total sum consistency (TTC)',
      detail: combinedDiff === null ? 'Enter game + both team totals' : `Team sum diff: ${combinedDiff > 0 ? '+' : ''}${combinedDiff} pts`,
      status: combinedDiff === null ? 'empty' : combinedDiff < -teamSumStrong ? 'green' : combinedDiff < -teamSumTight ? 'amber' : 'red'
    },
    {
      title: 'Market expected points (MET)',
      detail: total ? `MET ${total.expected}${total.approx ? ' approx' : ''}` : 'Enter at least 1 complete O/U row',
      status: total ? 'green' : 'empty'
    },
    {
      title: 'Moneyline / Spread balance',
      detail: rankPicks[0] ? `${rankPicks[0].label} @ ${pct(rankPicks[0].probability, 1)}` : 'Add moneyline or spread',
      status: rankPicks[0] ? (rankPicks[0].probability >= 68 ? 'green' : rankPicks[0].probability >= 58 ? 'amber' : 'red') : 'empty'
    },
    {
      title: 'Specific line rank',
      detail: ouPicks[0] ? `${ouPicks[0].label} leads all O/U lines` : 'Add more line rows',
      status: ouPicks[0] ? statusFromPct(ouPicks[0].probability, 76, 60) : 'empty'
    }
  ];

  const bChecks: Check[] = [
    {
      title: 'Best value-zone Over',
      detail: overProb === null ? 'Add lines below expected points' : `Over ${(total?.bestOver as any)?.line} @ ${pct(overProb, 1)}`,
      status: overProb === null ? 'empty' : statusFromPct(overProb, strongSignal, modSignal)
    },
    {
      title: 'Team total sum consistency (TTC Over)',
      detail: combinedDiff === null ? 'Enter game + both team totals' : `Team sum diff: ${combinedDiff > 0 ? '+' : ''}${combinedDiff} pts`,
      status: combinedDiff === null ? 'empty' : combinedDiff > teamSumStrong ? 'green' : combinedDiff > teamSumTight ? 'amber' : 'red'
    },
    {
      title: 'Expected-line coverage',
      detail: `${ouPicks.length} O/U candidate sides ranked`,
      status: ouPicks.length >= 15 ? 'green' : ouPicks.length >= 9 ? 'amber' : ouPicks.length ? 'red' : 'empty'
    },
    {
      title: 'Result pressure (favourite check)',
      detail: rankPicks[0] ? `${rankPicks[0].label} @ ${pct(rankPicks[0].probability, 1)}` : 'Favourite pressure supports Over',
      status: rankPicks[0] ? statusFromPct(rankPicks[0].probability, 68, 58) : 'empty'
    },
    {
      title: 'Line-rank fallback',
      detail: ouPicks[0] ? `${ouPicks[0].label} @ ${pct(ouPicks[0].probability, 1)}` : 'Add more O/U lines',
      status: ouPicks[0] ? statusFromPct(ouPicks[0].probability, 76, 60) : 'empty'
    }
  ];

  const profiles = [
    profileFromChecks('A', 'Safest Selection — lowest margin read', aChecks, 0.72, 0.45, safestPick, 'Final Verdict'),
    profileFromChecks('B', 'Best Value — margin-cost ranking', bChecks, 0.72, 0.45, bestValuePick, 'Margin Rank'),
    profileFromChecks('C', 'Match-Shape Intelligence (Pace & Score-shape)', [], 0.72, 0.45, topPick(rankPicks), 'Shape Read'),
    profileFromChecks('D', 'All Markets Ranking', [], 0.72, 0.45, topPick(allBasketballPicks), 'All Markets')
  ];

  return {
    ...finishAnalysis(scope, profiles, allBasketballPicks, 76, 62),
    metrics: [
      { label: 'MET', value: total ? `${total.expected}${total.approx ? ' approx' : ''}` : '-', note: 'Market Expected Total Points', status: total ? ('green' as Status) : ('empty' as Status) },
      { label: 'Team sum diff (TTC)', value: combinedDiff === null ? '-' : `${combinedDiff > 0 ? '+' : ''}${combinedDiff}`, note: 'T1 MET + T2 MET vs Game MET', status: combinedDiff === null ? ('empty' as Status) : Math.abs(combinedDiff) <= teamSumTight ? ('green' as Status) : ('amber' as Status) },
      { label: 'Pace projection', value: paceProj ? `${paceProj} pts` : '-', note: scope.id === 'ft' ? 'Full time MET' : scope.id === 'h1' ? '1H MET × 2' : 'Q1 MET × 4', status: paceProj ? ('green' as Status) : ('empty' as Status) },
      { label: 'Ranked picks', value: String(allBasketballPicks.length), note: 'Across Moneyline, Spread & Totals' },
      { label: 'Best-value EV', value: bestValuePick?.ev !== undefined ? `${round(bestValuePick.ev * 100, 1)}%` : '-', note: 'Margin read, not profit forecast' }
    ]
  };
}

/* ========================= TENNIS (MEG & CSI) ========================= */

export function analyzeTennis(scope: ScopeState): Analysis {
  const zone = 2.5;
  const strongSignal = 61;
  const modSignal = 55;
  const teamSumTight = 1.5;

  const total = bestExpectedLine(scope.markets.mainTotal?.pairs ?? [], zone);
  const p1 = bestExpectedLine(scope.markets.homeTotal?.pairs ?? [], zone);
  const p2 = bestExpectedLine(scope.markets.awayTotal?.pairs ?? [], zone);

  const ouPicks = [
    ...analyzeLines(scope.markets.mainTotal ?? { id: 'mainTotal', kind: 'ou', title: '' }),
    ...analyzeLines(scope.markets.homeTotal ?? { id: 'homeTotal', kind: 'ou', title: '' }),
    ...analyzeLines(scope.markets.awayTotal ?? { id: 'awayTotal', kind: 'ou', title: '' })
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  const hdp1 = scope.markets.handicap;
  const hdp2 = scope.markets.setHandicap;
  const rankPicks = [
    ...(hdp1 ? analyzeHandicap(hdp1, 'Player 1', 'Player 2') : []),
    ...(hdp2 ? analyzeHandicap(hdp2, 'P1', 'P2') : []),
    ...analyzeOddsMarket(scope.markets.winner ?? { id: 'winner', kind: 'winner', title: '' }, { a: 'Player 1 Wins', b: 'Player 2 Wins' })
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  const combinedDiff = total && p1 && p2 ? round(p1.expected + p2.expected - total.expected, 1) : null;

  const tennisScores =
    scope.id === 's1'
      ? [...TENNIS_SET_SCORES]
      : scope.format === 'bo5'
      ? [...TENNIS_MATCH_SCORES_BO5]
      : [...TENNIS_MATCH_SCORES_BO3];
  const csPicks = analyzeOddsMarket(
    scope.markets.correctScore ?? { id: 'correctScore', kind: 'correctScore', title: '' },
    Object.fromEntries(tennisScores.map((s) => [s, s]))
  );

  const decisive = csPicks
    .filter((p) => ['2-0', '0-2', '3-0', '0-3', '6-0', '6-1', '6-2', '6-3', '0-6', '1-6', '2-6', '3-6'].includes(p.label))
    .reduce((s, p) => s + p.probability, 0);
  const competitive = csPicks
    .filter((p) => ['2-1', '1-2', '3-2', '2-3', '7-5', '5-7', '7-6', '6-7'].includes(p.label))
    .reduce((s, p) => s + p.probability, 0);
  const tiebreakCS = csPicks.filter((p) => ['7-6', '6-7'].includes(p.label)).reduce((s, p) => s + p.probability, 0);
  const sweep = csPicks.filter((p) => ['3-0', '0-3', '2-0', '0-2'].includes(p.label)).reduce((s, p) => s + p.probability, 0);
  const fourSet = csPicks.filter((p) => ['3-1', '1-3'].includes(p.label)).reduce((s, p) => s + p.probability, 0);
  const fiveSet = csPicks.filter((p) => ['3-2', '2-3'].includes(p.label)).reduce((s, p) => s + p.probability, 0);

  const tbDirect = scope.markets.tiebreak;
  const tbNorm = tbDirect ? normalizeTwo(tbDirect.odds?.yes, tbDirect.odds?.no) : null;
  const tbYesProb = tbNorm ? tbNorm.a : null;

  const allTennisPicks = [...ouPicks, ...rankPicks, ...csPicks].sort((a, b) => b.probability - a.probability);
  const primaryPicks = allTennisPicks.filter(
    (p) => p.marketId === 'mainTotal' || p.marketId === 'winner' || p.marketId === 'homeTotal' || p.marketId === 'awayTotal'
  );
  const safestPick = topPick(primaryPicks) ?? topPick(allTennisPicks);
  const bestValuePick =
    primaryPicks.filter((p) => p.probability >= 55).sort((a, b) => (b.ev ?? -99) - (a.ev ?? -99))[0] ?? topPick(allTennisPicks);
  const shapePick = topPick(csPicks.length ? csPicks : rankPicks);

  const underProb = total?.bestUnder ? (total.bestUnder as any).normUnder * 100 : null;
  const overProb = total?.bestOver ? (total.bestOver as any).normOver * 100 : null;

  const aChecks: Check[] = [
    {
      title: 'Best value-zone Under',
      detail: underProb === null ? 'Add lines around expected games mark' : `Under ${(total?.bestUnder as any)?.line} @ ${pct(underProb, 1)}`,
      status: underProb === null ? 'empty' : statusFromPct(underProb, strongSignal, modSignal)
    },
    {
      title: 'Correct-score decisiveness (CSI)',
      detail: csPicks.length ? `Decisive outcomes: ${pct(decisive, 1)}` : 'Add correct score for CSI read',
      status: csPicks.length ? statusFromPct(decisive, 55, 40) : 'empty'
    },
    {
      title: 'Market expected games (MEG)',
      detail: total ? `MEG ${total.expected}${total.approx ? ' approx' : ''}` : 'Enter at least 1 complete O/U row',
      status: total ? 'green' : 'empty'
    },
    {
      title: 'Result balance (tightness check)',
      detail: rankPicks[0] ? `${rankPicks[0].label} @ ${pct(rankPicks[0].probability, 1)}` : 'Add winner or handicap',
      status: rankPicks[0] ? (rankPicks[0].probability >= 65 ? 'green' : rankPicks[0].probability >= 58 ? 'amber' : 'red') : 'empty'
    },
    {
      title: 'Specific line fallback',
      detail: ouPicks[0] ? `${ouPicks[0].label} leads all O/U lines` : 'Add more line rows',
      status: ouPicks[0] ? statusFromPct(ouPicks[0].probability, 76, 60) : 'empty'
    }
  ];

  const bChecks: Check[] = [
    {
      title: 'Best value-zone Over',
      detail: overProb === null ? 'Add lines below expected games' : `Over ${(total?.bestOver as any)?.line} @ ${pct(overProb, 1)}`,
      status: overProb === null ? 'empty' : statusFromPct(overProb, strongSignal, modSignal)
    },
    {
      title: 'Competitive / tiebreak read',
      detail: csPicks.length ? `Competitive ${pct(competitive, 1)} · tiebreak ${pct(tiebreakCS, 1)}` : 'Add correct score for CSI read',
      status: csPicks.length ? (competitive >= 45 || tiebreakCS >= 22 ? 'green' : competitive >= 30 || tiebreakCS >= 14 ? 'amber' : 'red') : 'empty'
    },
    {
      title: 'Expected-line coverage',
      detail: `${ouPicks.length} O/U candidate sides ranked`,
      status: ouPicks.length >= 15 ? 'green' : ouPicks.length >= 9 ? 'amber' : ouPicks.length ? 'red' : 'empty'
    },
    {
      title: 'Result pressure (favourite check)',
      detail: rankPicks[0] ? `${rankPicks[0].label} @ ${pct(rankPicks[0].probability, 1)}` : 'Favourite pressure supports Over',
      status: rankPicks[0] ? (rankPicks[0].probability <= 58 ? 'green' : rankPicks[0].probability <= 65 ? 'amber' : 'red') : 'empty'
    },
    {
      title: 'Direct tiebreak market',
      detail: tbYesProb !== null ? `Direct TB Yes: ${pct(tbYesProb, 1)}` : 'Add tiebreak Yes/No odds',
      status: tbYesProb !== null ? statusFromPct(tbYesProb, 22, 14) : 'empty'
    }
  ];

  const profiles = [
    profileFromChecks('A', 'Safest Selection — lowest margin read', aChecks, 0.72, 0.45, safestPick, 'Final Verdict'),
    profileFromChecks('B', 'Best Value — margin-cost ranking', bChecks, 0.72, 0.45, bestValuePick, 'Margin Rank'),
    profileFromChecks('C', 'Match-Shape Intelligence (CSI & Set-shape)', [], 0.72, 0.45, shapePick, 'Shape Read'),
    profileFromChecks('D', 'All Markets Ranking', [], 0.72, 0.45, topPick(allTennisPicks), 'All Markets')
  ];

  const extraMetrics = csPicks.length
    ? [
        { label: 'CSI sweep', value: pct(sweep, 1), note: 'Match ends 2-0/0-2 or 3-0/0-3', status: statusFromPct(sweep, 40, 25) as Status },
        { label: 'CSI 4-set', value: pct(fourSet, 1), note: 'Bo5 only: 3-1/1-3', status: (fourSet > 0 ? 'green' : 'empty') as Status },
        { label: 'CSI 5-set', value: pct(fiveSet, 1), note: 'Bo5 only: 3-2/2-3', status: (fiveSet > 0 ? 'green' : 'empty') as Status },
        { label: 'CSI tiebreak', value: pct(tiebreakCS, 1), note: 'From correct-score grid', status: statusFromPct(tiebreakCS, 22, 14) as Status }
      ]
    : [];

  return {
    ...finishAnalysis(scope, profiles, allTennisPicks, 76, 62),
    metrics: [
      { label: 'MEG', value: total ? `${total.expected}${total.approx ? ' approx' : ''}` : '-', note: 'Market Expected Games', status: total ? ('green' as Status) : ('empty' as Status) },
      { label: 'P1+P2 diff (PGD)', value: combinedDiff === null ? '-' : `${combinedDiff > 0 ? '+' : ''}${combinedDiff}`, note: 'P1 MEG + P2 MEG vs Match MEG', status: combinedDiff === null ? ('empty' as Status) : Math.abs(combinedDiff) <= teamSumTight ? ('green' as Status) : ('amber' as Status) },
      ...extraMetrics
    ]
  };
}

/* ========================= RALLY / TABLE TENNIS ========================= */

export function analyzeRally(scope: ScopeState): Analysis {
  const allPicks = Object.values(scope.markets)
    .flatMap((market) => {
      if (market.kind === 'ou') return analyzeLines(market);
      if (market.kind === 'handicap') return analyzeHandicap(market, 'Player A', 'Player B');
      if (market.kind === 'winner') return analyzeOddsMarket(market, { a: 'Player A Wins', b: 'Player B Wins' });
      if (market.kind === 'threeway') return analyzeOddsMarket(market, { home: 'Home', draw: 'Draw', away: 'Away' });
      if (market.kind === 'yesno') return analyzeOddsMarket(market, { yes: 'Yes', no: 'No' });
      if (market.kind === 'correctScore') return analyzeOddsMarket(market, Object.fromEntries(RALLY_SCORES.map((s) => [s, s])));
      return [];
    })
    .map(withEv)
    .sort((a, b) => b.probability - a.probability);

  const primary = allPicks.filter((pick) => scope.markets[pick.marketId]?.primary);
  const safest = topPick(primary) ?? topPick(allPicks);
  const bestValue = primary.filter((p) => p.probability >= 55).sort((a, b) => (b.ev ?? -99) - (a.ev ?? -99))[0] ?? topPick(allPicks);

  const cs = analyzeOddsMarket(scope.markets.correctScore ?? { id: 'correctScore', kind: 'correctScore', title: '' }, Object.fromEntries(RALLY_SCORES.map((s) => [s, s])));
  const sweep = cs.filter((p) => p.label === '3-0' || p.label === '0-3').reduce((s, p) => s + p.probability, 0);
  const fourSet = cs.filter((p) => p.label === '3-1' || p.label === '1-3').reduce((s, p) => s + p.probability, 0);
  const fiveSet = cs.filter((p) => p.label === '3-2' || p.label === '2-3').reduce((s, p) => s + p.probability, 0);

  const tsPicks = analyzeLines(scope.markets.totalSets ?? { id: 'totalSets', kind: 'ou', title: '' });
  const tsU35 = tsPicks.find((p) => p.label === 'Under 3.5');
  const setsLean = topPick(tsPicks) ?? topPick(cs);

  const checks: Check[] = [
    {
      title: 'Safest primary-market pick',
      detail: safest ? `${safest.marketTitle}: ${safest.label} @ ${pct(safest.probability, 1)}` : 'Enter any of the primary markets',
      status: safest ? statusFromPct(safest.probability, 70, 58) : 'empty'
    },
    {
      title: 'Lowest-vig 55%+ candidate',
      detail: bestValue ? `${bestValue.label} EV ${(bestValue.ev! * 100).toFixed(1)}% (margin read)` : 'Needs a 55%+ primary candidate',
      status: bestValue ? statusFromPct(bestValue.probability, 65, 55) : 'empty'
    },
    {
      title: 'Correct score coverage',
      detail: `${cs.length}/6 CS outcomes entered`,
      status: cs.length >= 6 ? 'green' : cs.length >= 3 ? 'amber' : cs.length ? 'red' : 'empty'
    },
    {
      title: 'Sweep ↔ Total Sets consistency',
      detail: tsU35 ? `CS sweep ${pct(sweep, 1)} vs TS U3.5 ${pct(tsU35.probability, 1)}` : 'Enter Under/Over 3.5 to cross-check',
      status: tsU35 ? (Math.abs(tsU35.probability - sweep) < 15 ? 'green' : 'amber') : 'empty'
    },
    {
      title: 'Market inventory depth',
      detail: `${allPicks.length} candidate sides ranked across all markets`,
      status: allPicks.length >= 20 ? 'green' : allPicks.length >= 10 ? 'amber' : allPicks.length ? 'red' : 'empty'
    }
  ];

  const profiles = [
    profileFromChecks('A', 'Safest Selection — lowest margin read', checks, 0.72, 0.45, safest, 'Final Verdict'),
    profileFromChecks('B', 'Best Value — margin-cost ranking', [], 0.72, 0.45, bestValue, 'Margin Rank'),
    profileFromChecks('C', 'Match-Shape Intelligence (4/5 set etc.)', [], 0.72, 0.45, setsLean, 'Shape Read'),
    profileFromChecks('D', 'All Markets Ranking', [], 0.72, 0.45, topPick(allPicks), 'All Markets')
  ];

  return {
    ...finishAnalysis(scope, profiles, allPicks, 76, 62),
    metrics: [
      { label: 'Sweep chance', value: cs.length ? pct(sweep, 1) : '-', note: 'CS 3-0 / 0-3', status: statusFromPct(sweep, 40, 25) },
      { label: '4-set (3-1/1-3)', value: cs.length ? pct(fourSet, 1) : '-', note: '', status: fourSet > 0 ? ('green' as Status) : ('empty' as Status) },
      { label: '5-set (3-2/2-3)', value: cs.length ? pct(fiveSet, 1) : '-', note: '', status: fiveSet > 0 ? ('green' as Status) : ('empty' as Status) },
      { label: 'Ranked picks', value: String(allPicks.length), note: 'Across FM + 1st set' },
      { label: 'Best-value EV', value: bestValue?.ev ? `${round(bestValue.ev * 100, 1)}%` : '-', note: 'Margin read, not profit forecast' }
    ]
  };
}

/* ========================= ICE HOCKEY ENGINE ========================= */

export function analyzeHockey(scope: ScopeState): Analysis {
  const isRT = scope.id === 'rt';
  const zone = 1.0;
  const strongSignal = 64;
  const modSignal = 56;
  const teamSumTight = 1.0;
  const teamSumStrong = 2.5;

  const total = bestExpectedLine(scope.markets.mainTotal?.pairs ?? [], zone);
  const p1 = bestExpectedLine(scope.markets.homeTotal?.pairs ?? [], zone);
  const p2 = bestExpectedLine(scope.markets.awayTotal?.pairs ?? [], zone);

  const ouPicks = [
    ...analyzeLines(scope.markets.mainTotal ?? { id: 'mainTotal', kind: 'ou', title: '' }),
    ...analyzeLines(scope.markets.homeTotal ?? { id: 'homeTotal', kind: 'ou', title: '' }),
    ...analyzeLines(scope.markets.awayTotal ?? { id: 'awayTotal', kind: 'ou', title: '' })
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  const hdp = scope.markets.handicap;
  const resultPicks = analyzeOddsMarket(scope.markets.result ?? { id: 'result', kind: 'threeway', title: '' }, {
    home: 'Home Win (Reg)',
    draw: 'Draw (Overtime)',
    away: 'Away Win (Reg)'
  });
  const mlPicks = isRT
    ? analyzeOddsMarket(scope.markets.moneyline ?? { id: 'moneyline', kind: 'winner', title: '' }, {
        a: 'Home Win (incl. OT)',
        b: 'Away Win (incl. OT)'
      })
    : [];

  const rankPicks = [
    ...(hdp ? analyzeHandicap(hdp, 'Team 1', 'Team 2') : []),
    ...resultPicks,
    ...mlPicks,
    ...(isRT
      ? analyzeOddsMarket(scope.markets.doubleChance ?? { id: 'doubleChance', kind: 'threeway', title: '' }, {
          hd: 'Home or Draw',
          ha: 'Home or Away',
          da: 'Draw or Away'
        })
      : [])
  ].map(withEv).sort((a, b) => b.probability - a.probability);

  // Overtime Intelligence
  const regDrawPick = resultPicks.find((p) => p.label.includes('Draw'));
  const pOT = regDrawPick ? regDrawPick.probability : null;
  const ml1Norm = mlPicks.find((p) => p.label.includes('Home'))?.probability ?? null;
  const regHomeProb = resultPicks.find((p) => p.label.includes('Home'))?.probability ?? null;
  let otSplitDev: number | null = null;
  if (isRT && pOT !== null && regHomeProb !== null && ml1Norm !== null) {
    const expectedML1 = regHomeProb + pOT / 2;
    otSplitDev = round(Math.abs(ml1Norm - expectedML1), 1);
  }

  // Correct Score Reconciliation
  const csKeys = isRT ? HOCKEY_SCORES_RT : HOCKEY_SCORES_P1;
  const csPicks = analyzeOddsMarket(
    scope.markets.correctScore ?? { id: 'correctScore', kind: 'correctScore', title: '' },
    Object.fromEntries(csKeys.map((s) => [s, s]))
  );

  let oddProb = 0;
  let bttsProb = 0;
  let shutoutProb = 0;
  let csT1xG = 0;
  let csT2xG = 0;

  if (csPicks.length) {
    csPicks.forEach((p) => {
      const parts = p.label.split('-').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const h = parts[0];
        const a = parts[1];
        if ((h + a) % 2 !== 0) oddProb += p.probability;
        if (h > 0 && a > 0) bttsProb += p.probability;
        if (h === 0 || a === 0) shutoutProb += p.probability;
        csT1xG += (p.probability / 100) * h;
        csT2xG += (p.probability / 100) * a;
      }
    });
  }

  const bttsDirect = scope.markets.btts ? analyzeOddsMarket(scope.markets.btts, { yes: 'BTTS Yes', no: 'BTTS No' }) : [];
  const directBttsYes = bttsDirect.find((p) => p.label === 'BTTS Yes')?.probability ?? null;

  const combinedDiff = total && p1 && p2 ? round(p1.expected + p2.expected - total.expected, 1) : null;
  const underProb = total?.bestUnder ? (total.bestUnder as any).normUnder * 100 : null;
  const overProb = total?.bestOver ? (total.bestOver as any).normOver * 100 : null;

  // Empty-net reversal balance check: lopsided moneyline (>66%) favours Over, tight moneyline (<58%) favours Under
  const topResultProb = rankPicks[0]?.probability ?? 50;
  const emptyNetOverSupport = topResultProb >= 66;
  const tightUnderSupport = topResultProb <= 58;

  const aChecks: Check[] = [
    {
      title: 'Best value-zone Under',
      detail: underProb === null ? 'Add lines around expected goals mark' : `Under ${(total?.bestUnder as any)?.line} @ ${pct(underProb, 1)}`,
      status: underProb === null ? 'empty' : statusFromPct(underProb, strongSignal, modSignal)
    },
    {
      title: 'Low-scoring correct scores / Shutout',
      detail: csPicks.length ? `Shutout probability: ${pct(shutoutProb, 1)}` : 'Add correct score grid for CS read',
      status: csPicks.length ? statusFromPct(shutoutProb, 15, 10) : 'empty'
    },
    {
      title: 'Team Goal Differential (TGD Under)',
      detail: combinedDiff === null ? 'Enter game + team totals' : `TGD: ${combinedDiff > 0 ? '+' : ''}${combinedDiff} goals`,
      status: combinedDiff === null ? 'empty' : combinedDiff < -teamSumStrong ? 'green' : combinedDiff < -teamSumTight ? 'amber' : 'red'
    },
    {
      title: 'Market Expected Goals (MEG)',
      detail: total ? `MEG ${total.expected}${total.approx ? ' approx' : ''} goals` : 'Enter O/U lines',
      status: total ? 'green' : 'empty'
    },
    {
      title: 'Moneyline balance (Tight game Under support)',
      detail: rankPicks[0] ? `${rankPicks[0].label} @ ${pct(rankPicks[0].probability, 1)}` : 'Add Moneyline / 1X2',
      status: rankPicks[0] ? (tightUnderSupport ? 'green' : topResultProb <= 64 ? 'amber' : 'red') : 'empty'
    },
    {
      title: '🏒 Shutout Risk (CS Reconciliation)',
      detail: csPicks.length ? `Reconstructed Shutout: ${pct(shutoutProb, 1)}` : 'Requires 4+ CS cells',
      status: csPicks.length ? (shutoutProb >= 15 ? 'green' : shutoutProb >= 10 ? 'amber' : 'red') : 'empty'
    }
  ];

  const bChecks: Check[] = [
    {
      title: 'Best value-zone Over',
      detail: overProb === null ? 'Add lines below expected goals mark' : `Over ${(total?.bestOver as any)?.line} @ ${pct(overProb, 1)}`,
      status: overProb === null ? 'empty' : statusFromPct(overProb, strongSignal, modSignal)
    },
    {
      title: 'Team Goal Differential (TGD Over)',
      detail: combinedDiff === null ? 'Enter game + team totals' : `TGD: ${combinedDiff > 0 ? '+' : ''}${combinedDiff} goals`,
      status: combinedDiff === null ? 'empty' : combinedDiff > teamSumStrong ? 'green' : combinedDiff > teamSumTight ? 'amber' : 'red'
    },
    {
      title: 'Empty-net goal risk (Lopsided Moneyline)',
      detail: rankPicks[0] ? `${rankPicks[0].label} @ ${pct(rankPicks[0].probability, 1)}` : 'Lopsided fav raises empty-net risk',
      status: rankPicks[0] ? (emptyNetOverSupport ? 'green' : topResultProb >= 60 ? 'amber' : 'red') : 'empty'
    },
    {
      title: 'BTTS / High-score support',
      detail: directBttsYes !== null ? `BTTS Yes @ ${pct(directBttsYes, 1)}` : csPicks.length ? `CS BTTS @ ${pct(bttsProb, 1)}` : 'Add BTTS or CS',
      status: directBttsYes !== null ? statusFromPct(directBttsYes, 60, 52) : csPicks.length ? statusFromPct(bttsProb, 60, 52) : 'empty'
    },
    {
      title: 'Expected-line coverage',
      detail: `${ouPicks.length} goal candidate sides ranked`,
      status: ouPicks.length >= 10 ? 'green' : ouPicks.length >= 5 ? 'amber' : 'empty'
    }
  ];

  const allHockeyPicks = [...ouPicks, ...rankPicks, ...csPicks].sort((a, b) => b.probability - a.probability);
  const primaryPicks = allHockeyPicks.filter(
    (p) => p.marketId === 'mainTotal' || p.marketId === 'result' || p.marketId === 'moneyline'
  );
  const safestPick = topPick(primaryPicks) ?? topPick(allHockeyPicks);
  const bestValuePick =
    primaryPicks.filter((p) => p.probability >= 55).sort((a, b) => (b.ev ?? -99) - (a.ev ?? -99))[0] ?? topPick(allHockeyPicks);
  const shapePick = topPick(csPicks.length ? csPicks : rankPicks);

  const profiles = [
    profileFromChecks('A', 'Safest Selection — lowest margin read', aChecks, 0.72, 0.45, safestPick, 'Final Verdict'),
    profileFromChecks('B', 'Best Value — margin-cost ranking', bChecks, 0.72, 0.45, bestValuePick, 'Margin Rank'),
    profileFromChecks('C', 'Match-Shape Intelligence (OT & CS Reconciliation)', [], 0.72, 0.45, shapePick, 'Shape Read'),
    profileFromChecks('D', 'All Markets Ranking', [], 0.72, 0.45, topPick(allHockeyPicks), 'All Markets')
  ];

  const hockeyMetrics = [
    { label: 'MEG', value: total ? `${total.expected}${total.approx ? ' approx' : ''}` : '-', note: 'Market Expected Goals', status: total ? ('green' as Status) : ('empty' as Status) },
    { label: 'TGD', value: combinedDiff === null ? '-' : `${combinedDiff > 0 ? '+' : ''}${combinedDiff}`, note: 'T1 MEG + T2 MEG vs Game MEG', status: combinedDiff === null ? ('empty' as Status) : Math.abs(combinedDiff) <= teamSumTight ? ('green' as Status) : ('amber' as Status) },
    ...(isRT
      ? [
          { label: 'OT Prob P(OT)', value: pOT !== null ? pct(pOT, 1) : '-', note: 'From 1X2 draw price (NHL avg ~24%)', status: pOT !== null ? (pOT >= 24 ? ('green' as Status) : ('amber' as Status)) : ('empty' as Status) },
          { label: 'OT Split Dev', value: otSplitDev !== null ? `${otSplitDev} pts` : '-', note: '1X2 vs Moneyline consistency', status: otSplitDev !== null ? (otSplitDev < 3 ? ('green' as Status) : otSplitDev < 6 ? ('amber' as Status) : ('red' as Status)) : ('empty' as Status) }
        ]
      : []),
    { label: 'CS Shutout Risk', value: csPicks.length ? pct(shutoutProb, 1) : '-', note: 'From correct score grid', status: csPicks.length ? (shutoutProb >= 15 ? ('green' as Status) : ('empty' as Status)) : ('empty' as Status) }
  ];

  return {
    ...finishAnalysis(scope, profiles, allHockeyPicks, 75, 60),
    metrics: hockeyMetrics
  };
}

/* ========================= MASTER MODEL CONFLUENCE LEDGER ========================= */

export function buildConfluenceLedger(
  sportId: SportId,
  currentScope: ScopeState,
  allScopes: ScopeState[]
): MasterConfluenceLedger | null {
  const currentAnalysis =
    sportId === 'football'
      ? analyzeFootball(currentScope)
      : sportId === 'basketball'
      ? analyzeBasketball(currentScope)
      : sportId === 'tennis'
      ? analyzeTennis(currentScope)
      : sportId === 'rally'
      ? analyzeRally(currentScope)
      : analyzeHockey(currentScope);

  const safest = currentAnalysis.profiles.find((p) => p.key === 'A')?.top ?? currentAnalysis.picks[0];
  if (!safest) return null;

  const candidateLabel = safest.label;
  const marketProbability = round(safest.probability, 1);
  const bookmakerMargin = typeof safest.margin === 'number' ? round(safest.margin, 1) : null;

  const rows: LedgerRow[] = [];
  const missingFields: string[] = [];
  let conflictReason: string | undefined = undefined;

  const isOver = candidateLabel.toLowerCase().includes('over');
  const isUnder = candidateLabel.toLowerCase().includes('under');

  // Row 1: Primary Scope Verdict
  const primaryProfile = currentAnalysis.profiles.find((p) => p.key === 'A' || p.key === 'B');
  if (primaryProfile && primaryProfile.completed >= 2) {
    const isPrimaryAgree =
      (isOver && primaryProfile.key === 'B' && primaryProfile.ratio >= 0.55) ||
      (isUnder && primaryProfile.key === 'A' && primaryProfile.ratio >= 0.55);
    rows.push({
      name: 'Primary Scope Verdict',
      vote: isPrimaryAgree ? 'Agree' : 'N/A',
      detail: `${currentScope.title} profile score ${round(primaryProfile.ratio * 100, 0)}% (${primaryProfile.status})`
    });
  } else {
    rows.push({
      name: 'Primary Scope Verdict',
      vote: 'N/A',
      detail: 'Insufficient primary market inputs entered'
    });
    missingFields.push('Primary market odds (O/U or Result)');
  }

  // Row 2: Cross-Scope Verdict
  const otherScope = allScopes.find((s) => s.id !== currentScope.id);
  if (otherScope) {
    const otherAnalysis =
      sportId === 'football'
        ? analyzeFootball(otherScope)
        : sportId === 'basketball'
        ? analyzeBasketball(otherScope)
        : sportId === 'tennis'
        ? analyzeTennis(otherScope)
        : sportId === 'rally'
        ? analyzeRally(otherScope)
        : analyzeHockey(otherScope);

    const otherTop = otherAnalysis.picks[0];
    if (otherTop) {
      const otherIsOver = otherTop.label.toLowerCase().includes('over');
      const otherIsUnder = otherTop.label.toLowerCase().includes('under');
      if ((isOver && otherIsOver) || (isUnder && otherIsUnder)) {
        rows.push({
          name: 'Cross-Scope Verdict',
          vote: 'Agree',
          detail: `${otherScope.title} leads ${otherTop.label} (${pct(otherTop.probability, 1)})`
        });
      } else if ((isOver && otherIsUnder) || (isUnder && otherIsOver)) {
        rows.push({
          name: 'Cross-Scope Verdict',
          vote: 'Disagree',
          detail: `${otherScope.title} opposes with ${otherTop.label} (${pct(otherTop.probability, 1)})`
        });
        conflictReason = `${currentScope.title} (${candidateLabel}) conflicts with ${otherScope.title} (${otherTop.label})`;
      } else {
        rows.push({
          name: 'Cross-Scope Verdict',
          vote: 'N/A',
          detail: `${otherScope.title} top pick neutral: ${otherTop.label}`
        });
      }
    } else {
      rows.push({ name: 'Cross-Scope Verdict', vote: 'N/A', detail: `${otherScope.title} not populated` });
      missingFields.push(`${otherScope.title} odds`);
    }
  } else {
    rows.push({ name: 'Cross-Scope Verdict', vote: 'N/A', detail: 'Single scope screener' });
  }

  // Row 3: Cross-Market Consistency Verdict
  if (sportId === 'football') {
    const bttsMarket = currentScope.markets.btts;
    if (bttsMarket && bttsMarket.odds?.yes && bttsMarket.odds?.no) {
      const bttsNorm = normalizeTwo(bttsMarket.odds.yes, bttsMarket.odds.no);
      if (bttsNorm) {
        if (bttsNorm.a >= 60 && isOver) {
          rows.push({ name: 'Cross-Market Consistency', vote: 'Agree', detail: `BTTS Yes ${pct(bttsNorm.a, 1)} >= 60% supports Over` });
        } else if (bttsNorm.b >= 60 && isUnder) {
          rows.push({ name: 'Cross-Market Consistency', vote: 'Agree', detail: `BTTS No ${pct(bttsNorm.b, 1)} >= 60% supports Under` });
        } else if (bttsNorm.a >= 60 && isUnder) {
          rows.push({ name: 'Cross-Market Consistency', vote: 'Disagree', detail: `BTTS Yes ${pct(bttsNorm.a, 1)} >= 60% opposes Under` });
          conflictReason = conflictReason || `BTTS Yes (${pct(bttsNorm.a, 1)}) opposes ${candidateLabel}`;
        } else {
          rows.push({ name: 'Cross-Market Consistency', vote: 'N/A', detail: `BTTS Yes/No balanced (${pct(bttsNorm.a, 1)} / ${pct(bttsNorm.b, 1)})` });
        }
      } else {
        rows.push({ name: 'Cross-Market Consistency', vote: 'N/A', detail: 'BTTS market not entered' });
        missingFields.push('BTTS Yes/No odds');
      }
    } else {
      rows.push({ name: 'Cross-Market Consistency', vote: 'N/A', detail: 'BTTS market not entered' });
      missingFields.push('BTTS Yes/No odds');
    }
  } else if (sportId === 'basketball' || sportId === 'tennis' || sportId === 'hockey') {
    const ttcMetric = currentAnalysis.metrics.find((m) => m.label.includes('diff') || m.label.includes('TGD') || m.label.includes('MET'));
    if (ttcMetric && ttcMetric.value !== '-') {
      rows.push({ name: 'Cross-Market Consistency', vote: 'Agree', detail: `${ttcMetric.label}: ${ttcMetric.value}` });
    } else {
      rows.push({ name: 'Cross-Market Consistency', vote: 'N/A', detail: 'Team Totals + Game Total incomplete' });
      missingFields.push('Both Team Total lines & odds');
    }
  } else {
    rows.push({ name: 'Cross-Market Consistency', vote: 'N/A', detail: 'Multi-market candidate consistency' });
  }

  // Row 4: Structural / Scoreline Verdict
  const csMetric = currentAnalysis.metrics.find((m) => m.label.includes('cluster') || m.label.includes('CSI') || m.label.includes('Sweep') || m.label.includes('Shutout'));
  if (csMetric && csMetric.value !== '-') {
    rows.push({ name: 'Structural / Scoreline Verdict', vote: 'Agree', detail: `${csMetric.label}: ${csMetric.value}` });
  } else {
    rows.push({ name: 'Structural / Scoreline Verdict', vote: 'N/A', detail: 'Correct score grid not filled' });
    missingFields.push('Correct Score grid cells');
  }

  // Row 5: Ranking Corroboration
  const topRanked = currentAnalysis.picks[0];
  if (topRanked) {
    const rankAgree = topRanked.label === candidateLabel || (isOver && topRanked.label.toLowerCase().includes('over')) || (isUnder && topRanked.label.toLowerCase().includes('under'));
    rows.push({
      name: 'Ranking Corroboration',
      vote: rankAgree ? 'Agree' : 'N/A',
      detail: `Top market rank: ${topRanked.label} @ ${pct(topRanked.probability, 1)}`
    });
  } else {
    rows.push({ name: 'Ranking Corroboration', vote: 'N/A', detail: 'No market ranking available' });
  }

  const agreeCount = rows.filter((r) => r.vote === 'Agree').length;
  const disagreeCount = rows.filter((r) => r.vote === 'Disagree').length;
  const naCount = rows.filter((r) => r.vote === 'N/A').length;

  let tier: ConfluenceTier = 'No Read';
  if (disagreeCount >= 1) {
    tier = 'Tier 3 — Conflicted';
  } else if (agreeCount >= 3) {
    tier = 'Tier 1 — High Confluence';
  } else if (agreeCount === 2) {
    tier = 'Tier 2 — Moderate Confluence';
  } else if (agreeCount <= 1 && agreeCount > 0) {
    tier = 'Tier 3 — Single-Angle';
  } else {
    tier = 'No Read';
  }

  return {
    candidateLabel,
    marketProbability,
    bookmakerMargin,
    rows,
    agreeCount,
    disagreeCount,
    naCount,
    tier,
    conflictReason,
    missingFields
  };
}

export function sortCandidatesByTierAndProbability(picks: Pick[], ledger: MasterConfluenceLedger | null): Pick[] {
  if (!ledger) return picks;
  return picks
    .map((p) => ({
      ...p,
      confluenceTier: p.label === ledger.candidateLabel ? ledger.tier : ('Tier 3 — Single-Angle' as ConfluenceTier)
    }))
    .sort((a, b) => {
      const tierOrder: Record<ConfluenceTier, number> = {
        'Tier 1 — High Confluence': 4,
        'Tier 2 — Moderate Confluence': 3,
        'Tier 3 — Single-Angle': 2,
        'Tier 3 — Conflicted': 1,
        'No Read': 0
      };
      const tA = tierOrder[a.confluenceTier ?? 'Tier 3 — Single-Angle'];
      const tB = tierOrder[b.confluenceTier ?? 'Tier 3 — Single-Angle'];
      if (tA !== tB) return tB - tA;
      if (Math.abs(b.probability - a.probability) > 0.1) return b.probability - a.probability;
      return (a.margin ?? 99) - (b.margin ?? 99);
    });
}

/* ========================= FINISHER ========================= */

function finishAnalysis(scope: ScopeState, profiles: Profile[], picks: Pick[], rankGreen: number, rankAmber: number): Analysis {
  const a = profiles.find((p) => p.key === 'A');
  const b = profiles.find((p) => p.key === 'B');
  const c = profiles.find((p) => p.key === 'C');
  const d = profiles.find((p) => p.key === 'D');

  let headline = 'Pick a market line and decimal odds below. A recommendation will build here.';
  if ((a?.completed ?? 0) >= 2 || (b?.completed ?? 0) >= 2 || c?.top || d?.top) {
    if (a && b && ((a.completed >= 2 && a.ratio >= 0.72) || (b.completed >= 2 && b.ratio >= 0.72))) {
      const winner = a.ratio >= b.ratio ? a : b;
      headline = `${scope.title}: ${winner.title} — leading fit ${round(winner.ratio * 100, 0)}%.`;
    } else if (d?.top && d.top.probability >= rankGreen) {
      headline = `${scope.title}: ${d.top.label} stands out (${d.top.marketTitle}) @ ${pct(d.top.probability, 1)}`;
    } else if (c?.top && c.top.probability >= rankGreen) {
      headline = `${scope.title}: ${c.top.label} stands out (${c.top.marketTitle}) @ ${pct(c.top.probability, 1)}`;
    } else {
      const best = topPick(picks);
      headline = best
        ? `${scope.title}: no strong profile yet. Current best: ${best.label} @ ${pct(best.probability, 1)}.`
        : `${scope.title}: add more odds or consider skipping.`;
    }
  }

  return {
    headline,
    chips: profiles.map((p) => ({
      label: p.tag ?? p.key,
      value: p.top ? pct(p.top.probability, 0) : p.completed ? `${round(p.ratio * 100, 0)}%` : '-',
      status: p.top ? statusFromPct(p.top.probability, rankGreen, rankAmber) : p.status
    })),
    profiles,
    picks: picks.sort((a, b) => b.probability - a.probability).slice(0, 20),
    metrics: []
  };
}

/* ========================= SCOPE FACTORIES ========================= */

const OU_LINE_COUNT = 11;

const footballLines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5];
const footballHomeAwayLines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5];

export function createFootballScope(id: 'h1' | 'h2' | 'ft', title: string): ScopeState {
  const state: ScopeState = {
    id,
    title,
    leaguePreset: 'balanced',
    markets: {
      mainTotal: market('mainTotal', 'Match Total Goals', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, footballLines) }),
      homeTotal: market('homeTotal', 'Home Team Total Goals', 'ou', { pairs: emptyPairs(OU_LINE_COUNT, footballHomeAwayLines) }),
      awayTotal: market('awayTotal', 'Away Team Total Goals', 'ou', { pairs: emptyPairs(OU_LINE_COUNT, footballHomeAwayLines) }),
      result: market('result', '1X2 Result', 'threeway', { primary: true, odds: oddsMap(['home', 'draw', 'away']) }),
      doubleChance: market('doubleChance', 'Double Chance', 'threeway', { odds: oddsMap(['hd', 'ha', 'da']) }),
      handicap: market('handicap', 'Asian Handicap', 'handicap', { handicapPairs: emptyHandicaps(7, [-2.5, -1.5, -0.5, 0, 0.5, 1.5, 2.5]) }),
      correctScore: market('correctScore', 'Correct Score Grid (9 cells)', 'correctScore', { odds: oddsMap(FOOTBALL_SCORES) })
    }
  };
  if (id === 'ft') {
    state.markets.btts = market('btts', 'BTTS / Goal Goal', 'yesno', { odds: oddsMap(['yes', 'no']) });
  } else {
    state.markets.noneOdds = market('noneOdds', '"None" (no goal in half)', 'yesno', { odds: oddsMap(['none', 'goal']) });
  }
  return state;
}

export function createFootballScopes(): ScopeState[] {
  return [createFootballScope('h1', '1st Half'), createFootballScope('h2', '2nd Half'), createFootballScope('ft', 'Full Time')];
}

export function createMetScope(id: string, title: string, sport: 'basketball' | 'tennis'): ScopeState {
  const isTennis = sport === 'tennis';
  let mainLines: number[];
  let playerLines: number[];
  if (isTennis) {
    mainLines = id === 's1' ? range(5.5, 15.5, 1) : range(16.5, 40.5, 2.5);
    playerLines = id === 's1' ? range(2.5, 12.5, 1) : range(5.5, 25.5, 2);
  } else {
    mainLines = id === 'q1' ? range(30.5, 60.5, 3) : id === 'h1' ? range(72.5, 122.5, 5) : range(140.5, 240.5, 10);
    playerLines = id === 'q1' ? range(6.5, 28.5, 2.2) : id === 'h1' ? range(30.5, 66.5, 3.6) : range(60.5, 126.5, 6.6);
  }
  const mainLines11 = mainLines.slice(0, OU_LINE_COUNT);
  while (mainLines11.length < OU_LINE_COUNT) {
    const last = mainLines11.length ? mainLines11[mainLines11.length - 1] : 10;
    mainLines11.push(round(last + (isTennis ? 1 : 5), 1));
  }
  const playerLines11 = playerLines.slice(0, OU_LINE_COUNT);
  while (playerLines11.length < OU_LINE_COUNT) {
    const last = playerLines11.length ? playerLines11[playerLines11.length - 1] : 10;
    playerLines11.push(round(last + (isTennis ? 0.5 : 2), 1));
  }
  const playerLines11offset = playerLines.slice(
    Math.max(0, Math.floor(playerLines.length / 2) - 5),
    Math.max(0, Math.floor(playerLines.length / 2) - 5 + OU_LINE_COUNT)
  );
  while (playerLines11offset.length < OU_LINE_COUNT) {
    const last = playerLines11offset.length ? playerLines11offset[playerLines11offset.length - 1] : 10;
    playerLines11offset.push(round(last + (isTennis ? 0.5 : 2), 1));
  }
  const csKeys = isTennis ? (id === 's1' ? TENNIS_SET_SCORES : id === 'rt' ? TENNIS_MATCH_SCORES_BO3 : TENNIS_MATCH_SCORES_BO5) : [];
  const state: ScopeState = {
    id,
    title,
    ...(isTennis ? { surface: 'hard', format: 'bo3' } : {}),
    markets: {
      mainTotal: market('mainTotal', isTennis ? 'Total Games' : 'Game Total Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, mainLines11) }),
      homeTotal: market('homeTotal', isTennis ? 'Player 1 Total Games' : 'Team 1 Total Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, playerLines11) }),
      awayTotal: market('awayTotal', isTennis ? 'Player 2 Total Games' : 'Team 2 Total Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, playerLines11offset) }),
      handicap: market('handicap', isTennis ? 'Game Handicap' : 'Spread / Handicap', 'handicap', { handicapPairs: emptyHandicaps(7, isTennis ? [-5.5, -3.5, -1.5, 0.5, 1.5, 3.5, 5.5] : [-15.5, -8.5, -2.5, 0.5, 4.5, 9.5, 15.5]) }),
      winner: market('winner', isTennis ? 'Match / Set Winner' : 'Moneyline Winner', 'winner', { primary: true, odds: oddsMap(['a', 'b']) })
    }
  };
  if (isTennis) {
    state.markets.correctScore = market('correctScore', 'Correct Score Intelligence (CSI)', 'correctScore', { odds: oddsMap(csKeys) });
    state.markets.tiebreak = market('tiebreak', 'Direct Tiebreak Market', 'yesno', { odds: oddsMap(['yes', 'no']) });
  } else {
    state.markets.correctScore = market('correctScore', 'Correct Score (not used in BB)', 'correctScore', { odds: {} });
    state.markets.tiebreak = market('tiebreak', 'Reserved', 'yesno', { odds: {} });
  }
  return state;
}

export function createBasketballScopes(): ScopeState[] {
  return [createMetScope('ft', 'Full Time', 'basketball'), createMetScope('q1', '1st Quarter', 'basketball'), createMetScope('h1', '1st Half', 'basketball')];
}

export function createTennisScopes(): ScopeState[] {
  return [createMetScope('rt', 'Regular Time (Match)', 'tennis'), createMetScope('s1', '1st Set', 'tennis')];
}

export function createRallyScope(): ScopeState {
  const gameLines = range(56.5, 86.5, 3);
  const gameLines11 = gameLines.slice(0, OU_LINE_COUNT);
  while (gameLines11.length < OU_LINE_COUNT) {
    const last = gameLines11.length ? gameLines11[gameLines11.length - 1] : 72.5;
    gameLines11.push(round(last + 3, 1));
  }
  const playerLines = range(22.5, 48.5, 2.5);
  const playerLines11 = playerLines.slice(0, OU_LINE_COUNT);
  while (playerLines11.length < OU_LINE_COUNT) {
    const last = playerLines11.length ? playerLines11[playerLines11.length - 1] : 34.5;
    playerLines11.push(round(last + 2.5, 1));
  }
  const setTotalLines = range(12.5, 28.5, 1.5);
  const setTotal11 = setTotalLines.slice(0, OU_LINE_COUNT);
  while (setTotal11.length < OU_LINE_COUNT) {
    const last = setTotal11.length ? setTotal11[setTotal11.length - 1] : 20.5;
    setTotal11.push(round(last + 1.5, 1));
  }
  const setPlayerLines = range(4.5, 18.5, 1.5);
  const setPlayer11 = setPlayerLines.slice(0, OU_LINE_COUNT);
  while (setPlayer11.length < OU_LINE_COUNT) {
    const last = setPlayer11.length ? setPlayer11[setPlayer11.length - 1] : 10.5;
    setPlayer11.push(round(last + 1.5, 1));
  }
  return {
    id: 'fm',
    title: 'Full Match + 1st Set',
    markets: {
      matchWinner: market('matchWinner', 'Match Winner', 'winner', { primary: true, odds: oddsMap(['a', 'b']) }),
      gameTotal: market('gameTotal', 'Full Match Total Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, gameLines11) }),
      playerATotal: market('playerATotal', 'Player A Total Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, playerLines11) }),
      playerBTotal: market('playerBTotal', 'Player B Total Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, playerLines11.slice().reverse()) }),
      pointsHandicap: market('pointsHandicap', 'Points Handicap', 'handicap', { handicapPairs: emptyHandicaps(7, [-12.5, -8.5, -4.5, 0.5, 4.5, 8.5, 12.5]) }),
      setsHandicap: market('setsHandicap', 'Sets Handicap', 'handicap', { handicapPairs: emptyHandicaps(5, [-2.5, -1.5, 0.5, 1.5, 2.5]) }),
      totalSets: market('totalSets', 'Total Sets Played', 'ou', { pairs: emptyPairs(OU_LINE_COUNT, [2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5]) }),
      oddEven: market('oddEven', 'Total Sets Odd / Even', 'yesno', { odds: oddsMap(['yes', 'no']) }),
      correctScore: market('correctScore', 'Correct Score by Sets', 'correctScore', { odds: oddsMap(RALLY_SCORES) }),
      setWinner: market('setWinner', '1st Set Winner', 'winner', { primary: true, odds: oddsMap(['a', 'b']) }),
      setTotal: market('setTotal', '1st Set Total Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, setTotal11) }),
      setPlayerA: market('setPlayerA', '1st Set Player A Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, setPlayer11) }),
      setPlayerB: market('setPlayerB', '1st Set Player B Points', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, setPlayer11.slice().reverse()) }),
      setHandicap: market('setHandicap', '1st Set Points Handicap', 'handicap', { handicapPairs: emptyHandicaps(7, [-6.5, -4.5, -2.5, 0.5, 2.5, 4.5, 6.5]) })
    }
  };
}

export function createRallyScopes(): ScopeState[] {
  return [createRallyScope()];
}

export function createHockeyScope(id: 'rt' | 'p1', title: string): ScopeState {
  const isRT = id === 'rt';
  const gameLines = isRT ? range(3.5, 9.5, 0.5) : range(0.5, 3.5, 0.5);
  const teamLines = isRT ? range(0.5, 5.5, 0.5) : range(0.5, 2.5, 0.5);
  const hdpLines = isRT ? [-3.5, -2.5, -1.5, -0.5, 0, 0.5, 1.5, 2.5, 3.5] : [-1.5, -0.5, 0, 0.5, 1.5];
  const csKeys = isRT ? HOCKEY_SCORES_RT : HOCKEY_SCORES_P1;

  const state: ScopeState = {
    id,
    title,
    leaguePreset: 'nhl',
    markets: {
      mainTotal: market('mainTotal', isRT ? 'Game Total Goals' : '1st Period Total Goals', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, gameLines.slice(0, OU_LINE_COUNT)) }),
      homeTotal: market('homeTotal', isRT ? 'Team 1 Total Goals' : '1st Period T1 Goals', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, teamLines.slice(0, OU_LINE_COUNT)) }),
      awayTotal: market('awayTotal', isRT ? 'Team 2 Total Goals' : '1st Period T2 Goals', 'ou', { primary: true, pairs: emptyPairs(OU_LINE_COUNT, teamLines.slice(0, OU_LINE_COUNT)) }),
      result: market('result', isRT ? '1X2 Regulation Result' : '1st Period 1X2', 'threeway', { primary: true, odds: oddsMap(['home', 'draw', 'away']) }),
      handicap: market('handicap', isRT ? 'Puck Line Handicap' : '1st Period Handicap', 'handicap', { handicapPairs: emptyHandicaps(hdpLines.length, hdpLines) }),
      correctScore: market('correctScore', 'Correct Score Grid', 'correctScore', { odds: oddsMap(csKeys) })
    }
  };

  if (isRT) {
    state.markets.moneyline = market('moneyline', 'Moneyline (incl. OT/Shootout)', 'winner', { primary: true, odds: oddsMap(['a', 'b']) });
    state.markets.doubleChance = market('doubleChance', 'Double Chance', 'threeway', { odds: oddsMap(['hd', 'ha', 'da']) });
    state.markets.btts = market('btts', 'Both Teams to Score (BTTS)', 'yesno', { odds: oddsMap(['yes', 'no']) });
    state.markets.oddEven = market('oddEven', 'Total Goals Odd / Even', 'yesno', { odds: oddsMap(['odd', 'even']) });
  }

  return state;
}

export function createHockeyScopes(): ScopeState[] {
  return [createHockeyScope('rt', 'Regular Time'), createHockeyScope('p1', '1st Period')];
}

/* ========================= LINE OPTIONS ========================= */

export function lineOptionsFor(sportId: SportId, scopeId: string, marketId: string): number[] {
  if (sportId === 'football') {
    if (marketId === 'mainTotal' || marketId === 'homeTotal' || marketId === 'awayTotal') {
      return [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5];
    }
    if (marketId === 'handicap') return [-3.5, -2.5, -2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2, 2.5, 3.5];
    return [];
  }
  if (sportId === 'tennis') {
    if (marketId === 'mainTotal') {
      return scopeId === 's1' ? range(4.5, 18.5, 0.5) : range(14.5, 48.5, 0.5);
    }
    if (marketId === 'homeTotal' || marketId === 'awayTotal') {
      return scopeId === 's1' ? range(1.5, 14.5, 0.5) : range(3.5, 28.5, 0.5);
    }
    if (marketId === 'handicap') return range(-8.5, 8.5, 0.5);
    return [];
  }
  if (sportId === 'basketball') {
    if (marketId === 'mainTotal') {
      if (scopeId === 'q1') return range(26.5, 70.5, 1);
      if (scopeId === 'h1') return range(60.5, 130.5, 1);
      return range(120.5, 260.5, 1);
    }
    if (marketId === 'homeTotal' || marketId === 'awayTotal') {
      if (scopeId === 'q1') return range(4.5, 40.5, 1);
      if (scopeId === 'h1') return range(24.5, 80.5, 1);
      return range(50.5, 144.5, 1);
    }
    if (marketId === 'handicap') return range(-28.5, 28.5, 1);
    return [];
  }
  if (sportId === 'hockey') {
    if (marketId === 'mainTotal') return range(2.5, 10.5, 0.5);
    if (marketId === 'homeTotal' || marketId === 'awayTotal') return range(0.5, 6.5, 0.5);
    if (marketId === 'handicap') return [-3.5, -2.5, -1.5, -0.5, 0, 0.5, 1.5, 2.5, 3.5];
    return [];
  }
  // rally
  if (['gameTotal', 'playerATotal', 'playerBTotal'].includes(marketId)) return range(12.5, 120.5, 1);
  if (['setTotal', 'setPlayerA', 'setPlayerB'].includes(marketId)) return range(6.5, 38.5, 0.5);
  if (marketId === 'pointsHandicap') return range(-20.5, 20.5, 1);
  if (marketId === 'setsHandicap') return range(-3.5, 3.5, 0.5);
  if (marketId === 'totalSets') return range(2.5, 14.5, 1);
  if (marketId === 'setHandicap') return range(-10.5, 10.5, 1);
  return [];
}

/* ========================= STORAGE HELPERS ========================= */

export const STORAGE_PREFIX = 'sportsScreener_v1_';

export function storageKey(sportId: SportId): string {
  return `${STORAGE_PREFIX}${sportId}`;
}

export function saveScopes(sportId: SportId, scopes: ScopeState[]): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(storageKey(sportId), JSON.stringify(scopes));
  } catch (_e) {
    // ignore quota or privacy-mode errors
  }
}

function deepMergeMarket(targetMarket: MarketInput, srcMarket: MarketInput | undefined): void {
  if (!srcMarket) return;
  if (srcMarket.pairs && targetMarket.pairs) {
    for (let i = 0; i < targetMarket.pairs.length; i += 1) {
      const dst = targetMarket.pairs[i];
      const src = srcMarket.pairs[i];
      if (!src) continue;
      if (src.line !== null && src.line !== undefined) dst.line = src.line;
      if (src.over !== null && src.over !== undefined) dst.over = src.over;
      if (src.under !== null && src.under !== undefined) dst.under = src.under;
    }
  }
  if (srcMarket.handicapPairs && targetMarket.handicapPairs) {
    for (let i = 0; i < targetMarket.handicapPairs.length; i += 1) {
      const dst = targetMarket.handicapPairs[i];
      const src = srcMarket.handicapPairs[i];
      if (!src) continue;
      if (src.line !== null && src.line !== undefined) dst.line = src.line;
      if (src.sideA !== null && src.sideA !== undefined) dst.sideA = src.sideA;
      if (src.sideB !== null && src.sideB !== undefined) dst.sideB = src.sideB;
    }
  }
  if (srcMarket.odds && targetMarket.odds) {
    Object.keys(targetMarket.odds).forEach((k) => {
      const v = srcMarket.odds?.[k];
      if (v !== undefined && v !== null) targetMarket.odds![k] = v;
    });
  }
}

export function mergeScopeOnto(dst: ScopeState, src: any): void {
  if (!src) return;
  if (typeof src.teamA === 'string' && src.teamA) dst.teamA = src.teamA;
  if (typeof src.teamB === 'string' && src.teamB) dst.teamB = src.teamB;
  if (typeof src.leaguePreset === 'string' && src.leaguePreset) dst.leaguePreset = src.leaguePreset;
  if (typeof src.surface === 'string' && src.surface) dst.surface = src.surface;
  if (typeof src.format === 'string' && src.format) dst.format = src.format;
  if (src.markets && dst.markets) {
    Object.keys(dst.markets).forEach((mKey) => {
      deepMergeMarket(dst.markets[mKey], src.markets?.[mKey]);
    });
  }
}

export function loadScopes(sportId: SportId, fallback: ScopeState[]): ScopeState[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return fallback;
    const raw = localStorage.getItem(storageKey(sportId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return fallback;
    if (parsed.length === fallback.length) {
      for (let i = 0; i < fallback.length; i += 1) {
        if (fallback[i] && parsed[i] && fallback[i].id === parsed[i].id) {
          mergeScopeOnto(fallback[i], parsed[i]);
        }
      }
      return fallback;
    }
    const byId = new Map<string, any>();
    parsed.forEach((s: any) => {
      if (s?.id) byId.set(s.id, s);
    });
    fallback.forEach((dst) => {
      const src = byId.get(dst.id);
      if (src) mergeScopeOnto(dst, src);
    });
    saveScopes(sportId, fallback);
    return fallback;
  } catch (_e) {
    return fallback;
  }
}

export function clearScopes(sportId: SportId): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.removeItem(storageKey(sportId));
  } catch (_e) {
    // ignore
  }
}

export function clearAllScopeStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    (['football', 'basketball', 'tennis', 'rally', 'hockey'] as SportId[]).forEach((s) => clearScopes(s));
  } catch (_e) {
    // ignore
  }
}

export function clearScopeState(scope: ScopeState): void {
  Object.values(scope.markets).forEach((m) => {
    m.pairs?.forEach((p) => {
      p.over = null;
      p.under = null;
    });
    m.handicapPairs?.forEach((p) => {
      p.sideA = null;
      p.sideB = null;
    });
    if (m.odds)
      Object.keys(m.odds).forEach((k) => {
        m.odds![k] = null;
      });
  });
}
