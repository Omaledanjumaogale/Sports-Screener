// functions/api/ai-analyze.js
// Edge Function — runs at the Cloudflare edge on every request.
// Route: POST /api/ai-analyze
// Keeps API tokens server-side — no CORS issues.

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { messages, max_tokens = 500, temperature = 0.25 } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'messages array is required' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // ── Primary: OpenRouter (always available when key is set) ────────────────
    const orKey =
      env.OPENROUTER_API_KEY ||
      env.VITE_OPENROUTER_API_KEY ||
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
          const data = await orRes.json();
          const responseText = data?.choices?.[0]?.message?.content ?? '';
          const tokensUsed = data?.usage?.total_tokens ?? 0;

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
          const errBody = await orRes.text().catch(() => '');
          console.error('[AI Copilot] Primary request failed:', orRes.status, errBody.slice(0, 300));
        }
      } catch (orErr) {
        console.error('[AI Copilot] Primary request error:', orErr?.message);
      }
    }

    // ── Secondary: Cloudflare AI binding (if env.AI available) ───────────────
    if (env.AI) {
      try {
        const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages,
          max_tokens,
          temperature
        });

        const responseText = result?.response ?? '';
        const tokensUsed = result?.usage?.total_tokens ?? 0;

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
        console.error('[AI Copilot] Secondary binding error:', aiErr?.message);
      }
    }

    // ── Tertiary: Cloudflare REST API (token-based fallback) ─────────────────
    const cfAccountId = env.CF_ACCOUNT_ID || env.VITE_CF_ACCOUNT_ID || '';
    const cfToken = env.CF_WORKER_AI_TOKEN || env.VITE_CF_WORKER_AI_TOKEN || '';

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
          const data = await cfRes.json();
          const responseText = data?.result?.response ?? '';
          const tokensUsed = data?.result?.usage?.total_tokens ?? 0;

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
          const errBody = await cfRes.text().catch(() => '');
          console.error('[AI Copilot] Tertiary request failed:', cfRes.status, errBody.slice(0, 300));
        }
      } catch (cfErr) {
        console.error('[AI Copilot] Tertiary request error:', cfErr?.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'AI Copilot is temporarily unavailable. Please check your environment configuration and try again.'
      }),
      { status: 503, headers: corsHeaders }
    );
  } catch (err) {
    console.error('[AI Copilot] Unhandled error:', err?.message);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Internal server error' }),
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
