// src/lib/leagueCountries.ts
//
// Maps league / tournament names to their home country so every fixture listing
// can display the standardized "[Country] - [League/Tournament]" format
// (e.g. "England - Premier League", "Spain - La Liga").
//
// International / continental competitions (UEFA, NBA, NHL, ATP, UFC...) have no
// single home country and are intentionally left unprefixed. Anything unmapped
// passes through unchanged — a missing mapping never hides or mangles a league.

/** Normalize for matching: lowercase, punctuation → space, collapse spaces. */
function norm(s: string): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Country adjectives that commonly prefix league names ("English Premier League",
// "Brazil Serie A"). First-match wins; the adjective is stripped for display.
const ADJECTIVES: Record<string, string> = {
  english: 'England',
  spanish: 'Spain',
  german: 'Germany',
  italian: 'Italy',
  french: 'France',
  brazilian: 'Brazil',
  argentinian: 'Argentina',
  argentine: 'Argentina',
  mexican: 'Mexico',
  portuguese: 'Portugal',
  dutch: 'Netherlands',
  scottish: 'Scotland',
  irish: 'Ireland',
  welsh: 'Wales',
  turkish: 'Turkey',
  greek: 'Greece',
  swiss: 'Switzerland',
  austrian: 'Austria',
  danish: 'Denmark',
  swedish: 'Sweden',
  norwegian: 'Norway',
  polish: 'Poland',
  czech: 'Czech Republic',
  belgian: 'Belgium',
  russian: 'Russia',
  ukrainian: 'Ukraine',
  japanese: 'Japan',
  chinese: 'China',
  korean: 'South Korea',
  australian: 'Australia',
  canadian: 'Canada',
  american: 'USA',
  colombian: 'Colombia',
  chilean: 'Chile',
  peruvian: 'Peru',
  uruguayan: 'Uruguay',
  paraguayan: 'Paraguay',
  ecuadorian: 'Ecuador',
  egyptian: 'Egypt',
  moroccan: 'Morocco',
  tunisian: 'Tunisia',
  algerian: 'Algeria',
  nigerian: 'Nigeria',
  ghanaian: 'Ghana',
  senegalese: 'Senegal',
  southafrican: 'South Africa',
  israeli: 'Israel',
  saudi: 'Saudi Arabia',
  qatari: 'Qatar',
  indian: 'India',
  thai: 'Thailand',
  malaysian: 'Malaysia',
  vietnamese: 'Vietnam',
  indonesian: 'Indonesia'
};

// Country names that appear inline in league names ("Colombia: Primera A",
// "Brazil Serie A"). Ordered most-specific first — first match wins.
const COUNTRY_NAMES: [string, string][] = [
  ['england', 'England'],
  ['scotland', 'Scotland'],
  ['wales', 'Wales'],
  ['ireland', 'Ireland'],
  ['spain', 'Spain'],
  ['germany', 'Germany'],
  ['italy', 'Italy'],
  ['france', 'France'],
  ['netherlands', 'Netherlands'],
  ['holland', 'Netherlands'],
  ['portugal', 'Portugal'],
  ['brazil', 'Brazil'],
  ['argentina', 'Argentina'],
  ['mexico', 'Mexico'],
  ['turkey', 'Turkey'],
  ['greece', 'Greece'],
  ['switzerland', 'Switzerland'],
  ['austria', 'Austria'],
  ['denmark', 'Denmark'],
  ['sweden', 'Sweden'],
  ['norway', 'Norway'],
  ['poland', 'Poland'],
  ['belgium', 'Belgium'],
  ['czech republic', 'Czech Republic'],
  ['czech', 'Czech Republic'],
  ['russia', 'Russia'],
  ['ukraine', 'Ukraine'],
  ['japan', 'Japan'],
  ['china', 'China'],
  ['south korea', 'South Korea'],
  ['australia', 'Australia'],
  ['canada', 'Canada'],
  ['colombia', 'Colombia'],
  ['chile', 'Chile'],
  ['peru', 'Peru'],
  ['uruguay', 'Uruguay'],
  ['paraguay', 'Paraguay'],
  ['ecuador', 'Ecuador'],
  ['egypt', 'Egypt'],
  ['morocco', 'Morocco'],
  ['tunisia', 'Tunisia'],
  ['algeria', 'Algeria'],
  ['nigeria', 'Nigeria'],
  ['ghana', 'Ghana'],
  ['senegal', 'Senegal'],
  ['south africa', 'South Africa'],
  ['israel', 'Israel'],
  ['saudi arabia', 'Saudi Arabia'],
  ['qatar', 'Qatar'],
  ['india', 'India'],
  ['thailand', 'Thailand'],
  ['malaysia', 'Malaysia'],
  ['vietnam', 'Vietnam'],
  ['indonesia', 'Indonesia'],
  ['usa', 'USA'],
  ['us', 'USA']
];

// League-name keywords → country. Ordered most-specific first.
const LEAGUE_KEYWORDS: [string, string][] = [
  // England
  ['premier league', 'England'],
  ['efl championship', 'England'],
  ['championship', 'England'],
  ['league one', 'England'],
  ['league two', 'England'],
  ['fa cup', 'England'],
  ['efl cup', 'England'],
  ['carabao', 'England'],
  ['community shield', 'England'],
  ['national league', 'England'],
  ['non league premier', 'England'],
  // Spain
  ['la liga', 'Spain'],
  ['segunda division', 'Spain'],
  ['copa del rey', 'Spain'],
  ['supercopa', 'Spain'],
  ['liga acb', 'Spain'],
  ['liga endesa', 'Spain'],
  // Germany
  ['bundesliga', 'Germany'],
  ['dfb pokal', 'Germany'],
  ['dfl supercup', 'Germany'],
  ['del', 'Germany'],
  // Italy
  ['serie a', 'Italy'],
  ['serie b', 'Italy'],
  ['serie c', 'Italy'],
  ['coppa italia', 'Italy'],
  ['supercoppa', 'Italy'],
  // France
  ['ligue 1', 'France'],
  ['ligue 2', 'France'],
  ['coupe de france', 'France'],
  ['lnb pro a', 'France'],
  ['lnb pro b', 'France'],
  ['top 14', 'France'],
  // Netherlands
  ['eredivisie', 'Netherlands'],
  ['knvb', 'Netherlands'],
  // Portugal
  ['primeira liga', 'Portugal'],
  ['liga portugal', 'Portugal'],
  ['taca de portugal', 'Portugal'],
  // Brazil
  ['campeonato brasileiro', 'Brazil'],
  ['copa do brasil', 'Brazil'],
  // Argentina
  ['primera division argentina', 'Argentina'],
  ['argentina primera', 'Argentina'],
  ['liga profesional', 'Argentina'],
  ['copa argentina', 'Argentina'],
  // Mexico
  ['liga mx', 'Mexico'],
  ['liga bbva mx', 'Mexico'],
  // USA
  ['major league soccer', 'USA'],
  ['mls', 'USA'],
  ['nba', 'USA'],
  ['wnba', 'USA'],
  ['ncaab', 'USA'],
  ['ncaa basketball', 'USA'],
  ['mlb', 'USA'],
  ['milb', 'USA'],
  ['nfl', 'USA'],
  ['ncaa football', 'USA'],
  // Turkey
  ['super lig', 'Turkey'],
  ['turkiye', 'Turkey'],
  // Greece / Switzerland / Austria / Denmark / Sweden / Norway
  ['greek super league', 'Greece'],
  ['super league greece', 'Greece'],
  ['swiss super league', 'Switzerland'],
  ['super league switzerland', 'Switzerland'],
  ['austrian bundesliga', 'Austria'],
  ['danish superliga', 'Denmark'],
  ['allsvenskan', 'Sweden'],
  ['superettan', 'Sweden'],
  ['eliteserien', 'Norway'],
  // Scotland / Belgium / Poland / Czech / Finland
  ['scottish premiership', 'Scotland'],
  ['scottish championship', 'Scotland'],
  ['scottish cup', 'Scotland'],
  ['belgian pro league', 'Belgium'],
  ['jupiler pro league', 'Belgium'],
  ['belgian first division', 'Belgium'],
  ['ekstraklasa', 'Poland'],
  ['extraliga', 'Czech Republic'],
  ['czech first league', 'Czech Republic'],
  ['liiga', 'Finland'],
  ['shl', 'Sweden'],
  // Asia
  ['j1 league', 'Japan'],
  ['j2 league', 'Japan'],
  ['j league', 'Japan'],
  ['npb', 'Japan'],
  ['chinese super league', 'China'],
  ['cba', 'China'],
  ['kbo', 'South Korea'],
  ['k league', 'South Korea'],
  ['a league', 'Australia'],
  ['big bash', 'Australia'],
  ['philippine pba', 'Philippines'],
  ['pba', 'Philippines'],
  // South America
  ['colombia primera', 'Colombia'],
  ['primera a', 'Colombia'],
  ['categoria primera', 'Colombia'],
  ['uruguay primera', 'Uruguay'],
  ['primera division', 'Chile'],
  // Africa / Middle East
  ['egyptian premier league', 'Egypt'],
  ['botola', 'Morocco'],
  ['nigeria premier league', 'Nigeria'],
  ['ghana premier league', 'Ghana'],
  ['israeli premier league', 'Israel'],
  ['saudi pro league', 'Saudi Arabia'],
  ['qatar stars league', 'Qatar'],
  // India / SE Asia
  ['indian super league', 'India'],
  ['thai league', 'Thailand'],
  ['malaysia super league', 'Malaysia'],
  ['v league', 'Vietnam'],
  ['liga 1 indonesia', 'Indonesia']
];

// Continental / international competitions with no single home country.
// These pass through unchanged.
const INTERNATIONAL: string[] = [
  'uefa',
  'champions league',
  'europa league',
  'conference league',
  'nations league',
  'world cup',
  'fifa',
  'euro qual',
  'european championship',
  'euros',
  'copa america',
  'copa libertadores',
  'africa cup',
  'african cup',
  'asian cup',
  'olympic',
  'club world cup',
  'atp',
  'wta',
  'grand slam',
  'masters 1000',
  'davis cup',
  'billie jean king',
  'ittf',
  'wtt',
  'nhl',
  'khl',
  'six nations',
  'rugby championship',
  'world rugby',
  'icc',
  'test match',
  'odi',
  't20 international',
  'ufc',
  'bellator',
  'pfl',
  'one championship',
  'euroleague',
  'eurocup',
  'international',
  'friendly',
  'europe',
  'world'
];

/**
 * Home country for a league name, or null when the competition is
 * international/continental or cannot be mapped confidently.
 */
export function countryForLeague(league: string): string | null {
  const n = norm(league);
  if (!n) return null;

  // International / continental competitions have no single home country.
  if (INTERNATIONAL.some((k) => n.includes(k))) return null;

  // Country adjective inline ("Egyptian Premier League" → Egypt, NOT England
  // via the generic "premier league" keyword) — checked BEFORE the keyword
  // table so country-qualified names always beat their generic league keyword.
  for (const [adj, country] of Object.entries(ADJECTIVES)) {
    if (new RegExp(`(^| )${adj}( |:|$)`, 'i').test(n)) return country;
  }

  // Country name inline ("Colombia: Primera A", "Brazil Serie A" → Brazil,
  // NOT Italy via "serie a").
  for (const [name, country] of COUNTRY_NAMES) {
    if (new RegExp(`(^| )${name}( |:|$)`, 'i').test(n)) return country;
  }

  // Keyword table (most specific first), word-boundary matched so short keys
  // like 'del' or 'nba' cannot false-positive inside longer words (e.g. the
  // 'del' in 'Sunderland' or 'Delhi' must not map to Germany).
  for (const [kw, country] of LEAGUE_KEYWORDS) {
    if (new RegExp(`(^| )${kw}( |$)`, 'i').test(n)) return country;
  }

  return null;
}

/**
 * Display form: "[Country] - [League/Tournament]" when the league is
 * country-anchored, otherwise the original name. Idempotent — already-formatted
 * names and international competitions pass through untouched.
 */
export function displayLeague(league: string): string {
  const raw = String(league || '').trim();
  if (!raw) return raw;
  const n = norm(raw);

  // Already formatted (or contains a separator) — pass through unchanged.
  if (/ - /.test(raw)) return raw;
  const country = countryForLeague(raw);
  if (!country) return raw;

  // Strip a leading country name / adjective from the ORIGINAL casing so
  // "English Premier League" renders as "England - Premier League" (not
  // "England - English Premier League") and case is preserved.
  let rest = raw;
  for (const [name] of COUNTRY_NAMES) {
    if (rest.toLowerCase() === name || rest.toLowerCase().startsWith(name + ' ')) {
      rest = rest.slice(rest.toLowerCase() === name ? name.length : name.length + 1);
      break;
    }
  }
  if (rest.toLowerCase() === raw.toLowerCase()) {
    for (const [adj] of Object.entries(ADJECTIVES)) {
      if (rest.toLowerCase().startsWith(adj + ' ')) {
        rest = rest.slice(adj.length + 1);
        break;
      }
    }
  }
  // "Colombia: Primera A" → "Primera A"
  if (rest.includes(':')) {
    const afterColon = rest.split(':').pop()?.trim() ?? rest;
    if (afterColon) rest = afterColon;
  }
  const trimmed = rest.trim();
  return `${country} - ${trimmed || raw}`;
}
