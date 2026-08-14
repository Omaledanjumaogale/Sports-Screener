// Normalization stage (Chinedu Eze). Turns raw scraped fixtures + odds text into
// engine-compatible ScopeState objects the client's `analyzeScope` can consume.
// No analysis logic is duplicated here — this only shapes data.
//
// Every scope is built from the REAL odds the agents fetched (h2h, totals,
// spreads). For football only, a full set of derived markets is built from the
// real 1X2 + total through a single Poisson goal-grid model (see
// deriveFootballMarkets): Double Chance, an Asian Handicap ladder covering all
// standard lines (-1.5 ... +1.5), an Over/Under goals ladder (0.5-4.5) and Both
// Teams To Score. Derived markets stay clearly flagged (derived:true) and never
// gate the confidence floor on their own. When no real odds exist the scope
// falls back to balanced, clearly-flagged defaults (oddsIsReal:false).

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
  ],
  americanfootball: [
    { line: 42.5, over: 1.9, under: 1.9 },
    { line: 44.5, over: 1.85, under: 1.95 }
  ],
  rugby: [
    { line: 37.5, over: 1.9, under: 1.9 },
    { line: 28.5, over: 1.85, under: 1.95 }
  ],
  cricket: [
    { line: 250.5, over: 1.9, under: 1.9 },
    { line: 320.5, over: 1.85, under: 1.95 }
  ],
  mma: [
    { line: 2.5, over: 1.85, under: 1.95 },
    { line: 3.5, over: 1.8, under: 2.0 }
  ],
  volleyball: [
    { line: 3.5, over: 1.9, under: 1.9 },
    { line: 2.5, over: 1.8, under: 2.0 }
  ]
};

// Sports whose "result" market has no draw leg.
const TWO_WAY_SPORTS = new Set(['basketball', 'tennis', 'rally', 'hockey', 'baseball', 'americanfootball', 'mma', 'volleyball']);

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

// ── Football score-grid probability model ─────────────────────────────────────
// One Poisson goal grid calibrated to the de-vigged 1X2 and the total-goals
// line prices EVERY derived football market (O/U ladder, BTTS, Asian Handicap
// ladder) from a single consistent model - the standard "Poisson calibrated to
// 1X2 + totals" technique used by odds compilers. No hardcoded +0.5 anywhere.

const GRID_MAX_GOALS = 9;

function poissonPmf(lambda: number, k: number): number {
  let term = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) term *= lambda / i;
  return term;
}

export interface FootballScoreGrid {
  p: number[][]; // p[homeGoals][awayGoals], renormalized to sum 1
  lambdaH: number;
  lambdaA: number;
}

// Build the grid. Lambda is split between the two sides by their share of the
// non-draw probability, then both lambdas are scaled by a fixed point so the
// grid's win+loss mass matches the de-vigged 1X2 (draw mass lands where it
// lands).
export function buildFootballGrid(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  totalLine: number
): FootballScoreGrid {
  const [pH, pD, pA] = devig([homeOdds, drawOdds, awayOdds]);
  const nonDraw = Math.max(pH + pA, 1e-6);
  const lambda = Math.max(totalLine, 0.2);
  let lambdaH = (lambda * pH) / nonDraw;
  let lambdaA = (lambda * pA) / nonDraw;

  const regionMasses = (lh: number, la: number) => {
    let w = 0, d = 0, l = 0;
    for (let i = 0; i <= GRID_MAX_GOALS; i++) {
      for (let j = 0; j <= GRID_MAX_GOALS; j++) {
        const prob = poissonPmf(lh, i) * poissonPmf(la, j);
        if (i > j) w += prob;
        else if (i === j) d += prob;
        else l += prob;
      }
    }
    return { w, d, l };
  };

  for (let iter = 0; iter < 30; iter++) {
    const { w, d, l } = regionMasses(lambdaH, lambdaA);
    const totalMass = w + d + l || 1;
    const ratio = (w + l) / totalMass;
    const target = Math.max(pH + pA, 0.05);
    const scale = Math.sqrt(target / Math.max(ratio, 1e-4));
    const drawRatio = Math.pow((d / totalMass) / Math.max(pD, 1e-4), 0.1);
    const k = Math.min(Math.max(scale * drawRatio, 0.5), 2.4);
    lambdaH *= k;
    lambdaA *= k;
    if (Math.abs(k - 1) < 0.002) break;
  }

  const p: number[][] = [];
  let sum = 0;
  for (let i = 0; i <= GRID_MAX_GOALS; i++) {
    p.push([]);
    for (let j = 0; j <= GRID_MAX_GOALS; j++) {
      const prob = poissonPmf(lambdaH, i) * poissonPmf(lambdaA, j);
      p[i].push(prob);
      sum += prob;
    }
  }
  for (let i = 0; i <= GRID_MAX_GOALS; i++) {
    for (let j = 0; j <= GRID_MAX_GOALS; j++) p[i][j] /= sum;
  }
  return { p, lambdaH, lambdaA };
}

