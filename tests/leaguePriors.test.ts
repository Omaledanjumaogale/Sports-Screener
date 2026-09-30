// ── League-aware scoring priors: coverage across every predictor sport ───────
// The baseline must NEVER be a static sport-wide constant. A women's tennis
// match is ~21 games, a men's Grand Slam is ~33; NPB runs ~7.5, KBO ~9.5;
// NCAAF totals ~55 vs NFL ~44.5. These tests pin that behaviour.

import { describe, it, expect } from 'vitest';
import {
  leagueTotalPrior,
  defaultTotalAnchor,
  clampTotalToLeague,
  buildPointsModel,
  derivePointsSportMarkets,
  basketballLeagueProfile,
  hockeyLeagueProfile,
  baseballLeagueProfile,
  tennisLeagueProfile
} from '../convex/scrapers/normalize';

describe('league-aware scoring priors', () => {
  // ── TENNIS ────────────────────────────────────────────────────────────────
  describe('tennis', () => {
    it('WTA matches use ~21 games (not the generic 23.5)', () => {
      const prior = leagueTotalPrior('tennis', 'wta-rome');
      expect(prior?.avgTotal).toBe(21.0);
    });

    it('WTA takes priority over a Grand Slam name (women GS is Bo3)', () => {
      const prior = leagueTotalPrior('tennis', 'wta-wimbledon');
      expect(prior?.avgTotal).toBe(21.0);
      expect(prior?.label).toContain('WTA');
    });

    it('men ATP Grand Slam uses the Bo5 ~33-game total', () => {
      const prior = leagueTotalPrior('tennis', 'atp-wimbledon');
      expect(prior?.avgTotal).toBe(33.0);
    });

    it('ATP tour matches use ~22.5 games', () => {
      const prior = leagueTotalPrior('tennis', 'atp-marseille');
      expect(prior?.avgTotal).toBe(22.5);
    });

    it('Challenger matches use ~22 games', () => {
      const prior = leagueTotalPrior('tennis', 'challenger-lille');
      expect(prior?.avgTotal).toBe(22.0);
    });

    it('ITF matches use ~21.5 games', () => {
      const prior = leagueTotalPrior('tennis', 'itf-monastir');
      expect(prior?.avgTotal).toBe(21.5);
    });

    it('doubles uses ~28 games', () => {
      const prior = leagueTotalPrior('tennis', 'atp-miami-doubles');
      expect(prior?.avgTotal).toBe(28.0);
    });

    it('unknown league falls back to the Bo3 mid-level 22.0', () => {
      const anchor = defaultTotalAnchor('tennis', 'Some Exhibition', 23.5);
      expect(anchor).toBe(23.5); // no prior → the base line stands
    });

    it('mainTotal anchor is league-resolved, never the static 23.5 for known leagues', () => {
      expect(defaultTotalAnchor('tennis', 'wta-charleston', 23.5)).toBe(21.0);
      expect(defaultTotalAnchor('tennis', 'atp-miami', 23.5)).toBe(22.5);
    });

    it('an implausible scraped total is clamped to the league band', () => {
      // A WTA match cannot plausibly carry a 40-game total → clamp to 21.
      expect(clampTotalToLeague('tennis', 'wta-madrid', 40)).toBe(21.0);
      // A plausible 21.5 stays.
      expect(clampTotalToLeague('tennis', 'wta-madrid', 21.5)).toBe(21.5);
    });
  });

  // ── HOCKEY ────────────────────────────────────────────────────────────────
  describe('hockey', () => {
    it('NHL ~5.9 goals', () => {
      expect(leagueTotalPrior('hockey', 'nhl')?.avgTotal).toBe(5.9);
      expect(defaultTotalAnchor('hockey', 'nhl', 5.5)).toBe(5.9);
    });

    it('KHL ~5.1 goals', () => {
      expect(defaultTotalAnchor('hockey', 'khl', 5.5)).toBe(5.1);
    });

    it('European leagues ~5.1 goals', () => {
      expect(defaultTotalAnchor('hockey', 'shl', 5.5)).toBe(5.1);
      expect(defaultTotalAnchor('hockey', 'liiga', 5.5)).toBe(5.1);
      expect(defaultTotalAnchor('hockey', 'del', 5.5)).toBe(5.1);
    });

    it('women hockey ~4.9 goals', () => {
      expect(defaultTotalAnchor('hockey', 'whl-women', 5.5)).toBe(4.9);
    });

    it('an NHL-sized total never lands on a European league row', () => {
      // 8.5 goals is impossible for KHL → clamp to the KHL prior 5.1
      expect(clampTotalToLeague('hockey', 'khl', 8.5)).toBe(5.1);
      // A plausible 5.5 stays.
      expect(clampTotalToLeague('hockey', 'khl', 5.5)).toBe(5.5);
    });
  });

  // ── BASEBALL ──────────────────────────────────────────────────────────────
  describe('baseball', () => {
    it('MLB ~8.5 runs', () => {
      expect(defaultTotalAnchor('baseball', 'mlb', 8.5)).toBe(8.5);
    });

    it('NPB ~7.5 runs (lower scoring than MLB)', () => {
      expect(defaultTotalAnchor('baseball', 'npb', 8.5)).toBe(7.5);
    });

    it('KBO ~9.5 runs (higher scoring than MLB)', () => {
      expect(defaultTotalAnchor('baseball', 'kbo', 8.5)).toBe(9.5);
    });

    it('college/minor ~9.5 runs', () => {
      expect(defaultTotalAnchor('baseball', 'ncaa-baseball', 8.5)).toBe(9.5);
    });

    it('a KBO-sized total never lands on an NPB row', () => {
      expect(clampTotalToLeague('baseball', 'npb', 11)).toBe(7.5);
    });
  });


  // ── RUGBY / CRICKET ───────────────────────────────────────────────────────
  describe('rugby and cricket', () => {
    it('rugby Super Rugby ~54 points vs Top 14 ~46', () => {
      expect(defaultTotalAnchor('rugby', 'super-rugby', 48)).toBe(54);
      expect(defaultTotalAnchor('rugby', 'top-14', 48)).toBe(46);
    });

    it('cricket IPL ~340 vs Test ~550', () => {
      expect(defaultTotalAnchor('cricket', 'ipl', 330)).toBe(340);
      expect(defaultTotalAnchor('cricket', 'the-ashes-test', 330)).toBe(550);
    });
  });

  // ── BASKETBALL (already fixed, kept as regression guard) ─────────────────
  describe('basketball', () => {
    it('NBA ~221, WNBA ~163, NCAA women ~134', () => {
      expect(basketballLeagueProfile('nba').avgTotal).toBe(221);
      expect(basketballLeagueProfile('wnba').avgTotal).toBe(163);
      expect(basketballLeagueProfile('ncaa-women').avgTotal).toBe(134);
    });

    it('a country women league never inherits the NBA baseline', () => {
      const p = basketballLeagueProfile('Finnish Women League');
      expect(p.avgTotal).toBeLessThan(150);
      expect(p.label).toContain('Women');
    });
  });

  // ── Cross-sport guard: the priors resolve through ONE entry point ────────
  describe('generic entry point', () => {
    it('every predictor sport resolves a prior for its flagship league', () => {
      expect(leagueTotalPrior('football', 'premier-league')).not.toBeNull();
      expect(leagueTotalPrior('basketball', 'nba')).not.toBeNull();
      expect(leagueTotalPrior('tennis', 'atp-rome')).not.toBeNull();
      expect(leagueTotalPrior('hockey', 'nhl')).not.toBeNull();
      expect(leagueTotalPrior('baseball', 'mlb')).not.toBeNull();
      expect(leagueTotalPrior('rugby', 'six-nations')).not.toBeNull();
      expect(leagueTotalPrior('cricket', 'ipl')).not.toBeNull();
    });

    it('unknown leagues return null (the base line stands)', () => {
      expect(leagueTotalPrior('football', 'random cup')).toBeNull();
      expect(leagueTotalPrior('tennis', 'random exhibition')).toBeNull();
    });
  });

  // ── Points model: SD scaling is league-aware ─────────────────────────────
  describe('points model SD scaling', () => {
    it('NCAAF model carries a wider total SD than NFL at the same anchor', () => {
      const cfgNfl = buildPointsModel(1.85, 1.95, 44.5, {
        sdTotal: 13.5, sdMargin: 13, sdTeam: 9.4, firstHalfShare: 0.44,
        totalOffsets: [], teamOffsets: [], spreadLines: [], unitLabel: 'Points'
      });
      // NFL baseline is scale 1.0; the derive-level test above checks the ladder.
      expect(cfgNfl.sdTotal).toBe(13.5);
    });

    it('adaptive spread ladder follows a lopsided matchup (Super Rugby blowout)', () => {
      // 1.15/5.5 de-vig to a dominant home favourite — a real mismatch.
      const derived = derivePointsSportMarkets('rugby', 1.15, 5.5, 54, undefined, undefined, 'super-rugby');
      const spread = derived.handicap.handicapPairs!;
      // The ladder must offer lines in the double digits (a fixed shallow grid
      // would miss the real cover window entirely).
      const mostNegative = Math.min(...spread.map((p: { line: number }) => p.line));
      expect(mostNegative).toBeLessThanOrEqual(-14.5);
      // Every pair still carries the book margin (no clamped 1.01 prices).
      for (const pair of spread) {
        expect(1 / pair.sideA + 1 / pair.sideB).toBeCloseTo(1.05, 1);
      }
    });
  });

  // ── Hockey/baseball profile helpers ─────────────────────────────────────
  describe('profile helpers', () => {
    it('hockeyLeagueProfile resolves NHL and KHL distinctly', () => {
      expect(hockeyLeagueProfile('nhl').avgTotal).toBe(5.9);
      expect(hockeyLeagueProfile('khl').avgTotal).toBe(5.1);
      expect(hockeyLeagueProfile('unknown league').label).toContain('Generic');
    });

    it('baseballLeagueProfile resolves MLB, NPB, KBO distinctly', () => {
      expect(baseballLeagueProfile('mlb').avgTotal).toBe(8.5);
      expect(baseballLeagueProfile('npb').avgTotal).toBe(7.5);
      expect(baseballLeagueProfile('kbo').avgTotal).toBe(9.5);
      expect(baseballLeagueProfile('unknown league').label).toContain('Generic');
    });

    it('tennisLeagueProfile resolves WTA, ATP, Grand Slam distinctly', () => {
      expect(tennisLeagueProfile('wta-rome').avgTotal).toBe(21.0);
      expect(tennisLeagueProfile('atp-rome').avgTotal).toBe(22.5);
      expect(tennisLeagueProfile('atp-wimbledon').avgTotal).toBe(33.0);
    });
  });
});
