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
  football: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Eredivisie', 'FA Cup', 'Europa', 'Championship', 'League One', 'League Two', 'EFL Cup', 'Serie B', 'Segunda', 'Bundesliga 2', 'Ligue 2', 'Primeira Liga', 'Super Lig', 'Liga MX', 'MLS', 'Scottish Premiership', 'Copa Libertadores', 'Copa America', 'World Cup', 'Nations League', 'Ekstraklasa', 'Czech First League', 'Croatian First League', 'Serbian SuperLiga', 'Romanian Liga 1', 'Hungarian NB I', 'Bulgarian First League', 'Slovak Super Liga', 'Slovenian Prva Liga', 'Veikkausliiga', 'Besta deild', 'Cyprus First Division', 'Israeli Premier League', 'Russian Premier League', 'Ukrainian Premier League', 'Kazakhstan Premier League', 'Chinese Super League', 'J1 League', 'J2 League', 'K League', 'A-League', 'Indian Super League', 'Saudi Pro League', 'UAE Pro League', 'Qatar Stars League', 'Egyptian Premier League', 'Botola', 'Tunisian Ligue', 'Algerian Ligue 1', 'Nigerian Premier League', 'Ghana Premier League', 'South African Premiership', 'USL Championship', 'Liga de Expansion', 'Brazil Serie B', 'Primera Nacional', 'Peru Liga 1', 'Paraguay Primera', 'Uruguay Primera', 'Ecuador Liga Pro', 'Bolivia Primera', 'Colombia Primera', 'Irish Premier Division', 'NIFL Premiership', 'Welsh Premier League', 'Latvian Virsliga', 'Lithuanian A Lyga', 'Estonian Meistriliiga', 'Belarusian Premier League', 'Moldovan Super Liga', 'Georgian Erovnuli Liga', 'Armenian Premier League', 'Azerbaijan Premier League', 'Kosovo Superleague', 'Maltese Premier League', 'Gibraltar Football League', 'San Marino', 'Andorra Primera', 'Luxembourg National Division', 'Albanian Superliga', 'Bosnian Premier League', 'North Macedonia First League', 'Montenegro First League', 'Kenya Premier League', 'Uganda Premier League', 'Tanzania Premier League', 'Zambia Super League', 'Zimbabwe Premier League', 'Angola Girabola', 'Mozambique Moçambola', 'Ethiopian Premier League', 'Ivory Coast Ligue 1', 'DR Congo Linafoot', 'Cameroon Elite One', 'Senegal Ligue 1', 'Mali Premiere Division', 'Burkina Faso', 'Togo', 'Benin', 'Sudan Premier League', 'Libya Premier League', 'Iraqi Premier League', 'Jordan Pro League', 'Lebanon Premier League', 'Kuwait Premier League', 'Oman Pro League', 'Bahrain Premier League', 'Hong Kong Premier League', 'Singapore Premier League', 'Malaysia Super League', 'Indonesia Liga 1', 'Philippines Football League', 'Mongolia Premier League', 'Uzbekistan Super League', 'Kyrgyzstan Premier League', 'Tajikistan League', 'Turkmenistan', 'Myanmar National League', 'Cambodia Premier League', 'Laos League', 'Brunei Super League', 'Papua New Guinea', 'Fiji', 'New Caledonia', 'Tahiti', 'Vanuatu', 'Samoa', 'Tonga'],
  basketball: ['NBA', 'EuroLeague', 'ACB', 'LNB', 'LNB Pro A', 'LNB Pro B', 'WNBA', 'NCAAB', 'NCAA', 'CBA', 'PBA', 'EuroCup', 'ABA Liga', 'Ligat Haal', 'BSL', 'Turkish Basketball', 'Greek Basket League', 'A1 Ethniki', 'VTB', 'NBL', 'KBL', 'B.League', 'G League', 'Liga Endesa', 'LBA', 'Lega Basket', 'Serie A2 Basket', 'BNXT', 'BBL', 'German BBL', 'ProA', 'Italian SuperLega', 'Superliga Argentina', 'NBB', 'Brazilian NBB', 'LNBP', 'LPB', 'BSN', 'Liga Nacional de Básquet', 'Chile Liga Nacional', 'Uruguay Liga', 'Colombia Baloncesto', 'Peru Liga Basket', 'Korisliiga', 'Basketligan', 'Liga Unike', 'ABA', 'FIBA Europe Cup', 'Basketball Champions League', 'Liga Sudamericana', 'NBL Canada', 'TBL', 'KBL', 'PBA Commissioner', 'B.League B2', 'Superleague Greece'],
  tennis: ['ATP', 'WTA', 'Grand Slam', 'Masters 1000', 'ATP Tour', 'WTA Tour', 'ATP Challenger', 'ITF', 'ATP 250', 'ATP 500', 'WTA 125', 'Davis Cup', 'Billie Jean King Cup', 'United Cup', 'Laver Cup', 'Next Gen Finals', 'ATP Finals', 'WTA Finals', 'Wimbledon', 'US Open', 'Australian Open', 'French Open', 'Roland Garros'],
  rally: ['ITTF', 'WTT', 'World Table Tennis', 'Table Tennis', 'TT Cup', 'WTT Champions', 'WTT Contender', 'WTT Star Contender', 'Europe Top 16', 'ITTF World Tour'],
  hockey: ['NHL', 'KHL', 'SHL', 'Liiga', 'AHL', 'DEL', 'HockeyAllsvenskan', 'GET Ligaen', 'Metal Ligaen', 'Ligue Magnus', 'DEL2', 'ICEHL', 'Extraliga', 'VHL', 'Czech Extraliga', 'Slovak Extraliga', 'Tipsport Extraliga', 'Alps Hockey League', 'ECHL', 'SPHL', 'Mestis', 'Hockeyettan', 'NCAA Hockey', 'Champions Hockey League', 'Kazakhstan Hockey', 'Premier Hockey League', 'Slovenian Hockey', 'Polish Hockey League', 'Erste Liga', 'Romanian Hockey League', 'Latvian Hockey League', 'Belarusian Extraliga', 'Swiss National League', 'NL Switzerland', 'OHL', 'QMJHL', 'WHL'],
  baseball: ['MLB', 'NPB', 'KBO', 'MiLB', 'CPBL', 'LIDOM', 'LBPRC', 'LVBP', 'LMB', 'Serie del Caribe', 'Caribbean Series', 'ABL', 'Australian Baseball League', 'World Baseball Classic', 'Premier12', 'Atlantic League', 'Frontier League', 'American Association', 'NCAA Baseball', 'Cuban National Series', 'Colombian Baseball', 'Nicaragua Baseball', 'Panama Baseball'],
  americanfootball: ['NFL', 'NCAAF', 'CFL', 'XFL', 'UFL', 'Super Bowl', 'Grey Cup', 'USFL', 'NCAA FCS', 'NCAA Division II', 'NCAA Division III', 'Arena Football', 'European League of Football', 'ELF'],
  rugby: ['Six Nations', 'Rugby Championship', 'Premiership Rugby', 'Top 14', 'Super Rugby', 'World Cup Rugby', 'URC', 'Champions Cup', 'Japan League One', 'Major League Rugby', 'Currie Cup', 'NPC', 'NRL', 'Pro D2', 'Super Rugby Americas', 'SRA', 'Challenge Cup', 'EPCR', 'Premiership Women', 'Rugby League World Cup', 'State of Origin', 'Super League Rugby', 'French Nationale', 'Domestic Top League'],
  cricket: ['Test', 'ODI', 'T20', 'IPL', 'Big Bash', 'The Hundred', 'World Cup', 'Super League', 'T20 Blast', 'Caribbean Premier League', 'Lanka Premier League', 'Bangladesh Premier League', 'Nepal Premier League', 'SA20', 'ILT20', 'Pakistan Super League', 'Major League Cricket', 'MLC', 'Global T20 Canada', 'Zimbabwe T20', 'Ireland T20', 'Super Smash', 'New Zealand Super Smash', 'England T20', 'County Championship', 'One Day Cup', 'Sheffield Shield', 'Ranji Trophy', 'Syed Mushtaq Ali'],
  mma: ['UFC', 'Bellator', 'PFL', 'ONE Championship', 'ONE', 'MMA', 'Cage Warriors', 'KSW', 'Rizin', 'Brave CF', 'ACA', 'LFA', 'Fight Night', 'UFC Fight Night'],
  volleyball: ['FIVB', 'VNL', 'CEV', 'SuperLega', 'Superleague', 'Volleyball', 'PlusLiga', 'Efeler Ligi', 'Ligue A', 'Volleyball Bundesliga', 'V.League', 'Volleyball Super League', 'Serie A1', 'Serie A2', 'Turkish League', 'Sultanlar Ligi', 'Russian Superleague', 'Polish PlusLiga', 'CEV Cup', 'CEV Challenge Cup', 'Champions League Volleyball', 'NCAA Volleyball', 'Italian Volleyball', 'Brazilian Superliga', 'Argentine Volleyball', 'Korean V-League', 'Chinese Volleyball League']
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
  return String(name || '')
    .replace(/[|#*_`~]/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#0?39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .trim();
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
  // Reject script/code-shaped fragments ("var diff = now.getTime()",
  // "lastActiveTime1.getTime();") that leak from inline JS in bot-challenged
  // or JS-heavy pages.
  if (/\b(var|const|let|function|return|document|window|this|true|false|null|undefined)\b/i.test(n)) return false;
  if (/[=;{}\(\)]/.test(n)) return false;
  if (/\.getTime\(\)|querySelector|addEventListener|innerHTML|onclick/i.test(n)) return false;
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
  // Finished rows carry a score cell (e.g. "| [**2:0**](url) | (1:0, 1:0)")
  // while fixture rows carry odds — never cache a result as a fixture.
  const scoreCellRe = /\|\s*(?:\[\*\*|\*\*)?\d{1,2}\s*[-:]\s*\d{1,2}(?:\*\*|\]\()/;

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
    if (scoreCellRe.test(line)) continue;
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
    // A score link (e.g. "[2:1]") marks a finished result row — skip it so
    // finished matches never enter the fixture cache. The leading "[20:00]"
    // kickoff clock is not a score, so only test the rest of the line.
    const rest = line.replace(/^\[\s*\d{1,2}:\d{2}\s*\]/, '');
    if (/\[\s*\d{1,2}\s*[-:]\s*\d{1,2}\s*\]/.test(rest)) continue;
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

// BetExplorer raw-HTML feed (free direct fetch path). League headers are
//   <tr class="js-tournament"><th colspan="2"><a class="table-main__tournament">
//     <i><img alt="Asia"></i>Asia: AFC Champions League</a>...
// and fixture rows are
//   <tr data-dt="11,8,2026,17,00">
//     <td><span class="table-main__time">17:00</span>
//       <a href="/football/asia/afc-champions-league/al-jazira-al-ittihad/ILHMildL/">Al Jazira - Al Ittihad</a></td>
//     <td class="table-main__odds"><button data-odd="3.71"></button></td>  (1X2 etc.)
// data-dt is D,M,YYYY,H,MM — parsed into a WAT-anchored epoch.
function parseBetexplorerHtml(text: string, sportId: string, sourceUrl: string, dayKey?: string): ScrapeMatch[] {
  const out: ScrapeMatch[] = [];
  let currentLeague = '';
  const rows = (text || '').match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? [];

  const tourneyRe = /class="table-main__tournament"[^>]*>([\s\S]*?)<\/a>/;
  const dtRe = /<tr\s+data-dt="([^"]+)"/;
  const timeRe = /class="table-main__time">\s*(\d{1,2}:\d{2})/;
  const teamRe = /<a[^>]*href="[^"]*"[^>]*>\s*([^<>]*?)\s*-\s*([^<>]*?)\s*<\/a>/;
  const oddRe = /data-odd="(\d+\.\d{1,3})"/g;
  // A row that already carries a final score (e.g. the "yesterday's results"
  // section on a fixtures page) is a FINISHED match, not an upcoming fixture.
  // It must never be cached as a fixture for the target day — the scores engine
  // handles finished matches through its own result scan.
  const resultCellRe = /class="table-main__result"/;

  for (const row of rows) {
    // League / tournament header row resets the current league context.
    const tm = row.match(tourneyRe);
    if (tm) {
      // Inner anchor text only ("Asia: AFC Champions League") — strip the
      // country flag <i><img></i> and any other tags.
      const label = clean(tm[1].replace(/<[^>]+>/g, ' '));
      if (label && label.length >= 3 && label.length <= 80 && /[a-z0-9]/i.test(label)) {
        currentLeague = label;
      }
      continue;
    }

    const dt = row.match(dtRe);
    if (!dt) continue;
    // Skip finished rows (results section) so yesterday's matches never leak
    // into today's fixture cache with a re-stamped date.
    if (resultCellRe.test(row)) continue;
    // The row's own WAT date is authoritative. When scraping for a specific
    // dayKey, a row dated on any other day belongs to that day's cache, not
    // this one — skip it instead of re-anchoring the clock (the old re-anchor
    // moved finished matches onto today's schedule with the wrong time).
    if (dayKey && dataDtWatDay(dt[1]) && dataDtWatDay(dt[1]) !== dayKey) continue;
    const time = row.match(timeRe)?.[1] ?? '';
    const teams = row.match(teamRe);
    if (!teams) continue;
    const home = clean(teams[1]);
    const away = clean(teams[2]);
    if (!looksLikeTeam(home) || !looksLikeTeam(away)) continue;

    const odds: number[] = [];
    let om;
    while ((om = oddRe.exec(row)) && odds.length < 6) {
      const v = Number(om[1]);
      if (v >= 1.01 && v <= 15) odds.push(v);
    }

    const startTime = startTimeFromDataDt(dt[1], time);
    out.push({
      source: 'LiveScrape',
      sourceUrl,
      league: currentLeague || SPORT_LABELS[sportId] || 'Scheduled Fixture',
      homeTeam: home,
      awayTeam: away,
      startTime,
      markets: ['mainTotal', 'result'],
      oddsText: odds.slice(0, 3).map((n) => n.toFixed(2)).join(', ')
    });
  }
  return out;
}

