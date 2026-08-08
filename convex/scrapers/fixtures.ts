// Multi-URL fixture aggegator ("URL directory" coordinator). Reads the sport's
// source-directory of real pages through the reader chain, parses fixtures and
// any decimal odds it can see, tags each match with the exact URL that produced
// it, and dedupes. Only the caller decides to fall back to synthetic data — this
// module never fabricates matches.

import { readAny } from './pages';
import { sourceUrlsFor, PRIMARY_SOURCE } from './sources';
import { type ScrapeMatch } from './betwatch';

const SPORT_LEAGUES: Record<string, string[]> = {
  football: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Eredivisie', 'FA Cup', 'Europa', 'Championship', 'League One', 'League Two', 'EFL Cup', 'Serie B', 'Segunda', 'Bundesliga 2', 'Ligue 2', 'Primeira Liga', 'Super Lig', 'Liga MX', 'MLS', 'Scottish Premiership', 'Copa Libertadores', 'Copa America', 'World Cup', 'Nations League'],
  basketball: ['NBA', 'EuroLeague', 'ACB', 'LNB', 'WNBA', 'NCAAB', 'CBA', 'PBA'],
  tennis: ['ATP', 'WTA', 'Grand Slam', 'Masters 1000', 'ATP Tour', 'WTA Tour'],
  rally: ['ITTF', 'WTT', 'World Table Tennis', 'Table Tennis', 'TT Cup'],
  hockey: ['NHL', 'KHL', 'SHL', 'Liiga', 'AHL', 'DEL'],
  baseball: ['MLB', 'NPB', 'KBO', 'MiLB'],
  americanfootball: ['NFL', 'NCAAF', 'CFL', 'XFL', 'Super Bowl'],
  rugby: ['Six Nations', 'Rugby Championship', 'Premiership Rugby', 'Top 14', 'Super Rugby', 'World Cup Rugby', 'URC'],
  cricket: ['Test', 'ODI', 'T20', 'IPL', 'Big Bash', 'The Hundred', 'World Cup', 'Super League'],
  mma: ['UFC', 'Bellator', 'PFL', 'ONE Championship', 'MMA'],
  volleyball: ['FIVB', 'VNL', 'CEV', 'SuperLega', 'Superleague', 'Volleyball']
};

function clean(name: string): string {
  return String(name || '').replace(/[|#*_`~]/g, '').trim();
}

const UKNOWN_LABELS = /^(prediction|predictions|odds|bet|bets|pred|match|game|live|score|btts|over|under|today|tomorrow|home|away|results|result|summary|matches|next|countries|my|login|register|sports|favorites)$/i;

function looksLikeTeam(name: string): boolean {
  const n = name.trim();
  if (n.length < 3 || n.length > 35) return false;
  if (UKNOWN_LABELS.test(n)) return false;
  if (/(prediction|predictions|bet of|the day|sportsbook|promo|bonus|claim|login|register|countries|favorites|my selections)/i.test(n)) return false;
  if (/^[\d\sMLSXLW]+$/i.test(n)) return false;
  if (/\*|#|\|/.test(n)) return false;
  return true;
}

// Extract decimal odds tokens (>= 1.01) from a chunk of text.
function oddsFrom(text: string): number[] {
  const nums: number[] = [];
  const re = /\b(\d{1,2}\.\d{2,3})\b/g;
  let m;
  while ((m = re.exec(text)) && nums.length < 6) {
    const v = Number(m[1]);
    if (v >= 1.01 && v <= 15) nums.push(v);
  }
  return nums;
}

// Strip leading/trailing form or score tokens from a team label (e.g.
// "L L W L W Egypt W" → "Egypt", "San Martin S.J. 2 D D L L L" → "San Martin S.J.").
function stripForm(name: string): string {
  return name
    .replace(/^(?:(?:[0-9]+|[WDLX])\s+)+/i, '')
    .replace(/\s+(?:[0-9]+(?:\s+[WDLX])*)$/i, '')
    .replace(/\s+(?:[WDLX](?:\s+[WDLX0-9])*)$/i, '')
    .trim();
}

// BetExplorer table feed. Rows look like:
//   | _..._ Colombia: Primera A](url) | 1 | X | 2 |
//   | 03:20[Millonarios - Dep. Pasto](url) | 1.85 | 3.40 | 2.10 |
function parseBetexplorer(text: string, sportId: string, sourceUrl: string): ScrapeMatch[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leagues = SPORT_LEAGUES[sportId] ?? [];
  const out: ScrapeMatch[] = [];
  let currentLeague = '';
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const leagueRe = /\]:\s*([^\]]+?)\]\(/;
  const rowRe = /^\|\s*(\d{1,2}:\d{2})\s*\[([^\]]+?)\s*-\s*([^\]]+)\]\([^)]*\)\s*(\|.*)?$/;

  for (const line of lines) {
    const lm = line.match(leagueRe);
    if (lm) {
      const candidate = clean(lm[1]);
      if (leagues.some((l) => candidate.toLowerCase().includes(l.toLowerCase()))) {
        currentLeague = candidate;
        continue;
      }
    }
    const rm = line.match(rowRe);
    if (!rm) continue;
    const home = clean(rm[2]);
    const away = clean(rm[3]);
    if (!looksLikeTeam(home) || !looksLikeTeam(away)) continue;
    const odds = oddsFrom(rm[4] ?? '');
    out.push({
      source: 'LiveScrape',
      sourceUrl,
      league: currentLeague || (leagues[0] ?? 'Top League'),
      homeTeam: home,
      awayTeam: away,
      startTime: parseClock(rm[1], now + day + out.length * 2 * 60 * 60 * 1000),
      markets: ['mainTotal', 'result'],
      oddsText: odds.slice(0, 3).map((n) => n.toFixed(2)).join(', ')
    });
  }
  return out;
}

