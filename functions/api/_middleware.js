// Verify entitlement with Convex before any paid AI provider is called.
/** @param {{ request: Request, env: { PUBLIC_CONVEX_URL?: string, CONVEX_URL?: string }, next: () => Promise<Response> }} context */
export async function onRequest({ request, env, next }) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  /** @param {number} status @param {string} error */
  const reject = (status, error) => new Response(JSON.stringify({ success: false, error }), { status, headers });
  if (request.method !== 'POST') return reject(405, 'Method not allowed');
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return reject(403, 'Origin not allowed');
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return reject(401, 'Please sign in to use AI Copilot.');
  if (Number(request.headers.get('Content-Length') || 0) > 131072) return reject(413, 'Request is too large');
  const reader = request.clone().body?.getReader();
  let size = 0;
  if (reader) {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 131072) { void reader.cancel(); return reject(413, 'Request is too large'); }
      }
    } catch { return reject(400, 'Invalid request body'); }
  }
  try {
    const body = await request.clone().json();
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 40 || body.messages.some((/** @type {any} */ message) => !['system', 'user', 'assistant'].includes(message?.role) || typeof message?.content !== 'string' || message.content.length > 16000)) return reject(400, 'Invalid messages');
    if (body.max_tokens !== undefined && (!Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 4000)) return reject(400, 'Invalid token limit');
    if (body.temperature !== undefined && (!Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2)) return reject(400, 'Invalid temperature');
  } catch { return reject(400, 'Invalid JSON body'); }
  const convexUrl = env.PUBLIC_CONVEX_URL || env.CONVEX_URL;
  if (!convexUrl) return reject(503, 'AI Copilot access verification is not configured.');
  try {
    const response = await fetch(`${convexUrl.replace(/\/$/, '')}/api/mutation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authorization },
      body: JSON.stringify({ path: 'users:authorizeCopilot', args: {}, format: 'json' }),
      signal: AbortSignal.timeout(10000)
    });
    if (response.status === 401) return reject(401, 'Your session has expired. Please sign in again.');
    if (!response.ok) return reject(503, 'Access verification is temporarily unavailable. Please retry.');
    const result = await response.json();
    if (result.status !== 'success') return reject(403, 'Please sign in with an active pass to use AI Copilot.');
    if (!result.value?.allowed) return reject(429, 'Please wait a minute before requesting more AI analysis.');
    return next();
  } catch {
    return reject(503, 'Access verification is temporarily unavailable. Please retry.');
  }
}
