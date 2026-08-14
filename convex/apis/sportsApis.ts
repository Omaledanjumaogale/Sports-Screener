// Verified sports-data API clients used by the Fixture and Odds agents.
//
// Verified live (see project notes) — only these providers return real data:
//   • TheSportsDB   — free public key, multi-sport fixtures/events by date
//   • The Odds API  — ~78 sports, real bookmaker odds (h2h/spreads/totals)
//   • BallDontLie   — NBA games & stats
//   • SportsData.io — NBA scores
// Dead providers (Sportradar 403, API-Football invalid key) are NOT wired here.
//
// Every call is non-throwing: failures return empty results so the pipeline
// degrades to the reader chain / synthetic fallback instead of erroring.

import { SportsApi, apiUrl, apiKeyFor, env } from '../scrapers/sources';
import { readAny } from '../scrapers/pages';

declare const process: { env: Record<string, string | undefined> };

const TSDB_PUBLIC_KEY = '123';

// Preferred Odds API sport keys (first active match wins). Tennis keys rotate by
// tournament (e.g. tennis_atp_canadian_open) and NBA vanishes in the off-season,
// so resolution is dynamic against the live /v4/sports/ list.
const ODDS_SPORT_PREFERENCE: Record<string, RegExp[]> = {
  football: [/^soccer_epl$/, /^soccer_england_/, /^soccer_/],
  basketball: [/^basketball_nba$/, /^basketball_wnba$/, /^basketball_/],
  tennis: [/^tennis_.*(?:grand_slam|atp)/, /^tennis_.*wta/, /^tennis_/],
  rally: [/^table_tennis_/, /^table_tennis_ittf/],
  hockey: [/^icehockey_nhl$/, /^icehockey_/],
  baseball: [/^baseball_mlb$/, /^baseball_/],
  americanfootball: [/^americanfootball_nfl$/, /^americanfootball_ncaaf$/, /^americanfootball_/],
  rugby: [/^rugby_union_/, /^rugby_league_/, /^rugby_/],
  cricket: [/^cricket_test_match$/, /^cricket_/],
  mma: [/^mma_/],
  volleyball: [/^volleyball_/]
};

let oddsSportsCache: { at: number; keys: string[] } | null = null;

export const TSDB_SPORT: Record<string, string> = {
  football: 'Soccer',
  basketball: 'Basketball',
  tennis: 'Tennis',
  hockey: 'IceHockey',
  baseball: 'Baseball',
  rally: 'TableTennis',
  americanfootball: 'American Football',
  rugby: 'Rugby',
  cricket: 'Cricket',
  mma: 'MMA',
  volleyball: 'Volleyball'
};

export const TSDB_SPORT_KEYS: Record<string, RegExp> = {
  football: /^soccer$/i,
  basketball: /basketball/i,
  tennis: /tennis/i,
  hockey: /ice\s*hockey|nhl/i,
  baseball: /baseball|mlb/i,
  rally: /table.?tennis|ping.?pong/i,
  americanfootball: /american.?football|nfl/i,
  rugby: /rugby/i,
  cricket: /cricket/i,
  mma: /mma|mixed.?martial/i,
  volleyball: /volleyball/i
};

export interface ApiFixture {
  home: string;
  away: string;
  league: string;
  startTime: number;
  sourceUrl: string;
}

function normalizeTeam(name: string): string {
  return String(name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

// Parse a provider datetime stamp as UTC. Accepts ISO with/without 'Z', and the
// space-separated "2026-08-14 18:00:00" form several APIs return. A date-only
// stamp ("2026-08-14") is anchored to NOON UTC so it lands on the correct WAT
// calendar day instead of 01:00 AM WAT (midnight UTC + 1h). Returns NaN when
// unparseable so callers can fall back.
function parseUtcStamp(stamp: string): number {
  const s = String(stamp || '').trim();
  if (!s) return NaN;
  const iso = s.replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)), 12, 0, 0, 0);
  }
  const ms = Date.parse(/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : iso + 'Z');
  return Number.isFinite(ms) ? ms : NaN;
}

// ── TheSportsDB (multi-sport events for a date) ──────────────────────────────
export async function fetchTheSportsDbEvents(date: string): Promise<any[]> {
  try {
    const key = env('THESPORTSDB_API_KEY')?.trim() || TSDB_PUBLIC_KEY;
    const url = `${apiUrl(SportsApi.TheSportsDB)}/${key}/eventsday.php?d=${date}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => null);
    return Array.isArray(data?.events) ? data.events : [];
  } catch {
    return [];
  }
}

export function mapSportsDbEvents(events: any[], sportId: string): ApiFixture[] {
  const re = TSDB_SPORT_KEYS[sportId];
  if (!re) return [];
  const now = Date.now();
  const out: ApiFixture[] = [];
  const seen = new Set<string>();
  for (const e of events ?? []) {
    const sport = String(e?.strSport || '');
    if (!re.test(sport)) continue;
    const home = String(e?.strHomeTeam || '').trim();
    const away = String(e?.strAwayTeam || '').trim();
    if (!home || !away) continue;
    const key = normalizeTeam(home) + '|' + normalizeTeam(away);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      home,
      away,
      league: String(e?.strLeague || ''),
      startTime: Date.parse(e?.strTimestamp ?? '') || now + out.length * 2 * 60 * 60 * 1000,
      sourceUrl: `https://www.thesportsdb.com/api/v1/json/123/eventsday.php`
    });
  }
  return out;
}

const RETRYABLE_CODES = new Set([429, 500, 502, 503, 504]);

async function retryingJson(url: string, timeoutMs: number, attempts: number): Promise<any[]> {
  let last: any = [];
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const data: any = await res.json().catch(() => null);
        if (Array.isArray(data)) return data;
        last = [];
        continue;
      }
      // Only the transient statuses warrant a retry; keep last result but retry.
      last = [];
      if (!RETRYABLE_CODES.has(res.status) || i === attempts - 1) return [];
    } catch {
      // Network/timeout — retry.
    }
    await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  return last;
}

// ── The Odds API / ParlayAPI (TOA-compatible, own their sport-key universe) ──
// Both expose the same /sports + /sports/{key}/odds shape. They are quota-capped
// free sources, so a rotation (below) alternates which one is the "primary"
// against any single league each cycle — spreading monthly credits across the
// month instead of exhausting one account up front. When one is out of credits
// or unreachable the other takes over automatically (never a hard failure).

const TOA_PROVIDERS: SportsApi[] = [SportsApi.ParlayApi, SportsApi.TheOddsApi];

// Deterministic rotation: the first provider queried for a league flips each UTC
// day, so across a month both capped accounts share the load instead of one
// draining ahead of schedule.
function toaOrderFor(sportKey: string): SportsApi[] {
  let h = 0;
  for (let i = 0; i < sportKey.length; i++) h = (h * 31 + sportKey.charCodeAt(i)) >>> 0;
  const day = new Date().getUTCDate();
  const order = [...TOA_PROVIDERS];
  if (((h >>> 3) + day) % 2 === 0) order.reverse();
  return order;
}

// GET a TOA-shaped JSON array from a provider, or [] on any failure.
async function fetchToaProvider(provider: SportsApi, path: string, params: Record<string, string>): Promise<any[]> {
  const key = apiKeyFor(provider);
  if (!key) return [];
  const qs = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `${apiUrl(provider)}/${path}?apiKey=${encodeURIComponent(key)}` + (qs ? `&${qs}` : '');
  return retryingJson(url, 20_000, path === 'sports' ? 1 : 3);
}

