// Specialist agent implementations. Each returns structured output consumed by
// the next stage. Agents are deterministic (fetch + parse), never hallucinate —
// where a live scrape is unavailable a clearly-labelled fallback is used.

import { scrapeBetwatchFixtures, syntheticFixtures, type ScrapeMatch } from '../scrapers/betwatch';
import { scrapeRealFixtures } from '../scrapers/fixtures';
import { normalizeMatches, devig, devigPair, type NormalizedMatch } from '../scrapers/normalize';
import { serperSearch } from '../scrapers/serper';
import { brightDataRead } from '../scrapers/brightdata';
import { jinaRead } from '../scrapers/jinaReader';
import { PREDICTION_SOURCES, ODDS_SOURCES } from '../scrapers/sources';
import {
  apiFixturesFor,
  fetchOddsMarkets,
  consolidateOdds,
  findOddsFor,
  matchOddsText,
  resolveOddsSportKeys,
  hasAnyApiKey,
  type ConsolidatedOdds
} from '../apis/sportsApis';

export interface FixturesResult {
  raw: ScrapeMatch[];
  usedSynthetic: boolean;
  countsByLeague: Record<string, number>;
  pagesFetched?: { url: string; ok: boolean; engine: string }[];
  citations?: string[];
}

export async function tundeFetchFixtures(sportId: string, dayKey?: string): Promise<FixturesResult> {
  const countsByLeague = (matches: ScrapeMatch[]): Record<string, number> => {
    const c: Record<string, number> = {};
    for (const m of matches) c[m.league] = (c[m.league] ?? 0) + 1;
    return c;
  };

  // 1. Verified sports data APIs (TheSportsDB multi-sport, BallDontLie/SportsData
  //    for basketball, The Odds API for real bookmaker odds) — real fixtures for
  //    the target date. Each fixture keeps its own league (e.g. English Premier
  //    League, MLB, ATP Canadian Open) rather than being lumped into one generic
  //    label, and carries its real odds so the scope never falls back to defaults.
  //    The Odds API feed is rolling (no date filter), so this is the primary path
  //    whenever it is reachable.
  try {
    const date = dayKey || new Date().toISOString().slice(0, 10);
    const { fixtures: apiFixtures, odds } = await apiFixturesFor(sportId, date);
    if (apiFixtures.length > 0) {
      const fallbackLeague: Record<string, string> = {
        basketball: 'NBA',
        football: 'Soccer',
        tennis: 'Tennis',
        hockey: 'NHL',
        baseball: 'MLB',
        rally: 'Rally'
      };
      const marketKeys =
        sportId === 'football'
          ? ['result', 'doubleChance', 'handicap', 'mainTotal']
          : sportId === 'hockey' || sportId === 'baseball'
            ? ['winner', 'handicap', 'gameTotal', 'regResult']
            : ['winner', 'handicap', 'mainTotal'];
      const raw: ScrapeMatch[] = apiFixtures.map((f) => {
        const o = findOddsFor(odds, f.home, f.away);
        return {
          source: 'LiveAPI',
          sourceUrl: f.sourceUrl,
          league: f.league || fallbackLeague[sportId] || 'League',
          homeTeam: f.home,
          awayTeam: f.away,
          startTime: f.startTime,
          markets: marketKeys,
          // Embed the real odds from the same response so the scope never falls
          // back to defaults even if the later odds re-match is missed.
          oddsText: o ? matchOddsText(o) : undefined
        };
      });
      const citations = Array.from(new Set(apiFixtures.map((f) => f.sourceUrl)));
      return { raw, usedSynthetic: false, countsByLeague: countsByLeague(raw), citations };
    }
  } catch (err) {
    console.warn('[Tunde Onitiri] sports-data API fetch failed.', err);
  }

  // 2. Primary feed.
  try {
    const primary = await scrapeBetwatchFixtures(sportId);
    if (primary.length > 0) {
      return { raw: primary, usedSynthetic: false, countsByLeague: countsByLeague(primary) };
    }
  } catch (err) {
    console.warn('[Tunde Onitiri] primary feed scrape failed.', err);
  }

  // 3. URL directory — read every primary/odds/betting/prediction source page for
  //    the sport through the reader chain.
  let dirCitations: string[] = [];
  try {
    const dir = await scrapeRealFixtures(sportId);
    if (dir.matches.length > 0) {
      return {
        raw: dir.matches,
        usedSynthetic: false,
        countsByLeague: countsByLeague(dir.matches),
        pagesFetched: dir.pagesFetched,
        citations: dir.citations
      };
    }
    dirCitations = dir.citations;
    console.warn('[Tunde Onitiri] no parseable fixtures in the source directory.', dir.pagesFetched.filter((p) => p.ok).length, 'pages readable');
  } catch (err) {
    console.warn('[Tunde Onitiri] source-directory scrape failed.', err);
  }

  const synthetic = syntheticFixtures(sportId);
  return { raw: synthetic, usedSynthetic: true, countsByLeague: countsByLeague(synthetic), citations: dirCitations };
}

export interface OddsResult {
  sourcesQueried: string[];
  samples: { match: string; text: string }[];
}

