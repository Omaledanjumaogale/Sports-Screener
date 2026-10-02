import { query, mutation, internalMutation } from './_generated/server';
import { v } from 'convex/values';
import { paginationOptsValidator } from 'convex/server';
import { requireAdmin } from './access';
import { isTesterEmail } from './users';
import { logAuditEvent } from './auditLog';
import { evidenceMetrics } from './evidenceMetrics';
declare const process: { env: Record<string, string | undefined> };

export const snapshot = query({ args: {}, handler: async ctx => {
  await requireAdmin(ctx);
  const [jobs, flags, errors, evidence, payments] = await Promise.all([
    ctx.db.query('cronHealth').take(30), ctx.db.query('featureFlags').take(10),
    ctx.db.query('errorLog').withIndex('by_time').order('desc').take(25),
    ctx.db.query('predictionEvidence').withIndex('by_captured').order('desc').take(501),
    ctx.db.query('subscriptions').order('desc').take(201)
  ]);
  return { generatedAt: Date.now(), jobs, flags, errors: errors.map(e => ({ source: e.source, message: e.message, createdAt: e.createdAt })),
    evidence: { sample: Math.min(evidence.length, 500), truncated: evidence.length > 500, latest: evidence[0]?.capturedAt ?? null, metrics: evidenceMetrics(evidence.slice(0,500)) },
    payments: { sample: Math.min(payments.length, 200), truncated: payments.length > 200, successful: payments.slice(0,200).filter(p => p.status === 'successful').length, settledNgn: payments.slice(0,200).filter(p => p.status === 'successful').reduce((sum,p) => sum+p.amount,0) },
    services: { recoveryConfigured: !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM, paymentsConfigured: !!process.env.FLW_SECRET_KEY && !!process.env.FLW_SECRET_HASH, legacyWebhook: process.env.FLW_ALLOW_LEGACY_WEBHOOK === 'true', pushAvailable: false }
  };
}});

/** Cursor-based operational account inventory; no whole-table enumeration. */
export const accounts = query({ args: { paginationOpts: paginationOptsValidator }, handler: async(ctx,args) => {
  await requireAdmin(ctx);
  return ctx.db.query('userProfiles').order('desc').paginate({ ...args.paginationOpts, numItems: Math.min(args.paginationOpts.numItems,100) });
}});

/** One bounded, audited page. Dry run is the default; anonymous/shared rows are skipped. */
export const migrateOwnership = mutation({
  args: { table: v.union(v.literal('drafts'),v.literal('savedScreeners'),v.literal('betSlips')), cursor: v.optional(v.string()), apply: v.optional(v.boolean()) },
  handler: async(ctx,args) => {
    const admin = await requireAdmin(ctx);
    const page = await ctx.db.query(args.table).paginate({ cursor: args.cursor ?? null, numItems: 100 });
    let eligible=0, skipped=0;
    for(const row of page.page) {
      const owner = ('owner' in row ? row.owner : row.userId) ?? '';
      if (!owner.includes('|')) { skipped++; continue; }
      const account = owner.split('|')[0];
      let user: any; try { user = await ctx.db.get(account as any); } catch { skipped++; continue; }
      if (!user?.email || isTesterEmail(user.email)) { skipped++; continue; }
      eligible++;
      if(args.apply) await ctx.db.patch(row._id, { userId: account, ...('owner' in row ? { owner: account } : {}) });
    }
    await logAuditEvent(ctx,admin.email,args.apply?'ownership.migrated':'ownership.preview',args.table,{ scanned:page.page.length,eligible,skipped });
    return { scanned: page.page.length, eligible, skipped, applied: !!args.apply, cursor: page.continueCursor, done: page.isDone };
  }
});

export const minimizeTesterData = internalMutation({ args: { cursor: v.optional(v.string()), apply: v.optional(v.boolean()) }, handler: async(ctx,args) => {
  const page=await ctx.db.query('testerCodes').paginate({cursor:args.cursor??null,numItems:100});
  const candidates=page.page.filter(row=>row.nin || row.preferredPasswordHash || row.hasPreferredPassword);
  if(args.apply) for(const row of candidates) await ctx.db.patch(row._id,{nin:undefined,preferredPasswordHash:undefined,hasPreferredPassword:undefined});
  await logAuditEvent(ctx,'release-operator',args.apply?'tester.pii.minimized':'tester.pii.preview','testerCodes',{scanned:page.page.length,candidates:candidates.length});
  return {scanned:page.page.length,candidates:candidates.length,applied:!!args.apply,cursor:page.continueCursor,done:page.isDone};
}});
