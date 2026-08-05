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
  engine: 'jina' | 'firecrawl' | 'brightdata' | 'none';
}

const MIN_TEXT = 60;

export async function readAny(url: string, opts: { timeoutMs?: number } = {}): Promise<PageReadResult> {
  const timeoutMs = opts.timeoutMs ?? 20_000;

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