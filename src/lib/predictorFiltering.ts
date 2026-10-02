// ── AI Predictor match-card filtering & sorting ───────────────────────────────
// Pure client-side helpers (no Convex imports) so the <500ms filter behaviour is
// unit-testable. Used by PredictorPage for:
//   - status classification (upcoming / in-play / finished)
//   - time-band filtering (morning / afternoon / evening)
//   - unified text search (team, player, match id) with status-priority ordering
//   - ascending/descending sort by match date & schedule time
//   - a filter-duration monitor that flags any pass over the 500ms budget

import type { PredictorMatch } from './predictorTypes';
import { getWatHour } from './watTime';

export type GameTab = 'upcoming' | 'inplay' | 'finished';
export type TimeBand = 'all' | 'morning' | 'afternoon' | 'evening';
export type SortOrder = 'asc' | 'desc';

/** A match is considered in-play for this long after kickoff (no live clock). */
export const IN_PLAY_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Classify a match's current status purely from cached fields + wall clock.
 * Explicit server status wins; otherwise derive from startTime vs now.
 */
export function statusOfMatch(
  m: Pick<PredictorMatch, 'status' | 'finalScore' | 'startTime'>,
  now: number
): GameTab {
  // Explicit server status is authoritative: a live match with a partial
  // scoreline stored in finalScore is IN-PLAY, not finished (checking the
  // score first would push every live match into the Finished tab).
  if (m.status === 'finished') return 'finished';
  if (m.status === 'inplay') return 'inplay';
  if (!!m.finalScore) return 'finished';
  // No explicit status: derive from the schedule. A match that has NOT kicked
  // off yet (startTime in the future) is always upcoming — only a startTime in
  // the past can be in-play/finished, so a future fixture can never leak into
  // the Finished or In-Play tabs early.
  if (m.startTime <= 0 || m.startTime > now) return 'upcoming';
  if (m.startTime > now - IN_PLAY_WINDOW_MS) return 'inplay';
  return 'finished';
}

/** Status priority used by the default (most-recent & upcoming first) ordering. */
export const STATUS_PRIORITY: Record<GameTab, number> = {
  upcoming: 0,
  inplay: 1,
  finished: 2
};

/**
 * Effective kickoff used for EVERY ordering decision.
 *
 * A fixture with no parseable schedule time (startTime <= 0 / NaN) sorts LAST
 * rather than first: an unknown time must never occupy the top of a schedule
 * that is ranked by kickoff.
 */
export function kickoffOf(m: Pick<PredictorMatch, 'startTime'>): number {
  const t = Number(m?.startTime);
  return Number.isFinite(t) && t > 0 ? t : Number.POSITIVE_INFINITY;
}

/**
 * Strict chronological comparison: soonest kickoff first, then league name and
 * home team so two fixtures at the same minute never swap places between
 * renders (a stable, deterministic schedule).
 */
export function chronoCompare(a: PredictorMatch, b: PredictorMatch): number {
  const ta = kickoffOf(a);
  const tb = kickoffOf(b);
  if (ta !== tb) return ta - tb;
  const la = String(a.league || '');
  const lb = String(b.league || '');
  if (la !== lb) return la.localeCompare(lb);
  const ha = `${a.homeTeam} ${a.awayTeam}`;
  const hb = `${b.homeTeam} ${b.awayTeam}`;
  return ha.localeCompare(hb);
}

/**
 * Filter a list to a schedule time band (WAT hours). 'all' passes everything.
 */
export function filterByTimeBand(list: PredictorMatch[], band: TimeBand): PredictorMatch[] {
  if (band === 'all') return list;
  return list.filter((m) => {
    const h = getWatHour(m.startTime);
    return band === 'morning' ? h < 12 : band === 'afternoon' ? h >= 12 && h < 18 : h >= 18;
  });
}

// Per-match search-haystack cache. PredictorMatch rows are stable references
// from the Convex subscription (replaced wholesale on each poll), so a WeakMap
// keeps the expensive scope walk from re-running on every keystroke.
const searchTextCache = new WeakMap<object, string>();

// Recursively collect every meaningful string inside the cached scope/odds data
// (bounded depth) so player names embedded in market selections (tennis / MMA
// bouts, totals lines, handicap labels) are searchable, not just team names.
function collectSearchStrings(value: unknown, out: string[], depth: number): void {
  if (depth > 3 || value == null) return;
  if (typeof value === 'string') {
    const t = value.trim();
    if (t.length >= 2) out.push(t);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectSearchStrings(v, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    // Player names usually sit as object KEYS in odds markets (e.g.
    // { 'Kylian Mbappe': 1.9 }), so both keys and values are collected.
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.trim().length >= 2) out.push(k);
      collectSearchStrings(v, out, depth + 1);
    }
  }
}

