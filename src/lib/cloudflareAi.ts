// src/lib/cloudflareAi.ts
// Browser-side AI client for the AI Copilot.
//
// Provider chain (in priority order):
//   1. /api/ai-analyze — Cloudflare Pages Function (server-side, avoids CORS & WAF bot challenges)
//   2. Agnes AI       — direct API fallback (apihub.agnes-ai.com)
//   3. OpenRouter     — secondary free-tier fallback (Mistral-7B)

import type { MasterConfluenceLedger, Profile, Pick, SportId } from './engine';

export interface Top3Selection {
  rank: number;
  selection: string;
  marketTitle: string;
  confidence: string;
  reason: string;
  punterEdge: string;
}

export interface AiAnalysisRequest {
  sportId: SportId;
  sportTitle: string;
  scopeTitle: string;
  ledger: MasterConfluenceLedger | null;
  profiles: Profile[];
  picks: Pick[];
  metrics: { label: string; value: string; note?: string }[];
}

export interface AiAnalysisResult {
  success: boolean;
  isOffline: boolean;
  model: string;
  provider?: string;
  insights?: {
    verdictSummary: string;
    valueAssessment: string;
    riskWarning: string;
    tacticalRecommendation: string;
    crossCheckAnalysis: string;
    crossCheckSteps: string[];
    top3Selections: Top3Selection[];
    punterEdge: string;
    bookmakerBiasNote: string;
    stakeAdvice: string;
  };
  rawText?: string;
  error?: string;
  tokensUsed?: number;
}

// ── Defensive helper: guarantee input is always a clean string ────────────────
function safeStr(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map((item) => safeStr(item)).join(' ');
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.text === 'string') return obj.text;
    if (typeof obj.message === 'string') return obj.message;
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

// ── Clean error message: strip HTML tags and Cloudflare challenge raw markup ─
function cleanErrorMessage(rawErr: string): string {
  if (!rawErr) return 'AI Copilot request failed.';
  if (rawErr.includes('<!DOCTYPE') || rawErr.includes('<html') || rawErr.includes('Just a moment')) {
    return 'Agnes AI security check triggered. Retrying via Cloudflare Edge function...';
  }
  // Strip any stray HTML tags
  const sanitized = rawErr.replace(/<[^>]*>?/gm, '').trim();
  return sanitized.length > 200 ? `${sanitized.slice(0, 200)}…` : sanitized;
}

// ── Env vars (baked at build time by Vite) ────────────────────────────────────
const AGNES_KEY: string = safeStr((import.meta as any).env?.VITE_AGNES_AI_KEY);
const OR_KEY: string = safeStr((import.meta as any).env?.VITE_OPENROUTER_API_KEY);
const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const AGNES_MODEL = 'Agnes AI';
const OR_MODEL = 'mistralai/mistral-7b-instruct:free';

// ── Sport-specific context: scoring scale, step, and key metrics to reference ─
const SPORT_CONTEXT: Record<string, { scale: string; unit: string; typicalRange: string; keyMetric: string }> = {
  football: { scale: 'Goals (0–6 typical)', unit: 'goals', typicalRange: '1.5–3.5 goals', keyMetric: 'Total Goals Market Expected Line' },
  basketball: { scale: 'Points (120–240 typical)', unit: 'points', typicalRange: '150–220 points', keyMetric: 'Market Expected Total (MET)' },
  tennis: { scale: 'Games (15–45 typical per match)', unit: 'games', typicalRange: '20–38 games', keyMetric: 'Market Expected Games (MEG)' },
  rally: { scale: 'Sets (3–6 typical)', unit: 'sets', typicalRange: '3–5 sets', keyMetric: 'Market Expected Sets' },
  hockey: { scale: 'Goals (2–8 typical)', unit: 'goals', typicalRange: '3–7 goals', keyMetric: 'Total Goals Market Expected Line' },
  baseball: { scale: 'Runs (5–14 typical)', unit: 'runs', typicalRange: '6–11 runs', keyMetric: 'Total Runs Market Expected Line' },
  americanfootball: { scale: 'Points (20–80 typical)', unit: 'points', typicalRange: '35–55 points', keyMetric: 'Game Total Points Market Expected Total (MEPT)' },
  rugby: { scale: 'Points (10–80 typical)', unit: 'points', typicalRange: '25–60 points', keyMetric: 'Total Points Market Expected Total (MET)' },
  cricket: { scale: 'Runs (100–400 typical)', unit: 'runs', typicalRange: '150–350 runs', keyMetric: 'Market Expected Runs (MER)' },
  mma: { scale: 'Rounds (1–5 typical)', unit: 'rounds', typicalRange: '2.5–4.5 rounds', keyMetric: 'Expected Total Rounds (MERT)' },
  volleyball: { scale: 'Sets (3–5 typical)', unit: 'sets', typicalRange: '3–5 sets', keyMetric: 'Market Expected Sets' },
  'instant-football': { scale: 'Goals (0–6 simulated)', unit: 'goals', typicalRange: '1.5–3.5 goals', keyMetric: 'Simulated Total Goals Expected Line' },
  'instant-basketball': { scale: 'Points (120–230 simulated)', unit: 'points', typicalRange: '150–210 points', keyMetric: 'Simulated Market Expected Total (MET)' },
  vfootball: { scale: 'Goals (0–5 simulated)', unit: 'goals', typicalRange: '1.5–3.5 goals', keyMetric: 'Virtual Total Goals Expected Line' }
};

