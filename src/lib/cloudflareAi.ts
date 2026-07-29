// src/lib/cloudflareAi.ts
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

const CLOUDFLARE_ACCOUNT_ID =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CF_ACCOUNT_ID) ||
  '04ca38ff81dd0f1c0cdf584db3779aee';

const CLOUDFLARE_WORKER_AI_TOKEN =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_CF_WORKER_AI_TOKEN) ||
  '';
const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export function isOnline(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export async function requestCloudflareAiAnalysis(
  req: AiAnalysisRequest,
  signal?: AbortSignal
): Promise<AiAnalysisResult> {
  if (!isOnline()) {
    return {
      success: false,
      isOffline: true,
      model: DEFAULT_MODEL,
      error: 'Offline Mode: Local Master Model analysis running locally. Connect to network for Cloudflare Workers AI online recommendations.'
    };
  }

  const { sportTitle, scopeTitle, ledger, profiles, picks, metrics } = req;

  // Build compact, structured prompt for sports market intelligence
  const topPicksStr = picks
    .slice(0, 4)
    .map((p) => `${p.label} (${p.marketTitle}) @ ${p.odds.toFixed(2)} [P: ${p.probability.toFixed(1)}%, Vig: ${(p.margin ?? 0).toFixed(1)}%]`)
    .join('; ');

  const metricsStr = metrics
    .filter((m) => m.value && m.value !== '-')
    .map((m) => `${m.label}: ${m.value}`)
    .join(' · ');

  const ledgerStr = ledger
    ? `Candidate: "${ledger.candidateLabel}" | Tier: ${ledger.tier} | Probability: ${ledger.marketProbability ?? '-'}% | Vig: ${ledger.bookmakerMargin ?? '-'}% | Confluence: ${ledger.agreeCount}/5 Agree, ${ledger.disagreeCount} Disagree`
    : 'No master ledger available yet.';

  const promptText = `
You are PulseOdds AI, an expert sports odds & quantitative lines analyst. Analyze the following screener data and provide a concise, high-value betting market verdict:

Sport: ${sportTitle} (${scopeTitle})
Master Model Ledger: ${ledgerStr}
Metrics: ${metricsStr}
Top Ranked Picks: ${topPicksStr}

Instructions:
Respond strictly with a brief, high-level JSON object matching this structure (no extra commentary outside JSON):
{
  "verdictSummary": "20-word executive summary of the leading market read",
  "valueAssessment": "15-word assessment of bookmaker margin vs implied probability value",
  "riskWarning": "15-word key risk or contradiction to watch out for",
  "tacticalRecommendation": "15-word recommended slip action (e.g. Stake main line, wait for live odds, or pass)"
}
`;

  try {
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${DEFAULT_MODEL}`;
    
    // 10 second timeout fallback
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CLOUDFLARE_WORKER_AI_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: promptText,
        max_tokens: 300,
        temperature: 0.3
      }),
      signal: signal ?? controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        isOffline: false,
        model: DEFAULT_MODEL,
        error: `Cloudflare Workers AI HTTP ${res.status}: ${errText.slice(0, 150)}`
      };
    }

    const data = await res.json();
    const responseText = data?.result?.response ?? data?.result?.choices?.[0]?.text ?? '';
    const neuronsUsed = data?.result?.usage?.neurons;

    // Try parsing JSON from AI response
    let insights: AiAnalysisResult['insights'];
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        insights = JSON.parse(jsonMatch[0]);
      }
    } catch (_e) {
      // Fallback if model returned plain text instead of strict JSON
      insights = {
        verdictSummary: responseText.slice(0, 150),
        valueAssessment: 'Value verified against market expected lines.',
        riskWarning: 'Verify bookmaker odds against line changes before placement.',
        tacticalRecommendation: 'Screen complete. Manage stake size responsibly.'
      };
    }

    return {
      success: true,
      isOffline: false,
      model: DEFAULT_MODEL,
      insights,
      rawText: responseText,
      neuronsUsed
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        success: false,
        isOffline: false,
        model: DEFAULT_MODEL,
        error: 'Cloudflare Workers AI request timed out (10s limit exceeded).'
      };
    }
    return {
      success: false,
      isOffline: !isOnline(),
      model: DEFAULT_MODEL,
      error: err.message || 'Failed to connect to Cloudflare Workers AI.'
    };
  }
}
