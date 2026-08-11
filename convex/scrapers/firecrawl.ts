// Firecrawl — secondary scraping transport for JS-heavy odds pages.

declare const process: { env: Record<string, string | undefined> };

export interface FirecrawlResult {
  ok: boolean;
  status: number;
  text: string;
}

export async function firecrawlRead(url: string, timeoutMs = 30_000): Promise<FirecrawlResult> {
  // Accept *_API_KEY / *_API_KEYS aliases.
  const key = process.env.FIRECRAWL_API_KEY?.trim() || process.env.FIRECRAWL_API_KEYS?.trim();
  if (!key) return { ok: false, status: 0, text: '' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url, formats: ['markdown'] }),
      signal: controller.signal
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, status: res.status, text: body };
    }
    const data = await res.json().catch(() => null);
    const text = data?.data?.markdown ?? data?.data?.content ?? '';
    return { ok: true, status: 200, text: String(text) };
  } catch {
    return { ok: false, status: 0, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}
