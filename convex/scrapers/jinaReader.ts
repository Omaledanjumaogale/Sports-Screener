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
  const key = process.env.JINA_API_KEY?.trim();
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
    const raw = await res.text().catch(() => '');
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
    return { ok: res.ok, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}
