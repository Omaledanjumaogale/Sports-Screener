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
  if (m.status === 'finished' || !!m.finalScore) return 'finished';
  if (m.status === 'inplay') return 'inplay';
  if (m.startTime <= 0) return 'upcoming';
  if (m.startTime > now) return 'upcoming';
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
 * Filter a list to a schedule time band (WAT hours). 'all' passes everything.
 */
export function filterByTimeBand(list: PredictorMatch[], band: TimeBand): PredictorMatch[] {
  if (band === 'all') return list;
  return list.filter((m) => {
    const h = getWatHour(m.startTime);
    return band === 'morning' ? h < 12 : band === 'afternoon' ? h >= 12 && h < 18 : h >= 18;
  });
}

/** Normalized haystack for a match: teams + league + match id. */
export function matchSearchText(m: PredictorMatch): string {
  return `${m.homeTeam} ${m.awayTeam} ${m.league} ${m.matchId}`.toLowerCase();
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
