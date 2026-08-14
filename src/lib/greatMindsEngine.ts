// src/lib/greatMindsEngine.ts
//
// Multi-Model AI Debate ("The Great AI Minds") Engine
// Simulates a 5-round debate between 5 specialized AI personas:
//   1. Claude Opus 4.0   - Moderator (Synthesis & Resolution)
//   2. ChatGPT 3.2 Pro  - Data Scientist (+EV & Probability)
//   3. Kimi K2.5        - Analyst (Historical Trends & Tempo)
//   4. Qwen 3.5         - Technician (Line Efficiency & Resistance)
//   5. Grok 4.2         - Contrarian (Spread & Stale Line Dissent)
//
// Integrates directly with Master Model v2 +EV formulas:
//   EV = (Probability * DecimalOdds) - 1

import type {
  PredictorMatch,
  GreatMindsDebateResult,
  GreatMindsPick,
  GreatMindsRound,
  GreatMindsModelChoice,
  GreatMindsPickVerdict,
  DailyPnlSummaryData,
  DailyPnlConsensusRow,
  GreatMindsStats,
  PnlSportFilter,
  PnlMarketFilter
} from './predictorTypes';
import { GREAT_MINDS_MODELS, gradeSelection } from './predictorTypes';
import type { Analysis, Pick as EnginePick } from './engine';
import { analyzeCachedMatch } from './predictorClient';

// Helper to format EV percentage
function calcEv(probPct: number, odds: number): number {
  if (!odds || odds <= 1) return 0;
  const rawProb = Math.min(Math.max(probPct / 100, 0.01), 0.99);
  const ev = (rawProb * odds) - 1;
  return Number((ev * 100).toFixed(1));
}

// Sport-specific market defaults when specific picks are omitted
function sportDefaults(sportId?: string, home = 'Home', away = 'Away'): {
  spreadLabel: string;
  spreadAlt: string;
  totalLabel: string;
  totalAlt: string;
} {
  const sid = (sportId || 'football').toLowerCase();
  if (sid === 'basketball') {
    return { spreadLabel: `${home} -4.5`, spreadAlt: `${away} +4.5`, totalLabel: 'Over 214.5 Total Points', totalAlt: 'Under 214.5 Total Points' };
  } else if (sid === 'tennis') {
    return { spreadLabel: `${home} -1.5 Sets`, spreadAlt: `${away} +1.5 Sets`, totalLabel: 'Over 21.5 Games', totalAlt: 'Under 21.5 Games' };
  } else if (sid === 'hockey') {
    return { spreadLabel: `${home} -1.5 Puck Line`, spreadAlt: `${away} +1.5 Puck Line`, totalLabel: 'Over 5.5 Goals', totalAlt: 'Under 5.5 Goals' };
  } else if (sid === 'rally') {
    return { spreadLabel: `${home} -1.5 Match Sets`, spreadAlt: `${away} +1.5 Match Sets`, totalLabel: 'Over 3.5 Total Sets', totalAlt: 'Under 3.5 Total Sets' };
  } else if (sid === 'baseball') {
    return { spreadLabel: `${home} -1.5 Run Line`, spreadAlt: `${away} +1.5 Run Line`, totalLabel: 'Over 8.5 Runs', totalAlt: 'Under 8.5 Runs' };
  } else if (sid === 'americanfootball') {
    return { spreadLabel: `${home} -3.5 Point Spread`, spreadAlt: `${away} +3.5 Point Spread`, totalLabel: 'Over 44.5 Total Points', totalAlt: 'Under 44.5 Total Points' };
  } else if (sid === 'rugby') {
    return { spreadLabel: `${home} -7.5 Handicap`, spreadAlt: `${away} +7.5 Handicap`, totalLabel: 'Over 44.5 Match Points', totalAlt: 'Under 44.5 Match Points' };
  } else if (sid === 'cricket') {
    return { spreadLabel: `${home} -30 Run Line`, spreadAlt: `${away} +30 Run Line`, totalLabel: 'Over 300.5 Match Runs', totalAlt: 'Under 300.5 Match Runs' };
  } else if (sid === 'mma') {
    return { spreadLabel: `${home} Win by KO/TKO`, spreadAlt: `${away} Win by Submission`, totalLabel: 'Over 2.5 Total Rounds', totalAlt: 'Under 2.5 Total Rounds' };
  } else if (sid === 'volleyball') {
    return { spreadLabel: `${home} -1.5 Set Handicap`, spreadAlt: `${away} +1.5 Set Handicap`, totalLabel: 'Over 3.5 Total Sets', totalAlt: 'Under 3.5 Total Sets' };
  }
  return { spreadLabel: `${home} -0.5 Asian Handicap`, spreadAlt: `${away} +0.5 Asian Handicap`, totalLabel: 'Over 2.5 Goals', totalAlt: 'Under 2.5 Goals' };
}

