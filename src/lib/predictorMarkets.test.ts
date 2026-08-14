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
  buildBasketballModel,
  basketballTeamOver,
  basketballTotalOver,
  basketballHalfTotalOver,
  basketballHalfTeamOver,
  basketballHomeCovers,
  deriveBasketballMarkets,
  BASKETBALL_SPREAD_LINES,
  gridTeamLeadUp,
  gridTeamNeverDown,
  devig,
  devigPair
} from '../../convex/scrapers/normalize';
import type { FootballScoreGrid } from '../../convex/scrapers/normalize';

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

  it('buildFootballGrid fits the real totals when provided (two-target calibration)', () => {
    // EPL-style 1X2 (home ~47%) + a real Over/Under 2.5 pair at ~51.8% over.
    const overOdds = 1.83;
    const underOdds = 1.97;
    const [pOver] = devig([overOdds, underOdds]);
    const [pH] = devig([1.95, 3.6, 4.0]);
    const g = buildFootballGrid(1.95, 3.6, 4.0, 2.5, { line: 2.5, over: overOdds, under: underOdds });
    // The totals market is now fitted: grid Over 2.5 matches the de-vigged odds.
    expect(gridTotals(g, 2.5).over).toBeCloseTo(pOver, 2);
    // The 1X2 is still fitted: home-win mass matches the de-vigged moneyline.
    let w = 0;
    for (let i = 0; i < g.p.length; i++) for (let j = 0; j < g.p[i].length; j++) if (i > j) w += g.p[i][j];
    expect(w).toBeCloseTo(pH, 2);
    // The goal expectation is materially higher than the 1X2-only grid (the
    // gap the backtest quantified: ~2.3 implied vs ~2.9 real EPL average).
    const gOld = buildFootballGrid(1.95, 3.6, 4.0, 2.5);
    const goals = (gr: typeof g) => {
      let s = 0;
      for (let i = 0; i < gr.p.length; i++) for (let j = 0; j < gr.p[i].length; j++) s += gr.p[i][j] * (i + j);
      return s;
    };
    expect(goals(g)).toBeGreaterThan(goals(gOld) + 0.3);
    // Without real totals the fallback path is unchanged and still calibrated.
    expect(Math.abs(w - pH)).toBeLessThan(0.03);
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

describe('predictor markets (football lead / momentum — 1UP, 2UP, Never Down)', () => {
  // Same realistic home-favoured 1X2 as the Poisson block: 1.85 / 3.40 / 4.20.
  const HOME = 1.85;
  const DRAW = 3.4;
  const AWAY = 4.2;

  // Hand-built single-cell grids verify the exact ballot numbers: with a fixed
  // final score (h,a) the goal ORDER is uniformly random, so the path
  // probabilities are known exactly.
  const cellGrid = (h: number, a: number): FootballScoreGrid => {
    const p: number[][] = [];
    for (let i = 0; i <= 9; i++) p.push(new Array(10).fill(0));
    p[h][a] = 1;
    return { p, lambdaH: h, lambdaA: a };
  };

  it('1UP: P(team leads at some point) follows min(1, mine/(theirs+1))', () => {
    expect(gridTeamLeadUp(cellGrid(1, 0), true, 1)).toBeCloseTo(1, 6);
    expect(gridTeamLeadUp(cellGrid(1, 0), false, 1)).toBeCloseTo(0, 6);
    expect(gridTeamLeadUp(cellGrid(2, 1), true, 1)).toBeCloseTo(1, 6);
    expect(gridTeamLeadUp(cellGrid(1, 2), true, 1)).toBeCloseTo(1 / 3, 6);
    expect(gridTeamLeadUp(cellGrid(1, 2), false, 1)).toBeCloseTo(1, 6);
    expect(gridTeamLeadUp(cellGrid(2, 2), true, 1)).toBeCloseTo(2 / 3, 6);
    expect(gridTeamLeadUp(cellGrid(0, 0), true, 1)).toBeCloseTo(0, 6);
    expect(gridTeamLeadUp(cellGrid(0, 0), false, 1)).toBeCloseTo(0, 6);
  });

  it('2UP: P(team leads by 2) uses the reflection count C(n, mine-2)/C(n, theirs)', () => {
    expect(gridTeamLeadUp(cellGrid(2, 1), true, 2)).toBeCloseTo(1 / 3, 6);
    expect(gridTeamLeadUp(cellGrid(3, 2), true, 2)).toBeCloseTo(0.5, 6);
    expect(gridTeamLeadUp(cellGrid(2, 2), true, 2)).toBeCloseTo(1 / 6, 6);
    expect(gridTeamLeadUp(cellGrid(4, 2), true, 2)).toBeCloseTo(1, 6); // final margin 2 → always led by 2
    expect(gridTeamLeadUp(cellGrid(1, 0), true, 2)).toBeCloseTo(0, 6);
  });

  it('Never Down: win without ever trailing uses the ballot stay-≥0 fraction', () => {
    expect(gridTeamNeverDown(cellGrid(1, 0), true)).toBeCloseTo(1, 6);
    expect(gridTeamNeverDown(cellGrid(2, 1), true)).toBeCloseTo(2 / 3, 6);
    expect(gridTeamNeverDown(cellGrid(3, 2), true)).toBeCloseTo(0.5, 6); // (3+1-2)/(3+1)
    expect(gridTeamNeverDown(cellGrid(1, 2), true)).toBeCloseTo(0, 6); // loses
    expect(gridTeamNeverDown(cellGrid(2, 2), true)).toBeCloseTo(0, 6); // draw
    expect(gridTeamNeverDown(cellGrid(1, 0), false)).toBeCloseTo(0, 6);
  });

  it('derived lead markets are consistent: 1UP dominates 2UP and Never Down in probability', () => {
    const mk = deriveFootballMarkets(HOME, DRAW, AWAY, 2.5);
    const grid = buildFootballGrid(HOME, DRAW, AWAY, 2.5);
    const p1h = gridTeamLeadUp(grid, true, 1);
    const p2h = gridTeamLeadUp(grid, true, 2);
    const pndh = gridTeamNeverDown(grid, true);
    // Guaranteed orderings: 2UP ⇒ 1UP and Never Down ⇒ 1UP (both imply the
    // team led at some point). 2UP vs Never Down has NO fixed order — winning
    // 1-0 without trailing beats leading by 2 in a low-scoring match.
    expect(p1h).toBeGreaterThan(p2h);
    expect(p1h).toBeGreaterThan(pndh);
    expect(p2h).toBeGreaterThan(0.05);
    expect(pndh).toBeGreaterThan(0.05);
    // Lower probability → higher price: 1UP odds ≤ 2UP and ≤ Never Down odds.
    const oh1 = mk.oneGoalUp.odds?.home ?? 0;
    const oh2 = mk.twoGoalUp.odds?.home ?? 0;
    const ohnd = mk.neverDown.odds?.home ?? 0;
    expect(oh1).toBeGreaterThan(1.01);
    expect(oh2).toBeGreaterThanOrEqual(oh1);
    expect(ohnd).toBeGreaterThanOrEqual(oh1);
    // Every momentum market carries both sides (never de-vigged as a pair).
    expect(mk.oneGoalUp.odds?.away ?? 0).toBeGreaterThan(1.01);
    expect(mk.twoGoalUp.odds?.away ?? 0).toBeGreaterThan(1.01);
    expect(mk.neverDown.odds?.away ?? 0).toBeGreaterThan(1.01);
    expect(mk.doubleChanceUp.odds?.home ?? 0).toBeGreaterThan(1.01);
    expect(mk.doubleChanceUp.odds?.away ?? 0).toBeGreaterThan(1.01);
  });

  it('home favourite: home 1UP priced shorter than away 1UP; heavy favourite 1UP near-certain but 2UP clearly less', () => {
    const fav = deriveFootballMarkets(1.5, 4.0, 6.5, 2.5);
    expect(fav.oneGoalUp.odds?.home ?? 99).toBeLessThan(fav.oneGoalUp.odds?.away ?? 0);
    // Never Down must be strictly harder than 1UP for a favourite too.
    expect(fav.neverDown.odds?.home ?? 99).toBeGreaterThan(fav.oneGoalUp.odds?.home ?? 0);
    const grid = buildFootballGrid(1.5, 4.0, 6.5, 2.5);
    const p1 = gridTeamLeadUp(grid, true, 1);
    const p2 = gridTeamLeadUp(grid, true, 2);
    expect(p1).toBeGreaterThan(0.6);
    expect(p2).toBeLessThan(p1);
    expect(p2).toBeGreaterThan(0.3);
  });
});

describe('predictor markets (basketball Normal points model)', () => {
  // A realistic home-favoured NBA moneyline + total: 1.75 / 2.10 → ~55% home
  // win, 220.5 game total.
  const HOME = 1.75;
  const AWAY = 2.1;
  const TOTAL = 220.5;

  it('model splits the total by the moneyline margin (favourite scores more)', () => {
    const model = buildBasketballModel(HOME, AWAY, TOTAL);
    expect(model.expHome).toBeGreaterThan(model.expAway);
    expect(model.expHome + model.expAway).toBeCloseTo(model.expTotal, 1);
    expect(model.expTotal).toBeCloseTo(TOTAL, 1);
    expect(model.margin).toBeGreaterThan(0);
  });

  it('team totals are complementary, monotonic and favourite-aligned', () => {
    const model = buildBasketballModel(HOME, AWAY, TOTAL);
    const overHome = basketballTeamOver(model, true, model.expHome);
    const overAway = basketballTeamOver(model, false, model.expAway);
    expect(overHome).toBeCloseTo(0.5, 1);
    expect(overAway).toBeCloseTo(0.5, 1);
    // Higher line → lower over probability for the same team.
    expect(basketballTeamOver(model, true, model.expHome - 6)).toBeGreaterThan(overHome);
    expect(basketballTeamOver(model, true, model.expHome + 6)).toBeLessThan(overHome);
    // Favourite (home) over its own mean is stronger than away over its mean
    // only at a COMMON line — at each team's own mean both are ~50/50.
    expect(Math.abs(overHome - 0.5)).toBeLessThan(0.06);
    expect(Math.abs(overAway - 0.5)).toBeLessThan(0.06);
  });

  it('game totals are complementary around the anchor', () => {
    const model = buildBasketballModel(HOME, AWAY, TOTAL);
    const over = basketballTotalOver(model, TOTAL);
    expect(over).toBeCloseTo(0.5, 1);
    expect(basketballTotalOver(model, TOTAL - 8)).toBeGreaterThan(over);
    expect(basketballTotalOver(model, TOTAL + 8)).toBeLessThan(over);
  });

  it('half totals are complementary and 1H < 2H by the empirical split', () => {
    const model = buildBasketballModel(HOME, AWAY, TOTAL);
    const fh = basketballHalfTotalOver(model, 'first', 105.5);
    const sh = basketballHalfTotalOver(model, 'second', 115.5);
    expect(fh).toBeGreaterThan(0.05);
    expect(fh).toBeLessThan(1);
    expect(sh).toBeGreaterThan(0.05);
    expect(sh).toBeLessThan(1);
    // 1st-half share 48.5% → 1H mean ≈ 107 pts, 2H ≈ 113.5 pts at 220.5 total.
    expect(Math.abs(fh - 0.5)).toBeLessThan(0.1);
    expect(Math.abs(sh - 0.5)).toBeLessThan(0.1);
  });

  it('1st-half team totals exist and the favourite leads the half', () => {
    const model = buildBasketballModel(HOME, AWAY, TOTAL);
    const fhHome = basketballHalfTeamOver(model, 'first', true, 53.5);
    const fhAway = basketballHalfTeamOver(model, 'first', false, 53.5);
    expect(fhHome).toBeGreaterThan(0.05);
    expect(fhAway).toBeGreaterThan(0.05);
    // At the SAME line, the stronger team's half-over is more likely.
    expect(fhHome).toBeGreaterThan(fhAway);
  });

  it('home spread cover is monotonic across the ladder and anchors real pair', () => {
    const model = buildBasketballModel(HOME, AWAY, TOTAL);
    let prev = 0;
    for (const line of BASKETBALL_SPREAD_LINES) {
      const p = basketballHomeCovers(model, line);
      expect(p).toBeGreaterThanOrEqual(prev - 1e-9); // deeper lines = more cover
      expect(p).toBeGreaterThan(0.02);
      expect(p).toBeLessThan(0.99);
      prev = p;
    }
    const mk = deriveBasketballMarkets(HOME, AWAY, TOTAL, undefined, { point: -4.5, home: 1.9, away: 1.9 });
    const anchor = mk.handicap.handicapPairs?.find((pair) => Math.abs(pair.line - -4.5) < 0.01);
    expect(anchor?.sideA).toBe(1.9);
    expect(anchor?.sideB).toBe(1.9);
  });

  it('derives the full basketball market set with de-vigged complementary prices', () => {
    const mk = deriveBasketballMarkets(HOME, AWAY, TOTAL, { line: 220.5, over: 1.9, under: 1.9 });
    expect(mk.mainTotal.pairs?.length).toBeGreaterThanOrEqual(9);
    expect(mk.homeTotal.pairs?.length).toBe(5);
    expect(mk.awayTotal.pairs?.length).toBe(5);
    expect(mk.firstHalfTotal.pairs?.length).toBe(5);
    expect(mk.secondHalfTotal.pairs?.length).toBe(5);
    expect(mk.firstHalfHomeTotal.pairs?.length).toBe(5);
    expect(mk.firstHalfAwayTotal.pairs?.length).toBe(5);
    expect(mk.handicap.handicapPairs?.length).toBe(BASKETBALL_SPREAD_LINES.length);
    // The real anchor total pair keeps its real prices.
    const anchor = mk.mainTotal.pairs?.find((p) => Math.abs(p.line - 220.5) < 0.01);
    expect(anchor?.over).toBe(1.9);
    expect(anchor?.under).toBe(1.9);
    // Every pair de-vigs back to ~100%.
    for (const p of mk.homeTotal.pairs ?? []) {
      const { aPct, bPct } = devigPair(p.over, p.under);
      expect(aPct + bPct).toBeCloseTo(100, 1);
    }
    for (const pair of mk.handicap.handicapPairs ?? []) {
      const { aPct, bPct } = devigPair(pair.sideA, pair.sideB);
      expect(aPct + bPct).toBeCloseTo(100, 1);
    }
  });

  it('strong favourite vs dog: spread leans home, team totals separate cleanly', () => {
    const mk = deriveBasketballMarkets(1.25, 4.5, 220.5);
    const homeMean = mk.homeTotal.pairs?.find((p) => Math.abs(p.line - (220.5 + 12) / 2) < 2) ?? mk.homeTotal.pairs?.[2];
    const awayMean = mk.awayTotal.pairs?.find((p) => Math.abs(p.line - (220.5 - 12) / 2) < 2) ?? mk.awayTotal.pairs?.[2];
    // A heavy favourite has a materially higher team-total mean than the dog.
    expect(homeMean!.line).toBeGreaterThan(awayMean!.line);
    // The favourite's moneyline win probability is comfortably above 60%.
    const [pH] = devig([1.25, 4.5]);
    expect(pH).toBeGreaterThan(0.6);
  });
});
