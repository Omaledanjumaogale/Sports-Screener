import { describe, it, expect } from 'vitest';
import { analyzeCachedMatch, emptyAnalysis } from './predictorClient';
import type { PredictorMatch } from './predictorTypes';

function match(overrides: Partial<PredictorMatch> = {}): PredictorMatch {
  return {
    matchId: 'm1',
    sportId: 'football',
    league: 'EPL',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    startTime: Date.now() + 10000,
    scopes: null,
    ...overrides
  } as unknown as PredictorMatch;
}

describe('analyzeCachedMatch hardening', () => {
  it('returns an empty analysis instead of throwing when scopes is null', () => {
    let res;
    expect(() => {
      res = analyzeCachedMatch(match());
    }).not.toThrow();
    expect(res!.analysis.picks).toEqual([]);
    expect(res!.qualifying).toEqual([]);
  });

  it('returns an empty analysis instead of throwing when scopes lacks markets', () => {
    expect(() => analyzeCachedMatch(match({ scopes: { id: 'x' } as never }))).not.toThrow();
    expect(() =>
      analyzeCachedMatch(match({ scopes: { id: 'x', title: 'T', teamA: 'A', teamB: 'B', markets: {} } as never }))
    ).not.toThrow();
  });

  it('computes real picks from a valid normalized scope', () => {
    const scopes = {
      id: 'm1',
      title: 'Arsenal vs Chelsea',
      teamA: 'Arsenal',
      teamB: 'Chelsea',
      leaguePreset: 'balanced',
      markets: {
        mainTotal: {
          id: 'mainTotal',
          kind: 'lines',
          title: 'Match Total',
          pairs: [
            { line: 2.5, over: 1.85, under: 1.95 },
            { line: 1.5, over: 1.4, under: 2.8 }
          ]
        },
        result: { id: 'result', kind: 'result', title: 'Result', odds: { home: 1.85, draw: 3.4, away: 2.1 } }
      }
    };
    const res = analyzeCachedMatch(match({ scopes: scopes as never }));
    expect(res.analysis.picks.length).toBeGreaterThan(0);
  });

  it('emptyAnalysis satisfies the Analysis contract', () => {
    const a = emptyAnalysis();
    expect(a).toMatchObject({ headline: 'Unavailable', chips: [], profiles: [], picks: [], metrics: [] });
    expect(a.masterLedger).toBeNull();
    expect(a.masterRankings).toEqual([]);
  });
});