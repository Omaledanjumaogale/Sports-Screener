// src/lib/cloudflareAi.ts
// This module is browser-only (static SPA). All API calls are made client-side.
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
  provider?: 'cloudflare' | 'openrouter';
  insights?: {
    verdictSummary: string;
    valueAssessment: string;
    riskWarning: string;
    tacticalRecommendation: string;
  };
  rawText?: string;
  error?: string;
  neuronsUsed?: number;
}

// ── Credentials ──────────────────────────────────────────────────────────────
// Set these in .env.local for local dev and in Cloudflare Pages → Settings →
// Environment variables for production. NEVER hardcode secrets in source.
const CF_ACCOUNT_ID: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CF_ACCOUNT_ID) || '';

const CF_AI_TOKEN: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CF_WORKER_AI_TOKEN) || '';

// OpenRouter — free tier, no billing required for free models
// Sign up at https://openrouter.ai/ and set VITE_OPENROUTER_API_KEY
const OPENROUTER_API_KEY: string =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_OPENROUTER_API_KEY) || '';

const CF_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const OR_MODEL = 'mistralai/mistral-7b-instruct:free'; // Free OpenRouter model

// ── Network helpers ───────────────────────────────────────────────────────────
export function isOnline(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(req: AiAnalysisRequest): string {
  const { sportTitle, scopeTitle, ledger, picks, metrics } = req;

  const topPicksStr = picks
    .slice(0, 5)
    .map(
      (p) =>
        `${p.label} (${p.marketTitle}) @ ${p.odds.toFixed(2)} [P: ${p.probability.toFixed(1)}%, Vig: ${(p.margin ?? 0).toFixed(1)}%]`
    )
    .join('; ');

  const metricsStr = metrics
    .filter((m) => m.value && m.value !== '-')
    .map((m) => `${m.label}: ${m.value}`)
    .join(' · ');

  const ledgerStr = ledger
    ? `Best Pick: "${ledger.candidateLabel}" | Tier: ${ledger.tier} | Prob: ${ledger.marketProbability ?? '-'}% | Vig: ${ledger.bookmakerMargin ?? '-'}% | Agree: ${ledger.agreeCount}/5, Disagree: ${ledger.disagreeCount}`
    : 'No master ledger yet.';

  return `You are PulseOdds AI, an expert sports quantitative analyst. Analyze this screener data and return ONLY a JSON object — no markdown, no extra text.

Sport: ${sportTitle}${scopeTitle ? ` — ${scopeTitle}` : ''}
Master Ledger: ${ledgerStr}
Key Metrics: ${metricsStr || 'None entered yet.'}
Top Ranked Picks: ${topPicksStr || 'No picks ranked yet.'}

Return exactly this JSON (no other text):
{"verdictSummary":"20-word executive market verdict","valueAssessment":"15-word bookmaker margin vs probability value read","riskWarning":"15-word key risk or contradiction","tacticalRecommendation":"15-word slip action: stake, wait or pass"}`;
}

// ── Parse AI response text into insights ─────────────────────────────────────
function parseInsights(text: string): AiAnalysisResult['insights'] {
  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.verdictSummary) return parsed as AiAnalysisResult['insights'];
    }
  } catch (_) {/* fall through */}

  // Fallback: use raw text as verdict
  const clean = text.replace(/```[a-z]*/gi, '').replace(/```/g, '').trim();
  return {
    verdictSummary: clean.slice(0, 200) || 'Analysis complete. Review ranked picks above.',
    valueAssessment: 'Cross-check market expected value against bookmaker implied odds.',
    riskWarning: 'Bookmaker margin detected. Manage stake size accordingly.',
    tacticalRecommendation: 'Verify top picks against live odds before placement.'
  };
}

// ── Cloudflare Workers AI call ────────────────────────────────────────────────
async function callCloudflareAI(
  prompt: string,
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${CF_MODEL}`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_AI_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a sports betting quantitative analyst. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 350,
      temperature: 0.25
    }),
    signal
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`CF ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  // Cloudflare Workers AI response formats
  const text: string =
    data?.result?.response ??
    data?.result?.choices?.[0]?.message?.content ??
    data?.result?.choices?.[0]?.text ??
    '';

  const neuronsUsed: number | undefined = data?.result?.usage?.neurons;

  return {
    success: true,
    isOffline: false,
    provider: 'cloudflare',
    model: CF_MODEL,
    insights: parseInsights(text),
    rawText: text,
    neuronsUsed
  };
}

// ── OpenRouter AI call (free fallback) ────────────────────────────────────────
async function callOpenRouterAI(
  prompt: string,
  signal: AbortSignal
): Promise<AiAnalysisResult> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured. Set VITE_OPENROUTER_API_KEY.');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'https://pulseodds.app',
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({
      model: OR_MODEL,
      messages: [
        { role: 'system', content: 'You are a sports betting quantitative analyst. Always respond with valid JSON only.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 350,
      temperature: 0.25
    }),
    signal
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? '';

  return {
    success: true,
    isOffline: false,
    provider: 'openrouter',
    model: OR_MODEL,
    insights: parseInsights(text),
    rawText: text
  };
}

// ── Main export: tries Cloudflare first, then OpenRouter ─────────────────────
export async function requestCloudflareAiAnalysis(
  req: AiAnalysisRequest,
  signal?: AbortSignal
): Promise<AiAnalysisResult> {
  if (!isOnline()) {
    return {
      success: false,
      isOffline: true,
      model: CF_MODEL,
      error:
        'You are offline. All local screener analysis is running. Reconnect for AI-powered recommendations.'
    };
  }

  const prompt = buildPrompt(req);

  // Abort controller with 15s timeout
  const controller = new AbortController();
  const combinedSignal = signal ?? controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    // ── Attempt 1: Cloudflare Workers AI ─────────────────────────────────────
    try {
      const result = await callCloudflareAI(prompt, combinedSignal);
      clearTimeout(timeoutId);
      return result;
    } catch (cfErr: any) {
      // If aborted by user/timeout — don't retry
      if (cfErr.name === 'AbortError') throw cfErr;

      // ── Attempt 2: OpenRouter free fallback ───────────────────────────────
      if (OPENROUTER_API_KEY) {
        console.warn('[PulseOdds AI] Cloudflare failed, trying OpenRouter:', cfErr.message);
        const result = await callOpenRouterAI(prompt, combinedSignal);
        clearTimeout(timeoutId);
        return result;
      }

      // No fallback available — report Cloudflare error
      throw cfErr;
    }
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return {
        success: false,
        isOffline: false,
        model: CF_MODEL,
        error: 'AI request timed out after 15 seconds. Please try again.'
      };
    }

    return {
      success: false,
      isOffline: !isOnline(),
      model: CF_MODEL,
      error: err.message || 'Failed to connect to AI service. Please retry.'
    };
  }
}