// SoccerVista markdown-link feed. Fixture rows look like:
//   [20:00](url)[Egypt W](url)[](url)[Nigeria W W L W W W](url)[10 on NGA](url)
// under a league line like  [Africa: Africa Cup of Nations Women](url)
function parseSoccervista(text: string, sportId: string, sourceUrl: string): ScrapeMatch[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leagues = SPORT_LEAGUES[sportId] ?? [];
  const out: ScrapeMatch[] = [];
  let currentLeague = '';
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const rowRe = /\[(\d{1,2}:\d{2})\]\([^)]*\)(\[[^\[\]]+\]\([^)]*\))+/;

  for (const line of lines) {
    if (!rowRe.test(line)) {
      const labels = line.match(/\[([^\]]+)\]\([^)]*\)/g) ?? [];
      for (const l of labels) {
        const label = l.replace(/^\[|\]$/g, '').replace(/\([^)]*\)$/, '');
        if (/^Image/i.test(label)) continue;
        if (label.includes(':') && label.length < 60) {
          currentLeague = clean(label);
          break;
        }
      }
      continue;
    }
    const links = line.match(/\[([^\[\]]+)\]\(([^)]*)\)/g) ?? [];
    if (links.length < 3) continue;
    const time = links[0]?.match(/\d{1,2}:\d{2}/)?.[0] ?? '';
    const labels = links.map((l) => l.match(/^\[([^\]]*)\]/)?.[1] ?? '');
    const teamA = stripForm(labels[1] ?? '');
    const teamB = stripForm(labels[2] ?? '');
    if (!looksLikeTeam(teamA) || !looksLikeTeam(teamB)) continue;
    out.push({
      source: 'LiveScrape',
      sourceUrl,
      league: currentLeague || (leagues[0] ?? 'Top League'),
      homeTeam: clean(teamA),
      awayTeam: clean(teamB),
      startTime: parseClock(time, now + day + out.length * 2 * 60 * 60 * 1000),
      markets: ['mainTotal', 'result']
    });
  }
  return out;
}

function parseClock(raw: string, fallback: number): number {
  const hm = String(raw || '').match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    const d = new Date();
    d.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
    return d.getTime();
  }
  return fallback;
}

