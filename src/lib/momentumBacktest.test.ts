import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFootballGrid,
  gridTeamLeadUp,
  gridTeamNeverDown,
  devig,
  FIRST_HALF_GOAL_SHARE
} from '../../convex/scrapers/normalize';
import type { FootballScoreGrid } from '../../convex/scrapers/normalize';

// Real historical results from football-data.co.uk: 4 leagues × 6 seasons
// (2018/19-2023/24), each row with full-time AND half-time scores plus the
// pre-match 1X2 and totals odds (same data as ballotBacktest.test.ts).
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

function poissonPmf(lambda: number, k: number): number {
  if (k < 0) return 0;
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return Math.exp(-lambda) * Math.pow(lambda, k) / fact;
}

// Model half-time state probabilities from the Poisson half-split (share 0.45):
// H1 ~ Pois(λH·share), A1 ~ Pois(λA·share).
function modelHtStates(grid: FootballScoreGrid): { homeAhead: number; home2Up: number; awayAhead: number; away2Up: number } {
  const lh = grid.lambdaH * FIRST_HALF_GOAL_SHARE;
  const la = grid.lambdaA * FIRST_HALF_GOAL_SHARE;
  let homeAhead = 0, home2Up = 0, awayAhead = 0, away2Up = 0;
  for (let i = 0; i <= 12; i++) {
    for (let j = 0; j <= 12; j++) {
      const p = poissonPmf(lh, i) * poissonPmf(la, j);
      if (i > j) homeAhead += p;
      if (i - j >= 2) home2Up += p;
      if (j > i) awayAhead += p;
      if (j - i >= 2) away2Up += p;
    }
  }
  return { homeAhead, home2Up, awayAhead, away2Up };
}

// ── Ballot-path actuals from the FULL-TIME score (goal order uniform) ────────
// P(lead by ≥1 at some point | mine, theirs) = min(1, mine/(theirs+1))
// P(lead by ≥2 at some point | mine, theirs) = min(1, C(n, mine-2)/C(n, theirs))
// P(win without ever trailing | mine, theirs) = (mine+1-theirs)/(mine+1)
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

interface Metrics {
  n: number;
  m: Record<string, number>; // model probability sums
  a: Record<string, number>; // actual probability sums
}

