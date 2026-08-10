// Multi-URL fixture aggegator ("URL directory" coordinator). Reads the sport's
// source-directory of real pages through the reader chain, parses fixtures and
// any decimal odds it can see, tags each match with the exact URL that produced
// it, and dedupes. Only the caller decides to fall back to synthetic data — this
// module never fabricates matches.

import { readAny } from './pages';
import { FIXTURE_PAGES, PRIMARY_SOURCE_URLS } from './sources';
import { type ScrapeMatch } from './betwatch';
import { matchBelongsToSport, serverLeagueBelongsToSport, serverCanonicalizeLeague } from '../predictor';

const SPORT_LEAGUES: Record<string, string[]> = {
  football: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Eredivisie', 'FA Cup', 'Europa', 'Championship', 'League One', 'League Two', 'EFL Cup', 'Serie B', 'Segunda', 'Bundesliga 2', 'Ligue 2', 'Primeira Liga', 'Super Lig', 'Liga MX', 'MLS', 'Scottish Premiership', 'Copa Libertadores', 'Copa America', 'World Cup', 'Nations League', 'Ekstraklasa', 'Czech First League', 'Croatian First League', 'Serbian SuperLiga', 'Romanian Liga 1', 'Hungarian NB I', 'Bulgarian First League', 'Slovak Super Liga', 'Slovenian Prva Liga', 'Veikkausliiga', 'Besta deild', 'Cyprus First Division', 'Israeli Premier League', 'Russian Premier League', 'Ukrainian Premier League', 'Kazakhstan Premier League', 'Chinese Super League', 'J1 League', 'J2 League', 'K League', 'A-League', 'Indian Super League', 'Saudi Pro League', 'UAE Pro League', 'Qatar Stars League', 'Egyptian Premier League', 'Botola', 'Tunisian Ligue', 'Algerian Ligue 1', 'Nigerian Premier League', 'Ghana Premier League', 'South African Premiership', 'USL Championship', 'Liga de Expansion', 'Brazil Serie B', 'Primera Nacional', 'Peru Liga 1', 'Paraguay Primera', 'Uruguay Primera', 'Ecuador Liga Pro', 'Bolivia Primera', 'Colombia Primera', 'Irish Premier Division', 'NIFL Premiership', 'Welsh Premier League'],
  basketball: ['NBA', 'EuroLeague', 'ACB', 'LNB', 'WNBA', 'NCAAB', 'CBA', 'PBA', 'EuroCup', 'ABA Liga', 'Ligat Haal', 'BSL', 'Greek Basket League', 'VTB', 'NBL', 'KBL', 'B.League', 'G League', 'Liga Endesa', 'LBA'],
  tennis: ['ATP', 'WTA', 'Grand Slam', 'Masters 1000', 'ATP Tour', 'WTA Tour', 'ATP Challenger', 'ITF'],
  rally: ['ITTF', 'WTT', 'World Table Tennis', 'Table Tennis', 'TT Cup'],
  hockey: ['NHL', 'KHL', 'SHL', 'Liiga', 'AHL', 'DEL', 'HockeyAllsvenskan', 'GET Ligaen', 'Metal Ligaen', 'Ligue Magnus', 'DEL2', 'ICEHL', 'Extraliga', 'VHL'],
  baseball: ['MLB', 'NPB', 'KBO', 'MiLB', 'CPBL', 'LIDOM', 'LBPRC', 'LVBP', 'LMB'],
  americanfootball: ['NFL', 'NCAAF', 'CFL', 'XFL', 'UFL', 'Super Bowl'],
  rugby: ['Six Nations', 'Rugby Championship', 'Premiership Rugby', 'Top 14', 'Super Rugby', 'World Cup Rugby', 'URC', 'Champions Cup', 'Japan League One', 'Major League Rugby', 'Currie Cup', 'NPC', 'NRL'],
  cricket: ['Test', 'ODI', 'T20', 'IPL', 'Big Bash', 'The Hundred', 'World Cup', 'Super League', 'T20 Blast', 'Caribbean Premier League', 'Lanka Premier League', 'Bangladesh Premier League', 'Nepal Premier League', 'SA20', 'ILT20', 'Pakistan Super League'],
  mma: ['UFC', 'Bellator', 'PFL', 'ONE Championship', 'MMA'],
  volleyball: ['FIVB', 'VNL', 'CEV', 'SuperLega', 'Superleague', 'Volleyball', 'PlusLiga', 'Efeler Ligi', 'Ligue A', 'Volleyball Bundesliga', 'V.League', 'Volleyball Super League']
};

