// functions/api/_middleware.js
// Edge security gate for every Pages Function under /api/*.
//
// A zone-level Cloudflare WAF custom rule cannot be attached to *.pages.dev
// hosts (they live on Cloudflare's managed zone), so this middleware IS the
// edge enforcement: any method other than POST (the only method the AI
// endpoints accept) or OPTIONS (CORS preflight) is rejected with 405 BEFORE
// the ai-analyze handler runs — the upstream AI providers are never called.
//
// Defense in depth: ai-analyze.js also carries its own 405 catch-all, so this
// gate only short-circuits earlier in the request pipeline.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export async function onRequest(context) {
  const { request } = context;
  const method = String(request.method || 'GET').toUpperCase();

  if (method !== 'POST' && method !== 'OPTIONS') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  // POST / OPTIONS: proceed to the route handler (ai-analyze.js).
  return context.next();
}
