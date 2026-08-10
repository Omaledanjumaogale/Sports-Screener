// src/lib/predictorAccuracy.ts
//
// Post-match accuracy monitoring for the AI Predictor. For every FINISHED match
// it re-runs the Great Minds debate (pure + deterministic), grades the three
// consensus picks against the real final score (same gradeSelection the P&L
// uses) and buckets them by:
//   • signal band   — Top Signal / Strong Signal / Qualifying / Reference Only
//   • market        — Winner / Spread / Total
//   • sport
//
// Each bucket reports the ACTUAL win rate next to the AVERAGE PUBLISHED
// probability, so a "calibration gap" surfaces drift between what the verdict
// promised and what it delivered (0% = perfectly calibrated). This is the
// monitoring loop documented in AUDIT.md §5b — publish it anywhere the loaded
// match set is available (PredictorPage) and watch for systemic drift.

import type { PredictorMatch } from './predictorTypes';
import { generateGreatMindsDebate } from './greatMindsEngine';
import { analyzeCachedMatch } from './predictorClient';

export type AccuracyBand = 'Top Signal' | 'Strong Signal' | 'Qualifying' | 'Reference Only';

export interface AccuracyRow {
  group: string;
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRatePct: number;      // resolved picks only (pushes excluded from the rate)
  avgPredictedPct: number; // mean published realWinChancePct for resolved picks
  calibrationGapPct: number; // avgPredictedPct - winRatePct (0 = perfectly calibrated)
}

export interface AccuracyReport {
  overall: AccuracyRow;
  byBand: AccuracyRow[];
  byMarket: AccuracyRow[];
  bySport: AccuracyRow[];
  finishedMatches: number;
}

const BAND_ORDER: AccuracyBand[] = ['Top Signal', 'Strong Signal', 'Qualifying', 'Reference Only'];

export function bandOf(realWinChancePct: number, verdictTag?: string): AccuracyBand {
  const tag = verdictTag || '';
  if (tag === 'Reference Only') return 'Reference Only';
  if (realWinChancePct >= 75) return 'Top Signal';
  if (realWinChancePct >= 65) return 'Strong Signal';
  if (realWinChancePct >= 52) return 'Qualifying';
  return 'Reference Only';
}

function emptyBucket(): { picks: number; wins: number; losses: number; pushes: number; predictedSum: number } {
  return { picks: 0, wins: 0, losses: 0, pushes: 0, predictedSum: 0 };
}

function addToBucket(
  b: { picks: number; wins: number; losses: number; pushes: number; predictedSum: number },
  grade: 'win' | 'loss' | 'push',
  predictedPct: number
): void {
  b.picks += 1;
  b.predictedSum += predictedPct;
  if (grade === 'win') b.wins += 1;
  else if (grade === 'loss') b.losses += 1;
  else b.pushes += 1;
}

function toRow(group: string, b: { picks: number; wins: number; losses: number; pushes: number; predictedSum: number }): AccuracyRow {
  const resolved = b.wins + b.losses;
  const winRatePct = resolved > 0 ? Math.round((b.wins / resolved) * 100) : 0;
  const avgPredictedPct = b.picks > 0 ? Math.round(b.predictedSum / b.picks) : 0;
  return {
    group,
    picks: b.picks,
    wins: b.wins,
    losses: b.losses,
    pushes: b.pushes,
    winRatePct,
    avgPredictedPct,
    calibrationGapPct: b.picks > 0 ? Number((avgPredictedPct - winRatePct).toFixed(1)) : 0
  };
}

const MARKET_LABEL: Record<string, string> = {
  winner: 'Winner / Moneyline',
  spread: 'Spread / Handicap',
  total: 'Total / Over-Under'
};

/**
 * Build the accuracy report for a loaded match set. Only finished matches with a
 * real final score contribute; anything else is skipped. Never throws — a match
 * whose debate cannot be built is ignored.
 */
export function buildAccuracyReport(matches: PredictorMatch[]): AccuracyReport {
  const overall = emptyBucket();
  const bands = new Map<AccuracyBand, ReturnType<typeof emptyBucket>>(BAND_ORDER.map((b) => [b, emptyBucket()]));
  const markets = new Map<string, ReturnType<typeof emptyBucket>>();
  const sports = new Map<string, ReturnType<typeof emptyBucket>>();
  let finishedMatches = 0;

  for (const match of matches) {
    const score = match.finalScore || match.oddsSnapshot?.finalScore;
    if (!score) continue;
    finishedMatches += 1;

    let debate;
    try {
      debate = generateGreatMindsDebate(match, analyzeCachedMatch(match).analysis);
    } catch {
      continue;
    }

    const verdicts = debate.resolvedVerdict?.pickVerdicts ?? [];
    if (!verdicts.length) continue;

    for (const [marketKey, pick] of Object.entries(debate.consensusPicks) as [string, (typeof debate.consensusPicks.winner) | null][]) {
      // The single-team-edge reconciliation can drop the spread pick entirely.
      if (!pick) continue;
      const verdict = verdicts.find((v) => v.selection === pick.selection);
      if (!verdict || verdict.grade === 'pending') continue;

      const band = bandOf(pick.realWinChancePct, pick.verdictTag);
      addToBucket(overall, verdict.grade, pick.realWinChancePct);
      addToBucket(bands.get(band)!, verdict.grade, pick.realWinChancePct);
      const m = markets.get(MARKET_LABEL[marketKey] ?? marketKey) ?? emptyBucket();
      addToBucket(m, verdict.grade, pick.realWinChancePct);
      markets.set(MARKET_LABEL[marketKey] ?? marketKey, m);
      const s = sports.get(match.sportId) ?? emptyBucket();
      addToBucket(s, verdict.grade, pick.realWinChancePct);
      sports.set(match.sportId, s);
    }
  }

  return {
    overall: toRow('All signals', overall),
    byBand: BAND_ORDER.map((b) => toRow(b, bands.get(b)!)).filter((r) => r.picks > 0),
    byMarket: [...markets.entries()].map(([k, v]) => toRow(k, v)).sort((a, b) => b.picks - a.picks),
    bySport: [...sports.entries()].map(([k, v]) => toRow(k, v)).sort((a, b) => b.picks - a.picks),
    finishedMatches
  };
}
