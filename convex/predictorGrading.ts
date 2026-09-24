// ── Pure post-match grading ───────────────────────────────────────────────────
// The market classifier + selection grader used by BOTH the P&L settlement
// (scores.ts) and the persisted accuracy/calibration snapshot
// (predictorStats.ts). Kept dependency-free and side-effect-free so the two
// engines can never drift: a pick graded a "win" for the P&L is the same "win"
// the accuracy monitor counts.

export type SelectionGrade = 'win' | 'loss' | 'push' | null;

export type MarketFilter = 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL';

export const SETTLE_FILTERS: readonly MarketFilter[] = ['ALL', 'MONEYLINE', 'SPREAD', 'TOTAL'];

export function parseScore(score?: string | null): { home: number; away: number } | null {
  if (!score) return null;
  const m = String(score).trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

export function isWinnerMarket(market: string): boolean {
  return /winner|moneyline|result|matchwinner|regresult|1x2|match.?.?.?.?winner/i.test(market);
}
export function isSpreadMarket(market: string): boolean {
  return /handicap|spread|line|puck|runline|sell/i.test(market);
}
export function isTotalMarket(market: string): boolean {
  return (
    /total|over.?under|main|homeAway|game|set.?total|points|goals|runs/i.test(market) &&
    !isSpreadMarket(market)
  );
}
export function extractThreshold(text: string): number | null {
  const m = String(text).match(/(-?\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

/**
 * Grade one stored selection against the real final score. Returns null when the
 * market cannot be classified or the scoreline is missing — an ungradeable pick
 * is excluded from both P&L and accuracy rather than counted as a loss.
 */
export function gradeSelection(
  selection: string,
  market: string,
  finalScore?: string | null,
  opts?: { homeTeam?: string; awayTeam?: string }
): SelectionGrade {
  const score = parseScore(finalScore);
  if (!score) return null;

  const lower = String(market || '').toLowerCase();
  const sel = String(selection || '');

  if (isTotalMarket(lower)) {
    const side = /home/.test(lower) ? score.home : /away/.test(lower) ? score.away : score.home + score.away;
    const threshold = extractThreshold(sel);
    if (threshold == null) return null;
    if (/(^|\s)over[\s\S]*/i.test(sel)) {
      if (side > threshold) return 'win';
      if (side === threshold) return 'push';
      return 'loss';
    }
    if (side < threshold) return 'win';
    if (side === threshold) return 'push';
    return 'loss';
  }

  if (isWinnerMarket(lower)) {
    const lowerSel = sel.toLowerCase();
    const home = opts?.homeTeam?.toLowerCase();
    const away = opts?.awayTeam?.toLowerCase();
    if (/(^|\s)draw/i.test(lowerSel)) {
      return score.home === score.away ? 'win' : 'loss';
    }
    const isHome = home ? lowerSel.includes(home) : /home|^\d\s|\bteam\s*a\b|^1\b/i.test(lowerSel);
    const isAway = isHome ? false : away ? lowerSel.includes(away) : /away|team\s*b|^2\b/i.test(lowerSel);
    if (isHome) return score.home > score.away ? 'win' : 'loss';
    if (isAway) return score.away > score.home ? 'win' : 'loss';
    return null;
  }

  if (isSpreadMarket(lower)) {
    const threshold = extractThreshold(sel);
    if (threshold == null) return null;
    const lowerSel = sel.toLowerCase();
    const home = opts?.homeTeam?.toLowerCase();
    const away = opts?.awayTeam?.toLowerCase();
    const isHome = home ? lowerSel.includes(home) : /home|^1\b/.test(lowerSel);
    const isAway = home ? lowerSel.includes(away ?? '') : /away|^2\b/.test(lowerSel);
    const base = isAway ? score.away : score.home;
    const other = isAway ? score.home : score.away;
    const adjusted = base + threshold;
    if (adjusted > other) return 'win';
    if (adjusted === other) return 'push';
    return 'loss';
  }

  return null;
}

export function marketFilterOf(market: string): MarketFilter {
  const lower = String(market || '').toLowerCase();
  if (isWinnerMarket(lower)) return 'MONEYLINE';
  if (isSpreadMarket(lower)) return 'SPREAD';
  if (isTotalMarket(lower)) return 'TOTAL';
  return 'ALL';
}

// ── Signal bands & published-probability parsing ──────────────────────────────
// Mirrors the client monitor (src/lib/predictorAccuracy.ts bandOf): the band a
// pick belongs to is decided by the probability the verdict PUBLISHED, so the
// calibration gap (published % − realised win rate) is meaningful per band.
export type SignalBand = 'Top Signal' | 'Strong Signal' | 'Qualifying' | 'Reference Only';

export const SIGNAL_BANDS: readonly SignalBand[] = [
  'Top Signal',
  'Strong Signal',
  'Qualifying',
  'Reference Only'
];

export function confidenceToPct(confidence: unknown): number | null {
  if (typeof confidence === 'number' && Number.isFinite(confidence)) {
    return Math.max(0, Math.min(100, confidence));
  }
  const m = String(confidence ?? '').match(/(\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, v));
}

export function bandOf(publishedPct: number | null, verdictTag?: string): SignalBand {
  if (verdictTag === 'Reference Only') return 'Reference Only';
  if (publishedPct == null) return 'Reference Only';
  if (publishedPct >= 75) return 'Top Signal';
  if (publishedPct >= 65) return 'Strong Signal';
  if (publishedPct >= 52) return 'Qualifying';
  return 'Reference Only';
}
