import { describe, it, expect } from 'vitest';
import type { PredictorMatch } from './predictorTypes';
import {
  statusOfMatch,
  filterByTimeBand,
  matchesQuery,
  searchPriorityCompare,
  sortMatches,
  groupByLeague,
  measureFilter,
  FILTER_BUDGET_MS,
  IN_PLAY_WINDOW_MS,
  type GameTab,
  type SortOrder
} from './predictorFiltering';

const NOW = Date.UTC(2026, 7, 11, 12, 0, 0); // 2026-08-11 12:00 UTC

function match(partial: Partial<PredictorMatch>): PredictorMatch {
  return {
    _id: partial.matchId ?? 'id',
    dayKey: '2026-08-11',
    sportId: 'football',
    matchId: partial.matchId ?? 'id',
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    startTime: NOW + 3 * 60 * 60 * 1000,
    source: 'LiveAPI',
    marketsAvailable: ['result'],
    scopes: null,
    createdAt: NOW,
    ...partial
  } as PredictorMatch;
}

describe('statusOfMatch', () => {
  it('honours explicit server status', () => {
    expect(statusOfMatch(match({ status: 'finished', finalScore: '2 - 1' }), NOW)).toBe('finished');
    expect(statusOfMatch(match({ status: 'inplay' }), NOW)).toBe('inplay');
  });

  it('derives upcoming / in-play / finished from kickoff vs now', () => {
    expect(statusOfMatch(match({ startTime: NOW + 60_000 }), NOW)).toBe('upcoming');
    expect(statusOfMatch(match({ startTime: NOW - 60_000 }), NOW)).toBe('inplay');
    expect(statusOfMatch(match({ startTime: NOW - IN_PLAY_WINDOW_MS - 60_000 }), NOW)).toBe('finished');
  });

  it('treats finalScore as authoritative finished', () => {
    expect(statusOfMatch(match({ status: 'upcoming', finalScore: '3 - 3' }), NOW)).toBe('finished');
  });
});

describe('filterByTimeBand', () => {
  const mk = (h: number) => match({ startTime: Date.UTC(2026, 7, 11, h, 0, 0) });
  const list = [mk(8), mk(13), mk(20)];
  it('all passes everything through', () => {
    expect(filterByTimeBand(list, 'all')).toHaveLength(3);
  });
  it('morning = hours < 12', () => {
    expect(filterByTimeBand(list, 'morning')).toHaveLength(1);
    expect(filterByTimeBand(list, 'morning')[0].homeTeam).toBe('Arsenal');
  });
  it('afternoon = 12–17', () => {
    expect(filterByTimeBand(list, 'afternoon')).toHaveLength(1);
  });
  it('evening = 18+', () => {
    expect(filterByTimeBand(list, 'evening')).toHaveLength(1);
  });
});

describe('matchesQuery', () => {
  const m = match({ homeTeam: 'Manchester United', awayTeam: 'Arsenal', league: 'Premier League', matchId: 'mu-ars-1' });
  it('matches team names (case-insensitive, multi-token)', () => {
    expect(matchesQuery(m, 'manchester united')).toBe(true);
    expect(matchesQuery(m, 'arsenal')).toBe(true);
    expect(matchesQuery(m, 'MAN UNITED')).toBe(true);
  });
  it('matches league and match id', () => {
    expect(matchesQuery(m, 'premier')).toBe(true);
    expect(matchesQuery(m, 'mu-ars-1')).toBe(true);
  });
  it('empty query matches everything', () => {
    expect(matchesQuery(m, '')).toBe(true);
    expect(matchesQuery(m, '   ')).toBe(true);
  });
  it('all tokens must match', () => {
    expect(matchesQuery(m, 'arsenal chelsea')).toBe(false);
    expect(matchesQuery(m, 'arsenal premier')).toBe(true);
  });
});

