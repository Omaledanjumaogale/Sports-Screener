// ── Native action-result cache ───────────────────────────────────────────────
// Caches expensive deterministic action outputs (LLM verdict generation) keyed
// by a stable hash of the function name + serialized args, with a TTL so stale
// analysis expires and re-runs pick up fresh scores/odds.

import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';

// Pure JS FNV-1a 64-bit hash — deterministic across every runtime (no Node-only
// crypto import), so actionCacheKey works identically in actions and tests.
function fnv1a(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c << 1), 0x85ebca6b) >>> 0;
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}

/** Stable cache key from a function name + args object (args order-insensitive). */
export function actionCacheKey(name: string, args: Record<string, unknown>): string {
  const stable = JSON.stringify(args ?? {}, Object.keys(args ?? {}).sort());
  return fnv1a(`${name}:${stable}`);
}

export async function readCachedAction(ctx: QueryCtx, cacheKey: string): Promise<unknown | null> {
  const row = await ctx.db
    .query('actionCache')
    .withIndex('by_cacheKey', (q) => q.eq('cacheKey', cacheKey))
    .first();
  if (!row) return null;
  if (row.expiresAt <= Date.now()) return null;
  return row.result;
}

export async function writeCachedAction(
  ctx: MutationCtx,
  cacheKey: string,
  result: unknown,
  ttlMs: number
): Promise<void> {
  const row = await ctx.db
    .query('actionCache')
    .withIndex('by_cacheKey', (q) => q.eq('cacheKey', cacheKey))
    .first();
  const expiresAt = Date.now() + ttlMs;
  if (row) {
    await ctx.db.patch(row._id, { result, expiresAt });
  } else {
    await ctx.db.insert('actionCache', { cacheKey, result, expiresAt });
  }
}

// Action-side entry points (actions read/write the cache through these).
export const getCachedActionValue = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => readCachedAction(ctx, args.cacheKey)
});

export const setCachedActionValue = internalMutation({
  args: { cacheKey: v.string(), result: v.any(), ttlMs: v.number() },
  handler: async (ctx, args) => {
    await writeCachedAction(ctx, args.cacheKey, args.result, args.ttlMs);
  }
});
