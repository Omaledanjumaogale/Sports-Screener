// Specialist agent implementations. Each returns structured output consumed by
// the next stage. Agents are deterministic (fetch + parse), never hallucinate —
// where a live scrape is unavailable a clearly-labelled fallback is used.

import { scrapeBetwatchFixtures, syntheticFixtures, type ScrapeMatch } from '../scrapers/betwatch';
import { normalizeMatches, type NormalizedMatch } from '../scrapers/normalize';
import { serperSearch } from '../scrapers/serper';
import { brightDataRead } from '../scrapers/brightdata';
import { jinaRead } from '../scrapers/jinaReader';
import { PREDICTION_SOURCES, ODDS_SOURCES } from '../scrapers/sources';

export interface FixturesResult {
  raw: ScrapeMatch[];
  usedSynthetic: boolean;
  countsByLeague: Record<string, number>;
}

export async function tundeFetchFixtures(sportId: string): Promise<FixturesResult> {
  let scraped: ScrapeMatch[] = [];
  try {
    scraped = await scrapeBetwatchFixtures(sportId);
  } catch (err) {
    console.warn('[Tunde Onitiri] fixture scrape failed; falling back to dev fixtures.', err);
  }
  if (scraped.length > 0) {
    const countsByLeague: Record<string, number> = {};
    for (const m of scraped) countsByLeague[m.league] = (countsByLeague[m.league] ?? 0) + 1;
    return { raw: scraped, usedSynthetic: false, countsByLeague };
  }
  const synthetic = syntheticFixtures(sportId);
  const countsByLeague: Record<string, number> = {};
  for (const m of synthetic) countsByLeague[m.league] = (countsByLeague[m.league] ?? 0) + 1;
  return { raw: synthetic, usedSynthetic: true, countsByLeague };
}

export interface OddsResult {
  sourcesQueried: string[];
  samples: { match: string; text: string }[];
}

export async function kunleCollectOdds(fixtures: ScrapeMatch[]): Promise<OddsResult> {
  const sourcesQueried: string[] = [];
  const samples: OddsResult['samples'] = [];
  const batch = fixtures.slice(0, 12);

  await Promise.all(
    batch.map(async (m) => {
      const src = ODDS_SOURCES[Math.floor(Math.random() * ODDS_SOURCES.length)] ?? ODDS_SOURCES[0];
      sourcesQueried.push(src.url);
      const jr = await jinaRead(src.url, { timeoutMs: 8_000 });
      if (jr.ok && jr.text) samples.push({ match: `${m.homeTeam} vs ${m.awayTeam}`, text: jr.text.slice(0, 400) });
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

// Amara Obi — surfaces only matches whose selection probability clears the 60%
// confidence floor. The client actually computes probabilities via analyzeScope;
// here we persist the floor and pre-filter on simple implied-odds heuristics so
// the cache stores only candidates worth rendering.
export function amaraFilter(matches: NormalizedMatch[], floor = 60): FilterResult {
  const matchIds: string[] = [];
  for (const m of matches) {
    const pairs = m.scope.markets.mainTotal?.pairs ?? [];
    const hasHighProb = pairs.some((p: any) => {
      const over = Number(p?.over || 0);
      const under = Number(p?.under || 0);
      if (!over || !under) return false;
      const overProb = (1 / over) / (1 / over + 1 / under) * 100;
      return overProb >= floor || 100 - overProb >= floor;
    });
    if (hasHighProb) matchIds.push(m.matchId);
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
