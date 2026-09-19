import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFootballGrid,
  gridTotals,
  gridBtts,
  gridTeamOver,
  halfTotalOver,
  homeCoversProbability,
  devig
} from '../../convex/scrapers/normalize';
import type { FootballScoreGrid } from '../../convex/scrapers/normalize';

// Real historical results from football-data.co.uk (4 leagues × 6 seasons,
// 2018/19-2023/24): FT + HT scores, pre-match 1X2 and totals odds. Every
// derived market probability (BTTS, team totals, half totals, Asian handicap,
// momentum) is compared against the real outcomes so the whole market set is
// calibrated, not just the 1X2/totals the grid is fitted to.
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

// Each market: model P and actual P for a single match. AH-0 is handled as a
// conditional cover probability (draws push, excluded from both sides).
type MarketProbe = {
  key: string;
  title: string;
  model: (grid: FootballScoreGrid, fair: number[], r: Row) => number;
  actual: (r: Row) => number;
};

const MARKET_PROBES: MarketProbe[] = [
  { key: 'win', title: 'Home win', model: (g) => { let w = 0; for (let i = 1; i <= 9; i++) for (let j = 0; j < i; j++) w += g.p[i][j]; return w; }, actual: (r) => (r.fthg > r.ftag ? 1 : 0) },
  { key: 'draw', title: 'Draw', model: (g) => { let d = 0; for (let i = 0; i <= 9; i++) d += g.p[i][i]; return d; }, actual: (r) => (r.fthg === r.ftag ? 1 : 0) },
  { key: 'over25', title: 'Over 2.5', model: (g) => gridTotals(g, 2.5).over, actual: (r) => (r.fthg + r.ftag > 2.5 ? 1 : 0) },
  { key: 'btts', title: 'BTTS Yes', model: (g) => gridBtts(g).yes, actual: (r) => (r.fthg >= 1 && r.ftag >= 1 ? 1 : 0) },
  { key: 'h05', title: 'Home Over 0.5', model: (g) => gridTeamOver(g, true, 0.5), actual: (r) => (r.fthg >= 1 ? 1 : 0) },
  { key: 'a05', title: 'Away Over 0.5', model: (g) => gridTeamOver(g, false, 0.5), actual: (r) => (r.ftag >= 1 ? 1 : 0) },
  { key: 'h15', title: 'Home Over 1.5', model: (g) => gridTeamOver(g, true, 1.5), actual: (r) => (r.fthg >= 2 ? 1 : 0) },
  { key: 'a15', title: 'Away Over 1.5', model: (g) => gridTeamOver(g, false, 1.5), actual: (r) => (r.ftag >= 2 ? 1 : 0) },
  { key: 'h1over', title: '1H Over 0.5', model: (g) => halfTotalOver(g, 'first', 0.5), actual: (r) => (r.hthg + r.htag >= 1 ? 1 : 0) },
  { key: 'h2over', title: '2H Over 0.5', model: (g) => halfTotalOver(g, 'second', 0.5), actual: (r) => (r.fthg + r.ftag - r.hthg - r.htag >= 1 ? 1 : 0) },
  { key: 'ahm05', title: 'AH -0.5 home', model: (g, f) => homeCoversProbability(g, f, -0.5), actual: (r) => (r.fthg > r.ftag ? 1 : 0) },
  { key: 'ahp05', title: 'AH +0.5 home', model: (g, f) => homeCoversProbability(g, f, 0.5), actual: (r) => (r.fthg >= r.ftag ? 1 : 0) },
  { key: 'ahm15', title: 'AH -1.5 home', model: (g, f) => homeCoversProbability(g, f, -1.5), actual: (r) => (r.fthg - r.ftag >= 2 ? 1 : 0) },
  { key: 'ahp15', title: 'AH +1.5 home', model: (g, f) => homeCoversProbability(g, f, 1.5), actual: (r) => (r.ftag - r.fthg < 2 ? 1 : 0) }
];