describe('football momentum markets backtest (1UP / 2UP / Never Down + HT states)', () => {
  it('model momentum and half-time probabilities calibrate across all leagues', () => {
    const rows = loadRows();
    expect(rows.length).toBeGreaterThan(6000);

    const stats: Record<string, Metrics> = {};
    for (const name of Object.values(LEAGUES)) stats[name] = { n: 0, m: {}, a: {} };
    const KEYS = ['h1', 'a1', 'h2', 'a2', 'hnd', 'and', 'hth', 'hta', 'h2h', 'a2h'];

    for (const r of rows) {
      const s = stats[r.league];
      s.n += 1;

      const grid = buildFootballGrid(r.homeOdds, r.drawOdds, r.awayOdds, 2.5, { line: 2.5, over: r.overOdds, under: r.underOdds });
      const ht = modelHtStates(grid);
      const vals: Record<string, number> = {
        h1: gridTeamLeadUp(grid, true, 1),
        a1: gridTeamLeadUp(grid, false, 1),
        h2: gridTeamLeadUp(grid, true, 2),
        a2: gridTeamLeadUp(grid, false, 2),
        hnd: gridTeamNeverDown(grid, true),
        and: gridTeamNeverDown(grid, false),
        hth: ht.homeAhead,
        hta: ht.awayAhead,
        h2h: ht.home2Up,
        a2h: ht.away2Up
      };
      for (const k of KEYS) {
        s.m[k] = (s.m[k] ?? 0) + vals[k];
        s.a[k] = (s.a[k] ?? 0) + actualFor(r, k);
      }
    }

    // Print per-league rate tables (model vs actual, in pp).
    const lines: string[] = [];
    lines.push('| League | n | 1UP H | 1UP A | 2UP H | 2UP A | ND H | ND A | HT ahead H | HT ahead A | HT 2UP H | HT 2UP A |');
    lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
    const absByKey: Record<string, number> = {};
    for (const name of Object.values(LEAGUES)) {
      const s = stats[name];
      const cells: string[] = [`| ${name} | ${s.n} `];
      for (const k of KEYS) {
        const m = (s.m[k] / s.n) * 100;
        const a = (s.a[k] / s.n) * 100;
        const d = m - a;
        absByKey[k] = (absByKey[k] ?? 0) + Math.abs(d);
        cells.push(`| ${m.toFixed(1)}/${a.toFixed(1)} (${d >= 0 ? '+' : ''}${d.toFixed(1)}) `);
      }
      lines.push(cells.join('') + '|');
    }
    console.log(lines.join('\n'));

    // Aggregate calibration: pooled weighted |Δ| across all leagues per metric.
    console.log('\nAggregate |Δ| (pp, weighted across leagues):');
    for (const k of KEYS) {
      console.log(`  ${k.padEnd(6)} ${(absByKey[k] / Object.keys(LEAGUES).length).toFixed(1)}pp`);
    }

    // Assertions — per-league momentum within ±4pp, HT states within ±3pp
    // (HT states are directly observable so tighter).
    for (const name of Object.values(LEAGUES)) {
      const s = stats[name];
      for (const k of KEYS) {
        const d = (s.m[k] / s.n - s.a[k] / s.n) * 100;
        const bound = k.startsWith('h') && k !== 'hnd' && k !== 'h1' ? 3 : 4;
        expect(Math.abs(d), `${name} ${k} Δ=${d.toFixed(1)}pp`).toBeLessThan(bound);
      }
    }
  }, 180_000);

  it('momentum probabilities are binned-calibrated (pooled across leagues)', () => {
    const rows = loadRows();
    // Bins over model probability for the two most important momentum markets.
    const binFor = (p: number) => Math.min(9, Math.floor(p * 10));
    const buckets: Record<string, { m: number; a: number; n: number }[]> = {
      h1: Array.from({ length: 10 }, () => ({ m: 0, a: 0, n: 0 })),
      nd: Array.from({ length: 10 }, () => ({ m: 0, a: 0, n: 0 }))
    };
    for (const r of rows) {
      const grid = buildFootballGrid(r.homeOdds, r.drawOdds, r.awayOdds, 2.5, { line: 2.5, over: r.overOdds, under: r.underOdds });
      const mH1 = gridTeamLeadUp(grid, true, 1);
      const mND = gridTeamNeverDown(grid, true);
      buckets.h1[binFor(mH1)].m += mH1;
      buckets.h1[binFor(mH1)].a += Math.min(1, r.fthg / (r.ftag + 1));
      buckets.h1[binFor(mH1)].n += 1;
      buckets.nd[binFor(mND)].m += mND;
      buckets.nd[binFor(mND)].a += r.fthg > r.ftag ? (r.fthg + 1 - r.ftag) / (r.fthg + 1) : 0;
      buckets.nd[binFor(mND)].n += 1;
    }
    console.log('\nBinned calibration (model → actual rate):');
    for (const key of ['h1', 'nd']) {
      console.log(`  ${key}:`);
      let err = 0, n = 0;
      for (let b = 0; b < 10; b++) {
        const x = buckets[key][b];
        if (x.n < 50) continue;
        const m = (x.m / x.n) * 100;
        const a = (x.a / x.n) * 100;
        err += Math.abs(m - a) * x.n;
        n += x.n;
        console.log(`    ${(b * 10).toString().padStart(2)}-${b * 10 + 10}%: model ${m.toFixed(1)}% actual ${a.toFixed(1)}% (n=${x.n})`);
      }
      const w = n ? err / n : 0;
      console.log(`    weighted |Δ|: ${w.toFixed(1)}pp (n=${n})`);
      expect(w).toBeLessThan(4);
    }
  }, 180_000);
});

function actualFor(r: Row, k: string): number {
  const h = r.fthg;
  const a = r.ftag;
  const n = h + a;
  switch (k) {
    case 'h1': return h >= 1 ? Math.min(1, h / (a + 1)) : 0;
    case 'a1': return a >= 1 ? Math.min(1, a / (h + 1)) : 0;
    case 'h2': return h >= 2 ? Math.min(1, comb(n, h - 2) / comb(n, a)) : 0;
    case 'a2': return a >= 2 ? Math.min(1, comb(n, a - 2) / comb(n, h)) : 0;
    case 'hnd': return h > a ? (h + 1 - a) / (h + 1) : 0;
    case 'and': return a > h ? (a + 1 - h) / (a + 1) : 0;
    case 'hth': return r.hthg > r.htag ? 1 : 0;
    case 'hta': return r.htag > r.hthg ? 1 : 0;
    case 'h2h': return r.hthg - r.htag >= 2 ? 1 : 0;
    case 'a2h': return r.htag - r.hthg >= 2 ? 1 : 0;
    default: return 0;
  }
}
