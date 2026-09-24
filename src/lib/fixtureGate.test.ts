// Fixture-quality gate regression tests — the exact garbage that once reached
// the showcase must never pass again ("Prva Liga vs RS 0", "Hockey vs Next 10
// matches", standings rows, nav links), while REAL team/player names pass.
import { describe, it, expect } from 'vitest';
import { plausibleTeamName, plausiblePair, parseFixtures } from '../../convex/scrapers/fixtures';

describe('plausibleTeamName — garbage that must NEVER be a fixture side', () => {
  const GARBAGE = [
    'Prva Liga',            // league name (was a "home team")
    'Serie C',              // league name
    'III Liga',             // league name (roman numeral)
    'Liga 3',               // league + digit
    'Division 3',           // league + digit
    'Group A 10',           // standings row (group + position)
    'Group B 9',
    'Seria 1 0',            // standings row with points
    'RS 0',                 // abbreviation + score
    'Hockey',               // sport word (nav logo text)
    'Volleyball',
    'Next 10 matches',      // navigation link
    "yesterday's results",  // navigation link
    'Next matches',
    '2.10',                 // odds value
    '3 - 1',                // scoreline
    '1X2',                  // market label
    'B365',                 // bookmaker code
    'Estonia: Estonian Cup1X2  15:00Elva', // merged markdown fragment (colon + clock + market)
    'CZECH REPUBLIC: 2. LIGA', // country: league prefix (colon)
    'ITF MEN vs SINGLES: M25 PARDUBICE, CLAY 1 2', // merged section header
    'Standings',
    'Live scores'
  ];
  for (const g of GARBAGE) {
    it(`rejects "${g}"`, () => {
      expect(plausibleTeamName(g)).toBe(false);
    });
  }
});

describe('plausibleTeamName — real teams/players MUST pass', () => {
  const REAL = [
    'Manchester United',
    'Al Jazira',
    'Hapoel Tel Aviv',
    'Bayern München',
    'Saigon Heat',
    'Pittsburgh Pirates',
    'St.Louis Cardinals',
    'Kouame M.',            // tennis player (surname + initial)
    'Pujol Navarro B.',     // spanish tennis player
    'Real Betis',
    'Paris Saint-Germain',
    'Coastal Carolina',
    'Liberty',
    'Baroka FC',
    'Young Boys'
  ];
  for (const r of REAL) {
    it(`accepts "${r}"`, () => {
      expect(plausibleTeamName(r)).toBe(true);
    });
  }
});

describe('plausiblePair — pair-level sanity', () => {
  it('rejects identical sides', () => {
    expect(plausiblePair('Arsenal', 'Arsenal')).toBe(false);
  });
  it('rejects contained sides (league vs league)', () => {
    expect(plausiblePair('Philippines Football League', 'Football League')).toBe(false);
  });
  it('rejects any garbage side even when the other is real', () => {
    expect(plausiblePair('Real Madrid', 'Serie C')).toBe(false);
    expect(plausiblePair('Hockey', 'Next 10 matches')).toBe(false);
  });
  it('accepts a real pair', () => {
    expect(plausiblePair('Al Jazira', 'Al Ittihad')).toBe(true);
    expect(plausiblePair('Hapoel Tel Aviv', 'Bayern München')).toBe(true);
  });
});

describe('parseBetexplorerNext — /next/ breadth-page list structure', () => {
  // Real block shape from betexplorer.com/next/soccer/ (trimmed).
  const NEXT_PAGE = `
  <li class="showHide table-main__tournamentLiContent"><ul class="table-main__matchInfo" data-live="vPHq7qtA" data-dt="24,9,2026,16,00" data-def="1">
    <li class="table-main__matchDateStatus matchDateStatus"><span class="table-main__matchHour matchDateStatus" data-live-cell="time">16:00 </span></li>
    <li class="table-main__participants"><div><a href="/football/nigeria/npfl/rivers-united-kun-khalifa/vPHq7qtA/">
      <div class="table-main__participantHome"><p class="particiantWidthMobile table-main__truncate ">Rivers United</p></div>
      <div class="mainResult" data-live-cell="score"><div></div><div>-</div><div></div></div>
      <div class="table-main__participantAway"><p class="particiantWidthMobile table-main__truncate ">Kun Khalifa</p></div>
    </a></div></li>
    <li class="table-main__oddsLi"><button data-odd="2.30"></button><button data-odd="3.10"></button><button data-odd="3.40"></button></li>
  </ul></li>
  <li><ul class="table-main__matchInfo" data-dt="25,9,2026,20,45">
    <li class="table-main__participants"><div><a href="/football/england/premier-league/arsenal-liverpool/abc123/">
      <div class="table-main__participantHome"><p class="particiantWidthMobile table-main__truncate ">Arsenal</p></div>
      <div class="mainResult" data-live-cell="score"><div></div><div>-</div><div></div></div>
      <div class="table-main__participantAway"><p class="particiantWidthMobile table-main__truncate ">Liverpool</p></div>
    </a></div></li>
  </ul></li>`;

  it('parses /next/ list blocks into real fixtures with league from the URL slug', () => {
    const parsed = parseFixtures(NEXT_PAGE, 'football', 'https://www.betexplorer.com/next/soccer/', '2026-09-24', { trustLeagueHeaders: true });
    expect(parsed.length).toBe(1); // only the 24 Sep row belongs to this dayKey
    const m = parsed[0];
    expect(m.homeTeam).toBe('Rivers United');
    expect(m.awayTeam).toBe('Kun Khalifa');
    expect(m.league).toContain('Nigeria');
    expect(m.league).toContain('Npfl');
    expect(m.oddsText).toBe('2.30, 3.10, 3.40');
  });

  it('routes the next-day row to the next dayKey', () => {
    const parsed = parseFixtures(NEXT_PAGE, 'football', 'https://www.betexplorer.com/next/soccer/', '2026-09-25', { trustLeagueHeaders: true });
    expect(parsed.length).toBe(1);
    expect(parsed[0].homeTeam).toBe('Arsenal');
    expect(parsed[0].awayTeam).toBe('Liverpool');
    expect(parsed[0].league).toContain('England');
    expect(parsed[0].league).toContain('Premier League');
  });
});
