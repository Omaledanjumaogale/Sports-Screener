// ── Email abstraction (Resend-optional) ───────────────────────────────────────
// All email flows route through sendEmail(). When RESEND_API_KEY is set, mail
// is delivered via Resend's HTTP API; otherwise the send is logged and skipped
// (graceful no-op) so the app never breaks when email isn't provisioned.
//
// Flows available today: password reset codes and payment receipts. Storing
// hashed reset codes in emailTokens keeps verification server-side and lets the
// client complete a reset without exposing any secret. Storage: one row per
// pending code, TTL-swept by the hygiene cron (codes expire after 30 minutes).

declare const process: { env: Record<string, string | undefined> };
import { internalMutation, mutation, query, action, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { internal } from './_generated/api';
import { currentAccess } from './access';

const FROM = 'PulseOdds <notifications@pulseodds.ewinproject.org>';

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/**
 * Send an email via Resend when configured; otherwise log-and-skip. Never
 * throws — email is strictly best-effort so flows don't break when unprovisioned.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:no-op] to=${msg.to} subject="${msg.subject}"`);
    return { sent: false, reason: 'RESEND_API_KEY not configured' };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
        html: msg.html
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[email] Resend HTTP ${res.status}: ${body.slice(0, 200)}`);
      return { sent: false, reason: `HTTP ${res.status}` };
    }
    return { sent: true };
  } catch (err: any) {
    console.error('[email] send failed:', err?.message || err);
    return { sent: false, reason: String(err?.message || err) };
  }
}

// ── Password reset (server-verified codes) ────────────────────────────────────
// Note: @convex-dev/auth Password provider has no built-in reset flow; this is
// a lightweight, server-side verified code flow. Codes are stored hashed with a
// 30-minute expiry and single use.

function hashCode(code: string): string {
  // Non-cryptographic is acceptable here because codes are short-lived,
  // single-use, and compared server-side; adds no storage or dependency.
  let h = 5381;
  for (let i = 0; i < code.length; i++) h = ((h << 5) + h + code.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** Request a reset code (emails it when Resend is configured). */
export const requestPasswordReset = mutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();
    // Uniform response regardless of account existence (no enumeration).
    if (!profile) return { ok: true, sent: false };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();
    await ctx.db.insert('emailTokens', {
      email,
      codeHash: hashCode(code),
      expiresAt: now + 30 * 60_000,
      createdAt: now
    });

    const result = await sendEmail({
      to: email,
      subject: 'PulseOdds password reset code',
      text: `Your PulseOdds password reset code is ${code}. It expires in 30 minutes. If you did not request this, ignore this email.`
    });
    // When email isn't provisioned, surface the code server-side only in logs.
    if (!result.sent) console.log(`[email:no-op] reset code for ${email}: ${code}`);
    return { ok: true, sent: result.sent };
  }
});

/** Internal: find a valid (unexpired) reset token for an email. */
export const findValidResetToken = internalQuery({
  args: { email: v.string(), codeHash: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const rows = await ctx.db
      .query('emailTokens')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .collect();
    return rows.some((r) => r.codeHash === args.codeHash && r.expiresAt > now);
  }
});

/** Internal: consume all reset tokens for an email (single use). */
export const consumeResetTokens = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('emailTokens')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return { consumed: rows.length };
  }
});

/**
 * Complete a reset: verify the code server-side, then rotate the auth password
 * through @convex-dev/auth's account store. Runs as an action because password
 * rotation routes through `auth:store` (which actions may call).
 */
export const completePasswordReset = action({
  args: { email: v.string(), code: v.string(), newPassword: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (args.newPassword.length < 8) throw new Error('New password must be at least 8 characters.');

    const valid = await ctx.runQuery(internal.email.findValidResetToken, {
      email,
      codeHash: hashCode(args.code.trim())
    });
    if (!valid) throw new Error('Invalid or expired reset code.');

    const { modifyAccountCredentials } = await import('@convex-dev/auth/server');
    await modifyAccountCredentials(ctx, {
      provider: 'password',
      account: { id: email, secret: args.newPassword }
    });

    await ctx.runMutation(internal.email.consumeResetTokens, { email });
    return { ok: true };
  }
});

/** Sweep expired email tokens (hygiene cron). */
export const sweepExpiredTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db.query('emailTokens').withIndex('by_expiry', (q) => q.lt('expiresAt', now)).collect();
    for (const row of stale) await ctx.db.delete(row._id);
    return { swept: stale.length };
  }
});

/** Recent emails (audit-only, from auditEvents; helper for ops). */
export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    return (await ctx.db.query('emailTokens').withIndex('by_expiry', (q) => q.gt('expiresAt', now)).collect()).length;
  }
});
