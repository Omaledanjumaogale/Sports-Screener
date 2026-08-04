import { describe, it, expect } from 'vitest';
import { filterHighConfidence, type Analysis, type Pick } from './engine';

function pick(partial: Partial<Pick> & { label: string; probability: number }): Pick {
  return {
    marketId: 'mainTotal',
    marketTitle: 'Match Total',
    odds: 1.9,
    margin: 3,
    ev: 0.5,
    ...partial
  };
}

function analysisWith(picks: Pick[], withRankings = false): Analysis {
  return {
    headline: 'test',
    chips: [],
    profiles: [],
    picks,
    metrics: [],
    masterLedger: null,
    ...(withRankings ? { masterRankings: [...picks].reverse() } : {})
  };
}

describe('filterHighConfidence', () => {
  it('returns an empty array for null/undefined/empty analysis', () => {
    expect(filterHighConfidence(null, 60)).toEqual([]);
    expect(filterHighConfidence(undefined, 60)).toEqual([]);
    expect(filterHighConfidence(analysisWith([]), 60)).toEqual([]);
  });

  it('keeps only picks whose Real Win Chance is at or above the default 60% floor', () => {
    const analysis = analysisWith([
      pick({ label: 'Over 2.5 Goals', probability: 72.4 }),
      pick({ label: 'Under 2.5 Goals', probability: 27.6 }),
      pick({ label: 'BTTS Yes', probability: 61 }),
      pick({ label: 'Home Win', probability: 59.9 })
    ]);

    const kept = filterHighConfidence(analysis, 60);
    const labels = kept.map((p) => p.label);
    expect(labels).toEqual(['Over 2.5 Goals', 'BTTS Yes']);
    expect(labels).not.toContain('Under 2.5 Goals');
    expect(labels).not.toContain('Home Win');
  });

  it('treats the floor as inclusive (probability === 60 qualifies)', () => {
    const analysis = analysisWith([pick({ label: 'Edge Case', probability: 60 })]);
    expect(filterHighConfidence(analysis, 60).map((p) => p.label)).toEqual(['Edge Case']);
  });

  it('honours a custom confidence floor', () => {
    const analysis = analysisWith([
      pick({ label: 'A', probability: 65 }),
      pick({ label: 'B', probability: 80 })
    ]);
    const kept = filterHighConfidence(analysis, 75).map((p) => p.label);
    expect(kept).toEqual(['B']);
  });

  it('prefers masterRankings when present and falls back to picks', () => {
    const picks = [pick({ label: 'PickA', probability: 70 })];
    const ranked = [pick({ label: 'RankedB', probability: 62 })];
    const analysis = analysisWith(picks, true);
    analysis.masterRankings = ranked;

    expect(filterHighConfidence(analysis, 60).map((p) => p.label)).toEqual(['RankedB']);

    analysis.masterRankings = [];
    expect(filterHighConfidence(analysis, 60).map((p) => p.label)).toEqual(['PickA']);
  });

  it('coerces string probabilities defensively', () => {
    const analysis = analysisWith([
      { ...pick({ label: 'String Pct', probability: 0 }), probability: '63.5' as unknown as number }
    ]);
    expect(filterHighConfidence(analysis, 60).map((p) => p.label)).toEqual(['String Pct']);
  });
});