// Honest fallback league label per sport. Used only when a parser cannot detect
// a real league header; it must be a word the sport's own keyword fingerprints
// recognise so rows still pass the matchBelongsToSport gate — but NEVER a real
// league name (e.g. 'NBA'), which would masquerade football fixtures as hoops.
const SPORT_LABELS: Record<string, string> = {
  football: 'Football',
  basketball: 'Basketball',
  tennis: 'Tennis',
  rally: 'Table Tennis',
  hockey: 'Ice Hockey',
  baseball: 'Baseball',
  americanfootball: 'American Football',
  rugby: 'Rugby',
  cricket: 'Cricket',
  mma: 'MMA',
  volleyball: 'Volleyball'
};

function clean(name: string): string {
  return String(name || '').replace(/[|#*_`~]/g, '').trim();
}

const UNKNOWN_LABELS = /^(prediction|predictions|odds|bet|bets|pred|match|game|live|score|btts|over|under|today|tomorrow|home|away|results?|summary|matches?|next|countries|my|login|register|sports?|favorites?|standings?|table|ranking|preview|analysis|form|h2h|head.?to.?head|stats?|statistics|markets?|lineups?|news|transfers?|injuries?)$/i;

const HEADER_OR_NAV_PATTERNS = [
  /^(home|away|team|fixture|result|score|odds|time|kickoff|date|league|competition|round|group|pool|stage|matchday|game ?week|week ?\d+|standings?|table|ranking|preview|analysis|stats?|markets?|form)$/i,
  /^(prediction|predictions|free ?bets?|bet of the day|tip(s|ster)?|bonus|promo|promotion|offer|claim|vip)$/i,
  /^(login|register|sign.?in|sign.?up|forgot ?password|my ?(account|profile|bets?|selections?))$/i
];

const NON_FIXTURE_PHRASES = [
  'head to head', 'h2h', 'previous meetings', 'last 5', 'form guide',
  'team news', 'lineups', 'where to watch', 'tv channel', 'live stream',
  'betting tips', 'prediction', 'preview', 'match preview',
  'odds comparison', 'best odds', 'bookmakers', 'in play', 'live scores'
];

function looksLikeTeam(name: string): boolean {
  const n = name.trim();
  if (n.length < 3 || n.length > 35) return false;
  if (UNKNOWN_LABELS.test(n)) return false;
  if (HEADER_OR_NAV_PATTERNS.some((re) => re.test(n))) return false;
  if (/(prediction|predictions|bet of|the day|sportsbook|promo|bonus|claim|login|register|countries|favorites?|my selections|head.?to.?head|form guide|last \d+|h2h|live score)/i.test(n)) return false;
  if (/^[\d\sMLSXLW]+$/i.test(n)) return false;
  if (/\*|#|\|/.test(n)) return false;
  const lower = n.toLowerCase();
  if (NON_FIXTURE_PHRASES.some((p) => lower.includes(p))) return false;
  if (/^(the|a|an|and|or|but|if|when|where|why|how|what|which|who|whom|whose|this|that|these|those|is|are|was|were|be|been|being|have|has|had|do|does|did|will|would|could|should|may|might|must|shall|can|need|dare|ought|used)$/i.test(n)) return false;
  const tokenCount = n.split(/\s+/).length;
  if (tokenCount > 7) return false;
  // Reject odds/number-shaped labels ("2.10", "10 on NGA", "3 - 1") so a
  // team or player is never rendered against a decimal odd instead of an opponent.
  if (/^\d{1,3}(?:\.\d{1,3})?$/.test(n)) return false;
  if (/^[\d.,\s-]+$/.test(n)) return false;
  if (/^\d{1,3}\s+on\s+\S+/i.test(n)) return false;
  if (/\b\d{1,2}\.\d{2,3}\b/.test(n) && !/[a-z]{3,}/i.test(n)) return false;
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
function parseBetexplorer(text: string, sportId: string, sourceUrl: string, dayKey?: string): ScrapeMatch[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leagues = SPORT_LEAGUES[sportId] ?? [];
  const out: ScrapeMatch[] = [];
  let currentLeague = '';

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
      league: currentLeague || SPORT_LABELS[sportId] || 'Scheduled Fixture',
      homeTeam: home,
      awayTeam: away,
      startTime: parseClock(rm[1], dayKey),
      markets: ['mainTotal', 'result'],
      oddsText: odds.slice(0, 3).map((n) => n.toFixed(2)).join(', ')
    });
  }
  return out;
}

// SoccerVista markdown-link feed. Fixture rows look like:
//   [20:00](url)[Egypt W](url)[](url)[Nigeria W W L W W W](url)[10 on NGA](url)
// under a league line like  [Africa: Africa Cup of Nations Women](url)
function parseSoccervista(text: string, sportId: string, sourceUrl: string, dayKey?: string): ScrapeMatch[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leagues = SPORT_LEAGUES[sportId] ?? [];
  const out: ScrapeMatch[] = [];
  let currentLeague = '';

  const rowRe = /\[(\d{1,2}:\d{2})\]\([^)]*\)(\[[^\[\]]+\]\([^)]*\))+/;

  for (const line of lines) {
    if (!rowRe.test(line)) {
      const labels = line.match(/\[([^\]]+)\]\([^)]*\)/g) ?? [];
      for (const l of labels) {
        const label = l.replace(/^\[|\]$/g, '').replace(/\([^)]*\)$/, '');
        if (/^Image/i.test(label)) continue;
        if (label.includes(':') && label.length < 60 && /[a-z]/i.test(label)) {
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
      league: currentLeague || SPORT_LABELS[sportId] || 'Scheduled Fixture',
      homeTeam: clean(teamA),
      awayTeam: clean(teamB),
      startTime: parseClock(time, dayKey),
      markets: ['mainTotal', 'result']
    });
  }
  return out;
}

