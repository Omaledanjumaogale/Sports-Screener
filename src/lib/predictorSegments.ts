import type { Pick } from './engine';

export type PickSegmentKey = 'winner' | 'total' | 'teamTotal' | 'handicap' | 'correctScore' | 'props';

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
  { key: 'props', label: 'Props / Alternates', short: 'Prop', accent: '#64748b' }
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
  // Handicap / spread family
  handicap: 'handicap',
  pointsHandicap: 'handicap',
  setsHandicap: 'handicap',
  setHandicap: 'handicap',
  // Correct score
  correctScore: 'correctScore',
  winningMargin: 'correctScore'
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