// BetExplorer data-dt "D,M,YYYY,H,MM" → WAT-anchored epoch. BetExplorer renders
// its server-side clock in West Africa Time by default (its own JS falls back to
// timezone_key "+1" = WAT), so the scraped wall-clock is treated as WAT (UTC+1)
// and converted to a UTC epoch — this keeps every fixture on the same calendar
// day the UI's dayKey expects. Falls back to parseClock when the attribute is junk.
// IMPORTANT: the scraped date is authoritative — a row whose own date differs
// from the target dayKey (e.g. yesterday's results section on a today page) is
// NOT re-anchored; parseBetexplorerHtml drops those rows instead, so a finished
// match can never be re-stamped onto a future dayKey at the wrong time.
function startTimeFromDataDt(dataDt: string, clock: string): number {
  const parts = String(dataDt || '').split(',').map((s) => Number(s.trim()));
  if (parts.length >= 5 && parts.slice(0, 5).every((n) => Number.isFinite(n))) {
    const [day, month, year, hour, minute] = parts;
    const hm = String(clock || '').match(/(\d{1,2}):(\d{2})/);
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const h = hm ? Number(hm[1]) : hour;
      const mi = hm ? Number(hm[2]) : minute;
      if (h >= 0 && h <= 23 && mi >= 0 && mi <= 59) {
        // Wall-clock is WAT: Date.UTC(...) treats h:mi as UTC, so subtract 1h.
        return Date.UTC(year, month - 1, day, h, mi) - 60 * 60 * 1000;
      }
    }
  }
  return parseClock(clock);
}

