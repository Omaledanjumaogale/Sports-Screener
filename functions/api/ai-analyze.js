// functions/api/ai-analyze.js
// Edge Function — runs at the Cloudflare edge on every request.
// Route: POST /api/ai-analyze
// Provider chain:
//   1. Agnes AI   (primary  — OpenAI-compatible, enterprise grade)
//   2. OpenRouter (secondary — free Mistral fallback)
//   3. Cloudflare AI binding (tertiary — native CF Workers AI)
//   4. Cloudflare REST API  (quaternary — token-based CF AI)

// ── Jev structured evaluation (typesafe/jev contract) ──────────────────────────
// The in-app AI Copilot drafts its answers FROM typed Jev decisions: every
// request is first evaluated against noul/choice/score questions and the
// calibrated answers are injected as an anchor for the responding LLM.
//
// Engine: native `typesafe/jev` is tried first; if the account doesn't have it
// provisioned yet, the identical contract is served by an adapter over the
// account's Workers AI text models (mirror of convex/jev.ts, kept
// self-contained at the edge). Failure degrades silently to the plain chain.
const JEV_NATIVE_MODEL = 'typesafe/jev';
const JEV_ADAPTER_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
let jevNativeUnavailable = false;

function cfCreds(env) {
  const account = (env && (env.CF_ACCOUNT_ID || env.VITE_CF_ACCOUNT_ID)) || '';
  const token = (env && (env.CF_WORKER_AI_TOKEN || env.VITE_CF_WORKER_AI_TOKEN)) || '';
  return account && token ? { account, token } : null;
}

async function cfRun(model, body, env, timeoutMs = 25000) {
  const creds = cfCreds(env);
  if (!creds) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${creds.account}/ai/run/${model}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${creds.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      }
    );
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.success ? json.result : null;
  } catch (_) {
    return null;
  }
}

function clamp01(n) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
}

// Typed questions every Copilot request is evaluated against.
function jevQuestions() {
  return {
    answer_depth: {
      type: 'choice',
      instructions: 'What response shape best serves this user request?',
      criteria: {
        quick_read: 'Short direct answer — a fact, price check or yes/no',
        market_analysis: 'Structured analysis of odds/markets with numbers',
        risk_guidance: 'Risk-focused answer — caution, staking, bankroll safety',
        explanation: 'Educational explanation of a concept or term'
      }
    },
    is_betting_context: {
      type: 'noul',
      instructions: 'Does this request concern betting markets, odds or predictions?',
      criteria: { true: 'Odds, markets, teams, staking or predictions involved', false: 'General/non-betting request' }
    },
    caution_level: {
      type: 'score',
      instructions: 'How much responsible-gambling caution should the answer carry?',
      criteria: ['Standard', 'Add staking caution', 'Strong caution — chase/loss signals']
    }
  };
}

function renderJevPrompt(state, questions) {
  const q = Object.entries(questions)
    .map(([key, q]) => {
      const crit = Object.entries(q.criteria)
        .map(([k, v]) => `  "${k}": ${v}`)
        .join('\n');
      const shape =
        q.type === 'noul'
          ? `"${key}": { "noul": <0.00-1.00>, "confidence": <0.00-1.00> }`
          : q.type === 'choice'
            ? `"${key}": { "choice": <option key>, "probabilities": { <option>: <0.00-1.00> }, "confidence": <0.00-1.00> }`
            : `"${key}": { "score": <number>, "confidence": <0.00-1.00> }`;
      return `Question "${key}" (${q.type}):\n${q.instructions}\nCriteria:\n${crit}\nShape: ${shape}`;
    })
    .join('\n\n');
  return `STATE TO EVALUATE:\n${state}\n\nQUESTIONS:\n${q}\n\nRespond ONLY with a valid JSON object mapping each question key to its answer in the exact shape given. No markdown, no commentary.`;
}

function parseJevAnswers(questions, raw) {
  if (!raw || typeof raw !== 'object') return null;
  const answers = {};
  for (const [key, q] of Object.entries(questions)) {
    const r = raw[key];
    if (!r || typeof r !== 'object') continue;
    if (q.type === 'noul' && r.noul !== undefined) {
      answers[key] = { type: 'noul', noul: clamp01(r.noul), confidence: clamp01(r.confidence || 0.7) };
    } else if (q.type === 'choice' && r.choice !== undefined) {
      const options = Object.keys(q.criteria);
      const choice = options.includes(r.choice) ? r.choice : options.find((o) => o.toLowerCase() === String(r.choice).toLowerCase());
      if (choice) answers[key] = { type: 'choice', choice, confidence: clamp01(r.confidence || 0.7) };
    } else if (q.type === 'score' && r.score !== undefined && Number.isFinite(Number(r.score))) {
      answers[key] = { type: 'score', score: Number(r.score), confidence: clamp01(r.confidence || 0.7) };
    }
  }
  return Object.keys(answers).length ? answers : null;
}

