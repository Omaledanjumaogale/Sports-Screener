// Fixture-quality gate regression tests — the exact garbage that once reached
// the showcase must never pass again ("Prva Liga vs RS 0", "Hockey vs Next 10
// matches", standings rows, nav links), while REAL team/player names pass.
import { describe, it, expect } from 'vitest';
import { plausibleTeamName, plausiblePair } from '../../convex/scrapers/fixtures';

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