export function gridTotals(grid: FootballScoreGrid, line: number): { over: number; under: number } {
  let over = 0;
  for (let i = 0; i <= GRID_MAX_GOALS; i++) {
    for (let j = 0; j <= GRID_MAX_GOALS; j++) {
      if (i + j > line) over += grid.p[i][j];
    }
  }
  return { over, under: Math.max(0, 1 - over) };
}

export function gridBtts(grid: FootballScoreGrid): { yes: number; no: number } {
  let yes = 0;
  for (let i = 1; i <= GRID_MAX_GOALS; i++) {
    for (let j = 1; j <= GRID_MAX_GOALS; j++) yes += grid.p[i][j];
  }
  return { yes, no: Math.max(0, 1 - yes) };
}

// P(a single team scores MORE than `line` goals) from the grid marginals.
// line=0.5 → the team scores at least once; line=1.5 → at least twice.
export function gridTeamOver(grid: FootballScoreGrid, home: boolean, line: number): number {
  let over = 0;
  for (let i = 0; i <= GRID_MAX_GOALS; i++) {
    for (let j = 0; j <= GRID_MAX_GOALS; j++) {
      const goals = home ? i : j;
      if (goals > line) over += grid.p[i][j];
    }
  }
  return Math.max(0, Math.min(1, over));
}

// Empirical share of goals scored in the FIRST half (the remainder lands in the
// second half). Used to split each team's full-time Poisson lambda into two
// independent half-time Poissons so the 1H/2H totals are derived, not guessed.
export const FIRST_HALF_GOAL_SHARE = 0.45;

// P(half total goals > line) from a Poisson(lambda) split of the match lambda.
export function halfTotalOver(grid: FootballScoreGrid, half: 'first' | 'second', line: number): number {
  const share = half === 'first' ? FIRST_HALF_GOAL_SHARE : 1 - FIRST_HALF_GOAL_SHARE;
  const lambda = Math.max(0.01, (grid.lambdaH + grid.lambdaA) * share);
  let cdf = 0;
  for (let k = 0; k <= Math.floor(line); k++) cdf += poissonPmf(lambda, k);
  return Math.max(0, Math.min(1, 1 - cdf));
}

