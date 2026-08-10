import { describe, it, expect } from 'vitest';
import { countryForLeague, displayLeague } from './leagueCountries';

describe('leagueCountries', () => {
  it('maps famous leagues to their home country', () => {
    expect(countryForLeague('Premier League')).toBe('England');
    expect(countryForLeague('La Liga')).toBe('Spain');
    expect(countryForLeague('Bundesliga')).toBe('Germany');
    expect(countryForLeague('Serie A')).toBe('Italy');
    expect(countryForLeague('Ligue 1')).toBe('France');
    expect(countryForLeague('Eredivisie')).toBe('Netherlands');
    expect(countryForLeague('NBA')).toBe('USA');
    expect(countryForLeague('MLB')).toBe('USA');
    expect(countryForLeague('MLS')).toBe('USA');
    expect(countryForLeague('Liga MX')).toBe('Mexico');
    expect(countryForLeague('Allsvenskan')).toBe('Sweden');
    expect(countryForLeague('Eliteserien')).toBe('Norway');
  });

  it('formats display as "[Country] - [League]"', () => {
    expect(displayLeague('Premier League')).toBe('England - Premier League');
    expect(displayLeague('La Liga')).toBe('Spain - La Liga');
    expect(displayLeague('NBA')).toBe('USA - NBA');
    expect(displayLeague('Eredivisie')).toBe('Netherlands - Eredivisie');
  });

  it('strips a leading country adjective to avoid duplication', () => {
    expect(displayLeague('English Premier League')).toBe('England - Premier League');
    expect(displayLeague('Scottish Premiership')).toBe('Scotland - Premiership');
    expect(displayLeague('Egyptian Premier League')).toBe('Egypt - Premier League');
    expect(displayLeague('Israeli Premier League')).toBe('Israel - Premier League');
  });

  it('handles colon-separated and inline-country names', () => {
    expect(displayLeague('Colombia: Primera A')).toBe('Colombia - Primera A');
    expect(displayLeague('Brazil Serie A')).toBe('Brazil - Serie A');
    expect(displayLeague('Argentina Primera')).toBe('Argentina - Primera');
  });

  it('passes through international/continental competitions unchanged', () => {
    expect(displayLeague('UEFA Champions League')).toBe('UEFA Champions League');
    expect(displayLeague('FIFA World Cup')).toBe('FIFA World Cup');
    expect(displayLeague('ATP')).toBe('ATP');
    expect(displayLeague('NHL')).toBe('NHL');
    expect(displayLeague('Africa Cup of Nations')).toBe('Africa Cup of Nations');
  });

  it('is idempotent and safe on unknown/empty values', () => {
    expect(displayLeague('England - Premier League')).toBe('England - Premier League');
    expect(displayLeague('Scheduled Fixture')).toBe('Scheduled Fixture');
    expect(displayLeague('')).toBe('');
    expect(displayLeague('Other')).toBe('Other');
  });
});