export function parseFixtures(text: string, sportId: string, sourceUrl: string): ScrapeMatch[] {
  const seen = new Set<string>();
  const out: ScrapeMatch[] = [];
  const push = (m: ScrapeMatch) => {
    const key = `${m.homeTeam}|${m.awayTeam}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(m);
  };

  // 1. BetExplorer-style tables.
  for (const m of parseBetexplorer(text, sportId, sourceUrl)) push(m);
  // 2. SoccerVista-style markdown-link rows.
  for (const m of parseSoccervista(text, sportId, sourceUrl)) push(m);
  // 3. Generic "TeamA vs TeamB" lines.
  for (const m of parseVsLines(text, sportId, sourceUrl)) push(m);

  return out;
}

function parseVsLines(text: string, sportId: string, sourceUrl: string): ScrapeMatch[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leagues = SPORT_LEAGUES[sportId] ?? [];
  const out: ScrapeMatch[] = [];
  let currentLeague = '';
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const leaguePattern = /^#{1,3}\s+(.+)$/;
  const vsPatterns = [
    /^(.+?)\s+(?:vs\.?|v|@)\s+(.+?)(?:\s+[—-]\s+.*)?$/i,
    /^(.+?)\s+(?:vs\.?|v)\s+(.+)$/i,
    /^(.+)\s+[—-]\s+(.+)$/
  ];

  for (const line of lines) {
    const lmatch = line.match(leaguePattern);
    if (lmatch && leagues.some((l) => lmatch[1].toLowerCase().includes(l.toLowerCase()))) {
      currentLeague = clean(lmatch[1]);
      continue;
    }

    let home = '';
    let away = '';
    let matched = false;
    for (const re of vsPatterns) {
      const vm = line.match(re);
      if (vm && vm[1] && vm[2]) {
        const h = clean(vm[1]);
        const a = clean(vm[2]);
        if (looksLikeTeam(h) && looksLikeTeam(a) && !['0', '1', '2', '3'].includes(h) && !['0', '1', '2', '3'].includes(a)) {
          home = h;
          away = a;
          matched = true;
          break;
        }
      }
    }
    if (!matched) continue;

    const oddsIdx = line.indexOf(home);
    const odds = oddsFrom(oddsIdx >= 0 ? line.slice(oddsIdx) : line);
    out.push({
      source: 'LiveScrape',
      sourceUrl,
      league: currentLeague || (leagues[0] ?? 'Top League'),
      homeTeam: home,
      awayTeam: away,
      startTime: now + day + out.length * 2 * 60 * 60 * 1000,
      markets: ['mainTotal', 'result'],
      oddsText: odds.slice(0, 3).map((n) => n.toFixed(2)).join(', ')
    });
  }
  return out;
}

function dedupe(matches: ScrapeMatch[]): ScrapeMatch[] {
  const seen = new Set<string>();
  const out: ScrapeMatch[] = [];
  for (const m of matches) {
    const key = `${m.homeTeam}|${m.awayTeam}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

// Run fn over arr with at most limit in flight.
async function mapLimit<T, R>(arr: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(arr.length);
  let idx = 0;
  const workers = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (idx < arr.length) {
      const i = idx++;
      results[i] = await fn(arr[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export interface RealFixturesResult {
  matches: ScrapeMatch[];
  usedSynthetic: boolean;
  pagesFetched: { url: string; ok: boolean; engine: string }[];
  citations: string[];
}

export async function scrapeRealFixtures(sportId: string): Promise<RealFixturesResult> {
  const urls = sourceUrlsFor(sportId);
  const pagesFetched: RealFixturesResult['pagesFetched'] = [];
  const collected: ScrapeMatch[] = [];

  await mapLimit(urls, 4, async (url) => {
    const page = await readAny(url, { timeoutMs: 18_000 });
    pagesFetched.push({ url, ok: page.ok, engine: page.engine });
    if (!page.ok) return;
    const parsed = parseFixtures(page.text, sportId, url);
    if (parsed.length > 0) collected.push(...parsed);
  });

  const matches = dedupe(collected);
  const citations = matches.map((m) => m.sourceUrl).filter((u) => u && u !== PRIMARY_SOURCE);
  return {
    matches,
    usedSynthetic: false,
    pagesFetched,
    citations: Array.from(new Set(citations))
  };
}