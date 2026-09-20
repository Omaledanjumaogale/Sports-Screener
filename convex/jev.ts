// ── Jev — TypeSafe's structured evaluation model (Cloudflare Workers AI) ─────
//
// Jev evaluates ONE state against typed questions (Noul / Choice / Score) and
// returns calibrated answers with probabilities and confidence. This module is
// the single integration point every part of the pipeline uses:
//
//   predictorOrchestrator → cycle-quality evaluation (web search → scraping →
//                           fetch → quality gate → verdicts, one call per cycle)
//   llm.generatePredictorVerdict → per-match market steering (which market
//                           family the verdict should lead with, value noul,
//                           risk score) before the big LLM writes the report
//   functions/api/ai-analyze.js → in-app AI Copilot request shaping (JS twin
//                           of this adapter, kept self-contained at the edge)
//
// ENGINE STRATEGY:
//   1. Native  — POST /ai/run/typesafe/jev with the exact Jev contract
//                (state + questions → answers with noul/choice/score shapes).
//   2. Adapter — if the account does not have typesafe/jev provisioned yet
//                (checked live, retried every 10 min), the same Jev contract is
//                rendered into a strict-JSON evaluation prompt for the
//                account's Workers AI text models and parsed back into the
//                identical answer shapes. Callers cannot tell the difference
//                except via `engine`.
//
// Every failure degrades gracefully: evaluateWithJev never throws.

declare const process: { env: Record<string, string | undefined> };

export type JevQuestionType = 'noul' | 'choice' | 'score';

export interface JevQuestion {
  type: JevQuestionType;
  instructions: string;
  // noul: boolean criteria; choice: option → description; score: legend labels.
  criteria: Record<string, string> | string[];
}

export interface JevNoulAnswer {
  type: 'noul';
  noul: number; // probability of `true`, 0..1
  confidence?: number;
}

export interface JevChoiceAnswer {
  type: 'choice';
  choice: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}

export interface JevScoreAnswer {
  type: 'score';
  score: number;
  confidence?: number;
  legend?: Record<string, string>;
  probabilities?: Record<string, number>;
}

export type JevAnswer = JevNoulAnswer | JevChoiceAnswer | JevScoreAnswer;

export interface JevUsage {
  input_tokens?: number;
  output_tokens?: number;
}

export interface JevEvaluation {
  engine: 'native-jev' | 'adapter';
  model: string;
  answers: Record<string, JevAnswer>;
  usage?: JevUsage;
}

export interface JevResult {
  ok: boolean;
  evaluation?: JevEvaluation;
  error?: string;
}

// ── Account/engine configuration ─────────────────────────────────────────────

const NATIVE_MODEL = 'typesafe/jev';
// Adapter host model: strongest fast instruction-follower in the account's
// verified catalog (probe scripts listed it as available). Overridable.
const ADAPTER_MODEL = process.env.CF_JEV_ADAPTER_MODEL?.trim() || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const NATIVE_RECHECK_MS = 10 * 60_000;

interface EngineState {
  nativeAvailable: boolean | null; // null = never probed
  nativeLastCheck: number;
}

// Module-scope cache (per action isolate — warm isolates skip the probe).
const engine: EngineState = { nativeAvailable: null, nativeLastCheck: 0 };

function cfCreds(): { account: string; token: string } | null {
  const account = process.env.CF_ACCOUNT_ID?.trim();
  const token = process.env.CF_WORKER_AI_TOKEN?.trim();
  return account && token ? { account, token } : null;
}

async function cfRun(model: string, body: unknown, timeoutMs: number): Promise<{ ok: boolean; status: number; json: any }> {
  const creds = cfCreds();
  if (!creds) return { ok: false, status: 0, json: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${creds.account}/ai/run/${model}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const json: any = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  } finally {
    clearTimeout(timer);
  }
}

// ── Native Jev call (exact contract) ─────────────────────────────────────────

async function callNativeJev(
  state: string,
  questions: Record<string, JevQuestion>
): Promise<JevResult> {
  const res = await cfRun(NATIVE_MODEL, { state, questions }, 20_000);
  // "No route for that URI" (7000) → the model isn't provisioned on this
  // account; remember that so we stop retrying until the recheck window.
  if (!res.ok && (res.status === 404 || res.status === 400) && res.json?.errors?.some((e: any) => /no route/i.test(String(e?.message)))) {
    engine.nativeAvailable = false;
    engine.nativeLastCheck = Date.now();
    return { ok: false, error: 'typesafe/jev not provisioned on this account' };
  }
  if (!res.ok || !res.json?.success) {
    return { ok: false, error: `native jev HTTP ${res.status}` };
  }
  engine.nativeAvailable = true;
  engine.nativeLastCheck = Date.now();
  const r = res.json.result ?? {};
  return {
    ok: true,
    evaluation: {
      engine: 'native-jev',
      model: String(r.model ?? NATIVE_MODEL),
      answers: (r.answers ?? {}) as Record<string, JevAnswer>,
      usage: r.usage
    }
  };
}

// ── Adapter: Jev contract over Workers AI text models ────────────────────────

