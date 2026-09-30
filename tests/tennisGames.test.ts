// Verify the tennis games model: expected games must move with BOTH the
// tournament tier and the matchup, never sit on a static 23.5.
import { describe, it, expect } from 'vitest';
import {
  deriveSetSportMarkets,
  expectedSetsPlayed,
  expectedGamesPerSet,
  setGamesModel,
  leagueTotalPrior
} from '../convex/scrapers/normalize';

const anchor = (league: string) => leagueTotalPrior('tennis', league)?.avgTotal ?? 22.0;

describe('tennis games model (MEG)', () => {
  it('every tier resolves its own total, and tier order is correct', () => {
    const wta = setGamesModel(0.62, 3, anchor('wta-rome')).expGames;
    const itf = setGamesModel(0.62, 3, anchor('itf-monastir')).expGames;
    const ch = setGamesModel(0.62, 3, anchor('challenger-tallahassee')).expGames;
    const atp = setGamesModel(0.62, 3, anchor('atp-rome')).expGames;
    const dbl = setGamesModel(0.62, 3, anchor('atp-doubles-rome')).expGames;
    const gs = setGamesModel(0.62, 5, anchor('atp-wimbledon')).expGames;

    // WTA < ITF < Challenger < ATP < doubles (real average games per tier).
    expect(wta).toBeLessThan(itf);
    expect(itf).toBeLessThan(ch);
    expect(ch).toBeLessThan(atp);
    expect(atp).toBeLessThan(dbl);
    // A men's Bo5 Grand Slam is in a different league entirely.
    expect(gs).toBeGreaterThan(atp + 8);
    // None of them may sit on the retired static 23.5 constant.
    for (const v of [wta, itf, ch, atp, dbl, gs]) expect(v).not.toBe(23.5);
  });

  it('WTA runs shorter than ATP at the same competitiveness', () => {
    const atp = setGamesModel(0.6, 3, anchor('atp-rome')).expGames;
    const wta = setGamesModel(0.6, 3, anchor('wta-rome')).expGames;
    expect(wta).toBeLessThan(atp);
  });

  it('a closer matchup runs longer than a mismatch', () => {
    const even = setGamesModel(0.5, 3, 22.5).expGames;
    const blowout = setGamesModel(0.9, 3, 22.5).expGames;
    // A 50/50 match runs several games longer than a rout at the same tier.
    expect(even).toBeGreaterThan(blowout + 3);
    // Grand Slam Bo5 exaggerates the same difference.
    const evenBo5 = setGamesModel(0.5, 5, 33).expGames;
    const blowoutBo5 = setGamesModel(0.9, 5, 33).expGames;
    expect(evenBo5).toBeGreaterThan(blowoutBo5 + 6);
  });

  it('set-count and games-per-set expectations are monotone in the right direction', () => {
    expect(expectedSetsPlayed(0.5, 3)).toBeGreaterThan(expectedSetsPlayed(0.9, 3));
    expect(expectedSetsPlayed(0.5, 5)).toBeGreaterThan(expectedSetsPlayed(0.9, 5));
    expect(expectedGamesPerSet(0.5)).toBeGreaterThan(expectedGamesPerSet(0.9));
    // A parity Bo3 lands in the real ATP/WTA band (22-24.5 games).
    const parity = expectedSetsPlayed(0.5, 3) * expectedGamesPerSet(0.5);
    expect(parity).toBeGreaterThan(22);
    expect(parity).toBeLessThan(24.5);
  });

  it('per-side totals sum to the match total', () => {
    const m = setGamesModel(0.66, 3, 22.5);
    expect(m.expGamesA + m.expGamesB).toBeCloseTo(m.expGames, 1);
    expect(m.expGamesA).toBeGreaterThan(m.expGamesB);
  });

  it('emits a games ladder, per-side totals and a 1st-set total', () => {
    const d = deriveSetSportMarkets(1.65, 2.25, 3, { a: 'Player A', b: 'Player B', unitLabel: 'Set' }, {
      anchor: anchor('atp-rome'),
      label: 'ATP Tour (Bo3)',
      unit: 'Games'
    });
    expect(d.mainTotal?.pairs?.length ?? 0).toBeGreaterThanOrEqual(6);
    expect(d.homeTotal?.pairs?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(d.awayTotal?.pairs?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(d.s1Total?.pairs?.length ?? 0).toBeGreaterThanOrEqual(3);
    // Every pair carries the book margin and stays within a quotable range.
    for (const m of [d.mainTotal!, d.homeTotal!, d.awayTotal!, d.s1Total!]) {
      for (const p of m.pairs!) {
        expect(1 / p.over + 1 / p.under).toBeCloseTo(1.05, 1);
        expect(p.over).toBeLessThanOrEqual(15);
        expect(p.under).toBeLessThanOrEqual(15);
        expect(p.over).toBeGreaterThan(1.01);
        expect(p.under).toBeGreaterThan(1.01);
      }
    }
    // Over probability must fall as the line rises (a valid distribution).
    const main = d.mainTotal!.pairs!;
    for (let i = 1; i < main.length; i++) {
      const prev = 1 / main[i - 1].over;
      const cur = 1 / main[i].over;
      expect(cur).toBeLessThan(prev);
    }
    // 1st-set lines live in the set range, never in match range.
    for (const p of d.s1Total!.pairs!) expect(p.line).toBeLessThanOrEqual(14);
  });

  it('a real scraped line anchors the ladder to it', () => {
    const d = deriveSetSportMarkets(1.65, 2.25, 3, { a: 'A', b: 'B', unitLabel: 'Set' }, {
      anchor: 26.5,
      label: 'custom',
      unit: 'Games'
    });
    const lines = d.mainTotal!.pairs!.map((p) => p.line);
    expect(Math.max(...lines)).toBeGreaterThan(24);
  });
});

describe('tennis research & analysis summary', () => {
  // The ranked summary consumes the client analyzer's picks, so the games
  // over/under and the 1st-set over/under must be IN that pool with real
  // probabilities — not just present on the stored scope.
  it('ranks games totals and 1st-set totals with percentages', async () => {
    const { analyzeTennis } = await import('../src/lib/engine');
    const d = deriveSetSportMarkets(1.62, 2.30, 3, { a: 'Sinner J.', b: 'Alcaraz C.', unitLabel: 'Set' }, {
      anchor: anchor('atp-rome'),
      label: 'ATP Tour (Bo3)',
      unit: 'Games'
    });
    const scope = {
      id: 'ft',
      title: 'Sinner J. vs Alcaraz C.',
      teamA: 'Sinner J.',
      teamB: 'Alcaraz C.',
      leaguePreset: 'ATP',
      format: 'bo3',
      markets: {
        winner: { id: 'winner', kind: 'winner', title: 'Match Winner', odds: { a: 1.62, b: 2.3 } },
        mainTotal: d.mainTotal!,
        homeTotal: d.homeTotal!,
        awayTotal: d.awayTotal!,
        s1Total: d.s1Total!,
        totalSets: d.totalSets,
        setHandicap: d.setHandicap
      }
    } as never;

    const analysis = analyzeTennis(scope);
    const main = analysis.picks.filter((p) => p.marketId === 'mainTotal');
    const s1 = analysis.picks.filter((p) => p.marketId === 's1Total');

    // Both horizons surface, and every pick carries a real percentage.
    expect(main.length).toBeGreaterThanOrEqual(2);
    expect(s1.length).toBeGreaterThanOrEqual(2);
    for (const p of [...main, ...s1]) {
      expect(p.probability).toBeGreaterThan(0);
      expect(p.probability).toBeLessThanOrEqual(100);
    }
    // The pool is ranked highest-percentage first.
    const probs = analysis.picks.map((p) => p.probability);
    for (let i = 1; i < probs.length; i++) expect(probs[i]).toBeLessThanOrEqual(probs[i - 1]);
    // The 1st-set lines must sit in set range, never match range.
    for (const p of s1) {
      const line = Number(String(p.label).replace(/[^\d.]/g, ''));
      expect(line).toBeLessThanOrEqual(13.5);
    }
  });
});
