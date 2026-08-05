// Normalization stage (Chinedu Eze). Turns raw scraped fixtures + odds text into
// engine-compatible ScopeState objects the client's `analyzeScope` can consume.
// No analysis logic is duplicated here — this only shapes data.

import type { ScrapeMatch } from './betwatch';

export interface NormalizedMatch {
  matchId: string;
  sportId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  startTime: number;
  source: string;
  sourceUrl: string;
  markets: string[];
  scope: {
    id: string;
    title: string;
    teamA: string;
    teamB: string;
    leaguePreset: string;
    markets: Record<string, { id: string; kind: string; title: string; pairs?: any[]; handicapPairs?: any[]; odds?: Record<string, number | null> }>;
  };
}

const BASE_LINES: Record<string, { line: number; over: number; under: number }[]> = {
  football: [
    { line: 2.5, over: 1.85, under: 1.95 },
    { line: 1.5, over: 1.4, under: 2.8 }
  ],
  basketball: [
    { line: 220.5, over: 1.9, under: 1.9 },
    { line: 214.5, over: 1.85, under: 1.95 }
  ],
  tennis: [
    { line: 23.5, over: 1.87, under: 1.93 },
    { line: 21.5, over: 1.8, under: 2.0 }
  ],
  rally: [
    { line: 3.5, over: 1.8, under: 2.0 },
    { line: 2.5, over: 1.55, under: 2.4 }
  ],
  hockey: [
    { line: 5.5, over: 1.9, under: 1.9 },
    { line: 4.5, over: 1.8, under: 2.0 }
  ],
  baseball: [
    { line: 8.5, over: 1.9, under: 1.9 },
    { line: 7.5, over: 1.8, under: 2.0 }
  ]
};

function stableId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export interface ParsedOdds {
  h2h?: number[]; // [home, draw, away]
  total?: { line: number; over: number; under: number };
}

// Parse an oddsText blob. Supports the explicit Odds API form
// ("h2h=1.14,7.00,18.00 totals=2.5:1.85/1.95") as well as bare decimal runs
// scraped from registry pages ("1.85, 3.40, 2.10" → 1X2, or "1.85, 2.10" → O/U).
export function parseOddsText(oddsText: string): ParsedOdds {
  const out: ParsedOdds = {};
  const t = String(oddsText || '');
  const h2h = t.match(/h2h=([\d.,\s]+)/i);
  if (h2h) {
    const nums = h2h[1].split(',').map((n) => Number(n.trim())).filter((n) => Number.isFinite(n) && n >= 1.01 && n <= 50);
    if (nums.length >= 2) out.h2h = nums.slice(0, 3);
  }
  const tot = t.match(/totals=([\d.]+):([\d.]+)\/([\d.]+)/i);
  if (tot) {
    const line = Number(tot[1]);
    const over = Number(tot[2]);
    const under = Number(tot[3]);
    if ([line, over, under].every((n) => Number.isFinite(n) && n > 0)) out.total = { line, over, under };
  }
  if (!out.h2h && !out.total) {
    const nums = t.split(/[,;]/).map((s) => Number(s.replace(/[^\d.]/g, ''))).filter((n) => Number.isFinite(n) && n >= 1.01 && n <= 50);
    if (nums.length >= 3) out.h2h = nums.slice(0, 3);
    else if (nums.length === 2) out.total = { line: 0, over: nums[0], under: nums[1] };
  }
  return out;
}

// Deterministic market odds derived from the fixture seed so cached scopes are
// stable across refreshes even before a live odds scrape succeeds.
export function normalizeMatch(m: ScrapeMatch, sportId: string): NormalizedMatch {
  const lines = BASE_LINES[sportId] ?? BASE_LINES.football;
  const id = stableId(`${m.homeTeam}|${m.awayTeam}|${m.league}`);

  const parsed = parseOddsText(m.oddsText ?? '');

  const pairs = lines.map((l) => ({ line: l.line, over: l.over, under: l.under }));
  if (parsed.total && parsed.total.line > 0) {
    pairs[0] = { line: parsed.total.line, over: parsed.total.over, under: parsed.total.under };
  } else if (parsed.total && parsed.total.line === 0) {
    pairs[0] = { ...pairs[0], over: parsed.total.over, under: parsed.total.under };
  }

  const resultOdds: Record<string, number | null> = parsed.h2h
    ? { home: parsed.h2h[0], draw: parsed.h2h[1] ?? null, away: parsed.h2h[2] ?? null }
    : { home: 1.85, draw: 3.4, away: 2.1 };

  const mainTotal = {
    id: 'mainTotal',
    kind: 'lines',
    title: 'Match Total',
    pairs
  };

  const result = {
    id: 'result',
    kind: 'result',
    title: 'Result',
    odds: resultOdds
  };

  const scope: NormalizedMatch['scope'] = {
    id,
    title: `${m.homeTeam} vs ${m.awayTeam}`,
    teamA: m.homeTeam,
    teamB: m.awayTeam,
    leaguePreset: m.league,
    markets: { mainTotal, result }
  };

  return {
    matchId: id,
    sportId,
    league: m.league,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    startTime: m.startTime,
    source: m.source,
    sourceUrl: m.sourceUrl,
    markets: m.markets ?? ['mainTotal', 'result'],
    scope
  };
}

export function normalizeMatches(raw: ScrapeMatch[], sportId: string): NormalizedMatch[] {
  return raw.map((m) => normalizeMatch(m, sportId));
}
