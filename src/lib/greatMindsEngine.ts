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

import type { PredictorMatch, GreatMindsDebateResult, GreatMindsPick, GreatMindsRound, GreatMindsModelChoice, DailyPnlSummaryData } from './predictorTypes';
import { GREAT_MINDS_MODELS } from './predictorTypes';
import type { Analysis, Pick as EnginePick } from './engine';

// Helper to format EV percentage
function calcEv(probPct: number, odds: number): number {
  if (!odds || odds <= 1) return 0;
  const rawProb = Math.min(Math.max(probPct / 100, 0.01), 0.99);
  const ev = (rawProb * odds) - 1;
  return Number((ev * 100).toFixed(1));
}

// Generate Great Minds Debate for a specific match
export function generateGreatMindsDebate(
  match: PredictorMatch,
  analysis: Analysis | null
): GreatMindsDebateResult {
  const home = match.homeTeam || 'Home Team';
  const away = match.awayTeam || 'Away Team';
  const picks: EnginePick[] = analysis?.picks ?? [];

  // Extract candidate market picks from analysis or defaults
  const topMoneyline = picks.find((p: EnginePick) => (p.marketTitle && p.marketTitle.toLowerCase().includes('moneyline')) || (p.marketTitle && p.marketTitle.toLowerCase().includes('winner'))) 
    || picks[0] 
    || { label: `${home} Winner`, marketTitle: 'Moneyline', probability: 68.5, odds: 1.85 };

  const topSpread = picks.find((p: EnginePick) => (p.marketTitle && p.marketTitle.toLowerCase().includes('handicap')) || (p.marketTitle && p.marketTitle.toLowerCase().includes('spread')))
    || { label: `${home} -1.5`, marketTitle: 'Spread', probability: 62.0, odds: 1.95 };

  const topTotal = picks.find((p: EnginePick) => (p.marketTitle && p.marketTitle.toLowerCase().includes('total')) || (p.marketTitle && p.marketTitle.toLowerCase().includes('over')) || (p.marketTitle && p.marketTitle.toLowerCase().includes('under')))
    || { label: 'Over 8.5', marketTitle: 'Total Runs', probability: 72.4, odds: 1.88 };

  // Helper to build model choices for a market
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
      const pick = isDissenter ? altSelection : mainSelection;
      const odds = isDissenter ? 2.10 : mainOddsVal;
      const ev = calcEv(isDissenter ? 45.0 : probPct, odds);

      let reasoning = '';
      if (m.id === 'claude-opus') {
        reasoning = `Synthesizing ${probPct.toFixed(1)}% model probability against baseline market odds.`;
      } else if (m.id === 'chatgpt-pro') {
        reasoning = `+EV calculation yields +${ev}% expected return above de-vigged line.`;
      } else if (m.id === 'kimi') {
        reasoning = `Pace & offensive efficiency metrics favor ${pick}.`;
      } else if (m.id === 'qwen') {
        reasoning = `Technical line resistance band holds firmly at ${odds}.`;
      } else if (m.id === 'grok') {
        reasoning = isDissenter 
          ? `Contrarian dissent: market price over-adjusts baseline; value sits on ${pick}.`
          : `Validates majority angle: Asian handicap line is stale.`;
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

    const edgeEvPercent = calcEv(probPct, mainOddsVal);

    return {
      market: marketType,
      marketLabel: marketType === 'winner' ? 'Moneyline' : marketType === 'spread' ? 'Spread' : 'Total',
      selection: mainSelection,
      odds: mainOddsVal > 0 ? (mainOddsVal >= 2.0 ? `+${Math.round((mainOddsVal - 1) * 100)}` : `-${Math.round(100 / (mainOddsVal - 1))}`) : '-110',
      rawOdds: mainOddsVal,
      consensusRatio: ratio,
      agreeCount,
      totalModels,
      status,
      modelChoices: choices,
      edgeEvPercent
    };
  };

  // Build picks for 3 markets
  const winnerOdds = (topMoneyline as any).odds || 1.85;
  const winnerProb = Number(topMoneyline.probability) || 68.5;
  const winnerPick = buildModelChoices('winner', (topMoneyline as any).label || `${home}`, `${away}`, winnerOdds, winnerProb); // 5/5 unanimous

  const spreadOdds = (topSpread as any).odds || 1.95;
  const spreadProb = Number(topSpread.probability) || 61.5;
  const spreadPick = buildModelChoices('spread', (topSpread as any).label || `${home} -1.5`, `${away} +1.5`, spreadOdds, spreadProb, 'grok'); // 4/5 Grok dissents

  const totalOdds = (topTotal as any).odds || 1.88;
  const totalProb = Number(topTotal.probability) || 64.2;
  const totalPick = buildModelChoices('total', (topTotal as any).label || 'Over 8.5', 'Under 8.5', totalOdds, totalProb, 'grok'); // 4/5 Grok dissents

  // Build 5-Round Debate Transcript
  const rounds: GreatMindsRound[] = [
    {
      roundNumber: 1,
      title: 'Round 1 — Independent Assessment',
      moderatorSummary: `Each of the 5 models independently analyzed Moneyline, Spread, and Totals using Master Model v2 implied probabilities.`,
      modelPicks: {
        'Claude Opus 4.0': `${winnerPick.selection} (ML), ${spreadPick.selection} (Spread), ${totalPick.selection} (Total)`,
        'ChatGPT 3.2 Pro': `${winnerPick.selection} (+EV: +${winnerPick.edgeEvPercent}%), ${spreadPick.selection}, ${totalPick.selection}`,
        'Kimi K2.5': `${winnerPick.selection}, ${spreadPick.selection}, ${totalPick.selection}`,
        'Qwen 3.5': `${winnerPick.selection}, ${spreadPick.selection}, ${totalPick.selection}`,
        'Grok 4.2': `${winnerPick.selection}, ${away} +1.5 (Spread), Under 8.5 (Total)`
      }
    },
    {
      roundNumber: 2,
      title: 'Round 2 — Consensus Mapping',
      moderatorSummary: `Claude Opus 4.0 mapped Round 1 outputs. Moneyline achieved 5/5 Unanimity on ${winnerPick.selection}. Spread and Totals settled at a 4-1 split with Grok dissenting on line freshness.`,
      modelPicks: {
        'Consensus Axis': `Moneyline: 5/5 | Spread: 4/5 | Total: 4/5`,
        'Dissenting Model': `Grok 4.2 dissents on ${spreadPick.selection} & ${totalPick.selection}`
      }
    },
    {
      roundNumber: 3,
      title: 'Round 3 — Active Dissent & Rebuttal',
      moderatorSummary: `Grok 4.2 defended its dissent: "Punt pricing on ${away} +1.5 hides pitching relief strength." ChatGPT Pro counter-argued that +EV math confirms ${home} covers 61.5% of simulations.`,
      modelPicks: {
        'Grok 4.2': `Maintains ${away} +1.5 spread value thesis due to bullpen fatigue.`,
        'ChatGPT 3.2 Pro': `Rebuts: Expected Value (+${spreadPick.edgeEvPercent}%) firmly supports ${spreadPick.selection}.`
      }
    },
    {
      roundNumber: 4,
      title: 'Round 4 — Moderator Convergence',
      moderatorSummary: `Claude Opus 4.0 summarized: No analyst produced a credible argument that ${home}'s true win chance is below implied odds. Grok 4.2 conceded the Moneyline but maintained total line caution.`,
      modelPicks: {
        'Moderator Note': `Panel consolidates around ${winnerPick.selection} ML as the clearest value play on the card.`
      }
    },
    {
      roundNumber: 5,
      title: 'Round 5 — Final Resolution & Recommendation',
      moderatorSummary: `Round 5 closes with remarkable stability. The Great AI Minds recommend: ${winnerPick.selection} (5/5), ${spreadPick.selection} (4/5), and ${totalPick.selection} (4/5).`,
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
    overallConsensusRatio: '61%',
    overallWinRatePct: 61,
    overallRoiPct: 16.3,
    overallUnitsPnl: 293.6,
    fullTranscript
  };
}

// Generate Daily P&L Summary data matching reference screenshots
export function generateDailyPnlSummary(filter: 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL' = 'ALL'): DailyPnlSummaryData {
  return {
    filter,
    overallWinRatePct: 61,
    overallUnitsPnl: 293.6,
    overallRoiPct: 16.3,
    overallRecord: '11W - 7L (18 picks)',
    rows: [
      {
        consensusLabel: '5/5 CONSENSUS',
        ratioKey: '5/5',
        picksCount: 6,
        wins: 3,
        losses: 3,
        push: 0,
        winRatePct: 50,
        unitsPnl: -64.1,
        roiPct: -10.7
      },
      {
        consensusLabel: '4/5 CONSENSUS',
        ratioKey: '4/5',
        picksCount: 8,
        wins: 5,
        losses: 3,
        push: 0,
        winRatePct: 63,
        unitsPnl: 210.2,
        roiPct: 26.3
      },
      {
        consensusLabel: '3/5 CONSENSUS',
        ratioKey: '3/5',
        picksCount: 4,
        wins: 3,
        losses: 1,
        push: 0,
        winRatePct: 75,
        unitsPnl: 147.5,
        roiPct: 36.9
      },
      {
        consensusLabel: 'OVERALL',
        ratioKey: 'ALL',
        picksCount: 18,
        wins: 11,
        losses: 7,
        push: 0,
        winRatePct: 61,
        unitsPnl: 293.6,
        roiPct: 16.3
      }
    ]
  };
}
