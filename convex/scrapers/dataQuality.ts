// ── Post-live-scrape validation layer ─────────────────────────────────────────
// The data-quality gate EVERY scraped/API fixture must pass before it is cached
// and showcased in the AI Predictor.
//
// This module codifies the mandatory data completeness preconditions:
//   1. Team/player profiles are present and well-formed (never odds-shaped).
//   2. Fixture metadata is complete (league present + belongs to this sport).
//   3. The fixture fingerprints for its assigned sport (no cross-sport drift).
//   4. Valid, up-to-date odds exist (real prices, not fabricated fallbacks).
//
// A match that fails the gate is BLOCKED from the cache entirely — it is never
// projected on any tab. A match that is structurally sound but carries no real
// odds is flagged `needsResearch` so the pipeline can attempt a live web-search
// fallback (serper) to fill the gap before the gate is re-evaluated.
//
// Cross-source de-duplication lives here too: identical fixtures arriving from
// different providers (LiveAPI, LiveScrape, BetWatch, research…) collapse to one
// canonical row, preferring the entry that carries real odds.

import { validateFixture, matchBelongsToSport, normalizeName, serverCanonicalizeLeague, serverLeagueBelongsToSport } from '../predictor';
import { parseOddsText } from './normalize';
import { serperSearch } from './serper';
import type { ScrapeMatch } from './betwatch';

declare const process: { env: Record<string, string | undefined> };

// ── Showcase thresholds (codified preconditions) ─────────────────────────────
export const SHOWCASE_THRESHOLDS = {
  // validateFixture() score a match must clear to be structurally sound.
  minValidationScore: 10,
  // Matches with NO real odds are blocked from showcase by default. Set
  // PREDICTOR_REQUIRE_REAL_ODDS=false to keep odds-less reference rows cached
  // (they never qualify for picks either way).
  requireRealOdds: true,
  // SyntheticDev fallback rows are never showcased (dev data, not real).
  blockSynthetic: true
} as const;

export type DataQualityLevel = 'verified' | 'reference' | 'blocked';

export interface DataQualityReport {
  level: DataQualityLevel;
  eligible: boolean;       // may be cached + displayed
  needsResearch: boolean;  // structurally fine but real odds missing
  issues: string[];
  score: number;
  hasRealOdds: boolean;
  normalizedHome: string;
  normalizedAway: string;
  normalizedLeague: string;
}

export function realOddsEnv(): boolean {
  const raw = process.env.PREDICTOR_REQUIRE_REAL_ODDS?.trim().toLowerCase();
  return raw ? raw !== 'false' && raw !== '0' : SHOWCASE_THRESHOLDS.requireRealOdds;
}

export function allowSyntheticEnv(): boolean {
  const raw = process.env.PREDICTOR_ALLOW_SYNTHETIC?.trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

/**
 * Whether a match already carries real, parseable odds (h2h / total / spread).
 * Accepts BOTH pipeline shapes:
 *  - raw ScrapeMatch: `oddsText` — a bare decimal run or the explicit
 *    Odds-API form ("h2h=1.14,7.00,18.00 totals=… spread=…").
 *  - NormalizedMatch: `scope._meta.oddsIsReal` — set by normalizeMatch() from
 *    the same parse, so the orchestrator gate and the client never disagree.
 */
export function hasRealOdds(m: { oddsText?: string; source?: string; scope?: { _meta?: { oddsIsReal?: boolean } } }): boolean {
  if (!m) return false;
  if (m.scope?._meta?.oddsIsReal === true) return true;
  if (!m.oddsText) return false;
  const parsed = parseOddsText(m.oddsText);
  return Boolean(
    (parsed.h2h && parsed.h2h.length >= 2) ||
    parsed.total ||
    parsed.spread
  );
}

/**
 * Full showcase gate. Combines the structural validator, the sport-fingerprint
 * gate and the real-odds precondition into one report the orchestrator can act
 * on. `needsResearch` is set when only the odds precondition is missing — the
 * pipeline then runs the serper fallback and re-gates.
 */
export function assessDataQuality(
  m: { league?: string; homeTeam?: string; awayTeam?: string; source?: string; oddsText?: string },
  sportId: string
): DataQualityReport {
  const issues: string[] = [];
  const v = validateFixture(m, sportId);

  if (!v.valid) issues.push(...v.issues);

  // League belongs to THIS sport — hard gate independent of team fingerprint.
  // (Arsenal vs Chelsea in "NBA" still fingerprints football via the teams, so
  // the league gate is checked explicitly, not left to the keyword score.)
  const leagueBelongs = v.normalizedLeague
    ? serverLeagueBelongsToSport(v.normalizedLeague, sportId)
    : false;
  // The server-league pool clash check skips short tokens (e.g. "NBA" is 3
  // chars) so ALSO fingerprint the league text against every other sport's
  // keyword set — a league that positively matches another sport is blocked.
  let leagueFingerprintsElsewhere = false;
  if (v.normalizedLeague) {
    const OTHER_SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'rugby', 'cricket', 'mma', 'volleyball'];
    for (const other of OTHER_SPORTS) {
      if (other === sportId) continue;
      if (matchBelongsToSport({ league: v.normalizedLeague }, other, { trustTypedApi: false })) {
        leagueFingerprintsElsewhere = true;
        break;
      }
    }
  }
  if (!v.normalizedLeague) issues.push('league empty or missing');
  if (v.normalizedLeague && (!leagueBelongs || leagueFingerprintsElsewhere)) {
    issues.push(`league "${v.normalizedLeague}" belongs to another sport category`);
  }

  const sportOk = matchBelongsToSport(m, sportId);
  if (!sportOk) issues.push('fixture does not fingerprint for this sport');

  const synthetic = /^synthetic/i.test(m.source ?? '');
  if (synthetic && !allowSyntheticEnv()) issues.push('synthetic dev fixture blocked from showcase');

  const realOdds = hasRealOdds(m);
  if (!realOdds && realOddsEnv()) issues.push('no real odds attached — reference only');

  const score = v.score;
  const structurallySound = v.valid && sportOk && leagueBelongs && !leagueFingerprintsElsewhere && !!v.normalizedLeague && !synthetic;
  const needsResearch = structurallySound && !realOdds && realOddsEnv();

  // blocked: fails structural checks or synthetic in prod
  // reference: structurally fine but no real odds (kept only when the env gate
  //            is relaxed; otherwise needsResearch sends it to the search fill)
  // verified: everything passes — safe to showcase and qualify
  let level: DataQualityLevel = 'blocked';
  if (structurallySound) {
    level = realOdds ? 'verified' : needsResearch ? 'blocked' : 'reference';
  }

  const eligible = level === 'verified' || (level === 'reference' && !realOddsEnv());

  return {
    level,
    eligible,
    needsResearch,
    issues,
    score,
    hasRealOdds: realOdds,
    normalizedHome: v.normalizedHome,
    normalizedAway: v.normalizedAway,
    normalizedLeague: v.normalizedLeague
  };
}

