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
  'south african': 'South Africa',
  israeli: 'Israel',
  saudi: 'Saudi Arabia',
  qatari: 'Qatar',
  indian: 'India',
  thai: 'Thailand',
  malaysian: 'Malaysia',
  vietnamese: 'Vietnam',
  indonesian: 'Indonesia',
  croatian: 'Croatia',
  serbian: 'Serbia',
  romanian: 'Romania',
  hungarian: 'Hungary',
  bulgarian: 'Bulgaria',
  slovak: 'Slovakia',
  slovenian: 'Slovenia',
  icelandic: 'Iceland',
  cypriot: 'Cyprus',
  kazakh: 'Kazakhstan',
  taiwanese: 'Taiwan',
  dominican: 'Dominican Republic',
  venezuelan: 'Venezuela',
  'sri lankan': 'Sri Lanka',
  pakistani: 'Pakistan',
  'new zealand': 'New Zealand',
  finnish: 'Finland',
  latvian: 'Latvia',
  lithuanian: 'Lithuania',
  estonian: 'Estonia',
  belarusian: 'Belarus',
  bosnian: 'Bosnia and Herzegovina',
  macedonian: 'North Macedonia',
  montenegrin: 'Montenegro',
  albanian: 'Albania'
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
  ['us', 'USA'],
  ['uae', 'UAE'],
  ['croatia', 'Croatia'],
  ['serbia', 'Serbia'],
  ['romania', 'Romania'],
  ['hungary', 'Hungary'],
  ['bulgaria', 'Bulgaria'],
  ['slovakia', 'Slovakia'],
  ['slovenia', 'Slovenia'],
  ['iceland', 'Iceland'],
  ['cyprus', 'Cyprus'],
  ['kazakhstan', 'Kazakhstan'],
  ['taiwan', 'Taiwan'],
  ['dominican republic', 'Dominican Republic'],
  ['puerto rico', 'Puerto Rico'],
  ['venezuela', 'Venezuela'],
  ['sri lanka', 'Sri Lanka'],
  ['pakistan', 'Pakistan'],
  ['new zealand', 'New Zealand'],
  ['finland', 'Finland'],
  ['northern ireland', 'Northern Ireland'],
  ['latvia', 'Latvia'],
  ['lithuania', 'Lithuania'],
  ['estonia', 'Estonia'],
  ['belarus', 'Belarus'],
  ['bosnia', 'Bosnia and Herzegovina'],
  ['north macedonia', 'North Macedonia'],
  ['montenegro', 'Montenegro'],
  ['albania', 'Albania'],
  ['kenya', 'Kenya'],
  ['uganda', 'Uganda'],
  ['tanzania', 'Tanzania'],
  ['zambia', 'Zambia'],
  ['zimbabwe', 'Zimbabwe'],
  ['ethiopia', 'Ethiopia'],
  ['angola', 'Angola'],
  ['mozambique', 'Mozambique'],
  ['cameroon', 'Cameroon'],
  ['ivory coast', 'Ivory Coast'],
  ['senegal', 'Senegal'],
  ['georgia', 'Georgia'],
  ['kosovo', 'Kosovo'],
  ['malta', 'Malta'],
  ['gibraltar', 'Gibraltar'],
  ['andorra', 'Andorra'],
  ['luxembourg', 'Luxembourg'],
  ['moldova', 'Moldova'],
  ['armenia', 'Armenia'],
  ['azerbaijan', 'Azerbaijan'],
  ['uzbekistan', 'Uzbekistan'],
  ['kyrgyzstan', 'Kyrgyzstan'],
  ['mongolia', 'Mongolia'],
  ['singapore', 'Singapore'],
  ['hong kong', 'Hong Kong'],
  ['iraq', 'Iraq'],
  ['jordan', 'Jordan'],
  ['kuwait', 'Kuwait'],
  ['oman', 'Oman'],
  ['bahrain', 'Bahrain'],
  ['cuba', 'Cuba'],
  ['dr congo', 'DR Congo'],
  ['democratic republic of the congo', 'DR Congo']
];

