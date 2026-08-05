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

declare const process: { env: Record<string, string | undefined> };

const TSDB_PUBLIC_KEY = '123';

// Preferred Odds API sport keys (first active match wins). Tennis keys rotate by
// tournament (e.g. tennis_atp_canadian_open) and NBA vanishes in the off-season,
// so resolution is dynamic against the live /v4/sports/ list.
const ODDS_SPORT_PREFERENCE: Record<string, RegExp[]> = {
  football: [/^soccer_epl$/, /^soccer_england_/, /^soccer_/],
  basketball: [/^basketball_nba$/, /^basketball_wnba$/, /^basketball_/],
  tennis: [/^tennis_.*(?:grand_slam|atp)/, /^tennis_.*wta/, /^tennis_/],
  hockey: [/^icehockey_nhl$/, /^icehockey_/],
  baseball: [/^baseball_mlb$/, /^baseball_/]
};

let oddsSportsCache: { at: number; keys: string[] } | null = null;

export const TSDB_SPORT: Record<string, string> = {
  football: 'Soccer',
  basketball: 'Basketball',
  tennis: 'Tennis',
  hockey: 'IceHockey',
  baseball: 'Baseball',
  rally: 'Motorsport'
};

export const TSDB_SPORT_KEYS: Record<string, RegExp> = {
  football: /^soccer$/i,
  basketball: /basketball/i,
  tennis: /tennis/i,
  hockey: /ice\s*hockey|nhl/i,
  baseball: /baseball|mlb/i,
  rally: /motor|rally|formula/i
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

// ── TheSportsDB (multi-sport events for a date) ──────────────────────────────
export async function fetchTheSportsDbEvents(date: string): Promise<any[]> {
  try {
    const url = `${apiUrl(SportsApi.TheSportsDB)}/${TSDB_PUBLIC_KEY}/eventsday.php?d=${date}`;
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

// ── The Odds API (real bookmaker odds) ───────────────────────────────────────
export async function fetchOddsMarkets(sportKey: string, markets = 'h2h,totals,spreads'): Promise<any[]> {
  const key = apiKeyFor(SportsApi.TheOddsApi);
  if (!key) return [];
  try {
    const url = `${apiUrl(SportsApi.TheOddsApi)}/sports/${sportKey}/odds/?apiKey=${key}&regions=uk,eu,us&markets=${markets}&oddsFormat=decimal`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Active sport keys from The Odds API, cached for a few minutes per process.
export async function fetchOddsSportKeys(): Promise<string[]> {
  const key = apiKeyFor(SportsApi.TheOddsApi);
  if (!key) return [];
  if (oddsSportsCache && Date.now() - oddsSportsCache.at < 5 * 60 * 1000) return oddsSportsCache.keys;
  try {
    const url = `${apiUrl(SportsApi.TheOddsApi)}/sports/?apiKey=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data: any = await res.json().catch(() => null);
    const active = Array.isArray(data)
      ? data.filter((s: any) => s?.active && typeof s?.key === 'string').map((s: any) => s.key)
      : [];
    oddsSportsCache = { at: Date.now(), keys: active };
    return active;
  } catch {
    return [];
  }
}

// Resolve the best Odds API key for a sport against the live /v4/sports/ list so
// tournament rotations (tennis) and off-season windows (NBA) don't yield
// UNKNOWN_SPORT / empty results. Falls back to the static preference otherwise.
export async function resolveOddsSportKey(sportId: string): Promise<string | undefined> {
  const prefs = ODDS_SPORT_PREFERENCE[sportId];
  if (!prefs) return undefined;
  const keys = await fetchOddsSportKeys();
  if (keys.length) {
    const futures = /winner|championship|outright/i;
    for (const re of prefs) {
      const match = keys.find((k) => re.test(k) && !futures.test(k));
      if (match) return match;
    }
    return undefined;
  }
  const fallback: Record<string, string> = {
    football: 'soccer_epl',
    basketball: 'basketball_nba',
    tennis: 'tennis_atp_canadian_open',
    hockey: 'icehockey_nhl',
    baseball: 'baseball_mlb'
  };
  return fallback[sportId];
}

export interface ConsolidatedOdds {
  home: string;
  away: string;
  h2h?: number[]; // [home, away] for 2-way, [home, draw, away] for 1X2
  total?: { line: number; over: number; under: number };
  drawPresent: boolean;
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

    out.push({ home, away, h2h, total, drawPresent });
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
  return parts.join(' ');
}

export function findOddsFor(odds: ConsolidatedOdds[], home: string, away: string): ConsolidatedOdds | undefined {
  const hk = normalizeTeam(home);
  const ak = normalizeTeam(away);
  return odds.find((o) => normalizeTeam(o.home) === hk && normalizeTeam(o.away) === ak);
}

// The Odds API response also carries the real fixtures (home_team, away_team,
// commence_time) — feed them into the fixture agent so fixtures and odds match.
export function mapOddsApiFixtures(matches: any[]): ApiFixture[] {
  const out: ApiFixture[] = [];
  const now = Date.now();
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
      league: 'Live Odds Fixtures',
      startTime: startTime > now * 0.5 ? startTime : now + out.length * 2 * 60 * 60 * 1000,
      sourceUrl: 'https://api.the-odds-api.com/v4'
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

// Aggregate real fixtures for a sport across the working APIs. The Odds API
// fixtures come first (they carry matching real odds); then TheSportsDB
// multi-sport; then the NBA providers for basketball.
export async function apiFixturesFor(sportId: string, date: string): Promise<ApiFixture[]> {
  const results: ApiFixture[][] = [];

  const sportKey = await resolveOddsSportKey(sportId);
  if (sportKey) {
    results.push(mapOddsApiFixtures(await fetchOddsMarkets(sportKey)));
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
  return out;
}

export function hasAnyApiKey(): boolean {
  return [SportsApi.TheSportsDB, SportsApi.TheOddsApi, SportsApi.BallDontLie, SportsApi.SportsDataIo].some(
    (id) => !!apiKeyFor(id)
  );
}

export function isSportsDbReady(): boolean {
  return !!env('THESPORTSDB_API_KEY');
}