// Evaluate the request state through Jev. Returns { engine, model, answers }
// or null (never throws — the Copilot chain continues without it).
async function evaluateWithJev(userState, env) {
  if (!cfCreds(env)) return null;
  const questions = jevQuestions();
  try {
    if (!jevNativeUnavailable) {
      const native = await cfRun(JEV_NATIVE_MODEL, { state: userState, questions }, env, 20000);
      if (native?.answers) return { engine: 'native-jev', model: String(native.model || JEV_NATIVE_MODEL), answers: native.answers };
      if (native === null) jevNativeUnavailable = true; // route/HTTP failure → stop retrying this isolate
    }
    const result = await cfRun(
      JEV_ADAPTER_MODEL,
      {
        messages: [
          {
            role: 'system',
            content: 'You are Jev, TypeSafe\'s structured evaluation model. Evaluate the state against the typed questions and return calibrated answers with probabilities and confidence, grounded strictly in the state. Respond ONLY with valid JSON.'
          },
          { role: 'user', content: renderJevPrompt(userState, questions) }
        ],
        temperature: 0.2,
        max_tokens: 700
      },
      env
    );
    const text = safeStringify(result?.choices?.[0]?.message?.content ?? result?.response ?? '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));
    const answers = parseJevAnswers(questions, parsed);
    return answers ? { engine: 'adapter', model: JEV_ADAPTER_MODEL, answers } : null;
  } catch (_) {
    return null;
  }
}

// Turn Jev answers into the anchor injected ahead of the responding LLM.
function jevAnchor(jev) {
  if (!jev || !jev.answers) return '';
  const lines = [];
  const d = jev.answers.answer_depth;
  if (d && d.type === 'choice') {
    const shapes = {
      quick_read: 'a short, direct answer',
      market_analysis: 'a structured market analysis with the real numbers',
      risk_guidance: 'a risk-focused answer with staking caution',
      explanation: 'a clear educational explanation'
    };
    lines.push(`Response shape: ${shapes[d.choice] || d.choice}.`);
  }
  const bet = jev.answers.is_betting_context;
  if (bet && bet.type === 'noul') {
    lines.push(bet.noul >= 0.5 ? 'Betting context: YES — ground every claim in the odds/probability data provided.' : 'Betting context: NO — answer the general question without inventing market data.');
  }
  const ca = jev.answers.caution_level;
  if (ca && ca.type === 'score') {
    const level = Math.max(0, Math.min(2, Math.round(ca.score)));
    lines.push(['Carry standard responsible-play framing.', 'Include explicit staking/bankroll caution.', 'Lead with strong responsible-gambling caution — the user shows chase/loss signals.'][level]);
  }
  if (!lines.length) return '';
  return `\n\nJEV STRUCTURED EVALUATION (typed decisions from the Jev model — draft your answer FROM these):\n- ${lines.join('\n- ')}\n(Engine: ${jev.engine}, model: ${jev.model})\n`;
}

function safeStringify(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map((item) => safeStringify(item)).join(' ');
  }
  if (typeof val === 'object') {
    if (val.text && typeof val.text === 'string') return val.text;
    try {
      return JSON.stringify(val);
    } catch (_) {
      return String(val);
    }
  }
  return String(val);
}

// Strip markdown code fences from AI response to get clean JSON
function cleanJsonResponse(text) {
  if (!text) return text;
  // Remove ```json ... ``` or ``` ... ``` wrappers
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

// ── Agnes AI helper (OpenAI-compatible chat/completions) ──────────────────────
async function callAgnesAi(messages, max_tokens, temperature, env) {
  const agnesKey =
    (env && (env.AGNES_AI_KEY || env.VITE_AGNES_AI_KEY)) || '';
  if (!agnesKey) return null;

  const res = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${agnesKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 PulseOdds/1.0',
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({
      // Model id must be the API's catalog id. The literal 'Agnes AI' started
      // returning 503 model_not_found; 'agnes-2.5-flash' is the served id.
      model: (env && env.AGNES_AI_MODEL) || 'agnes-2.5-flash',
      messages,
      max_tokens,
      temperature
    }),
    // Hard timeout so a hung upstream can never burn the worker's CPU budget
    // and surface as a Cloudflare 500 error page to the user.
    signal: AbortSignal.timeout(30_000)
  });

  if (!res.ok) {
    const errRaw = await res.text().catch(() => '');
    console.error('[AI Copilot] Agnes AI request failed:', res.status, safeStringify(errRaw).slice(0, 200));
    return null;
  }

  const data = await res.json().catch(() => null);
  const rawContent = data?.choices?.[0]?.message?.content;
  const responseText = cleanJsonResponse(safeStringify(rawContent));
  const tokensUsed = Number(data?.usage?.total_tokens) || 0;

  if (!responseText) return null;

  return { responseText, tokensUsed, model: 'Agnes AI', provider: 'agnes-ai' };
}