// P(home covers handicap line L) using grid-derived one-goal margin masses
// blended with the de-vigged 1X2 (whole/half lines win, quarter lines split
// the stake - pushes refund and do not change the win probability).
export function homeCoversProbability(
  grid: FootballScoreGrid,
  fair: number[],
  line: number
): number {
  const [pH, , pA] = fair;
  // P(home wins by exactly 1) and P(away wins by exactly 1) from the grid,
  // rescaled so the region totals agree with the de-vigged 1X2.
  let w1 = 0, l1 = 0, w = 0, l = 0;
  for (let i = 0; i <= GRID_MAX_GOALS; i++) {
    for (let j = 0; j <= GRID_MAX_GOALS; j++) {
      const prob = grid.p[i][j];
      if (i === j + 1) w1 += prob;
      if (j === i + 1) l1 += prob;
      if (i > j) w += prob;
      else if (i < j) l += prob;
    }
  }
  const pH1 = (w > 0 ? (w1 / w) * pH : 0);
  const pA1 = (l > 0 ? (l1 / l) * pA : 0);
  const pD = 1 - pH - pA;

  switch (line) {
    case -1.5: case -1.25: case -1:
      return Math.max(0, pH - pH1);            // needs a 2+ goal win
    case -0.75:
      return Math.max(0, pH - 0.5 * pH1);      // half -0.5 / half -1
    case -0.5: case -0.25: case 0:
      return pH;                                // wins on any home win
    case 0.25:
      return pH + 0.5 * pD;                     // half 0 / half +0.5
    case 0.5:
      return pH + pD;                           // wins on win or draw
    case 0.75:
      return pH + pD + 0.5 * pA1;               // half +0.5 / half +1
    case 1: case 1.25: case 1.5:
      return Math.min(1, pH + pD + pA1);        // covered unless 2+ goal loss
    default:
      return pH;
  }
}

// All standard Asian Handicap lines, quarter-goal steps.
export const FOOTBALL_AH_LINES = [-1.5, -1.25, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5];

// Soccer Over/Under goal lines.
export const FOOTBALL_TOTAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5];

// Team total (home/away) lines and half total lines, all derived from the grid.
export const FOOTBALL_TEAM_TOTAL_LINES = [0.5, 1.5];
export const FOOTBALL_HALF_TOTAL_LINES = [0.5, 1.5];

// Full football derived market set from the real 1X2 + a total anchor line:
// Double Chance, Asian Handicap ladder, O/U goals ladder (0.5-4.5) and BTTS.
// When realTotals is supplied its line/prices become the anchor pair (all other
// lines are still grid-derived); otherwise the whole ladder is grid-derived.
export function deriveFootballMarkets(
  homeOdds: number,
  drawOdds: number,
  awayOdds: number,
  totalAnchorLine = 2.5,
  realTotals?: { line: number; over: number; under: number }
): {
  doubleChance: Market;
  handicap: Market;
  mainTotal: Market;
  btts: Market;
  homeTotal: Market;
  awayTotal: Market;
  firstHalfTotal: Market;
  secondHalfTotal: Market;
} {
  const fair = devig([homeOdds, drawOdds, awayOdds]); // [pH, pD, pA]
  const grid = buildFootballGrid(homeOdds, drawOdds, awayOdds, totalAnchorLine);

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
    handicapPairs: FOOTBALL_AH_LINES.map((line) => {
      const pHome = homeCoversProbability(grid, fair, line);
      const margin = 1.04 + Math.min(Math.abs(line) * 0.01, 0.04);
      return {
        line,
        sideA: marginedPrice(pHome, margin),                     // Home {line}
        sideB: marginedPrice(1 - Math.min(pHome, 0.999), margin) // Away {-line}
      };
    })
  };

  const totals = FOOTBALL_TOTAL_LINES.map((line) => {
    if (realTotals && realTotals.line > 0 && line === realTotals.line) {
      return { line, over: realTotals.over, under: realTotals.under }; // real anchor pair
    }
    const t = gridTotals(grid, line);
    return { line, over: marginedPrice(t.over, 1.05), under: marginedPrice(t.under, 1.05) };
  });

  const mainTotal: Market = {
    id: 'mainTotal',
    kind: 'ou',
    title: 'Match Total',
    // The ladder is grid-derived (a real anchor pair keeps its own prices but
    // the 0.5/1.5/3.5/4.5 siblings are derived) — it must never gate Amara's
    // confidence floor on its own.
    derived: true,
    pairs: totals
  };

  const bttsGrid = gridBtts(grid);
  const btts: Market = {
    id: 'btts',
    kind: 'yesno',
    title: 'Both Teams To Score',
    derived: true,
    odds: {
      yes: marginedPrice(bttsGrid.yes, 1.05),
      no: marginedPrice(bttsGrid.no, 1.05)
    }
  };

  // Team totals — "{Team} Over 0.5 goals" (team scores at least once).
  const teamTotal = (home: boolean): Market => ({
    id: home ? 'homeTotal' : 'awayTotal',
    kind: 'ou',
    title: home ? 'Home Team Total' : 'Away Team Total',
    derived: true,
    pairs: FOOTBALL_TEAM_TOTAL_LINES.map((line) => {
      const over = gridTeamOver(grid, home, line);
      return { line, over: marginedPrice(over, 1.05), under: marginedPrice(1 - over, 1.05) };
    })
  });

  // Half totals — "1st Half Over 0.5 / 2nd Half Over 0.5 goals".
  const halfTotal = (half: 'first' | 'second'): Market => ({
    id: half === 'first' ? 'firstHalfTotal' : 'secondHalfTotal',
    kind: 'ou',
    title: half === 'first' ? 'First Half Total' : 'Second Half Total',
    derived: true,
    pairs: FOOTBALL_HALF_TOTAL_LINES.map((line) => {
      const over = halfTotalOver(grid, half, line);
      return { line, over: marginedPrice(over, 1.05), under: marginedPrice(1 - over, 1.05) };
    })
  });

  const homeTotal = teamTotal(true);
  const awayTotal = teamTotal(false);
  const firstHalfTotal = halfTotal('first');
  const secondHalfTotal = halfTotal('second');

  return { doubleChance, handicap, mainTotal, btts, homeTotal, awayTotal, firstHalfTotal, secondHalfTotal };
}

