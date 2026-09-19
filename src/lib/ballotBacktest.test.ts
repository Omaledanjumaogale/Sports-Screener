import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFootballGrid,
  fitTwoTargetGrid,
  gridTotals,
  gridTeamLeadUp,
  gridTeamNeverDown,
  devig
} from '../../convex/scrapers/normalize';
import type { FootballScoreGrid } from '../../convex/scrapers/normalize';

// Real historical results from football-data.co.uk: 4 leagues × 6 seasons
// (2018/19-2023/24). Each row has the full-time score, the HALF-TIME score
// (the only real goal-order signal) and pre-match bookmaker odds — AvgH/AvgD/
// AvgA (1X2) and Avg>2.5 / Avg<2.5 (totals market).
interface Row {
  league: string;
  fthg: number;
  ftag: number;
  hthg: number;
  htag: number;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  overOdds: number;
  underOdds: number;
}

const LEAGUES: Record<string, string> = { E0: 'EPL', SP1: 'La Liga', I1: 'Serie A', D1: 'Bundesliga' };

function loadRows(): Row[] {
  const rows: Row[] = [];
  for (const [code, name] of Object.entries(LEAGUES)) {
    for (let y = 18; y <= 23; y++) {
      const s = `${y}${String(y + 1).padStart(2, '0')}`;
      let text: string;
      try {
        text = readFileSync(`tmp/bt/${code}_${s}.csv`, 'utf8');
      } catch {
        continue;
      }
      const lines = text.split(/\r?\n/);
      const headers = lines[0].split(',');
      const idx = (h: string) => headers.indexOf(h);
      const iFTHG = idx('FTHG'), iFTAG = idx('FTAG'), iHTHG = idx('HTHG'), iHTAG = idx('HTAG');
      const iH = idx('AvgH'), iD = idx('AvgD'), iA = idx('AvgA'), iO = idx('Avg>2.5'), iU = idx('Avg<2.5');
      for (let i = 1; i < lines.length; i++) {
        const c = lines[i].split(',');
        const homeOdds = Number(c[iH]);
        const drawOdds = Number(c[iD]);
        const awayOdds = Number(c[iA]);
        const overOdds = Number(c[iO]);
        const underOdds = Number(c[iU]);
        const fthg = Number(c[iFTHG]);
        const ftag = Number(c[iFTAG]);
        if (![homeOdds, drawOdds, awayOdds, overOdds, underOdds].every((n) => Number.isFinite(n) && n > 1)) continue;
        if (!Number.isFinite(fthg) || !Number.isFinite(ftag)) continue;
        rows.push({
          league: name,
          fthg,
          ftag,
          hthg: Number(c[iHTHG]) || 0,
          htag: Number(c[iHTAG]) || 0,
          homeOdds,
          drawOdds,
          awayOdds,
          overOdds,
          underOdds
        });
      }
    }
  }
  return rows;
}

function modelMetrics(grid: FootballScoreGrid) {
  let w = 0, d = 0, l = 0, goals = 0, htHomeAhead = 0;
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const p = grid.p[i][j];
      if (i > j) w += p;
      else if (i === j) d += p;
      else l += p;
      goals += p * (i + j);
      // Real partial-order: with (h,a) goals at half-time, the probability the
      // half ends home-ahead is the ballot P(lead ≥ 1) for those counts — the
      // model's half-time home-ahead chance is exactly gridTeamLeadUp at 1.
    }
  }
  return { w, d, l, goals, htHomeAhead };
}

// P(model says home leads at HT) — ballot over the full-time score with the
// goals re-split by the empirical first-half share is NOT observable in the
// data; instead we use the observed half-time scores as ground truth and
// compare against P(home leads at some point with ≥1 lead at HT) which the
// ballot gives for the HALF-TIME counts directly. To keep this a pure model
// check we approximate HT distribution by re-splitting each team's lambda.
// Simplest honest check: model P(home ahead at HT) = gridTeamLeadUp(grid, true, 1)
// requires goal ORDER — for the half-time state we use the Poisson half-split
// (share 0.45) of each team's lambda, which the model already publishes.
function modelHtHomeAhead(grid: FootballScoreGrid): number {
  const share = 0.45;
  const lh = grid.lambdaH * share;
  const la = grid.lambdaA * share;
  let p = 0;
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      if (i <= j) continue;
      p += Math.exp(-lh) * Math.pow(lh, i) / (i === 0 ? 1 : fact(i)) * Math.exp(-la) * Math.pow(la, j) / (j === 0 ? 1 : fact(j));
    }
  }
  return p;
}

