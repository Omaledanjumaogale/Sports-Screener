// Day-scoped fixture-feed regression tests.
//
// The static /next/<sport>/ breadth pages are TODAY's board only (BetExplorer
// renders them with data-dt stamps for the current day). Every future dayKey —
// tomorrow included — therefore used to fall back on nothing, or on generic
// markdown/relay pages whose rows produced nonsense fixtures. The day-scoped
// URL below is what makes a future day fetch its OWN board from the same
// structural feed; these tests pin that URL shape and routing.
import { describe, it, expect } from 'vitest';
import { betexplorerDayUrl, fixturePagesFor } from '../../convex/scrapers/sources';

describe('betexplorerDayUrl — day-scoped breadth feed', () => {
  it('builds the day-scoped /next/ URL for a WAT dayKey', () => {
    expect(betexplorerDayUrl('football', '2026-09-25')).toBe(
      'https://www.betexplorer.com/next/soccer/?day=25&month=9&year=2026'
    );
    expect(betexplorerDayUrl('basketball', '2026-12-01')).toBe(
      'https://www.betexplorer.com/next/basketball/?day=1&month=12&year=2026'
    );
  });

  it('strips leading zeros from the month/day (BetExplorer expects plain ints)', () => {
    expect(betexplorerDayUrl('football', '2026-01-05')).toBe(
      'https://www.betexplorer.com/next/soccer/?day=5&month=1&year=2026'
    );
  });

  it('returns empty for sports with no BetExplorer breadth page', () => {
    for (const s of ['rally', 'rugby', 'cricket', 'mma', 'americanfootball']) {
      expect(betexplorerDayUrl(s, '2026-09-25')).toBe('');
    }
  });

  it('returns empty for malformed or out-of-range dayKeys', () => {
    expect(betexplorerDayUrl('football', '')).toBe('');
    expect(betexplorerDayUrl('football', '2026-9-25')).toBe('');
    expect(betexplorerDayUrl('football', '2026-13-01')).toBe('');
    expect(betexplorerDayUrl('football', '25/09/2026')).toBe('');
  });
});

describe('fixturePagesFor — per-day source routing', () => {
  it("keeps the static list untouched for TODAY (no wasted fetch)", () => {
    const today = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 10);
    const pages = fixturePagesFor('football', today);
    expect(pages[0]).toBe('https://www.betexplorer.com/next/soccer/');
    expect(pages.some((u) => u.includes('?day='))).toBe(false);
  });

  it('prepends the day-scoped feed for a future dayKey', () => {
    const pages = fixturePagesFor('football', '2026-09-25');
    expect(pages[0]).toContain('/next/soccer/?day=25&month=9&year=2026');
    // The static roots stay, so day-overlapping rows are still collected.
    expect(pages).toContain('https://www.betexplorer.com/football/');
  });

  it('leaves API-fed sports alone', () => {
    expect(fixturePagesFor('mma', '2026-09-25')).toEqual(fixturePagesFor('mma'));
  });
});