// ── Basketball points probability model ───────────────────────────────────────
// Basketball is a high-scoring POINTS sport (100-260 pts), so its derived
// markets use a Normal points model calibrated to the real moneyline + the real
// total anchor line — NOT the football Poisson goal grid:
//   • expected margin from the moneyline  (margin = Φ⁻¹(P_home) × σ_margin)
//   • expected total from the anchor line  (expTotal = book total)
//   • exp_home = (expTotal + margin)/2, exp_away = (expTotal - margin)/2
// Every derived market (team totals, half totals, 1st-half team totals, spread
// ladder) is priced from this single consistent model with real de-vigged
// prices, flagged derived:true — the same approach as football's grid.

// Empirical basketball calibration constants (NBA-calibrated):
//   • point-margin SD ≈ 12 pts, single-team scoring SD ≈ 11 pts,
//   • game-total SD ≈ 15 pts (≈ √2 × team SD),
//   • ~48.5% of points land in the 1st half.
export const BASKETBALL_SD_MARGIN = 12;
export const BASKETBALL_SD_TEAM = 11;
export const BASKETBALL_SD_TOTAL = 15;
export const BASKETBALL_FIRST_HALF_SHARE = 0.485;

// Standard-normal CDF (Abramowitz & Stegun 26.2.17).
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  let p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (z > 0) p = 1 - p;
  return Math.max(0, Math.min(1, p));
}

// Standard-normal inverse CDF (Acklam's rational approximation).
function normalInv(p: number): number {
  if (p <= 0) return -6;
  if (p >= 1) return 6;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104464687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  let q: number, r: number;
  if (p < plow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - plow) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
}

export interface BasketballModel {
  expTotal: number;
  expHome: number;
  expAway: number;
  margin: number; // expected home - away margin
}

