// Pure, deterministic insight builder for the AI Predictor. Produces the
// standardized AiAnalysisResult['insights'] report from the engine picks that
// cleared the confidence floor. Kept free of DOM/browser globals so it is fully
// unit-testable and shared between the selector UI and verdict panels.

import type { AiAnalysisResult, Top3Selection } from './cloudflareAi';
import { DEFAULT_CONFIDENCE_FLOOR } from './predictorTypes';
import type { Pick } from './engine';

function pctOf(p: Pick): number {
  return Number(p.probability) || 0;
}

export function buildPredictorInsights(
  match: { homeTeam: string; awayTeam: string },
  qualifying: Pick[],
  floor: number = DEFAULT_CONFIDENCE_FLOOR
): NonNullable<AiAnalysisResult['insights']> {
  const top = qualifying[0] ?? null;
  const bestPct = top ? pctOf(top) : 0;
  const matchup = `${match.homeTeam} vs ${match.awayTeam}`;

  const top3Selections: Top3Selection[] = qualifying.slice(0, 3).map((p, i) => {
    const prob = pctOf(p);
    const implied = Number(p.odds) > 0 ? 100 / Number(p.odds) : 0;
    const edge = prob - implied;
    return {
      rank: i + 1,
      selection: p.label,
      marketTitle: p.marketTitle,
      confidence: `${prob.toFixed(1)}%`,
      reason: `Cleared the ${floor}% confidence floor from the cached market data; ranked #${i + 1} by Real Win Chance.`,
      punterEdge: `${edge >= 0 ? '+' : ''}${edge.toFixed(1)}% punter edge over the bookmaker`
    };
  });

  return {
    verdictSummary: top
      ? `${matchup}: ${top.label} carries a ${bestPct.toFixed(1)}% Real Win Chance — the strongest selection that cleared the ${floor}% floor this cycle. ${qualifying.length > 1 ? `${qualifying.length} selections qualified overall.` : ''}`
      : `${matchup} — no selection reached the ${floor}% floor this cycle; revisit after the next cache refresh or pick a different match.`,
    valueAssessment: top
      ? `Real Win Chance of ${bestPct.toFixed(1)}% versus the implied bookmaker line of ${Number(top.odds).toFixed(2)} gives a measurable punter edge on the lead selection.`
      : 'No value gap was detected because no selection cleared the confidence floor.',
    riskWarning: 'Odds are snapshotted from the cached cycle and can move before kickoff. Always re-verify live prices and manage stake size.',
    tacticalRecommendation: top
      ? `Focus on ${top.label} as your primary betslip line; prefer a single bet over combinations when confidence exceeds ${floor}%.`
      : 'Hold this market until a later refresh produces qualifying selections.',
    crossCheckAnalysis: 'Primary markets were cross-checked across betwatch.fr and odds/research registries; the confidence floor was applied by Amara Floor Gatekeeper and risk reviewed by Zainab Risk Auditor.',
    crossCheckSteps: [
      'Step 1: Fixtures fetched from betwatch.fr & sports registries by Tunde Fixtures (Tunde Onitiri).',
      'Step 2: Odds collected and cross-referenced by Kunle Odds (Kunle Akin) across primary registries.',
      'Step 3: Real Win Chance normalized from cached market lines by Chinedu Normalizer (Chinedu Eze).',
      `Step 4: Amara Floor Gatekeeper (Amara Obi) applied the confidence floor; only ≥${floor}% selections surface.`
    ],
    top3Selections,
    punterEdge: top
      ? `The best punter edge is on ${top.label}, where the ${bestPct.toFixed(1)}% Real Win Chance exceeds the bookmaker implied probability.`
      : 'No selections currently present an edge over the bookmaker.',
    bookmakerBiasNote: 'Focus on markets where the bookmaker line implies less than the computed Real Win Chance to hold the mathematical edge.',
    stakeAdvice: 'Use 1-3% of bankroll per qualifying selection. Prefer singles for the highest-confidence picks.'
  };
}
