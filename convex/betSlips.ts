// ── Bet slip persistence (multi-slip) ────────────────────────────────────────
// Users create NAMED bet slips — each slip is an independent row with its own
// title, stake, items, and post-match grading. Creating a new slip never
// touches another. The score sync grades finished items server-side using the
// same selection-grading engine as the verdict P&L (convex/predictorGrading.ts).

import { internalMutation, mutation, query } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { gradeSelection } from './predictorGrading';
import { authenticatedRecordOwner, ownsRecord } from './recordOwnership';
import { internal } from './_generated/api';

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

async function resolveOwner(
  ctx: any
): Promise<{ owner: string; userName: string | undefined; email: string | undefined } | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Please sign in to access your bet slips.');
  const userName = (identity.name as string) || (identity.givenName as string) || undefined;
  // Resolve the account email so the admin console can attribute a graded slip
  // record (and therefore a strike rate) to a named user.
  let email: string | undefined = (identity.email as string)?.trim().toLowerCase() || undefined;
  if (!email) {
    const userId = String(identity.subject ?? '').split('|')[0];
    const userDoc: any = userId ? await ctx.db.get(userId as any) : null;
    email = String(userDoc?.email || '').trim().toLowerCase() || undefined;
  }
  return { owner: await authenticatedRecordOwner(ctx), userName, email };
}

// ── Create a new named slip ──────────────────────────────────────────────────
export const createSlip = mutation({
  args: {
    sessionId: v.string(),
    title: v.string(),
    stake: v.optional(v.number()),
    items: v.array(slipItem)
  },
  handler: async (ctx, args) => {
    const session = await resolveOwner(ctx);
    const owner = session?.owner ?? ('anon:' + args.sessionId);
    const userName = session?.userName ?? undefined;
    const now = Date.now();
    const title = args.title.trim() || `Bet Slip ${new Date(now).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    return await ctx.db.insert('betSlips', {
      owner,
      sessionId: args.sessionId,
      userId: session?.owner ?? undefined,
      email: session?.email,
      userName,
      title,
      stake: args.stake ?? 0,
      items: args.items,
      createdAt: now,
      updatedAt: now
    });
  }
});

// ── Update an existing slip's items/stake/title ──────────────────────────────
export const updateSlip = mutation({
  args: {
    slipId: v.id('betSlips'),
    title: v.optional(v.string()),
    stake: v.optional(v.number()),
    items: v.optional(v.array(slipItem))
  },
  handler: async (ctx, args) => {
    const session = await resolveOwner(ctx);
    const slip = await ctx.db.get(args.slipId);
    if (!slip) throw new Error('Bet slip not found.');
    const owner = session?.owner ?? null;
    if (!owner || !ownsRecord({ userId: slip.owner }, owner)) throw new ConvexError('Bet slip access denied.');
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) patch.title = args.title.trim();
    if (args.stake !== undefined) patch.stake = args.stake;
    if (args.items !== undefined) patch.items = args.items;
    await ctx.db.patch(args.slipId, patch);
    return args.slipId;
  }
});

// ── List ALL slips for the caller (newest first) ─────────────────────────────
export const listSlips = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const session = await resolveOwner(ctx);
    const owner = session?.owner ?? ('anon:' + args.sessionId);
    const subject = (await ctx.auth.getUserIdentity())!.subject;
    const rows = [];
    for (const alias of new Set([owner, subject])) {
      rows.push(...await ctx.db.query('betSlips')
        .withIndex('by_owner_updated', (q) => q.eq('owner', alias))
        .order('desc').collect());
    }
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
  }
});

// ── Get a single slip by ID ──────────────────────────────────────────────────
export const getSlipById = query({
  args: { slipId: v.id('betSlips') },
  handler: async (ctx, args) => {
    const session = await resolveOwner(ctx);
    const slip = await ctx.db.get(args.slipId);
    return session && slip && ownsRecord({ userId: slip.owner }, session.owner) ? slip : null;
  }
});

// ── Delete a specific slip by ID ─────────────────────────────────────────────
export const deleteSlip = mutation({
  args: { slipId: v.id('betSlips') },
  handler: async (ctx, args) => {
    const session = await resolveOwner(ctx);
    const slip = await ctx.db.get(args.slipId);
    if (!slip) return { deleted: false };
    const owner = session?.owner ?? null;
    if (!owner || !ownsRecord({ userId: slip.owner }, owner)) throw new ConvexError('Bet slip access denied.');
    await ctx.db.delete(args.slipId);
    return { deleted: true };
  }
});

// ── Internal: grade finished items (called by the score sync) ────────────────
// Items carry their own dayKey, so a slip that spans several days grades each
// leg from its own day's finished fixtures — no single-day assumption.
// Markets a plain full-time scoreline cannot settle (halves/quarters/periods)
// stay scored-but-ungraded rather than guessed.
export const gradeSlipItems = internalMutation({
  args: { dayKey: v.optional(v.string()), cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const page = await ctx.db.query('betSlips').paginate({ cursor: args.cursor ?? null, numItems: 100 });
    const slips = page.page;
    if (slips.length === 0) return { graded: 0, scored: 0 };

    const cache = new Map<string, { finalScore: string; homeTeam: string; awayTeam: string } | null>();
    const lookup = async (dayKey: string, matchId: string) => {
      const key = `${dayKey}|${matchId}`;
      if (cache.has(key)) return cache.get(key)!;
      const m = await ctx.db
        .query('predictorMatches')
        .withIndex('by_day_match', (q: any) => q.eq('dayKey', dayKey).eq('matchId', matchId))
        .first();
      const fin =
        m && m.status === 'finished' && m.finalScore
          ? { finalScore: String(m.finalScore), homeTeam: m.homeTeam, awayTeam: m.awayTeam }
          : null;
      cache.set(key, fin);
      return fin;
    };

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
          if (grade) {
            graded += 1;
            changed = true;
          }
        }
        items.push({
          ...item,
          finalScore: fin.finalScore,
          grade: grade ?? undefined
        });
      }
      if (changed) await ctx.db.patch(slip._id, { items, updatedAt: Date.now() });
    }
    if (!page.isDone) await ctx.scheduler.runAfter(1000, internal.betSlips.gradeSlipItems, { dayKey: args.dayKey, cursor: page.continueCursor });
    return { graded, scored, done: page.isDone };
  }
});
