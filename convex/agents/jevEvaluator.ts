// ── Sports-domain Jev evaluator ──────────────────────────────────────────────
// Turns a match's cached scope (the de-vigged markets the SMOA pipeline
// stored) into typed Jev questions, evaluates them through convex/jev.ts
// (native typesafe/jev when provisioned, else the Workers AI adapter), and
// packs the result for storage on the verdict row.
//
// Consumers:
//   predictorOrchestrator — one evaluation per qualifying match, passed to the
//                           LLM as steering + stored as jevEvaluation
//   predictorPrompt.test.ts / audits — optional QA target
//
// Design rules:
//   • Questions are domain-typed (not freeform chat): one noul (value bet),
//     one choice (lead market), one score (risk), one noul (upset watch).
//   • The `state` is a compact, fully numeric digest of the REAL de-vigged
//     market data — Jev evaluates evidence, it does not scrape or guess.
//   • Every answer carries a mapped English phrase via answerPhrases() so the
//     LLM prompt (and the Copilot) quote Jev's decisions in plain language.

import { evaluateWithJev, type JevEvaluation, type JevQuestion } from '../jev';

const MARKET_CHOICE_OPTIONS = {
  result: '1X2 / moneyline outcome (straight win or draw)',
  totals: 'Over/Under total goals/points/rounds lines',
  handicap: 'Asian handicap / spread cover',
  btts: 'Both teams to score',
  double_chance: 'Two-outcome cover markets (1X / 12 / X2)',
  team_total: 'One team-specific total (Over 0.5 / team points)',
  half_total: '1st-half or 2nd-half total',
  none: 'No market stands out on this state — stay neutral'
} as const;

const RISK_SCALE = ['Low risk — high-certainty read', 'Moderate risk — normal staking', 'Elevated risk — reduce stake', 'High risk — volatile, avoid or minimal stake'];

export interface JevSteering {
  leadMarketHint: string;
  valueBetHint: string;
  upsetWatchHint: string;
  riskHint: string;
}

export interface JevMatchResult {
  ok: boolean;
  engine?: JevEvaluation['engine'];
  model?: string;
  evaluation?: JevEvaluation;
  steering?: JevSteering;
  phrases?: string[];
  error?: string;
}

function num(n: unknown, digits = 1): string {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(digits) : String(n);
}

// Compact numeric digest of the match's markets. Mirrors the de-vig math the
// verdict prompt uses (real win chance, implied, edge) so Jev reasons over the
// same evidence the LLM will see — one shared source of truth.
export function buildJevState(match: {
  homeTeam: string;
  awayTeam: string;
  league: string;
  scopes: unknown;
}): string {
  const markets = (match.scopes as any)?.markets ?? {};
  const parts: string[] = [];
  parts.push(`Fixture: ${match.homeTeam} vs ${match.awayTeam} (${match.league}).`);

  for (const [key, mkt] of Object.entries(markets) as [string, any][]) {
    const title = mkt?.title || key;
    if (Array.isArray(mkt?.pairs)) {
      for (const p of mkt.pairs.slice(0, 4)) {
        const over = Number(p?.over);
        const under = Number(p?.under);
        if (p?.line == null || !over || !under) continue;
        const invO = 1 / over;
        const invU = 1 / under;
        const sum = invO + invU;
        parts.push(
          `${title} line ${p.line}: Over @ ${num(over, 2)} (fair ${(invO / sum * 100).toFixed(1)}%, implied ${(invO * 100).toFixed(1)}%) vs Under @ ${num(under, 2)} (fair ${(invU / sum * 100).toFixed(1)}%).`
        );
      }
    }
    if (Array.isArray(mkt?.handicapPairs)) {
      for (const pair of mkt.handicapPairs.slice(0, 3)) {
        const a = Number(pair?.sideA);
        const b = Number(pair?.sideB);
        if (pair?.line == null || !a || !b) continue;
        const invA = 1 / a;
        const invB = 1 / b;
        const sum = invA + invB;
        parts.push(
          `${title} line ${pair.line}: Home @ ${num(a, 2)} (fair ${(invA / sum * 100).toFixed(1)}%) vs Away @ ${num(b, 2)} (fair ${(invB / sum * 100).toFixed(1)}%).`
        );
      }
    }
    if (mkt?.odds && typeof mkt.odds === 'object') {
      const entries = Object.entries(mkt.odds as Record<string, unknown>)
        .map(([k, o]) => ({ k, o: Number(o) }))
        .filter((e) => e.o > 1)
        .slice(0, 6);
      if (entries.length >= 2) {
        const invSum = entries.reduce((s, e) => s + 1 / e.o, 0);
        const legs = entries
          .map((e) => `${e.k} @ ${num(e.o, 2)} (fair ${(1 / e.o / invSum * 100).toFixed(1)}%, implied ${(1 / e.o * 100).toFixed(1)}%)`)
          .join('; ');
        parts.push(`${title}: ${legs}.`);
      }
    }
  }

  if (parts.length === 1) parts.push('No quantified markets available — evaluate on fixture context only.');
  return parts.join(' ');
}

