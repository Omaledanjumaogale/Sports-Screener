// Reader chain — reads a URL through whichever text-extraction transport is
// available, in priority order: Jina Reader → Firecrawl → Bright Data.
// Returns the first non-trivial readable text plus the engine that produced it.
// Never throws: every leg degrades to the next and finally to { ok:false }.

import { jinaRead } from './jinaReader';
import { firecrawlRead } from './firecrawl';
import { brightDataRead } from './brightdata';

export interface PageReadResult {
  ok: boolean;
  status: number;
  text: string;
  engine: 'direct' | 'jina' | 'firecrawl' | 'brightdata' | 'none';
}

const MIN_TEXT = 60;

// Free direct fetch — tried FIRST so we don't burn paid reader credits when the
// site serves plain HTML to a browser-like request (BetExplorer, SoccerVista,
// 24live, etc.). Only falls through to the paid readers when it fails, returns
// too little text, or serves an obvious bot-challenge/JS-gate page.
const CHALLENGE_PATTERNS =
  /captcha|cf-challenge|challenge-platform|just a moment|checking your browser|enable javascript|please enable javascript|access denied|request blocked|cloudflare|incapsula|perimeterx/i;

export async function directRead(url: string, opts: { timeoutMs?: number } = {}): Promise<PageReadResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    const text = await res.text().catch(() => '');
    // A 200 challenge/JS-only page must NOT short-circuit the paid readers —
    // that is exactly the case they exist for. Treat it as a failed leg so
    // readAny continues to Jina → Firecrawl → Bright Data.
    if (res.ok && text.length > 0 && CHALLENGE_PATTERNS.test(text.slice(0, 8000))) {
      return { ok: false, status: res.status, text: '', engine: 'direct' };
    }
    return { ok: res.ok && text.length > 0, status: res.status, text, engine: 'direct' };
  } catch {
    return { ok: false, status: 0, text: '', engine: 'direct' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function readAny(url: string, opts: { timeoutMs?: number } = {}): Promise<PageReadResult> {
  const timeoutMs = opts.timeoutMs ?? 20_000;

  const direct = await directRead(url, { timeoutMs });
  if (direct.ok && direct.text && direct.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: direct.status, text: direct.text, engine: 'direct' };
  }

  const jina = await jinaRead(url, { timeoutMs });
  if (jina.ok && jina.text && jina.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: jina.status, text: jina.text, engine: 'jina' };
  }

  const firecrawl = await firecrawlRead(url, timeoutMs);
  if (firecrawl.ok && firecrawl.text && firecrawl.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: firecrawl.status, text: firecrawl.text, engine: 'firecrawl' };
  }

  const bd = await brightDataRead(url, timeoutMs);
  if (bd.ok && bd.text && bd.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: 200, text: bd.text, engine: 'brightdata' };
  }

  return { ok: false, status: 0, text: '', engine: 'none' };
}

export function squash(text: string, max = 4000): string {
  return text.replace(/\s+/g, ' ').slice(0, max);
}