// Calibrate the Normal points model to the real 2-way moneyline + total anchor.
export function buildBasketballModel(homeOdds: number, awayOdds: number, totalAnchorLine: number): BasketballModel {
  const [pH] = devig([homeOdds, awayOdds]);
  const margin = normalInv(Math.min(Math.max(pH, 1e-6), 1 - 1e-6)) * BASKETBALL_SD_MARGIN;
  const expTotal = Math.max(totalAnchorLine, 100);
  return {
    expTotal,
    expHome: (expTotal + margin) / 2,
    expAway: (expTotal - margin) / 2,
    margin
  };
}

// P(a team scores MORE than `line` points).
export function basketballTeamOver(model: BasketballModel, home: boolean, line: number): number {
  const mean = home ? model.expHome : model.expAway;
  return Math.max(0, Math.min(1, 1 - normalCdf((line - mean) / BASKETBALL_SD_TEAM)));
}

// P(game total > line).
export function basketballTotalOver(model: BasketballModel, line: number): number {
  return Math.max(0, Math.min(1, 1 - normalCdf((line - model.expTotal) / BASKETBALL_SD_TOTAL)));
}

// P(half total > line) — split the total by the empirical 1st-half share, with
// the SD scaled by √share so the half distribution stays consistent.
export function basketballHalfTotalOver(model: BasketballModel, half: 'first' | 'second', line: number): number {
  const share = half === 'first' ? BASKETBALL_FIRST_HALF_SHARE : 1 - BASKETBALL_FIRST_HALF_SHARE;
  const mean = model.expTotal * share;
  const sd = BASKETBALL_SD_TOTAL * Math.sqrt(share);
  return Math.max(0, Math.min(1, 1 - normalCdf((line - mean) / sd)));
}

// P(a team scores more than `line` points in one half).
export function basketballHalfTeamOver(model: BasketballModel, half: 'first' | 'second', home: boolean, line: number): number {
  const share = half === 'first' ? BASKETBALL_FIRST_HALF_SHARE : 1 - BASKETBALL_FIRST_HALF_SHARE;
  const mean = (home ? model.expHome : model.expAway) * share;
  const sd = BASKETBALL_SD_TEAM * Math.sqrt(share);
  return Math.max(0, Math.min(1, 1 - normalCdf((line - mean) / sd)));
}

// P(home covers the spread line L) = P(home margin + L > 0) = P(margin > -L).
// Line L is the HOME handicap (same convention as the football AH ladder):
// L = -4.5 → home gives 4.5 (covers by winning by 5+), L = +4.5 → home
// receives 4.5 (covers on any win or a loss by 4 or fewer).
export function basketballHomeCovers(model: BasketballModel, line: number): number {
  return Math.max(0, Math.min(1, 1 - normalCdf((-line - model.margin) / BASKETBALL_SD_MARGIN)));
}

function roundHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

// Line ladders for the derived basketball markets.
export const BASKETBALL_TOTAL_OFFSETS = [-16, -12, -8, -4, 0, 4, 8, 12, 16];
export const BASKETBALL_TEAM_TOTAL_OFFSETS = [-8, -4, 0, 4, 8];
export const BASKETBALL_HALF_TOTAL_OFFSETS = [-6, -3, 0, 3, 6];
export const BASKETBALL_HALF_TEAM_OFFSETS = [-4, -2, 0, 2, 4];
export const BASKETBALL_SPREAD_LINES = [-12.5, -10.5, -8.5, -6.5, -4.5, -2.5, -0.5, 1.5, 3.5, 5.5, 7.5, 9.5, 11.5];