// Active sport keys across the TOA-compatible providers, deduped.
export async function fetchToASportKeys(): Promise<string[]> {
  const keys = new Set<string>();
  for (const p of TOA_PROVIDERS) {
    if (!apiKeyFor(p)) continue;
    const list = await fetchToaProvider(p, 'sports', {});
    for (const s of list) if (s?.active && typeof s?.key === 'string') keys.add(s.key);
  }
  return Array.from(keys);
}

// Real bookmaker odds for a sport key. Each account in `toaOrderFor` is queried
// in rotation (credits spread across the month); events are merged so one account
// exhausting its quota never strands coverage of that league.
export async function fetchOddsMarkets(sportKey: string, markets = 'h2h,totals,spreads'): Promise<any[]> {
  const merged = new Map<string, any>();
  for (const p of toaOrderFor(sportKey)) {
    const rows = await fetchToaProvider(p, `sports/${sportKey}/odds`, {
      regions: 'uk,eu,us',
      markets,
      oddsFormat: 'decimal'
    });
    for (const r of rows ?? []) {
      const home = String(r?.home_team || '').trim();
      const away = String(r?.away_team || '').trim();
      if (!home || !away) continue;
      if (!merged.has(home + '|' + away)) merged.set(home + '|' + away, r);
    }
  }
  return Array.from(merged.values());
}

// Active The Odds API sport keys, cached a few minutes per process. (ParlayAPI
// is the primary TOA-compatible account, so its key universe is returned first.)
export async function fetchOddsSportKeys(): Promise<string[]> {
  if (oddsSportsCache && Date.now() - oddsSportsCache.at < 5 * 60 * 1000) return oddsSportsCache.keys;
  try {
    const keys = await fetchToASportKeys();
    oddsSportsCache = { at: Date.now(), keys };
    return keys;
  } catch {
    return oddsSportsCache?.keys ?? [];
  }
}

// Resolve every active Odds API key for a sport against the live /v4/sports/
// list, so MINOR leagues and tournaments (not just the flagship league) are
// included in coverage. Returns keys ordered by the static preference, followed
// by any remaining active keys of the same family. Falls back to the static
// preference alone when the live list is unreachable.
export async function resolveOddsSportKeys(sportId: string): Promise<string[]> {
  const prefs = ODDS_SPORT_PREFERENCE[sportId];
  if (!prefs) return [];
  const keys = await fetchOddsSportKeys();
  const futures = /winner|championship|outright/i;
  if (keys.length) {
    const matches: string[] = [];
    for (const re of prefs) {
      for (const k of keys) {
        if (re.test(k) && !futures.test(k) && !matches.includes(k)) matches.push(k);
      }
    }
    return matches.slice(0, sportId === 'football' ? 25 : 12);
  }
  return [ODDS_FALLBACK[sportId]].filter(Boolean);
}

// Resolve the best Odds API key for a sport against the live /v4/sports/ list so
// tournament rotations (tennis) and off-season windows (NBA) don't yield
// UNKNOWN_SPORT / empty results. Falls back to the static preference otherwise.
export async function resolveOddsSportKey(sportId: string): Promise<string | undefined> {
  return (await resolveOddsSportKeys(sportId))[0];
}

const ODDS_FALLBACK: Record<string, string> = {
  football: 'soccer_epl',
  basketball: 'basketball_nba',
  tennis: 'tennis_atp_canadian_open',
  hockey: 'icehockey_nhl',
  baseball: 'baseball_mlb',
  americanfootball: 'americanfootball_nfl',
  rugby: 'rugby_union',
  cricket: 'cricket_test_match',
  mma: 'mma_mixed_martial_arts',
  volleyball: 'volleyball_'
};

export interface ConsolidatedOdds {
  home: string;
  away: string;
  h2h?: number[]; // [home, away] for 2-way, [home, draw, away] for 1X2
  total?: { line: number; over: number; under: number };
  spread?: { point: number; home: number; away: number };
  drawPresent: boolean;
  live?: boolean;
}

