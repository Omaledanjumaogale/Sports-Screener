// ── Bet slip persistence ──────────────────────────────────────────────────────
// Accumulative bet slips built from market options across fixtures/sports.
// One slip per owner (upsert pattern — the slip IS the user's current selection).
// Items are graded server-side when matches finish (the score sync fills
// finalScore + grade on each item whose matchId appears in finished matches).

import { internalMutation, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { gradeSelection } from './predictorGrading';

const slipItem = v.object({
  sportId: v.string(),
  dayKey: v.string(),
  matchId: v.string(),
  homeTeam: v.string(),
  awayTeam: v.string(),
  league: v.string(),
  marketTitle: v.string(),
  selection: v.string(),
  odds: v.number(),
  publishedPct: v.number(),
  kickoff: v.number(),
  finalScore: v.optional(v.string()),
  grade: v.optional(v.union(v.literal('win'), v.literal('loss'), v.literal('push'), v.literal('void')))
});

async function resolveOwner(ctx: any): Promise<string | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (identity) return identity.subject;
  return null;
}

// Upsert the caller's slip with the given items. Authenticated: userId when
// signed in, else sessionId for anonymous users.
export const saveSlip = mutation({
  args: {
    sessionId: v.string(),
    items: v.array(slipItem)
  },
  handler: async (ctx, args) => {
    const userId = await resolveOwner(ctx);
    const owner = userId ?? ('anon:' + args.sessionId);
    const now = Date.now();
    const existing = await findOpenSlip(ctx, owner);
    if (existing) {
      await ctx.db.patch(existing._id, { items: args.items, updatedAt: now });
      return existing._id;
    }
    return await ctx.db.insert('betSlips', {
      owner,
      sessionId: args.sessionId,
      userId: userId ?? undefined,
      items: args.items,
      status: 'open',
      createdAt: now,
      updatedAt: now
    });
  }
});

// The OPEN slip is the single mutable row per owner (the items the user is
// currently building). Archived rows are the sealed history.
async function findOpenSlip(ctx: any, owner: string) {
  return await ctx.db
    .query('betSlips')
    .withIndex('by_owner', (q: any) => q.eq('owner', owner))
    .filter((r: any) => r.status === undefined || r.status === 'open')
    .first();
}

// List the caller's OPEN slip (legacy single-slip shape kept for compatibility).
export const getSlip = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const owner = (await resolveOwner(ctx)) ?? 'anon:' + args.sessionId;
    return await findOpenSlip(ctx, owner);
  }
});

// Open slip + sealed history in one round-trip for the /betslip page.
export const listSlips = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const owner = (await resolveOwner(ctx)) ?? 'anon:' + args.sessionId;
    const rows = await ctx.db
      .query('betSlips')
      .withIndex('by_owner', (q) => q.eq('owner', owner))
      .collect();
    const open = rows.find((r) => r.status === undefined || r.status === 'open') ?? null;
    const archived = rows
      .filter((r) => r.status === 'archived')
      .sort((a, b) => (b.sealedAt ?? b.updatedAt) - (a.sealedAt ?? a.updatedAt))
      .map((r) => ({
        id: String(r._id),
        label: r.label ?? new Date(r.sealedAt ?? r.updatedAt).toLocaleDateString('en-GB'),
        sealedAt: r.sealedAt ?? r.updatedAt,
        items: r.items
      }));
    return { open, archived };
  }
});

// Seal the open slip into the history; the next add starts a fresh open slip.
export const archiveSlip = mutation({
  args: { sessionId: v.string(), label: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const owner = (await resolveOwner(ctx)) ?? 'anon:' + args.sessionId;
    const open = await findOpenSlip(ctx, owner);
    if (!open) return { archived: false };
    await ctx.db.patch(open._id, {
      status: 'archived',
      label: args.label?.trim() || new Date().toLocaleDateString('en-GB'),
      sealedAt: Date.now(),
      updatedAt: Date.now()
    });
    return { archived: true };
  }
});

