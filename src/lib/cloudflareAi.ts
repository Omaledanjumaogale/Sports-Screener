// src/lib/cloudflareAi.ts
// Browser-side AI client for the AI Copilot.
//
// Provider chain (in priority order):
//   1. Agnes AI  — primary enterprise-grade LLM (apihub.agnes-ai.com)
//   2. OpenRouter — secondary free-tier fallback (Mistral-7B)
//   3. /api/ai-analyze — Cloudflare Pages Function with server-side key access

import type { MasterConfluenceLedger, Profile, Pick, SportId } from './engine';

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

// ── Env vars (baked at build time by Vite) ────────────────────────────────────
const IS_DEV = (import.meta as any).env?.DEV === true;
const AGNES_KEY: string = safeStr((import.meta as any).env?.VITE_AGNES_AI_KEY);
const OR_KEY: string = safeStr((import.meta as any).env?.VITE_OPENROUTER_API_KEY);
const AGNES_BASE = 'https://apihub.agnes-ai.com/v1';
const AGNES_MODEL = 'Agnes AI';
const OR_MODEL = 'mistralai/mistral-7b-instruct:free';

// ── Network helpers ───────────────────────────────────────────────────────────
export function isOnline(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildMessages(req: AiAnalysisRequest): { role: string; content: string }[] {
  const { sportTitle = '', scopeTitle = '', ledger, picks, metrics } = req || {};

  const safePicks = Array.isArray(picks) ? picks : [];
  const safeMetrics = Array.isArray(metrics) ? metrics : [];

  const topPicksStr = safePicks
    .slice(0, 8)
    .map(
      (p) =>
        `${safeStr(p?.label)} (${safeStr(p?.marketTitle)}) @ ${Number(p?.odds || 0).toFixed(2)} — P:${Number(p?.probability || 0).toFixed(1)}%, Vig:${Number(p?.margin || 0).toFixed(1)}%, Tier:${safeStr((p as any)?.tier || 'N/A')}`
    )
    .join('; ') || 'None ranked yet.';

  const metricsStr = safeMetrics
    .filter((m) => m && m.value && m.value !== '-' && m.value !== '0')
    .map((m) => `${safeStr(m.label)}: ${safeStr(m.value)}`)
    .join(' · ') || 'No metric values entered.';

  const ledgerStr = ledger?.candidateLabel
    ? `Best Pick: "${safeStr(ledger.candidateLabel)}" | Tier: ${safeStr(ledger.tier)} | P: ${ledger.marketProbability ?? '-'}% | Vig: ${ledger.bookmakerMargin ?? '-'}% | Agree: ${ledger.agreeCount || 0}/5 models`
    : 'Master ledger not yet available.';

  const userContent = `Sport: ${safeStr(sportTitle)}${scopeTitle ? ` — ${safeStr(scopeTitle)}` : ''}
Master Ledger: ${ledgerStr}
Metrics: ${metricsStr}
Top Ranked Picks: ${topPicksStr}

You are an elite sports quantitative analyst. Analyze the above market data using expected value theory and bookmaker margin analysis. Respond ONLY with a valid JSON object — no markdown, no extra text:
{"verdictSummary":"25-word precise market verdict with confidence level","valueAssessment":"20-word bookmaker margin vs true probability edge assessment","riskWarning":"20-word key risk factors or market contradictions","tacticalRecommendation":"20-word slip action: specific stake strategy, wait, or pass"}`;

  return [
    {
      role: 'system',
      content:
        'You are PulseOdds AI Copilot powered by Agnes AI — an elite sports quantitative analyst specializing in odds market expected value analysis. You provide concise, data-driven insights. Always respond with ONLY valid JSON — no markdown, no explanation, no preamble.'
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
      return {
        verdictSummary: safeStr(obj.verdictSummary || 'Analysis complete.'),
        valueAssessment: safeStr(obj.valueAssessment || 'Review value metrics above.'),
        riskWarning: safeStr(obj.riskWarning || 'Monitor odds movement closely.'),
        tacticalRecommendation: safeStr(obj.tacticalRecommendation || 'Verify before placement.')
      };
    }
    text = safeStr(rawInput);
  } else {
    text = String(rawInput);
  }

  if (!text) return undefined;

  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && (parsed.verdictSummary || parsed.valueAssessment)) {
        return {
          verdictSummary: safeStr(parsed.verdictSummary || 'Analysis complete.'),
          valueAssessment: safeStr(parsed.valueAssessment || 'Review value metrics above.'),
          riskWarning: safeStr(parsed.riskWarning || 'Monitor odds movement closely.'),
          tacticalRecommendation: safeStr(parsed.tacticalRecommendation || 'Verify before placement.')
        };
      }
    }
  } catch (_) {/* fall through */}

  const cleanSummary = text.length > 200 ? text.slice(0, 200).trim() : text.trim();
  return {
    verdictSummary: cleanSummary || 'AI Copilot analysis complete.',
    valueAssessment: 'Cross-check market EV against bookmaker implied probability.',
    riskWarning: 'Bookmaker margin detected. Manage stake size carefully.',
    tacticalRecommendation: 'Verify top picks against live odds before placing.'
  };
}