function renderCriteria(q: JevQuestion): string {
  if (Array.isArray(q.criteria)) {
    return q.criteria.map((c, i) => `  "${i}": ${c}`).join('\n');
  }
  return Object.entries(q.criteria)
    .map(([k, v]) => `  "${k}": ${v}`)
    .join('\n');
}

function renderQuestions(questions: Record<string, JevQuestion>): string {
  return Object.entries(questions)
    .map(([key, q]) => {
      const shape =
        q.type === 'noul'
          ? `"${key}": { "noul": <probability of TRUE, 0.00-1.00>, "confidence": <0.00-1.00> }`
          : q.type === 'choice'
            ? `"${key}": { "choice": <one of the option keys>, "probabilities": { <option key>: <0.00-1.00> ... }, "confidence": <0.00-1.00> }`
            : `"${key}": { "score": <numeric score on the legend scale>, "confidence": <0.00-1.00> }`;
      return `Question "${key}" (${q.type}):\nInstructions: ${q.instructions}\nCriteria/scale:\n${renderCriteria(q)}\nAnswer shape: ${shape}`;
    })
    .join('\n\n');
}

function clamp01(n: unknown, fallback = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
}

function normalizeAnswer(key: string, q: JevQuestion, raw: any): JevAnswer | null {
  if (raw === null || typeof raw !== 'object') return null;
  if (q.type === 'noul') {
    const noul = clamp01(raw.noul ?? raw.value ?? raw.answer);
    return { type: 'noul', noul, confidence: clamp01(raw.confidence, 0.7) };
  }
  if (q.type === 'choice') {
    const options = q.criteria && !Array.isArray(q.criteria) ? Object.keys(q.criteria) : [];
    let choice = String(raw.choice ?? raw.value ?? '').trim();
    if (options.length && !options.includes(choice)) {
      // Tolerate case/spacing drift before giving up on this answer.
      const hit = options.find((o) => o.toLowerCase() === choice.toLowerCase());
      if (!hit) return null;
      choice = hit;
    }
    const probabilities: Record<string, number> = {};
    if (raw.probabilities && typeof raw.probabilities === 'object') {
      for (const [k, v] of Object.entries(raw.probabilities as Record<string, unknown>)) {
        probabilities[k] = clamp01(v);
      }
    }
    return { type: 'choice', choice, confidence: clamp01(raw.confidence, 0.7), probabilities };
  }
  // score
  const score = Number(raw.score ?? raw.value);
  if (!Number.isFinite(score)) return null;
  const legend: Record<string, string> = {};
  if (Array.isArray(q.criteria)) {
    q.criteria.forEach((c, i) => { legend[String(i)] = c; });
  }
  return { type: 'score', score, confidence: clamp01(raw.confidence, 0.7), legend };
}

async function callAdapterJev(
  state: string,
  questions: Record<string, JevQuestion>
): Promise<JevResult> {
  const userPrompt = `STATE TO EVALUATE:\n${state}\n\nQUESTIONS:\n${renderQuestions(questions)}\n\nRespond ONLY with a valid JSON object mapping each question key to its answer in the exact shape given. No markdown, no code fences, no commentary.`;

  const res = await cfRun(
    ADAPTER_MODEL,
    {
      messages: [
        {
          role: 'system',
          content:
            'You are Jev, TypeSafe\'s structured evaluation model. You evaluate one state against typed questions and return calibrated answers with probabilities and confidence. Be rigorous and grounded: derive every probability from the state itself, never from priors. Respond ONLY with valid JSON.'
        },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 900
    },
    25_000
  );
  if (!res.ok) return { ok: false, error: `adapter HTTP ${res.status}` };

  const data = res.json?.result ?? {};
  const text: string = String(data?.choices?.[0]?.message?.content ?? data?.response ?? '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return { ok: false, error: 'adapter returned no JSON' };

  let parsed: any;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { ok: false, error: 'adapter JSON parse failed' };
  }

  const answers: Record<string, JevAnswer> = {};
  for (const [key, q] of Object.entries(questions)) {
    const norm = normalizeAnswer(key, q, parsed?.[key]);
    if (norm) answers[key] = norm;
  }
  if (!Object.keys(answers).length) return { ok: false, error: 'adapter produced no valid answers' };

  return {
    ok: true,
    evaluation: {
      engine: 'adapter',
      model: ADAPTER_MODEL,
      answers,
      usage: data?.usage
    }
  };
}

// ── Public entry point ───────────────────────────────────────────────────────

// Evaluate one state against typed Jev questions. Tries native typesafe/jev
// first (when known/likely available), falls back to the adapter. Never throws.
export async function evaluateWithJev(
  state: string,
  questions: Record<string, JevQuestion>
): Promise<JevResult> {
  try {
    const probeDue = engine.nativeAvailable !== false && Date.now() - engine.nativeLastCheck > NATIVE_RECHECK_MS;
    if (engine.nativeAvailable === true || engine.nativeAvailable === null || probeDue) {
      const native = await callNativeJev(state, questions);
      if (native.ok) return native;
      if (engine.nativeAvailable !== false) return { ok: false, error: native.error };
    }
    return await callAdapterJev(state, questions);
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err).slice(0, 200) };
  }
}

export function isJevConfigured(): boolean {
  return !!cfCreds();
}
