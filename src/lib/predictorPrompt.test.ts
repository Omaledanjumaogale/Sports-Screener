// Regression tests for the prompt/picks-quality fixes:
//   1. TOP_VALUE_ODDS_BAND — the LLM's "TOP VALUE OPPORTUNITIES" section must
//      only surface bettable prices (no near-1.01 certainty noise, no extreme
//      long shots), because with every margined price the least-negative edge
//      always falls on the longest shot.
//   2. Certainty-side exclusion — headline / Safest / All-Markets profile tops
//      must never land on a near-1.01 side (odds <= CERTAINTY_ODDS) when a
//      bettable alternative exists in the same analysis.
import { describe, expect, it } from 'vitest';
import { isTopValueCandidate, TOP_VALUE_ODDS_BAND } from '../../convex/llm';
import { normalizeMatch } from '../../convex/scrapers/normalize';
import type { ScrapeMatch } from '../../convex/scrapers/betwatch';
import { analyzeBasketball, analyzeFootball, CERTAINTY_ODDS, type ScopeState } from './engine';

// Verbatim replication of convex/llm.ts summarizeScope (odds-band filter applied)
// so the exact prompt payload the LLM receives can be asserted on.
function devigItems(entries: { label: string; odds: number }[]) {
  const valid = entries.filter((e) => e.odds > 1);
  if (valid.length < 2) return { items: [], overround: 0 };
  const inv = valid.map((e) => 1 / e.odds);
  const sum = inv.reduce((a, b) => a + b, 0);
  const overround = (sum - 1) * 100;
  const items = valid.map((e, i) => {
    const fair = (inv[i] / sum) * 100;
    const implied = inv[i] * 100;
    return { label: e.label, odds: e.odds, implied, fair, edge: fair - implied };
  });
  return { items, overround };
}

function summarizeScope(scope: ScopeState): { lines: string[]; markets: string[]; topValue: string[] } {
  const markets = (scope as any)?.markets ?? {};
  const lines: string[] = [];
  const marketsStr: string[] = [];
  const topValue: string[] = [];
  for (const [key, mkt] of Object.entries(markets) as [string, any][]) {
    if (Array.isArray(mkt?.pairs)) {
      const title = mkt?.title || key;
      for (const p of mkt.pairs) {
        const over = Number(p?.over);
        const under = Number(p?.under);
        if (p?.line == null || !over || !under) continue;
        const { items, overround } = devigItems([
          { label: `Over ${p.line}`, odds: over },
          { label: `Under ${p.line}`, odds: under }
        ]);
        const ov = items[0];
        const un = items[1];
        if (!ov || !un) continue;
        lines.push(
          `${title} ${p.line}: Over @ ${over.toFixed(2)} (implied ${ov.implied.toFixed(1)}%, real ${ov.fair.toFixed(1)}%, edge ${ov.edge >= 0 ? '+' : ''}${ov.edge.toFixed(1)}%) vs Under @ ${under.toFixed(2)} (real ${un.fair.toFixed(1)}%, edge ${un.edge >= 0 ? '+' : ''}${un.edge.toFixed(1)}%)` +
            (overround ? ` | Bookies Profit Cut ${overround.toFixed(1)}%` : '')
        );
        for (const side of [
          { label: `Over ${p.line}`, odds: over, edge: ov.edge },
          { label: `Under ${p.line}`, odds: under, edge: un.edge }
        ]) {
          if (isTopValueCandidate(side.odds)) topValue.push(`${side.edge >= 0 ? '+' : ''}${side.edge.toFixed(1)}% edge | ${title}: ${side.label} @ ${side.odds.toFixed(2)}`);
        }
      }
    }
    if (mkt?.odds && typeof mkt.odds === 'object') {
      const title = mkt?.title || key;
      const probs = (mkt?.probs ?? null) as Record<string, number> | null;
      const entries = Object.entries(mkt.odds)
        .map(([k, o]) => ({ key: k, label: k === 'home' ? 'Home' : k === 'away' ? 'Away' : k, odds: Number(o) }))
        .filter((e) => e.odds > 1);
      if (entries.length < 2) continue;
      let items: { label: string; odds: number; implied: number; fair: number; edge: number }[];
      let overround: number;
      if (probs) {
        items = entries.map((e) => {
          const fair = (probs[e.key] ?? 0) * 100;
          const implied = (1 / e.odds) * 100;
          return { label: e.label, odds: e.odds, implied, fair, edge: fair - implied };
        });
        overround = 0;
      } else {
        const d = devigItems(entries.map((e) => ({ label: e.label, odds: e.odds })));
        items = d.items;
        overround = d.overround;
      }
      marketsStr.push(`${title}: ${items.map((i) => `${i.label} @ ${i.odds.toFixed(2)} (implied ${i.implied.toFixed(1)}%, real ${i.fair.toFixed(1)}%, edge ${i.edge >= 0 ? '+' : ''}${i.edge.toFixed(1)}%)`).join(' | ')}` + (overround ? ` | Bookies Profit Cut ${overround.toFixed(1)}%` : ''));
      for (const i of items) {
        if (isTopValueCandidate(i.odds)) topValue.push(`${i.edge >= 0 ? '+' : ''}${i.edge.toFixed(1)}% edge | ${title}: ${i.label} @ ${i.odds.toFixed(2)}`);
      }
    }
  }
  const seen = new Set<string>();
  const ranked: string[] = [];
  for (const t of topValue) {
    const key = t.split('@')[0].trim();
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(t);
  }
  ranked.sort((x, y) => {
    const ex = Number((x.match(/^([+-][\d.]+)%/) ?? [])[1]) || 0;
    const ey = Number((y.match(/^([+-][\d.]+)%/) ?? [])[1]) || 0;
    return ey - ex;
  });
  return { lines, markets: marketsStr, topValue: ranked.slice(0, 6) };
}

