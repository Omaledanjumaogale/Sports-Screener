// Regression tests for the prompt/picks-quality fixes:
//   1. TOP_VALUE_ODDS_BAND — the LLM's "TOP VALUE OPPORTUNITIES" section must
//      only surface bettable prices (no near-1.01 certainty noise, no extreme
//      long shots), because with every margined price the least-negative edge
//      always falls on the longest shot.
//   2. Certainty-side exclusion — headline / Safest / All-Markets profile tops
//      must never land on a near-1.01 side (odds <= CERTAINTY_ODDS) when a
//      bettable alternative exists in the same analysis.
import { describe, expect, it } from 'vitest';
import { isTopValueCandidate, TOP_VALUE_ODDS_BAND } from '../../convex/llm';
import { normalizeMatch } from '../../convex/scrapers/normalize';
import type { ScrapeMatch } from '../../convex/scrapers/betwatch';
import { analyzeBasketball, analyzeFootball, CERTAINTY_ODDS, type ScopeState } from './engine';

function fixture(home: string, away: string, oddsText: string, sport: 'basketball' | 'football'): ScrapeMatch {
  return {
    source: 'theoddsapi',
    sourceUrl: 'https://api.the-odds-api.com/v4/sports/odds',
    league: sport === 'basketball' ? 'NBA' : 'Premier League',
    homeTeam: home,
    awayTeam: away,
    startTime: Date.now() + 5 * 3600 * 1000,
    markets: ['h2h', 'totals', 'spreads'],
    oddsText
  };
}

describe('predictor prompt — TOP VALUE odds band', () => {
  it('band is 1.20–3.00 inclusive', () => {
    expect(TOP_VALUE_ODDS_BAND.min).toBe(1.2);
    expect(TOP_VALUE_ODDS_BAND.max).toBe(3.0);
  });

  it('excludes near-certainty noise below 1.20', () => {
    expect(isTopValueCandidate(1.01)).toBe(false); // derived ladder tail
    expect(isTopValueCandidate(1.11)).toBe(false); // over 204.5 @ 1.11 style
    expect(isTopValueCandidate(1.15)).toBe(false);
    expect(isTopValueCandidate(1.19)).toBe(false);
  });

  it('includes the fair-value zone within the band', () => {
    expect(isTopValueCandidate(1.2)).toBe(true); // inclusive lower bound
    expect(isTopValueCandidate(1.5)).toBe(true);
    expect(isTopValueCandidate(1.9)).toBe(true);
    expect(isTopValueCandidate(2.5)).toBe(true);
    expect(isTopValueCandidate(3.0)).toBe(true); // inclusive upper bound
  });

  it('excludes extreme long shots above 3.00', () => {
    expect(isTopValueCandidate(3.05)).toBe(false);
    expect(isTopValueCandidate(6.66)).toBe(false); // old top-value leader
    expect(isTopValueCandidate(18.35)).toBe(false); // old top-value leader
  });
});

describe('predictor engine — certainty-side exclusion', () => {
  it('basketball: Safest/All-Markets tops and headline never pick a 1.01 side', () => {
    // Balanced home favourite: derived ladders include deep certainty tails
    // (spread +11.5 @ ~1.01-1.11) that a pure probability ranking puts on top.
    const norm = normalizeMatch(fixture('Boston Celtics', 'LA Lakers', 'h2h=1.75,2.10 totals=220.5:1.9/1.9 spread=-4.5:1.9,1.9', 'basketball'), 'basketball');
    const analysis = analyzeBasketball(norm.scope as unknown as ScopeState);

    const profA = analysis.profiles.find((p) => p.key === 'A');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    expect(profA?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    // Headline never cites a certainty side.
    expect(analysis.headline).not.toMatch(/@ 9[0-9]\.\d%/);
    expect(analysis.headline).not.toMatch(/1\.01/);
  });

  it('basketball lopsided: heavy favourite still avoids the 1.01 spread tails', () => {
    const norm = normalizeMatch(fixture('Boston Celtics', 'Detroit Pistons', 'h2h=1.28,3.80 totals=219.5:1.85/1.95 spread=-9.5:1.9,1.9', 'basketball'), 'basketball');
    const analysis = analyzeBasketball(norm.scope as unknown as ScopeState);

    const profA = analysis.profiles.find((p) => p.key === 'A');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    expect(profA?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(analysis.headline).not.toMatch(/@ 9[0-9]\.\d%/);
  });

  it('football: Safest/All-Markets tops avoid Over 0.5 / Under 4.5 @ 1.02 noise', () => {
    const norm = normalizeMatch(fixture('Arsenal', 'Chelsea', 'h2h=2.10,3.40,3.60 totals=2.5:1.85/1.95', 'football'), 'football');
    const analysis = analyzeFootball(norm.scope as unknown as ScopeState);

    const profA = analysis.profiles.find((p) => p.key === 'A');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    expect(profA?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
  });

  it('football lopsided: best-value moneyline stays, All-Markets top is bettable', () => {
    const norm = normalizeMatch(fixture('Manchester City', 'Luton Town', 'h2h=1.22,7.50,13.00 totals=3.5:1.90/1.90', 'football'), 'football');
    const analysis = analyzeFootball(norm.scope as unknown as ScopeState);

    const profB = analysis.profiles.find((p) => p.key === 'B');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    // Best-value keeps the real moneyline (1.22) — it's a real price, not noise.
    expect(profB?.top?.label).toContain('Home Win');
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
  });
});