// The WAT calendar date ('YYYY-MM-DD') of a data-dt "D,M,YYYY,H,MM" row, used to
// decide whether a row belongs to the target dayKey's cache.
function dataDtWatDay(dataDt: string): string {
  const parts = String(dataDt || '').split(',').map((s) => Number(s.trim()));
  if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
    const [day, month, year] = parts;
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  return '';
}

export function parseFixtures(
  text: string,
  sportId: string,
  sourceUrl: string,
  dayKey?: string,
  opts?: { trustLeagueHeaders?: boolean }
): ScrapeMatch[] {
  const seen = new Set<string>();
  const out: ScrapeMatch[] = [];
  const push = (m: ScrapeMatch) => {
    const canonLeague = serverCanonicalizeLeague(m.league || '', sportId) || (m.league || '');
    const key = `${sportId}|${canonLeague}|${m.homeTeam}|${m.awayTeam}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (seen.has(key)) return;
    if (!serverLeagueBelongsToSport(canonLeague || m.league || '', sportId)) return;
    // When the page is a sport-scoped directory (e.g. betexplorer.com/football/)
    // and the row carries a REAL tournament header, the league gate above is the
    // authority — the header text itself pins the sport, so unknown minor-league
    // teams don't get dropped for lacking a famous-name fingerprint. Headerless
    // generic rows still go through the strict keyword gate to block cross-sport
    // misclassification (e.g. an "Arsenal - Chelsea" line read as basketball).
    //
    // Only headers in the BetExplorer "Country: League" colon format (the shape
    // its js-tournament rows emit, e.g. "Asia: AFC Champions League") are trusted
    // — a bare league label with no country prefix still needs the keyword gate,
    // so a generic "World: Club Friendly"-style row can never bypass it.
    const hasRealLeagueHeader =
      opts?.trustLeagueHeaders &&
      !!canonLeague &&
      canonLeague.includes(':') &&
      canonLeague !== (SPORT_LABELS[sportId] || '') &&
      !UNKNOWN_LABELS.test(canonLeague);
    if (!hasRealLeagueHeader && !matchBelongsToSport({ league: canonLeague || m.league, homeTeam: m.homeTeam, awayTeam: m.awayTeam, source: m.source }, sportId)) return;
    seen.add(key);
    out.push(m);
  };

  // 0. BetExplorer raw-HTML tables (free direct-fetch path — no reader credits).
  for (const m of parseBetexplorerHtml(text, sportId, sourceUrl, dayKey)) push(m);
  // 1. BetExplorer-style markdown tables.
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
    // trustLeagueHeaders: FIXTURE_PAGES are sport-scoped roots (betexplorer.com/football/),
    // so rows under a real tournament header are authoritative for this sport even
    // when their minor-league team names aren't in the famous-name keyword lists.
    const parsed = parseFixtures(page.text, sportId, url, dayKey, { trustLeagueHeaders: true });
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