// WAT-midnight epoch for a dayKey ('YYYY-MM-DD'). WAT is UTC+1, so the WAT day
// starts one hour before UTC midnight. Without a dayKey the current WAT day is
// used (UTC date minus 1h). Every scraped startTime is anchored to this day so
// fixtures land on the correct calendar date instead of "now"-relative stamps.
function baseOfDay(dayKey?: string): number {
  if (dayKey) {
    const m = String(dayKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) - 60 * 60 * 1000;
  }
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 60 * 60 * 1000;
}

// Interpret an HH:MM kickoff as WEST AFRICA TIME on the target dayKey; without a
// clock token, default to noon WAT so the calendar date is still correct.
function parseClock(raw: string, dayKey?: string): number {
  const hm = String(raw || '').match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    return baseOfDay(dayKey) + Number(hm[1]) * 60 * 60 * 1000 + Number(hm[2]) * 60 * 1000;
  }
  return baseOfDay(dayKey) + 12 * 60 * 60 * 1000;
}

export function parseFixtures(text: string, sportId: string, sourceUrl: string, dayKey?: string): ScrapeMatch[] {
  const seen = new Set<string>();
  const out: ScrapeMatch[] = [];
  const push = (m: ScrapeMatch) => {
    const canonLeague = serverCanonicalizeLeague(m.league || '', sportId) || (m.league || '');
    const key = `${sportId}|${canonLeague}|${m.homeTeam}|${m.awayTeam}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (seen.has(key)) return;
    if (!serverLeagueBelongsToSport(canonLeague || m.league || '', sportId)) return;
    if (!matchBelongsToSport({ league: canonLeague || m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, source: m.source }, sportId)) return;
    seen.add(key);
    out.push(m);
  };

  // 1. BetExplorer-style tables.
  for (const m of parseBetexplorer(text, sportId, sourceUrl, dayKey)) push(m);
  // 2. SoccerVista-style markdown-link rows.
  for (const m of parseSoccervista(text, sportId, sourceUrl, dayKey)) push(m);
  // 3. Generic "TeamA vs TeamB" lines.
  for (const m of parseVsLines(text, sportId, sourceUrl, dayKey)) push(m);

  return out;
}

function parseVsLines(text: string, sportId: string, sourceUrl: string, dayKey?: string): ScrapeMatch[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leagues = SPORT_LEAGUES[sportId] ?? [];
  const out: ScrapeMatch[] = [];
  let currentLeague = '';

  const leaguePattern = /^#{1,3}\s+(.+)$/;
  const vsPatterns = [
    /^(.+?)\s+(?:vs\.?|v)\s+(.+?)(?:\s+[—-]\s+.*)?$/i,
    /^\d{1,2}:\d{2}\s+(.+?)\s+(?:vs\.?|v)\s+(.+)$/i,
    /^(.+?)\s+[—-]\s+(.+)$/
  ];

  for (const line of lines) {
    const lmatch = line.match(leaguePattern);
    if (lmatch && leagues.some((l) => lmatch[1].toLowerCase().includes(l.toLowerCase()))) {
      currentLeague = clean(lmatch[1]);
      continue;
    }
    if (lmatch && leagues.length > 0) {
      const candidate = lmatch[1].toLowerCase();
      if (!leagues.some((l) => candidate.includes(l.toLowerCase()))) {
        currentLeague = '';
        continue;
      }
    }

    let home = '';
    let away = '';
    let matched = false;
    for (let pi = 0; pi < vsPatterns.length; pi++) {
      const re = vsPatterns[pi];
      const vm = line.match(re);
      if (vm && vm[1] && vm[2]) {
        const h = clean(vm[1]);
        const a = clean(vm[2]);
        if (pi === 2) {
          if (/^\d/.test(h) || /^\d/.test(a)) continue;
          if (/[—\-|#*]/.test(h) || /[—\-|#*]/.test(a)) continue;
        }
        if (looksLikeTeam(h) && looksLikeTeam(a) && !['0', '1', '2', '3'].includes(h) && !['0', '1', '2', '3'].includes(a)) {
          home = h;
          away = a;
          matched = true;
          break;
        }
      }
    }
    if (!matched) continue;

    // Leading kickoff clock (e.g. "20:00 Team A vs Team B") — anchor it to the
    // target WAT day; otherwise default to noon WAT with spacing per fixture.
    const leadingClock = line.match(/^\d{1,2}:\d{2}/)?.[0] ?? '';
    const oddsIdx = line.indexOf(home);
    const odds = oddsFrom(oddsIdx >= 0 ? line.slice(oddsIdx) : line);
    out.push({
      source: 'LiveScrape',
      sourceUrl,
      league: currentLeague || SPORT_LABELS[sportId] || 'Scheduled Fixture',
      homeTeam: home,
      awayTeam: away,
      startTime: leadingClock ? parseClock(leadingClock, dayKey) : baseOfDay(dayKey) + 12 * 60 * 60 * 1000 + out.length * 2 * 60 * 60 * 1000,
      markets: ['mainTotal', 'result'],
      oddsText: odds.slice(0, 3).map((n) => n.toFixed(2)).join(', ')
    });
  }
  return out;
}

function dedupe(matches: ScrapeMatch[], sportId: string): ScrapeMatch[] {
  const seen = new Set<string>();
  const out: ScrapeMatch[] = [];
  for (const m of matches) {
    const canonLeague = serverCanonicalizeLeague(m.league || '', sportId) || (m.league || '');
    const key = `${sportId}|${canonLeague}|${m.homeTeam}|${m.awayTeam}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (seen.has(key)) continue;
    if (!serverLeagueBelongsToSport(canonLeague || m.league || '', sportId)) continue;
    if (!matchBelongsToSport({ league: canonLeague || m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, source: m.source }, sportId)) continue;
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

export async function scrapeRealFixtures(sportId: string, dayKey?: string): Promise<RealFixturesResult> {
  // ONLY the verified per-sport pages are parsed for fixtures. The general
  // directory sources (news, operators, blogs, registry homepages) stay
  // available for research/citations but are never fed to the row parsers —
  // generic pages are the #1 source of cross-sport mislabelled fixtures.
  const urls = FIXTURE_PAGES[sportId] ?? [];
  const pagesFetched: RealFixturesResult['pagesFetched'] = [];
  const collected: ScrapeMatch[] = [];

  await mapLimit(urls, 4, async (url) => {
    const page = await readAny(url, { timeoutMs: 18_000 });
    pagesFetched.push({ url, ok: page.ok, engine: page.engine });
    if (!page.ok) return;
    const parsed = parseFixtures(page.text, sportId, url, dayKey);
    if (parsed.length > 0) collected.push(...parsed);
  });

  const matches = dedupe(collected, sportId);
  const citations = matches.map((m) => m.sourceUrl).filter((u) => u && !PRIMARY_SOURCE_URLS.includes(u));
  return {
    matches,
    usedSynthetic: false,
    pagesFetched,
    citations: Array.from(new Set(citations))
  };
}