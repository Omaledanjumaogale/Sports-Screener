// ── Keyless free relay tier (FREE, unlimited within politeness) ───────────────
// When the target site blocks the app's own egress IP (datacenter IP ban —
// BetExplorer does exactly this), public relay services fetch the page from
// THEIR edge IPs and stream the body back. No API keys, no credits.

export interface RelayResult {
  ok: boolean;
  status: number;
  text: string;
  relay: string;
}

function clean(text: string): string {
  return text || '';
}

// AllOrigins — raw pass-through of the upstream body.
async function viaAllOrigins(url: string, timeoutMs: number): Promise<RelayResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
      headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      signal: controller.signal
    });
    const text = clean(await res.text().catch(() => ''));
    return { ok: res.ok && text.length > 0, status: res.status, text, relay: 'allorigins' };
  } catch {
    return { ok: false, status: 0, text: '', relay: 'allorigins' };
  } finally {
    clearTimeout(timeout);
  }
}

// Codetabs proxy — 5 req/s free tier.
async function viaCodetabs(url: string, timeoutMs: number): Promise<RelayResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {
      headers: { Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      signal: controller.signal
    });
    const text = clean(await res.text().catch(() => ''));
    return { ok: res.ok && text.length > 0, status: res.status, text, relay: 'codetabs' };
  } catch {
    return { ok: false, status: 0, text: '', relay: 'codetabs' };
  } finally {
    clearTimeout(timeout);
  }
}

// r.jina.ai KEYLESS — Jina Reader allows unauthenticated requests (~20 RPM).
// The keyed jinaRead transport stays the premium path; this is the free leg.
async function viaJinaKeyless(url: string, timeoutMs: number): Promise<RelayResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
      signal: controller.signal
    });
    const text = clean(await res.text().catch(() => ''));
    // 429/451 on the keyless tier — the caller falls through to the next relay.
    return { ok: res.ok && text.length > 0, status: res.status, text, relay: 'jina-keyless' };
  } catch {
    return { ok: false, status: 0, text: '', relay: 'jina-keyless' };
  } finally {
    clearTimeout(timeout);
  }
}

const RELAYS: Array<(url: string, timeoutMs: number) => Promise<RelayResult>> = [
  viaAllOrigins,
  viaCodetabs,
  viaJinaKeyless
];

/** Try every keyless relay in order. Never throws. */
export async function freeRelayRead(
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<RelayResult> {
  const timeoutMs = opts.timeoutMs ?? 25_000;
  let last: RelayResult = { ok: false, status: 0, text: '', relay: 'none' };
  for (const relay of RELAYS) {
    const r = await relay(url, timeoutMs);
    if (r.ok && r.text.trim().length >= 60) return r;
    if (r.text.length > last.text.length) last = r;
  }
  return last;
}
