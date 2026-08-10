import { describe, it, expect } from 'vitest';
import {
  buildFootballGrid,
  gridTotals,
  gridBtts,
  homeCoversProbability,
  deriveFootballMarkets,
  FOOTBALL_AH_LINES,
  FOOTBALL_TOTAL_LINES,
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
});