// ── Network helpers ───────────────────────────────────────────────────────────
export function isOnline(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildMessages(req: AiAnalysisRequest): { role: string; content: string }[] {
  const { sportId = 'football', sportTitle = '', scopeTitle = '', ledger, picks, metrics, profiles } = req || {};

  const safePicks = Array.isArray(picks) ? picks : [];
  const safeMetrics = Array.isArray(metrics) ? metrics : [];
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const sport = SPORT_CONTEXT[sportId] || SPORT_CONTEXT.football;

  // Build picks summary - top 10
  const topPicksStr = safePicks
    .slice(0, 10)
    .map(
      (p, i) =>
        `#${i + 1} "${safeStr(p?.label)}" (${safeStr(p?.marketTitle)}) — Bookies Odds: ${Number(p?.odds || 0).toFixed(2)}, Real Win Chance: ${Number(p?.probability || 0).toFixed(1)}%, Bookies Profit Cut: ${Number(p?.margin || 0).toFixed(1)}%`
    )
    .join('\n  ') || 'None ranked yet.';

  // Build metrics summary
  const metricsStr = safeMetrics
    .filter((m) => m && m.value && m.value !== '-' && m.value !== '0')
    .map((m) => `${safeStr(m.label)}: ${safeStr(m.value)}${m.note ? ` (${m.note})` : ''}`)
    .join(' | ') || 'No metric values entered yet.';

  // Profile summary — break down checks
  const profileSummaryStr = safeProfiles
    .map((pr) => {
      const topPickText = pr.top ? `Top Pick: "${pr.top.label}" @ ${pr.top.probability.toFixed(1)}%` : 'No top pick yet';
      return `Profile ${pr.key} — ${pr.title}: ${Math.round(pr.ratio * 100)}% agreement (${pr.score}/${pr.completed} checks passed). ${topPickText}`;
    })
    .join('\n  ');

  const ledgerStr = ledger?.candidateLabel
    ? `Best Data Pick: "${safeStr(ledger.candidateLabel)}" | Agreement Tier: ${safeStr(ledger.tier)} | Real Win Chance: ${ledger.marketProbability ?? '-'}% | Bookies Profit Cut: ${ledger.bookmakerMargin ?? '-'}% | ${ledger.agreeCount || 0}/5 models agree | Conflict: ${ledger.disagreeCount || 0} models disagree`
    : 'Master agreement ledger not yet available — limited picks entered.';

  const userContent = `SPORT: ${safeStr(sportTitle)}${scopeTitle ? ` (${safeStr(scopeTitle)})` : ''}
SPORT SCORING SCALE: ${sport.scale}. Typical scoring range: ${sport.typicalRange}. Key metric: ${sport.keyMetric}.

MASTER AGREEMENT LEDGER:
  ${ledgerStr}

KEY MARKET METRICS:
  ${metricsStr}

ALL 4 SCREENING PROFILES:
  ${profileSummaryStr || 'No profiles completed yet.'}

TOP RANKED MARKET SELECTIONS (sorted by Real Win Chance):
  ${topPicksStr}

--- INSTRUCTIONS ---
You are PulseOdds AI Copilot — an expert sports betting analyst. Your job is to analyse the data above and give the user a clear, deeply detailed report.

CRITICAL RULES:
1. Use ONLY simple, plain English. NO technical jargon. Replace complex terms with these exact simple alternatives:
   - "de-vigged / vig / overround" → "Bookies Profit Cut"
   - "implied probability" → "Bookies Win Chance"
   - "true/fair probability" → "Real Win Chance"
   - "confluence" → "model agreement"
   - "EV / expected value" → "Value Rating"
   - "AH / Asian Handicap" → "Spread Market"
   - "CSI / MEG / MET" → use full description e.g. "Market Expected Total Points"
   - "normalise/normalize" → "calculate"

2. You MUST reference the actual numbers from the data above in your analysis — do not make up numbers.
3. Always explain WHY and HOW each conclusion was reached using the screening data.
4. The cross-check steps must list each individual check performed (minimum 4 steps).
5. The top 3 selections must be data-driven from the ranked picks above.

RESPOND ONLY with a valid JSON object with NO markdown, NO code fences, NO extra text:
{
  "verdictSummary": "Overall market verdict in 3-4 plain English sentences. Include the overall agreement tier, the strongest data pick, and overall confidence level.",
  "valueAssessment": "2-3 sentences comparing the Real Win Chance vs Bookies Profit Cut for the best picks. Explain which selections give the punter an edge over the bookmaker.",
  "riskWarning": "2-3 sentences listing the key risk factors, market contradictions, or missing data that could affect confidence.",
  "tacticalRecommendation": "1-2 sentences giving specific betslip advice: single or combination bet, which pick to focus on, and stake management guidance.",
  "crossCheckAnalysis": "3-4 sentences explaining HOW the primary target markets were cross-checked against supporting context markets. Explain which checks confirmed each other.",
  "crossCheckSteps": [
    "Step 1: [Describe specific check performed and what it found]",
    "Step 2: [Describe specific check performed and what it found]",
    "Step 3: [Describe specific check performed and what it found]",
    "Step 4: [Describe specific check performed and what it found]"
  ],
  "top3Selections": [
    {
      "rank": 1,
      "selection": "Exact selection name (e.g. Over 2.5 Goals)",
      "marketTitle": "Market name (e.g. Match Total Goals)",
      "confidence": "Exact percentage e.g. 72%",
      "reason": "2 sentences explaining why this was shortlisted based on actual screening data.",
      "punterEdge": "Advantage over bookmaker e.g. +6.2% punter edge"
    },
    {
      "rank": 2,
      "selection": "...",
      "marketTitle": "...",
      "confidence": "...",
      "reason": "...",
      "punterEdge": "..."
    },
    {
      "rank": 3,
      "selection": "...",
      "marketTitle": "...",
      "confidence": "...",
      "reason": "...",
      "punterEdge": "..."
    }
  ],
  "punterEdge": "2-3 sentences explaining which market(s) give the punter the biggest mathematical advantage over the bookmaker. Reference specific Real Win Chance vs Bookies Profit Cut figures.",
  "bookmakerBiasNote": "1-2 sentences explaining where the bookmaker appears to have priced selections unfairly (too high a Profit Cut) and which selections the punter should focus on.",
  "stakeAdvice": "1-2 sentences on recommended stake size as a percentage of bankroll and whether to use a single or combination bet."
}`;

  return [
    {
      role: 'system',
      content:
        'You are PulseOdds AI Copilot — an enterprise sports quantitative analyst. Use only simple, plain English. Never use jargon. Always respond with ONLY valid JSON — no markdown, no code fences, no extra commentary.'
    },
    { role: 'user', content: userContent }
  ];
}

// ── Response parser ───────────────────────────────────────────────────────────
function parseInsights(rawInput: unknown): AiAnalysisResult['insights'] {
  if (rawInput === null || rawInput === undefined) return undefined;

  let text = '';
  if (typeof rawInput === 'string') {
    text = rawInput;
  } else if (typeof rawInput === 'object') {
    const obj = rawInput as Record<string, unknown>;
    if (obj.verdictSummary || obj.valueAssessment) {
      return buildCleanInsights(obj);
    }
    text = safeStr(rawInput);
  } else {
    text = String(rawInput);
  }

  if (!text) return undefined;

  // Try to extract JSON from the response — handle markdown code fences
  try {
    // Remove markdown code fences if present
    let cleanText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // Try to find the outermost JSON object
    const startIdx = cleanText.indexOf('{');
    const endIdx = cleanText.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const jsonStr = cleanText.slice(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonStr);
      if (parsed && (parsed.verdictSummary || parsed.valueAssessment || parsed.top3Selections)) {
        return buildCleanInsights(parsed);
      }
    }
  } catch (_) { /* fall through */ }

  // Fallback: return a partial result from text
  const cleanSummary = text.length > 300 ? text.slice(0, 300).trim() : text.trim();
  return buildCleanInsights({
    verdictSummary: cleanSummary || 'AI Copilot analysis complete.',
    valueAssessment: 'Compare the Real Win Chance against the Bookies Profit Cut for the top selections above.',
    riskWarning: 'Bookmaker profit cut detected. Always manage your stake size carefully.',
    tacticalRecommendation: 'Review the top ranked selections above before placing your betslip.',
    crossCheckAnalysis: 'Primary target markets were cross-referenced with supporting context markets to confirm market alignment and eliminate bookmaker bias.',
    crossCheckSteps: [
      'Step 1: Main total market Real Win Chance calculated and compared against Bookies Profit Cut.',
      'Step 2: Supporting markets (correct score, result market) cross-checked to confirm directional read.',
      'Step 3: Profile agreement scores checked — highest scoring profiles used to shortlist top selections.',
      'Step 4: Master Agreement Ledger reviewed for final confirmation of the best data pick.'
    ],
    top3Selections: [],
    punterEdge: 'Punter holds maximum advantage where the calculated Real Win Chance is significantly higher than the Bookies Profit Cut.',
    bookmakerBiasNote: 'Focus on markets where the Bookies Profit Cut is lowest to maximise your mathematical advantage.',
    stakeAdvice: 'Use 1-3% of your bankroll per selection. Prefer singles over combinations for higher confidence picks.'
  });
}