// ── Agnes AI direct call (primary — enterprise grade) ─────────────────────────
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
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({ model: AGNES_MODEL, messages, max_tokens: 600, temperature: 0.2 }),
    signal
  });

  if (!res.ok) {
    const errText = safeStr(await res.text().catch(() => ''));
    throw new Error(`Agnes AI (${res.status}): ${errText.slice(0, 200) || 'HTTP error'}`);
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

// ── OpenRouter direct call (secondary fallback) ───────────────────────────────
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
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://pulseodds.pages.dev',
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({ model: OR_MODEL, messages, max_tokens: 600, temperature: 0.2 }),
    signal
  });

  if (!res.ok) {
    const errText = safeStr(await res.text().catch(() => ''));
    throw new Error(`OpenRouter (${res.status}): ${errText.slice(0, 200) || 'HTTP error'}`);
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

// ── Pages Function call (tertiary — server-side with all API keys) ─────────────
async function callPagesFunction(
  messages: { role: string; content: string }[],
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  const res = await fetch('/api/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, max_tokens: 600, temperature: 0.2 }),
    signal
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const errBody = isJson
      ? safeStr((await res.json().catch(() => null))?.error)
      : safeStr(await res.text().catch(() => ''));
    throw new Error(`AI Copilot service (${res.status}): ${errBody.slice(0, 200) || 'HTTP error'}`);
  }

  if (!isJson) throw new Error('AI Copilot endpoint returned unexpected format.');

  const data = await res.json().catch(() => null);
  if (!data || !data.success) {
    throw new Error(safeStr(data?.error || 'AI Copilot returned an invalid response'));
  }

  return {
    success: true,
    isOffline: false,
    provider: data.provider || 'ai-copilot',
    model: data.model || 'AI Copilot',
    insights: parseInsights(data.response),
    rawText: safeStr(data.response),
    tokensUsed: Number(data.tokensUsed) || 0
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
  const timeoutId = setTimeout(() => controller.abort(), 25_000);

  try {
    // 1. Agnes AI — primary enterprise provider
    if (AGNES_KEY) {
      try {
        const result = await callAgnesAiDirect(messages, effectiveSignal);
        clearTimeout(timeoutId);
        return result;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        console.warn('[AI Copilot] Agnes AI failed, trying OpenRouter:', safeStr(err?.message || err));
      }
    }

    // 2. OpenRouter — secondary fallback
    if (OR_KEY) {
      try {
        const result = await callOpenRouterDirect(messages, effectiveSignal);
        clearTimeout(timeoutId);
        return result;
      } catch (err: any) {
        if (err?.name === 'AbortError') throw err;
        console.warn('[AI Copilot] OpenRouter failed, trying Pages Function:', safeStr(err?.message || err));
      }
    }

    // 3. Pages Function — server-side tertiary fallback with all keys
    const result = await callPagesFunction(messages, effectiveSignal);
    clearTimeout(timeoutId);
    return result;

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
      error: safeStr(err?.message || err || 'AI Copilot connection failed. Please retry.')
    };
  }
}