describe('searchPriorityCompare — scheduled → finished → in-play', () => {
  it('scheduled matches rank above finished and in-play', () => {
    const upcoming = match({ matchId: 'u', startTime: NOW + 3_600_000 });
    const finished = match({ matchId: 'f', startTime: NOW - IN_PLAY_WINDOW_MS - 3_600_000, status: 'finished', finalScore: '1 - 0' });
    const inplay = match({ matchId: 'i', startTime: NOW - 600_000 });
    const sorted = [inplay, finished, upcoming].sort((a, b) => searchPriorityCompare(a, b, NOW));
    expect(sorted.map((m) => m.matchId)).toEqual(['u', 'f', 'i']);
  });

  it('breaks ties by kickoff time', () => {
    const early = match({ matchId: 'e', startTime: NOW + 3_600_000 });
    const late = match({ matchId: 'l', startTime: NOW + 7_200_000 });
    expect(searchPriorityCompare(early, late, NOW)).toBeLessThan(0);
  });
});

describe('sortMatches', () => {
  const upcomingSoon = match({ matchId: 'soon', startTime: NOW + 3_600_000 });
  const upcomingLater = match({ matchId: 'later', startTime: NOW + 7_200_000 });
  const finished = match({ matchId: 'fin', startTime: NOW - IN_PLAY_WINDOW_MS - 3_600_000, status: 'finished', finalScore: '2 - 0' });

  it("default 'asc' puts most recent & upcoming at the top, status-grouped", () => {
    const sorted = sortMatches([finished, upcomingLater, upcomingSoon], 'asc', NOW);
    expect(sorted.map((m) => m.matchId)).toEqual(['soon', 'later', 'fin']);
  });

  it("'desc' inverts the startTime leg within each status group", () => {
    const sorted = sortMatches([upcomingSoon, upcomingLater, finished], 'desc', NOW);
    // upcoming group: later first; finished group last.
    expect(sorted.map((m) => m.matchId)).toEqual(['later', 'soon', 'fin']);
  });

  it("'asc' puts the most recent finished match at the top of the finished group", () => {
    const older = match({ matchId: 'older', startTime: NOW - IN_PLAY_WINDOW_MS - 7_200_000, status: 'finished', finalScore: '1 - 1' });
    const newer = match({ matchId: 'newer', startTime: NOW - IN_PLAY_WINDOW_MS - 3_600_000, status: 'finished', finalScore: '3 - 0' });
    const sorted = sortMatches([older, newer], 'asc', NOW);
    expect(sorted.map((m) => m.matchId)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const input = [finished, upcomingSoon];
    const copy = [...input];
    sortMatches(input, 'asc', NOW);
    expect(input).toEqual(copy);
  });
});

describe('groupByLeague', () => {
  it('groups by display league and keeps input order', () => {
    const a = match({ matchId: 'a', league: 'Premier League' });
    const b = match({ matchId: 'b', league: 'La Liga' });
    const c = match({ matchId: 'c', league: 'Premier League' });
    const groups = groupByLeague([a, b, c], (raw) => raw);
    expect(Object.keys(groups)).toEqual(['Premier League', 'La Liga']);
    expect(groups['Premier League'].map((m) => m.matchId)).toEqual(['a', 'c']);
  });

  it('falls back to Other for empty leagues', () => {
    const groups = groupByLeague([match({ matchId: 'x', league: '' })], (raw) => raw);
    expect(groups['Other']).toBeDefined();
  });
});

describe('measureFilter — <500ms budget monitoring', () => {
  it('reports elapsed time and honours the budget', () => {
    const { result, metrics } = measureFilter(() => 1 + 1);
    expect(result).toBe(2);
    expect(metrics.elapsedMs).toBeGreaterThanOrEqual(0);
    expect(metrics.overBudget).toBe(false);
  });

  it('flags passes over the budget', () => {
    const slow = measureFilter(() => {
      const end = performance.now() + FILTER_BUDGET_MS + 20;
      while (performance.now() < end) {
        /* busy wait */
      }
      return 0;
    });
    expect(slow.metrics.overBudget).toBe(true);
  });
});

// Ensure the GameTab/SortOrder types are usable (type-level smoke).
const _tab: GameTab = 'upcoming';
const _order: SortOrder = 'desc';
void _tab;
void _order;
