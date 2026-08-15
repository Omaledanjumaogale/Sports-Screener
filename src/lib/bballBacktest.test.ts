import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  devig,
  buildBasketballModel,
  basketballHomeCovers,
  basketballTotalOver,
  BASKETBALL_SD_MARGIN,
  BASKETBALL_SD_TEAM,
  BASKETBALL_SD_TOTAL,
  BASKETBALL_FIRST_HALF_SHARE
} from '../../convex/scrapers/normalize';

interface NbaGame {
  season: number;
  away: string;
  home: string;
  awayScore: number;
  homeScore: number;
  q1a: number; q2a: number; q3a: number; q4a: number; otA: number;
  q1h: number; q2h: number; q3h: number; q4h: number; otH: number;
  spread: number | null;
  total: number | null;
  mlAway: number | null;
  mlHome: number | null;
  homeFavored: boolean | null;
}

interface WnbaGame {
  season: number;
  awayScore: number;
  homeScore: number;
}

function loadCsv(file: string): string[][] {
  const raw = fs.readFileSync(path.resolve(process.cwd(), 'tmp/bbt', file), 'utf8');
  return raw.split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(','));
}

// American odds → decimal odds
function toDecimal(am: number | null): number | null {
  if (am === null || am === 0 || Number.isNaN(am)) return null;
  if (am > 0) return 1 + am / 100;
  return 1 + 100 / Math.abs(am);
}

function loadNba(): NbaGame[] {
  const rows = loadCsv('nba_games.csv');
  const out: NbaGame[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 27) continue;
    const num = (v: string) => (v === '' || v === 'NA' ? NaN : parseFloat(v));
    const homeScore = num(r[7]);
    const awayScore = num(r[6]);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
    const q1a = num(r[8]); const q2a = num(r[9]); const q3a = num(r[10]); const q4a = num(r[11]); const otA = num(r[12]) || 0;
    const q1h = num(r[13]); const q2h = num(r[14]); const q3h = num(r[15]); const q4h = num(r[16]); const otH = num(r[17]) || 0;
    // Columns: 18=whos_favored, 19=spread (unsigned favourite line), 20=total,
    // 21=moneyline_away, 22=moneyline_home (American odds).
    const spread = Number.isFinite(num(r[19])) ? num(r[19]) : null;
    const total = Number.isFinite(num(r[20])) ? num(r[20]) : null;
    const mlAway = toDecimal(num(r[21]));
    const mlHome = toDecimal(num(r[22]));
    const fav = r[18] === 'home' ? true : r[18] === 'away' ? false : null;
    out.push({ season: num(r[0]), away: r[4], home: r[5], awayScore, homeScore, q1a, q2a, q3a, q4a, otA, q1h, q2h, q3h, q4h, otH, spread, total, mlAway, mlHome, homeFavored: fav });
  }
  return out;
}

// The ESPN scoreboard feed used to build wnba_games.csv also contains
// All-Star (DEL/WIL/STE/... = Team Delle Donne / Wilson / Stewart, WNBASTARS)
// and international exhibition (USA, CHINA, PAR, PUERTORICO) games — filter to
// the real franchises so the scoring-context stats stay league-representative.
const WNBA_FRANCHISES = new Set(['ATL', 'CHI', 'CON', 'DAL', 'IND', 'LA', 'LV', 'MIN', 'NY', 'PHX', 'SEA', 'WSH']);

function loadWnba(): WnbaGame[] {
  const rows = loadCsv('wnba_games.csv');
  const out: WnbaGame[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 8) continue;
    // Columns: 2=home, 3=away, 4=home_score, 5=away_score, 6=total, 7=margin.
    if (!WNBA_FRANCHISES.has(r[2]) || !WNBA_FRANCHISES.has(r[3])) continue;
    const homeScore = parseFloat(r[4]);
    const awayScore = parseFloat(r[5]);
    if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) continue;
    out.push({ season: parseFloat(r[0]), awayScore, homeScore });
  }
  return out;
}

function sd(vals: number[]): number {
  if (vals.length < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length - 1));
}

