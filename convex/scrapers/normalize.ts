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

// Deterministic market odds derived from the fixture seed so cached scopes are
// stable across refreshes even before a live odds scrape succeeds.
export function normalizeMatch(m: ScrapeMatch, sportId: string): NormalizedMatch {
  const lines = BASE_LINES[sportId] ?? BASE_LINES.football;
  const id = stableId(`${m.homeTeam}|${m.awayTeam}|${m.league}`);

  const mainTotal = {
    id: 'mainTotal',
    kind: 'lines',
    title: 'Match Total',
    pairs: lines.map((l) => ({ line: l.line, over: l.over, under: l.under }))
  };

  const result = {
    id: 'result',
    kind: 'result',
    title: 'Result',
    odds: { home: 1.85, draw: 3.4, away: 2.1 }
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
