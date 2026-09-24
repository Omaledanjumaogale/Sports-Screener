// Bright Data — live-odds transport for exchange/sharp sources (Pinnacle, BetFair).
// The Unlocker zone is configurable via BRIGHTDATA_ZONE (default 'web_unlocker1')
// so a renamed/recreated dashboard zone only needs an env update, not a deploy.

declare const process: { env: Record<string, string | undefined> };

export interface BrightDataResult {
  ok: boolean;
  text: string;
}

export function brightDataZone(): string {
  return process.env.BRIGHTDATA_ZONE?.trim() || 'web_unlocker1';
}

export async function brightDataRead(url: string, timeoutMs = 25_000): Promise<BrightDataResult> {
  // Accept *_API_KEY / *_API_KEYS aliases.
  const key = process.env.BRIGHTDATA_API_KEY?.trim() || process.env.BRIGHTDATA_API_KEYS?.trim();
  if (!key) return { ok: false, text: '' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `https://api.brightdata.com/request?zone=${encodeURIComponent(brightDataZone())}&url=${encodeURIComponent(url)}`,
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ zone: brightDataZone(), url, format: 'raw' }),
        signal: controller.signal
      }
    );
    const text = await res.text().catch(() => '');
    return { ok: res.ok && text.length > 0, text };
  } catch {
    return { ok: false, text: '' };
  } finally {
    clearTimeout(timeout);
  }
}