// League-name keywords → country. Ordered most-specific first.
const LEAGUE_KEYWORDS: [string, string][] = [
  // USA minor (MUST precede the generic 'championship' → England below)
  ['usl championship', 'USA'],
  // Cricket (MUST precede the generic 'premier league' → England below)
  ['lanka premier league', 'Sri Lanka'],
  ['pakistan super league', 'Pakistan'],
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
  ['indian premier league', 'India'],
  ['ipl', 'India'],
  ['thai league', 'Thailand'],
  ['malaysia super league', 'Malaysia'],
  ['v league 1', 'Vietnam'],
  ['v league 2', 'Vietnam'],
  ['v league', 'Japan'],
  ['liga 1 indonesia', 'Indonesia'],
  // European minor football leagues
  ['veikkausliiga', 'Finland'],
  ['besta deild', 'Iceland'],
  ['cyprus first division', 'Cyprus'],
  ['croatian first league', 'Croatia'],
  ['serbian superliga', 'Serbia'],
  ['romanian liga 1', 'Romania'],
  ['hungarian nb i', 'Hungary'],
  ['bulgarian first league', 'Bulgaria'],
  ['slovak super liga', 'Slovakia'],
  ['slovenian prva liga', 'Slovenia'],
  ['kazakhstan premier league', 'Kazakhstan'],
  ['uae pro league', 'UAE'],
  ['tunisian ligue', 'Tunisia'],
  ['algerian ligue', 'Algeria'],
  ['south african premiership', 'South Africa'],
  ['liga de expansion', 'Mexico'],
  ['primera nacional', 'Argentina'],
  ['peru liga', 'Peru'],
  ['paraguay primera', 'Paraguay'],
  ['uruguay primera', 'Uruguay'],
  ['ecuador liga', 'Ecuador'],
  ['bolivia primera', 'Bolivia'],
  ['nifl premiership', 'Northern Ireland'],
  ['welsh premier league', 'Wales'],
  // Basketball minor leagues
  ['ligat haal', 'Israel'],
  ['bsl', 'Turkey'],
  ['greek basket league', 'Greece'],
  ['vtb', 'Russia'],
  ['nbl', 'Australia'],
  ['kbl', 'South Korea'],
  ['b league', 'Japan'],
  ['g league', 'USA'],
  ['lnb', 'France'],
  ['lba', 'Italy'],
  // Hockey minor leagues
  ['ahl', 'USA'],
  ['hockeyallsvenskan', 'Sweden'],
  ['get ligaen', 'Norway'],
  ['metal ligaen', 'Denmark'],
  ['ligue magnus', 'France'],
  ['del2', 'Germany'],
  ['icehl', 'Austria'],
  ['vhl', 'Russia'],
  // Baseball minor leagues
  ['cpbl', 'Taiwan'],
  ['lidom', 'Dominican Republic'],
  ['lbprc', 'Puerto Rico'],
  ['lvbp', 'Venezuela'],
  ['lmb', 'Mexico'],
  // American football
  ['cfl', 'Canada'],
  ['xfl', 'USA'],
  ['ufl', 'USA'],
  // Rugby
  ['premiership rugby', 'England'],
  ['major league rugby', 'USA'],
  ['currie cup', 'South Africa'],
  ['npc', 'New Zealand'],
  ['nrl', 'Australia'],
  // Cricket
  ['t20 blast', 'England'],
  ['the hundred', 'England'],
  ['lanka premier league', 'Sri Lanka'],
  ['sa20', 'South Africa'],
  ['pakistan super league', 'Pakistan'],
  ['psl', 'Pakistan'],
  ['bbl', 'Australia'],
  // Volleyball
  ['seriea', 'Italy'],
  ['superleague', 'Brazil'],
  ['plusliga', 'Poland'],
  ['efeler ligi', 'Turkey'],
  ['ligue a', 'France'],
  ['sultanlar ligi', 'Turkey'],
  ['v league', 'Japan'],
  ['volleyball bundesliga', 'Germany'],
  // Football — extended global coverage
  ['virsliga', 'Latvia'],
  ['a lyga', 'Lithuania'],
  ['meistriliiga', 'Estonia'],
  ['erovnuli liga', 'Georgia'],
  ['georgian premier league', 'Georgia'],
  ['girabola', 'Angola'],
  ['moçambola', 'Mozambique'],
  ['mocambola', 'Mozambique'],
  ['linafoot', 'DR Congo'],
  ['elite one', 'Cameroon'],
  ['kenya premier league', 'Kenya'],
  ['uganda premier league', 'Uganda'],
  ['tanzania premier league', 'Tanzania'],
  ['zambia super league', 'Zambia'],
  ['zimbabwe premier league', 'Zimbabwe'],
  ['ethiopian premier league', 'Ethiopia'],
  ['ivory coast', 'Ivory Coast'],
  ['senegal ligue', 'Senegal'],
  ['bosnian premier league', 'Bosnia and Herzegovina'],
  ['north macedonia', 'North Macedonia'],
  ['montenegro first league', 'Montenegro'],
  ['kosovo superleague', 'Kosovo'],
  ['albanian superliga', 'Albania'],
  ['maltese premier league', 'Malta'],
  ['gibraltar football league', 'Gibraltar'],
  ['andorra primera', 'Andorra'],
  ['luxembourg', 'Luxembourg'],
  ['belarusian premier league', 'Belarus'],
  ['moldovan super liga', 'Moldova'],
  ['armenian premier league', 'Armenia'],
  ['azerbaijan premier league', 'Azerbaijan'],
  ['uzbekistan super league', 'Uzbekistan'],
  ['kyrgyzstan', 'Kyrgyzstan'],
  ['mongolia premier league', 'Mongolia'],
  ['singapore premier league', 'Singapore'],
  ['hong kong premier league', 'Hong Kong'],
  ['iraqi premier league', 'Iraq'],
  ['jordan pro league', 'Jordan'],
  ['kuwait premier league', 'Kuwait'],
  ['oman pro league', 'Oman'],
  ['bahrain premier league', 'Bahrain'],
  ['philippines football league', 'Philippines'],
  // Basketball minor leagues (BBL is intentionally NOT mapped — "Big Bash
  // League" cricket in Australia is the better-known BBL; German basketball
  // arrives as "German BBL" / "Basketball Bundesliga" via the adjective table)
  ['basketball bundesliga', 'Germany'],
  ['german bbl', 'Germany'],
  ['bnxt', 'Belgium'],
  ['korisliiga', 'Finland'],
  ['basketligan', 'Sweden'],
  ['liga unike', 'Kosovo'],
  ['nbb', 'Brazil'],
  ['lnbp', 'Mexico'],
  ['bsn', 'Puerto Rico'],
  ['lba', 'Italy'],
  ['lega basket', 'Italy'],
  ['nbl canada', 'Canada'],
  ['superliga argentina', 'Argentina'],
  ['liga nacional de basquet', 'Argentina'],
  // Hockey minor leagues
  ['champions hockey league', 'Europe'],
  ['alps hockey league', 'Austria'],
  ['mestis', 'Finland'],
  ['hockeyettan', 'Sweden'],
  ['belarusian extraliga', 'Belarus'],
  ['kazakhstan hockey', 'Kazakhstan'],
  // Baseball minor leagues
  ['serie del caribe', 'Caribbean'],
  ['caribbean series', 'Caribbean'],
  ['australian baseball league', 'Australia'],
  ['cuban national series', 'Cuba'],
  // Rugby minor leagues
  ['pro d2', 'France'],
  ['super rugby americas', 'Americas'],
  ['japan league one', 'Japan'],
  // Cricket minor leagues
  ['major league cricket', 'USA'],
  ['global t20 canada', 'Canada'],
  ['super smash', 'New Zealand'],
  ['county championship', 'England'],
  ['sheffield shield', 'Australia'],
  ['ranji trophy', 'India'],
  ['syed mushtaq', 'India']
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
  'world',
  'fivb',
  'vnl',
  'volleyball nations league',
  'world volleyball',
  'champions cup',
  'super rugby',
  'aba liga'
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
