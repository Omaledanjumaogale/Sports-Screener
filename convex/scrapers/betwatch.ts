// betwatch.fr scraper — primary fixture feed for the AI Predictor.
// Uses Jina Reader first, Firecrawl as fallback. Output is normalized into
// ScrapeMatch records which the normalize stage turns into engine scopes.

import { jinaRead } from './jinaReader';
import { firecrawlRead } from './firecrawl';
import { type ScraperSource, ALL_PRIMARY_SOURCES } from './sources';

const BETWATCH_URL = ALL_PRIMARY_SOURCES.find((s) => s.name === 'BetWatch')?.url ?? 'https://betwatch.fr/';

export interface ScrapeMatch {
  source: string;
  sourceUrl: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  markets: string[];
  oddsText?: string;
}

const SPORT_LEAGUES: Record<string, string[]> = {
  football: ['Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'Champions League', 'Eredivisie', 'Primeira Liga', 'Championship', 'League One', 'League Two', 'FA Cup', 'EFL Cup', 'Serie B', 'Segunda', 'Ligue 2', 'Super Lig', 'Liga MX', 'MLS', 'Ekstraklasa', 'Czech First League', 'Veikkausliiga', 'Israeli Premier League', 'Russian Premier League', 'Chinese Super League', 'J1 League', 'K League', 'A-League', 'Saudi Pro League', 'Egyptian Premier League', 'Botola', 'Nigerian Premier League', 'Brazil Serie B', 'Irish Premier Division'],
  basketball: ['NBA', 'EuroLeague', 'ACB', 'LNB', 'WNBA', 'NCAAB', 'CBA', 'EuroCup', 'ABA Liga', 'BSL', 'VTB', 'KBL', 'B.League', 'G League', 'Liga Endesa'],
  tennis: ['ATP', 'WTA', 'Grand Slam', 'Masters 1000', 'ATP Challenger', 'ITF'],
  rally: ['ITTF', 'WTT', 'Table Tennis', 'TT'],
  hockey: ['NHL', 'KHL', 'SHL', 'Liiga', 'AHL', 'DEL', 'HockeyAllsvenskan', 'GET Ligaen', 'Metal Ligaen', 'Ligue Magnus', 'DEL2', 'ICEHL', 'Extraliga', 'VHL'],
  baseball: ['MLB', 'NPB', 'KBO', 'MiLB', 'CPBL', 'LIDOM', 'LBPRC', 'LVBP', 'LMB'],
  americanfootball: ['NFL', 'NCAAF', 'CFL', 'XFL', 'UFL', 'Super Bowl'],
  rugby: ['Six Nations', 'Rugby', 'Premier Rugby', 'Top 14', 'Super Rugby', 'URC', 'Champions Cup', 'Japan League One', 'Currie Cup', 'NRL'],
  cricket: ['Test', 'ODI', 'T20', 'IPL', 'Big Bash', 'Hundred', 'World Cup', 'T20 Blast', 'Caribbean Premier League', 'Lanka Premier League', 'SA20', 'Pakistan Super League'],
  mma: ['UFC', 'Bellator', 'PFL', 'ONE'],
  volleyball: ['FIVB', 'VNL', 'SerieA', 'Superleague', 'Volleyball', 'PlusLiga', 'Efeler Ligi', 'Ligue A', 'V.League']
};

function clean(name: string): string {
  return String(name || '').replace(/[|#*_`~]/g, '').trim();
}

function parseTime(raw: string | undefined | null, fallback: number): number {
  if (!raw) return fallback;
  const iso = raw.match(/20\d{2}-\d{2}-\d{2}[T ]\d{2}:\d{2}/);
  if (iso) {
    const ms = Date.parse(iso[0].replace(' ', 'T'));
    if (!Number.isNaN(ms)) return ms;
  }
  const hm = raw.match(/(\d{1,2}):(\d{2})/);
  if (hm) {
    const d = new Date();
    d.setHours(Number(hm[1]), Number(hm[2]), 0, 0);
    return d.getTime();
  }
  return fallback;
}

// A naive-but-robust line parser: split scraped markdown on blank lines and
// numeric "vs" rows into fixture candidates.
export function parseBetwatchMarkdown(text: string, sportId: string): ScrapeMatch[] {
  const lines = (text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const leagues = SPORT_LEAGUES[sportId] ?? [];
  const out: ScrapeMatch[] = [];
  let currentLeague = '';
  const now = Date.now();

  const leaguePattern = /^#{1,3}\s+(.+)$/;
  const vsPattern = /^(.+?)\s+vs\.?\s+(.+)$/i;

  for (const line of lines) {
    const lmatch = line.match(leaguePattern);
    if (lmatch) {
      if (leagues.some((l) => lmatch[1].toLowerCase().includes(l.toLowerCase()))) {
        currentLeague = clean(lmatch[1]);
      } else {
        currentLeague = '';
      }
      continue;
    }
    const vm = line.match(vsPattern);
    if (vm) {
      const home = clean(vm[1]);
      const away = clean(vm[2]);
      if (home.length < 2 || away.length < 2) continue;

      // For non-football sports, do not inherit soccer matches from betwatch.fr
      // unless the league was explicitly matched to a valid league for that sport.
      if (sportId !== 'football' && !currentLeague) continue;

      out.push({
        source: 'BetWatch',
        sourceUrl: BETWATCH_URL,
        league: currentLeague || (leagues[0] ?? 'Top League'),
        homeTeam: home,
        awayTeam: away,
        startTime: parseTime(line.match(/(\d{1,2}:\d{2})/)?.[0], now + 24 * 60 * 60 * 1000),
        markets: ['mainTotal', 'result']
      });
    }
  }
  return out;
}

export async function scrapeBetwatchFixtures(sportId: string): Promise<ScrapeMatch[]> {
  if (sportId !== 'football') return [];
  const jr = await jinaRead(BETWATCH_URL);
  if (jr.ok && jr.text && jr.text.length > 50) {
    const parsed = parseBetwatchMarkdown(jr.text, sportId);
    if (parsed.length > 0) return parsed;
  }
  const fc = await firecrawlRead(BETWATCH_URL);
  if (fc.ok && fc.text && fc.text.length > 50) {
    const parsed = parseBetwatchMarkdown(fc.text, sportId);
    if (parsed.length > 0) return parsed;
  }
  return [];
}

// Deterministic development fallback so the feature is testable without a live
// scrape. Marked clearly so production data is never mistaken for this.
export function syntheticFixtures(sportId: string): ScrapeMatch[] {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const leagues = SPORT_LEAGUES[sportId] ?? ['Top League'];
  const known: Record<string, [string, string][]> = {
    football: [['Arsenal', 'Chelsea'], ['Liverpool', 'Man City'], ['Real Madrid', 'Barcelona'], ['Inter', 'AC Milan']],
    basketball: [['Lakers', 'Celtics'], ['Warriors', 'Bucks'], ['Real Madrid', 'Barcelona']],
    tennis: [['Alcaraz', 'Sinner'], ['Djokovic', 'Zverev']],
    rally: [['Lebrun', 'Harimoto'], ['Wang Chuqin', 'Fan Zhendong']],
    hockey: [['Rangers', 'Bruins'], ['Maple Leafs', 'Canadiens']],
    baseball: [['Yankees', 'Red Sox'], ['Dodgers', 'Giants']],
    americanfootball: [['Chiefs', 'Eagles'], ['Cowboys', '49ers'], ['Ravens', 'Bills'], ['Lions', 'Packers']],
    rugby: [['All Blacks', 'Springboks'], ['England', 'France'], ['Ireland', 'Wales']],
    cricket: [['India', 'Australia'], ['England', 'Pakistan'], ['New Zealand', 'South Africa']],
    mma: [['Islam Makhachev', 'Ilia Topuria'], ['Joanna Jędrzejczyk', 'Rose Namajunas']],
    volleyball: [['Brazil', 'Poland'], ['Italy', 'France'], ['USA', 'Japan'], ['Russia', 'Serbia']]
  };
  const pairs = known[sportId] ?? [];
  return pairs.map(([h, a], i) => ({
    source: 'SyntheticDev',
    sourceUrl: BETWATCH_URL,
    league: leagues[0],
    homeTeam: h,
    awayTeam: a,
    startTime: now + day + i * 3 * 60 * 60 * 1000,
    markets: ['mainTotal', 'result']
  }));
}

export function oddsTextFor(match: ScrapeMatch, source: ScraperSource): string {
  return `${match.homeTeam} vs ${match.awayTeam} — ${match.league} @ ${source.url}`;
}
