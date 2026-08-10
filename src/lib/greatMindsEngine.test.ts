import { describe, it, expect } from 'vitest';
import { generateGreatMindsDebate, generateDailyPnlSummary } from './greatMindsEngine';
import type { Analysis, Pick } from './engine';
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

  describe('single-team edge + verification gate', () => {
    const mkPicks = (homeProb: number, awayProb: number): Pick[] => [
      { marketId: 'result', marketTitle: 'Result', label: 'Home Win', probability: homeProb, odds: 1.7 },
      { marketId: 'result', marketTitle: 'Result', label: 'Away Win', probability: 100 - homeProb, odds: 2.3 },
      { marketId: 'handicap', marketTitle: 'Asian Handicap', label: 'Home -0.5', probability: homeProb * 0.96, odds: 1.8 },
      { marketId: 'handicap', marketTitle: 'Asian Handicap', label: 'Away +0.5', probability: awayProb, odds: 2.1 },
      { marketId: 'mainTotal', marketTitle: 'Match Total', label: 'Over 2.5', probability: 55, odds: 1.9 },
      { marketId: 'mainTotal', marketTitle: 'Match Total', label: 'Under 2.5', probability: 45, odds: 1.95 }
    ];

    const analysisOf = (picks: Pick[]): Analysis => ({
      headline: 'test',
      chips: [],
      profiles: [],
      metrics: [],
      picks
    });

    it('never lets the spread contradict the result favourite (home lean)', () => {
      const match: PredictorMatch = {
        ...dummyMatch,
        sportId: 'football',
        scopes: { _meta: { oddsIsReal: true } }
      };
      const debate = generateGreatMindsDebate(match, analysisOf(mkPicks(60, 40)));
      const winner = debate.consensusPicks.winner.selection.toLowerCase();
      const spread = debate.consensusPicks.spread.selection.toLowerCase();
      // Winner and spread must BOTH point at the home side.
      expect(winner.includes('home') || winner.includes(match.homeTeam.toLowerCase())).toBe(true);
      expect(spread.includes('home') || spread.includes(match.homeTeam.toLowerCase())).toBe(true);
      expect(spread.includes('away')).toBe(false);
    });

    it('qualifies real-odds picks and demotes synthetic ones to Reference Only', () => {
      const picks = mkPicks(60, 40);
      const real: PredictorMatch = { ...dummyMatch, sportId: 'football', scopes: { _meta: { oddsIsReal: true } } };
      const realDebate = generateGreatMindsDebate(real, analysisOf(picks));
      expect(realDebate.consensusPicks.winner.qualified).toBe(true);
      expect(realDebate.consensusPicks.spread.qualified).toBe(true);
      expect(realDebate.consensusPicks.winner.verdictTag).not.toBe('Reference Only');

      const fake: PredictorMatch = { ...dummyMatch, sportId: 'football', scopes: {} };
      const fakeDebate = generateGreatMindsDebate(fake, analysisOf(picks));
      expect(fakeDebate.consensusPicks.winner.qualified).toBe(false);
      expect(fakeDebate.consensusPicks.winner.verdictTag).toBe('Reference Only');
      expect(fakeDebate.realWinChanceTag).toBe('Reference Only');
    });

    it('synthesizes a same-direction spread when only the opposite side exists', () => {
      const picks: Pick[] = [
        { marketId: 'result', marketTitle: 'Result', label: 'Home Win', probability: 62, odds: 1.6 },
        { marketId: 'result', marketTitle: 'Result', label: 'Away Win', probability: 38, odds: 2.4 },
        // Only the AWAY spread side is available — it must NOT be selected.
        { marketId: 'handicap', marketTitle: 'Asian Handicap', label: 'Away +0.5', probability: 45, odds: 2.1 },
        { marketId: 'mainTotal', marketTitle: 'Match Total', label: 'Over 2.5', probability: 52, odds: 1.9 },
        { marketId: 'mainTotal', marketTitle: 'Match Total', label: 'Under 2.5', probability: 48, odds: 1.95 }
      ];
      const match: PredictorMatch = { ...dummyMatch, sportId: 'football', scopes: { _meta: { oddsIsReal: true } } };
      const debate = generateGreatMindsDebate(match, analysisOf(picks));
      const spread = debate.consensusPicks.spread.selection.toLowerCase();
      const home = match.homeTeam.toLowerCase();
      expect(spread.includes(home)).toBe(true);
      expect(spread.includes('away')).toBe(false);
    });
  });
});
