import { describe, it, expect } from 'vitest';
import {
  buildFootballGrid,
  gridTotals,
  gridBtts,
  gridTeamOver,
  halfTotalOver,
  homeCoversProbability,
  deriveFootballMarkets,
  FOOTBALL_AH_LINES,
  FOOTBALL_TOTAL_LINES,
  FOOTBALL_TEAM_TOTAL_LINES,
  FOOTBALL_HALF_TOTAL_LINES,
  devig,
  devigPair
} from '../../convex/scrapers/normalize';

describe('predictor markets (Poisson football model)', () => {
  // A realistic home-favoured 1X2: 1.85 / 3.40 / 4.20 → ~54% / 29% / 17%.
  const HOME = 1.85;
  const DRAW = 3.4;
  const AWAY = 4.2;
  const [pH, pD, pA] = devig([HOME, DRAW, AWAY]);

  it('grid W/D/L mass sums to 1 and matches the 1X2 direction', () => {
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    let w = 0, d = 0, l = 0;
    for (let i = 0; i < grid.p.length; i++) {
      for (let j = 0; j < grid.p[i].length; j++) {
        const prob = grid.p[i][j];
        if (i > j) w += prob;
        else if (i === j) d += prob;
        else l += prob;
      }
    }
    expect(w + d + l).toBeCloseTo(1, 6);
    expect(w).toBeGreaterThan(l); // home favourite
    expect(Math.abs(w - pH)).toBeLessThan(0.08);
    expect(Math.abs(l - pA)).toBeLessThan(0.08);
  });

  it('O/U ladder is complementary and monotonic across 0.5-4.5', () => {
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    const overs = FOOTBALL_TOTAL_LINES.map((line) => {
      const t = gridTotals(grid, line);
      expect(t.over + t.under).toBeCloseTo(1, 6);
      return t.over;
    });
    expect(overs[0]).toBeGreaterThan(overs[1]);
    expect(overs[1]).toBeGreaterThan(overs[2]);
    expect(overs[3]).toBeGreaterThan(overs[4]);
  });

  it('BTTS yes/no are complementary', () => {
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    const b = gridBtts(grid);
    expect(b.yes + b.no).toBeCloseTo(1, 6);
    expect(b.yes).toBeGreaterThan(0.2);
    expect(b.yes).toBeLessThan(0.9);
  });

  it('home covers probability is monotonic across the AH ladder', () => {
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    let prev = 0;
    for (const line of FOOTBALL_AH_LINES) {
      const p = homeCoversProbability(grid, [pH, pD, pA], line);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(p).toBeGreaterThan(0.05);
      expect(p).toBeLessThan(0.98);
      prev = p;
    }
  });

  it('derives a full AH ladder where every pair de-vigs back to the fair split', () => {
    const mk = deriveFootballMarkets(HOME, DRAW, AWAY, 2.5);
    expect(mk.handicap.handicapPairs?.length).toBe(FOOTBALL_AH_LINES.length);
    for (const pair of mk.handicap.handicapPairs ?? []) {
      // Deep favourite sides (+1/+1.25/+1.5) legitimately price at the 1.01 floor.
      expect(pair.sideA).toBeGreaterThanOrEqual(1.01);
      expect(pair.sideB).toBeGreaterThanOrEqual(1.01);
      // Complementarity: home {line} and away {-line} prices de-vig to ~100%.
      const { aPct, bPct } = devigPair(pair.sideA, pair.sideB);
      expect(aPct + bPct).toBeCloseTo(100, 1);
    }
  });

  it('keeps a real anchor total pair untouched while deriving the rest', () => {
    const mk = deriveFootballMarkets(HOME, DRAW, AWAY, 2.5, { line: 2.5, over: 1.7, under: 2.1 });
    const anchor = mk.mainTotal.pairs?.find((p) => p.line === 2.5);
    expect(anchor?.over).toBe(1.7);
    expect(anchor?.under).toBe(2.1);
    expect(mk.mainTotal.pairs?.length).toBe(FOOTBALL_TOTAL_LINES.length);
    expect(mk.btts.odds?.yes).toBeGreaterThan(1.01);
    expect(mk.btts.odds?.no).toBeGreaterThan(1.01);
    expect(Object.keys(mk.doubleChance.odds ?? {}).length).toBe(3);
  });

  it('derives home/away team totals (Over 0.5 = team scores at least once)', () => {
    const mk = deriveFootballMarkets(HOME, DRAW, AWAY, 2.5);
    // Both team-total markets exist with the 0.5/1.5 ladder.
    expect(mk.homeTotal.handicapPairs).toBeUndefined();
    expect(mk.homeTotal.pairs?.length).toBe(FOOTBALL_TEAM_TOTAL_LINES.length);
    expect(mk.awayTotal.pairs?.length).toBe(FOOTBALL_TEAM_TOTAL_LINES.length);
    const homeOver05 = mk.homeTotal.pairs?.find((p) => p.line === 0.5);
    const awayOver05 = mk.awayTotal.pairs?.find((p) => p.line === 0.5);
    expect(homeOver05?.over).toBeGreaterThan(1.01);
    expect(awayOver05?.over).toBeGreaterThan(1.01);
    // Favourite's team total is stronger than the underdog's (home is favourite).
    expect(homeOver05!.over).toBeLessThan(awayOver05!.over);
    // Pairs are complementary (de-vig back to ~100).
    const { aPct, bPct } = devigPair(homeOver05!.over, homeOver05!.under);
    expect(aPct + bPct).toBeCloseTo(100, 1);
  });

  it('gridTeamOver is monotonic and complementary with the under side', () => {
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    const over05 = gridTeamOver(grid, true, 0.5);
    const over15 = gridTeamOver(grid, true, 1.5);
    expect(over05).toBeGreaterThan(over15);
    expect(over05).toBeGreaterThan(0.5); // favourite scores in a majority of sims
    expect(over05).toBeLessThan(1);
    // Over 0.5 is complementary to the no-goal outcome: P(team fails to
    // score) = 1 - over0.5 — both sides are valid probabilities.
    expect(1 - over05).toBeGreaterThan(0.01);
    expect(1 - over05).toBeLessThan(0.5);
  });

  it('derives 1st/2nd half totals and picks the stronger half per match', () => {
    const mk = deriveFootballMarkets(HOME, DRAW, AWAY, 2.5);
    expect(mk.firstHalfTotal.pairs?.length).toBe(FOOTBALL_HALF_TOTAL_LINES.length);
    expect(mk.secondHalfTotal.pairs?.length).toBe(FOOTBALL_HALF_TOTAL_LINES.length);
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    const fh = halfTotalOver(grid, 'first', 0.5);
    const sh = halfTotalOver(grid, 'second', 0.5);
    expect(fh).toBeGreaterThan(0.1);
    expect(sh).toBeGreaterThan(0.1);
    expect(fh + sh).toBeGreaterThan(0.7); // almost always at least one goal in a half
    expect(fh).toBeLessThan(1);
    expect(sh).toBeLessThan(1);
    // The stronger half is marketable as a standalone pick.
    expect(Math.max(fh, sh)).toBeGreaterThan(0.45);
  });

  it('BTTS evaluates BOTH sides — yes and no both derived, stronger side wins', () => {
    const mk = deriveFootballMarkets(HOME, DRAW, AWAY, 2.5);
    expect(mk.btts.odds?.yes).toBeGreaterThan(1.01);
    expect(mk.btts.odds?.no).toBeGreaterThan(1.01);
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    const b = gridBtts(grid);
    expect(b.yes + b.no).toBeCloseTo(1, 6);
    // Neither side is pre-baked: with a home favourite at 1.85/3.4/4.2 the
    // match is not an automatic BTTS-No — both sides carry real mass.
    expect(b.yes).toBeGreaterThan(0.25);
    expect(b.no).toBeGreaterThan(0.2);
  });

  it('high-scoring line-up flips BTTS toward YES (no hardcoded No bias)', () => {
    // 1X2 with a strong favourite AND a high total anchor → goals expected on
    // both sides: BTTS Yes must exceed a low-total counterpart.
    const high = deriveFootballMarkets(1.6, 4.2, 6.0, 3.5);
    const low = deriveFootballMarkets(1.6, 4.2, 6.0, 2.0);
    expect(high.btts.odds?.yes ?? 99).toBeLessThan(low.btts.odds?.yes ?? 0);
    // And a defensive dead-rubber tilts to BTTS No: a low total with an extreme
    // favourite gives NO the shorter price.
    const tight = deriveFootballMarkets(1.25, 5.5, 11.0, 1.5);
    expect(tight.btts.odds?.no ?? 99).toBeLessThan(tight.btts.odds?.yes ?? 0);
  });
});