function fixture(home: string, away: string, oddsText: string, sport: 'basketball' | 'football'): ScrapeMatch {
  return {
    source: 'theoddsapi',
    sourceUrl: 'https://api.the-odds-api.com/v4/sports/odds',
    league: sport === 'basketball' ? 'NBA' : 'Premier League',
    homeTeam: home,
    awayTeam: away,
    startTime: Date.now() + 5 * 3600 * 1000,
    markets: ['h2h', 'totals', 'spreads'],
    oddsText
  };
}

describe('predictor prompt — TOP VALUE odds band', () => {
  it('band is 1.20–3.00 inclusive', () => {
    expect(TOP_VALUE_ODDS_BAND.min).toBe(1.2);
    expect(TOP_VALUE_ODDS_BAND.max).toBe(3.0);
  });

  it('excludes near-certainty noise below 1.20', () => {
    expect(isTopValueCandidate(1.01)).toBe(false); // derived ladder tail
    expect(isTopValueCandidate(1.11)).toBe(false); // over 204.5 @ 1.11 style
    expect(isTopValueCandidate(1.15)).toBe(false);
    expect(isTopValueCandidate(1.19)).toBe(false);
  });

  it('includes the fair-value zone within the band', () => {
    expect(isTopValueCandidate(1.2)).toBe(true); // inclusive lower bound
    expect(isTopValueCandidate(1.5)).toBe(true);
    expect(isTopValueCandidate(1.9)).toBe(true);
    expect(isTopValueCandidate(2.5)).toBe(true);
    expect(isTopValueCandidate(3.0)).toBe(true); // inclusive upper bound
  });

  it('excludes extreme long shots above 3.00', () => {
    expect(isTopValueCandidate(3.05)).toBe(false);
    expect(isTopValueCandidate(6.66)).toBe(false); // old top-value leader
    expect(isTopValueCandidate(18.35)).toBe(false); // old top-value leader
  });
});

