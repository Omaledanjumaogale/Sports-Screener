// Bright Data — live-odds transport for exchange/sharp sources (Pinnacle, BetFair).

declare const process: { env: Record<string, string | undefined> };

export interface BrightDataResult {
  ok: boolean;
  text: string;
}

export async function brightDataRead(url: string, timeoutMs = 25_000): Promise<BrightDataResult> {
  const key = process.env.BRIGHTDATA_API_KEY?.trim();
  if (!key) return { ok: false, text: '' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.brightdata.com/request?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal
    });
    const text = await res.text().catch(() => '');
    return { ok: res.ok, text };
  } catch {
    return { ok: false, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}
