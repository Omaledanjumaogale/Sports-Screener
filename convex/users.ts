import { query, mutation, action } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { api } from './_generated/api';
import { v } from 'convex/values';

declare const process: { env: Record<string, string | undefined> };

const DEFAULT_ADMIN_EMAIL = '';
const DEFAULT_TESTER_EMAIL = '';
const TESTER_TRIAL_DAYS = 30;

function superAdminEmail(): string {
  return process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || DEFAULT_ADMIN_EMAIL;
}

function testerEmail(): string {
  return process.env.TESTER_EMAIL?.trim().toLowerCase() || DEFAULT_TESTER_EMAIL;
}

function isSuperAdminEmail(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === superAdminEmail();
}

function isTesterEmail(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === testerEmail();
}

export type AccessStatus = {
  email: string;
  isAdmin: boolean;
  isTester: boolean;
  isSubscribed: boolean;
  subscriptionExpiresAt?: number;
  trialExpiresAt?: number;
  subscriptionTier?: 'punter' | 'master';
  hasMasterPass?: boolean;
};

// Resolve the identity's email/name. `@convex-dev/auth` JWTs only carry `sub`
// (`userId|sessionId`), so the email is looked up from the `users` table when it
// is not embedded in the token claims.
async function identityDetails(
  ctx: { db: QueryCtx['db'] },
  identity: { subject?: string; name?: string; email?: string } | null
): Promise<{ email: string; name?: string; subject?: string } | null> {
  if (!identity) return null;
  if (identity.email) return { email: identity.email, name: identity.name, subject: identity.subject };
  const subject = identity.subject;
  if (!subject) return null;
  const userId = subject.split('|')[0];
  const userDoc: any = userId ? await ctx.db.get(userId as any) : null;
  const email = userDoc?.email;
  if (!email) return null;
  return { email, name: identity.name ?? userDoc?.name, subject };
}

// Derive the effective access for a user. Read-only (no writes) — used by `me`
// and `checkSubscription`. Tester trial is computed from `trialStartsAt`; when a
// tester profile hasn't been persisted yet we treat the trial as live so the
// first `syncAccess` call can persist a real start timestamp.
async function deriveAccess(
  ctx: { db: QueryCtx['db'] },
  email: string,
  now = Date.now()
): Promise<AccessStatus> {
  const isAdmin = isSuperAdminEmail(email);
  const isTester = isTesterEmail(email);

  const profile = await ctx.db
    .query('userProfiles')
    .withIndex('by_email', (q) => q.eq('email', email))
    .first();

  let isSubscribed = false;
  let subscriptionExpiresAt: number | undefined = profile?.subscriptionExpiresAt;
  let trialExpiresAt: number | undefined;

  if (isAdmin) {
    isSubscribed = true;
  } else if (isTester) {
    const trialStartsAt = profile?.trialStartsAt ?? now;
    const trialExp = trialStartsAt + TESTER_TRIAL_DAYS * 24 * 60 * 60 * 1000;
    trialExpiresAt = trialExp;
    isSubscribed = now < trialExp;
  } else {
    isSubscribed =
      !!profile?.isSubscribed && (!subscriptionExpiresAt || subscriptionExpiresAt > now);
  }

  const subscriptionTier = profile?.subscriptionTier;
  // Master Pass = admins, active testers (full trial), or subscribers whose
  // recorded tier is 'master'.
  const hasMasterPass =
    isAdmin || (isTester && isSubscribed) || (isSubscribed && subscriptionTier === 'master');

  return {
    email,
    isAdmin,
    isTester,
    isSubscribed,
    subscriptionExpiresAt,
    trialExpiresAt,
    subscriptionTier,
    hasMasterPass
  };
}

// ── Identity-aware queries / mutations ───────────────────────────────────────

// Returns the signed-in user's authoritative access status. Requires a real
// Convex auth token (identity). Throws when unauthenticated.
export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const details = await identityDetails(ctx, identity);
    if (!details) throw new Error('Not signed in');
    const email = details.email.trim().toLowerCase();

    const access = await deriveAccess(ctx, email);

    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    return {
      ...access,
      profile: profile ?? null,
      name: details.name ?? email.split('@')[0]
    };
  }
});