describe('predictor engine — certainty-side exclusion', () => {
  it('basketball: Safest/All-Markets tops and headline never pick a 1.01 side', () => {
    // Balanced home favourite: derived ladders include deep certainty tails
    // (spread +11.5 @ ~1.01-1.11) that a pure probability ranking puts on top.
    const norm = normalizeMatch(fixture('Boston Celtics', 'LA Lakers', 'h2h=1.75,2.10 totals=220.5:1.9/1.9 spread=-4.5:1.9,1.9', 'basketball'), 'basketball');
    const analysis = analyzeBasketball(norm.scope as unknown as ScopeState);

    const profA = analysis.profiles.find((p) => p.key === 'A');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    expect(profA?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    // Headline never cites a certainty side.
    expect(analysis.headline).not.toMatch(/@ 9[0-9]\.\d%/);
    expect(analysis.headline).not.toMatch(/1\.01/);
  });

  it('basketball lopsided: heavy favourite still avoids the 1.01 spread tails', () => {
    const norm = normalizeMatch(fixture('Boston Celtics', 'Detroit Pistons', 'h2h=1.28,3.80 totals=219.5:1.85/1.95 spread=-9.5:1.9,1.9', 'basketball'), 'basketball');
    const analysis = analyzeBasketball(norm.scope as unknown as ScopeState);

    const profA = analysis.profiles.find((p) => p.key === 'A');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    expect(profA?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(analysis.headline).not.toMatch(/@ 9[0-9]\.\d%/);
  });

  it('football: Safest/All-Markets tops avoid Over 0.5 / Under 4.5 @ 1.02 noise', () => {
    const norm = normalizeMatch(fixture('Arsenal', 'Chelsea', 'h2h=2.10,3.40,3.60 totals=2.5:1.85/1.95', 'football'), 'football');
    const analysis = analyzeFootball(norm.scope as unknown as ScopeState);

    const profA = analysis.profiles.find((p) => p.key === 'A');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    expect(profA?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
  });

  it('football lopsided: best-value moneyline stays, All-Markets top is bettable', () => {
    const norm = normalizeMatch(fixture('Manchester City', 'Luton Town', 'h2h=1.22,7.50,13.00 totals=3.5:1.90/1.90', 'football'), 'football');
    const analysis = analyzeFootball(norm.scope as unknown as ScopeState);

    const profB = analysis.profiles.find((p) => p.key === 'B');
    const profD = analysis.profiles.find((p) => p.key === 'D');
    // Best-value keeps the real moneyline (1.22) — it's a real price, not noise.
    expect(profB?.top?.label).toContain('Home Win');
    expect(profD?.top?.odds ?? 0).toBeGreaterThan(CERTAINTY_ODDS);
  });

  it('football prompt text: new lead markets present, top-value section has no long shots', () => {
    const norm = normalizeMatch(fixture('Arsenal', 'Chelsea', 'h2h=2.10,3.40,3.60 totals=2.5:1.85/1.95', 'football'), 'football');
    const scope = norm.scope as unknown as ScopeState;
    const s = summarizeScope(scope);
    const prompt = `MARKET / ODDS DATA:\n${s.markets.join('\n  ')}\n${s.lines.join('\n  ')}\n\nTOP VALUE OPPORTUNITIES:\n  ${s.topValue.join('\n  ')}`;

    // Every new lead/momentum market reaches the LLM prompt.
    expect(prompt).toContain('Team One Goal Up (1UP)');
    expect(prompt).toContain('Team Two Goal Up (2UP)');
    expect(prompt).toContain('Team Never Down');
    expect(prompt).toContain('Double Chance 1UP');
    // The top-value section contains only bettable odds (band 1.20–3.00).
    expect(s.topValue.length).toBeGreaterThan(0);
    for (const t of s.topValue) {
      const odds = Number((t.match(/@ ([\d.]+)$/) ?? [])[1]);
      expect(odds).toBeGreaterThanOrEqual(TOP_VALUE_ODDS_BAND.min);
      expect(odds).toBeLessThanOrEqual(TOP_VALUE_ODDS_BAND.max);
    }
    // The engine also ranks picks from the new markets.
    const analysis = analyzeFootball(scope);
    for (const mid of ['oneGoalUp', 'twoGoalUp', 'neverDown', 'doubleChanceUp']) {
      expect(analysis.picks.some((p) => p.marketId === mid)).toBe(true);
    }
  });
});
