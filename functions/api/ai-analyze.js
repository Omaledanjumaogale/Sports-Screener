// functions/api/ai-analyze.js
// Edge Function — runs at the Cloudflare edge on every request.
// Route: POST /api/ai-analyze
// Keeps API tokens server-side — no CORS issues.

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

    const { messages, max_tokens = 500, temperature = 0.25 } = body || {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'messages array is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Primary: OpenRouter (always available when key is set) ────────────────
    const orKey =
      (env && env.OPENROUTER_API_KEY) ||
      (env && env.VITE_OPENROUTER_API_KEY) ||
      '';

    if (orKey) {
      try {
        const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${orKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://pulseodds.pages.dev',
            'X-Title': 'PulseOdds Screener'
          },
          body: JSON.stringify({
            model: 'mistralai/mistral-7b-instruct:free',
            messages,
            max_tokens,
            temperature
          })
        });

        if (orRes.ok) {
          const data = await orRes.json().catch(() => null);
          const rawContent = data?.choices?.[0]?.message?.content;
          const responseText = safeStringify(rawContent);
          const tokensUsed = Number(data?.usage?.total_tokens) || 0;

          return new Response(
            JSON.stringify({
              success: true,
              provider: 'ai-copilot',
              model: 'ai-copilot',
              response: responseText,
              tokensUsed
            }),
            { headers: corsHeaders }
          );
        } else {
          const errRaw = await orRes.text().catch(() => '');
          const errStr = safeStringify(errRaw);
          console.error('[AI Copilot] Primary request failed:', orRes.status, errStr.slice(0, 300));
        }
      } catch (orErr) {
        const msg = safeStringify(orErr?.message || orErr);
        console.error('[AI Copilot] Primary request error:', msg);
      }
    }

    // ── Secondary: Cloudflare AI binding (if env.AI available) ───────────────
    if (env && env.AI) {
      try {
        const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages,
          max_tokens,
          temperature
        });

        const responseText = safeStringify(result?.response);
        const tokensUsed = Number(result?.usage?.total_tokens) || 0;

        return new Response(
          JSON.stringify({
            success: true,
            provider: 'ai-copilot',
            model: 'ai-copilot',
            response: responseText,
            tokensUsed
          }),
          { headers: corsHeaders }
        );
      } catch (aiErr) {
        const msg = safeStringify(aiErr?.message || aiErr);
        console.error('[AI Copilot] Secondary binding error:', msg);
      }
    }

    // ── Tertiary: Cloudflare REST API (token-based fallback) ─────────────────
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
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ messages, max_tokens, temperature })
          }
        );

        if (cfRes.ok) {
          const data = await cfRes.json().catch(() => null);
          const responseText = safeStringify(data?.result?.response);
          const tokensUsed = Number(data?.result?.usage?.total_tokens) || 0;

          return new Response(
            JSON.stringify({
              success: true,
              provider: 'ai-copilot',
              model: 'ai-copilot',
              response: responseText,
              tokensUsed
            }),
            { headers: corsHeaders }
          );
        } else {
          const errRaw = await cfRes.text().catch(() => '');
          const errStr = safeStringify(errRaw);
          console.error('[AI Copilot] Tertiary request failed:', cfRes.status, errStr.slice(0, 300));
        }
      } catch (cfErr) {
        const msg = safeStringify(cfErr?.message || cfErr);
        console.error('[AI Copilot] Tertiary request error:', msg);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'AI Copilot service is currently updating. Please try again in a few moments.'
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