function mean(vals: number[]): number {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

describe('basketball model backtest (NBA 2008-2025 + WNBA 2018-2024)', () => {
  const nba = loadNba();
  const wnba = loadWnba();

  it('NBA: empirical SDs vs model constants (14 / 13 / 22)', () => {
    const margins = nba.map((g) => g.homeScore - g.awayScore);
    const totals = nba.map((g) => g.homeScore + g.awayScore);
    const teams: number[] = [];
    nba.forEach((g) => { teams.push(g.homeScore, g.awayScore); });
    const sdMargin = sd(margins);
    const sdTeam = sd(teams);
    const sdTotal = sd(totals);
    console.log(`\nNBA SDs (n=${nba.length}):`);
    console.log(`  margin: actual ${sdMargin.toFixed(2)} vs model ${BASKETBALL_SD_MARGIN}`);
    console.log(`  team:   actual ${sdTeam.toFixed(2)} vs model ${BASKETBALL_SD_TEAM}`);
    console.log(`  total:  actual ${sdTotal.toFixed(2)} vs model ${BASKETBALL_SD_TOTAL}`);
    console.log(`  ratios: sdTeam/total ${(sdTeam / sdTotal).toFixed(3)}, sdMargin/total ${(sdMargin / sdTotal).toFixed(3)}`);
    expect(Math.abs(sdMargin - BASKETBALL_SD_MARGIN)).toBeLessThan(2);
    expect(Math.abs(sdTeam - BASKETBALL_SD_TEAM)).toBeLessThan(2);
    expect(Math.abs(sdTotal - BASKETBALL_SD_TOTAL)).toBeLessThan(2);
  });

  it('NBA: first-half share from quarter scores vs 50.3%', () => {
    const shares: number[] = [];
    for (const g of nba) {
      const first = g.q1a + g.q2a + g.q1h + g.q2h;
      const total = g.homeScore + g.awayScore;
      if (total >= 120) shares.push(first / total);
    }
    const actual = mean(shares);
    console.log(`\nNBA first-half share: actual ${(actual * 100).toFixed(2)}% vs model ${(BASKETBALL_FIRST_HALF_SHARE * 100).toFixed(1)}%`);
    console.log(`  (1H mean ≈ ${(mean(shares) * mean(nba.map((g) => g.homeScore + g.awayScore))).toFixed(1)} pts of ${mean(nba.map((g) => g.homeScore + g.awayScore)).toFixed(1)} avg total)`);
    expect(Math.abs(actual - BASKETBALL_FIRST_HALF_SHARE)).toBeLessThan(0.01);
  });

  it('NBA: moneyline devig → win-rate calibration in bins', () => {
    // Only games with both moneylines
    const rows = nba.filter((g) => g.mlHome !== null && g.mlAway !== null && g.mlHome > 1.01 && g.mlAway > 1.01);
    const bins: Record<string, { model: number; actual: number; n: number }> = {};
    for (const g of rows) {
      const [pH] = devig([g.mlHome!, g.mlAway!]);
      const key = `${Math.floor(pH * 10) * 10}-${Math.floor(pH * 10) * 10 + 10}`;
      if (!bins[key]) bins[key] = { model: 0, actual: 0, n: 0 };
      bins[key].model += pH;
      bins[key].actual += g.homeScore > g.awayScore ? 1 : 0;
      bins[key].n += 1;
    }
    console.log(`\nNBA moneyline calibration (n=${rows.length} games with both moneylines):`);
    console.log('  bin       | n    | model pH | actual win | Δ');
    let totalErr = 0;
    let totalN = 0;
    for (const [k, b] of Object.entries(bins).sort()) {
      if (b.n < 30) continue;
      const m = b.model / b.n;
      const a = b.actual / b.n;
      const d = a - m;
      totalErr += Math.abs(d) * b.n;
      totalN += b.n;
      console.log(`  ${k.padEnd(10)} | ${String(b.n).padEnd(4)} | ${(m * 100).toFixed(1).padStart(5)}%   | ${(a * 100).toFixed(1).padStart(6)}%    | ${(d * 100).toFixed(1).padStart(5)}pp`);
    }
    console.log(`  weighted |Δ|: ${(totalErr / totalN * 100).toFixed(1)}pp (n=${totalN})`);
    expect(totalErr / totalN).toBeLessThan(0.05);
  });

  it('NBA: spread cover model vs actual ATS results', () => {
    const rows = nba.filter((g) => g.spread !== null && g.total !== null && g.spread > 0 && g.mlHome !== null && g.mlAway !== null);
    // Model: home margin ~ N(margin_model, SD_MARGIN). Home covers line L (home
    // handicap) iff margin > -L. Real data: spread is the favourite's line.
    const bins: Record<string, { model: number; actual: number; n: number }> = {};
    for (const g of rows) {
      const homeLine = g.homeFavored === true ? -g.spread! : g.spread!;
      const model = buildBasketballModel(g.mlHome!, g.mlAway!, g.total!);
      const pCover = basketballHomeCovers(model, homeLine);
      const key = `${Math.floor(pCover * 5) * 5}-${Math.floor(pCover * 5) * 5 + 5}`;
      if (!bins[key]) bins[key] = { model: 0, actual: 0, n: 0 };
      bins[key].model += pCover;
      bins[key].actual += g.homeScore - g.awayScore > -homeLine ? 1 : 0;
      bins[key].n += 1;
    }
    console.log(`\nNBA spread cover calibration (n=${rows.length} games with spread + moneyline):`);
    console.log('  bin     | n    | model cover | actual cover | Δ');
    let totalErr = 0;
    let totalN = 0;
    for (const [k, b] of Object.entries(bins).sort()) {
      if (b.n < 30) continue;
      const m = b.model / b.n;
      const a = b.actual / b.n;
      const d = a - m;
      totalErr += Math.abs(d) * b.n;
      totalN += b.n;
      console.log(`  ${k.padEnd(8)} | ${String(b.n).padEnd(4)} | ${(m * 100).toFixed(1).padStart(5)}%    | ${(a * 100).toFixed(1).padStart(6)}%     | ${(d * 100).toFixed(1).padStart(5)}pp`);
    }
    console.log(`  weighted |Δ|: ${(totalErr / totalN * 100).toFixed(1)}pp (n=${totalN})`);
    expect(totalErr / totalN).toBeLessThan(0.05);
  });

  it('NBA: totals over/under model vs actual over rates', () => {
    const rows = nba.filter((g) => g.total !== null && g.mlHome !== null && g.mlAway !== null);
    const bins: Record<string, { model: number; actual: number; n: number }> = {};
    for (const g of rows) {
      const model = buildBasketballModel(g.mlHome!, g.mlAway!, g.total!);
      const pOver = basketballTotalOver(model, g.total!);
      const key = `${Math.floor(pOver * 5) * 5}-${Math.floor(pOver * 5) * 5 + 5}`;
      if (!bins[key]) bins[key] = { model: 0, actual: 0, n: 0 };
      bins[key].model += pOver;
      bins[key].actual += g.homeScore + g.awayScore > g.total! ? 1 : 0;
      bins[key].n += 1;
    }
    console.log(`\nNBA totals over calibration (n=${rows.length} games with total + moneyline):`);
    console.log('  bin     | n    | model over | actual over | Δ');
    let totalErr = 0;
    let totalN = 0;
    for (const [k, b] of Object.entries(bins).sort()) {
      if (b.n < 30) continue;
      const m = b.model / b.n;
      const a = b.actual / b.n;
      const d = a - m;
      totalErr += Math.abs(d) * b.n;
      totalN += b.n;
      console.log(`  ${k.padEnd(8)} | ${String(b.n).padEnd(4)} | ${(m * 100).toFixed(1).padStart(5)}%    | ${(a * 100).toFixed(1).padStart(6)}%     | ${(d * 100).toFixed(1).padStart(5)}pp`);
    }
    console.log(`  weighted |Δ|: ${(totalErr / totalN * 100).toFixed(1)}pp (n=${totalN})`);
    expect(totalErr / totalN).toBeLessThan(0.05);
  });

  it('WNBA: league scoring context — SDs scale with the lower scoring level', () => {
    const margins = wnba.map((g) => g.homeScore - g.awayScore);
    const totals = wnba.map((g) => g.homeScore + g.awayScore);
    const teams: number[] = [];
    wnba.forEach((g) => { teams.push(g.homeScore, g.awayScore); });
    const avgTotal = mean(totals);
    const sdMargin = sd(margins);
    const sdTeam = sd(teams);
    const sdTotal = sd(totals);
    const nbaAvgTotal = mean(nba.map((g) => g.homeScore + g.awayScore));
    const nbaSdTotal = sd(nba.map((g) => g.homeScore + g.awayScore));
    console.log(`\nWNBA vs NBA scoring context (WNBA n=${wnba.length}, NBA n=${nba.length}):`);
    console.log(`  avg total:      WNBA ${avgTotal.toFixed(1)} vs NBA ${nbaAvgTotal.toFixed(1)}`);
    console.log(`  SD total:       WNBA ${sdTotal.toFixed(1)} vs NBA ${nbaSdTotal.toFixed(1)} (model ${BASKETBALL_SD_TOTAL})`);
    console.log(`  SD team:        WNBA ${sdTeam.toFixed(1)} vs NBA ${sd(nba.flatMap((g) => [g.homeScore, g.awayScore])).toFixed(1)} (model ${BASKETBALL_SD_TEAM})`);
    console.log(`  SD margin:      WNBA ${sdMargin.toFixed(1)} vs NBA ${sd(nba.map((g) => g.homeScore - g.awayScore)).toFixed(1)} (model ${BASKETBALL_SD_MARGIN})`);
    console.log(`  SD/avgTotal:    WNBA ${(sdTotal / avgTotal).toFixed(3)} vs NBA ${(nbaSdTotal / nbaAvgTotal).toFixed(3)} (model ${(BASKETBALL_SD_TOTAL / 220).toFixed(3)})`);
    // The model's absolute SDs (22 / 13 / 14) track the WNBA's real game-to-game
    // variance (21.6 / 12.8 / 13.8), so the Normal model carries over fine.
    expect(avgTotal).toBeLessThan(180);
    expect(sdTotal).toBeLessThan(BASKETBALL_SD_TOTAL + 1);
    // SD scales with scoring level — ratio to average total is league-stable.
    // The WNBA sits somewhat higher (0.133 vs 0.111) because its competitive
    // imbalance produces more lopsided games relative to its scoring level.
    expect(Math.abs(sdTotal / avgTotal - nbaSdTotal / nbaAvgTotal)).toBeLessThan(0.03);
  });
});
