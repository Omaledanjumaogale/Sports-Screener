// ── Server-side access control ────────────────────────────────────────────────
// Every premium Convex function (predictor data, refresh, score sync, payments)
// resolves the caller's identity from the attached Convex auth JWT and enforces
// access SERVER-SIDE. The client-side paywall is only cosmetic — these gates
// are what actually stop an anonymous caller from reading premium data via the
// Convex API directly.
//
// Reuses the authoritative identity/derive logic from users.ts so admin,
// tester-trial and subscription rules can never drift between modules.

import { internalQuery } from './_generated/server';
import type { QueryCtx } from './_generated/server';
import { deriveAccess, identityDetails, type AccessStatus } from './users';
import { isFeatureEnabled } from './featureFlags';
import { internal } from './_generated/api';

export type { AccessStatus };

/** Resolve the caller's authoritative access, or null when unauthenticated. */
export async function currentAccess(ctx: QueryCtx): Promise<AccessStatus | null> {
  const identity = await ctx.auth.getUserIdentity();
  const details = await identityDetails(ctx, identity);
  if (!details) return null;
  const email = details.email.trim().toLowerCase();
  return deriveAccess(ctx, email);
}

/**
 * Action-side gate helper: actions have no ctx.db, so they resolve access by
 * running this internal query. Returns the caller's access or null.
 */
export const forCaller = internalQuery({
  args: {},
  handler: async (ctx) => currentAccess(ctx)
});

/** Throw when the caller of an ACTION lacks Master Pass (or flag disabled). */
export async function requireMasterPassInAction(ctx: {
  runQuery: (ref: any, args?: any) => Promise<any>;
}): Promise<AccessStatus> {
  const flags = await ctx.runQuery(internal.access.flagStatus, {});
  if (!flags.predictor) {
    throw new Error('The AI Predictor is temporarily disabled for maintenance. Please check back shortly.');
  }
  const access: AccessStatus | null = await ctx.runQuery(internal.access.forCaller, {});
  if (!access) throw new Error('Please sign in to access the AI Predictor.');
  if (!access.hasMasterPass) {
    throw new Error('Master Pass required. Upgrade your plan to unlock AI Predictor projections.');
  }
  return access;
}

/**
 * Hard gate: the caller must hold Master Pass (admin, active tester trial, or
 * master subscriber). Throws with a friendly message otherwise. Also honors
 * the `predictor` feature flag so the module can be killed instantly.
 */
export async function requireMasterPass(ctx: QueryCtx): Promise<AccessStatus> {
  if (!(await isFeatureEnabled(ctx, 'predictor'))) {
    throw new Error('The AI Predictor is temporarily disabled for maintenance. Please check back shortly.');
  }
  const access = await currentAccess(ctx);
  if (!access) throw new Error('Please sign in to access the AI Predictor.');
  if (!access.hasMasterPass) {
    throw new Error('Master Pass required. Upgrade your plan to unlock AI Predictor projections.');
  }
  return access;
}

/** Hard gate: super admin only. */
export async function requireAdmin(ctx: QueryCtx): Promise<AccessStatus> {
  const access = await currentAccess(ctx);
  if (!access || !access.isAdmin) throw new Error('Admin access required.');
  return access;
}

/**
 * Soft gate used by functions that should degrade gracefully for anonymous
 * callers (e.g. returning an empty list instead of throwing). Returns null
 * access when unauthenticated; callers decide the fallback shape.
 */
export async function optionalMasterPass(ctx: QueryCtx): Promise<AccessStatus | null> {
  const access = await currentAccess(ctx);
  if (!access || !access.hasMasterPass) return null;
  return access;
}

/** Flag status readable from actions (no auth needed — flags are not secret). */
export const flagStatus = internalQuery({
  args: {},
  handler: async (ctx) => ({
    predictor: await isFeatureEnabled(ctx, 'predictor'),
    payments: await isFeatureEnabled(ctx, 'payments'),
    maintenance: await isFeatureEnabled(ctx, 'maintenance')
  })
});