/** Normalized haystack for a match: teams + league + match id + scope/player data. */
export function matchSearchText(m: PredictorMatch): string {
  const cached = searchTextCache.get(m);
  if (cached !== undefined) return cached;
  const parts = [m.homeTeam, m.awayTeam, m.league, m.matchId];
  if (m.scopes) collectSearchStrings(m.scopes, parts, 0);
  if (m.oddsSnapshot) collectSearchStrings(m.oddsSnapshot, parts, 0);
  const text = parts.join(' ').toLowerCase();
  searchTextCache.set(m, text);
  return text;
}

/** Whether a match matches a free-text query (team / player / match id). */
export function matchesQuery(m: PredictorMatch, query: string): boolean {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  const hay = matchSearchText(m);
  return tokens.every((t) => hay.includes(t));
}

/**
 * Rank a match for search-result ordering: scheduled first, then finished,
 * then in-play (per the product requirement), breaking ties by kickoff time.
 */
export function searchPriorityCompare(a: PredictorMatch, b: PredictorMatch, now: number): number {
  // Scheduled first, then finished, then in-play.
  const rank = (m: PredictorMatch): number => {
    const st = statusOfMatch(m, now);
    if (st === 'upcoming') return 0;
    if (st === 'finished') return 1;
    return 2;
  };
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  return a.startTime - b.startTime;
}

/**
 * Stable sort by (status priority, startTime). The default 'asc' order puts the
 * most recent & upcoming matches at the top: upcoming/in-play soonest-first,
 * then finished most-recent-first (recent results sit at the top of the
 * finished group). 'desc' inverts each leg while keeping the status grouping so
 * the schedule stays readable.
 */
export function sortMatches(list: PredictorMatch[], order: SortOrder, now: number): PredictorMatch[] {
  const dir = order === 'asc' ? 1 : -1;
  return [...list].sort((a, b) => {
    const sa = statusOfMatch(a, now);
    const sb = statusOfMatch(b, now);
    if (sa !== sb) return STATUS_PRIORITY[sa] - STATUS_PRIORITY[sb];
    const t = a.startTime - b.startTime;
    // Finished results read newest-first regardless of the date direction,
    // so 'asc' still surfaces the most recent result at the top.
    return sa === 'finished' ? t * -dir : t * dir;
  });
}

/**
 * Order a single day's fixtures STRICTLY by schedule date + kickoff time.
 *
 * The day view used to be rendered as league blocks taken in "order of first
 * appearance", which interleaved the schedule: a league whose earliest fixture
 * was at 14:00 had its 22:00 fixture printed above a 15:00 fixture belonging to
 * another league. This comparator removes that entirely — the caller walks the
 * result top-to-bottom and sees 09:00, 09:30, 10:00 … in order, with the league
 * label attached to each fixture.
 */
export function sortChronologically(list: PredictorMatch[], order: SortOrder = 'asc'): PredictorMatch[] {
  const sorted = [...list].sort(chronoCompare);
  return order === 'desc' ? sorted.reverse() : sorted;
}

export interface LeagueSegment {
  /** Display league name (already run through `displayLeague`). */
  league: string;
  /** That league's fixtures, contiguous in kickoff order. */
  matches: PredictorMatch[];
}

/**
 * Turn one day's fixtures into STRICTLY chronological league segments.
 *
 * Returns an ordered list of `{ league, matches }` where the whole list reads
 * top-to-bottom in kickoff order. A league only gets one segment while its
 * fixtures are contiguous in time; if it reappears later in the day a second
 * segment with the same name is emitted (a real schedule header), so nothing is
 * ever re-ordered to keep a league together.
 */
export function chronoSegments(
  list: PredictorMatch[],
  displayLeague: (raw: string) => string,
  order: SortOrder = 'asc'
): LeagueSegment[] {
  const ordered = sortChronologically(list, order);
  const segments: LeagueSegment[] = [];
  for (const m of ordered) {
    const league = m.league ? displayLeague(m.league) : 'Other';
    const last = segments[segments.length - 1];
    if (last && last.league === league) last.matches.push(m);
    else segments.push({ league, matches: [m] });
  }
  return segments;
}

/** Group matches by their league display key, preserving input order. */
export function groupByLeague(
  list: PredictorMatch[],
  displayLeague: (raw: string) => string
): Record<string, PredictorMatch[]> {
  const groups: Record<string, PredictorMatch[]> = {};
  for (const m of list) {
    const key = m.league ? displayLeague(m.league) : 'Other';
    (groups[key] ??= []).push(m);
  }
  return groups;
}

export interface FilterMetrics {
  /** Wall-clock ms the last filter+sort pass took. */
  elapsedMs: number;
  /** True when the pass exceeded the 500ms budget. */
  overBudget: boolean;
}

export const FILTER_BUDGET_MS = 500;

/**
 * Run a filter+sort pass and report its duration so the UI can surface a perf
 * badge and the console can warn when the 500ms budget is exceeded.
 */
export function measureFilter<T>(fn: () => T): { result: T; metrics: FilterMetrics } {
  const started = performance.now();
  const result = fn();
  const elapsedMs = performance.now() - started;
  return { result, metrics: { elapsedMs, overBudget: elapsedMs > FILTER_BUDGET_MS } };
}
