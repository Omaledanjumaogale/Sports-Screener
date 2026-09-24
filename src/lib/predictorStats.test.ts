// Tests for the AI-performance data bank aggregation (convex/predictorStats.ts).
// The numbers stored for the admin console are the product's measurement of its
// own predictions, so the bucketing, grading and calibration math are pinned
// here: a win rate must ignore pushes, and the calibration gap must always be
// published % − realised win rate.
import { describe, it, expect } from 'vitest';
import { bandOf, confidenceToPct, gradeSelection } from '../../convex/predictorGrading';
import { buildSnapshot, gradePick, type GradedPickInput } from '../../convex/predictorStats';

function pick(over: Partial<GradedPickInput>): GradedPickInput {
  return {
    dayKey: '2026-09-20',
    sportId: 'football',
    matchId: 'm1',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    finalScore: '2-1',
    marketTitle: 'Match Winner',
    selection: 'Arsenal',
    rank: 1,
    publishedPct: 70,
    provider: 'deterministic',
    ...over
  };
}

describe('confidenceToPct / bandOf', () => {
  it('parses the verdict confidence string', () => {
    expect(confidenceToPct('75%')).toBe(75);
    expect(confidenceToPct('82.5% punter edge')).toBe(82.5);
    expect(confidenceToPct('High')).toBeNull();
    expect(confidenceToPct(undefined)).toBeNull();
  });

  it('bands by published probability, mirroring the client monitor', () => {
    expect(bandOf(80)).toBe('Top Signal');
    expect(bandOf(66)).toBe('Strong Signal');
    expect(bandOf(55)).toBe('Qualifying');
    expect(bandOf(30)).toBe('Reference Only');
    expect(bandOf(null)).toBe('Reference Only');
  });
});

describe('gradePick — picks are graded against the real final score', () => {
  it('grades a winner market pick', () => {
    expect(gradePick(pick({}))).toBe('win');
    expect(gradePick(pick({ selection: 'Chelsea' }))).toBe('loss');
    expect(gradePick(pick({ selection: 'Draw' }))).toBe('loss');
  });

  it('grades a total line with a push', () => {
    expect(gradePick(pick({ marketTitle: 'Total Goals', selection: 'Over 2.5' }))).toBe('win');
    expect(gradePick(pick({ marketTitle: 'Total Goals', selection: 'Under 2.5' }))).toBe('loss');
    expect(gradePick(pick({ marketTitle: 'Total Goals', selection: 'Over 3' }))).toBe('push');
  });

  it('grades a spread/handicap line (2-1: the home side won by one)', () => {
    const line = (selection: string) =>
      gradeSelection(selection, 'Asian Handicap', '2-1', { homeTeam: 'Arsenal', awayTeam: 'Chelsea' });
    expect(line('Arsenal -1.5')).toBe('loss'); // won by 1 — did not cover 1.5
    expect(line('Arsenal -0.5')).toBe('win');
    expect(line('Arsenal -1')).toBe('push'); // exactly one — stake returned
    expect(line('Chelsea +1.5')).toBe('win'); // the other side of the same line
    expect(line('Chelsea +0.5')).toBe('loss');
  });

  it('returns null for an ungradeable market (excluded, never a loss)', () => {
    expect(gradePick(pick({ marketTitle: 'Both Teams To Score', selection: 'Yes' }))).toBeNull();
    expect(gradePick(pick({ finalScore: '   ' }))).toBeNull();
  });
});

describe('buildSnapshot — bucketing, win rate and calibration', () => {
  // Nine graded picks over one 2-1 final score:
  //   winner-market: 6 (4 wins, 2 losses) · total-market: 2 (1 win, 1 push)
  //   reference-band: 1 loss · providers: 8 deterministic, 1 llm
  const picks: GradedPickInput[] = [
    pick({ matchId: 'a', publishedPct: 80, selection: 'Arsenal' }),
    pick({ matchId: 'b', publishedPct: 80, selection: 'Arsenal' }),
    pick({ matchId: 'c', publishedPct: 80, selection: 'Arsenal' }),
    pick({ matchId: 'd', publishedPct: 80, selection: 'Chelsea' }),
    pick({ matchId: 'h', publishedPct: 80, selection: 'Arsenal' }),
    pick({ matchId: 'i', publishedPct: 80, selection: 'Chelsea' }),
    pick({ matchId: 'e', publishedPct: 55, marketTitle: 'Total Points', selection: 'Over 1.5' }),
    pick({ matchId: 'f', publishedPct: 60, marketTitle: 'Total Goals', selection: 'Over 3', rank: 2 }),
    pick({ matchId: 'g', publishedPct: 30, selection: 'Chelsea', rank: 3, provider: 'llm' })
  ];

  const snap = buildSnapshot(picks);
  const resolved = 5 + 3; // wins + losses (the push is not a resolved pick)

  it('counts only resolved picks in the win rate (pushes excluded)', () => {
    expect(snap.overall.picks).toBe(9);
    expect(snap.overall.wins).toBe(5);
    expect(snap.overall.losses).toBe(3);
    expect(snap.overall.pushes).toBe(1);
    expect(snap.overall.winRatePct).toBe(Math.round((5 / resolved) * 100));
  });

  it('reports the calibration gap as published % − realised win rate', () => {
    const meanPublished = Math.round((80 * 6 + 55 + 60 + 30) / 9);
    expect(snap.overall.avgPredictedPct).toBe(meanPublished);
    expect(snap.overall.calibrationGapPct).toBe(meanPublished - snap.overall.winRatePct);
  });

  it('buckets by signal band with per-band calibration', () => {
    const top = snap.byBand.find((b) => b.group === 'Top Signal')!;
    expect(top.picks).toBe(6);
    expect(top.wins).toBe(4);
    expect(top.losses).toBe(2);
    expect(top.calibrationGapPct).toBe(80 - top.winRatePct); // published 80 vs realised
    expect(snap.byBand.map((b) => b.group)).toEqual(['Top Signal', 'Qualifying', 'Reference Only']);
  });

  it('buckets by market, sport and consensus rank (Great AI Minds)', () => {
    expect(snap.byMarket.find((r) => r.group === 'Winner / Moneyline')!.picks).toBe(7);
    expect(snap.byMarket.find((r) => r.group === 'Total / Over-Under')!.picks).toBe(2);
    expect(snap.bySport.map((r) => r.group)).toContain('football');
    expect(snap.byRank.find((r) => r.group === 'Consensus pick #1')!.wins).toBe(5);
    expect(snap.byRank.find((r) => r.group === 'Consensus pick #2')!.pushes).toBe(1);
    expect(snap.byProvider.find((r) => r.group === 'llm')!.picks).toBe(1);
    expect(snap.byProvider.find((r) => r.group === 'deterministic')!.picks).toBe(8);
  });

  it('tracks units P&L at the same 0.95/−1 booking as the settlement engine', () => {
    expect(snap.overall.unitsPnl).toBe(Number((5 * 0.95 - 3).toFixed(1)));
    expect(snap.settledMatches).toBe(9);
  });

  it('hides a thin leaderboard sample until 5 graded picks exist', () => {
    expect(snap.rankings.every((r) => r.picks >= 5)).toBe(true);
    // football · Winner / Moneyline holds 7 graded picks — it qualifies.
    const footballWinner = snap.rankings.find((r) => r.group === 'football · Winner / Moneyline')!;
    expect(footballWinner).toBeDefined();
    expect(footballWinner.picks).toBe(7);
  });
});
