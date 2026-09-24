// ── Self-hosted scraping engine (FREE, unlimited) ─────────────────────────────
// First leg of the reader chain. Fetches with a full browser-grade header set
// and rotates modern User-Agents on retry, so sites like BetExplorer (which
// 404 bare server fetches) serve the real page. No API key, no credits.

export interface SelfReadResult {
  ok: boolean;
  status: number;
  text: string;
  ua: string;
}

const USER_AGENTS = [
  // Chrome 131 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // Chrome 131 — macOS
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // Edge 131 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86',
  // Firefox 133 — Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0'
];

function browserHeaders(ua: string, referer?: string): Record<string, string> {
  const isFirefox = ua.includes('Firefox');
  const h: Record<string, string> = {
    'User-Agent': ua,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  };
  if (!isFirefox) {
    // Chromium-only client hints (Firefox rejects them).
    const brand = ua.includes('Edg/')
      ? '"Microsoft Edge";v="131", "Chromium";v="131", "Not_A Brand";v="24"'
      : '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"';
    h['sec-ch-ua'] = brand;
    h['sec-ch-ua-mobile'] = '?0';
    h['sec-ch-ua-platform'] = ua.includes('Macintosh') ? '"macOS"' : '"Windows"';
  }
  if (referer) h.Referer = referer;
  return h;
}

function challengeLike(text: string): boolean {
  return /captcha|cf-challenge|challenge-platform|just a moment|checking your browser|enable javascript|please enable javascript|access denied|request blocked|incapsula|perimeterx/i.test(
    text.slice(0, 8000)
  );
}

/** Fetch with rotated browser fingerprints. Two attempts (different UA) by default. */
export async function selfScrape(
  url: string,
  opts: { timeoutMs?: number; attempts?: number; referer?: string } = {}
): Promise<SelfReadResult> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const attempts = Math.max(1, opts.attempts ?? 2);

  let last: SelfReadResult = { ok: false, status: 0, text: '', ua: '' };
  for (let i = 0; i < attempts; i++) {
    const ua = USER_AGENTS[(i + Math.floor(Math.random() * USER_AGENTS.length)) % USER_AGENTS.length];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: browserHeaders(ua, opts.referer),
        redirect: 'follow',
        signal: controller.signal
      });
      const text = await res.text().catch(() => '');
      last = { ok: res.ok && text.length > 0 && !challengeLike(text), status: res.status, text, ua };
      // A clean 200 with real content stops the rotation; anything else rotates.
      if (last.ok) return last;
    } catch {
      last = { ok: false, status: 0, text: '', ua };
    } finally {
      clearTimeout(timeout);
    }
  }
  return last;
}
