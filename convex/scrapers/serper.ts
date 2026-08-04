// Serper (Google SERP) — used to discover/validate cross-reference sources and
// pull snippet-level consensus for research validation (Bolanle Adeyemi).

declare const process: { env: Record<string, string | undefined> };

export interface SerperResult {
  ok: boolean;
  items: { title: string; link: string; snippet: string }[];
  text: string;
}

export async function serperSearch(query: string, num = 5): Promise<SerperResult> {
  const key = process.env.SERPER_API_KEY?.trim();
  if (!key) return { ok: false, items: [], text: '' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ q: query, num }),
      signal: controller.signal
    });
    if (!res.ok) return { ok: false, items: [], text: '' };
    const data: any = await res.json().catch(() => null);
    const items: SerperResult['items'] = (data?.organic ?? []).map((it: any) => ({
      title: String(it.title || ''),
      link: String(it.link || ''),
      snippet: String(it.snippet || '')
    }));
    return { ok: true, items, text: items.map((i) => `${i.title}: ${i.snippet}`).join('\n') };
  } finally {
    clearTimeout(timeout);
  }
}
