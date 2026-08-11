import { describe, it, expect } from 'vitest';
import {
  assessDataQuality,
  crossSourceKey,
  dedupeMatches,
  hasRealOdds,
  SHOWCASE_THRESHOLDS
} from '../../convex/scrapers/dataQuality';
import { amaraFilter } from '../../convex/agents/specialists';
import { normalizeMatch } from '../../convex/scrapers/normalize';
import type { ScrapeMatch } from '../../convex/scrapers/betwatch';

function fixture(over: Partial<ScrapeMatch> = {}): ScrapeMatch {
  return {
    source: 'LiveScrape',
    sourceUrl: 'https://www.betexplorer.com/football/',
    league: 'Premier League',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    startTime: Date.now() + 86400000,
    markets: ['result', 'mainTotal'],
    oddsText: 'h2h=1.85,3.40,2.10 totals=2.5:1.85/1.95',
    ...over
  };
}

describe('dataQuality: showcase gate', () => {
  it('verifies a complete fixture with real odds', () => {
    const r = assessDataQuality(fixture(), 'football');
    expect(r.level).toBe('verified');
    expect(r.eligible).toBe(true);
    expect(r.hasRealOdds).toBe(true);
    expect(r.needsResearch).toBe(false);
    expect(r.issues).toEqual([]);
  });

  it('blocks a match with no real odds when the gate is on', () => {
    const r = assessDataQuality(fixture({ oddsText: '' }), 'football');
    expect(r.level).toBe('blocked');
    expect(r.eligible).toBe(false);
    expect(r.hasRealOdds).toBe(false);
    expect(r.needsResearch).toBe(true); // structurally fine — send to search fill
  });

  it('blocks synthetic dev fixtures from showcase', () => {
    const r = assessDataQuality(fixture({ source: 'SyntheticDev' }), 'football');
    expect(r.eligible).toBe(false);
    expect(r.level).toBe('blocked');
  });

  it('blocks odds-shaped team names (name vs odd bug)', () => {
    const r = assessDataQuality(fixture({ homeTeam: '2.10', awayTeam: 'Arsenal' }), 'football');
    expect(r.eligible).toBe(false);
    expect(r.issues.some((i) => /odds value/i.test(i))).toBe(true);
  });

  it('hasRealOdds recognises NormalizedMatch scope._meta.oddsIsReal (no oddsText field)', () => {
    // NormalizedMatch carries odds only in scope._meta — the orchestrator gate
    // must not reject it as "reference only" and drop every live fixture.
    expect(hasRealOdds({ oddsText: '3.71, 3.69, 1.86' })).toBe(true);
    expect(hasRealOdds({ scope: { _meta: { oddsIsReal: true } } })).toBe(true);
    expect(hasRealOdds({ scope: { _meta: { oddsIsReal: false } } })).toBe(false);
    expect(hasRealOdds({ scope: {} })).toBe(false);
    expect(hasRealOdds({})).toBe(false);
  });

  it('blocks a league that belongs to another sport', () => {
    const r = assessDataQuality(fixture({ league: 'NBA' }), 'football');
    expect(r.eligible).toBe(false);
    expect(r.level).toBe('blocked');
  });

  it('blocks a fixture that does not fingerprint for the sport', () => {
    // Boston Celtics is basketball — must never pass the football gate.
    const r = assessDataQuality(fixture({ homeTeam: 'Boston Celtics', awayTeam: 'Los Angeles Lakers', league: 'NBA' }), 'football');
    expect(r.eligible).toBe(false);
  });
});

describe('dataQuality: real-odds detection', () => {
  it('detects explicit Odds API form', () => {
    expect(hasRealOdds({ oddsText: 'h2h=1.14,7.00,18.00 totals=2.5:1.85/1.95' })).toBe(true);
  });

  it('detects bare decimal runs', () => {
    expect(hasRealOdds({ oddsText: '1.85, 3.40, 2.10' })).toBe(true);
  });

  it('rejects empty / non-numeric text', () => {
    expect(hasRealOdds({ oddsText: '' })).toBe(false);
    expect(hasRealOdds({ oddsText: 'Arsenal vs Chelsea' })).toBe(false);
    expect(hasRealOdds({})).toBe(false);
  });
});

describe('dataQuality: cross-source dedup', () => {
  it('collapses the same fixture across providers to one canonical row', () => {
    const a = fixture({ source: 'LiveAPI', homeTeam: 'Manchester United', awayTeam: 'Arsenal', oddsText: 'h2h=1.85,3.40,2.10' });
    const b = fixture({ source: 'LiveScrape', homeTeam: 'Man Utd', awayTeam: 'Arsenal', oddsText: '' });
    const deduped = dedupeMatches([a, b], 'football');
    expect(deduped).toHaveLength(1);
    // The odds-bearing entry wins.
    expect(deduped[0].source).toBe('LiveAPI');
    expect(hasRealOdds(deduped[0])).toBe(true);
  });

  it('keeps distinct fixtures separate', () => {
    const a = fixture({ homeTeam: 'Arsenal', awayTeam: 'Chelsea' });
    const b = fixture({ homeTeam: 'Liverpool', awayTeam: 'Man City' });
    expect(dedupeMatches([a, b], 'football')).toHaveLength(2);
  });

  it('produces stable canonical keys', () => {
    const a = fixture({ homeTeam: 'Man Utd', awayTeam: 'Arsenal' });
    const b = fixture({ homeTeam: 'Manchester United', awayTeam: 'Arsenal' });
    expect(crossSourceKey(a, 'football')).toBe(crossSourceKey(b, 'football'));
  });
});

describe('dataQuality: Amara gate + real odds', () => {
  it('never qualifies a match whose scope was built from fabricated odds', () => {
    // No real odds → normalizeMatch builds hash fallbacks with oddsIsReal:false.
    const noOdds = normalizeMatch(fixture({ oddsText: '' }), 'football');
    const withOdds = normalizeMatch(fixture(), 'football');
    const filter = amaraFilter([noOdds, withOdds], 52);
    expect(filter.matchIds).not.toContain(noOdds.matchId);
  });
});

describe('dataQuality: thresholds are codified', () => {
  it('exposes the showcase preconditions', () => {
    expect(SHOWCASE_THRESHOLDS.minValidationScore).toBe(10);
    expect(SHOWCASE_THRESHOLDS.requireRealOdds).toBe(true);
    expect(SHOWCASE_THRESHOLDS.blockSynthetic).toBe(true);
  });
});
