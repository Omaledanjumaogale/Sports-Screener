import { describe, it, expect } from 'vitest';
import { parseOddsText, normalizeMatches } from '../../convex/scrapers/normalize';
import { apiFixturesFor, consolidateOdds, consolidateSharp, matchOddsText } from '../../convex/apis/sportsApis';
import { amaraFilter } from '../../convex/agents/specialists';

describe('parseOddsText (normalize)', () => {
  it('parses the explicit Odds API form (h2h + totals)', () => {
    const p = parseOddsText('h2h=1.14,7.00,18.00 totals=2.5:1.85/1.95');
    expect(p.h2h).toEqual([1.14, 7, 18]);
    expect(p.total).toEqual({ line: 2.5, over: 1.85, under: 1.95 });
  });

  it('parses a bare 3-decimal run as 1X2', () => {
    expect(parseOddsText('1.85, 3.40, 2.10').h2h).toEqual([1.85, 3.4, 2.1]);
  });

  it('parses a bare 2-decimal run as over/under total', () => {
    expect(parseOddsText('1.85, 1.95').total).toEqual({ line: 0, over: 1.85, under: 1.95 });
  });

  it('returns empty for garbage', () => {
    expect(parseOddsText('no numbers here')).toEqual({});
  });
});

describe('consolidateOdds (The Odds API)', () => {
  it('builds h2h + totals from the first bookmaker outcomes', () => {
    const raw = [
      {
        home_team: 'Arsenal',
        away_team: 'Coventry City',
        bookmakers: [
          {
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Arsenal', price: 1.14 },
                  { name: 'Draw', price: 7.0 },
                  { name: 'Coventry City', price: 18.0 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 2.5, price: 1.85 },
                  { name: 'Under', point: 2.5, price: 1.95 }
                ]
              }
            ]
          }
        ]
      }
    ];
    const odds = consolidateOdds(raw);
    expect(odds.length).toBe(1);
    expect(odds[0].h2h).toEqual([1.14, 7, 18]);
    expect(odds[0].total).toEqual({ line: 2.5, over: 1.85, under: 1.95 });
  });

  it('skips malformed matches', () => {
    expect(consolidateOdds([{ bookmakers: [] }])).toEqual([]);
  });

  it('emits a 2-way moneyline (no draw) for 2-outcome h2h markets', () => {
    const raw = [
      {
        home_team: 'Kansas City Royals',
        away_team: 'Minnesota Twins',
        bookmakers: [
          {
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Kansas City Royals', price: 1.85 },
                  { name: 'Minnesota Twins', price: 2.1 }
                ]
              }
            ]
          }
        ]
      }
    ];
    const odds = consolidateOdds(raw);
    expect(odds[0].drawPresent).toBe(false);
    expect(odds[0].h2h).toEqual([1.85, 2.1]);
  });

  it('round-trips a 2-way moneyline into a full multi-market null-draw scope', () => {
    const consolidated = consolidateOdds([
      {
        home_team: 'Kansas City Royals',
        away_team: 'Minnesota Twins',
        bookmakers: [
          {
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Kansas City Royals', price: 1.85 },
                  { name: 'Minnesota Twins', price: 2.1 }
                ]
              },
              {
                key: 'totals',
                outcomes: [
                  { name: 'Over', point: 8.5, price: 1.9 },
                  { name: 'Under', point: 8.5, price: 1.9 }
                ]
              },
              {
                key: 'spreads',
                outcomes: [
                  { name: 'Kansas City Royals', point: -1.5, price: 1.9 },
                  { name: 'Minnesota Twins', point: 1.5, price: 1.9 }
                ]
              }
            ]
          }
        ]
      }
    ]);
    const text = matchOddsText(consolidated[0]);
    expect(text).toBe('h2h=1.85,2.10 totals=8.5:1.90/1.90 spread=-1.5:1.90,1.90');
    const parsed = parseOddsText(text);
    expect(parsed.h2h).toEqual([1.85, 2.1]);
    expect(parsed.total).toEqual({ line: 8.5, over: 1.9, under: 1.9 });
    expect(parsed.spread).toEqual({ point: -1.5, home: 1.9, away: 1.9 });

    const [normalized] = normalizeMatches(
      [{ homeTeam: 'Kansas City Royals', awayTeam: 'Minnesota Twins', league: 'MLB', startTime: 1, source: 'LiveAPI', sourceUrl: '', markets: ['winner', 'handicap', 'gameTotal', 'regResult'], oddsText: text }],
      'baseball'
    );
    const scope = normalized.scope;
    // Moneyline lives on winner/regResult (2-way, draw null) — no fabricated draw.
    expect(scope.markets.winner!.odds).toEqual({ a: 1.85, b: 2.1 });
    expect(scope.markets.regResult!.odds).toEqual({ home: 1.85, draw: null, away: 2.1 });
    // Real spread mapped to the handicap market.
    expect(scope.markets.handicap!.handicapPairs).toEqual([{ line: -1.5, sideA: 1.9, sideB: 1.9 }]);
    // Real total line.
    expect(scope.markets.gameTotal!.pairs![0]).toEqual({ line: 8.5, over: 1.9, under: 1.9 });
    expect(scope._meta!.oddsIsReal).toBe(true);
  });

  it('builds Double Chance + Asian Handicap from real 1X2 odds for football', () => {
    const [normalized] = normalizeMatches(
      [{ homeTeam: 'Arsenal', awayTeam: 'Coventry City', league: 'English Premier League', startTime: 1, source: 'LiveAPI', sourceUrl: '', markets: ['result', 'doubleChance', 'handicap', 'mainTotal'], oddsText: 'h2h=1.14,7.00,18.00 totals=2.5:1.85/1.95' }],
      'football'
    );
    const scope = normalized.scope;
    expect(scope.markets.result!.odds).toEqual({ home: 1.14, draw: 7, away: 18 });
    // Total ladder covers 0.5-4.5; the real 2.5 pair is preserved untouched.
    expect(scope.markets.mainTotal!.pairs!.length).toBe(5);
    expect(scope.markets.mainTotal!.pairs!.find((p) => p.line === 2.5)).toEqual({ line: 2.5, over: 1.85, under: 1.95 });
    // Double Chance derived (Shutov): home/draw is the short-priced safe leg.
    const dc = scope.markets.doubleChance!.odds!;
    expect(dc.hd).toBeLessThan(dc.da!);
    expect(dc.hd).toBeGreaterThan(1);
    expect(dc.da).toBeGreaterThan(3);
    // Full AH ladder (-1.5 … +1.5): home -0.5 (wins on home win only) is longer
    // than the 1.14 ML; away +0.5 (wins on draw or away win) is shorter than the
    // 18 ML. The ladder covers every standard handicap line now.
    const ah = scope.markets.handicap!.handicapPairs!.find((p) => p.line === -0.5)!;
    expect(scope.markets.handicap!.handicapPairs!.length).toBe(13);
    expect(ah.sideA).toBeGreaterThan(1.14);
    expect(ah.sideA).toBeLessThan(1.4);
    expect(ah.sideB).toBeGreaterThan(3);
    expect(ah.sideB).toBeLessThan(7);
    expect(scope._meta!.oddsIsReal).toBe(true);
  });

  it('marks live and non-real scopes', () => {
    const [live] = normalizeMatches(
      [{ homeTeam: 'A', awayTeam: 'B', league: 'EPL', startTime: 1, source: 'LiveAPI', sourceUrl: '', markets: ['result', 'mainTotal'], oddsText: 'h2h=2.0,3.2,3.6 live=1' }],
      'football'
    );
    expect(live.scope._meta!.live).toBe(true);
    const [noOdds] = normalizeMatches(
      [{ homeTeam: 'A', awayTeam: 'B', league: 'EPL', startTime: 1, source: 'SyntheticDev', sourceUrl: '', markets: ['result', 'mainTotal'] }],
      'football'
    );
    expect(noOdds.scope._meta!.oddsIsReal).toBe(false);
  });

  it('amaraFilter keeps matches that clear the floor on ANY market (result, not just totals)', () => {
    // Arsenal @ 1.14 result clears 60% even though the 2.5 total is ~51/49.
    const [favorite] = normalizeMatches(
      [{ homeTeam: 'Arsenal', awayTeam: 'Coventry City', league: 'English Premier League', startTime: 1, source: 'LiveAPI', sourceUrl: '', markets: ['result', 'doubleChance', 'handicap', 'mainTotal'], oddsText: 'h2h=1.14,7.00,18.00 totals=2.5:1.85/1.95' }],
      'football'
    );
    const kept = amaraFilter([favorite], 60).matchIds;
    expect(kept).toContain(favorite.matchId);
  });

  it('amaraFilter drops coin-flip matches with no market at or above the floor', () => {
    // Pure pick-em: both sides 1.90, total 1.90/1.90, no 60% side anywhere.
    const [pickem] = normalizeMatches(
      [{ homeTeam: 'A', awayTeam: 'B', league: 'EPL', startTime: 1, source: 'LiveAPI', sourceUrl: '', markets: ['result', 'doubleChance', 'handicap', 'mainTotal'], oddsText: 'h2h=1.90,3.40,3.60 totals=2.5:1.90/1.90' }],
      'football'
    );
    expect(amaraFilter([pickem], 60).matchIds).not.toContain(pickem.matchId);
  });
});

