// ── AI performance data bank ──────────────────────────────────────────────────
// The monitoring loop the whole product exists for: every finished match is
// graded against its real final score and the outcome is STORED, so the AI
// models, engines and agent logics can be measured and improved over time.
//
// Four surfaces are computed deterministically (no LLM, no network) and
// persisted to Convex on every score-sync cycle:
//
//   • Daily Performance & Consensus Summary — graded picks, units PnL, ROI per
//     day + the market-consensus breakdown (MONEYLINE / SPREAD / TOTAL).
//   • Great AI Minds Performance — accuracy by pick rank (the debate's #1/#2/#3
//     consensus slots) and by verdict provider/model.
//   • Prediction Accuracy Monitoring — overall + per market + per sport hit
//     rates, always next to the AVERAGE PUBLISHED probability.
//   • Calibration by signal band — published % minus realised win rate per band
//     (Top Signal / Strong Signal / Qualifying / Reference Only); 0 = perfectly
//     calibrated, positive = over-confident.
//
// Storage shape: one row per (scope, dayKey) — scope 'day' for the day's own
// numbers, scope 'lifetime' (dayKey '') for the rolling aggregate derived from
// the stored day rows. The lifetime row is re-derived, never accumulated, so
// repeated score cycles can never double-count.

import { internalAction, internalMutation, internalQuery, mutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { requireAdmin } from './access';
import {
  SIGNAL_BANDS,
  bandOf,
  confidenceToPct,
  gradeSelection,
  isSpreadMarket,
  isTotalMarket,
  isWinnerMarket,
  type SignalBand
} from './predictorGrading';
import { watTodayKey } from './scrapers/sources';

const SPORTS = [
  'football',
  'basketball',
  'tennis',
  'rally',
  'hockey',
  'baseball',
  'americanfootball',
  'rugby',
  'cricket',
  'mma',
  'volleyball'
] as const;

const LIFETIME_WINDOW_DAYS = 45;

// ── Row shapes (stored as JSON in `data`) ─────────────────────────────────────

export interface AccuracyRowData {
  group: string;
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  winRatePct: number;
  avgPredictedPct: number;
  calibrationGapPct: number;
  unitsPnl: number;
  roiPct: number;
}

interface Bucket {
  picks: number;
  wins: number;
  losses: number;
  pushes: number;
  predictedSum: number;
  units: number;
}

const MARKET_LABELS: Record<string, string> = {
  winner: 'Winner / Moneyline',
  spread: 'Spread / Handicap',
  total: 'Total / Over-Under'
};

function emptyBucket(): Bucket {
  return { picks: 0, wins: 0, losses: 0, pushes: 0, predictedSum: 0, units: 0 };
}

function addToBucket(b: Bucket, grade: 'win' | 'loss' | 'push', publishedPct: number): void {
  b.picks += 1;
  b.predictedSum += publishedPct;
  if (grade === 'win') {
    b.wins += 1;
    b.units += 0.95;
  } else if (grade === 'loss') {
    b.losses += 1;
    b.units -= 1;
  } else {
    b.pushes += 1;
  }
}

function toRow(group: string, b: Bucket): AccuracyRowData {
  const resolved = b.wins + b.losses;
  const winRatePct = resolved > 0 ? Math.round((b.wins / resolved) * 100) : 0;
  const avgPredictedPct = b.picks > 0 ? Math.round(b.predictedSum / b.picks) : 0;
  return {
    group,
    picks: b.picks,
    wins: b.wins,
    losses: b.losses,
    pushes: b.pushes,
    winRatePct,
    avgPredictedPct,
    calibrationGapPct: b.picks > 0 ? Number((avgPredictedPct - winRatePct).toFixed(1)) : 0,
    unitsPnl: Number(b.units.toFixed(1)),
    roiPct: b.picks > 0 ? Number(((b.units / b.picks) * 100).toFixed(1)) : 0
  };
}

function bucketKeyForMarket(market: string): string {
  const lower = String(market || '').toLowerCase();
  if (isWinnerMarket(lower)) return MARKET_LABELS.winner;
  if (isSpreadMarket(lower)) return MARKET_LABELS.spread;
  if (isTotalMarket(lower)) return MARKET_LABELS.total;
  return 'Other markets';
}

// ── The pure aggregation (unit-testable, no ctx) ──────────────────────────────
// `matches` are cached predictorMatches rows; `verdictsOf(matchId)` returns the
// stored verdict for that match (or null). Only FINISHED matches with a real
// final score contribute.
export interface GradedPickInput {
  dayKey: string;
  sportId: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  finalScore: string;
  marketTitle: string;
  selection: string;
  rank: number;
  publishedPct: number | null;
  provider: string;
}

export function gradePick(p: GradedPickInput): 'win' | 'loss' | 'push' | null {
  return gradeSelection(p.selection, p.marketTitle, p.finalScore, {
    homeTeam: p.homeTeam,
    awayTeam: p.awayTeam
  });
}

export function buildSnapshot(picks: GradedPickInput[]): {
  overall: AccuracyRowData;
  byBand: AccuracyRowData[];
  byMarket: AccuracyRowData[];
  bySport: AccuracyRowData[];
  byRank: AccuracyRowData[];
  byProvider: AccuracyRowData[];
  rankings: AccuracyRowData[];
  settledMatches: number;
  gradedPicks: number;
} {
  const overall = emptyBucket();
  const bands = new Map<SignalBand, Bucket>(SIGNAL_BANDS.map((b) => [b, emptyBucket()]));
  const markets = new Map<string, Bucket>();
  const sports = new Map<string, Bucket>();
  const ranks = new Map<number, Bucket>();
  const providers = new Map<string, Bucket>();
  // Leaderboard grain: sport × market family — "which verdict family is ranking
  // consistently with good outcomes against real final scores".
  const leaderboard = new Map<string, Bucket>();
  const matchesSeen = new Set<string>();

  for (const p of picks) {
    const grade = gradePick(p);
    if (!grade) continue;
    const published = p.publishedPct ?? 0;
    matchesSeen.add(`${p.dayKey}|${p.matchId}`);

    addToBucket(overall, grade, published);

    const band = bandOf(p.publishedPct);
    addToBucket(bands.get(band)!, grade, published);

    const market = bucketKeyForMarket(p.marketTitle);
    addToBucket(markets.get(market) ?? markets.set(market, emptyBucket()).get(market)!, grade, published);

    addToBucket(sports.get(p.sportId) ?? sports.set(p.sportId, emptyBucket()).get(p.sportId)!, grade, published);

    const rankBucket = ranks.get(p.rank) ?? ranks.set(p.rank, emptyBucket()).get(p.rank)!;
    addToBucket(rankBucket, grade, published);

    const provider = p.provider || 'deterministic';
    addToBucket(providers.get(provider) ?? providers.set(provider, emptyBucket()).get(provider)!, grade, published);

    const boardKey = `${p.sportId} · ${market}`;
    addToBucket(leaderboard.get(boardKey) ?? leaderboard.set(boardKey, emptyBucket()).get(boardKey)!, grade, published);
  }

  const asRows = (m: Map<string, Bucket>) =>
    [...m.entries()].map(([k, b]) => toRow(k, b)).sort((a, b) => b.picks - a.picks);

  return {
    overall: toRow('All signals', overall),
    byBand: SIGNAL_BANDS.map((b) => toRow(b, bands.get(b)!)).filter((r) => r.picks > 0),
    byMarket: asRows(markets),
    bySport: asRows(sports),
    byRank: [...ranks.entries()]
      .map(([rank, b]) => toRow(`Consensus pick #${rank}`, b))
      .sort((a, b) => a.group.localeCompare(b.group)),
    byProvider: asRows(providers),
    // Ranked leaderboard: sample-weighted hit rate, requiring ≥5 graded picks so
    // a 1-for-1 debut can't top the board.
    rankings: [...leaderboard.entries()]
      .map(([k, b]) => toRow(k, b))
      .filter((r) => r.picks >= 5)
      .sort((a, b) => b.winRatePct - a.winRatePct || b.picks - a.picks),
    settledMatches: matchesSeen.size,
    gradedPicks: picks.length
  };
}

function mergeRows(rows: AccuracyRowData[]): AccuracyRowData[] {
  const merged = new Map<string, Bucket>();
  for (const r of rows) {
    const b = merged.get(r.group) ?? emptyBucket();
    b.picks += r.picks;
    b.wins += r.wins;
    b.losses += r.losses;
    b.pushes += r.pushes;
    b.predictedSum += r.avgPredictedPct * r.picks;
    b.units += r.unitsPnl;
    merged.set(r.group, b);
  }
  return [...merged.entries()].map(([k, b]) => toRow(k, b)).sort((a, b) => b.picks - a.picks);
}

interface SnapshotData {
  overall: AccuracyRowData;
  byBand: AccuracyRowData[];
  byMarket: AccuracyRowData[];
  bySport: AccuracyRowData[];
  byRank: AccuracyRowData[];
  byProvider: AccuracyRowData[];
  rankings: AccuracyRowData[];
  settledMatches: number;
  gradedPicks: number;
  consensus?: unknown[];
  daysAggregated?: number;
  generatedAt: number;
}

// ── Persistence ───────────────────────────────────────────────────────────────

export const saveStatsSnapshot = internalMutation({
  args: {
    scope: v.union(v.literal('day'), v.literal('lifetime')),
    dayKey: v.string(),
    settledMatches: v.number(),
    gradedPicks: v.number(),
    data: v.any()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('predictorStatsSnapshots')
      .withIndex('by_scope_day', (q) => q.eq('scope', args.scope).eq('dayKey', args.dayKey))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        settledMatches: args.settledMatches,
        gradedPicks: args.gradedPicks,
        data: args.data,
        updatedAt: now
      });
      return existing._id;
    }
    return await ctx.db.insert('predictorStatsSnapshots', {
      scope: args.scope,
      dayKey: args.dayKey,
      settledMatches: args.settledMatches,
      gradedPicks: args.gradedPicks,
      data: args.data,
      updatedAt: now
    });
  }
});

