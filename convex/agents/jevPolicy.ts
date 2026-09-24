// ── Jev decision harness (policy + confidence gate) ──────────────────────────
// Layer between the raw Jev evaluation and the verdict. Turns Jev's typed
// answers into a POLICY DECISION that governs how the verdict is framed:
//   1. CONFIDENCE GATE — average answer confidence below the floor ⇒ the
//      verdict is demoted to REFERENCE ONLY (probability floor alone is no
//      longer sufficient).
//   2. RISK POLICY — a Jev risk score in the top band ⇒ reference-only framing
//      regardless of edge (volatile fixtures never become recommendations).
// The decision is stored on the verdict row so every downstream reader sees
// WHY a verdict carries (or lacks) recommendation weight.

import type { JevMatchResult } from './jevEvaluator';

export interface JevPolicyDecision {
  demoteToReference: boolean;
  gatePassed: boolean;
  avgConfidence: number | null;
  riskScore: number | null;
  notes: string[];
}

/** Average answer confidence below this ⇒ gate fails (reference-only verdict). */
export const JEV_CONFIDENCE_FLOOR = 0.55;
/** Risk score index at/above which the verdict is demoted (RISK_SCALE[3] = high). */
export const JEV_RISK_DEMOTE = 3;

export function evaluateJevPolicy(jev: JevMatchResult | null): JevPolicyDecision {
  if (!jev?.ok || !jev.evaluation?.answers) {
    return {
      demoteToReference: false,
      gatePassed: true,
      avgConfidence: null,
      riskScore: null,
      notes: ['Jev unavailable this cycle — probability floor alone governs the verdict.']
    };
  }

  const a = jev.evaluation.answers as Record<string, any>;
  const confidences: number[] = [];
  for (const ans of Object.values(a)) {
    if (ans && typeof ans.confidence === 'number' && Number.isFinite(ans.confidence)) {
      confidences.push(ans.confidence);
    }
  }
  const avgConfidence = confidences.length
    ? confidences.reduce((s, c) => s + c, 0) / confidences.length
    : null;

  const risk = a.risk_level;
  const riskScore = risk && risk.type === 'score' && typeof risk.score === 'number' ? risk.score : null;

  const gatePassed = avgConfidence === null || avgConfidence >= JEV_CONFIDENCE_FLOOR;

  let demoteToReference = false;
  const notes: string[] = [];

  if (!gatePassed) {
    demoteToReference = true;
    notes.push(
      `Jev confidence gate FAILED — average answer confidence ${((avgConfidence ?? 0) * 100).toFixed(0)}% is below the ${(JEV_CONFIDENCE_FLOOR * 100).toFixed(0)}% floor; verdict demoted to reference.`
    );
  }
  if (riskScore != null && riskScore >= JEV_RISK_DEMOTE) {
    demoteToReference = true;
    notes.push(
      `Jev risk policy: risk score ${riskScore.toFixed(2)} ≥ ${JEV_RISK_DEMOTE} — high-volatility fixture framed as reference only.`
    );
  }
  if (!demoteToReference) {
    notes.push(
      `Jev policy passed — confidence gate ${avgConfidence != null ? `(${(avgConfidence * 100).toFixed(0)}%)` : '(n/a)'} and risk policy clear.`
    );
  }

  return { demoteToReference, gatePassed, avgConfidence, riskScore, notes };
}

/** Extra steering instructions for the LLM when the policy demotes. */
export function policySteering(d: JevPolicyDecision): string[] {
  if (!d.demoteToReference) return [];
  return [
    'JEV POLICY DEMOTION: frame this verdict as REFERENCE ONLY — describe the read, but make explicitly clear that no staking recommendation is made and the structured evaluation did not reach recommendation confidence.'
  ];
}
