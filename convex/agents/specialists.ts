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
  consolidateSharp,
  fetchSharpMarkets,
  findOddsFor,
  matchOddsText,
  resolveOddsSportKeys,
  hasAnyApiKey,
  type ConsolidatedOdds
} from '../apis/sportsApis';
import { isFootballMatch, matchBelongsToSport, validateFixture, serverCanonicalizeLeague } from '../predictor';

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

  const combined: ScrapeMatch[] = [];
  const seenKeys = new Set<string>();
  const citations: string[] = [];
  let pagesFetched: { url: string; ok: boolean; engine: string }[] = [];

  const pushMatch = (m: ScrapeMatch) => {
    if (!m.homeTeam || !m.awayTeam) return;
    const v = validateFixture(m, sportId);
    if (!v.valid) return;
    const canonLeague = serverCanonicalizeLeague(m.league || '', sportId) || v.normalizedLeague || m.league || '';
    const normalized: ScrapeMatch = {
      ...m,
      league: canonLeague || m.league,
      homeTeam: v.normalizedHome || m.homeTeam,
      awayTeam: v.normalizedAway || m.awayTeam
    };
    if (!matchBelongsToSport({ ...normalized, source: normalized.source }, sportId)) return;
    const key = `${sportId}|${canonLeague}|${normalized.homeTeam}|${normalized.awayTeam}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    combined.push(normalized);
  };


  // 1. Verified sports data APIs (OddsPapi, SharpAPI, TheOddsApi, TheSportsDB, BallDontLie, SportsData)
  try {
    const date = dayKey || new Date().toISOString().slice(0, 10);
    const { fixtures: apiFixtures, odds } = await apiFixturesFor(sportId, date);
    const fallbackLeague: Record<string, string> = {
      football: 'Premier League',
      basketball: 'NBA',
      tennis: 'ATP Tour',
      hockey: 'NHL',
      baseball: 'MLB',
      rally: 'Table Tennis WTT',
      americanfootball: 'NFL',
      rugby: 'Rugby Union',
      cricket: 'Cricket',
      mma: 'MMA',
      volleyball: 'Volleyball'
    };
    const marketKeys =
      sportId === 'football'
        ? ['result', 'doubleChance', 'handicap', 'mainTotal']
        : sportId === 'hockey' || sportId === 'baseball'
          ? ['winner', 'handicap', 'gameTotal', 'regResult']
          : ['winner', 'handicap', 'mainTotal'];

    for (const f of apiFixtures) {
      const o = findOddsFor(odds, f.home, f.away);
      pushMatch({
        source: 'LiveAPI',
        sourceUrl: f.sourceUrl,
        league: f.league || fallbackLeague[sportId] || 'League',
        homeTeam: f.home,
        awayTeam: f.away,
        startTime: f.startTime,
        markets: marketKeys,
        oddsText: o ? matchOddsText(o) : undefined
      });
      if (f.sourceUrl) citations.push(f.sourceUrl);
    }
  } catch (err) {
    console.warn('[Tunde Onitiri] sports-data API fetch failed.', err);
  }

  // 2. BetWatch primary feed (for football)
  if (sportId === 'football') {
    try {
      const primary = await scrapeBetwatchFixtures(sportId);
      for (const m of primary) pushMatch(m);
    } catch (err) {
      console.warn('[Tunde Onitiri] primary feed scrape failed.', err);
    }
  }

  // 3. Collective URL directory scrapers (Flashscore, Sofascore, BetExplorer, ESPN, OddsPortal, etc.)
  try {
    const dir = await scrapeRealFixtures(sportId, dayKey);
    pagesFetched = dir.pagesFetched;
    for (const m of dir.matches) pushMatch(m);
    for (const c of dir.citations) citations.push(c);
  } catch (err) {
    console.warn('[Tunde Onitiri] source-directory scrape failed.', err);
  }

  if (combined.length > 0) {
    const uniqueCitations = Array.from(new Set(citations));
    return {
      raw: combined,
      usedSynthetic: false,
      countsByLeague: countsByLeague(combined),
      pagesFetched,
      citations: uniqueCitations
    };
  }

  const synthetic = syntheticFixtures(sportId);
  return { raw: synthetic, usedSynthetic: true, countsByLeague: countsByLeague(synthetic), citations: Array.from(new Set(citations)) };
}

export interface OddsResult {
  sourcesQueried: string[];
  samples: { match: string; text: string }[];
}

export async function kunleCollectOdds(fixtures: ScrapeMatch[], sportId?: string): Promise<OddsResult> {
  const sourcesQueried: string[] = [];
  const samples: OddsResult['samples'] = [];

  // 1. Real bookmaker odds across the provider chain. SharpAPI is the reliable
  //    always-on source (flat moneyline/spread/total rows); The Odds API is kept
  //    for drop-in parity when its key has credits. Odds are matched to the
  //    fixtures by team name and stamped onto each match so the normalize stage
  //    builds a genuine scope for the LLM.
  const odds: ConsolidatedOdds[] = [];
  try {
    odds.push(...consolidateSharp(await fetchSharpMarkets(sportId ?? 'football')));
    if (odds.length > 0) sourcesQueried.push('https://api.sharpapi.io/api/v1/odds');
  } catch {
    // SharpAPI failing must not block the chain
  }
  const oddsKeys = await resolveOddsSportKeys(sportId ?? 'football');
  for (const key of oddsKeys) {
    try {
      const raw = await fetchOddsMarkets(key);
      odds.push(...consolidateOdds(raw));
    } catch {
      // one league failing must not drop the rest
    }
  }
  if (oddsKeys.length && odds.some((o) => o.h2h)) sourcesQueried.push('https://api.the-odds-api.com/v4');
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
