// functions/api/ai-analyze.js
// Edge Function — runs at the Cloudflare edge on every request.
// Route: POST /api/ai-analyze
// Provider chain:
//   1. Agnes AI   (primary  — OpenAI-compatible, enterprise grade)
//   2. OpenRouter (secondary — free Mistral fallback)
//   3. Cloudflare AI binding (tertiary — native CF Workers AI)
//   4. Cloudflare REST API  (quaternary — token-based CF AI)

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
      model: 'Agnes AI',
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
      model: 'mistralai/mistral-7b-instruct:free',
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

  return { responseText, tokensUsed, model: 'Mistral-7B', provider: 'openrouter' };
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

    const { messages, max_tokens = 2000, temperature = 0.25 } = body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'messages array is required' }),
        { status: 400, headers: corsHeaders }
      );
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
            tokensUsed: agnesResult.tokensUsed
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
            tokensUsed: orResult.tokensUsed
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

        const responseText = safeStringify(result?.response);
        const tokensUsed = Number(result?.usage?.total_tokens) || 0;

        if (responseText) {
          return new Response(
            JSON.stringify({
              success: true,
              provider: 'cloudflare-ai',
              model: 'Llama-3.1-8B',
              response: responseText,
              tokensUsed
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
          const responseText = safeStringify(data?.result?.response);
          const tokensUsed = Number(data?.result?.usage?.total_tokens) || 0;

          if (responseText) {
            return new Response(
              JSON.stringify({
                success: true,
                provider: 'cloudflare-rest',
                model: 'Llama-3.1-8B',
                response: responseText,
                tokensUsed
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