export async function kunleCollectOdds(fixtures: ScrapeMatch[], sportId?: string): Promise<OddsResult> {
  const sourcesQueried: string[] = [];
  const samples: OddsResult['samples'] = [];

  // 1. Real bookmaker odds via The Odds API (verified live provider). Matches the
  //    fixtures by team name and stamps the real h2h/totals onto each match so the
  //    normalize stage builds a genuine scope for the LLM. Queries every active
  //    league key for the sport so minor-league and non-flagship fixtures (not
  //    just the flagship league) still get matched to real odds.
  const oddsKeys = await resolveOddsSportKeys(sportId ?? 'football');
  const odds: ConsolidatedOdds[] = [];
  for (const key of oddsKeys) {
    try {
      const raw = await fetchOddsMarkets(key);
      odds.push(...consolidateOdds(raw));
    } catch {
      // one league failing must not drop the rest
    }
  }
  if (odds.length > 0) sourcesQueried.push('https://api.the-odds-api.com/v4');
  for (const m of fixtures) {
    const o = findOddsFor(odds, m.homeTeam, m.awayTeam);
    if (o) {
      m.oddsText = matchOddsText(o);
      samples.push({ match: `${m.homeTeam} vs ${m.awayTeam}`, text: matchOddsText(o) });
    }
  }

  // 2. Odds registry pages for cross-reference/citation context.
  const batch = fixtures.slice(0, 6);
  await Promise.all(
    batch.map(async (m) => {
      const src = ODDS_SOURCES[Math.floor(Math.random() * ODDS_SOURCES.length)] ?? ODDS_SOURCES[0];
      sourcesQueried.push(src.url);
      const jr = await jinaRead(src.url, { timeoutMs: 8_000 });
      if (jr.ok && jr.text) samples.push({ match: `${m.homeTeam} vs ${m.awayTeam}`, text: jr.text.slice(0, 300) });
    })
  );

  return { sourcesQueried: Array.from(new Set(sourcesQueried)), samples };
}

export interface VolumeResult {
  exchangeSignals: number;
  note: string;
}

export async function ngoziCheckVolume(): Promise<VolumeResult> {
  const bd = await brightDataRead('https://www.betfair.com/exchange/plus/en/sport');
  const matched = bd.ok ? bd.text.length : 0;
  return {
    exchangeSignals: matched > 0 ? 1 : 0,
    note: matched > 0 ? 'BetFair exchange reachable; volume signal available.' : 'Exchange volume unavailable — flat-weighted fallback applied.'
  };
}

export interface ResearchResult {
  citations: string[];
  serpOk: boolean;
}

export async function bolanleResearch(sportId: string, fixtures: ScrapeMatch[]): Promise<ResearchResult> {
  const citations: string[] = [];
  let serpOk = false;

  await Promise.all(
    PREDICTION_SOURCES.map(async (src) => {
      if (src.sport && src.sport !== sportId) return;
      const s = await serperSearch(`${src.name} ${sportId} predictions today`, 3);
      serpOk = serpOk || s.ok;
      if (s.items.length > 0) citations.push(`${src.name}: ${s.items[0].link}`);
    })
  );

  return { citations, serpOk };
}

export interface NormalizeResult {
  matches: NormalizedMatch[];
}

export function chineduNormalize(fixtures: ScrapeMatch[], sportId: string): NormalizeResult {
  return { matches: normalizeMatches(fixtures, sportId) };
}

export interface FilterResult {
  matchIds: string[];
  underFloor: number;
}

// Amara Obi — surfaces only matches where at least one market option clears the
// confidence floor. The floor is evaluated on DE-VIGGED probability exactly as
// the client's `analyzeScope`/`filterHighConfidence` computes it (engine.ts
// normalizeN / normalizeTwo), so a match cached here is one the UI will actually
// qualify. Scans EVERY real market (result/winner, double chance, totals,
// handicap/spread) so a match qualifies on any confident selection — not just
// the (near-50/50) total line.
export function amaraFilter(matches: NormalizedMatch[], floor = 60): FilterResult {
  const matchIds: string[] = [];
  for (const m of matches) {
    const mk = m.scope.markets;
    let high = false;
    outer: for (const key of Object.keys(mk)) {
      const market = mk[key];
      // Derived markets (Double Chance / derived Asian Handicap) always carry a
      // ~75%+ safe side — they must NOT gate the floor, only primary markets do.
      if (market?.derived) continue;
      const odds = market?.odds;
      if (odds && typeof odds === 'object') {
        const valid = Object.values(odds).map((n) => Number(n)).filter((n) => n > 1);
        if (valid.length >= 2) {
          // De-vig the whole market (1X2 or moneyline) so a draw leg cannot
          // suppress a genuine favourite below the floor.
          const probs = devig(valid).map((p) => p * 100);
          if (probs.some((p) => p >= floor)) {
            high = true;
            break outer;
          }
        }
      }
      const pairs = market?.pairs;
      if (Array.isArray(pairs)) {
        for (const p of pairs) {
          const over = Number(p?.over || 0);
          const under = Number(p?.under || 0);
          if (!over || !under) continue;
          const { aPct, bPct } = devigPair(over, under);
          if (aPct >= floor || bPct >= floor) {
            high = true;
            break outer;
          }
        }
      }
      const handicapPairs = market?.handicapPairs;
      if (Array.isArray(handicapPairs)) {
        for (const h of handicapPairs) {
          const sideA = Number(h?.sideA || 0);
          const sideB = Number(h?.sideB || 0);
          if (!sideA || !sideB) continue;
          const { aPct, bPct } = devigPair(sideA, sideB);
          if (aPct >= floor || bPct >= floor) {
            high = true;
            break outer;
          }
        }
      }
    }
    if (high) matchIds.push(m.matchId);
  }
  return { matchIds, underFloor: floor };
}

export interface RiskResult {
  warnings: string[];
}

export function zainabReview(matches: NormalizedMatch[], filter: FilterResult): RiskResult {
  const warnings: string[] = [];
  const kept = matches.filter((m) => filter.matchIds.includes(m.matchId));
  if (kept.length === 0) warnings.push('No matches cleared the confidence floor this cycle.');
  const synthetic = matches.filter((m) => m.source === 'SyntheticDev').length;
  if (synthetic > 0) warnings.push(`${synthetic} match(es) use development fallback data — verify before betting.`);
  return { warnings };
}
