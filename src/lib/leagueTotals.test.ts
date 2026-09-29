import { describe, it, expect } from 'vitest';
import {
  normalizeMatch,
  deriveBasketballMarkets,
  buildBasketballModel,
  basketballLeagueProfile,
  resolveBasketballAnchor,
  defaultTotalAnchor,
  clampTotalToLeague,
  leagueTotalPrior,
  BASKETBALL_LEAGUE_PRIORS
} from '../../convex/scrapers/normalize';
import type { ScrapeMatch } from '../../convex/scrapers/betwatch';

// ── The generalization bug this file guards ───────────────────────────────────
// NBA scoring must never leak onto other competitions. A women's / lower-country
// basketball fixture must NOT be offered 200+ full-game totals, ~100+ team
// totals or ~100+ half totals — those only belong to the NBA (and a few elite
// men's leagues).

function basketballMatch(league: string, oddsText?: string): ScrapeMatch {
  return {
    source: 'test',
    sourceUrl: 'https://example.test',
    league,
    homeTeam: 'Home Hoops',
    awayTeam: 'Away Hoops',
    startTime: Date.now(),
    markets: ['winner', 'mainTotal'],
    oddsText
  };
}

const BASKETBALL_LEAGUES: [string, number][] = [
  ['WNBA', 163],
  ['WNBA Regular Season', 163],
  ['Women - NCAA', 134],
  ['NCAA Women Division I', 134],
  ['Finland Korisliiga Women', 142],
  ['Spain Liga Femenina', 142],
  ['W-League Australia', 142],
  ['NCAAB', 145],
  ['EuroLeague', 168],
  ['Spain - Liga Endesa ACB', 172],
  ['Germany BBL', 171],
  ['Australia NBL', 181],
  ['China CBA', 190],
  ['NBA', 221],
  ['NBA G League', 221]
];

describe('league-aware basketball scoring priors', () => {
  it('recognises each competition by name and never falls back to the NBA number', () => {
    for (const [league, expected] of BASKETBALL_LEAGUES) {
      expect(basketballLeagueProfile(league).avgTotal).toBe(expected);
    }
    // Unknown league → mid-level generic, NOT the NBA baseline.
    expect(basketballLeagueProfile('Some Unlisted League').avgTotal).toBe(162);
    expect(basketballLeagueProfile(undefined).avgTotal).toBe(162);
  });

  it('women\'s competitions are resolved before the generic men\'s patterns', () => {
    // "NCAA Women" must not be swallowed by the generic women's row (142) nor
    // by the NCAA men's row (145).
    expect(basketballLeagueProfile('NCAA Women').label).toBe('NCAA Women');
    expect(basketballLeagueProfile('Finland Korisliiga Women').label).toContain("Women's");
    expect(basketballLeagueProfile('WNBA').avgTotal).toBe(163);
  });

  it('a country/women\'s ladder never offers 200+ game, 100+ team or 100+ half lines', () => {
    const lowerLeagues = ['WNBA', 'NCAA Women', 'Finland Korisliiga Women', 'Germany BBL', 'Generic League'];
    for (const league of lowerLeagues) {
      const mk = deriveBasketballMarkets(1.8, 2.0, 0, undefined, undefined, league);
      const gameLines = (mk.mainTotal.pairs ?? []).map((p) => p.line);
      const teamLines = [
        ...(mk.homeTotal.pairs ?? []).map((p) => p.line),
        ...(mk.awayTotal.pairs ?? []).map((p) => p.line)
      ];
      const halfLines = [
        ...(mk.firstHalfTotal.pairs ?? []).map((p) => p.line),
        ...(mk.secondHalfTotal.pairs ?? []).map((p) => p.line)
      ];
      const halfTeamLines = [
        ...(mk.firstHalfHomeTotal.pairs ?? []).map((p) => p.line),
        ...(mk.firstHalfAwayTotal.pairs ?? []).map((p) => p.line)
      ];
      expect(Math.max(...gameLines), `${league} game total`).toBeLessThan(200);
      expect(Math.max(...teamLines), `${league} team total`).toBeLessThan(100);
      expect(Math.max(...halfLines), `${league} half total`).toBeLessThan(100);
      expect(Math.max(...halfTeamLines), `${league} half team total`).toBeLessThan(100);
    }
  });

  it('the NBA keeps its 200+ full-game totals', () => {
    const mk = deriveBasketballMarkets(1.8, 2.0, 0, undefined, undefined, 'NBA');
    const gameLines = (mk.mainTotal.pairs ?? []).map((p) => p.line);
    expect(Math.max(...gameLines)).toBeGreaterThan(200);
  });

  it('an NBA-sized scraped total on a women\'s fixture is rejected in favour of the league prior', () => {
    expect(resolveBasketballAnchor('WNBA', 245.5)).toBe(163);
    expect(resolveBasketballAnchor('Finland Korisliiga Women', 228.5)).toBe(142);
    // A real, plausible WNBA total is still trusted.
    expect(resolveBasketballAnchor('WNBA', 168.5)).toBe(168.5);
    // The BASE_LINES placeholders are never a real anchor.
    expect(resolveBasketballAnchor('WNBA', 158.5)).toBe(163);
    // NBA keeps a real 230.5 line.
    expect(resolveBasketballAnchor('NBA', 230.5)).toBe(230.5);
  });

  it('the derived model itself is league-scaled (mean and SD)', () => {
    const nba = buildBasketballModel(1.8, 2.0, 0, 'NBA');
    const wnba = buildBasketballModel(1.8, 2.0, 0, 'WNBA');
    expect(nba.expTotal).toBe(221);
    expect(wnba.expTotal).toBe(163);
    // Lower-scoring leagues carry a compressed (never larger) total SD.
    expect(wnba.sdTotal).toBeLessThanOrEqual(nba.sdTotal);
  });

  it('normalizeMatch wires the league prior into the basketball scope', () => {
    const wnba = normalizeMatch(basketballMatch('WNBA', 'h2h=1.80,2.00'), 'basketball');
    const gameLines = (wnba.scope.markets.mainTotal?.pairs ?? []).map((p) => p.line);
    expect(gameLines.length).toBeGreaterThan(0);
    expect(Math.max(...gameLines)).toBeLessThan(200);

    const nba = normalizeMatch(basketballMatch('NBA', 'h2h=1.80,2.00'), 'basketball');
    const nbaLines = (nba.scope.markets.mainTotal?.pairs ?? []).map((p) => p.line);
    expect(Math.max(...nbaLines)).toBeGreaterThan(200);
  });
});