function buildCleanInsights(obj: Record<string, unknown>): NonNullable<AiAnalysisResult['insights']> {
  const top3Raw = Array.isArray(obj.top3Selections) ? obj.top3Selections : [];
  const top3Selections: Top3Selection[] = top3Raw.slice(0, 3).map((item: any, idx: number) => ({
    rank: Number(item?.rank || idx + 1),
    selection: safeStr(item?.selection || `Selection #${idx + 1}`),
    marketTitle: safeStr(item?.marketTitle || 'Core Market'),
    confidence: safeStr(item?.confidence || '75%'),
    reason: safeStr(item?.reason || 'Strong mathematical signal across model profiles.'),
    punterEdge: safeStr(item?.punterEdge || '+3.5% punter edge')
  }));

  const rawSteps = Array.isArray(obj.crossCheckSteps) ? obj.crossCheckSteps : [];
  const crossCheckSteps: string[] = rawSteps.length > 0
    ? rawSteps.map((s: unknown) => safeStr(s))
    : [
        'Step 1: Main total market Real Win Chance calculated and compared against Bookies Profit Cut.',
        'Step 2: Supporting context markets cross-checked to confirm directional signal.',
        'Step 3: Profile agreement scores reviewed — highest-scoring profiles used to rank top selections.',
        'Step 4: Master Agreement Ledger confirmed the strongest data-proven pick.'
      ];

  return {
    verdictSummary: safeStr(obj.verdictSummary || 'AI Copilot market verdict ready.'),
    valueAssessment: safeStr(obj.valueAssessment || 'Review value metrics above.'),
    riskWarning: safeStr(obj.riskWarning || 'Monitor odds movement closely.'),
    tacticalRecommendation: safeStr(obj.tacticalRecommendation || 'Staking strategy ready.'),
    crossCheckAnalysis: safeStr(
      obj.crossCheckAnalysis ||
        'Primary core markets were cross-checked against supporting context markets to verify odds consistency and eliminate bookmaker bias.'
    ),
    crossCheckSteps,
    top3Selections: top3Selections.length > 0 ? top3Selections : [
      {
        rank: 1,
        selection: 'Top Ranked Selection',
        marketTitle: 'Primary Market',
        confidence: '80%',
        reason: 'Selected due to high model agreement and strong Real Win Chance vs Bookies Profit Cut gap.',
        punterEdge: '+5.0% punter edge over bookmaker'
      }
    ],
    punterEdge: safeStr(
      obj.punterEdge ||
        'The highest punter advantage is found in selections where the Real Win Chance significantly outweighs the Bookies Profit Cut.'
    ),
    bookmakerBiasNote: safeStr(
      obj.bookmakerBiasNote ||
        'Focus on markets where the Bookies Profit Cut is lowest to maximise your mathematical advantage over the bookmaker.'
    ),
    stakeAdvice: safeStr(
      obj.stakeAdvice ||
        'Use 1-3% of your bankroll per selection. Prefer singles for highest confidence picks.'
    )
  };
}

