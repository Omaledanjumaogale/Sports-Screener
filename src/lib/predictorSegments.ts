import type { Pick } from './engine';

export type PickSegmentKey =
  | 'firsthalf'
  | 'firstquarter'
  | 'firstperiod'
  | 'firstset'
  | 'winner'
  | 'total'
  | 'teamTotal'
  | 'playerProps'
  | 'handicap'
  | 'correctScore'
  | 'innings'
  | 'rounds'
  | 'method'
  | 'corners'
  | 'cards'
  | 'props';

export interface PickSegmentDef {
  key: PickSegmentKey;
  label: string;
  short: string;
  accent: string;
}

export const PREDICTOR_SEGMENTS: PickSegmentDef[] = [
  { key: 'winner', label: 'Winner / Moneyline', short: '1X2', accent: '#22c55e' },
  { key: 'total', label: 'Match / Main Total', short: 'Total', accent: '#3b82f6' },
  { key: 'teamTotal', label: 'Team / Player Totals', short: 'Team O/U', accent: '#8b5cf6' },
  { key: 'handicap', label: 'Handicap / Spread', short: 'HCP', accent: '#f59e0b' },
  { key: 'correctScore', label: 'Correct Score', short: 'CS', accent: '#ec4899' },
  { key: 'firsthalf', label: '1st Half Scopes', short: '1H', accent: '#0ea5e9' },
  { key: 'firstquarter', label: '1st Quarter Scopes', short: '1Q', accent: '#14b8a6' },
  { key: 'firstperiod', label: '1st Period Scopes', short: '1P', accent: '#6366f1' },
  { key: 'firstset', label: '1st Set Scopes', short: '1S', accent: '#a3e635' },
  { key: 'playerProps', label: 'Player Props', short: 'Props', accent: '#f43f5e' },
  { key: 'innings', label: 'Innings (Cricket)', short: 'Inn', accent: '#d97706' },
  { key: 'rounds', label: 'Rounds (MMA)', short: 'Rnd', accent: '#64748b' },
  { key: 'method', label: 'Winning Method', short: 'Mtd', accent: '#7c3aed' },
  { key: 'corners', label: 'Corners / Cards', short: 'Cor', accent: '#06b6d4' },
  { key: 'cards', label: 'Cards', short: 'Crd', accent: '#facc15' },
  { key: 'props', label: 'Props / Alternates', short: 'Prop', accent: '#94a3b8' }
];

const SEGMENT_BY_ID: Record<string, PickSegmentKey> = {
  // Winner / Moneyline family
  winner: 'winner',
  matchWinner: 'winner',
  moneyline: 'winner',
  result: 'winner',
  regResult: 'winner',
  setWinner: 'winner',
  // Main / match totals
  mainTotal: 'total',
  gameTotal: 'total',
  setTotal: 'total',
  totalSets: 'total',
  roundsTotal: 'total',
  // Team / player totals
  homeTotal: 'teamTotal',
  awayTotal: 'teamTotal',
  playerATotal: 'teamTotal',
  playerBTotal: 'teamTotal',
  setPlayerA: 'teamTotal',
  setPlayerB: 'teamTotal',
  // Basketball 1st-half team totals
  firstHalfHomeTotal: 'firsthalf',
  firstHalfAwayTotal: 'firsthalf',
  // Handicap / spread family
  handicap: 'handicap',
  pointsHandicap: 'handicap',
  setsHandicap: 'handicap',
  setHandicap: 'handicap',
  // Correct score
  correctScore: 'correctScore',
  winningMargin: 'correctScore',
  // Sport-first-half scopes (football/basketball/hockey)
  h1winner: 'firsthalf',
  h1Total: 'firsthalf',
  h1homeTotal: 'firsthalf',
  h1awayTotal: 'firsthalf',
  firstHalfWinner: 'firsthalf',
  firstHalfTotal: 'firsthalf',
  // Basketball quarters
  q1winner: 'firstquarter',
  q1Total: 'firstquarter',
  q1HomeTotal: 'firstquarter',
  q1AwayTotal: 'firstquarter',
  // Hockey periods
  p1winner: 'firstperiod',
  p1Total: 'firstperiod',
  p1HomeTotal: 'firstperiod',
  p1AwayTotal: 'firstperiod',
  // Tennis / volleyball sets
  s1winner: 'firstset',
  s1Total: 'firstset',
  s1aTotal: 'firstset',
  s1bTotal: 'firstset',
  set1Winner: 'firstset',
  // Player props
  playerA: 'playerProps',
  playerB: 'playerProps',
  battersA: 'playerProps',
  battersB: 'playerProps',
  strikesOut: 'playerProps',
  // Cricket innings
  i1Total: 'innings',
  i1Home: 'innings',
  i1Away: 'innings',
  topTotal: 'innings',
  // MMA rounds
  roundTotal: 'rounds',
  totalRounds: 'rounds',
  // Winning method (MMA / boxing)
  method: 'method',
  winMethod: 'method',
  koTko: 'method',
  submission: 'method',
  decision: 'method',
  // Corners / cards / cards
  cornersTotal: 'corners',
  homeCorners: 'corners',
  awayCorners: 'corners',
  cardTotal: 'cards',
  // Football runline etc
  runline: 'handicap',
  // Derived football markets
  secondHalfTotal: 'total',
  // Extra engine market ids → sensible buckets
  doubleChance: 'winner',
  btts: 'props',
  noneOdds: 'props',
  tiebreak: 'props',
  oddEven: 'props',
  tts: 'props',
  extraInnings: 'innings',
  boss: 'method',
  roundRule: 'rounds',
  goDistance: 'method'
};

export function pickSegment(marketId: string): PickSegmentDef {
  const def = PREDICTOR_SEGMENTS.find((s) => s.key === SEGMENT_BY_ID[marketId]);
  return def ?? PREDICTOR_SEGMENTS[PREDICTOR_SEGMENTS.length - 1];
}

export function picksBySegment(picks: Pick[]): Map<PickSegmentKey, Pick[]> {
  const map = new Map<PickSegmentKey, Pick[]>();
  for (const p of picks) {
    const key = pickSegment(p.marketId).key;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  for (const list of map.values()) {
    list.sort((a, b) => Number(b.probability) - Number(a.probability));
  }
  return map;
}