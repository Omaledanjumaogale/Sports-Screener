// ── Per-identity usage tracking ───────────────────────────────────────────────
// The admin console needs three things the old presence heartbeat could not give
// it: HOW LONG each person actually had the app open, WHEN they were last here,
// and which tester code / subscriber account the activity belongs to.
//
// One flat `usage` row per identity:
//   • owner    — the JWT subject (`userId|sessionId`) for signed-in callers, or
//                `anon:<sessionId>` for visitors
//   • email    — the resolved account email (absent for anonymous visitors)
//   • code     — the tester access code, when the caller sits behind one
//   • usageMs  — accumulated FOREGROUND time
//
// Idle gaps are never counted: a delta longer than MAX_BEAT_GAP_MS means the tab
// was closed or asleep, so it is dropped and treated as a new session instead.
// That keeps "time spent" honest even if a laptop is left open overnight.

import { mutation, internalMutation, query } from './_generated/server';
import { internal } from './_generated/api';
import { v } from 'convex/values';
import { identityDetails, isSuperAdminEmail, isTesterEmail } from './users';

/** A caller counts as ONLINE while a heartbeat is younger than this window. */
export const PRESENCE_WINDOW_MS = 90_000;

/** Longest gap that still counts as continuous foreground time (5 minutes). */
export const MAX_BEAT_GAP_MS = 5 * 60_000;

type UsageRole = 'admin' | 'tester' | 'user' | 'anon';

/**
 * Record one heartbeat. Called every ~60s by the app shell while a session is
 * open, and once immediately after a successful login so the console lights the
 * user up without waiting for the first interval.
 */
export const beat = mutation({
  args: {
    /** Anonymous session id — ignored once the caller has a JWT subject. */
    sessionId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const details = identity ? await identityDetails(ctx, identity) : null;
    const subject = details?.subject ?? '';
    const anonId = String(args.sessionId || '').trim();
    const owner = subject || (anonId ? `anon:${anonId}` : '');
    if (!owner) return { ok: false as const };

    const email = details?.email?.trim().toLowerCase() || undefined;
    let role: UsageRole = 'anon';
    if (email) role = isSuperAdminEmail(email) ? 'admin' : isTesterEmail(email) ? 'tester' : 'user';

    // Which tester code (if any) sits behind this identity.
    let code: string | undefined;
    if (subject) {
      const testerSession = await ctx.db
        .query('testerSessions')
        .withIndex('by_subject', (q) => q.eq('subject', subject))
        .first();
      code = testerSession?.code;
    }

    const now = Date.now();
    const existing = await ctx.db
      .query('usage')
      .withIndex('by_owner', (q) => q.eq('owner', owner))
      .first();

    if (!existing) {
      await ctx.db.insert('usage', {
        owner,
        email,
        code,
        role,
        firstSeenAt: now,
        lastSeenAt: now,
        usageMs: 0,
        sessions: 1
      });
      if (code) await bumpCodeUsage(ctx, code, 0);
      return { ok: true as const, usageMs: 0, sessionStart: true };
    }

    const gap = now - existing.lastSeenAt;
    const continuous = gap > 0 && gap <= MAX_BEAT_GAP_MS;
    const added = continuous ? gap : 0;
    const usageMs = (existing.usageMs ?? 0) + added;

    await ctx.db.patch(existing._id, {
      email: email ?? existing.email,
      code: code ?? existing.code,
      role,
      lastSeenAt: now,
      usageMs,
      sessions: existing.sessions + (continuous ? 0 : 1)
    });
    if (code) await bumpCodeUsage(ctx, code, added);

    return { ok: true as const, usageMs, sessionStart: !continuous };
  }
});

/** Mirror the accumulated time onto the tester access code (admin-friendly). */
async function bumpCodeUsage(ctx: any, code: string, added: number): Promise<void> {
  const row = await ctx.db
    .query('testerCodes')
    .withIndex('by_code', (q: any) => q.eq('code', code))
    .first();
  if (row) await ctx.db.patch(row._id, { usageMs: (row.usageMs ?? 0) + added });
}

/** Public online count (the live chip in the app header). */
export const online = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query('usage')
      .withIndex('by_lastSeen', (q) => q.gt('lastSeenAt', Date.now() - PRESENCE_WINDOW_MS))
      .collect();
    return { online: rows.length };
  }
});

/** Cron helper: drop anonymous usage rows that have gone cold. */
export const sweepStale = internalMutation({
  args: { maxAgeMs: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.maxAgeMs ?? 90 * 24 * 60 * 60 * 1000);
    const stale = await ctx.db
      .query('usage')
      .withIndex('by_lastSeen', (q) => q.lt('lastSeenAt', cutoff))
      .take(500);
    let removed = 0;
    for (const row of stale) {
      // Signed-in activity is retained for the admin console; only anonymous
      // rows are swept, so per-user history survives.
      if (!row.email) {
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    if (removed) {
      await ctx.runMutation(internal.cronHealth.stampCron, {
        job: 'usage',
        ok: true,
        note: `swept:${removed}`
      });
    }
    return { swept: removed };
  }
});