/**
 * Cross-source canonical key for a fixture. Teams and league are normalized so
 * "Man Utd vs Arsenal (Premier League)" from LiveAPI and "Manchester United vs
 * Arsenal (English Premier League)" from LiveScrape collapse to the same key.
 */
export function crossSourceKey(
  m: { league?: string; homeTeam?: string; awayTeam?: string },
  sportId: string
): string {
  const league = serverCanonicalizeLeague(m.league || '', sportId) || String(m.league || '');
  const h = normalizeName(m.homeTeam || '');
  const a = normalizeName(m.awayTeam || '');
  return `${sportId}|${league}|${h}|${a}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
}

/**
 * Cross-source de-duplication: one canonical row per fixture, preferring the
 * entry that carries real odds and the most complete metadata. The caller's
 * original ordering is preserved for the first occurrence of each key.
 */
export function dedupeMatches(matches: ScrapeMatch[], sportId: string): ScrapeMatch[] {
  const best = new Map<string, ScrapeMatch>();
  for (const m of matches) {
    if (!m.homeTeam || !m.awayTeam) continue;
    const key = crossSourceKey(m, sportId);
    const existing = best.get(key);
    if (!existing) {
      best.set(key, m);
      continue;
    }
    const existingOdds = hasRealOdds(existing);
    const incomingOdds = hasRealOdds(m);
    // Prefer the entry carrying real odds; keep the first otherwise.
    if (!existingOdds && incomingOdds) best.set(key, m);
  }
  return Array.from(best.values());
}

/**
 * Live web-search fallback. For fixtures that are structurally sound but carry
 * no real odds, runs a targeted serper query ("TeamA vs TeamB league odds") and
 * extracts real decimal prices from the SERP snippets. Stamps `oddsText` and a
 * citation on the match so the unified cache records exactly where the data
 * came from. Bounded (cap) to protect SERP quota; never throws.
 */
export async function researchFixtureGaps(
  sportId: string,
  fixtures: ScrapeMatch[],
  cap = 12
): Promise<{ filled: number; citations: string[]; attempted: number }> {
  const gaps = fixtures.filter((m) => !hasRealOdds(m));
  const targets = gaps.slice(0, Math.max(0, cap));
  const citations: string[] = [];
  let filled = 0;

  const fillOne = async (m: ScrapeMatch) => {
    const league = m.league && !/^(football|basketball|tennis|ice hockey|baseball|table tennis|american football|rugby|cricket|mma|volleyball)$/i.test(m.league)
      ? m.league
      : '';
    const query = `${m.homeTeam} vs ${m.awayTeam}${league ? ` ${league}` : ''} odds today`.trim();
    const res = await serperSearch(query, 5);
    if (!res.ok || res.items.length === 0) return;

    // Extract decimal odds tokens (1.01–15.00) from titles + snippets.
    const odds: number[] = [];
    const re = /\b(\d{1,2}\.\d{2,3})\b/g;
    for (const it of res.items) {
      const text = `${it.title} ${it.snippet}`;
      let mt: RegExpExecArray | null;
      while ((mt = re.exec(text)) && odds.length < 4) {
        const val = Number(mt[1]);
        if (val >= 1.01 && val <= 15 && !odds.includes(val)) odds.push(val);
      }
      if (odds.length >= 4) break;
    }

    // A bare 2-3 decimal run is enough for the normalize stage to build a real
    // scope (h2h for 3, total-pair for 2). Reject degenerate runs that are
    // clearly scores (e.g. "2 - 1" won't match the decimal pattern anyway).
    if (odds.length >= 2) {
      m.oddsText = odds.slice(0, 3).map((n) => n.toFixed(2)).join(', ');
      const src = res.items.find((i) => i.link)?.link;
      if (src) citations.push(`${m.homeTeam} vs ${m.awayTeam}: ${src}`);
      filled += 1;
    }
  };

  await Promise.all(targets.map((m) => fillOne(m).catch(() => {})));

  return { filled, citations: Array.from(new Set(citations)), attempted: targets.length };
}