// ── OpenRouter helper ─────────────────────────────────────────────────────────
async function callOpenRouter(messages, max_tokens, temperature, env) {
  const orKey =
    (env && (env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY)) || '';
  if (!orKey) return null;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${orKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 PulseOdds/1.0',
      'HTTP-Referer': 'https://pulseodds.pages.dev',
      'X-Title': 'PulseOdds Screener'
    },
    body: JSON.stringify({
      // Free catalog rotates; mistral-7b:free was retired (404). glm-5.2:free
      // verified live; override with OPENROUTER_MODEL when the catalog shifts.
      model: (env && env.OPENROUTER_MODEL) || 'z-ai/glm-5.2:free',
      messages,
      max_tokens,
      temperature
    }),
    signal: AbortSignal.timeout(30_000)
  });

  if (!res.ok) {
    const errRaw = await res.text().catch(() => '');
    console.error('[AI Copilot] OpenRouter failed:', res.status, safeStringify(errRaw).slice(0, 200));
    return null;
  }

  const data = await res.json().catch(() => null);
  const rawContent = data?.choices?.[0]?.message?.content;
  const responseText = cleanJsonResponse(safeStringify(rawContent));
  const tokensUsed = Number(data?.usage?.total_tokens) || 0;

  if (!responseText) return null;

  return { responseText, tokensUsed, model: 'GLM-5.2', provider: 'openrouter' };
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON request payload' }),
        { status: 400, headers: corsHeaders }
      );
    }

    let { messages, max_tokens = 2000, temperature = 0.25 } = body || {};

    // Server-side budget clamps: one request can never burn an unreasonable
    // share of the provider quota (cost-abuse guard).
    max_tokens = Math.min(4000, Math.max(200, Number(max_tokens) || 2000));
    temperature = Math.min(1, Math.max(0, Number(temperature) || 0.25));
    if (Array.isArray(messages) && messages.length > 40) {
      messages = messages.slice(-40); // keep the most recent context only
    }
    if (Array.isArray(messages)) {
      messages = messages.map((m) =>
        m && typeof m.content === 'string' && m.content.length > 64000
          ? { ...m, content: m.content.slice(0, 64000) }
          : m
      );
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      // Deployment diagnostic: POST { diag: true } reports provider key
      // visibility as booleans (never values) — passes the POST-only gate.
      if (body && body.diag) {
        return new Response(
          JSON.stringify({
            success: true,
            diag: true,
            keys: {
              agnes: !!(env.AGNES_AI_KEY || env.VITE_AGNES_AI_KEY),
              openrouter: !!(env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY),
              cfAccount: !!(env.CF_ACCOUNT_ID || env.VITE_CF_ACCOUNT_ID),
              cfToken: !!(env.CF_WORKER_AI_TOKEN || env.VITE_CF_WORKER_AI_TOKEN),
              aiBinding: !!env.AI
            }
          }),
          { headers: corsHeaders }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: 'messages array is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ── 0. Jev structured evaluation (drafts the answer shape for the LLM) ────
    let jev = null;
    try {
      const lastUser = [...messages].reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string');
      if (lastUser) {
        jev = await evaluateWithJev(lastUser.content.slice(0, 4000), env);
        if (jev) {
          const anchor = jevAnchor(jev);
          if (anchor) {
            // Merge into the leading system message (or prepend one) so every
            // provider in the chain sees the same anchor.
            if (messages[0] && messages[0].role === 'system' && typeof messages[0].content === 'string') {
              messages = [{ ...messages[0], content: messages[0].content + anchor }, ...messages.slice(1)];
            } else {
              messages = [{ role: 'system', content: 'You are the PulseOdds AI Copilot.' + anchor }, ...messages];
            }
          }
        }
      }
    } catch (jevErr) {
      console.error('[AI Copilot] Jev evaluation skipped:', safeStringify(jevErr?.message || jevErr));
      jev = null;
    }

    // ── 1. Agnes AI (primary — enterprise-grade) ──────────────────────────────
    try {
      const agnesResult = await callAgnesAi(messages, max_tokens, temperature, env);
      if (agnesResult) {
        return new Response(
          JSON.stringify({
            success: true,
            provider: agnesResult.provider,
            model: agnesResult.model,
            response: agnesResult.responseText,
            tokensUsed: agnesResult.tokensUsed,
            ...(jev ? { jev: { engine: jev.engine, model: jev.model } } : {})
          }),
          { headers: corsHeaders }
        );
      }
    } catch (agnesErr) {
      console.error('[AI Copilot] Agnes AI error:', safeStringify(agnesErr?.message || agnesErr));
    }

    // ── 2. OpenRouter (secondary fallback) ────────────────────────────────────
    try {
      const orResult = await callOpenRouter(messages, max_tokens, temperature, env);
      if (orResult) {
        return new Response(
          JSON.stringify({
            success: true,
            provider: orResult.provider,
            model: orResult.model,
            response: orResult.responseText,
            tokensUsed: orResult.tokensUsed,
            ...(jev ? { jev: { engine: jev.engine, model: jev.model } } : {})
          }),
          { headers: corsHeaders }
        );
      }
    } catch (orErr) {
      console.error('[AI Copilot] OpenRouter error:', safeStringify(orErr?.message || orErr));
    }

    // ── 3. Cloudflare AI binding (tertiary — native binding) ──────────────────
    if (env && env.AI) {
      try {
        const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages,
          max_tokens,
          temperature
        });

        // Binding returns { response } — tolerate OpenAI-shaped payloads too.
        const responseText = safeStringify(
          result?.response ?? result?.choices?.[0]?.message?.content
        );
        const tokensUsed = Number(result?.usage?.total_tokens) || 0;

        if (responseText) {
          return new Response(
            JSON.stringify({
              success: true,
              provider: 'cloudflare-ai',
              model: 'Llama-3.1-8B',
              response: responseText,
              tokensUsed,
              ...(jev ? { jev: { engine: jev.engine, model: jev.model } } : {})
            }),
            { headers: corsHeaders }
          );
        }
      } catch (aiErr) {
        console.error('[AI Copilot] CF binding error:', safeStringify(aiErr?.message || aiErr));
      }
    }

    // ── 4. Cloudflare REST API (quaternary fallback) ───────────────────────────
    const cfAccountId = (env && (env.CF_ACCOUNT_ID || env.VITE_CF_ACCOUNT_ID)) || '';
    const cfToken = (env && (env.CF_WORKER_AI_TOKEN || env.VITE_CF_WORKER_AI_TOKEN)) || '';

    if (cfAccountId && cfToken) {
      try {
        const cfRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${cfToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ messages, max_tokens, temperature }),
            signal: AbortSignal.timeout(30_000)
          }
        );

        if (cfRes.ok) {
          const data = await cfRes.json().catch(() => null);
          // The REST API now returns OpenAI-compatible shape
          // (result.choices[0].message.content); legacy result.response kept
          // as fallback so neither shape is dropped.
          const responseText = safeStringify(
            data?.result?.choices?.[0]?.message?.content ?? data?.result?.response
          );
          const tokensUsed = Number(data?.result?.usage?.total_tokens) || 0;

          if (responseText) {
            return new Response(
              JSON.stringify({
                success: true,
                provider: 'cloudflare-rest',
                model: 'Llama-3.1-8B',
                response: responseText,
                tokensUsed,
                ...(jev ? { jev: { engine: jev.engine, model: jev.model } } : {})
              }),
              { headers: corsHeaders }
            );
          }
        } else {
          const errRaw = await cfRes.text().catch(() => '');
          console.error('[AI Copilot] CF REST failed:', cfRes.status, safeStringify(errRaw).slice(0, 300));
        }
      } catch (cfErr) {
        console.error('[AI Copilot] CF REST error:', safeStringify(cfErr?.message || cfErr));
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'AI Copilot service is temporarily unavailable. Local Master Model analysis remains fully active.'
      }),
      { status: 503, headers: corsHeaders }
    );
  } catch (err) {
    const msg = safeStringify(err?.message || err || 'Internal server error');
    console.error('[AI Copilot] Unhandled error:', msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle preflight OPTIONS
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// Diagnostic: which provider keys does this deployment see? (booleans only)
export async function onRequestGet(context) {
  const { env } = context;
  return new Response(
    JSON.stringify({
      success: true,
      keys: {
        agnes: !!(env.AGNES_AI_KEY || env.VITE_AGNES_AI_KEY),
        openrouter: !!(env.OPENROUTER_API_KEY || env.VITE_OPENROUTER_API_KEY),
        cfAccount: !!(env.CF_ACCOUNT_ID || env.VITE_CF_ACCOUNT_ID),
        cfToken: !!(env.CF_WORKER_AI_TOKEN || env.VITE_CF_WORKER_AI_TOKEN),
        aiBinding: !!env.AI
      }
    }),
    { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
  );
}

// Any non-POST method (GET/HEAD/PUT/DELETE...) gets a clean 405 JSON instead of
// falling through to the SPA fallback or surfacing an edge error page.
export async function onRequest() {
  return new Response(
    JSON.stringify({ success: false, error: 'Method not allowed' }),
    {
      status: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
      }
    }
  );
}