// Persists tester/admin state server-side (writes) and returns the authoritative
// access object. Called right after login so a tester's trial is anchored to a
// real timestamp and admin status is recorded on the profile.
export const syncAccess = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    const details = await identityDetails(ctx, identity);
    if (!details) throw new Error('Not signed in');

    const email = details.email.trim().toLowerCase();
    const now = Date.now();
    const isAdmin = isSuperAdminEmail(email);
    const isTester = isTesterEmail(email);
    const subject = details.subject;
    const name = details.name ?? email.split('@')[0];

    let profile: any = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (isTester) {
      const trialStartsAt = profile?.trialStartsAt ?? now;
      const trialExpiresAt = trialStartsAt + TESTER_TRIAL_DAYS * 24 * 60 * 60 * 1000;
      const active = now < trialExpiresAt;

      if (!profile) {
        profile = {
          _id: await ctx.db.insert('userProfiles', {
            userId: subject,
            email,
            fullName: name,
            mobile: '',
            dob: '',
            stateOfResidence: '',
            consentAccepted: true,
            role: 'tester',
            isTester: true,
            trialStartsAt,
            isSubscribed: active,
            subscriptionExpiresAt: trialExpiresAt,
            createdAt: now,
            updatedAt: now
          })
        };
      } else {
        await ctx.db.patch(profile._id, {
          userId: subject,
          role: 'tester',
          isTester: true,
          trialStartsAt,
          isSubscribed: active,
          subscriptionExpiresAt: trialExpiresAt,
          updatedAt: now
        });
      }

      return {
        email,
        isAdmin: false,
        isTester: true,
        isSubscribed: active,
        subscriptionExpiresAt: trialExpiresAt,
        trialExpiresAt,
        subscriptionTier: 'master',
        hasMasterPass: active
      };
    }

    if (isAdmin) {
      if (profile) {
        await ctx.db.patch(profile._id, {
          userId: subject,
          role: 'admin',
          isSubscribed: true,
          subscriptionTier: 'master',
          updatedAt: now
        });
      }
      return { email, isAdmin: true, isTester: false, isSubscribed: true, subscriptionTier: 'master', hasMasterPass: true };
    }

    // Regular user — recompute from profile subscription.
    const active =
      !!profile?.isSubscribed && (!profile.subscriptionExpiresAt || profile.subscriptionExpiresAt > now);
    const subscriptionTier = profile?.subscriptionTier;
    return {
      email,
      isAdmin: false,
      isTester: false,
      isSubscribed: active,
      subscriptionExpiresAt: profile?.subscriptionExpiresAt,
      subscriptionTier,
      hasMasterPass: active && subscriptionTier === 'master'
    };
  }
});

export const registerProfile = mutation({
  args: {
    email: v.string(),
    fullName: v.string(),
    mobile: v.string(),
    dob: v.string(),
    stateOfResidence: v.string(),
    consentAccepted: v.boolean(),
    userId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const email = args.email.trim().toLowerCase();
    const isAdmin = isSuperAdminEmail(email);
    const isTester = isTesterEmail(email);
    const existing = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        fullName: args.fullName,
        mobile: args.mobile,
        dob: args.dob,
        stateOfResidence: args.stateOfResidence,
        consentAccepted: args.consentAccepted,
        userId: args.userId ?? existing.userId,
        role: isAdmin ? 'admin' : isTester ? 'tester' : existing.role,
        isTester: isTester || existing.isTester,
        isSubscribed: isAdmin || existing.isSubscribed,
        updatedAt: now
      });
      return existing._id;
    }

    return await ctx.db.insert('userProfiles', {
      email,
      fullName: args.fullName,
      mobile: args.mobile,
      dob: args.dob,
      stateOfResidence: args.stateOfResidence,
      consentAccepted: args.consentAccepted,
      userId: args.userId,
      role: isAdmin ? 'admin' : isTester ? 'tester' : 'user',
      isTester: isTester || undefined,
      isSubscribed: isAdmin,
      createdAt: now,
      updatedAt: now
    });
  }
});

export const getProfile = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', args.email.trim().toLowerCase()))
      .first();

    if (!profile) return null;

    const isAdmin = isSuperAdminEmail(args.email);
    return {
      ...profile,
      isSubscribed: isAdmin || profile.isSubscribed
    };
  }
});

// ── Payments ─────────────────────────────────────────────────────────────────

