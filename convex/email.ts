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
import { v, ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import { currentAccess } from './access';
import { requireAdmin } from './access';

const FROM = process.env.RESEND_FROM || 'PulseOdds <notifications@pulseodds.ewinproject.org>';

export const recoveryAvailability = query({ args: {}, handler: async () => ({ available: !!process.env.RESEND_API_KEY && !!process.env.RESEND_FROM }) });

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

async function hashCode(code: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Request a reset code (emails it when Resend is configured). */
export const preparePasswordReset = internalMutation({
  args: { email: v.string(), codeHash: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db.query('userProfiles').withIndex('by_email', (q) => q.eq('email', args.email)).first();
    if (!profile) return false;
    const old = await ctx.db.query('emailTokens').withIndex('by_email', (q) => q.eq('email', args.email)).collect();
    for (const token of old) await ctx.db.delete(token._id);
    const now = Date.now();
    await ctx.db.insert('emailTokens', { email: args.email, codeHash: args.codeHash, expiresAt: now + 30 * 60_000, createdAt: now });
    return true;
  }
});

export const requestPasswordReset = action({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const allowed = await ctx.runMutation(internal.rateLimit.enforceRateLimitViaMutation, {
      name: 'passwordResetRequest', key: email, rate: 3, periodMs: 30 * 60_000
    });
    if (!allowed || !process.env.RESEND_API_KEY) return { ok: true };
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const code = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const exists = await ctx.runMutation(internal.email.preparePasswordReset, { email, codeHash: await hashCode(code) });
    if (!exists) return { ok: true };
    await sendEmail({
      to: email,
      subject: 'PulseOdds password reset code',
      text: `Your PulseOdds password reset code is ${code}. It expires in 30 minutes. If you did not request this, ignore this email.`
    });
    return { ok: true };
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

/** Resolve case-sensitive legacy Password account IDs from the verified profile owner. */
export const passwordAccountId = internalQuery({ args: { email: v.string() }, handler: async(ctx,args) => {
  const exact=await ctx.db.query('authAccounts').withIndex('providerAndAccountId',q=>q.eq('provider','password').eq('providerAccountId',args.email)).first();
  if(exact)return exact.providerAccountId;
  const profile=await ctx.db.query('userProfiles').withIndex('by_email',q=>q.eq('email',args.email)).first();
  const userId=profile?.userId?.split('|')[0];if(!userId)return null;
  try{const account=await ctx.db.query('authAccounts').withIndex('userIdAndProvider',q=>q.eq('userId',userId as any).eq('provider','password')).first();return account?.providerAccountId??null;}catch{return null;}
}});

/** Internal: consume all reset tokens for an email (single use). */
export const consumeResetTokens = internalMutation({
  args: { email: v.string(), codeHash: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('emailTokens')
      .withIndex('by_email', (q) => q.eq('email', args.email))
      .collect();
    if (!rows.some((row) => row.codeHash === args.codeHash && row.expiresAt > Date.now())) return false;
    for (const r of rows) await ctx.db.delete(r._id);
    return true;
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
    if (args.newPassword.length < 8 || args.newPassword.length > 256) throw new ConvexError('New password must be between 8 and 256 characters.');
    const allowed = await ctx.runMutation(internal.rateLimit.enforceRateLimitViaMutation, {
      name: 'passwordResetVerify', key: email, rate: 5, periodMs: 30 * 60_000
    });
    if (!allowed) throw new ConvexError('Too many reset attempts. Please try again later.');

    const valid = await ctx.runMutation(internal.email.consumeResetTokens, {
      email,
      codeHash: await hashCode(args.code.trim())
    });
    if (!valid) throw new ConvexError('Invalid or expired reset code.');

    const { modifyAccountCredentials, retrieveAccount, invalidateSessions } = await import('@convex-dev/auth/server');
    const accountId: string | null = await ctx.runQuery(internal.email.passwordAccountId,{email});
    if(!accountId)throw new ConvexError('Account recovery could not be completed. Request a new code or contact support.');
    const account = await retrieveAccount(ctx, { provider: 'password', account: { id: accountId } });
    await modifyAccountCredentials(ctx, {
      provider: 'password',
      account: { id: accountId, secret: args.newPassword }
    });

    if (account) await invalidateSessions(ctx, { userId: account.user._id });
    return { ok: true };
  }
});

/** Sweep expired email tokens (hygiene cron). */
export const sweepExpiredTokens = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const stale = await ctx.db.query('emailTokens').withIndex('by_expiry', (q) => q.lt('expiresAt', now)).take(200);
    for (const row of stale) await ctx.db.delete(row._id);
    return { swept: stale.length };
  }
});

/** Recent emails (audit-only, from auditEvents; helper for ops). */
export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const rows = await ctx.db.query('emailTokens').withIndex('by_expiry', (q) => q.gt('expiresAt', now)).take(1001);
    return { count: Math.min(rows.length,1000), truncated: rows.length > 1000 };
  }
});
