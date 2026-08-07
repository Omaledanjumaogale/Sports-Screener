// SMOA pipeline — "Eze Ugo" the lead orchestrator runs the nine specialists in
// sequence and reports cumulative progress (0–100%) so the predictor page meter
// reflects real agent activity. Pure orchestration; the Convex action that calls
// this owns persistence.

import { AGENT_DEFS } from './agentDefinitions';
import {
  tundeFetchFixtures,
  kunleCollectOdds,
  ngoziCheckVolume,
  bolanleResearch,
  chineduNormalize,
  amaraFilter,
  zainabReview
} from './specialists';
import type { NormalizedMatch } from '../scrapers/normalize';
import { FILTER_CONFIDENCE_FLOOR } from '../scrapers/normalize';
import { dailyCap } from '../scrapers/sources';

export type ProgressReporter = (progress: number, stage: string, message?: string) => Promise<void> | void;

export interface SmoaReport {
  sportId: string;
  dayKey: string;
  matches: NormalizedMatch[];
  qualifyingIds: string[];
  usedSynthetic: boolean;
  citations: string[];
  agentsRun: string[];
  warnings: string[];
  floor: number;
  countsByLeague: Record<string, number>;
  sourcesUsed: string[];
  pagesFetched?: { url: string; ok: boolean; engine: string }[];
}

export async function runSmoaPipeline(
  sportId: string,
  dayKey: string,
  report: ProgressReporter,
  floor = FILTER_CONFIDENCE_FLOOR
): Promise<SmoaReport> {
  const agentsRun: string[] = [];
  const sourcesUsed: string[] = ['https://betwatch.fr/'];

  // 1. Tunde Fixtures — fixtures
  const fixturesRes = await tundeFetchFixtures(sportId, dayKey);
  agentsRun.push(AGENT_DEFS[0].name);
  if (fixturesRes.citations?.length) sourcesUsed.push(...fixturesRes.citations);
  await report(AGENT_DEFS[0].weight, `${AGENT_DEFS[0].name} — fetching fixtures`,
    fixturesRes.usedSynthetic ? 'Live scrape unavailable; dev fixtures used.' : `${fixturesRes.raw.length} fixtures found across the source directory and data APIs`);

  const capped = fixturesRes.raw.slice(0, dailyCap());

  // 2. Kunle Odds — odds
  const oddsRes = await kunleCollectOdds(capped, sportId);
  agentsRun.push(AGENT_DEFS[1].name);
  sourcesUsed.push(...oddsRes.sourcesQueried.slice(0, 5));
  await report(AGENT_DEFS[0].weight + AGENT_DEFS[1].weight, `${AGENT_DEFS[1].name} — collecting odds`,
    `${oddsRes.sourcesQueried.length} odds sources queried`);

  // 3. Ngozi Volume — volume
  const volumeRes = await ngoziCheckVolume();
  agentsRun.push(AGENT_DEFS[2].name);
  sourcesUsed.push('https://www.betfair.com/exchange');
  await report(AGENT_DEFS[0].weight + AGENT_DEFS[1].weight + AGENT_DEFS[2].weight,
    `${AGENT_DEFS[2].name} — traded volume`, volumeRes.note);

  // 4. Bolanle Research — research
  const researchRes = await bolanleResearch(sportId, capped);
  agentsRun.push(AGENT_DEFS[3].name);
  sourcesUsed.push(...researchRes.citations.map((c) => c.split(':')[0]).filter(Boolean).slice(0, 4));
  await report(AGENT_DEFS[0].weight + AGENT_DEFS[1].weight + AGENT_DEFS[2].weight + AGENT_DEFS[3].weight,
    `${AGENT_DEFS[3].name} — validating sources`, `${researchRes.citations.length} research citations`);

  // 5. Chinedu Normalizer — normalization
  const normalizeRes = chineduNormalize(capped, sportId);
  agentsRun.push(AGENT_DEFS[4].name);
  await report(AGENT_DEFS[0].weight + AGENT_DEFS[1].weight + AGENT_DEFS[2].weight + AGENT_DEFS[3].weight + AGENT_DEFS[4].weight,
    `${AGENT_DEFS[4].name} — normalizing data`, `${normalizeRes.matches.length} scopes built`);

  // 6. Amara Floor Gatekeeper — probability floor
  const filterRes = amaraFilter(normalizeRes.matches, floor);
  agentsRun.push(AGENT_DEFS[5].name);
  await report(AGENT_DEFS[0].weight + AGENT_DEFS[1].weight + AGENT_DEFS[2].weight + AGENT_DEFS[3].weight + AGENT_DEFS[4].weight + AGENT_DEFS[5].weight,
    `${AGENT_DEFS[5].name} — filtering ≥ floor`, `${filterRes.matchIds.length} matches over ${floor}% floor`);

  // 7. Zainab Risk Auditor — risk review
  const riskRes = zainabReview(normalizeRes.matches, filterRes);
  agentsRun.push(AGENT_DEFS[6].name);
  await report(AGENT_DEFS[0].weight + AGENT_DEFS[1].weight + AGENT_DEFS[2].weight + AGENT_DEFS[3].weight + AGENT_DEFS[4].weight + AGENT_DEFS[5].weight + AGENT_DEFS[6].weight,
    `${AGENT_DEFS[6].name} — risk review`, `${riskRes.warnings.length} warnings`);

  // 8. Adaeze Reporter — report (prepares verdict payload shape)
  agentsRun.push(AGENT_DEFS[7].name);
  await report(AGENT_DEFS[0].weight + AGENT_DEFS[1].weight + AGENT_DEFS[2].weight + AGENT_DEFS[3].weight + AGENT_DEFS[4].weight + AGENT_DEFS[5].weight + AGENT_DEFS[6].weight + AGENT_DEFS[7].weight,
    `${AGENT_DEFS[7].name} — compiling verdicts`);

  // 9. Emeka Cache Sync — cache (persistence handled by caller)
  agentsRun.push(AGENT_DEFS[8].name);
  await report(100, `${AGENT_DEFS[8].name} — caching day`, 'Ready');

  // Cache EVERY parsed fixture so the predictor always has a populated schedule
  // for review, regardless of whether it clears the confidence floor. The floor
  // still decides which selections are surfaced as "qualifying" in the UI (the
  // client's filtered-matches report + oracle verdict), but it must NEVER empty
  // the whole cache — otherwise a day with only reference/fallback odds shows
  // "no scheduled matches" even though fixtures exist.
  const kept = normalizeRes.matches;
  // Qualifying matches (at least one market counsellor above floor) are used by
  // the orchestrator to (a) generate an LLM verdict and (b) set day status.
  const qualifyingIds = filterRes.matchIds;

  return {
    sportId,
    dayKey,
    matches: kept,
    qualifyingIds,
    usedSynthetic: fixturesRes.usedSynthetic,
    citations: researchRes.citations,
    agentsRun,
    warnings: riskRes.warnings,
    floor: filterRes.underFloor,
    countsByLeague: fixturesRes.countsByLeague,
    sourcesUsed: Array.from(new Set(sourcesUsed)),
    pagesFetched: fixturesRes.pagesFetched
  };
}