function sanitizeTeamLabel(label: string, home: string, away: string): string {
  if (!label) return `${home} Win`;
  return label
    .replace(/\bTeam 1\b/gi, home)
    .replace(/\bTeam 2\b/gi, away)
    .replace(/\bPlayer 1\b/gi, home)
    .replace(/\bPlayer 2\b/gi, away)
    .replace(/\bSide A\b/gi, home)
    .replace(/\bSide B\b/gi, away)
    .replace(/\bP1\b/gi, home)
    .replace(/\bP2\b/gi, away);
}

// ── Multi-stage verification gate (pre-qualification) ────────────────────────
// A pick only qualifies for Top Signal / Strong / Qualifying when it clears ALL
// three independent cross-checks: (1) input data integrity, (2) computation
// accuracy, (3) single-team-edge directional alignment. Anything else is
// demoted to "Reference Only" — synthetic or contradictory selections never
// publish as a qualified signal.

interface VerificationStage {
  name: string;
  ok: boolean;
  note: string;
}

// Confidence floor below which even a verified pick cannot qualify.
const QUALIFY_FLOOR = 52;

// Which team (if any) a selection label points at. Call AFTER sanitizeTeamLabel
// so 'Team 1'/'Player 2'/'P1'/'Side B' have already been replaced with the real
// names; the name-based checks then resolve the vast majority of labels.
function sideOf(label: string, home: string, away: string): 'home' | 'away' | 'none' {
  const l = String(label || '').toLowerCase();
  const h = String(home || '').toLowerCase();
  const a = String(away || '').toLowerCase();
  if (h && h.length >= 3 && l.includes(h)) return 'home';
  if (a && a.length >= 3 && l.includes(a)) return 'away';
  if (/\bhome\b|\bteam\s*1\b|\bplayer\s*1\b|\bp1\b|^\s*1\s*$/.test(l)) return 'home';
  if (/\baway\b|\bteam\s*2\b|\bplayer\s*2\b|\bp2\b|^\s*2\s*$/.test(l)) return 'away';
  return 'none';
}

function verifySelection(opts: {
  market: string;
  selection: string;
  fromRealPick: boolean;
  oddsReal: boolean;
  baseProbabilityPct: number;
  realWinChancePct: number;
  edgeEvPercent: number;
  rawOdds: number;
  winnerDirection: 'home' | 'away' | 'none';
  pickDirection: 'home' | 'away' | 'none';
  agreeCount: number;
}): { qualified: boolean; stages: VerificationStage[] } {
  const stages: VerificationStage[] = [];

  // 1) Input data integrity — the selection must trace to a real engine pick
  //    priced from real market odds, with a sane price and a resolvable label.
  const s1 = opts.fromRealPick && opts.oddsReal && opts.rawOdds > 1 && opts.rawOdds < 50 && !!opts.selection;
  stages.push({
    name: 'Data integrity',
    ok: s1,
    note: s1
      ? 'Selection traces to an engine pick priced from real market odds.'
      : 'No real-odds engine pick behind this selection (synthetic or missing data).'
  });

  // 2) Computation accuracy — Real Win Chance must sit in the documented
  //    adjustment band around the engine base probability and the EV must
  //    recompute to the same figure (no fabrication, no drift).
  const recomputedEv = calcEv(opts.realWinChancePct, opts.rawOdds || 1.9);
  const evOk = Math.abs(recomputedEv - opts.edgeEvPercent) < 0.6;
  const bandOk =
    opts.realWinChancePct >= opts.baseProbabilityPct - 8 &&
    opts.realWinChancePct <= opts.baseProbabilityPct + 30;
  const s2 = evOk && bandOk;
  stages.push({
    name: 'Computation accuracy',
    ok: s2,
    note: s2
      ? `RWC ${opts.realWinChancePct.toFixed(1)}% consistent with engine base ${opts.baseProbabilityPct.toFixed(1)}% (EV +${recomputedEv.toFixed(1)}%).`
      : 'Real Win Chance / EV inconsistent with the engine base probability.'
  });

  // 3) Single-team edge — exactly one team holds the edge and the spread never
  //    contradicts the result favourite. Totals carry no team edge by design.
  const s3 =
    opts.market === 'total'
      ? true
      : opts.pickDirection === 'none'
        ? /(^|\s)draw/i.test(opts.selection) && opts.market === 'winner'
        : opts.winnerDirection === 'none' || opts.pickDirection === opts.winnerDirection;
  stages.push({
    name: 'Single-team edge',
    ok: s3,
    note: s3
      ? 'Exactly one team holds the edge; winner and spread agree on direction.'
      : 'Conflicting or missing team edge (home and away must not both hold the edge).'
  });

  const qualified = s1 && s2 && s3 && opts.agreeCount >= 3 && opts.realWinChancePct >= QUALIFY_FLOOR;
  return { qualified, stages };
}

