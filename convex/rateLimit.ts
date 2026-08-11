// ── Native fixed-window rate limiter ─────────────────────────────────────────
// Enterprise abuse/cost protection without external components: one row per
// (name, key) per fixed window in `rateLimitBuckets`. Convex serializes writes
// to the same document, so the read-modify-write is atomic under concurrency.
//
// The pure decision function is exported for unit tests; `enforceRateLimit` is
// the mutation-side helper used by refresh / score-sync / payment endpoints.

import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx } from './_generated/server';

/** Pure decision: may `count` events in a window starting at `windowStart` accept one more? */
export function rateLimitShouldAllow(
  windowStart: number,
  count: number,
  rate: number,
  periodMs: number,
  now: number
): { allow: boolean; windowStart: number; count: number } {
  if (now - windowStart >= periodMs) {
    // Window expired — start a fresh window with this request.
    return { allow: true, windowStart: now, count: 1 };
  }
  if (count < rate) {
    return { allow: true, windowStart, count: count + 1 };
  }
  return { allow: false, windowStart, count };
}

/**
 * Enforce a fixed-window rate inside a mutation. Returns false when over the
 * limit (caller decides how to respond — friendly message or throw). The bucket
 * document is created on first use and updated atomically per window.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  name: string,
  key: string,
  rate: number,
  periodMs: number,
  now = Date.now()
): Promise<boolean> {
  const bucket = await ctx.db
    .query('rateLimitBuckets')
    .withIndex('by_name_key', (q) => q.eq('name', name).eq('key', key))
    .first();

  const start = bucket?.windowStart ?? now;
  const count = bucket?.count ?? 0;
  const decision = rateLimitShouldAllow(start, count, rate, periodMs, now);

  if (bucket) {
    await ctx.db.patch(bucket._id, { windowStart: decision.windowStart, count: decision.count });
  } else {
    await ctx.db.insert('rateLimitBuckets', {
      name,
      key,
      windowStart: decision.windowStart,
      count: decision.count
    });
  }
  return decision.allow;
}

/** Seconds until the caller may retry (for the friendly 429-style message). */
export function rateLimitRetryAfter(windowStart: number, periodMs: number, now: number): number {
  return Math.max(0, Math.ceil((windowStart + periodMs - now) / 1000));
}

/**
 * Action-side entry point: actions cannot write the DB directly, so they route
 * rate-limit checks through this internal mutation (e.g. bootstrapToday,
 * payment verification).
 */
export const enforceRateLimitViaMutation = internalMutation({
  args: { name: v.string(), key: v.string(), rate: v.number(), periodMs: v.number() },
  handler: async (ctx, args) => {
    return enforceRateLimit(ctx, args.name, args.key, args.rate, args.periodMs);
  }
});
