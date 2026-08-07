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
    expect(debate.consensusPicks.winner.consensusRatio).toBe('5/5');
    expect(debate.consensusPicks.spread.consensusRatio).toBe('4/5');
    expect(debate.consensusPicks.total.consensusRatio).toBe('4/5');
    expect(debate.consensusPicks.winner.modelChoices.length).toBe(5);
  });

  it('generates daily P&L summary metrics', () => {
    const pnl = generateDailyPnlSummary('ALL');
    expect(pnl).toBeDefined();
    expect(pnl.overallWinRatePct).toBe(61);
    expect(pnl.rows.length).toBe(4);
    expect(pnl.rows[0].consensusLabel).toBe('5/5 CONSENSUS');
    expect(pnl.rows[3].consensusLabel).toBe('OVERALL');
  });
});