// Full basketball derived market set from the real 2-way moneyline + total
// anchor (+ optional real spread pair): game total ladder, home/away team
// totals, 1st/2nd half totals, 1st-half team totals and the spread ladder.
// When realTotals/realSpread are supplied their own pairs keep real prices;
// all other lines are derived from the same Normal model.
export function deriveBasketballMarkets(
  homeOdds: number,
  awayOdds: number,
  totalAnchorLine = 214.5,
  realTotals?: { line: number; over: number; under: number },
  realSpread?: { point: number; home: number; away: number }
): {
  mainTotal: Market;
  homeTotal: Market;
  awayTotal: Market;
  firstHalfTotal: Market;
  secondHalfTotal: Market;
  firstHalfHomeTotal: Market;
  firstHalfAwayTotal: Market;
  handicap: Market;
} {
  const model = buildBasketballModel(homeOdds, awayOdds, totalAnchorLine);

  const totalLadder = BASKETBALL_TOTAL_OFFSETS.map((off) => {
    const line = roundHalf(model.expTotal + off);
    const over = basketballTotalOver(model, line);
    return { line, over: marginedPrice(over, 1.05), under: marginedPrice(1 - over, 1.05) };
  });
  if (realTotals && realTotals.line > 0) {
    const existing = totalLadder.findIndex((p) => Math.abs(p.line - realTotals.line) < 0.01);
    if (existing >= 0) totalLadder[existing] = { line: realTotals.line, over: realTotals.over, under: realTotals.under };
    else totalLadder.push({ line: realTotals.line, over: realTotals.over, under: realTotals.under });
    totalLadder.sort((a, b) => a.line - b.line);
  }

  const teamTotal = (home: boolean): Market => ({
    id: home ? 'homeTotal' : 'awayTotal',
    kind: 'ou',
    title: home ? 'Home Team Total Points' : 'Away Team Total Points',
    derived: true,
    pairs: BASKETBALL_TEAM_TOTAL_OFFSETS.map((off) => {
      const line = roundHalf((home ? model.expHome : model.expAway) + off);
      const over = basketballTeamOver(model, home, line);
      return { line, over: marginedPrice(over, 1.05), under: marginedPrice(1 - over, 1.05) };
    })
  });

  const halfTotal = (half: 'first' | 'second'): Market => ({
    id: half === 'first' ? 'firstHalfTotal' : 'secondHalfTotal',
    kind: 'ou',
    title: half === 'first' ? 'First Half Total Points' : 'Second Half Total Points',
    derived: true,
    pairs: BASKETBALL_HALF_TOTAL_OFFSETS.map((off) => {
      const line = roundHalf(model.expTotal * (half === 'first' ? BASKETBALL_FIRST_HALF_SHARE : 1 - BASKETBALL_FIRST_HALF_SHARE) + off);
      const over = basketballHalfTotalOver(model, half, line);
      return { line, over: marginedPrice(over, 1.05), under: marginedPrice(1 - over, 1.05) };
    })
  });

  const halfTeam = (home: boolean): Market => ({
    id: home ? 'firstHalfHomeTotal' : 'firstHalfAwayTotal',
    kind: 'ou',
    title: home ? 'Home Team 1st Half Total' : 'Away Team 1st Half Total',
    derived: true,
    pairs: BASKETBALL_HALF_TEAM_OFFSETS.map((off) => {
      const line = roundHalf((home ? model.expHome : model.expAway) * BASKETBALL_FIRST_HALF_SHARE + off);
      const over = basketballHalfTeamOver(model, 'first', home, line);
      return { line, over: marginedPrice(over, 1.05), under: marginedPrice(1 - over, 1.05) };
    })
  });

  const spreadLadder = BASKETBALL_SPREAD_LINES.map((line) => {
    if (realSpread && Math.abs(line - realSpread.point) < 0.01) {
      return { line: realSpread.point, sideA: realSpread.home, sideB: realSpread.away };
    }
    const covers = basketballHomeCovers(model, line);
    return {
      line,
      sideA: marginedPrice(covers, 1.05),
      sideB: marginedPrice(1 - Math.min(covers, 0.999), 1.05)
    };
  });

  return {
    mainTotal: { id: 'mainTotal', kind: 'ou', title: 'Match Total Points', derived: true, pairs: totalLadder },
    homeTotal: teamTotal(true),
    awayTotal: teamTotal(false),
    firstHalfTotal: halfTotal('first'),
    secondHalfTotal: halfTotal('second'),
    firstHalfHomeTotal: halfTeam(true),
    firstHalfAwayTotal: halfTeam(false),
    handicap: { id: 'handicap', kind: 'handicap', title: 'Spread / Handicap', derived: true, handicapPairs: spreadLadder }
  };
}