describe('comprehensive football markets backtest (all derived markets vs history)', () => {
  it('every derived market calibrates within tolerance (binned + per-league)', () => {
    const rows = loadRows();
    expect(rows.length).toBeGreaterThan(6000);

    const agg: Record<string, { m: number; a: number; n: number }> = {};
    const byLeague: Record<string, Record<string, { m: number; a: number; n: number }>> = {};
    const bins: Record<string, { m: number; a: number; n: number }[]> = {};
    for (const p of MARKET_PROBES) {
      agg[p.key] = { m: 0, a: 0, n: 0 };
      bins[p.key] = Array.from({ length: 10 }, () => ({ m: 0, a: 0, n: 0 }));
      byLeague[p.key] = {};
      for (const name of Object.values(LEAGUES)) byLeague[p.key][name] = { m: 0, a: 0, n: 0 };
    }
    const ah0 = { m: 0, a: 0, n: 0 }; // conditional cover for AH 0 (draws push)

    for (const r of rows) {
      const fair = devig([r.homeOdds, r.drawOdds, r.awayOdds]);
      const grid = buildFootballGrid(r.homeOdds, r.drawOdds, r.awayOdds, 2.5, { line: 2.5, over: r.overOdds, under: r.underOdds });
      for (const p of MARKET_PROBES) {
        const m = p.model(grid, fair, r);
        const a = p.actual(r);
        agg[p.key].m += m; agg[p.key].a += a; agg[p.key].n += 1;
        byLeague[p.key][r.league].m += m; byLeague[p.key][r.league].a += a; byLeague[p.key][r.league].n += 1;
        const b = Math.min(9, Math.floor(m * 10));
        bins[p.key][b].m += m; bins[p.key][b].a += a; bins[p.key][b].n += 1;
      }
      // AH 0: conditional home cover (draws push) — model pH/(pH+pA).
      const [pH, , pA] = fair;
      const denom = pH + pA || 1;
      if (r.fthg !== r.ftag) {
        ah0.m += pH / denom;
        ah0.a += r.fthg > r.ftag ? 1 : 0;
        ah0.n += 1;
      }
    }

    // Binned calibration table + weighted error per market.
    console.log('Binned calibration (model → actual rate, weighted |Δ| per market):');
    const results: Record<string, number> = {};
    for (const p of MARKET_PROBES) {
      let err = 0, n = 0;
      const lineParts: string[] = [];
      for (let b = 0; b < 10; b++) {
        const x = bins[p.key][b];
        if (x.n < 50) continue;
        const m = (x.m / x.n) * 100;
        const a = (x.a / x.n) * 100;
        err += Math.abs(m - a) * x.n;
        n += x.n;
        if (x.n >= 100) lineParts.push(`${b * 10}-${b * 10 + 10}%: ${m.toFixed(0)}→${a.toFixed(0)}`);
      }
      const w = n ? err / n : 0;
      results[p.key] = w;
      console.log(`  ${p.title.padEnd(18)} weighted |Δ| ${w.toFixed(1)}pp  [${lineParts.join(' | ')}]`);
    }
    const m0 = ah0.m / ah0.n;
    const a0 = ah0.a / ah0.n;
    console.log(`  AH 0 (conditional)    weighted |Δ| ${(Math.abs(m0 - a0) * 100).toFixed(1)}pp (n=${ah0.n})`);

    // Per-league aggregate deltas for the headline markets.
    console.log('\nPer-league |Δ| (pp):');
    const leagueRows: string[] = ['| League |'];
    const headerParts: string[] = [];
    for (const p of MARKET_PROBES) {
      headerParts.push(p.key);
      leagueRows[0] += ` ${p.key} |`;
    }
    console.log(leagueRows[0]);
    for (const name of Object.values(LEAGUES)) {
      const cells: string[] = [`| ${name} `];
      for (const p of MARKET_PROBES) {
        const s = byLeague[p.key][name];
        const d = ((s.m / s.n) - (s.a / s.n)) * 100;
        cells.push(`| ${Math.abs(d).toFixed(1)} `);
      }
      console.log(cells.join('') + '|');
    }

    // Assertions: core markets ±2.5pp, secondary markets ±4pp.
    const tight = new Set(['win', 'draw', 'over25', 'btts', 'h05', 'a05', 'h15', 'a15', 'h1over', 'h2over']);
    for (const p of MARKET_PROBES) {
      expect(results[p.key], `${p.key} weighted |Δ| ${results[p.key].toFixed(1)}pp`).toBeLessThan(tight.has(p.key) ? 2.5 : 4);
    }
    expect(Math.abs(m0 - a0)).toBeLessThan(0.025);
  }, 420_000);
});
