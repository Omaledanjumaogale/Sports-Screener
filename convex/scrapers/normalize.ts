// Normalization stage (Chinedu Eze). Turns raw scraped fixtures + odds text into
// engine-compatible ScopeState objects the client's `analyzeScope` can consume.
// No analysis logic is duplicated here — this only shapes data.
//
// Every scope is built from the REAL odds the agents fetched (h2h, totals,
// spreads). For football only, Double Chance and an Asian Handicap line are
// derived from the real 1X2 via the Shutov method so each match carries the
// market options the copilot-style engine expects. When no real odds exist the
// scope falls back to clearly-flagged defaults (oddsIsReal:false).

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
    markets: Record<string, Market>;
    _meta?: { oddsIsReal: boolean; live: boolean };
  };
}

export interface Market {
  id: string;
  kind: string;
  title: string;
  pairs?: { line: number; over: number; under: number }[];
  handicapPairs?: { line: number; sideA: number; sideB: number }[];
  odds?: Record<string, number | null>;
  // True when the prices are DERIVED from another market (Double Chance / Asian
  // Handicap from the 1X2) rather than quoted live. Derived markets stay fully
  // available for analysis but never gate the confidence floor.
  derived?: boolean;
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

// Sports whose "result" market has no draw leg.
const TWO_WAY_SPORTS = new Set(['basketball', 'tennis', 'rally', 'hockey', 'baseball']);

function stableId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function validOdds(n: number): boolean {
  return Number.isFinite(n) && n >= 1.01 && n <= 50;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface ParsedOdds {
  h2h?: number[]; // [home, away] 2-way or [home, draw, away] 1X2
  total?: { line: number; over: number; under: number };
  spread?: { point: number; home: number; away: number };
  live?: boolean;
}

// Parse an oddsText blob. Supports the explicit forms the Odds API emits
// ("h2h=1.14,7.00,18.00 totals=2.5:1.85/1.95 spread=1.5:1.90,1.90 live=1")
// as well as bare decimal runs scraped from registry pages.
export function parseOddsText(oddsText: string): ParsedOdds {
  const out: ParsedOdds = {};
  const t = String(oddsText || '');
  const h2h = t.match(/h2h=([\d.,\s]+)/i);
  if (h2h) {
    const nums = h2h[1].split(',').map((n) => Number(n.trim())).filter(validOdds);
    if (nums.length >= 2) out.h2h = nums.slice(0, 3);
  }
  const tot = t.match(/totals=([\d.]+):([\d.]+)\/([\d.]+)/i);
  if (tot) {
    const line = Number(tot[1]);
    const over = Number(tot[2]);
    const under = Number(tot[3]);
    if ([line, over, under].every((n) => Number.isFinite(n) && n > 0)) out.total = { line, over, under };
  }
  const sp = t.match(/spread=(-?[\d.]+):([\d.]+),([\d.]+)/i);
  if (sp) {
    const point = Number(sp[1]);
    const home = Number(sp[2]);
    const away = Number(sp[3]);
    if (Number.isFinite(point) && validOdds(home) && validOdds(away)) out.spread = { point, home, away };
  }
  if (/live=1/i.test(t)) out.live = true;
  if (!out.h2h && !out.total && !out.spread) {
    const nums = t.split(/[,;]/).map((s) => Number(s.replace(/[^\d.-]/g, ''))).filter(validOdds);
    if (nums.length >= 3) out.h2h = nums.slice(0, 3);
    else if (nums.length === 2) out.total = { line: 0, over: nums[0], under: nums[1] };
  }
  return out;
}

// De-vig implied probabilities from decimal odds (sum of inverse probs = 1).
// Returns shares in [0,1]. This is the canonical probability model shared by the
// pipeline gate (Amara) and the client engine, so the cached set and the set the
// UI qualifies never disagree.
export function devig(odds: number[]): number[] {
  const inv = odds.map((o) => 1 / o);
  const s = inv.reduce((a, b) => a + b, 0) || 1;
  return inv.map((i) => i / s);
}

// De-vig probabilities in percent for a two-outcome pair (totals / spread).
export function devigPair(a: number, b: number): { aPct: number; bPct: number } {
  const [pa, pb] = devig([a, b]);
  return { aPct: pa * 100, bPct: pb * 100 };
}

// Realistic de-vigged confidence floor. Real bookmaker prices carry margin, so a
// balanced favourite (e.g. ~1.5–1.7 1X2) de-vigs far below 60% — the old raw
// 1/odds gate silently excluded every realistic match. Gating on de-vigged
// probability at this level surfaces real favourites, totals and spreads for BOTH
// major and minor leagues while still dropping true coin-flips.
export const FILTER_CONFIDENCE_FLOOR = 52;

// Bookie-style price for a fair probability with a margin applied.
function marginedPrice(fairProb: number, margin: number): number {
  if (!Number.isFinite(fairProb) || fairProb <= 0) return 0;
  return round2(Math.max(1.01, 1 / (fairProb * margin)));
}

// Double Chance + Asian Handicap derived from the real 1X2 odds (Shutov method).
// DC = the three two-outcome combinations of the de-vigged 1X2. AH -0.5/+0.5:
// home -0.5 wins on a home win only; away +0.5 wins on a draw or an away win.
function deriveFootballMarkets(homeOdds: number, drawOdds: number, awayOdds: number): {
  doubleChance: Market;
  handicap: Market;
} {
  const fair = devig([homeOdds, drawOdds, awayOdds]); // [pH, pD, pA]

  const doubleChance: Market = {
    id: 'doubleChance',
    kind: 'threeway',
    title: 'Double Chance',
    derived: true,
    odds: {
      hd: marginedPrice(fair[0] + fair[1], 1.04), // Home or Draw
      ha: marginedPrice(fair[0] + fair[2], 1.04), // Home or Away
      da: marginedPrice(fair[1] + fair[2], 1.04)  // Draw or Away
    }
  };

  const handicap: Market = {
    id: 'handicap',
    kind: 'handicap',
    title: 'Asian Handicap',
    derived: true,
    handicapPairs: [
      {
        line: -0.5,
        sideA: marginedPrice(fair[0], 1.05), // Home -0.5 wins on a home win
        sideB: marginedPrice(fair[1] + fair[2], 1.05) // Away +0.5 wins on draw or away win
      }
    ]
  };

  return { doubleChance, handicap };
}

export function normalizeMatch(m: ScrapeMatch, sportId: string): NormalizedMatch {
  const lines = BASE_LINES[sportId] ?? BASE_LINES.football;
  const id = stableId(`${m.homeTeam}|${m.awayTeam}|${m.league}`);

  const parsed = parseOddsText(m.oddsText ?? '');
  const isTwoWay = TWO_WAY_SPORTS.has(sportId);
  const hasReal = !!(parsed.h2h || parsed.total || parsed.spread);

  const markets: Record<string, Market> = {};

  // ── Result / Winner (real 1X2 or moneyline) ────────────────────────────────
  let h2h = parsed.h2h;
  if (!h2h) {
    h2h = isTwoWay ? [1.9, 1.9] : [1.85, 3.4, 2.1];
  }
  if (isTwoWay && h2h.length === 3) h2h = [h2h[0], h2h[2]]; // drop any stray draw leg

  if (sportId === 'football') {
    markets.result = {
      id: 'result',
      kind: 'threeway',
      title: 'Result',
      odds: { home: h2h[0], draw: h2h[1] ?? null, away: h2h[2] ?? null }
    };
  } else {
    markets.winner = {
      id: 'winner',
      kind: 'winner',
      title: 'Match Winner',
      odds: { a: h2h[0], b: h2h[1] }
    };
    if (sportId === 'hockey' || sportId === 'baseball') {
      markets.regResult = {
        id: 'regResult',
        kind: 'threeway',
        title: 'Result (Regulation)',
        odds: { home: h2h[0], draw: null, away: h2h[1] }
      };
    }
  }

  // ── Double Chance + Asian Handicap (football only, derived from real 1X2) ──
  if (sportId === 'football' && h2h.length === 3 && h2h[1]) {
    const { doubleChance, handicap } = deriveFootballMarkets(h2h[0], h2h[1], h2h[2]);
    markets.doubleChance = doubleChance;
    markets.handicap = handicap;
  } else if (!isTwoWay) {
    // football without a draw leg: still give a pick handicap from the 1X2.
    markets.handicap = {
      id: 'handicap',
      kind: 'handicap',
      title: 'Asian Handicap',
      derived: true,
      handicapPairs: [{ line: -0.5, sideA: h2h[0], sideB: h2h[1] }]
    };
  }

  // ── Handicap / Spread (real from The Odds API for the other sports) ────────
  if (isTwoWay && !markets.handicap) {
    if (parsed.spread) {
      markets.handicap = {
        id: 'handicap',
        kind: 'handicap',
        title: 'Spread / Handicap',
        handicapPairs: [{ line: parsed.spread.point, sideA: parsed.spread.home, sideB: parsed.spread.away }]
      };
    } else {
      // No real spread mapped — expose the moneyline as a pick-'em line so the
      // engine's handicap profile still renders (odds are still the real ones).
      markets.handicap = {
        id: 'handicap',
        kind: 'handicap',
        title: 'Spread / Handicap',
        derived: true,
        handicapPairs: [{ line: 0, sideA: h2h[0], sideB: h2h[1] }]
      };
    }
  }

  // ── Total (real line) ──────────────────────────────────────────────────────
  const pair = parsed.total && parsed.total.line > 0
    ? { line: parsed.total.line, over: parsed.total.over, under: parsed.total.under }
    : parsed.total && parsed.total.line === 0
      ? { ...lines[0], over: parsed.total.over, under: parsed.total.under }
      : lines[0];
  const totalMarket: Market = {
    id: 'mainTotal',
    kind: 'ou',
    title: 'Match Total',
    pairs: [pair]
  };
  markets.mainTotal = totalMarket;
  if (sportId === 'hockey' || sportId === 'baseball') {
    markets.gameTotal = { ...totalMarket, id: 'gameTotal', title: 'Game Total' };
  }

  const scope: NormalizedMatch['scope'] = {
    id,
    title: `${m.homeTeam} vs ${m.awayTeam}`,
    teamA: m.homeTeam,
    teamB: m.awayTeam,
    leaguePreset: m.league,
    markets,
    _meta: { oddsIsReal: hasReal, live: parsed.live === true }
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
    markets: Object.keys(markets),
    scope
  };
}

export function normalizeMatches(raw: ScrapeMatch[], sportId: string): NormalizedMatch[] {
  return raw.map((m) => normalizeMatch(m, sportId));
}
