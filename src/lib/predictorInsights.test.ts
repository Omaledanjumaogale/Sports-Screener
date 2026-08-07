import { describe, it, expect } from 'vitest';
import { buildPredictorInsights } from './predictorInsights';
import { DEFAULT_CONFIDENCE_FLOOR } from './predictorTypes';
import type { Pick } from './engine';

function pick(partial: Partial<Pick> & { label: string; probability: number; odds: number }): Pick {
  return {
    marketId: 'mainTotal',
    marketTitle: 'Match Total',
    margin: 3,
    ev: 0.5,
    ...partial
  };
}

const match = { homeTeam: 'Arsenal', awayTeam: 'Chelsea' };

describe('buildPredictorInsights', () => {
  it('builds a qualified verdict from picks that cleared the floor', () => {
    const insight = buildPredictorInsights(match, [
      pick({ label: 'Over 2.5 Goals', probability: 72.4, odds: 1.7 }),
      pick({ label: 'BTTS Yes', probability: 64.1, odds: 1.9 })
    ]);

    expect(insight.verdictSummary).toContain('Arsenal vs Chelsea');
    expect(insight.verdictSummary).toContain('72.4%');
    expect(insight.top3Selections).toHaveLength(2);
    expect(insight.top3Selections[0]).toMatchObject({
      rank: 1,
      selection: 'Over 2.5 Goals',
      confidence: '72.4%'
    });
    expect(insight.top3Selections[0].punterEdge).toContain('%');
  });

  it('reports a no-qualifier verdict when nothing clears the floor', () => {
    const insight = buildPredictorInsights(match, []);
    expect(insight.verdictSummary).toContain(`no selection reached the ${DEFAULT_CONFIDENCE_FLOOR}% floor`);
    expect(insight.top3Selections).toEqual([]);
    expect(insight.tacticalRecommendation).toContain('Hold this market');
  });

  it('honours a custom confidence floor in copy', () => {
    const insight = buildPredictorInsights(match, [pick({ label: 'X', probability: 65, odds: 1.5 })], 65);
    expect(insight.crossCheckSteps[3]).toContain('≥65%');
    expect(insight.verdictSummary).toContain('65% floor');
  });

  it('computes a positive punter edge from probability vs implied odds', () => {
    // 1.5 odds => 66.67% implied; 80% real => ~+13.3% edge
    const insight = buildPredictorInsights(match, [pick({ label: 'Home', probability: 80, odds: 1.5 })]);
    expect(insight.top3Selections[0].punterEdge).toMatch(/\+13\.\d+%/);
  });

  it('always returns the full insight contract', () => {
    const insight = buildPredictorInsights(match, []);
    for (const key of [
      'verdictSummary',
      'valueAssessment',
      'riskWarning',
      'tacticalRecommendation',
      'crossCheckAnalysis',
      'crossCheckSteps',
      'top3Selections',
      'punterEdge',
      'bookmakerBiasNote',
      'stakeAdvice'
    ]) {
      expect(insight, `missing field: ${key}`).toHaveProperty(key);
    }
    expect(insight.crossCheckSteps.length).toBeGreaterThanOrEqual(4);
  });
});
