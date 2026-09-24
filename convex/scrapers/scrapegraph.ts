// ── ScrapeGraphAI hosted scrape engine (v2 API) ───────────────────────────────
// POST https://v2-api.scrapegraphai.com/api/scrape with SGAI-APIKEY header.
// stealth mode routes through residential proxies + anti-bot headers — the
// strongest option against BetExplorer-class bot walls. Free tier available.

declare const process: { env: Record<string, string | undefined> };

export interface ScrapeGraphResult {
  ok: boolean;
  status: number;
  text: string;
}

export function scrapegraphKey(): string {
  return (
    process.env.SCRAPEGRAPH_API_KEY?.trim() ||
    process.env.SCRAPEGRAPH_API_KEYS?.trim() ||
    process.env.SGAI_API_KEY?.trim() ||
    ''
  );
}

export async function scrapegraphRead(
  url: string,
  opts: { timeoutMs?: number; stealth?: boolean } = {}
): Promise<ScrapeGraphResult> {
  const key = scrapegraphKey();
  if (!key) return { ok: false, status: 0, text: '' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await fetch('https://v2-api.scrapegraphai.com/api/scrape', {
      method: 'POST',
      headers: {
        'SGAI-APIKEY': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url,
        formats: [{ type: 'markdown' }],
        fetchConfig: {
          mode: 'auto',
          stealth: opts.stealth ?? true,
          timeout: Math.min(Math.max(opts.timeoutMs ?? 30_000, 1000), 60_000)
        }
      }),
      signal: controller.signal
    });
    const raw = await res.text().catch(() => '');
    let text = '';
    if (/^\s*[{\[]/.test(raw)) {
      try {
        const j = JSON.parse(raw);
        const md = j?.results?.markdown?.data;
        text = Array.isArray(md) ? md.join('\n') : typeof md === 'string' ? md : '';
        if (!text && typeof j?.error === 'string') text = '';
      } catch {
        /* keep empty */
      }
    }
    return { ok: res.ok && text.length > 0, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}
