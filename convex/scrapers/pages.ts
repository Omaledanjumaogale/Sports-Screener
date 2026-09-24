// Reader chain — reads a URL through whichever text-extraction transport is
// available, in cost priority order: self-scrape (free) → keyless relays
// (free) → keyed premium transports (Jina / ScrapeGraphAI / Firecrawl /
// Bright Data / OpenCrab). Returns the first non-trivial readable text plus
// the engine that produced it. Never throws: every leg degrades to the next
// and finally to { ok:false }.

import { selfScrape } from './selfScrape';
import { freeRelayRead } from './freeRelay';
import { jinaRead } from './jinaReader';
import { scrapegraphRead } from './scrapegraph';
import { firecrawlRead } from './firecrawl';
import { brightDataRead } from './brightdata';
import { opencrabRead } from './opencrab';

export interface PageReadResult {
  ok: boolean;
  status: number;
  text: string;
  engine:
    | 'direct'
    | 'relay'
    | 'jina'
    | 'scrapegraph'
    | 'firecrawl'
    | 'brightdata'
    | 'opencrab'
    | 'none';
}

const MIN_TEXT = 60;

export async function directRead(url: string, opts: { timeoutMs?: number } = {}): Promise<PageReadResult> {
  // Self-hosted engine: full browser fingerprint + UA rotation (free). Sites
  // like BetExplorer 404 bare server fetches but serve a real page to a
  // Chrome-grade request.
  const r = await selfScrape(url, { timeoutMs: opts.timeoutMs ?? 20_000 });
  return { ok: r.ok && r.text.trim().length >= MIN_TEXT, status: r.status, text: r.text, engine: 'direct' };
}

// Keyless relay tier (AllOrigins → Codetabs → keyless r.jina.ai) — beats
// datacenter-IP bans without burning any credits.
export async function relayRead(url: string, opts: { timeoutMs?: number } = {}): Promise<PageReadResult> {
  const r = await freeRelayRead(url, { timeoutMs: opts.timeoutMs ?? 25_000 });
  return { ok: r.ok && r.text.trim().length >= MIN_TEXT, status: r.status, text: r.text, engine: 'relay' };
}

export async function readAny(url: string, opts: { timeoutMs?: number } = {}): Promise<PageReadResult> {
  const timeoutMs = opts.timeoutMs ?? 20_000;

  // 1. FREE — self-hosted browser-grade fetch with UA rotation.
  const direct = await directRead(url, { timeoutMs });
  if (direct.ok) return direct;

  // 2. FREE — keyless public relays (different egress IPs).
  const relay = await relayRead(url, { timeoutMs });
  if (relay.ok) return relay;

  // 3. KEYED — Jina Reader (keyless requests already tried above; the keyed
  //    path unlocks higher RPM + selectors when credits exist).
  const jina = await jinaRead(url, { timeoutMs });
  if (jina.ok && jina.text && jina.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: jina.status, text: jina.text, engine: 'jina' };
  }

  // 4. KEYED — ScrapeGraphAI v2 stealth scrape (residential proxies; the best
  //    option against hard bot walls when the free tier is provisioned).
  const sg = await scrapegraphRead(url, { timeoutMs });
  if (sg.ok && sg.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: sg.status, text: sg.text, engine: 'scrapegraph' };
  }

  // 5-6. KEYED — Firecrawl / Bright Data (resume automatically when credits
  //      return; no code change needed).
  const firecrawl = await firecrawlRead(url, timeoutMs);
  if (firecrawl.ok && firecrawl.text && firecrawl.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: firecrawl.status, text: firecrawl.text, engine: 'firecrawl' };
  }

  const bd = await brightDataRead(url, timeoutMs);
  if (bd.ok && bd.text && bd.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: 200, text: bd.text, engine: 'brightdata' };
  }

  // 7. KEYED — OpenCrab (joins the chain automatically when the platform
  //    ships and OPENCRAB_API_KEY is provisioned).
  const oc = await opencrabRead(url, { timeoutMs });
  if (oc.ok && oc.text.trim().length >= MIN_TEXT) {
    return { ok: true, status: oc.status, text: oc.text, engine: 'opencrab' };
  }

  return { ok: false, status: 0, text: '', engine: 'none' };
}

export function squash(text: string, max = 4000): string {
  return text.replace(/\s+/g, ' ').slice(0, max);
}