// Human-readable league for a resolved The Odds API sport key so each fixture is
// labelled with its real competition, not a lumped generic.
export function leagueForOddsSportKey(key: string | undefined): string {
  if (!key) return '';
  const map: Record<string, string> = {
    soccer_epl: 'English Premier League',
    soccer_efl_champ: 'EFL Championship',
    soccer_england_league1: 'EFL League One',
    soccer_england_league2: 'EFL League Two',
    soccer_england_national_league: 'National League',
    soccer_england_fa_cup: 'FA Cup',
    soccer_england_efl_cup: 'EFL Cup',
    soccer_spain_la_liga: 'La Liga',
    soccer_spain_segunda_division: 'Spain Segunda',
    soccer_spain_copa_del_rey: 'Copa del Rey',
    soccer_germany_bundesliga: 'Bundesliga',
    soccer_germany_bundesliga2: 'Bundesliga 2',
    soccer_germany_dfb_pokal: 'DFB-Pokal',
    soccer_italy_serie_a: 'Serie A',
    soccer_italy_serie_b: 'Serie B',
    soccer_italy_coppa_italia: 'Coppa Italia',
    soccer_france_ligue_one: 'Ligue 1',
    soccer_france_ligue_two: 'Ligue 2',
    soccer_france_coupe_de_france: 'Coupe de France',
    soccer_portugal_primeira_liga: 'Primeira Liga',
    soccer_netherlands_eredivisie: 'Eredivisie',
    soccer_scotland_premiership: 'Scottish Premiership',
    soccer_belgium_first_div: 'Belgian Pro League',
    soccer_turkey_super_league: 'Turkish Super Lig',
    soccer_greece_super_league: 'Greek Super League',
    soccer_switzerland_superleague: 'Swiss Super League',
    soccer_austria_bundesliga: 'Austrian Bundesliga',
    soccer_denmark_superliga: 'Danish Superliga',
    soccer_sweden_allsvenskan: 'Allsvenskan',
    soccer_norway_eliteserien: 'Eliteserien',
    soccer_brazil_campeonato: 'Brazil Serie A',
    soccer_argentina_primera_division: 'Argentina Primera',
    soccer_chile_campeonato: 'Chile Primera',
    soccer_mexico_ligamx: 'Liga MX',
    soccer_usa_mls: 'MLS',
    soccer_uefa_champs_league: 'UEFA Champions League',
    soccer_uefa_champs_league_qualification: 'UEFA CL Qualifying',
    soccer_uefa_europa_league: 'UEFA Europa League',
    soccer_uefa_conference_league: 'UEFA Conference League',
    soccer_uefa_nations_league: 'UEFA Nations League',
    soccer_uefa_euro_qualification: 'Euro Qualifying',
    soccer_fifa_world_cup: 'FIFA World Cup',
    soccer_copa_america: 'Copa America',
    soccer_copa_libertadores: 'Copa Libertadores',
    basketball_nba: 'NBA',
    basketball_wnba: 'WNBA',
    basketball_ncaab: 'NCAAB',
    basketball_euroleague: 'EuroLeague',
    basketball_acb: 'Liga ACB',
    basketball_lnb: 'LNB Pro A',
    basketball_cba: 'CBA',
    basketball_philippines_pba: 'Philippine PBA',
    baseball_mlb: 'MLB',
    baseball_npb: 'NPB',
    baseball_kbo: 'KBO',
    baseball_milb: 'MiLB',
    baseball_ab: 'Australian Baseball League',
    baseball_mexico_lmb: 'Mexican LMB',
    baseball_venezuela_lvbp: 'Venezuelan LVBP',
    icehockey_nhl: 'NHL',
    icehockey_khl: 'KHL',
    icehockey_sweden_shl: 'SHL',
    icehockey_finland_liiga: 'Liiga',
    icehockey_switzerland_nla: 'NL Switzerland',
    icehockey_czech_extraliga: 'Czech Extraliga',
    icehockey_ahl: 'AHL',
    icehockey_germany_del: 'DEL',
    americanfootball_nfl: 'NFL',
    americanfootball_ncaaf: 'NCAAF',
    americanfootball_xfl: 'XFL',
    rugby_union_international: 'Rugby International',
    rugby_union_english_premiership: 'English Premiership',
    rugby_union_england_premiership: 'English Premiership',
    rugby_union_top14: 'Top 14',
    rugby_union_super_rugby: 'Super Rugby',
    cricket_test_match: 'Test Cricket',
    cricket_odi: 'ODI',
    cricket_international_t20: 'T20 International',
    cricket_ccc: 'T20 League',
    cricket_bb: 'The Hundred',
    cricket_the_hundred: 'The Hundred',
    cricket_pakistan_super_league: 'Pakistan Super League',
    cricket_indian_t20: 'Indian T20',
    cricket_australia_t20: 'Big Bash',
    mma_mixed_martial_arts: 'MMA',
    volleyball_: 'Volleyball',
    volleyball_brazil_super_league: 'Brazil Superliga',
    volleyball_italy_serie_a1: 'Italy Serie A1',
    soccer_england_national_league_n: 'National League North',
    soccer_scotland_championship: 'Scottish Championship',
    soccer_scotland_league_one: 'Scottish League One',
    soccer_scotland_league_two: 'Scottish League Two',
    soccer_scotland_fa_cup: 'Scottish Cup',
    soccer_ireland_premier_division: 'Irish Premier Division',
    soccer_ireland_first_division: 'Irish First Division',
    soccer_wales_premier_league: 'Welsh Premier League',
    soccer_northern_ireland_premiership: 'NIFL Premiership',
    soccer_netherlands_erste_divisie: 'Eerste Divisie',
    soccer_belgium_first_div_b: 'Belgian First Division B',
    soccer_portugal_liga_pro: 'Portugal Liga Portugal 2',
    soccer_poland_ekstraklasa: 'Ekstraklasa',
    soccer_czech_first_league: 'Czech First League',
    soccer_croatia_first_league: 'Croatian First League',
    soccer_serbia_super_liga: 'Serbian SuperLiga',
    soccer_romania_liga_1: 'Romanian Liga 1',
    soccer_hungary_nb_1: 'Hungarian NB I',
    soccer_bulgaria_first_league: 'Bulgarian First League',
    soccer_slovakia_super_liga: 'Slovak Super Liga',
    soccer_slovenia_prva_liga: 'Slovenian Prva Liga',
    soccer_finland_veikkausliiga: 'Veikkausliiga',
    soccer_iceland_urvalsdeild: 'Besta deild karla',
    soccer_denmark_1st_division: 'Danish 1st Division',
    soccer_sweden_superettan: 'Superettan',
    soccer_norway_1st_division: 'Norwegian 1. Divisjon',
    soccer_cyprus_first_division: 'Cypriot First Division',
    soccer_israel_premier_league: 'Israeli Premier League',
    soccer_russia_premier_league: 'Russian Premier League',
    soccer_ukraine_premier_league: 'Ukrainian Premier League',
    soccer_kazakhstan_premier_league: 'Kazakhstan Premier League',
    soccer_china_super_league: 'Chinese Super League',
    soccer_japan_j_league: 'J1 League',
    soccer_japan_j2_league: 'J2 League',
    soccer_south_korea_k_league: 'K League 1',
    soccer_australia_a_league: 'A-League',
    soccer_india_super_league: 'Indian Super League',
    soccer_saudi_pro_league: 'Saudi Pro League',
    soccer_uae_pro_league: 'UAE Pro League',
    soccer_qatar_stars_league: 'Qatar Stars League',
    soccer_egypt_premier_league: 'Egyptian Premier League',
    soccer_morocco_botola: 'Botola Pro',
    soccer_tunisia_ligue_professionnelle: 'Tunisian Ligue Pro',
    soccer_algeria_ligue_1: 'Algerian Ligue 1',
    soccer_nigeria_premier_league: 'Nigerian Premier League',
    soccer_ghana_premier_league: 'Ghana Premier League',
    soccer_south_africa_premiership: 'South African Premiership',
    soccer_usa_usl_championship: 'USL Championship',
    soccer_mexico_liga_expansion: 'Liga de Expansion MX',
    soccer_brazil_serie_b: 'Brazil Serie B',
    soccer_argentina_primera_nacional: 'Argentina Primera Nacional',
    soccer_colombia_primera_a: 'Colombia Primera A',
    soccer_colombia_primera_b: 'Colombia Primera B',
    soccer_peru_primera: 'Peru Liga 1',
    soccer_paraguay_primera: 'Paraguay Primera',
    soccer_uruguay_primera: 'Uruguay Primera',
    soccer_ecuador_liga_pro: 'Ecuador Liga Pro',
    soccer_bolivia_primera: 'Bolivia Primera',
    soccer_concacaf_champions_cup: 'CONCACAF Champions Cup',
    basketball_eurocup: 'EuroCup',
    basketball_aba: 'ABA Liga',
    basketball_ligat_haal: 'Israeli Basketball Premier League',
    basketball_bsl: 'Turkish BSL',
    basketball_greece_basket_league: 'Greek Basket League',
    basketball_vtb: 'VTB United League',
    basketball_nbl: 'NBL Australia',
    basketball_kbl: 'Korean KBL',
    basketball_b1: 'Japan B.League',
    basketball_g_league: 'NBA G League',
    basketball_italy_serie_a: 'Italian LBA',
    basketball_spain_liga_endesa: 'Liga Endesa',
    icehockey_sweden_hockeyallsvenskan: 'HockeyAllsvenskan',
    icehockey_norway_get: 'Norway GET Ligaen',
    icehockey_denmark_metal: 'Denmark Metal Ligaen',
    icehockey_france_ligue_magnus: 'Ligue Magnus',
    icehockey_germany_del2: 'DEL2',
    icehockey_austria_ice_hockey_league: 'ICEHL',
    icehockey_slovakia_extraliga: 'Slovak Extraliga',
    icehockey_belarus_extraliga: 'Belarusian Extraliga',
    icehockey_russia_vhl: 'VHL',
    baseball_cpbl: 'CPBL',
    baseball_dominican_lidom: 'Dominican LIDOM',
    baseball_puerto_rico_lbprc: 'Puerto Rico LBPRC',
    baseball_cuba_serie_nacional: 'Cuban Serie Nacional',
    americanfootball_cfl: 'CFL',
    americanfootball_ufl: 'UFL',
    rugby_union_urc: 'United Rugby Championship',
    rugby_union_champions_cup: 'Champions Cup',
    rugby_union_japan_league_one: 'Japan Rugby League One',
    rugby_union_usa_major_league_rugby: 'Major League Rugby',
    rugby_union_currie_cup: 'Currie Cup',
    rugby_union_npc: 'NPC New Zealand',
    rugby_league_australia_nrl: 'NRL',
    rugby_league_super_league: 'Rugby Super League',
    cricket_england_t20_blast: 'T20 Blast',
    cricket_caribbean_premier_league: 'Caribbean Premier League',
    cricket_lanka_premier_league: 'Lanka Premier League',
    cricket_bangladesh_premier_league: 'Bangladesh Premier League',
    cricket_nepal_premier_league: 'Nepal Premier League',
    cricket_south_africa_t20: 'SA20',
    cricket_uae_il_t20: 'ILT20',
    mma_ufc: 'UFC',
    mma_bellator: 'Bellator',
    mma_pfl: 'PFL',
    mma_one_championship: 'ONE Championship',
    volleyball_poland_plusliga: 'PlusLiga',
    volleyball_turkey_efeler_ligi: 'Turkish Efeler Ligi',
    volleyball_france_ligue_a: 'French Ligue A',
    volleyball_germany_bundesliga: 'German Volleyball Bundesliga',
    volleyball_russia_super_league: 'Russian Volleyball Super League',
    volleyball_japan_v_league: 'Japan V.League',
    volleyball_china_volleyball_super_league: 'Chinese Volleyball Super League',
    volleyball_fivb_nations_league: 'Volleyball Nations League'

  };
  if (map[key]) return map[key];
  if (key.startsWith('soccer_')) return 'Soccer League';
  if (key.startsWith('basketball_')) return 'Basketball League';
  if (key.startsWith('baseball_')) return 'Baseball League';
  if (key.startsWith('icehockey_')) return 'Hockey League';
  if (key.startsWith('americanfootball_')) return 'American Football';
  if (key.startsWith('rugby_')) return 'Rugby League';
  if (key.startsWith('cricket_')) return 'Cricket Match';
  if (key.startsWith('mma_')) return 'MMA Fight';
  if (key.startsWith('volleyball_')) return 'Volleyball Match';
  if (key.startsWith('tennis_')) {
    const parts = key.replace('tennis_', '').split('_');
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') || 'Tennis';
  }
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickBookmakerPrices(raw: any[], marketKey: string): { name: string; price: number; point: number }[] {
  const seen = new Map<string, { name: string; price: number; point: number }>();
  for (const bm of raw ?? []) {
    for (const m of bm?.markets ?? []) {
      if (m?.key !== marketKey) continue;
      for (const o of m?.outcomes ?? []) {
        if (!o || typeof o.price !== 'number' || o.price <= 0) continue;
        const key = marketKey === 'h2h' ? String(o.name || '').toLowerCase() : `${String(o.name)}|${o.point}`;
        if (!seen.has(key)) seen.set(key, { name: String(o.name || ''), price: Number(o.price), point: Number(o.point || 0) });
      }
    }
  }
  return Array.from(seen.values());
}

// Pure consolidation of an Odds API match into a compact, analysis-ready shape.
export function consolidateOdds(raw: any[]): ConsolidatedOdds[] {
  const out: ConsolidatedOdds[] = [];
  for (const m of raw ?? []) {
    const home = String(m?.home_team || '').trim();
    const away = String(m?.away_team || '').trim();
    if (!home || !away) continue;

    const h2hPrices = pickBookmakerPrices(m.bookmakers, 'h2h');
    const h2hByName = new Map<string, number>();
    let drawPresent = false;
    for (const p of h2hPrices) {
      h2hByName.set(p.name.toLowerCase(), p.price);
      if (/^(draw|tie|equalia)/i.test(p.name)) drawPresent = true;
    }
    let h2h: number[] | undefined;
    const hp = h2hByName.get(home.toLowerCase());
    const ap = h2hByName.get(away.toLowerCase());
    if (hp && ap) {
      if (drawPresent) {
        const dp = h2hByName.get('draw') ?? h2hByName.get('tie') ?? 3.4;
        h2h = [hp, dp, ap];
      } else {
        // 2-way moneyline sport (baseball/basketball/hockey/tennis/rally) —
        // no draw leg, so never fabricate one.
        h2h = [hp, ap];
      }
    }

    let total: { line: number; over: number; under: number } | undefined;
    const totals = pickBookmakerPrices(m.bookmakers, 'totals');
    const over = totals.find((t) => /^(over|o)$/i.test(t.name));
    const under = totals.find((t) => /under|u/i.test(t.name));
    const line = over?.point ?? under?.point ?? 0;
    if (over && under && line > 0) {
      total = { line, over: over.price, under: under.price };
    }

    let spread: { point: number; home: number; away: number } | undefined;
    const spreads = pickBookmakerPrices(m.bookmakers, 'spreads');
    const homeSpread = spreads.find((s) => String(s.name).toLowerCase() === home.toLowerCase());
    const awaySpread = spreads.find((s) => String(s.name).toLowerCase() === away.toLowerCase());
    if (homeSpread && awaySpread) {
      spread = { point: homeSpread.point, home: homeSpread.price, away: awaySpread.price };
    }

    out.push({ home, away, h2h, total, spread, drawPresent, live: m?.live === true });
  }
  return out;
}

// Produce a decimal-odds text for a ScrapeMatch so the normalize stage can build
// a real scope (result 1X2 + a total over/under) for the LLM. Explicit labels
// disambiguate h2h from totals (normalize.ts:parseOddsText understands both).
export function matchOddsText(odds: ConsolidatedOdds): string {
  const parts: string[] = [];
  if (odds.h2h) parts.push(`h2h=${odds.h2h.map((n) => n.toFixed(2)).join(',')}`);
  if (odds.total) parts.push(`totals=${odds.total.line}:${odds.total.over.toFixed(2)}/${odds.total.under.toFixed(2)}`);
  if (odds.spread) parts.push(`spread=${odds.spread.point}:${odds.spread.home.toFixed(2)},${odds.spread.away.toFixed(2)}`);
  if (odds.live) parts.push('live=1');
  return parts.join(' ');
}

export function findOddsFor(odds: ConsolidatedOdds[], home: string, away: string): ConsolidatedOdds | undefined {
  const hk = normalizeTeam(home);
  const ak = normalizeTeam(away);
  return odds.find((o) => normalizeTeam(o.home) === hk && normalizeTeam(o.away) === ak);
}

// The Odds API response also carries the real fixtures (home_team, away_team,
// commence_time) — feed them into the fixture agent so fixtures and odds match.
export function mapOddsApiFixtures(matches: any[], sportKey?: string): ApiFixture[] {
  const out: ApiFixture[] = [];
  const now = Date.now();
  const league = leagueForOddsSportKey(sportKey);
  const seen = new Set<string>();
  for (const m of matches ?? []) {
    const home = String(m?.home_team || '').trim();
    const away = String(m?.away_team || '').trim();
    if (!home || !away) continue;
    const key = normalizeTeam(home) + '|' + normalizeTeam(away);
    if (seen.has(key)) continue;
    seen.add(key);
    const startTime = Number(m?.commence_time || 0) * 1000;
    out.push({
      home,
      away,
      league,
      startTime: startTime > now * 0.5 ? startTime : now + out.length * 2 * 60 * 60 * 1000,
      sourceUrl: 'https://api.the-odds-api.com/v4'
    });
  }
  return out;
}

// ── OddsPapi (free, 69 sports — schedules + odds) ────────────────────────────
// OddsPapi sport ids: 10 soccer, 11 basketball, 12 tennis, 13 baseball,
// 14 american-football, 15 ice-hockey, 32 field-hockey, 43 rink-hockey.
// Free tier is generous for /sports + /fixtures; /odds is book-live-gated, so
// it is used opportunistically for pre-game fixtures whose market ids we can
// recognise (in practice SharpAPI below is the reliable odds path).
export const ODDSPAPI_SPORT: Record<string, number> = {
  football: 10,
  basketball: 11,
  tennis: 12,
  baseball: 13,
  hockey: 15
};

// A full schedule window is ["M/d/yyyy", "M/d/yyyy"]. The API caps spans at 10
// days, so we always fetch a single 1-day window for the target date.
export async function fetchODDSPAPIFixtures(sportId: string, date: string): Promise<any[]> {
  const key = apiKeyFor(SportsApi.OddsPapi);
  const sid = ODDSPAPI_SPORT[sportId];
  if (!key || !sid) return [];
  let day = String(date || new Date().toISOString().slice(0, 10));
  day = day.replace(/-/g, '/');
  try {
    const url = `${apiUrl(SportsApi.OddsPapi)}/fixtures?apiKey=${encodeURIComponent(key)}&sportId=${sid}&from=${encodeURIComponent(day)}&to=${encodeURIComponent(day)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function mapODDSPAPIFixtures(raw: any[], sportId: string): ApiFixture[] {
  const out: ApiFixture[] = [];
  const now = Date.now();
  const seen = new Set<string>();
  for (const f of raw ?? []) {
    const home = String(f?.participant1Name || '').trim();
    const away = String(f?.participant2Name || '').trim();
    if (!home || !away) continue;
    if (!/pre|live|sched/i.test(String(f?.statusName || ''))) continue;
    const key = normalizeTeam(home) + '|' + normalizeTeam(away);
    if (seen.has(key)) continue;
    seen.add(key);
    // OddsPapi startTime is a full UTC datetime ("2026-08-14 18:00:00"); the old
    // date-only truncation (.split(' ')[0]) stored every fixture at UTC midnight,
    // which WAT renders as 01:00 AM — the wrong-time bug. Parse the full stamp
    // as UTC so the WAT wall-clock is preserved.
    const rawStart = String(f?.startTime || '').trim();
    const startTime = rawStart ? parseUtcStamp(rawStart) : now + out.length * 2 * 60 * 60 * 1000;
    out.push({
      home,
      away,
      league: String(f?.tournamentName || ''),
      startTime,
      sourceUrl: 'https://api.oddspapi.io/v4/fixtures'
    });
  }
  return out;
}

// ── SharpAPI (flat real bookmaker odds: moneyline/spread/total) ──────────────
const SHARP_LEAGUES: Record<string, string[]> = {
  football: ['england_-_premier_league', 'england_-_championship', 'england_-_league_one', 'england_-_league_two', 'spain_-_la_liga', 'spain_-_la_liga_2', 'italy_-_serie_a', 'italy_-_serie_b', 'germany_-_bundesliga', 'germany_-_2_bundesliga', 'france_-_ligue_1', 'france_-_ligue_2', 'portugal_-_primeira_liga', 'netherlands_-_eredivisie', 'belgium_-_first_division_a', 'scotland_-_premiership', 'brazil_-_serie_a', 'brazil_-_serie_b', 'argentina_-_primera_division', 'mexico_-_liga_mx', 'turkey_-_super_lig', 'greece_-_super_league', 'switzerland_-_super_league', 'austria_-_bundesliga', 'denmark_-_superliga', 'sweden_-_allsvenskan', 'norway_-_eliteserien', 'poland_-_ekstraklasa', 'czech_republic_-_first_league', 'croatia_-_first_league', 'serbia_-_super_liga', 'romania_-_liga_1', 'russia_-_premier_league', 'ukraine_-_premier_league', 'china_-_super_league', 'japan_-_j_league', 'south_korea_-_k_league_1', 'australia_-_a_league', 'saudi_arabia_-_pro_league', 'qatar_-_stars_league', 'usa_-_mls', 'usa_-_usl_championship'],
  basketball: ['nba', 'wnba', 'ncaab', 'euroleague', 'eurocup', 'acb', 'liga_endesa', 'lnb', 'cba', 'bsl', 'greek_basket_league', 'ligat_haal', 'vtb', 'nbl_australia', 'kbl', 'b_league', 'g_league'],
  tennis: ['atp', 'wta', 'atp_challenger', 'itf'],
  hockey: ['nhl', 'khl', 'sweden_-_shl', 'sweden_-_hockeyallsvenskan', 'finland_-_liiga', 'germany_-_del', 'germany_-_del2', 'czech_-_extraliga', 'switzerland_-_national_league', 'austria_-_ice_hockey_league', 'norway_-_get_ligaen', 'denmark_-_metal_ligaen', 'france_-_ligue_magnus', 'slovakia_-_extraliga'],
  baseball: ['mlb', 'npb', 'kbo', 'milb', 'cpbl', 'dominican_-_lidom', 'puerto_rico_-_lbprc', 'venezuela_-_lvbp', 'mexican_-_lmb'],
  americanfootball: ['nfl', 'ncaa_football', 'cfl', 'ufl'],
  rugby: ['rugby_union', 'england_-_premiership', 'france_-_top_14', 'united_rugby_championship', 'japan_-_league_one', 'australia_-_nrl', 'super_league'],
  cricket: ['india_-_ipl', 'australia_-_big_bash', 'england_-_t20_blast', 'pakistan_super_league', 'sa20', 'lanka_premier_league', 'caribbean_premier_league', 'bangladesh_premier_league', 'the_hundred'],
  mma: ['ufc', 'bellator', 'pfl', 'one_championship'],
  volleyball: ['italy_-_serie_a1', 'brazil_-_superliga', 'poland_-_plusliga', 'turkey_-_efeler_ligi', 'france_-_ligue_a', 'germany_-_volleyball_bundesliga', 'japan_-_v_league']
};

export async function fetchSharpMarkets(sportId: string): Promise<any[]> {
  const key = apiKeyFor(SportsApi.SharpApi);
  const leagues = SHARP_LEAGUES[sportId];
  if (!key || !leagues) return [];
  const out: any[] = [];
  for (const league of leagues) {
    try {
      const url = `${apiUrl(SportsApi.SharpApi)}/odds?league=${encodeURIComponent(league)}&market=moneyline,point_spread,total_points&limit=200`;
      const res = await fetch(url, { headers: { 'X-API-Key': key }, signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;
      const data: any = await res.json().catch(() => null);
      if (Array.isArray(data?.data)) out.push(...data.data);
    } catch {
      // one league failing must not drop the rest
    }
  }
  return out;
}

// SharpAPI rows are flat: each row is one selection of one market
// (HOME moneyline, AWAY moneyline, OVER total, etc.). Group rows by event key
// and collapse into the shared ConsolidatedOdds shape.
export function consolidateSharp(rows: any[]): ConsolidatedOdds[] {
  const byEvent = new Map<string, any[]>();
  for (const r of rows ?? []) {
    const home = String(r?.home_team || '').trim();
    const away = String(r?.away_team || '').trim();
    if (!home || !away) continue;
    const k = normalizeTeam(home) + '|' + normalizeTeam(away);
    if (!byEvent.has(k)) byEvent.set(k, []);
    byEvent.get(k)!.push(r);
  }

  const out: ConsolidatedOdds[] = [];
  for (const rows of byEvent.values()) {
    const home = String(rows[0]?.home_team || '').trim();
    const away = String(rows[0]?.away_team || '').trim();
    const ml = rows.filter((r) => r?.market_type === 'moneyline');
    let h2h: number[] | undefined;
    let drawPresent = false;
    const hp = ml.find((r) => String(r?.selection_type || '').toLowerCase() === 'home' || String(r?.team_side || '') === 'home');
    const ap = ml.find((r) => String(r?.selection_type || '').toLowerCase() === 'away' || String(r?.team_side || '') === 'away');
    const dp = ml.find((r) => /draw/i.test(String(r?.selection_type || r?.selection || '')));
    if (hp && ap) {
      drawPresent = !!dp;
      h2h = drawPresent && dp ? [Number(hp.odds_decimal), Number(dp.odds_decimal), Number(ap.odds_decimal)] : [Number(hp.odds_decimal), Number(ap.odds_decimal)];
    }

    let total: { line: number; over: number; under: number } | undefined;
    const tots = rows.filter((r) => r?.market_type === 'total_points' && Number(r?.line) > 0);
    const over = tots.find((r) => /over/i.test(String(r.selection)));
    const under = tots.find((r) => /under/i.test(String(r.selection)));
    if (over && under) {
      total = { line: Number(over.line), over: Number(over.odds_decimal), under: Number(under.odds_decimal) };
    }

    let spread: { point: number; home: number; away: number } | undefined;
    const sps = rows.filter((r) => r?.market_type === 'point_spread' && Number(r?.line) !== 0);
    const sHome = sps.find((r) => String(r?.selection_type || '').toLowerCase() === 'home' || String(r?.team_side || '') === 'home');
    const sAway = sps.find((r) => String(r?.selection_type || '').toLowerCase() === 'away' || String(r?.team_side || '') === 'away');
    if (sHome && sAway) {
      spread = { point: Number(sHome.line), home: Number(sHome.odds_decimal), away: Number(sAway.odds_decimal) };
    }

    if (h2h || total || spread) {
      const liveRows = rows.filter((r) => r?.is_live === true);
      out.push({ home, away, h2h, total, spread, drawPresent, live: liveRows.length > 0 });
    }
  }
  return out;
}

// SharpAPI rows also carry real fixtures (home_team/away_team + start time).
export function mapSharpFixtures(rows: any[], sportId: string): ApiFixture[] {
  const out: ApiFixture[] = [];
  const now = Date.now();
  const seen = new Set<string>();
  const lg: Record<string, string> = { football: 'Soccer', basketball: 'Basketball', tennis: 'Tennis', hockey: 'Hockey', baseball: 'Baseball', rally: 'Table Tennis', americanfootball: 'NFL', rugby: 'Rugby', cricket: 'Cricket', mma: 'MMA', volleyball: 'Volleyball' };
  for (const r of rows ?? []) {
    const home = String(r?.home_team || '').trim();
    const away = String(r?.away_team || '').trim();
    if (!home || !away) continue;
    const key = normalizeTeam(home) + '|' + normalizeTeam(away);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      home,
      away,
      league: String(r?.league || '') || (lg[sportId] ?? ''),
      startTime: Date.parse(String(r?.event_start_time || '')) || now + out.length * 2 * 60 * 60 * 1000,
      sourceUrl: 'https://api.sharpapi.io/api/v1/odds'
    });
  }
  return out;
}

// ── BallDontLie (NBA) ────────────────────────────────────────────────────────
export async function fetchBalldontlieGames(date: string): Promise<any[]> {
  const key = apiKeyFor(SportsApi.BallDontLie);
  if (!key) return [];
  try {
    const url = `${apiUrl(SportsApi.BallDontLie)}/games?dates[]=${date}`;
    const res = await fetch(url, { headers: { Authorization: key }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => null);
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}

export function mapBalldontlieGames(games: any[]): ApiFixture[] {
  const out: ApiFixture[] = [];
  for (const g of games ?? []) {
    const home = g?.home_team?.full_name;
    const away = g?.visitor_team?.full_name;
    if (!home || !away) continue;
    out.push({
      home: String(home),
      away: String(away),
      league: g?.home_team?.conference ? 'NBA' : '',
      startTime: Date.parse(g?.date ?? '') || Date.now(),
      sourceUrl: 'https://api.balldontlie.io/v1/games'
    });
  }
  return out;
}

// ── SportsData.io (NBA) ──────────────────────────────────────────────────────
export async function fetchSportsDataNbaGames(date: string): Promise<any[]> {
  const key = apiKeyFor(SportsApi.SportsDataIo);
  if (!key) return [];
  try {
    const url = `${apiUrl(SportsApi.SportsDataIo)}/nba/scores/json/GamesByDate/${date}?key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export function mapSportsDataNbaGames(games: any[]): ApiFixture[] {
  const out: ApiFixture[] = [];
  for (const g of games ?? []) {
    const home = g?.HomeTeam ?? g?.HomeTeamName;
    const away = g?.AwayTeam ?? g?.AwayTeamName;
    if (!home || !away) continue;
    out.push({
      home: String(home),
      away: String(away),
      league: 'NBA',
      startTime: Date.parse(g?.DateTime ?? '') || Date.now(),
      sourceUrl: 'https://api.sportsdata.io/v3/nba/scores/json/GamesByDate'
    });
  }
  return out;
}

// Aggregate real fixtures + their real consolidated odds for a sport across the
// working APIs, with a provider failover chain. The always-on providers
// (OddsPapi schedules + SharpAPI odds) come first; the quota-capped/free ones
// (The Odds API, TheSportsDB, BallDontLie, SportsData.io) complement them. Odds
// are returned alongside fixtures so the fixture agent can embed them directly,
// instead of relying on a later fragile team-name re-match.
export async function apiFixturesFor(
  sportId: string,
  date: string
): Promise<{ fixtures: ApiFixture[]; odds: ConsolidatedOdds[] }> {
  const results: ApiFixture[][] = [];
  const oddsGroup: ConsolidatedOdds[][] = [];

  // 1. OddsPapi — generous free schedules for every sport (preferred, always on).
  const opRaw = await fetchODDSPAPIFixtures(sportId, date);
  results.push(mapODDSPAPIFixtures(opRaw, sportId));

  // 2. SharpAPI — flat real odds (moneyline/spread/total) + their fixtures.
  const sharpRaw = await fetchSharpMarkets(sportId);
  results.push(mapSharpFixtures(sharpRaw, sportId));
  oddsGroup.push(consolidateSharp(sharpRaw));

  // 3. The Odds API feed (quota-capped but kept for drop-in parity when the
  //    key has credits). Query EVERY active league key for the sport so minor
  //    leagues and non-flagship tournaments are included, then merge fixtures +
  //    their real odds (league-tagged per key).
  const sportKeys = await resolveOddsSportKeys(sportId);
  if (sportKeys.length) {
    await Promise.all(
      sportKeys.map(async (sportKey) => {
        try {
          const raw = await fetchOddsMarkets(sportKey);
          results.push(mapOddsApiFixtures(raw, sportKey));
          oddsGroup.push(consolidateOdds(raw));
        } catch {
          // one league failing must not drop the rest
        }
      })
    );
  }

  const tsdbEvents = await fetchTheSportsDbEvents(date);
  results.push(mapSportsDbEvents(tsdbEvents, sportId));

  if (sportId === 'basketball') {
    results.push(mapBalldontlieGames(await fetchBalldontlieGames(date)));
    results.push(mapSportsDataNbaGames(await fetchSportsDataNbaGames(date)));
  }

  const seen = new Set<string>();
  const out: ApiFixture[] = [];
  for (const group of results) {
    for (const f of group) {
      const key = normalizeTeam(f.home) + '|' + normalizeTeam(f.away);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return { fixtures: out, odds: oddsGroup.flat() };
}

export function hasAnyApiKey(): boolean {
  return [
    SportsApi.TheSportsDB,
    SportsApi.TheOddsApi,
    SportsApi.BallDontLie,
    SportsApi.SportsDataIo,
    SportsApi.OddsPapi,
    SportsApi.SharpApi,
    SportsApi.SportsGameOdds,
    SportsApi.ParlayApi,
    SportsApi.PinnApi
  ].some((id) => !!apiKeyFor(id));
}

export function isSportsDbReady(): boolean {
  return !!env('THESPORTSDB_API_KEY');
}

export interface ApiMatchScore {
  home: string;
  away: string;
  finalScore: string;
  status: 'upcoming' | 'inplay' | 'finished';
}

export async function fetchScoresForDate(sportId: string, date: string): Promise<ApiMatchScore[]> {
  const scores: ApiMatchScore[] = [];
  const seen = new Set<string>();

  const pushScore = (home: string, away: string, hs: any, as: any, statusStr?: string) => {
    const hk = normalizeTeam(home);
    const ak = normalizeTeam(away);
    if (!hk || !ak) return;
    const key = `${hk}|${ak}`;
    if (seen.has(key)) return;

    let status: 'upcoming' | 'inplay' | 'finished' = 'upcoming';
    const s = String(statusStr || '').toLowerCase();

    if (/finish|ft|aot|end|final|postp|closed|completed/i.test(s)) {
      status = 'finished';
    } else if (/in play|live|ht|1h|2h|quarter|period|set|progress|playing/i.test(s)) {
      status = 'inplay';
    }

    let finalScore = '';
    if (hs !== undefined && hs !== null && as !== undefined && as !== null && String(hs).trim() !== '' && String(as).trim() !== '') {
      const h = Number(hs);
      const a = Number(as);
      // A scheduled (upcoming) match reporting "0 - 0" is a placeholder, not a
      // result — marking it finished pushed not-yet-started matches into the
      // Finished tab with a fake 0-0 scoreline. Only a real status string
      // (FT/finished/live) or a non-zero scoreline is treated as a result.
      const isZeroZeroPlaceholder = status === 'upcoming' && h === 0 && a === 0;
      if (!isZeroZeroPlaceholder) {
        finalScore = `${hs} - ${as}`;
        if (status === 'upcoming') status = 'finished';
      }
    }

    if (finalScore || status !== 'upcoming') {
      seen.add(key);
      scores.push({ home, away, finalScore, status });
    }
  };

  // 1. TheSportsDB
  try {
    const tsdbEvents = await fetchTheSportsDbEvents(date);
    const re = TSDB_SPORT_KEYS[sportId];
    if (re && Array.isArray(tsdbEvents)) {
      for (const e of tsdbEvents) {
        if (!re.test(String(e?.strSport || ''))) continue;
        const home = String(e?.strHomeTeam || '').trim();
        const away = String(e?.strAwayTeam || '').trim();
        const hs = e?.intHomeScore;
        const as = e?.intAwayScore;
        const status = e?.strStatus;
        if (home && away) pushScore(home, away, hs, as, status);
      }
    }
  } catch {}

  // 2. BallDontLie & SportsData.io for NBA
  if (sportId === 'basketball') {
    try {
      const bdlGames = await fetchBalldontlieGames(date);
      for (const g of bdlGames ?? []) {
        const home = g?.home_team?.full_name;
        const away = g?.visitor_team?.full_name;
        if (home && away) pushScore(String(home), String(away), g?.home_team_score, g?.visitor_team_score, g?.status);
      }
    } catch {}

    try {
      const sdGames = await fetchSportsDataNbaGames(date);
      for (const g of sdGames ?? []) {
        const home = g?.HomeTeam ?? g?.HomeTeamName;
        const away = g?.AwayTeam ?? g?.AwayTeamName;
        if (home && away) pushScore(String(home), String(away), g?.HomeTeamScore, g?.AwayTeamScore, g?.Status);
      }
    } catch {}
  }

  // 3. OddsPapi
  try {
    const opRaw = await fetchODDSPAPIFixtures(sportId, date);
    for (const f of opRaw ?? []) {
      const home = String(f?.participant1Name || '').trim();
      const away = String(f?.participant2Name || '').trim();
      const hs = f?.score1 ?? f?.homeScore ?? f?.scoreHome;
      const as = f?.score2 ?? f?.awayScore ?? f?.scoreAway;
      const status = f?.statusName ?? f?.status;
      if (home && away) pushScore(home, away, hs, as, status);
    }
  } catch {}

  return scores;
}

// ── HTML result-page failover (BetExplorer / FlashScore / Soccerway) ──────────
// Used when no API score was found for a cached match. Result pages are read
// through the reader chain (Jina → Firecrawl → BrightData) and scanned for rows
// containing both team names plus a score. Only targets passed by the caller are
// returned, so the inherently fragile text matching never fabricates fixtures.

const HTML_RESULT_PAGES: Record<string, Array<{ url: (date: string) => string }>> = {
  football: [
    { url: () => 'https://www.betexplorer.com/results/soccer/' },
    { url: () => 'https://www.flashscore.com/football/results/' },
    { url: (d) => `https://www.soccerway.com/matches/${dWithSlashes(d)}/` }
  ],
  basketball: [
    { url: () => 'https://www.betexplorer.com/results/basketball/' },
    { url: () => 'https://www.flashscore.com/basketball/results/' }
  ],
  tennis: [
    { url: () => 'https://www.betexplorer.com/results/tennis/' },
    { url: () => 'https://www.flashscore.com/tennis/results/' }
  ],
  hockey: [
    { url: () => 'https://www.betexplorer.com/results/ice-hockey/' },
    { url: () => 'https://www.flashscore.com/ice-hockey/results/' }
  ],
  baseball: [
    { url: () => 'https://www.betexplorer.com/results/baseball/' },
    { url: () => 'https://www.flashscore.com/baseball/results/' }
  ],
  americanfootball: [
    { url: () => 'https://www.betexplorer.com/results/american-football/' },
    { url: () => 'https://www.flashscore.com/american-football/results/' }
  ],
  volleyball: [
    { url: () => 'https://www.flashscore.com/volleyball/results/' }
  ],
  rugby: [
    { url: () => 'https://www.flashscore.com/rugby/results/' }
  ],
  rally: [
    { url: () => 'https://www.flashscore.com/table-tennis/results/' }
  ]
};

function dWithSlashes(date: string): string {
  const [y, m, dd] = String(date || '').split('-');
  return `${y}/${m}/${dd}`;
}

// ── Score plausibility guards ─────────────────────────────────────────────────
// A kickoff clock rendered as a bold/linked cell (e.g. **19:00**) is easily
// misread as a scoreline ("19 - 0") and marked FINISHED — exactly the garbage
// that previously leaked into the Finished tab. Two independent guards keep
// scorelines honest across every parsing path:
//   1. A candidate equal to the row's leading clock cell is never a score.
//   2. A per-sport plausibility cap rejects scores no real match can produce
//      (football will never show "112 - 98"; basketball will never show "3 - 1").
const SCORE_CAPS: Record<string, number> = {
  football: 15, // real football rarely exceeds ~10; 15 is generous
  basketball: 250, // NBA games run ~80-160 points
  tennis: 5, // sets won: 0-3 (or 0-2 retired)
  rally: 5, // sets won: 0-3 / 0-4
  hockey: 15,
  baseball: 40,
  americanfootball: 80,
  rugby: 120,
  cricket: 999, // innings totals are large; only the clock guard constrains them
  mma: 5, // MMA has no numeric scoreline; never trust high digits
  volleyball: 5 // sets won: 0-3 / 0-5
};

/** Whether a parsed home/away pair is plausible for a given sport. */
export function scoreIsPlausible(sportId: string, hs: number, as: number): boolean {
  const cap = SCORE_CAPS[sportId] ?? 99;
  return Number.isFinite(hs) && Number.isFinite(as) && hs >= 0 && as >= 0 && hs <= cap && as <= cap;
}

// Explicit full-time markers — presence means the row describes a finished game.
const FT_MARKER = /FT|full.?time|finished|ended|postponed|a\.?e\.?t|so\.?\(|result/i;

// Any pair inside the 13:00-23:59 / 00:13-00:59 window with no FT marker is a
// clock, not a score (clocks run 00-23 hours / 00-59 minutes; real scorelines
// like football 2-1 or hockey 3-2 never reach 13 on a side without a marker).
function scoreIsAcceptable(
  sportId: string,
  line: string,
  hs: number,
  as: number,
  clockH?: number,
  clockM?: number
): boolean {
  if (!scoreIsPlausible(sportId, hs, as)) return false;
  if (clockH !== undefined && hs === clockH && as === clockM) return false; // equals the leading clock cell
  if (hs <= 23 && as <= 59 && (hs >= 13 || as >= 13) && !FT_MARKER.test(line)) return false;
  return true;
}

// Parse the strongest "<home> <score> - <score> <away>" row that contains BOTH
// team names. Returns null unless a numeric, sport-plausible score is found.
//
// BetExplorer markdown rows look like:
//   | 20:30[**Home** - Away](url) | [**2:0**](url) | (1:0, 1:0) |
// The bolded `**2:0**` (or link-wrapped `[2:0](url)`) cell is the full-time
// score; the leading `20:30` is the kickoff CLOCK, not a score — a naive
// `(\d+)[-:]\d+` match would read "20 - 30". Every path therefore runs the
// candidate through `scoreIsAcceptable` (clock equality + plausibility cap).
export function scoreFromResultText(
  sportId: string,
  text: string,
  home: string,
  away: string
): { home: string; away: string; finalScore: string; status: 'upcoming' | 'inplay' | 'finished' } | null {
  const h = normalizeTeam(home);
  const a = normalizeTeam(away);
  if (!h || !a) return null;
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const norm = normalizeTeam(line);
    if (!norm.includes(h) || !norm.includes(a)) continue;

    // Leading clock cell (BetExplorer markdown `| 20:30 ...`, a bare row
    // starting with the time, or a whitespace-indented clock). Used to reject
    // any candidate that equals it.
    const clock = line.match(/(?:^\s*|\|\s*)(\d{1,2}):(\d{2})/);
    const clockH = clock ? Number(clock[1]) : undefined;
    const clockM = clock ? Number(clock[2]) : undefined;

    // 1. Bolded cell: **2:0** / **2 - 0**. A bolded kickoff clock such as
    //    **19:00** fails the caps/clock guards below and is never a score.
    const boldRe = /\*\*(\d{1,3})\s*[-—:]\s*(\d{1,3})\*\*/g;
    let bold: RegExpExecArray | null;
    while ((bold = boldRe.exec(line)) !== null) {
      const hs = Number(bold[1]);
      const as = Number(bold[2]);
      if (scoreIsAcceptable(sportId, line, hs, as, clockH, clockM)) {
        // Result pages only list finished matches, so an accepted bolded cell
        // is the full-time scoreline.
        return { home, away, finalScore: `${hs} - ${as}`, status: 'finished' };
      }
    }

    // 2. Link-wrapped score cell: [2:0](url) / [2 - 0](url)
    const linkedRe = /\[(\d{1,3})\s*[-—:]\s*(\d{1,3})\]\([^)]*\)/g;
    let linked: RegExpExecArray | null;
    while ((linked = linkedRe.exec(line)) !== null) {
      const hs = Number(linked[1]);
      const as = Number(linked[2]);
      if (scoreIsAcceptable(sportId, line, hs, as, clockH, clockM)) {
        return { home, away, finalScore: `${hs} - ${as}`, status: FT_MARKER.test(line) ? 'finished' : 'inplay' };
      }
    }

    // 3. Generic "Home 2 - 1 Away" row. Iterate EVERY score-shaped pair on the
    //    line, skipping kickoff-clock patterns (HH:MM <= 23:59 matching the
    //    row's leading time cell) and implausible scores. The first pair is
    //    often the clock, so a naive single match would miss the real score.
    const genericRe = /\b(\d{1,3})\s*[-—:]\s*(\d{1,3})\b/g;
    let generic: RegExpExecArray | null;
    while ((generic = genericRe.exec(line)) !== null) {
      const hs = Number(generic[1]);
      const as = Number(generic[2]);
      if (scoreIsAcceptable(sportId, line, hs, as, clockH, clockM)) {
        return { home, away, finalScore: `${hs} - ${as}`, status: FT_MARKER.test(line) ? 'finished' : 'inplay' };
      }
    }
  }
  return null;
}

// Read every result page for the sport (reader chain) and scan for the target
// pair. Never throws; returns only what text matching positively confirms.
export async function fetchHtmlResultScores(
  sportId: string,
  date: string,
  targets: { home: string; away: string }[]
): Promise<ApiMatchScore[]> {
  const pages = HTML_RESULT_PAGES[sportId];
  if (!pages || !targets?.length) return [];
  const out: ApiMatchScore[] = [];
  const found = new Set<string>();
  let attempted = 0;
  for (const page of pages) {
    if (attempted >= 2) break; // stop after two readable pages
    let pageText = '';
    try {
      const res = await readAny(page.url(date), { timeoutMs: 15_000 });
      if (!res.ok || !res.text) continue;
      pageText = res.text;
    } catch {
      continue;
    }
    attempted++;
    for (const t of targets) {
      const key = `${normalizeTeam(t.home)}|${normalizeTeam(t.away)}`;
      if (found.has(key)) continue;
      const matched = scoreFromResultText(sportId, pageText, t.home, t.away);
      if (matched) {
        found.add(key);
        out.push(matched);
      }
    }
  }
  return out;
}