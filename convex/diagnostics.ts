// Fixture-source diagnostics for the AI Predictor.
//
// diagnoseFixturePages() probes EVERY URL listed in FIXTURE_PAGES (the verified
// per-sport page lists in scrapers/sources.ts) through the same reader chain and
// row parsers the live pipeline uses, then reports per-page health:
//
//   verdict 'healthy'     — page fetched AND at least one fixture parsed
//   verdict 'unparseable' — page fetched but no fixtures could be parsed
//   verdict 'dead'        — every reader leg failed (blocked, 404, bot wall…)
//
// Run it from the Convex dashboard (Actions → diagnoseFixturePages) or via a
// client call to prune dead/unparseable sources and keep the fixture pipeline
// fed with real, sport-correct data. Never throws: every probe degrades to a
// row in the report.

import { action } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { readAny, type PageReadResult } from './scrapers/pages';
import { parseFixtures } from './scrapers/fixtures';
import { FIXTURE_PAGES, watTodayKey } from './scrapers/sources';

type PageVerdict = 'healthy' | 'unparseable' | 'dead';

export interface FixturePageHealth {
  sportId: string;
  url: string;
  ok: boolean;
  status: number;
  engine: PageReadResult['engine'];
  chars: number;
  matches: number;
  elapsedMs: number;
  verdict: PageVerdict;
  error?: string;
  sample?: { homeTeam: string; awayTeam: string; league: string; startTime: number };
}

// Run `fn` over `arr` with at most `limit` promises in flight.
async function mapLimit<T, R>(arr: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(arr.length);
  let idx = 0;
  const workers = new Array(Math.min(limit, arr.length)).fill(0).map(async () => {
    while (idx < arr.length) {
      const i = idx++;
      results[i] = await fn(arr[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export const diagnoseFixturePages = action({
  args: {
    sportId: v.optional(v.string()),
    dayKey: v.optional(v.string()),
    timeoutMs: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<{
    dayKey: string;
    generatedAt: number;
    error?: string;
    summary: Record<string, { total: number; healthy: number; unparseable: number; dead: number; matches: number }>;
    overall: { total: number; healthy: number; unparseable: number; dead: number; matches: number };
    pages: FixturePageHealth[];
  }> => {
    const dayKey = args.dayKey || watTodayKey();
    const timeoutMs = args.timeoutMs ?? 18_000;
    const validSportIds = Object.keys(FIXTURE_PAGES);

    if (args.sportId && !validSportIds.includes(args.sportId)) {
      return {
        dayKey,
        generatedAt: Date.now(),
        error: `Unknown sportId "${args.sportId}". Valid: ${validSportIds.join(', ')}`,
        summary: {},
        overall: { total: 0, healthy: 0, unparseable: 0, dead: 0, matches: 0 },
        pages: []
      };
    }

    const sports = args.sportId ? [args.sportId] : validSportIds;
    const jobs: { sportId: string; url: string }[] = [];
    for (const s of sports) {
      for (const url of FIXTURE_PAGES[s] ?? []) jobs.push({ sportId: s, url });
    }

    const pages: FixturePageHealth[] = [];
    await mapLimit(jobs, 4, async ({ sportId, url }) => {
      const health: FixturePageHealth = {
        sportId,
        url,
        ok: false,
        status: 0,
        engine: 'none',
        chars: 0,
        matches: 0,
        elapsedMs: 0,
        verdict: 'dead'
      };
      const started = Date.now();
      try {
        const page = await readAny(url, { timeoutMs });
        health.elapsedMs = Date.now() - started;
        health.ok = page.ok;
        health.status = page.status;
        health.engine = page.engine;
        health.chars = (page.text || '').trim().length;
        if (page.ok && page.text && page.text.trim().length > 0) {
          const parsed = parseFixtures(page.text, sportId, url, dayKey);
          health.matches = parsed.length;
          if (parsed.length > 0) {
            const first = parsed[0];
            health.sample = {
              homeTeam: first.homeTeam,
              awayTeam: first.awayTeam,
              league: first.league,
              startTime: first.startTime
            };
            health.verdict = 'healthy';
          } else {
            health.verdict = 'unparseable';
          }
        } else {
          health.verdict = 'dead';
        }
      } catch (err: any) {
        health.elapsedMs = Date.now() - started;
        health.error = String(err?.message || err).slice(0, 200);
        health.verdict = 'dead';
      }
      pages.push(health);
    });

    const summary: Record<string, { total: number; healthy: number; unparseable: number; dead: number; matches: number }> = {};
    for (const p of pages) {
      const s = (summary[p.sportId] ??= { total: 0, healthy: 0, unparseable: 0, dead: 0, matches: 0 });
      s.total += 1;
      s.matches += p.matches;
      if (p.verdict === 'healthy') s.healthy += 1;
      else if (p.verdict === 'unparseable') s.unparseable += 1;
      else s.dead += 1;
    }

    const overall = { total: pages.length, healthy: 0, unparseable: 0, dead: 0, matches: 0 };
    for (const s of Object.values(summary)) {
      overall.healthy += s.healthy;
      overall.unparseable += s.unparseable;
      overall.dead += s.dead;
      overall.matches += s.matches;
    }

    return { dayKey, generatedAt: Date.now(), summary, overall, pages };
  }
});

// ── Admin ops tool: fetch a sports source through the reader chain and return
// a text sample + parsed-fixture count. Used to write/verify parsers against
// REAL live markup. Host-allowlisted (no arbitrary SSRF) and admin-gated.
const SAMPLE_HOST_ALLOWLIST = [
  'betexplorer.com',
  'forebet.com',
  'flashscore.com',
  'livescore.com',
  'annabet.com',
  'tennisbrain.com',
  'soccer24.com',
  'soccerway.com',
  'oddsportal.com',
  'soccervista.com',
  'soccer-vista.com'
];

export const fetchSourceSample = action({
  args: {
    url: v.string(),
    sportId: v.optional(v.string()),
    maxChars: v.optional(v.number())
  },
  handler: async (ctx, args): Promise<{
    ok: boolean;
    status: number;
    engine: PageReadResult['engine'];
    chars: number;
    parsed: number;
    parsedSample?: { homeTeam: string; awayTeam: string; league: string }[];
    sample: string;
  }> => {
    // Admin gate (identity-checked server-side).
    const access = await ctx.runQuery(internal.access.forCaller, {});
    if (!access?.isAdmin) {
      throw new Error('Admin access required.');
    }

    let host = '';
    try {
      host = new URL(args.url).hostname.replace(/^www\./, '');
    } catch {
      throw new Error('Invalid URL.');
    }
    if (!SAMPLE_HOST_ALLOWLIST.some((h) => host === h || host.endsWith('.' + h))) {
      throw new Error(`Host "${host}" is not in the source allowlist.`);
    }

    const page = await readAny(args.url, { timeoutMs: 20_000 });
    const sportId = args.sportId || 'football';
    let parsed: ReturnType<typeof parseFixtures> = [];
    let parseError = '';
    try {
      parsed = parseFixtures(page.text || '', sportId, args.url);
    } catch (err: any) {
      parseError = String(err?.message || err).slice(0, 200);
    }
    const maxChars = Math.min(Math.max(args.maxChars ?? 2600, 200), 8000);
    return {
      ok: page.ok,
      status: page.status,
      engine: page.engine,
      chars: (page.text || '').length,
      parsed: parsed.length,
      parsedSample: parsed.slice(0, 8).map((m) => ({
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        league: m.league
      })),
      ...(parseError ? { parseError } : {}),
      sample: (page.text || '').slice(0, maxChars)
    };
  }
});
