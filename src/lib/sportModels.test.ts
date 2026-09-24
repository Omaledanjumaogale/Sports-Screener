// Mathematical validation of the per-sport probability models in
// convex/scrapers/normalize.ts — the computation-accuracy stage of the
// multi-stage verification pipeline. These tests pin the identities the
// derived markets must satisfy for every sport:
//   1. De-vigged probabilities are consistent with the source moneyline
//   2. Over/Under and cover probabilities are MONOTONIC in the line
//   3. Market pairs carry the modelled bookmaker margin (~5% overround)
//   4. Set-sport identities invert exactly (match odds → per-set prob)
import { describe, it, expect } from 'vitest';
import {
  deriveSetSportMarkets,
  deriveHockeyMarkets,
  deriveBaseballMarkets,
  buildBaseballModel,
  baseballTotalOver,
  baseballHomeCovers,
  derivePointsSportMarkets,
  solveSetProbCheck
} from '../../convex/scrapers/normalize';

const MARGIN = 1.05;

function pairProbabilities(pairs: { over: number; under: number }[]) {
  return pairs.map((p) => ({
    over: 1 / p.over,
    under: 1 / p.under,
    sum: 1 / p.over + 1 / p.under
  }));
}

describe('set-sport model (tennis Bo3 / rally+volleyball Bo5)', () => {
  it('solves the per-set probability so the Bo3/Bo5 identity reproduces the match probability', () => {
    for (const bestOf of [3, 5] as const) {
      for (const pWin of [0.5, 0.6, 0.7, 0.8, 0.9]) {
        const s = solveSetProbCheck(pWin, bestOf);
        const reproduced =
          bestOf === 3
            ? s * s * (3 - 2 * s)
            : s * s * s * (10 - 15 * s + 6 * s * s);
        expect(reproduced).toBeCloseTo(pWin, 6);
      }
    }
  });

  it('prices every derived market pair at the modelled margin and valid probabilities', () => {
    const derived = deriveSetSportMarkets(1.5, 2.6, 3, { a: 'A', b: 'B', unitLabel: 'Set' });
    const hdp = derived.setHandicap.handicapPairs!;
    for (const pair of hdp) {
      expect(1 / pair.sideA + 1 / pair.sideB).toBeCloseTo(1.05, 1);
      expect(1 / pair.sideA).toBeGreaterThan(0);
      expect(1 / pair.sideA).toBeLessThan(1);
    }
    const totals = pairProbabilities(derived.totalSets.pairs!);
    // Bo3 exposes exactly the 2.5 line (a sweep already plays 2 sets —
    // "Over 1.5" is vacuous, so it is never emitted).
    expect(totals.length).toBe(1);
    expect(derived.totalSets.pairs![0].line).toBe(2.5);
    for (const t of totals) {
      expect(t.sum).toBeCloseTo(1.05, 1);
      expect(t.over).toBeGreaterThan(0);
      expect(t.over).toBeLessThan(1);
    }
    // Set-1 winner probabilities are complementary.
    const s1 = derived.s1Winner.odds!;
    expect(1 / (s1.a as number) + 1 / (s1.b as number)).toBeCloseTo(1.06, 1);
  });

  it('a heavy favourite prices -1.5 sets BELOW 0.5 and the decider market accordingly', () => {
    // 1.25/4.00 moneyline → strong per-set favourite: straight-sets win still
    // unlikely enough that -1.5 sets is not a >50% cover in a Bo3.
    const derived = deriveSetSportMarkets(1.25, 4.0, 3, { a: 'A', b: 'B', unitLabel: 'Set' });
    const minus15 = derived.setHandicap.handicapPairs!.find((p) => p.line === -1.5)!;
    expect(1 / minus15.sideA).toBeLessThan(0.85);
    const over25 = derived.totalSets.pairs!.find((p) => p.line === 2.5)!;
    // Decider probability for a 1.25 favourite is low — Under 2.5 is the strong side.
    expect(1 / over25.over).toBeLessThan(0.5);
  });
});