// The typed question set every match is evaluated against.
export function buildJevQuestions(): Record<string, JevQuestion> {
  return {
    is_value_bet: {
      type: 'noul',
      instructions:
        'Does the strongest priced side on this state carry genuine punter value — i.e. its de-vigged fair probability meaningfully exceeds its implied probability (positive edge)?',
      criteria: {
        true: 'At least one side shows a positive edge of roughly +1% or more',
        false: 'All sides fairly priced or negative edge — no exploitable value'
      }
    },
    lead_market: {
      type: 'choice',
      instructions: 'Which market family should the analyst lead the verdict with for THIS fixture?',
      criteria: { ...MARKET_CHOICE_OPTIONS }
    },
    risk_level: {
      type: 'score',
      instructions: 'How risky is staking the top selection derived from this state?',
      criteria: RISK_SCALE
    },
    is_upset_watch: {
      type: 'noul',
      instructions:
        'Is this fixture an upset watch — i.e. could the less-favoured side plausibly win or draw, making short-priced favourites unsafe?',
      criteria: {
        true: 'Underdog/draw fair probability is material (roughly 25%+ combined)',
        false: 'Favourite dominance is clear across markets'
      }
    }
  };
}

// Map Jev's typed answers back to English steering phrases + storage.
export function interpretJevAnswers(evaluation: JevEvaluation): { steering: JevSteering; phrases: string[] } {
  const a = evaluation.answers ?? {};
  const steering: JevSteering = { leadMarketHint: '', valueBetHint: '', upsetWatchHint: '', riskHint: '' };
  const phrases: string[] = [];

  const lead = a.lead_market;
  if (lead && lead.type === 'choice') {
    const desc = (MARKET_CHOICE_OPTIONS as Record<string, string>)[lead.choice] ?? lead.choice;
    const conf = lead.confidence != null ? ` (Jev confidence ${num(lead.confidence * 100, 0)}%)` : '';
    steering.leadMarketHint = `Lead with the ${lead.choice} market family — ${desc}${conf}.`;
    phrases.push(`Jev routes the verdict to the ${lead.choice} market (${desc})${conf}.`);
  }

  const value = a.is_value_bet;
  if (value && value.type === 'noul') {
    const pct = num((value.noul ?? 0) * 100, 0);
    steering.valueBetHint =
      value.noul >= 0.5
        ? `Jev rates a genuine value bet present (noul ${pct}%).`
        : `Jev finds no exploitable value (noul ${pct}%) — favour probability over price.`;
    phrases.push(`Jev value check: ${steering.valueBetHint}`);
  }

  const risk = a.risk_level;
  if (risk && risk.type === 'score') {
    const idx = Math.max(0, Math.min(RISK_SCALE.length - 1, Math.round(risk.score)));
    steering.riskHint = `Jev risk score ${num(risk.score, 2)} — ${RISK_SCALE[idx]}.`;
    phrases.push(`Jev risk assessment: ${RISK_SCALE[idx]} (score ${num(risk.score, 2)}).`);
  }

  const upset = a.is_upset_watch;
  if (upset && upset.type === 'noul') {
    const pct = num((upset.noul ?? 0) * 100, 0);
    steering.upsetWatchHint =
      upset.noul >= 0.5
        ? `Jev flags upset watch (noul ${pct}%) — treat short favourite prices with caution.`
        : `Jev sees clear favourite dominance (upset noul ${pct}%).`;
    phrases.push(`Jev upset watch: ${steering.upsetWatchHint}`);
  }

  return { steering, phrases };
}

// One-shot: build → evaluate → interpret. Never throws.
export async function evaluateMatchWithJev(match: {
  homeTeam: string;
  awayTeam: string;
  league: string;
  scopes: unknown;
}): Promise<JevMatchResult> {
  try {
    const res = await evaluateWithJev(buildJevState(match), buildJevQuestions());
    if (!res.ok || !res.evaluation) {
      return { ok: false, error: res.error ?? 'jev evaluation failed' };
    }
    const { steering, phrases } = interpretJevAnswers(res.evaluation);
    return {
      ok: true,
      engine: res.evaluation.engine,
      model: res.evaluation.model,
      evaluation: res.evaluation,
      steering,
      phrases
    };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err).slice(0, 200) };
  }
}
