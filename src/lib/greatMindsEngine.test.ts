import { describe, it, expect } from 'vitest';
import { generateGreatMindsDebate, generateDailyPnlSummary } from './greatMindsEngine';
import type { PredictorMatch } from './predictorTypes';

describe('greatMindsEngine', () => {
  const dummyMatch: PredictorMatch = {
    _id: 'test_123',
    dayKey: '2026-08-07',
    sportId: 'baseball',
    matchId: 'mlb_123',
    league: 'MLB',
    homeTeam: 'Washington Nationals',
    awayTeam: 'Philadelphia Phillies',
    startTime: Date.now() + 3600000,
    source: 'test',
    marketsAvailable: ['moneyline', 'spread', 'total'],
    scopes: {},
    createdAt: Date.now()
  };

  it('generates a complete Great Minds 5-model debate result', () => {
    const debate = generateGreatMindsDebate(dummyMatch, null);
    expect(debate).toBeDefined();
    expect(debate.homeTeam).toBe('Washington Nationals');
    expect(debate.awayTeam).toBe('Philadelphia Phillies');
    expect(debate.rounds.length).toBe(5);
    // Every market resolves to a valid N/5 consensus ratio (3-5 agreeing models).
    for (const pick of [debate.consensusPicks.winner, debate.consensusPicks.spread, debate.consensusPicks.total]) {
      expect(pick.consensusRatio).toMatch(/^[3-5]\/5$/);
      expect(pick.modelChoices.length).toBe(5);
    }
  });

  it('generates dynamic daily P&L summary metrics from the loaded match set', () => {
    const pnl = generateDailyPnlSummary([dummyMatch, { ...dummyMatch, matchId: 'mlb_456', _id: 'test_456' }], 'ALL');
    expect(pnl).toBeDefined();
    expect(pnl.sportFilter).toBe('ALL');
    expect(pnl.rows.length).toBe(4);
    expect(pnl.rows[0].consensusLabel).toBe('5/5 CONSENSUS');
    expect(pnl.rows[3].consensusLabel).toBe('OVERALL');
    // Row picks must reconcile against the overall row.
    expect(pnl.rows[3].picksCount).toBe(pnl.rows[0].picksCount + pnl.rows[1].picksCount + pnl.rows[2].picksCount);
    expect(pnl.greatMindsStats).toBeDefined();
    expect(pnl.greatMindsStats.totalDebatesCount).toBe(2);
    expect(Object.keys(pnl.greatMindsStats.modelAccuracyMap).length).toBe(5);
    expect(pnl.greatMindsStats.topModel).toBeTruthy();
  });

  it('filters the P&L summary by sport', () => {
    const baseball = generateDailyPnlSummary([dummyMatch, { ...dummyMatch, matchId: 'mlb_789', sportId: 'football' }], 'baseball');
    expect(baseball.greatMindsStats.totalDebatesCount).toBe(1);
  });
});