function fact(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

interface LeagueStats {
  n: number;
  actualHome: number;
  actualDraw: number;
  actualOver25: number;
  actualGoals: number;
  actualHtHomeAhead: number;
  actualHome1up: number;
  actualHome2up: number;
  actualHomeNd: number;
  modelHome: number;
  modelDraw: number;
  modelOver25: number;
  modelGoals: number;
  modelHtHomeAhead: number;
  modelHome1up: number;
  modelHome2up: number;
  modelHomeNd: number;
  refDraw: number; // two-target grid WITHOUT the DC correction
}

describe('multi-league calibration backtest (Dixon-Coles draw correction)', () => {
  it('draw delta closes in every league while win/totals/momentum stay calibrated', () => {
    const rows = loadRows();
    expect(rows.length).toBeGreaterThan(6000);

    const stats: Record<string, LeagueStats> = {};
    for (const name of Object.values(LEAGUES)) {
      stats[name] = {
        n: 0, actualHome: 0, actualDraw: 0, actualOver25: 0, actualGoals: 0, actualHtHomeAhead: 0,
        actualHome1up: 0, actualHome2up: 0, actualHomeNd: 0,
        modelHome: 0, modelDraw: 0, modelOver25: 0, modelGoals: 0, modelHtHomeAhead: 0,
        modelHome1up: 0, modelHome2up: 0, modelHomeNd: 0, refDraw: 0
      };
    }

    // Per-odds-tuple model cache: bookmaker average odds repeat heavily across
    // 7k+ rows; skip duplicate grid builds + ballot sweeps for identical tuples.
    type GridMetrics = {
      w: number; d: number; goals: number; over25: number;
      home1up: number; home2up: number; homeNd: number; htHomeAhead: number; refDraw: number;
    };
    const gridCache = new Map<string, GridMetrics>();

    for (const r of rows) {
      const s = stats[r.league];
      s.n += 1;
      s.actualGoals += r.fthg + r.ftag;
      if (r.fthg > r.ftag) s.actualHome += 1;
      else if (r.fthg === r.ftag) s.actualDraw += 1;
      if (r.fthg + r.ftag > 2.5) s.actualOver25 += 1;
      if (r.hthg > r.htag) s.actualHtHomeAhead += 1;
      // Full-time scoreline → exact path probabilities (goal order uniform).
      const n = r.fthg + r.ftag;
      s.actualHome1up += r.fthg >= 1 ? Math.min(1, r.fthg / (r.ftag + 1)) : 0;
      s.actualHome2up += r.fthg >= 2 ? Math.min(1, comb(n, r.fthg - 2) / comb(n, r.ftag)) : 0;
      s.actualHomeNd += r.fthg > r.ftag ? (r.fthg + 1 - r.ftag) / (r.fthg + 1) : 0;

      const key = `${r.homeOdds}|${r.drawOdds}|${r.awayOdds}|${r.overOdds}|${r.underOdds}`;
      let m = gridCache.get(key);
      if (!m) {
        const grid = buildFootballGrid(r.homeOdds, r.drawOdds, r.awayOdds, 2.5, { line: 2.5, over: r.overOdds, under: r.underOdds });
        const mm = modelMetrics(grid);
        // Reference: the two-target grid WITHOUT the DC draw correction.
        const [pH, pD] = devig([r.homeOdds, r.drawOdds, r.awayOdds]);
        const [pOver] = devig([r.overOdds, r.underOdds]);
        const ref = fitTwoTargetGrid(pH, pOver, 2.5);
        m = {
          w: mm.w,
          d: mm.d,
          goals: mm.goals,
          over25: gridTotals(grid, 2.5).over,
          home1up: gridTeamLeadUp(grid, true, 1),
          home2up: gridTeamLeadUp(grid, true, 2),
          homeNd: gridTeamNeverDown(grid, true),
          htHomeAhead: modelHtHomeAhead(grid),
          refDraw: ref ? modelMetrics(ref).d : 0
        };
        gridCache.set(key, m);
      }
      s.modelHome += m.w;
      s.modelDraw += m.d;
      s.modelOver25 += m.over25;
      s.modelGoals += m.goals;
      s.modelHtHomeAhead += m.htHomeAhead;
      s.modelHome1up += m.home1up;
      s.modelHome2up += m.home2up;
      s.modelHomeNd += m.homeNd;
      s.refDraw += m.refDraw;
    }

    // Print the per-league table (all deltas as percentage-point rates).
    const lines: string[] = ['| League | n | Goals model/actual | Over2.5 Δ | Home Δ | Draw Δ | Draw Δ (no-DC) | 1UP Δ | 2UP Δ | ND Δ | HT ahead Δ |'];
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|');
    for (const name of Object.values(LEAGUES)) {
      const s = stats[name];
      const n = s.n;
      const rate = (v: number) => (v / n) * 100;
      lines.push(
        `| ${name} | ${n} | ${(s.modelGoals / n).toFixed(2)}/${(s.actualGoals / n).toFixed(2)} | ` +
        `${(rate(s.modelOver25) - rate(s.actualOver25)).toFixed(1)}pp | ${(rate(s.modelHome) - rate(s.actualHome)).toFixed(1)}pp | ` +
        `${(rate(s.modelDraw) - rate(s.actualDraw)).toFixed(1)}pp | ${(rate(s.refDraw) - rate(s.actualDraw)).toFixed(1)}pp | ` +
        `${(rate(s.modelHome1up) - rate(s.actualHome1up)).toFixed(1)}pp | ${(rate(s.modelHome2up) - rate(s.actualHome2up)).toFixed(1)}pp | ` +
        `${(rate(s.modelHomeNd) - rate(s.actualHomeNd)).toFixed(1)}pp | ${(rate(s.modelHtHomeAhead) - rate(s.actualHtHomeAhead)).toFixed(1)}pp |`
      );
    }
    console.log(lines.join('\n'));

    // Assertions: the draw correction must bring every league within ±2pp of
    // the REAL draw rate (previously −0.4 to −3pp), with a strictly lower total
    // absolute draw error than the no-DC reference (EPL overshoots slightly
    // because the market's own de-vigged draw line sits above reality there —
    // the model now tracks the market draw exactly, which is its calibration
    // target). Everything else must stay in tolerance (win ±3pp, Over ±3pp,
    // goals ±0.10, momentum ±4pp, HT ±3pp).
    let totalAbsDc = 0;
    let totalAbsRef = 0;
    for (const name of Object.values(LEAGUES)) {
      const s = stats[name];
      const n = s.n;
      const drawD = (s.modelDraw / n - s.actualDraw / n) * 100;
      const refD = (s.refDraw / n - s.actualDraw / n) * 100;
      totalAbsDc += Math.abs(drawD);
      totalAbsRef += Math.abs(refD);
      expect(Math.abs(drawD)).toBeLessThan(2);
      expect(Math.abs((s.modelHome / n - s.actualHome / n) * 100)).toBeLessThan(3);
      expect(Math.abs((s.modelOver25 / n - s.actualOver25 / n) * 100)).toBeLessThan(3);
      expect(Math.abs(s.modelGoals / n - s.actualGoals / n)).toBeLessThan(0.1);
      expect(Math.abs((s.modelHome1up / n - s.actualHome1up / n) * 100)).toBeLessThan(4);
      expect(Math.abs((s.modelHome2up / n - s.actualHome2up / n) * 100)).toBeLessThan(4);
      expect(Math.abs((s.modelHomeNd / n - s.actualHomeNd / n) * 100)).toBeLessThan(4);
      expect(Math.abs((s.modelHtHomeAhead / n - s.actualHtHomeAhead / n) * 100)).toBeLessThan(3);
    }
    // Aggregate draw error strictly improves vs the no-DC reference.
    expect(totalAbsDc).toBeLessThan(totalAbsRef);
  }, 420_000);
});

function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