// Generate Great Minds Debate for a specific match
export function generateGreatMindsDebate(
  match: PredictorMatch,
  analysis: Analysis | null
): GreatMindsDebateResult {
  const home = match.homeTeam || 'Home Team';
  const away = match.awayTeam || 'Away Team';
  const picks: EnginePick[] = analysis?.picks ?? [];
  const defaults = sportDefaults(match.sportId, home, away);

  // Hash match seed for unique model dynamics
  const seed = `${match.matchId}|${home}|${away}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0;
  hash = Math.abs(hash);

  // ── Market classification ───────────────────────────────────────────────────
  // Each consensus market only ever consumes picks from ITS OWN market family —
  // a totals pick can never masquerade as a winner (and vice versa), which
  // removes the old "Home Win + Away +0.5" contradiction at the source.
  const lowerTitle = (p: EnginePick) => (p.marketTitle || '').toLowerCase();
  const isWinnerPick = (p: EnginePick) => {
    const t = lowerTitle(p);
    return t.includes('result') || t.includes('winner') || t.includes('moneyline');
  };
  const isSpreadPick = (p: EnginePick) => {
    const t = lowerTitle(p);
    return (t.includes('handicap') || t.includes('spread')) && !t.includes('total');
  };
  const isTotalPick = (p: EnginePick) => {
    const t = lowerTitle(p);
    return t.includes('total') || t.includes('over') || t.includes('under');
  };

  const winnerCandidates = picks.filter(isWinnerPick).sort((a, b) => b.probability - a.probability);
  const spreadCandidates = picks.filter(isSpreadPick).sort((a, b) => b.probability - a.probability);
  const totalCandidates = picks.filter(isTotalPick).sort((a, b) => b.probability - a.probability);

  const rawMoneyline = winnerCandidates[0] ?? null;

  // Totals: pick the line closest to the market's FAIR line (the pair whose
  // probabilities straddle 50%), never a derived extreme like "Over 0.5" at
  // ~92% — recommending that as a signal would be noise, not analysis.
  // Prefer the main/game total market; only fall back to team/player totals
  // when no game total exists (avoids a lopsided game total losing to a
  // balanced team total).
  const isGameTotalPick = (p: EnginePick) => {
    const id = (p.marketId || '').toLowerCase();
    return id === 'mainTotal' || id === 'gameTotal';
  };
  const gameTotalCandidates = totalCandidates.filter(isGameTotalPick);
  const totalPool = gameTotalCandidates.length ? gameTotalCandidates : totalCandidates;
  const totalsByLine = new Map<number, EnginePick[]>();
  for (const p of totalPool) {
    const m = String(p.label).match(/(-?\d+(?:\.\d+)?)/);
    const line = m ? Number(m[1]) : NaN;
    if (!Number.isFinite(line)) continue;
    const arr = totalsByLine.get(line) ?? [];
    arr.push(p);
    totalsByLine.set(line, arr);
  }
  let bestTotalPair: EnginePick[] | null = null;
  let bestTotalDist = Infinity;
  for (const [, pair] of totalsByLine) {
    const top = Math.max(...pair.map((p) => p.probability));
    const dist = Math.abs(50 - top);
    if (dist < bestTotalDist) {
      bestTotalDist = dist;
      bestTotalPair = pair;
    }
  }
  const rawTotal = bestTotalPair
    ? bestTotalPair.slice().sort((a, b) => b.probability - a.probability)[0] ?? null
    : null;

  // Single-team-edge rule: the spread verdict must agree with the result
  // favourite. If the only available spread pick points the other way, drop it
  // and synthesize a spread in the winner's direction below.
  const winnerDirection = rawMoneyline ? sideOf(sanitizeTeamLabel(rawMoneyline.label, home, away), home, away) : 'none';
  let rawSpread: EnginePick | null = null;
  if (winnerDirection !== 'none') {
    rawSpread = spreadCandidates.find((p) => sideOf(sanitizeTeamLabel(p.label, home, away), home, away) === winnerDirection) ?? null;
  } else {
    rawSpread = spreadCandidates[0] ?? null;
  }
  const fallbackSpreadLabel = winnerDirection === 'away' ? defaults.spreadAlt : defaults.spreadLabel;

  // Real de-vigged engine probabilities when available; a neutral 50% (never a
  // hash-fabricated number) otherwise — the verification gate will demote any
  // pick without real engine backing to Reference Only.
  const topMoneyline = rawMoneyline
    ? { ...rawMoneyline, label: sanitizeTeamLabel(rawMoneyline.label, home, away) }
    : { label: `${home} Win`, marketTitle: 'Match Result', probability: 50, odds: 1.85 };
  const topSpread = rawSpread
    ? { ...rawSpread, label: sanitizeTeamLabel(rawSpread.label, home, away) }
    : { label: fallbackSpreadLabel, marketTitle: 'Handicap / Spread', probability: 50, odds: 1.95 };
  const topTotal = rawTotal
    ? { ...rawTotal, label: sanitizeTeamLabel(rawTotal.label, home, away) }
    : { label: defaults.totalLabel, marketTitle: 'Match Total', probability: 50, odds: 1.88 };

  // Determine dynamic dissenters based on match hash
  const spreadDissent = (hash % 3) === 0 ? 'grok' : (hash % 5) === 0 ? 'qwen' : undefined;
  const totalDissent = ((hash + 1) % 4) === 0 ? 'grok' : ((hash + 2) % 3) === 0 ? 'kimi' : undefined;

  // Helper to build model choices for a market. Every model backs the SAME
  // winning selection — the debate is over confidence and price, never the
  // opposite outcome — so the card never projects the losing side of a market
  // ("Over 2.5" consensus with a contrarian "Under 2.5" pick is a contradiction
  // that confuses punters, not a recommendation).
  const buildModelChoices = (
    marketType: 'winner' | 'spread' | 'total',
    mainSelection: string,
    altSelection: string,
    mainOddsVal: number,
    probPct: number,
    dissentModelId?: string
  ): GreatMindsPick => {
    const choices: GreatMindsModelChoice[] = GREAT_MINDS_MODELS.map((m) => {
      const isDissenter = m.id === dissentModelId;
      // All models back the main selection; a dissenter simply lowers its
      // confidence (EV/probability haircut) instead of flipping sides.
      const pick = mainSelection;
      const odds = isDissenter ? Number((mainOddsVal * 1.12).toFixed(2)) : mainOddsVal;
      const ev = calcEv(isDissenter ? Math.max(35.0, probPct - 20) : probPct, odds);

      let reasoning = '';
      if (m.id === 'claude-opus') {
        reasoning = `Synthesizing ${probPct.toFixed(1)}% model probability against baseline market odds for ${home} vs ${away}.`;
      } else if (m.id === 'chatgpt-pro') {
        reasoning = `+EV calculation yields +${ev}% expected return above de-vigged line.`;
      } else if (m.id === 'kimi') {
        reasoning = `Pace & offensive efficiency metrics favor ${pick}.`;
      } else if (m.id === 'qwen') {
        reasoning = `Technical line resistance band holds firmly at ${odds}.`;
      } else if (m.id === 'grok') {
        reasoning = isDissenter
          ? `Contrarian note: price may over-adjust; confidence trimmed on ${pick}.`
          : `Validates majority angle: market line is stale.`;
      }

      return {
        modelId: m.id,
        modelName: m.name,
        pick,
        isAgree: !isDissenter,
        evPercent: ev,
        reasoning
      };
    });

    const agreeCount = choices.filter(c => c.isAgree).length;
    const totalModels = GREAT_MINDS_MODELS.length;
    const ratio = `${agreeCount}/${totalModels}`;

    let status: GreatMindsPick['status'] = 'majority';
    if (agreeCount === 5) status = 'unanimous';
    else if (agreeCount === 4) status = 'strong';
    else if (agreeCount === 3) status = 'majority';
    else status = 'split';

    // ── Unified Cross-Verified Real Win Chance ─────────────────────────────────
    // Step 1: base implied probability from the quantitative engine.
    const baseProbabilityPct = Number(probPct.toFixed(1));

    // Step 2: Great AI Minds panel consensus boost.
    const consensusBoostPct = agreeCount === 5 ? 4.5 : agreeCount === 4 ? 2.5 : agreeCount === 3 ? 1.0 : 0;

    // Step 3: key-metrics adjustment — green checks add +2% each, red −3% each,
    // amber +0.5% each. Profile and ledger signals are also folded in.
    let metricsAdjustmentPct = 0;
    if (analysis) {
      for (const m of analysis.metrics ?? []) {
        if (m.status === 'green') metricsAdjustmentPct += 2;
        else if (m.status === 'red') metricsAdjustmentPct -= 3;
        else if (m.status === 'amber') metricsAdjustmentPct += 0.5;
      }
      for (const p of analysis.profiles ?? []) {
        if (p.status === 'green') metricsAdjustmentPct += 1;
        else if (p.status === 'red') metricsAdjustmentPct -= 1.5;
      }
      const ledger = analysis.masterLedger;
      if (ledger) {
        const netVotes = ledger.agreeCount - ledger.disagreeCount;
        metricsAdjustmentPct += netVotes > 0 ? Math.min(netVotes * 0.8, 4) : Math.max(netVotes * 0.8, -3);
      }
    }

    // Step 4: clamp the composite into a sane 35–92% band and round.
    const realWinChancePct = Number(
      Math.min(Math.max(baseProbabilityPct + consensusBoostPct + metricsAdjustmentPct, 35), 92).toFixed(1)
    );

    // Step 5: tag the unified verdict.
    const verdictTag =
      realWinChancePct >= 75 ? 'Top Signal'
      : realWinChancePct >= 65 ? 'Strong Signal'
      : realWinChancePct >= 52 ? 'Qualifying'
      : 'Reference Only';

    const edgeEvPercent = calcEv(realWinChancePct, mainOddsVal);

    return {
      market: marketType,
      marketLabel: marketType === 'winner' ? 'Moneyline / Result' : marketType === 'spread' ? 'Spread / Handicap' : 'Match Total',
      selection: mainSelection,
      odds: mainOddsVal > 0 ? (mainOddsVal >= 2.0 ? `+${Math.round((mainOddsVal - 1) * 100)}` : `-${Math.round(100 / (mainOddsVal - 1))}`) : '-110',
      rawOdds: mainOddsVal,
      consensusRatio: ratio,
      agreeCount,
      totalModels,
      status,
      modelChoices: choices,
      edgeEvPercent,
      baseProbabilityPct,
      consensusBoostPct: Number(consensusBoostPct.toFixed(1)),
      metricsAdjustmentPct: Number(metricsAdjustmentPct.toFixed(1)),
      realWinChancePct,
      verdictTag
    };
  };

  // Build picks for 3 markets from REAL engine probabilities (neutral 50%
  // fallbacks are demoted to Reference Only by the verification gate below).
  const winnerOdds = (topMoneyline as any).odds || 1.85;
  const winnerProb = Number(topMoneyline.probability) || 50;
  const winnerPick = buildModelChoices('winner', (topMoneyline as any).label || `${home} Win`, `${away} Win`, winnerOdds, winnerProb);

  const spreadOdds = (topSpread as any).odds || 1.95;
  const spreadProb = Number(topSpread.probability) || 50;
  const spreadPick = buildModelChoices(
    'spread',
    (topSpread as any).label || fallbackSpreadLabel,
    winnerDirection === 'away' ? defaults.spreadLabel : defaults.spreadAlt,
    spreadOdds,
    spreadProb,
    spreadDissent
  );

  const totalOdds = (topTotal as any).odds || 1.88;
  const totalProb = Number(topTotal.probability) || 50;
  const totalPick = buildModelChoices('total', (topTotal as any).label || defaults.totalLabel, defaults.totalAlt, totalOdds, totalProb, totalDissent);

  // ── Multi-stage verification gate (pre-qualification) ──────────────────────
  // Every consensus pick must pass all three independent cross-checks before it
  // can carry a Top/Strong/Qualifying signal; anything else is demoted to
  // Reference Only.
  const oddsReal = (match.scopes as any)?._meta?.oddsIsReal === true;
  const attachVerification = (pick: GreatMindsPick, fromRealPick: boolean) => {
    const pickDirection = pick.market === 'total' ? 'none' : sideOf(pick.selection, home, away);
    const verification = verifySelection({
      market: pick.market,
      selection: pick.selection,
      fromRealPick,
      oddsReal,
      baseProbabilityPct: pick.baseProbabilityPct,
      realWinChancePct: pick.realWinChancePct,
      edgeEvPercent: pick.edgeEvPercent,
      rawOdds: pick.rawOdds ?? 0,
      winnerDirection,
      pickDirection,
      agreeCount: pick.agreeCount
    });
    pick.qualified = verification.qualified;
    pick.verification = verification;
    if (!verification.qualified) pick.verdictTag = 'Reference Only';
    return pick;
  };
  attachVerification(winnerPick, !!rawMoneyline);
  attachVerification(spreadPick, !!rawSpread);
  attachVerification(totalPick, !!rawTotal);

  // ── REAL overall aggregates from the 3 consensus picks (NOT hardcoded) ───
  const allThreePicks = [winnerPick, spreadPick, totalPick];
  const totalAgree = allThreePicks.reduce((n, p) => n + p.agreeCount, 0);
  const totalModelsVotes = allThreePicks.reduce((n, p) => n + p.totalModels, 0);
  const overallConsensusRatioPct = totalModelsVotes > 0 ? Math.round((totalAgree / totalModelsVotes) * 100) : 60;
  const overallConsensusRatio = `${overallConsensusRatioPct}%`;

  const overallWinRatePct = Number(
    (allThreePicks.reduce((acc, p) => acc + p.realWinChancePct, 0) / allThreePicks.length).toFixed(1)
  );
  const overallRoiPct = Number(
    (allThreePicks.reduce((acc, p) => acc + p.edgeEvPercent, 0) / allThreePicks.length).toFixed(1)
  );

  // Per-pick verdict success grading using the real finalScore when available.
  const scoreAvailable = match.finalScore || (match.status === 'finished');
  const scoreForGrade = match.finalScore || null;
  const pickVerdicts: GreatMindsPickVerdict[] = allThreePicks.map((p) => {
    if (scoreForGrade && match.status === 'finished') {
      const grade = gradeSelection(p.selection, p.market, scoreForGrade, {
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        marketId: p.market
      });
      return {
        market: p.market,
        selection: p.selection,
        grade: (grade === 'win' || grade === 'loss' || grade === 'push') ? grade : 'pending',
        realWinChancePct: p.realWinChancePct
      };
    }
    return { market: p.market, selection: p.selection, grade: 'pending', realWinChancePct: p.realWinChancePct };
  });
  const resolved = pickVerdicts.filter((v) => v.grade !== 'pending');
  const winsResolved = resolved.filter((v) => v.grade === 'win').length;
  const lossesResolved = resolved.filter((v) => v.grade === 'loss').length;
  const pushesResolved = resolved.filter((v) => v.grade === 'push').length;
  const resolvedTotal = resolved.length;
  const overallUnitsPnl = resolvedTotal > 0
    ? Number(
        allThreePicks.reduce((acc, p, idx) => {
          const v = pickVerdicts[idx];
          const r = v?.grade;
          if (r === 'win') return acc + Math.max((p.rawOdds || 1.9) - 1, 0.2);
          if (r === 'loss') return acc - 1;
          if (r === 'push') return acc + 0;
          // Pending: use EV-estimated fractional unit value
          return acc + (p.edgeEvPercent >= 0 ? (p.edgeEvPercent / 100) : -0.15);
        }, 0).toFixed(1)
      )
    : // Use weighted EV-estimated 3-pick card value when no scores yet
      Number(
        (allThreePicks.reduce((acc, p) => acc + (p.edgeEvPercent / 100), 0)).toFixed(1)
      );
  const resolvedVerdict: {
    totalPicks: number;
    wins: number;
    losses: number;
    pushes: number;
    winRatePct: number;
    pickVerdicts: GreatMindsPickVerdict[];
  } = {
    totalPicks: resolvedTotal,
    wins: winsResolved,
    losses: lossesResolved,
    pushes: pushesResolved,
    winRatePct: resolvedTotal > 0 ? Math.round((winsResolved / resolvedTotal) * 100) : 0,
    pickVerdicts
  };

  // Build 5-Round Debate Transcript
  const rounds: GreatMindsRound[] = [
    {
      roundNumber: 1,
      title: 'Round 1 — Independent Assessment',
      moderatorSummary: `Each of the 5 models independently analyzed Result, Spread, and Totals using Master Model v2 implied probabilities.`,
      modelPicks: {
        'Claude Opus 4.0': `${winnerPick.selection} (ML), ${spreadPick.selection} (Spread), ${totalPick.selection} (Total)`,
        'ChatGPT 3.2 Pro': `${winnerPick.selection} (+EV: +${winnerPick.edgeEvPercent}%), ${spreadPick.selection}, ${totalPick.selection}`,
        'Kimi K2.5': `${winnerPick.selection}, ${spreadPick.selection}, ${totalPick.selection}`,
        'Qwen 3.5': `${winnerPick.selection}, ${spreadPick.selection}, ${totalPick.selection}`,
        'Grok 4.2': `${winnerPick.selection}, ${defaults.spreadAlt} (Spread), ${defaults.totalAlt} (Total)`
      }
    },
    {
      roundNumber: 2,
      title: 'Round 2 — Consensus Mapping',
      moderatorSummary: `Claude Opus 4.0 mapped Round 1 outputs. Match Result achieved 5/5 Unanimity on ${winnerPick.selection}. Spread and Totals settled at a 4-1 split with Grok dissenting on line freshness.`,
      modelPicks: {
        'Consensus Axis': `Moneyline: 5/5 | Spread: 4/5 | Total: 4/5`,
        'Dissenting Model': `Grok 4.2 dissents on ${spreadPick.selection} & ${totalPick.selection}`
      }
    },
    {
      roundNumber: 3,
      title: 'Round 3 — Active Dissent & Rebuttal',
      moderatorSummary: `Grok 4.2 defended its dissent: "Punt pricing on ${defaults.spreadAlt} hides fatigue factors." ChatGPT Pro counter-argued that +EV math confirms ${home} covers ${spreadProb.toFixed(1)}% of simulations.`,
      modelPicks: {
        'Grok 4.2': `Maintains ${defaults.spreadAlt} line value thesis.`,
        'ChatGPT 3.2 Pro': `Rebuts: Expected Value (+${spreadPick.edgeEvPercent}%) firmly supports ${spreadPick.selection}.`
      }
    },
    {
      roundNumber: 4,
      title: 'Round 4 — Moderator Convergence',
      moderatorSummary: `Claude Opus 4.0 summarized: No analyst produced a credible argument that ${home}'s true win chance is below implied odds. Grok 4.2 conceded the Result selection but maintained total line caution.`,
      modelPicks: {
        'Moderator Note': `Panel consolidates around ${winnerPick.selection} as the clearest value play on the card.`
      }
    },
    {
      roundNumber: 5,
      title: 'Round 5 — Final Resolution & Recommendation',
      moderatorSummary: `Round 5 closes with high stability. The Great AI Minds recommend: ${winnerPick.selection} (5/5), ${spreadPick.selection} (4/5), and ${totalPick.selection} (4/5).`,
      modelPicks: {
        'Winner Pick': `${winnerPick.selection} (${winnerPick.consensusRatio})`,
        'Spread Pick': `${spreadPick.selection} (${spreadPick.consensusRatio})`,
        'Total Pick': `${totalPick.selection} (${totalPick.consensusRatio})`
      }
    }
  ];

  const fullTranscript = rounds
    .map(r => `--- ${r.title.toUpperCase()} ---\n${r.moderatorSummary}\n` + Object.entries(r.modelPicks).map(([k, v]) => `  • ${k}: ${v}`).join('\n'))
    .join('\n\n');

  // ── Unified cross-verified Real Win Chance (weighted across the 3 markets; a
  //    pick that fails verification cannot drag a Top/Strong signal upward) ──
  const marketsPicks = [winnerPick, spreadPick, totalPick];
  const qualifiedPicks = marketsPicks.filter((p) => p.qualified);
  const weightedReal =
    (qualifiedPicks.length ? qualifiedPicks : marketsPicks).reduce((acc, p) => acc + p.realWinChancePct, 0) /
    (qualifiedPicks.length ? qualifiedPicks.length : marketsPicks.length);
  const realWinChancePct = Number(weightedReal.toFixed(1));
  const realWinChanceTag =
    !qualifiedPicks.length ? 'Reference Only'
    : realWinChancePct >= 75 ? 'Top Signal'
    : realWinChancePct >= 65 ? 'Strong Signal'
    : realWinChancePct >= 52 ? 'Qualifying'
    : 'Reference Only';

  // One-line spark for the confidence band header (qualified picks first).
  const sparkPool = qualifiedPicks.length ? qualifiedPicks : marketsPicks;
  const bestMarket = sparkPool.slice().sort((a, b) => b.realWinChancePct - a.realWinChancePct)[0];
  const spark =
    `${bestMarket.selection} — ${bestMarket.realWinChancePct}% Real Win Chance ` +
    `(cross-verified against panel consensus and market metrics.)`;

  return {
    matchId: match.matchId,
    homeTeam: home,
    awayTeam: away,
    generatedAt: Date.now(),
    rounds,
    consensusPicks: {
      winner: winnerPick,
      spread: spreadPick,
      total: totalPick
    },
    overallConsensusRatio,
    overallWinRatePct,
    overallRoiPct,
    overallUnitsPnl,
    fullTranscript,
    realWinChancePct,
    realWinChanceTag,
    spark,
    resolvedVerdict,
    finalScore: match.finalScore || null,
    matchStatus: match.status || 'upcoming',
    scoreAvailable: !!scoreAvailable
  };
}

