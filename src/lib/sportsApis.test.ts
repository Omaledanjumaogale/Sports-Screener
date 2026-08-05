import { describe, it, expect } from 'vitest';
import { parseOddsText } from '../../convex/scrapers/normalize';
import { consolidateOdds } from '../../convex/apis/sportsApis';

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
});