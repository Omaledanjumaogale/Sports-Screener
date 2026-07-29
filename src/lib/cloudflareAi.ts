// src/lib/cloudflareAi.ts
// Browser-side AI client for AI Copilot.
// Production: calls /api/ai-analyze (Cloudflare Pages Function — edge, no CORS).
// Dev mode / fallback: calls OpenRouter REST API directly if key is available.
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
const OR_KEY: string = safeStr((import.meta as any).env?.VITE_OPENROUTER_API_KEY);
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
    .slice(0, 5)
    .map(
      (p) =>
        `${safeStr(p?.label)} (${safeStr(p?.marketTitle)}) @ ${Number(p?.odds || 0).toFixed(2)} — P:${Number(p?.probability || 0).toFixed(1)}%, Vig:${Number(p?.margin || 0).toFixed(1)}%`
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

Respond ONLY with a valid JSON object — no markdown, no extra text:
{"verdictSummary":"20-word executive market verdict","valueAssessment":"15-word bookmaker margin vs probability read","riskWarning":"15-word key risk or contradiction","tacticalRecommendation":"15-word slip action: stake, wait, or pass"}`;

  return [
    {
      role: 'system',
      content:
        'You are PulseOdds AI Copilot, an expert sports quantitative analyst specializing in odds markets. Always respond with ONLY valid JSON — no markdown, no explanation, no preamble.'
    },
    { role: 'user', content: userContent }
  ];
}

// ── Response text parser ──────────────────────────────────────────────────────
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
    // Extract first JSON object from response
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

  // Graceful fallback: use raw text safely
  const cleanSummary = text.length > 180 ? text.slice(0, 180).trim() : text.trim();
  return {
    verdictSummary: cleanSummary || 'AI Copilot analysis complete.',
    valueAssessment: 'Cross-check market EV against bookmaker implied probability.',
    riskWarning: 'Bookmaker margin detected. Manage stake size carefully.',
    tacticalRecommendation: 'Verify top picks against live odds before placing.'
  };
}

// ── Primary: call /api/ai-analyze Pages Function ──────────────────────────────
async function callPagesFunction(
  messages: { role: string; content: string }[],
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  const res = await fetch('/api/ai-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, max_tokens: 500, temperature: 0.25 }),
    signal
  });

  const contentType = res.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    let errBody = '';
    if (isJson) {
      const errJson = await res.json().catch(() => null);
      errBody = safeStr(errJson?.error || errJson);
    } else {
      errBody = safeStr(await res.text().catch(() => ''));
    }
    const snippet = errBody.length > 200 ? errBody.slice(0, 200) : errBody;
    throw new Error(`AI Copilot service (${res.status}): ${snippet || 'HTTP error'}`);
  }

  if (!isJson) {
    throw new Error('AI Copilot endpoint returned unexpected format. Retrying...');
  }

  const data = await res.json().catch(() => null);

  if (!data || !data.success) {
    const errorMsg = safeStr(data?.error || 'AI Copilot returned an invalid response');
    throw new Error(errorMsg);
  }

  return {
    success: true,
    isOffline: false,
    provider: 'ai-copilot',
    model: 'ai-copilot',
    insights: parseInsights(data.response),
    rawText: safeStr(data.response),
    tokensUsed: Number(data.tokensUsed) || 0
  };
}

// ── Fallback: call OpenRouter directly (dev mode or Pages Function failure) ───
async function callOpenRouterDirect(
  messages: { role: string; content: string }[],
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  if (!OR_KEY) {
    throw new Error('AI Copilot connection key not configured.');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OR_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://pulseodds.pages.dev',
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.25
    }),
    signal
  });

  if (!res.ok) {
    const errText = safeStr(await res.text().catch(() => ''));
    const snippet = errText.length > 200 ? errText.slice(0, 200) : errText;
    throw new Error(`AI Copilot direct request failed (${res.status}): ${snippet || 'HTTP error'}`);
  }

  const data = await res.json().catch(() => null);
  const text = safeStr(data?.choices?.[0]?.message?.content);

  return {
    success: true,
    isOffline: false,
    provider: 'ai-copilot',
    model: 'ai-copilot',
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
      model: 'ai-copilot',
      error: 'You are offline. Local Master Model analysis is fully active. Reconnect for AI Copilot recommendations.'
    };
  }

  const messages = buildMessages(req);
  const controller = new AbortController();
  const effectiveSignal = signal ?? controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    // Dev mode: try OpenRouter directly first if key available
    if (IS_DEV && OR_KEY) {
      try {
        const result = await callOpenRouterDirect(messages, effectiveSignal);
        clearTimeout(timeoutId);
        return result;
      } catch (orErr: any) {
        if (orErr?.name === 'AbortError') throw orErr;
        const msg = safeStr(orErr?.message || orErr);
        console.warn('[AI Copilot] Direct request failed, trying edge function:', msg);
        // Fall through to Pages Function attempt
      }
    }

    // Production + Wrangler dev: use Pages Function
    try {
      const result = await callPagesFunction(messages, effectiveSignal);
      clearTimeout(timeoutId);
      return result;
    } catch (pfErr: any) {
      if (pfErr?.name === 'AbortError') throw pfErr;

      // Pages Function failed — try OpenRouter as final fallback if key is available
      if (OR_KEY) {
        const msg = safeStr(pfErr?.message || pfErr);
        console.warn('[AI Copilot] Edge function failed, trying direct connection:', msg);
        const result = await callOpenRouterDirect(messages, effectiveSignal);
        clearTimeout(timeoutId);
        return result;
      }

      throw pfErr;
    }
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err?.name === 'AbortError') {
      return {
        success: false,
        isOffline: false,
        model: 'ai-copilot',
        error: 'AI Copilot request timed out. Please try again.'
      };
    }

    const rawErrorStr = safeStr(err?.message || err || 'AI Copilot connection failed.');
    return {
      success: false,
      isOffline: !isOnline(),
      model: 'ai-copilot',
      error: rawErrorStr || 'AI Copilot connection failed. Please retry.'
    };
  }
}
