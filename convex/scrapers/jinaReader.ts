// Jina Reader (r.jina.ai) — primary text-extraction transport for scraping odds
// pages behind bot challenges. Reads a bearer token from the Convex env.

declare const process: { env: Record<string, string | undefined> };

export interface FetchPageOptions {
  timeoutMs?: number;
  targetSelector?: string;
  raw?: boolean;
}

export interface FetchPageResult {
  ok: boolean;
  status: number;
  text: string;
}

export async function jinaRead(url: string, opts: FetchPageOptions = {}): Promise<FetchPageResult> {
  // Accept *_API_KEY / *_AI_API_KEYS / *_API_KEYS aliases.
  const key =
    process.env.JINA_API_KEY?.trim() ||
    process.env.JINA_AI_API_KEYS?.trim() ||
    process.env.JINA_API_KEYS?.trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Return-Format': 'markdown'
    };
    if (key) headers.Authorization = `Bearer ${key}`;
    if (opts.targetSelector) headers['X-Target-Selector'] = opts.targetSelector;

    const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal: controller.signal });
    let raw = await res.text().catch(() => '');

    // Key present but OUT OF CREDITS (402) or rate-limited (429)? Retry
    // KEYLESS — r.jina.ai serves unauthenticated traffic on a free tier, so a
    // dead billing state no longer takes the whole transport down.
    let status = res.status;
    if ((status === 402 || status === 429) && key) {
      const retry = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain', 'X-Return-Format': 'text' },
        signal: controller.signal
      }).catch(() => null);
      if (retry && retry.ok) {
        raw = await retry.text().catch(() => '');
        status = retry.status;
      }
    }

    // Jina returns JSON (Accept: application/json) — extract the readable
    // content so downstream parsers (fixture + score line scanners) receive
    // markdown/text instead of a JSON blob with escaped content.
    let text = raw;
    if (/^\s*[{\[]/.test(raw)) {
      try {
        const j = JSON.parse(raw);
        text = j?.data?.content ?? j?.content ?? (typeof j === 'string' ? j : '');
      } catch {
        /* keep raw text */
      }
    }
    return { ok: status >= 200 && status < 300 && text.length > 0, status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}
