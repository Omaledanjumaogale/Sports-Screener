// ── Enterprise audit trail ───────────────────────────────────────────────────
// Append-only auditEvents rows recording security- and money-adjacent actions
// (sign-ins, predictor refresh runs, score syncs, payment verifications).
// `logAuditEvent` is the shared helper used inside other mutations; the public
// mutation is available for explicit client-side triggers.

import { internalMutation } from './_generated/server';
import { v } from 'convex/values';
import type { MutationCtx } from './_generated/server';

export async function logAuditEvent(
  ctx: MutationCtx,
  actor: string,
  action: string,
  subject: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await ctx.db.insert('auditEvents', {
    actor: String(actor || 'anonymous'),
    action: String(action || 'unknown'),
    subject: String(subject || ''),
    metadata: metadata ?? {},
    createdAt: Date.now()
  });
}

export const logAudit = internalMutation({
  args: {
    actor: v.string(),
    action: v.string(),
    subject: v.string(),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    await logAuditEvent(ctx, args.actor, args.action, args.subject, args.metadata);
    return { ok: true };
  }
});