describe('consolidateSharp (SharpAPI flat odds)', () => {
  it('builds h2h + spread + total from flat moneyline/spread/total_points rows', () => {
    const rows = [
      { home_team: 'Boston Celtics', away_team: 'Los Angeles Lakers', market_type: 'moneyline', selection_type: 'home', odds_decimal: 1.55, line: null },
      { home_team: 'Boston Celtics', away_team: 'Los Angeles Lakers', market_type: 'moneyline', selection_type: 'away', odds_decimal: 2.45, line: null },
      { home_team: 'Boston Celtics', away_team: 'Los Angeles Lakers', market_type: 'point_spread', selection_type: 'home', odds_decimal: 1.91, line: -5.5 },
      { home_team: 'Boston Celtics', away_team: 'Los Angeles Lakers', market_type: 'point_spread', selection_type: 'away', odds_decimal: 1.91, line: 5.5 },
      { home_team: 'Boston Celtics', away_team: 'Los Angeles Lakers', market_type: 'total_points', selection: 'Over', odds_decimal: 1.87, line: 226.5 },
      { home_team: 'Boston Celtics', away_team: 'Los Angeles Lakers', market_type: 'total_points', selection: 'Under', odds_decimal: 1.95, line: 226.5 }
    ];
    const odds = consolidateSharp(rows);
    expect(odds.length).toBe(1);
    expect(odds[0].h2h).toEqual([1.55, 2.45]);
    expect(odds[0].drawPresent).toBe(false);
    expect(odds[0].spread).toEqual({ point: -5.5, home: 1.91, away: 1.91 });
    expect(odds[0].total).toEqual({ line: 226.5, over: 1.87, under: 1.95 });
  });

  it('keeps a draw leg for soccer 1X2 rows', () => {
    const rows = [
      { home_team: 'Arsenal', away_team: 'Chelsea', market_type: 'moneyline', selection_type: 'home', odds_decimal: 2.1, line: null },
      { home_team: 'Arsenal', away_team: 'Chelsea', market_type: 'moneyline', selection_type: 'draw', odds_decimal: 3.4, line: null },
      { home_team: 'Arsenal', away_team: 'Chelsea', market_type: 'moneyline', selection_type: 'away', odds_decimal: 3.3, line: null }
    ];
    const odds = consolidateSharp(rows);
    expect(odds[0].drawPresent).toBe(true);
    expect(odds[0].h2h).toEqual([2.1, 3.4, 3.3]);
  });

  it('skips events with no parseable markets', () => {
    expect(consolidateSharp([])).toEqual([]);
    expect(consolidateSharp([{ home_team: 'A', away_team: 'B', market_type: 'moneyline', selection_type: 'home', odds_decimal: 2.0, line: null }])).toEqual([]);
  });
});