// Delete one archived slip by id (owner-checked).
export const deleteSlipById = mutation({
  args: { sessionId: v.string(), id: v.string() },
  handler: async (ctx, args) => {
    const owner = (await resolveOwner(ctx)) ?? 'anon:' + args.sessionId;
    // db.get is typed across all tables, so narrow before touching fields.
    const row: any = await ctx.db.get(args.id as any);
    if (!row || row.owner !== owner) return { deleted: false };
    await ctx.db.delete(row._id);
    return { deleted: true };
  }
});

// Delete the caller's OPEN slip (and any sealed history when full=true).
export const deleteSlip = mutation({
  args: { sessionId: v.string(), full: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const owner = (await resolveOwner(ctx)) ?? 'anon:' + args.sessionId;
    const rows = await ctx.db
      .query('betSlips')
      .withIndex('by_owner', (q) => q.eq('owner', owner))
      .collect();
    let deleted = 0;
    for (const row of rows) {
      const isOpen = row.status === undefined || row.status === 'open';
      if (!isOpen && !args.full) continue;
      await ctx.db.delete(row._id);
      deleted += 1;
    }
    return { deleted };
  }
});

// Internal: called by the score sync after every finished-match sweep. Grades
// each slip item against the real final scoreline using the SAME grader as the
// verdict P&L and the accuracy data bank (convex/predictorGrading.ts), so a slip
// "win" can never disagree with the stored prediction record.
//
// Items carry their own dayKey, so a slip that spans several days grades each
// leg from its own day's finished fixtures — no single-day assumption.
// A final score is stamped as soon as the fixture finishes (so a collapsed
// finished slip always shows its scoreline); the win/loss grade is only set for
// markets the grader can classify from a plain game scoreline.
export const gradeSlipItems = internalMutation({
  args: { dayKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const slips = await ctx.db.query('betSlips').collect();
    if (slips.length === 0) return { graded: 0, scored: 0 };

    const cache = new Map<string, { finalScore: string; homeTeam: string; awayTeam: string } | null>();
    const lookup = async (dayKey: string, matchId: string) => {
      const key = `${dayKey}|${matchId}`;
      if (cache.has(key)) return cache.get(key)!;
      const m = await ctx.db
        .query('predictorMatches')
        .withIndex('by_day_match', (q) => q.eq('dayKey', dayKey).eq('matchId', matchId))
        .first();
      const fin =
        m && m.status === 'finished' && m.finalScore
          ? { finalScore: String(m.finalScore), homeTeam: m.homeTeam, awayTeam: m.awayTeam }
          : null;
      cache.set(key, fin);
      return fin;
    };

    // Markets that a plain full-time scoreline cannot settle (halves / quarters /
    // periods / innings) stay scored-but-ungraded rather than guessed.
    const ungradeable = (marketTitle: string) =>
      /\bhalf\b|\b1h\b|\b2h\b|\bquarter\b|\bperiod\b|\binnings?\b/i.test(marketTitle);

    let graded = 0;
    let scored = 0;
    for (const slip of slips) {
      let changed = false;
      const items = [];
      for (const item of slip.items) {
        if (args.dayKey && item.dayKey !== args.dayKey) {
          items.push(item);
          continue;
        }
        const fin = await lookup(item.dayKey, item.matchId);
        if (!fin) {
          items.push(item);
          continue;
        }
        if (!item.finalScore) {
          changed = true;
          scored += 1;
        }
        let grade = item.grade ?? null;
        if (!grade && !ungradeable(item.marketTitle)) {
          grade = gradeSelection(item.selection, item.marketTitle, fin.finalScore, {
            homeTeam: fin.homeTeam,
            awayTeam: fin.awayTeam
          });
          if (grade) graded += 1;
        }
        items.push({
          ...item,
          finalScore: fin.finalScore,
          grade: grade ?? undefined
        });
      }
      if (changed) await ctx.db.patch(slip._id, { items, updatedAt: Date.now() });
    }
    return { graded, scored };
  }
});