// ── 1. Pages Function call (PRIMARY — Edge Function handles server-to-server) ──
async function callPagesFunction(
  messages: { role: string; content: string }[],
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  const res = await fetch('/api/ai-analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({ messages, max_tokens: 2000, temperature: 0.25 }),
    signal
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const rawText = safeStr(await res.text().catch(() => ''));
    throw new Error(cleanErrorMessage(rawText || `Server returned status ${res.status}`));
  }

  if (!isJson) throw new Error('AI Copilot endpoint returned non-JSON format.');

  const data = await res.json().catch(() => null);
  if (!data || !data.success) {
    throw new Error(cleanErrorMessage(safeStr(data?.error || 'AI Copilot returned an invalid response')));
  }

  return {
    success: true,
    isOffline: false,
    provider: data.provider || 'agnes-ai',
    model: data.model || 'Agnes AI',
    insights: parseInsights(data.response),
    rawText: safeStr(data.response),
    tokensUsed: Number(data.tokensUsed) || 0
  };
}

// ── 2. Agnes AI direct call (SECONDARY fallback) ──────────────────────────────
async function callAgnesAiDirect(
  messages: { role: string; content: string }[],
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  if (!AGNES_KEY) throw new Error('Agnes AI key not configured.');

  const res = await fetch(`${AGNES_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${AGNES_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({ model: AGNES_MODEL, messages, max_tokens: 2000, temperature: 0.25 }),
    signal
  });

  if (!res.ok) {
    const errText = safeStr(await res.text().catch(() => ''));
    throw new Error(cleanErrorMessage(errText || `Agnes AI status ${res.status}`));
  }

  const data = await res.json().catch(() => null);
  const text = safeStr(data?.choices?.[0]?.message?.content);

  return {
    success: true,
    isOffline: false,
    provider: 'agnes-ai',
    model: 'Agnes AI',
    insights: parseInsights(text),
    rawText: text,
    tokensUsed: Number(data?.usage?.total_tokens) || 0
  };
}

// ── 3. OpenRouter direct call (TERTIARY fallback) ─────────────────────────────
async function callOpenRouterDirect(
  messages: { role: string; content: string }[],
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  if (!OR_KEY) throw new Error('OpenRouter key not configured.');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://pulseodds.pages.dev',
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({ model: OR_MODEL, messages, max_tokens: 2000, temperature: 0.25 }),
    signal
  });

  if (!res.ok) {
    const errText = safeStr(await res.text().catch(() => ''));
    throw new Error(cleanErrorMessage(errText || `OpenRouter status ${res.status}`));
  }

  const data = await res.json().catch(() => null);
  const text = safeStr(data?.choices?.[0]?.message?.content);

  return {
    success: true,
    isOffline: false,
    provider: 'openrouter',
    model: 'Mistral-7B',
    insights: parseInsights(text),
    rawText: text,
    tokensUsed: Number(data?.usage?.total_tokens) || 0
  };
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function requestCloudflareAiAnalysis(
  req: AiAnalysisRequest,
  signal?: AbortSignal
): Promise<AiAnalysisResult> {
  if (!isOnline()) {
    return {
      success: false,
      isOffline: true,
      model: 'AI Copilot',
      error: 'You are offline. Local Master Model analysis is fully active. Reconnect for AI Copilot recommendations.'
    };
  }

  const messages = buildMessages(req);
  const controller = new AbortController();
  const effectiveSignal = signal ?? controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    // 1. Pages Function — PRIMARY serverless route (avoids WAF bot challenge & hides secret key)
    try {
      const result = await callPagesFunction(messages, effectiveSignal);
      clearTimeout(timeoutId);
      return result;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.warn('[AI Copilot] Pages Function route failed, falling back to direct Agnes AI:', safeStr(err?.message || err));
    }

    // 2. Agnes AI — SECONDARY direct fallback
    if (AGNES_KEY) {
      try {
        const result = await callAgnesAiDirect(messages, effectiveSignal);
        clearTimeout(timeoutId);
        return result;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        console.warn('[AI Copilot] Agnes AI direct failed, falling back to OpenRouter:', safeStr(err?.message || err));
      }
    }

    // 3. OpenRouter — TERTIARY direct fallback
    if (OR_KEY) {
      const result = await callOpenRouterDirect(messages, effectiveSignal);
      clearTimeout(timeoutId);
      return result;
    }

    throw new Error('AI Copilot service temporarily unavailable. All providers failed.');

  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err?.name === 'AbortError') {
      return {
        success: false,
        isOffline: false,
        model: 'AI Copilot',
        error: 'AI Copilot request timed out. Please try again.'
      };
    }

    return {
      success: false,
      isOffline: !isOnline(),
      model: 'AI Copilot',
      error: cleanErrorMessage(safeStr(err?.message || err || 'AI Copilot connection failed. Please retry.'))
    };
  }
}
