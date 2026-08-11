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

  it('maps minor leagues across all sports', () => {
    // Football
    expect(countryForLeague('Veikkausliiga')).toBe('Finland');
    expect(countryForLeague('Besta deild')).toBe('Iceland');
    expect(countryForLeague('Cyprus First Division')).toBe('Cyprus');
    expect(countryForLeague('Croatian First League')).toBe('Croatia');
    expect(countryForLeague('Serbian SuperLiga')).toBe('Serbia');
    expect(countryForLeague('Romanian Liga 1')).toBe('Romania');
    expect(countryForLeague('Hungarian NB I')).toBe('Hungary');
    expect(countryForLeague('Bulgarian First League')).toBe('Bulgaria');
    expect(countryForLeague('Slovak Super Liga')).toBe('Slovakia');
    expect(countryForLeague('Slovenian Prva Liga')).toBe('Slovenia');
    expect(countryForLeague('Kazakhstan Premier League')).toBe('Kazakhstan');
    expect(countryForLeague('UAE Pro League')).toBe('UAE');
    expect(countryForLeague('South African Premiership')).toBe('South Africa');
    expect(countryForLeague('USL Championship')).toBe('USA');
    expect(countryForLeague('Bolivia Primera')).toBe('Bolivia');
    expect(countryForLeague('NIFL Premiership')).toBe('Northern Ireland');
    expect(countryForLeague('Welsh Premier League')).toBe('Wales');
    // Basketball
    expect(countryForLeague('BSL')).toBe('Turkey');
    expect(countryForLeague('Greek Basket League')).toBe('Greece');
    expect(countryForLeague('KBL')).toBe('South Korea');
    expect(countryForLeague('B.League')).toBe('Japan');
    expect(countryForLeague('G League')).toBe('USA');
    expect(countryForLeague('Ligat Haal')).toBe('Israel');
    // Hockey
    expect(countryForLeague('HockeyAllsvenskan')).toBe('Sweden');
    expect(countryForLeague('GET Ligaen')).toBe('Norway');
    expect(countryForLeague('Metal Ligaen')).toBe('Denmark');
    expect(countryForLeague('Ligue Magnus')).toBe('France');
    expect(countryForLeague('DEL2')).toBe('Germany');
    expect(countryForLeague('ICEHL')).toBe('Austria');
    // Baseball
    expect(countryForLeague('CPBL')).toBe('Taiwan');
    expect(countryForLeague('LIDOM')).toBe('Dominican Republic');
    expect(countryForLeague('LBPRC')).toBe('Puerto Rico');
    expect(countryForLeague('LVBP')).toBe('Venezuela');
    expect(countryForLeague('LMB')).toBe('Mexico');
    // American football
    expect(countryForLeague('CFL')).toBe('Canada');
    expect(countryForLeague('UFL')).toBe('USA');
    // Rugby
    expect(countryForLeague('Premiership Rugby')).toBe('England');
    expect(countryForLeague('Major League Rugby')).toBe('USA');
    expect(countryForLeague('Currie Cup')).toBe('South Africa');
    expect(countryForLeague('NPC')).toBe('New Zealand');
    expect(countryForLeague('NRL')).toBe('Australia');
    // Cricket
    expect(countryForLeague('IPL')).toBe('India');
    expect(countryForLeague('T20 Blast')).toBe('England');
    expect(countryForLeague('Lanka Premier League')).toBe('Sri Lanka');
    expect(countryForLeague('SA20')).toBe('South Africa');
    expect(countryForLeague('Pakistan Super League')).toBe('Pakistan');
    // Volleyball
    expect(countryForLeague('PlusLiga')).toBe('Poland');
    expect(countryForLeague('Efeler Ligi')).toBe('Turkey');
    expect(countryForLeague('Ligue A')).toBe('France');
    expect(countryForLeague('V.League')).toBe('Japan');
    expect(countryForLeague('V.League 1')).toBe('Vietnam');
  });

  it('maps the newly-added extended global leagues', () => {
    // Football — extended global coverage
    expect(countryForLeague('Virsliga')).toBe('Latvia');
    expect(countryForLeague('A Lyga')).toBe('Lithuania');
    expect(countryForLeague('Meistriliiga')).toBe('Estonia');
    expect(countryForLeague('Erovnuli Liga')).toBe('Georgia');
    expect(countryForLeague('Girabola')).toBe('Angola');
    expect(countryForLeague('Linafoot')).toBe('DR Congo');
    expect(countryForLeague('Kenya Premier League')).toBe('Kenya');
    expect(countryForLeague('Uganda Premier League')).toBe('Uganda');
    expect(countryForLeague('Zambia Super League')).toBe('Zambia');
    expect(countryForLeague('Kosovo Superleague')).toBe('Kosovo');
    expect(countryForLeague('Uzbekistan Super League')).toBe('Uzbekistan');
    expect(countryForLeague('Singapore Premier League')).toBe('Singapore');
    expect(countryForLeague('Hong Kong Premier League')).toBe('Hong Kong');
    // Basketball minor leagues
    expect(countryForLeague('BNXT League')).toBe('Belgium');
    expect(countryForLeague('Korisliiga')).toBe('Finland');
    expect(countryForLeague('Basketligan')).toBe('Sweden');
    expect(countryForLeague('NBB')).toBe('Brazil');
    expect(countryForLeague('LNBP')).toBe('Mexico');
    expect(countryForLeague('LBA')).toBe('Italy');
    // Volleyball minor leagues
    expect(countryForLeague('Sultanlar Ligi')).toBe('Turkey');
    // BBL stays cricket (Australia) — basketball must arrive as 'German BBL'.
    expect(countryForLeague('BBL')).toBe('Australia');
    expect(countryForLeague('German BBL')).toBe('Germany');
  });

  it('resolves word-boundary conflicts correctly', () => {
    // 'del' inside 'Sunderland' must NOT map to Germany; 'DEL2' must map to Germany.
    expect(displayLeague('Sunderland U21')).toBe('Sunderland U21');
    expect(countryForLeague('DEL2')).toBe('Germany');
    // 'USL Championship' is USA, generic 'Championship' is England.
    expect(countryForLeague('USL Championship')).toBe('USA');
    expect(countryForLeague('Championship')).toBe('England');
    // 'V.League' volleyball (Japan) vs 'V.League 1' (Vietnam football).
    expect(countryForLeague('V.League')).toBe('Japan');
    expect(countryForLeague('V.League 1')).toBe('Vietnam');
  });

  it('is idempotent and safe on unknown/empty values', () => {
    expect(displayLeague('England - Premier League')).toBe('England - Premier League');
    expect(displayLeague('Scheduled Fixture')).toBe('Scheduled Fixture');
    expect(displayLeague('')).toBe('');
    expect(displayLeague('Other')).toBe('Other');
  });
});
