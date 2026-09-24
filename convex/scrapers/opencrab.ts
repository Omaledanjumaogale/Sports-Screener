// ── OpenCrab adapter (AI web-intelligence platform — currently in development) ─
// OpenCrab (opencrab.com) is building an aggregation API over public sources.
// This adapter is wired so that the moment an OPENCRAB_API_KEY + endpoint are
// provisioned, the engine joins the reader chain with zero code changes.
// Until then it no-ops cleanly (missing key → skipped leg).

declare const process: { env: Record<string, string | undefined> };

export interface OpenCrabResult {
  ok: boolean;
  status: number;
  text: string;
}

export function opencrabKey(): string {
  return process.env.OPENCRAB_API_KEY?.trim() || process.env.OPENCRAB_API_KEYS?.trim() || '';
}

export function opencrabEndpoint(): string {
  return process.env.OPENCRAB_API_URL?.trim() || 'https://api.opencrab.com/v1/scrape';
}

export async function opencrabRead(
  url: string,
  opts: { timeoutMs?: number } = {}
): Promise<OpenCrabResult> {
  const key = opencrabKey();
  if (!key) return { ok: false, status: 0, text: '' }; // platform not provisioned yet

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch(opencrabEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, format: 'markdown' }),
      signal: controller.signal
    });
    const raw = await res.text().catch(() => '');
    let text = raw;
    if (/^\s*[{\[]/.test(raw)) {
      try {
        const j = JSON.parse(raw);
        text = j?.data?.content ?? j?.data?.markdown ?? j?.content ?? j?.markdown ?? '';
      } catch {
        /* keep raw */
      }
    }
    return { ok: res.ok && text.length > 0, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}