// Server-side verification of a Flutterwave charge before granting access.
// The client calls this instead of marking itself subscribed — a forged txRef is
// rejected because the transaction is re-verified against Flutterwave's API.
export const verifyFlutterwaveCharge = action({
  args: {
    txRef: v.string(),
    transactionId: v.optional(v.string()),
    email: v.string()
  },
  handler: async (ctx, args) => {
    const secretKey = process.env.FLW_SECRET_KEY;
    if (!secretKey) throw new Error('Payment verification is not configured (FLW_SECRET_KEY missing)');

    const verifyUrl = args.transactionId
      ? `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(args.transactionId)}/verify`
      : `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(args.txRef)}`;

    const res = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${secretKey}` }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[Flutterwave verify] HTTP', res.status, body.slice(0, 300));
      throw new Error(`Payment verification failed (${res.status})`);
    }

    const payload: any = await res.json();
    const tx = payload?.data;
    const ok =
      payload?.status === 'success' &&
      tx &&
      (tx.status === 'successful' || tx.status === 'completed') &&
      Number(tx.amount) >= 5000 &&
      String(tx.currency || '').toUpperCase() === 'NGN';

    if (!ok) {
      console.warn('[Flutterwave verify] charge not successful', JSON.stringify(tx).slice(0, 300));
      throw new Error('Payment could not be verified as successful');
    }

    const verifiedEmail = String(tx.customer?.email || '').trim().toLowerCase();
    if (verifiedEmail && verifiedEmail !== args.email.trim().toLowerCase()) {
      throw new Error('Payment email does not match your account');
    }

    const now = Date.now();
    const durationDays = 30;
    const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;
    const amount = Number(tx.amount) || 5000;
    // ₦10,000+ → Master Pass (includes the AI Predictor); otherwise Punter.
    const tier: 'punter' | 'master' = amount >= 9500 ? 'master' : 'punter';

    await ctx.runMutation(api.users.markSubscribed, {
      email: args.email.trim().toLowerCase(),
      txRef: args.txRef,
      transactionId: String(tx.id || ''),
      amount,
      durationDays,
      tier,
      webhookSecret: process.env.FLW_SECRET_HASH || ''
    });

    return { success: true, expiresAt, txRef: args.txRef, amount, tier };
  }
});

// Marks a user as subscribed. Gated on the Flutterwave webhook secret so it can
// only be triggered by the server (webhook listener or the verify action).
export const markSubscribed = mutation({
  args: {
    email: v.string(),
    txRef: v.string(),
    transactionId: v.optional(v.string()),
    amount: v.optional(v.number()),
    durationDays: v.optional(v.number()),
    tier: v.optional(v.union(v.literal('punter'), v.literal('master'))),
    webhookSecret: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const secretHash = process.env.FLW_SECRET_HASH || '';
    const authed = !!secretHash && args.webhookSecret === secretHash;
    if (!authed) throw new Error('Unauthorized');

    const now = Date.now();
    const email = args.email.trim().toLowerCase();
    const durationMs = (args.durationDays ?? 30) * 24 * 60 * 60 * 1000;
    const expiresAt = now + durationMs;

    const existingProfile = await ctx.db
      .query('userProfiles')
      .withIndex('by_email', (q) => q.eq('email', email))
      .first();

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        isSubscribed: true,
        subscriptionExpiresAt: expiresAt,
        subscriptionTier: args.tier ?? 'punter',
        flutterwaveTxRef: args.txRef,
        updatedAt: now
      });
    }

    // Record subscription transaction
    const existingSub = await ctx.db
      .query('subscriptions')
      .withIndex('by_txRef', (q) => q.eq('txRef', args.txRef))
      .first();

    if (existingSub) {
      await ctx.db.patch(existingSub._id, {
        status: 'successful',
        transactionId: args.transactionId ?? existingSub.transactionId,
        updatedAt: now
      });
    } else {
      await ctx.db.insert('subscriptions', {
        email,
        txRef: args.txRef,
        transactionId: args.transactionId,
        tier: args.tier ?? 'punter',
        amount: args.amount ?? 5000,
        currency: 'NGN',
        status: 'successful',
        createdAt: now,
        updatedAt: now
      });
    }

    return { success: true, expiresAt };
  }
});

// Backward-compatible subscription check (also used by legacy flows). Derives
// admin/tester status server-side and never trusts a client-supplied flag.
export const checkSubscription = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.email && identity.email.trim().toLowerCase() !== email) {
      return { isSubscribed: false, isAdmin: false, isTester: false, authorized: false };
    }
    const access = await deriveAccess(ctx, email);
    return {
      ...access,
      txRef: access.isAdmin ? 'SUPER_ADMIN_PASS' : undefined
    };
  }
});