// Balanced, realistic fallback odds derived from the team-name hash. The
// favourite/dog gap is deliberately modest and the home/away assignment is a
// single unbiased coin-flip per match - no systematic side bias, so the engine
// and the Great Minds debate recommend the favourite on its merits, not a
// preset.
function uniqueFallbackOdds(m: ScrapeMatch, isTwoWay: boolean): number[] {
  const seed = `${m.homeTeam}|${m.awayTeam}|${m.league}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  hash = Math.abs(hash);

  const homeFav = hash % 2 === 0;
  if (isTwoWay) {
    const favOdds = round2(1.45 + (hash % 6) * 0.05);
    const dogOdds = round2(2.10 + (hash % 9) * 0.06);
    return homeFav ? [favOdds, dogOdds] : [dogOdds, favOdds];
  } else {
    const favOdds = round2(1.55 + (hash % 7) * 0.05);
    const drawOdds = round2(3.10 + (hash % 6) * 0.10);
    const dogOdds = round2(2.20 + (hash % 10) * 0.06);
    return homeFav ? [favOdds, drawOdds, dogOdds] : [dogOdds, drawOdds, favOdds];
  }
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
    h2h = uniqueFallbackOdds(m, isTwoWay);
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

  // ── Derived football markets (DC + AH ladder + O/U ladder + BTTS from the
  //    single Poisson grid; a real total anchors its own line when present) ──
  if (sportId === 'football' && h2h.length === 3 && h2h[1]) {
    const { doubleChance, handicap, mainTotal, btts, homeTotal, awayTotal, firstHalfTotal, secondHalfTotal } = deriveFootballMarkets(
      h2h[0],
      h2h[1],
      h2h[2],
      parsed.total && parsed.total.line > 0 ? parsed.total.line : 2.5,
      parsed.total && parsed.total.line > 0 ? parsed.total : undefined
    );
    markets.doubleChance = doubleChance;
    markets.handicap = handicap;
    markets.mainTotal = mainTotal;
    markets.btts = btts;
    markets.homeTotal = homeTotal;
    markets.awayTotal = awayTotal;
    markets.firstHalfTotal = firstHalfTotal;
    markets.secondHalfTotal = secondHalfTotal;
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

  // ── Derived basketball markets (game total ladder + team totals + half
  //    totals + 1st-half team totals + spread ladder from the single Normal
  //    points model; real total/spread pairs stay anchored with real prices) ──
  if (sportId === 'basketball' && h2h.length >= 2 && h2h[1]) {
    const derived = deriveBasketballMarkets(
      h2h[0],
      h2h[1],
      parsed.total && parsed.total.line > 0 ? parsed.total.line : lines[0].line,
      parsed.total && parsed.total.line > 0 ? parsed.total : undefined,
      parsed.spread || undefined
    );
    markets.mainTotal = derived.mainTotal;
    markets.homeTotal = derived.homeTotal;
    markets.awayTotal = derived.awayTotal;
    markets.firstHalfTotal = derived.firstHalfTotal;
    markets.secondHalfTotal = derived.secondHalfTotal;
    markets.firstHalfHomeTotal = derived.firstHalfHomeTotal;
    markets.firstHalfAwayTotal = derived.firstHalfAwayTotal;
    markets.handicap = derived.handicap;
  } else if (isTwoWay && !markets.handicap) {
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

  // ── Total (real line; football/basketball already have derived ladders) ──
  if ((sportId !== 'football' && sportId !== 'basketball') || !markets.mainTotal) {
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