describe('league / format priors across the other sports', () => {
  it('covers the flagship vs. secondary competitions per sport without overlap', () => {
    expect(leagueTotalPrior('hockey', 'NHL')?.avgTotal).toBe(5.9);
    expect(leagueTotalPrior('hockey', 'KHL')?.avgTotal).toBe(5.1);
    expect(leagueTotalPrior('hockey', 'SHL')?.avgTotal).toBe(5.1);
    expect(leagueTotalPrior('baseball', 'MLB')?.avgTotal).toBe(8.5);
    expect(leagueTotalPrior('baseball', 'NPB')?.avgTotal).toBe(7.5);
    expect(leagueTotalPrior('baseball', 'KBO')?.avgTotal).toBe(9.5);
    expect(leagueTotalPrior('americanfootball', 'NFL')?.avgTotal).toBe(44.5);
    expect(leagueTotalPrior('americanfootball', 'NCAA')?.avgTotal).toBe(55);
    expect(leagueTotalPrior('americanfootball', 'CFL')?.avgTotal).toBe(51);
  });

  it('defaultTotalAnchor uses the league prior and falls back to the sport base line', () => {
    expect(defaultTotalAnchor('hockey', 'NHL', 5.5)).toBe(5.9);
    expect(defaultTotalAnchor('hockey', 'Unknown League', 5.5)).toBe(5.5);
    expect(defaultTotalAnchor('baseball', 'NPB', 8.5)).toBe(7.5);
    expect(defaultTotalAnchor('americanfootball', 'CFL', 44.5)).toBe(51);
    expect(defaultTotalAnchor('football', 'Bundesliga', 2.5)).toBe(3.1);
    expect(defaultTotalAnchor('football', 'Premier League', 2.5)).toBe(2.7);
    expect(defaultTotalAnchor('football', 'Unlisted League', 2.5)).toBe(2.5);
  });

  it('clampTotalToLeague rejects totals outside the league\'s plausible band only', () => {
    expect(clampTotalToLeague('hockey', 'NHL', 6.5)).toBe(6.5);
    expect(clampTotalToLeague('hockey', 'NHL', 14.5)).toBe(5.9);
    expect(clampTotalToLeague('baseball', 'MLB', 9.0)).toBe(9.0);
    expect(clampTotalToLeague('baseball', 'NPB', 11.0)).toBe(7.5);
    // Unknown league → no opinion, the scraped value is kept.
    expect(clampTotalToLeague('hockey', 'Unknown', 99)).toBe(99);
  });

  it('normalizeMatch gives a KHL fixture a lower total ladder than an NHL fixture', () => {
    const mk = (league: string): ScrapeMatch => ({
      source: 'test',
      sourceUrl: 'https://example.test',
      league,
      homeTeam: 'Home Ice',
      awayTeam: 'Away Ice',
      startTime: Date.now(),
      markets: ['winner', 'mainTotal'],
      oddsText: 'h2h=1.90,1.90'
    });
    const nhl = normalizeMatch(mk('NHL'), 'hockey');
    const khl = normalizeMatch(mk('KHL'), 'hockey');
    const nhlOver = nhl.scope.markets.mainTotal?.pairs?.find((p) => p.line === 5.5)?.over ?? 0;
    const khlOver = khl.scope.markets.mainTotal?.pairs?.find((p) => p.line === 5.5)?.over ?? 0;
    // Same line: the lower-scoring league prices Over longer (higher odds).
    expect(khlOver).toBeGreaterThan(nhlOver);
  });
});

describe('basketball prior table integrity', () => {
  it('has no duplicate pattern and every row carries a band', () => {
    const src = BASKETBALL_LEAGUE_PRIORS.map((p) => p.pattern.source);
    expect(new Set(src).size).toBe(src.length);
    for (const p of BASKETBALL_LEAGUE_PRIORS) expect(p.band).toBeGreaterThan(0);
  });
});