describe('incremental refresh gate (cache-only re-score)', () => {
  it('re-runs the floor deterministically from a STORED scope (no live odds refetch)', () => {
    // Simulate a cached predictor match: the scope was persisted as-is by the
    // orchestrator (markets only). The incremental path rebuilds Amara-shaped
    // inputs from that cached scope and re-filters — it must reach the SAME
    // qualifying verdict as the original normalize+filter pass.
    const [original] = normalizeMatches(
      [{ homeTeam: 'Arsenal', awayTeam: 'Coventry City', league: 'English Premier League', startTime: 1, source: 'LiveAPI', sourceUrl: '', markets: ['result', 'doubleChance', 'handicap', 'mainTotal'], oddsText: 'h2h=1.14,7.00,18.00 totals=2.5:1.85/1.95' }],
      'football'
    );
    const cached = { matchId: original.matchId, scopes: { markets: original.scope.markets } };
    const rebuilt = { matchId: cached.matchId, scope: { markets: cached.scopes.markets } };
    expect(amaraFilter([rebuilt as any], 60).matchIds).toEqual([original.matchId]);
  });

  it('keeps a cached pick-em out of the qualifying set on re-score', () => {
    const [pickem] = normalizeMatches(
      [{ homeTeam: 'A', awayTeam: 'B', league: 'EPL', startTime: 1, source: 'LiveAPI', sourceUrl: '', markets: ['result', 'doubleChance', 'handicap', 'mainTotal'], oddsText: 'h2h=1.90,3.40,3.60 totals=2.5:1.90/1.90' }],
      'football'
    );
    const rebuilt = { matchId: pickem.matchId, scope: { markets: pickem.scope.markets } };
    expect(amaraFilter([rebuilt as any], 60).matchIds).not.toContain(pickem.matchId);
  });
});

describe('apiFixturesFor (live provider chain, requires Convex env keys)', () => {
  // TS-safe env probe (tests run under node/vitest where process exists).
  const hasKeys = !!(globalThis as any).process?.env.ODDS_PAPI_API_KEY || !!(globalThis as any).process?.env.SHARPAPI_API_KEY;
  it.runIf(hasKeys)('returns real fixtures + odds for a sport via the chain', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const { fixtures, odds } = await apiFixturesFor('football', date);
    // The chain must surface something real — OddsPapi schedules or SharpAPI
    // odds. It must never throw and must keep every result deduped.
    expect(Array.isArray(fixtures)).toBe(true);
    expect(Array.isArray(odds)).toBe(true);
    const all = [...fixtures, ...odds.map((o) => o.home)];
    expect(all.length).toBeGreaterThan(0);
  }, 90_000);
});