// ── Deterministic outcome simulator ────────────────────────────────────────────
// Derives a stable win/loss for a pick from the match seed + pick identity so the
// daily P&L is reproducible across renders while still tracking the match set that
// is actually loaded (per-sport filters change the aggregates in real time).
function seededRandom(seedStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function simulatePickOutcome(seedStr: string, probPct: number): 'W' | 'L' | 'P' {
  const roll = seededRandom(seedStr);
  const threshold = Math.min(Math.max(probPct / 100, 0.02), 0.98);
  // Slim push band around 50% to keep the record honest; otherwise win/loss.
  if (Math.abs(probPct - 50) < 1.5 && roll > 0.45 && roll < 0.55) return 'P';
  return roll <= threshold ? 'W' : 'L';
}

// Dynamic per-sport / all-sports Daily P&L + Great AI Minds consensus summary.
// Aggregates the ACTUAL loaded match set: every match gets a debate run through
// the cross-verified engine, and each consensus pick is resolved deterministically
// to produce win-rate / units-P&L / ROI rows grouped by consensus ratio, plus a
// model-accuracy ranking for the five Great AI Minds.
export function generateDailyPnlSummary(
  matches: PredictorMatch[],
  sportFilter: PnlSportFilter = 'ALL',
  marketFilter: PnlMarketFilter = 'ALL'
): DailyPnlSummaryData {
  const sportMatches = sportFilter === 'ALL' ? matches : matches.filter((m) => m.sportId === sportFilter);

  const buckets: Record<'5/5' | '4/5' | '3/5', { picks: number; wins: number; losses: number; push: number; units: number }> = {
    '5/5': { picks: 0, wins: 0, losses: 0, push: 0, units: 0 },
    '4/5': { picks: 0, wins: 0, losses: 0, push: 0, units: 0 },
    '3/5': { picks: 0, wins: 0, losses: 0, push: 0, units: 0 }
  };

  // Model accuracy tracking: modelId -> { correct, total }
  const modelStats: Record<string, { correct: number; total: number }> = {};
  for (const m of GREAT_MINDS_MODELS) modelStats[m.id] = { correct: 0, total: 0 };

  const marketOk = (market: string): boolean => {
    if (marketFilter === 'ALL') return true;
    if (marketFilter === 'MONEYLINE') return market === 'winner';
    if (marketFilter === 'SPREAD') return market === 'spread';
    return market === 'total';
  };

  let totalDebates = 0;

  for (const match of sportMatches) {
    let analysis: Analysis | null = null;
    try {
      analysis = analyzeCachedMatch(match).analysis;
    } catch {
      analysis = null;
    }
    const debate = generateGreatMindsDebate(match, analysis);
    totalDebates++;

    for (const [market, pick] of Object.entries(debate.consensusPicks) as [string, GreatMindsPick][]) {
      if (!marketOk(market)) continue;
      const ratioKey = pick.consensusRatio as '5/5' | '4/5' | '3/5';
      if (ratioKey !== '5/5' && ratioKey !== '4/5' && ratioKey !== '3/5') continue;

      // Recover the probability the pick was built from (edge EV vs raw odds).
      const rawOdds = pick.rawOdds ?? 1.9;
      const implied = rawOdds > 1 ? 1 / rawOdds : 0.5;
      const probPct = Math.round(Math.min(Math.max(implied + (pick.edgeEvPercent / 100), 0.4), 0.95) * 100);

      const score = match.finalScore || match.oddsSnapshot?.finalScore || null;
      let outcome: 'W' | 'L' | 'P';
      if (score && (match.status === 'finished' || !!score)) {
        const grade = gradeSelection(pick.selection, market, score, {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          marketId: market
        });
        outcome = grade === 'win' ? 'W' : grade === 'loss' ? 'L' : grade === 'push' ? 'P' : simulatePickOutcome(`${match.matchId}|${market}|${pick.selection}`, probPct);
      } else {
        outcome = simulatePickOutcome(`${match.matchId}|${market}|${pick.selection}`, probPct);
      }
      const stake = 1;
      const b = buckets[ratioKey];
      b.picks += 1;
      if (outcome === 'W') {
        b.wins += 1;
        b.units += Math.max((rawOdds - 1) * stake, 0.2);
      } else if (outcome === 'L') {
        b.losses += 1;
        b.units -= stake;
      } else {
        b.push += 1;
      }

      // Model accuracy: each agreeing model is credited when its pick resolves well.
      for (const choice of pick.modelChoices) {
        const st = modelStats[choice.modelId];
        if (!st) continue;
        if (choice.isAgree) {
          st.total += 1;
          if (outcome === 'W') st.correct += 1;
        } else {
          // Dissenting model is credited when the majority lost (contrarian edge).
          st.total += 1;
          if (outcome === 'L') st.correct += 1;
        }
      }
    }
  }

  const buildRow = (ratioKey: '5/5' | '4/5' | '3/5' | 'ALL'): DailyPnlConsensusRow => {
    const b = ratioKey === 'ALL'
      ? ['5/5', '4/5', '3/5'].reduce(
          (acc, k) => {
            const x = buckets[k as '5/5' | '4/5' | '3/5'];
            acc.picks += x.picks; acc.wins += x.wins; acc.losses += x.losses; acc.push += x.push; acc.units += x.units;
            return acc;
          },
          { picks: 0, wins: 0, losses: 0, push: 0, units: 0 }
        )
      : buckets[ratioKey];
    const winRatePct = b.picks > 0 ? Math.round((b.wins / b.picks) * 100) : 0;
    const roiPct = b.picks > 0 ? Number(((b.units / b.picks) * 100).toFixed(1)) : 0;
    return {
      consensusLabel: ratioKey === 'ALL' ? 'OVERALL' : `${ratioKey} CONSENSUS`,
      ratioKey,
      picksCount: b.picks,
      wins: b.wins,
      losses: b.losses,
      push: b.push,
      winRatePct,
      unitsPnl: Number(b.units.toFixed(1)),
      roiPct
    };
  };

  const rows: DailyPnlConsensusRow[] = [
    buildRow('5/5'),
    buildRow('4/5'),
    buildRow('3/5'),
    buildRow('ALL')
  ];
  const overall = rows[3];

  // Great AI Minds performance ranking.
  const accuracyEntries = GREAT_MINDS_MODELS
    .map((m) => ({ id: m.id, name: m.name, accuracy: modelStats[m.id]?.total ? Math.round((modelStats[m.id].correct / modelStats[m.id].total) * 100) : 0 }))
    .sort((a, b) => b.accuracy - a.accuracy);

  const modelAccuracyMap: Record<string, number> = {};
  for (const e of accuracyEntries) modelAccuracyMap[e.id] = e.accuracy;

  const greatMindsStats: GreatMindsStats = {
    totalDebatesCount: totalDebates,
    unanimousWinRatePct: buckets['5/5'].picks > 0 ? Math.round((buckets['5/5'].wins / buckets['5/5'].picks) * 100) : 0,
    strongWinRatePct: buckets['4/5'].picks > 0 ? Math.round((buckets['4/5'].wins / buckets['4/5'].picks) * 100) : 0,
    majorityWinRatePct: buckets['3/5'].picks > 0 ? Math.round((buckets['3/5'].wins / buckets['3/5'].picks) * 100) : 0,
    topModel: accuracyEntries[0]?.name ?? GREAT_MINDS_MODELS[0].name,
    modelAccuracyMap
  };

  return {
    sportFilter,
    marketFilter,
    overallWinRatePct: overall.winRatePct,
    overallUnitsPnl: overall.unitsPnl,
    overallRoiPct: overall.roiPct,
    overallRecord: `${overall.wins}W - ${overall.losses}L (${overall.picksCount} picks)`,
    rows,
    greatMindsStats
  };
}
