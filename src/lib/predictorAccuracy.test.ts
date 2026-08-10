import { describe, it, expect } from 'vitest';
import { buildAccuracyReport, bandOf } from './predictorAccuracy';
import { normalizeMatches } from '../../convex/scrapers/normalize';
import type { PredictorMatch } from './predictorTypes';

function matchFrom(
  id: string,
  sportId: string,
  oddsText: string,
  finalScore: string,
  league = 'Premier League'
): PredictorMatch {
  const [n] = normalizeMatches(
    [
      {
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        league,
        startTime: 1,
        source: 'LiveAPI',
        sourceUrl: '',
        markets: ['result', 'doubleChance', 'handicap', 'mainTotal'],
        oddsText
      }
    ],
    sportId
  );
  return {
    _id: id,
    dayKey: '2026-08-10',
    sportId: sportId as any,
    matchId: id,
    league,
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    startTime: 1,
    source: 'LiveAPI',
    marketsAvailable: ['result', 'doubleChance', 'handicap', 'mainTotal'],
    scopes: n.scope,
    finalScore,
    status: 'finished',
    createdAt: Date.now()
  };
}

describe('predictorAccuracy', () => {
  it('buckets resolved picks by band, market and sport', () => {
    // Home-favoured 1X2 (Arsenal 1.50) + real totals → the winner pick is a
    // strong favourite and every pick resolves against the 2-0 final score.
    const match = matchFrom('m1', 'football', 'h2h=1.50,4.00,6.50 totals=2.5:1.80/2.00', '3-1');
    const report = buildAccuracyReport([match]);

    expect(report.finishedMatches).toBe(1);
    expect(report.overall.picks).toBeGreaterThanOrEqual(3); // winner + spread + total
    // 3-1 home win wins the home winner, the home-favoured spread AND Over 2.5.
    expect(report.overall.wins).toBe(report.overall.picks);
    expect(report.overall.losses).toBe(0);
    expect(report.overall.winRatePct).toBe(100);

    // Winner pick resolves as a win and lands in a signal band.
    const winnerRow = report.byMarket.find((r) => r.group.includes('Winner'));
    expect(winnerRow).toBeDefined();
    expect(winnerRow!.wins).toBe(1);

    const sportRow = report.bySport.find((r) => r.group === 'football');
    expect(sportRow).toBeDefined();
    expect(sportRow!.picks).toBe(report.overall.picks);

    // Calibration: win rate 100% vs published average → gap is negative
    // (verdicts were conservative, not overconfident).
    expect(report.overall.calibrationGapPct).toBeLessThan(0);
  });

  it('skips unfinished matches without a final score', () => {
    const [n] = normalizeMatches(
      [
        {
          homeTeam: 'Arsenal',
          awayTeam: 'Chelsea',
          league: 'Premier League',
          startTime: 1,
          source: 'LiveAPI',
          sourceUrl: '',
          markets: ['result', 'doubleChance', 'handicap', 'mainTotal'],
          oddsText: 'h2h=1.50,4.00,6.50 totals=2.5:1.80/2.00'
        }
      ],
      'football'
    );
    const upcoming: PredictorMatch = {
      _id: 'm2',
      dayKey: '2026-08-10',
      sportId: 'football',
      matchId: 'm2',
      league: 'Premier League',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      startTime: Date.now() + 3600000,
      source: 'LiveAPI',
      marketsAvailable: ['result'],
      scopes: n.scope,
      createdAt: Date.now()
    };
    const report = buildAccuracyReport([upcoming]);
    expect(report.finishedMatches).toBe(0);
    expect(report.overall.picks).toBe(0);
  });

  it('maps realWinChancePct to the documented signal bands', () => {
    expect(bandOf(80)).toBe('Top Signal');
    expect(bandOf(70, 'Strong Signal')).toBe('Strong Signal');
    expect(bandOf(55)).toBe('Qualifying');
    expect(bandOf(40)).toBe('Reference Only');
    expect(bandOf(60, 'Reference Only')).toBe('Reference Only'); // demoted picks stay Reference Only
  });
});