export const listDaySnapshots = internalQuery({
  args: { limit: v.optional(v.number()), fromDay: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? LIFETIME_WINDOW_DAYS, 1), 120);
    const rows = await ctx.db
      .query('predictorStatsSnapshots')
      .withIndex('by_scope_day', (q) => q.eq('scope', 'day'))
      .order('desc')
      .take(limit);
    if (!args.fromDay) return rows;
    return rows.filter((r) => r.dayKey >= args.fromDay!);
  }
});

// ── Recomputation ─────────────────────────────────────────────────────────────
// One day at a time (bounded reads), then the lifetime row re-derived from the
// stored day rows. Safe to run on every score-sync cycle: day rows are upserted,
// the lifetime row is recomputed, never incremented.
export const recomputeStatsSnapshot = internalAction({
  args: { dayKey: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ dayKey: string; gradedPicks: number; settledMatches: number }> => {
    const dayKey = args.dayKey || watTodayKey();
    const picks: GradedPickInput[] = [];
    let settledMatches = 0;

    for (const sportId of SPORTS) {
      try {
        const matches = await ctx.runQuery(internal.predictor.getCachedMatches, { sportId, dayKey });
        if (!matches || matches.length === 0) continue;
        const matchIds = new Set(
          matches
            .filter((m: any) => (m.status === 'finished' || !!m.finalScore) && !!m.finalScore)
            .map((m: any) => m.matchId)
        );
        if (matchIds.size === 0) continue;
        settledMatches += matchIds.size;

        const verdicts = await ctx.runQuery(internal.predictor.getVerdictsForDay, { sportId, dayKey });
        for (const vd of verdicts) {
          if (!matchIds.has(vd.matchId)) continue;
          const match = matches.find((m: any) => m.matchId === vd.matchId) as any;
          if (!match) continue;
          const finalScore = String(match.finalScore || match.oddsSnapshot?.finalScore || '');
          if (!finalScore) continue;
          const top3 = Array.isArray(vd.aiReport?.top3Selections) ? vd.aiReport.top3Selections : [];
          top3.forEach((t: any, idx: number) => {
            const selection = String(t?.selection ?? '').trim();
            const marketTitle = String(t?.marketTitle ?? 'Core Market');
            if (!selection) return;
            picks.push({
              dayKey,
              sportId,
              matchId: vd.matchId,
              homeTeam: String(match.homeTeam ?? ''),
              awayTeam: String(match.awayTeam ?? ''),
              finalScore,
              marketTitle,
              selection,
              rank: Number(t?.rank) > 0 ? Number(t.rank) : idx + 1,
              publishedPct: confidenceToPct(t?.confidence),
              provider: String(vd.llmProvider || (vd.llmUsed ? 'llm' : 'deterministic'))
            });
          });
        }
      } catch (err: any) {
        console.warn(`[Stats] ${sportId}/${dayKey}:`, err?.message || err);
      }
    }

    const snapshot = buildSnapshot(picks);
    const consensus = await ctx.runQuery(internal.predictor.getDailyPnlRows, { dayKey }).catch(() => []);
    const dayData: SnapshotData = {
      ...snapshot,
      consensus: consensus.map((c: any) => ({
        filter: c.filter,
        winRatePct: c.overallWinRatePct,
        unitsPnl: c.overallUnitsPnl,
        roiPct: c.overallRoiPct,
        rows: c.rows ?? []
      })),
      generatedAt: Date.now()
    };
    await ctx.runMutation(internal.predictorStats.saveStatsSnapshot, {
      scope: 'day',
      dayKey,
      settledMatches: snapshot.settledMatches,
      gradedPicks: snapshot.gradedPicks,
      data: dayData
    });

    // Lifetime: re-derive from the stored day rows (never accumulate).
    const dayRows = await ctx.runQuery(internal.predictorStats.listDaySnapshots, {
      limit: LIFETIME_WINDOW_DAYS
    });
    const rowsOf = (key: 'byBand' | 'byMarket' | 'bySport' | 'byRank' | 'byProvider' | 'rankings') =>
      mergeRows(dayRows.flatMap((r: any) => (Array.isArray(r.data?.[key]) ? r.data[key] : [])));
    const lifetime = mergeRows(dayRows.map((r: any) => r.data?.overall).filter(Boolean));
    const lifetimeOverall: AccuracyRowData =
      lifetime[0] ?? toRow('All signals', emptyBucket());
    const lifetimeData: SnapshotData = {
      overall: lifetimeOverall,
      byBand: rowsOf('byBand'),
      byMarket: rowsOf('byMarket'),
      bySport: rowsOf('bySport'),
      byRank: rowsOf('byRank'),
      byProvider: rowsOf('byProvider'),
      rankings: mergeRows(
        dayRows.flatMap((r: any) => (Array.isArray(r.data?.rankings) ? r.data.rankings : []))
      )
        .filter((r) => r.picks >= 5)
        .sort((a, b) => b.winRatePct - a.winRatePct || b.picks - a.picks),
      settledMatches: dayRows.reduce((n: number, r: any) => n + (r.settledMatches ?? 0), 0),
      gradedPicks: dayRows.reduce((n: number, r: any) => n + (r.gradedPicks ?? 0), 0),
      daysAggregated: dayRows.length,
      generatedAt: Date.now()
    };
    await ctx.runMutation(internal.predictorStats.saveStatsSnapshot, {
      scope: 'lifetime',
      dayKey: '',
      settledMatches: lifetimeData.settledMatches,
      gradedPicks: lifetimeData.gradedPicks,
      data: lifetimeData
    });

    return { dayKey, gradedPicks: snapshot.gradedPicks, settledMatches: snapshot.settledMatches };
  }
});

// Admin ops entry point: recompute the data bank on demand (the same work the
// score-sync cycle and the hourly cron perform).
export const requestRecompute = mutation({
  args: { dayKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const dayKey = args.dayKey || watTodayKey();
    await ctx.scheduler.runAfter(0, internal.predictorStats.recomputeStatsSnapshot, { dayKey });
    return { scheduled: true, dayKey };
  }
});

// ── Admin read surface (super admin only) ─────────────────────────────────────

export const getSnapshot = query({
  args: {
    scope: v.union(v.literal('day'), v.literal('lifetime')),
    dayKey: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query('predictorStatsSnapshots')
      .withIndex('by_scope_day', (q) =>
        q.eq('scope', args.scope).eq('dayKey', args.scope === 'lifetime' ? '' : (args.dayKey ?? watTodayKey()))
      )
      .first();
  }
});

export const getHistory = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const days = Math.min(Math.max(args.days ?? 14, 1), 90);
    return await ctx.db
      .query('predictorStatsSnapshots')
      .withIndex('by_scope_day', (q) => q.eq('scope', 'day'))
      .order('desc')
      .take(days);
  }
});