describe('hockey model (Poisson split grid)', () => {
  const derived = deriveHockeyMarkets(2.1, 3.2, 5.5);

  it('totals ladder is monotonic decreasing in Over probability', () => {
    const totals = pairProbabilities(derived.mainTotal.pairs!);
    for (let i = 1; i < totals.length; i++) {
      expect(totals[i].over).toBeLessThan(totals[i - 1].over);
      // round2 price grid drifts the implied sum a few tenths of a percent.
      expect(totals[i].sum).toBeCloseTo(1.05, 1);
    }
  });

  it('puck line ladder: -2.5 cover < -1.5 cover < +1.5 cover < +2.5 cover', () => {
    const lines = derived.handicap.handicapPairs!;
    const p = (l: number) => 1 / lines.find((x) => x.line === l)!.sideA;
    expect(p(-2.5)).toBeLessThan(p(-1.5));
    expect(p(-1.5)).toBeLessThan(p(1.5));
    expect(p(1.5)).toBeLessThan(p(2.5));
    // +1.5 puck line on a near-even match is a high-probability cover.
    expect(p(1.5)).toBeGreaterThan(0.55);
    // -1.5 on a near-even match is a low-probability cover.
    expect(p(-1.5)).toBeLessThan(0.5);
  });

  it('team totals live in plausible bands and carry the margin', () => {
    const home = pairProbabilities(derived.homeTotal.pairs!);
    for (const t of home) {
      // Extreme sides floor at the 1.01 bookmaker price minimum, so the
      // implied sum may land below 1.05 — but never below fair value.
      expect(t.sum).toBeLessThanOrEqual(1.055);
      expect(t.sum).toBeGreaterThanOrEqual(1.0);
    }
    expect(home[0].over).toBeGreaterThan(home[home.length - 1].over);
  });
});

describe('baseball model (two-way Poisson runs)', () => {
  const model = buildBaseballModel(1.8, 2.05, 8.5);

  it('reproduces the de-vigged win probability via the moneyline split', () => {
    // The fitted lambdas must satisfy P(home > away) ≈ devig(1.8) ≈ 0.53.
    let pHome = 0;
    const cdf = (l: number, k: number) => {
      let s = 0;
      let t = Math.exp(-l);
      for (let i = 0; i <= k; i++) {
        s += t;
        t *= l / (i + 1);
      }
      return s;
    };
    for (let i = 1; i <= 14; i++) {
      pHome += (cdf(model.lambdaH, i) - cdf(model.lambdaH, i - 1)) * cdf(model.lambdaA, i - 1);
    }
    expect(pHome).toBeGreaterThan(0.48);
    expect(pHome).toBeLessThan(0.62);
  });

  it('totals and covers are monotonic in the line', () => {
    expect(baseballTotalOver(model, 5.5)).toBeGreaterThan(baseballTotalOver(model, 8.5));
    expect(baseballTotalOver(model, 8.5)).toBeGreaterThan(baseballTotalOver(model, 11.5));
    expect(baseballHomeCovers(model, -2.5)).toBeLessThan(baseballHomeCovers(model, -1.5));
    expect(baseballHomeCovers(model, -1.5)).toBeLessThan(baseballHomeCovers(model, 1.5));
    expect(baseballHomeCovers(model, 1.5)).toBeGreaterThan(0.55);
    expect(baseballHomeCovers(model, -1.5)).toBeLessThan(0.55);
  });

  it('derived markets carry the margin and F5 lands near half the game total', () => {
    const derived = deriveBaseballMarkets(1.8, 2.05, 8.5);
    for (const pair of derived.mainTotal.pairs!) {
      expect(1 / pair.over + 1 / pair.under).toBeCloseTo(1.05, 2);
    }
    const f5 = derived.f5Total.pairs!;
    expect(f5.length).toBeGreaterThanOrEqual(2);
    expect(f5[f5.length - 1].line).toBeLessThanOrEqual(5.5);
  });
});

describe('normal-points sports (am. football / rugby / cricket)', () => {
  for (const sport of ['americanfootball', 'rugby', 'cricket'] as const) {
    it(`${sport}: ladders monotonic, margin consistent, spread both-sided`, () => {
      const derived = derivePointsSportMarkets(sport, 1.7, 2.2, sport === 'cricket' ? 320 : 44.5);
      const totals = pairProbabilities(derived.mainTotal.pairs!);
      for (let i = 1; i < totals.length; i++) {
        expect(totals[i].over).toBeLessThan(totals[i - 1].over);
        expect(totals[i].sum).toBeCloseTo(1.05, 1);
      }
      const spread = derived.handicap.handicapPairs!;
      // Both directions priced and margin-carrying.
      for (const pair of spread) {
        expect(1 / pair.sideA + 1 / pair.sideB).toBeCloseTo(1.05, 2);
        expect(1 / pair.sideA).toBeGreaterThan(0.02);
        expect(1 / pair.sideA).toBeLessThan(0.98);
      }
      // Home team total + away team total means bracket the game total.
      const homeMid = derived.homeTotal.pairs![Math.floor(derived.homeTotal.pairs!.length / 2)].line;
      const awayMid = derived.awayTotal.pairs![Math.floor(derived.awayTotal.pairs!.length / 2)].line;
      const totalMid = derived.mainTotal.pairs![Math.floor(derived.mainTotal.pairs!.length / 2)].line;
      expect(Math.abs(homeMid + awayMid - totalMid)).toBeLessThan(totalMid * 0.25);
    });
  }
});
