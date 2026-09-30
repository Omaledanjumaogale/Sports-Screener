// ── Tester access codes ───────────────────────────────────────────────────────
// The tester EMAIL + PASSWORD is a single shared credential provisioned
// server-side and never changes. What identifies an individual tester is a CODE:
//
//   1. The super admin ISSUES a code (auto-stored here on generation).
//   2. The tester REGISTERS their details against it (full name, NIN, issued
//      tester email + password, actual email, preferred password, mobile,
//      state). Until this happens the code cannot open the app.
//   3. On the FIRST login the code is BOUND TO ONE DEVICE, which is also when
//      the 3-month trial clock starts. A second device is rejected.
//
// Every mutation/query that touches codes is admin-gated except `register`
// (public, code-gated) and the session calls (authenticated as the tester login).

import { mutation, query, internalMutation } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { requireAdmin } from './access';
import { isTesterEmail } from './users';
import { logAuditEvent } from './auditLog';

// NOTE ON ERRORS: every rejection below is a `ConvexError`, not a plain
// `Error`. Convex REDACTES plain Error messages on production deployments
// (the client only receives "Server Error"), which would hide "this code is
// already active on another device" and every other rule the tester needs to
// read. ConvexError payloads are deliberately forwarded to the client.

declare const process: { env: Record<string, string | undefined> };

/** Free-trial length for a tester access code: three months. */
export const TESTER_TRIAL_DAYS = 90;
export const TESTER_TRIAL_MS = TESTER_TRIAL_DAYS * 24 * 60 * 60 * 1000;

/** Presence window used for the "active now" counters (matches presence.ts). */
const PRESENCE_WINDOW_MS = 90_000;

// Unambiguous alphabet: no 0/O/1/I/L, so a code can be read aloud or retyped
// from a screenshot without transcription errors.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  try {
    crypto.getRandomValues(out);
    return out;
  } catch {
    // Non-crypto fallback: only reachable if Web Crypto is unavailable. Codes
    // are still unguessable in practice thanks to the uniqueness check below.
    for (let i = 0; i < n; i++) out[i] = Math.floor(Math.random() * 256);
    return out;
  }
}

/** A code looks like `PDT-7K2M-9QX4` (11 significant chars, ~51 bits). */
function makeCode(): string {
  const bytes = randomBytes(9);
  let body = '';
  for (let i = 0; i < 9; i++) body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return `PDT-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * One-way fingerprint for a registered password. The plaintext is NEVER stored;
 * the admin console can only ever show "set / not set".
 */
async function hashSecret(value: string, salt: string): Promise<string> {
  const material = `${salt}:${value}`;
  try {
    const data = new TextEncoder().encode(material);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Deterministic FNV-1a fallback — still never reversible to the password.
    let h = 0x811c9dc5;
    for (let i = 0; i < material.length; i++) {
      h ^= material.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `fnv1a_${h.toString(16)}`;
  }
}

function normalizeCode(raw: string): string {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Mask a NIN for display: `•••••••1234`. */
function maskNin(nin?: string): string {
  const s = String(nin || '');
  if (!s) return '';
  if (s.length <= 4) return s;
  return `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function daysLeft(expiresAt?: number): number | null {
  if (!expiresAt) return null;
  const ms = expiresAt - Date.now();
  return ms <= 0 ? 0 : Math.ceil(ms / (24 * 60 * 60 * 1000));
}

function testerLoginEmail(): string {
  return (process.env.TESTER_EMAIL || '').trim().toLowerCase();
}

// ── Admin: issue / inspect / revoke ──────────────────────────────────────────

/**
 * Issue one or more fresh access codes. Codes are unique against the existing
 * table and are stored immediately, so the login page recognises them the
 * moment the admin hands them out.
 */
export const generate = mutation({
  args: {
    count: v.optional(v.number()),
    label: v.optional(v.string()),
    batch: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const count = Math.min(Math.max(Math.floor(args.count ?? 1), 1), 50);
    const now = Date.now();
    const created: string[] = [];

    for (let i = 0; i < count; i++) {
      // Retry on the (astronomically unlikely) collision rather than trusting RNG.
      let code = '';
      for (let attempt = 0; attempt < 6; attempt++) {
        const candidate = makeCode();
        const clash = await ctx.db
          .query('testerCodes')
          .withIndex('by_code', (q) => q.eq('code', candidate))
          .first();
        if (!clash) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new ConvexError('Could not allocate a unique code — please retry.');

      await ctx.db.insert('testerCodes', {
        code,
        status: 'issued',
        label: args.label?.trim() || undefined,
        batch: args.batch?.trim() || undefined,
        createdBy: admin.email,
        createdAt: now,
        loginCount: 0
      });
      created.push(code);
      await logAuditEvent(ctx, admin.email, 'tester.code.issued', code, {
        label: args.label ?? null,
        batch: args.batch ?? null
      });
    }

    return { ok: true, codes: created, count: created.length };
  }
});

/** Revoke a code: kills the session, frees nothing else, keeps the audit trail. */
export const revoke = mutation({
  args: { code: v.string(), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const code = normalizeCode(args.code);
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) throw new ConvexError(`No tester code "${code}" found.`);

    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: 'revoked',
      revokedAt: now,
      revokedBy: admin.email,
      notes: args.reason?.trim() || row.notes
    });
    // Kill every live session bound to this code, not just the row's state.
    const sessions = await ctx.db
      .query('testerSessions')
      .withIndex('by_code', (q) => q.eq('code', code))
      .collect();
    for (const s of sessions) await ctx.db.patch(s._id, { revoked: true });

    await logAuditEvent(ctx, admin.email, 'tester.code.revoked', code, {
      reason: args.reason ?? null
    });
    return { ok: true, code };
  }
});

/** Restore a revoked code (the trial window it had is preserved). */
export const restore = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const code = normalizeCode(args.code);
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) throw new ConvexError(`No tester code "${code}" found.`);
    await ctx.db.patch(row._id, {
      status: row.registeredAt ? 'claimed' : 'issued',
      revokedAt: undefined,
      revokedBy: undefined
    });
    const sessions = await ctx.db
      .query('testerSessions')
      .withIndex('by_code', (q) => q.eq('code', code))
      .collect();
    for (const s of sessions) await ctx.db.patch(s._id, { revoked: false });
    await logAuditEvent(ctx, admin.email, 'tester.code.restored', code);
    return { ok: true, code };
  }
});

/**
 * Admin state-management: add trial days to a code (or clear the device binding
 * so a tester who changed phones can be moved onto the new one).
 */
export const adjust = mutation({
  args: {
    code: v.string(),
    addDays: v.optional(v.number()),
    clearDevice: v.optional(v.boolean()),
    notes: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const code = normalizeCode(args.code);
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) throw new ConvexError(`No tester code "${code}" found.`);

    const now = Date.now();
    const patch: Record<string, unknown> = {};
    if (args.addDays) {
      // Extending an unstarted trial moves its start so the extra days are real.
      const base = row.trialExpiresAt ?? (row.trialStartsAt ?? now) + TESTER_TRIAL_MS;
      patch.trialExpiresAt = base + args.addDays * 24 * 60 * 60 * 1000;
      if (!row.trialStartsAt) patch.trialStartsAt = row.trialStartsAt ?? now;
    }
    if (args.clearDevice) {
      patch.deviceId = undefined;
      patch.deviceLabel = undefined;
      const sessions = await ctx.db
        .query('testerSessions')
        .withIndex('by_code', (q) => q.eq('code', code))
        .collect();
      for (const s of sessions) await ctx.db.patch(s._id, { revoked: true });
    }
    if (args.notes !== undefined) patch.notes = args.notes.trim() || undefined;

    if (Object.keys(patch).length) await ctx.db.patch(row._id, patch);
    await logAuditEvent(ctx, admin.email, 'tester.code.adjusted', code, {
      addDays: args.addDays ?? null,
      clearDevice: !!args.clearDevice
    });
    return { ok: true, code };
  }
});

/**
 * Audited PII reveal: the NIN is masked everywhere else, and reading the full
 * value is a deliberate, logged act.
 */
export const revealNin = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const code = normalizeCode(args.code);
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) throw new ConvexError(`No tester code "${code}" found.`);
    await logAuditEvent(ctx, admin.email, 'tester.nin.revealed', code);
    return { ok: true, nin: row.nin ?? '' };
  }
});

// ── Public: tester registration ───────────────────────────────────────────────

/**
 * Register a tester's details against an issued code. MUST happen before the
 * code can be used to log in — this is the "signup" half of the tester flow and
 * is deliberately separate from the paid signup so neither flow can break the
 * other.
 */
export const register = mutation({
  args: {
    code: v.string(),
    fullName: v.string(),
    nin: v.string(),
    testerEmail: v.string(),
    actualEmail: v.string(),
    preferredPassword: v.string(),
    mobile: v.string(),
    stateOfResidence: v.string(),
    consentAccepted: v.boolean()
  },
  handler: async (ctx, args) => {
    const code = normalizeCode(args.code);
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) {
      throw new ConvexError('That access code was not recognised. Check it with whoever issued it.');
    }
    if (row.status === 'revoked') {
      throw new ConvexError('That access code has been revoked. Please contact the administrator.');
    }
    if (row.status === 'claimed') {
      throw new ConvexError('That access code has already been registered to another tester.');
    }

    // The tester email is ISSUED, not chosen — reject anything else so a code
    // can never be pointed at a different account.
    const issued = testerLoginEmail();
    const suppliedTesterEmail = args.testerEmail.trim().toLowerCase();
    if (issued && suppliedTesterEmail !== issued) {
      throw new ConvexError('Please use the tester email address exactly as it was issued to you.');
    }

    const fullName = args.fullName.trim();
    if (fullName.length < 3 || fullName.split(/\s+/).length < 2) {
      throw new ConvexError('Please enter your full name (first and last name).');
    }

    const nin = args.nin.replace(/\D/g, '');
    if (nin.length !== 11) {
      throw new ConvexError('Your NIN must be exactly 11 digits.');
    }

    const actualEmail = args.actualEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(actualEmail)) {
      throw new ConvexError('Please enter a valid personal email address.');
    }
    if (actualEmail === issued) {
      throw new ConvexError('Your personal email must be different from the tester email address.');
    }

    const mobile = args.mobile.replace(/[^\d+]/g, '');
    if (mobile.replace(/\D/g, '').length < 10) {
      throw new ConvexError('Please enter a valid mobile number (at least 10 digits).');
    }

    if (args.preferredPassword.length < 8) {
      throw new ConvexError('Your preferred password must be at least 8 characters long.');
    }
    if (!args.stateOfResidence.trim()) {
      throw new ConvexError('Please select your state of residence.');
    }
    if (!args.consentAccepted) {
      throw new ConvexError('Please accept the terms to continue.');
    }

    // One code per person: the same personal email cannot hold two codes.
    const duplicate = await ctx.db
      .query('testerCodes')
      .withIndex('by_actualEmail', (q) => q.eq('actualEmail', actualEmail))
      .first();
    if (duplicate && duplicate._id !== row._id) {
      throw new ConvexError('That personal email is already registered to another tester access code.');
    }

    const now = Date.now();
    const preferredPasswordHash = await hashSecret(
      args.preferredPassword,
      `${code}:${actualEmail}`
    );

    await ctx.db.patch(row._id, {
      status: 'claimed',
      fullName,
      nin,
      testerEmail: suppliedTesterEmail || issued,
      actualEmail,
      preferredPasswordHash,
      hasPreferredPassword: true,
      mobile,
      stateOfResidence: args.stateOfResidence.trim(),
      consentAccepted: true,
      registeredAt: now
    });

    await logAuditEvent(ctx, suppliedTesterEmail || 'tester', 'tester.registered', code, {
      actualEmail,
      stateOfResidence: args.stateOfResidence.trim()
    });

    return {
      ok: true,
      code,
      status: 'claimed' as const,
      fullName,
      testerEmail: suppliedTesterEmail || issued,
      trialDays: TESTER_TRIAL_DAYS,
      message: `Registration complete. Log in with the tester account and code ${code} on the ONE device you will use for your ${TESTER_TRIAL_DAYS}-day free trial.`
    };
  }
});

/** Public lookup so the register form (and login page) can validate a code. */
export const checkCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = normalizeCode(args.code);
    if (!code) return { found: false, status: 'unknown' as const };
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) return { found: false, status: 'unknown' as const };
    return {
      found: true,
      // A code is only usable while issued (not yet registered) or claimed.
      status: row.status,
      claimed: row.status === 'claimed',
      registered: !!row.registeredAt,
      trialDays: TESTER_TRIAL_DAYS
    };
  }
});

// ── Tester session: device binding + trial clock ──────────────────────────────

/**
 * Called right after the tester login succeeds. Binds the code to this device
 * and starts the trial clock on the FIRST activation; every later call from a
 * different device is refused.
 */
export const activateSession = mutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
    deviceLabel: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError('Please sign in with the tester account first.');
    const email = await callerEmail(ctx, identity);
    if (!isTesterEmail(email)) {
      throw new ConvexError('Tester access codes can only be activated by the tester account.');
    }

    const code = normalizeCode(args.code);
    const deviceId = String(args.deviceId || '').trim();
    if (deviceId.length < 8) {
      throw new ConvexError('Could not identify this device — please reload the page and try again.');
    }

    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) {
      throw new ConvexError('That access code was not recognised. Check it with whoever issued it.');
    }
    if (row.status === 'revoked') {
      throw new ConvexError('That access code has been revoked. Please contact the administrator.');
    }
    if (row.status !== 'claimed') {
      throw new ConvexError(
        'This code has not been registered yet. Complete the tester registration form first.'
      );
    }

    // ONE DEVICE ONLY. The first device to activate owns the code; any other is
    // refused (the admin can release the binding from the console if a tester
    // legitimately changes device).
    if (row.deviceId && row.deviceId !== deviceId) {
      throw new ConvexError(
        'This access code is already active on another device. A tester code can only be used on one device — contact the administrator if you have changed device.'
      );
    }

    const now = Date.now();
    const trialStartsAt = row.trialStartsAt ?? now;
    const trialExpiresAt = row.trialExpiresAt ?? trialStartsAt + TESTER_TRIAL_MS;
    if (trialExpiresAt <= now) {
      throw new ConvexError(
        `Your ${TESTER_TRIAL_DAYS}-day free trial has ended. Please subscribe to keep using PulseOdds.`
      );
    }

    await ctx.db.patch(row._id, {
      deviceId,
      deviceLabel: args.deviceLabel?.slice(0, 120) ?? row.deviceLabel,
      trialStartsAt,
      trialExpiresAt,
      lastLoginAt: now,
      loginCount: (row.loginCount ?? 0) + 1
    });

    // Bind THIS auth session (userId|sessionId) to the code so the server-side
    // access gates can tell which tester sits behind the shared tester login.
    const subject = identity.subject ?? '';
    const existing = await ctx.db
      .query('testerSessions')
      .withIndex('by_subject', (q) => q.eq('subject', subject))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        code,
        deviceId,
        deviceLabel: args.deviceLabel?.slice(0, 120) ?? existing.deviceLabel,
        lastSeenAt: now,
        revoked: false
      });
    } else {
      await ctx.db.insert('testerSessions', {
        subject,
        userId: subject.split('|')[0] || undefined,
        code,
        deviceId,
        deviceLabel: args.deviceLabel?.slice(0, 120),
        createdAt: now,
        lastSeenAt: now,
        revoked: false
      });
    }

    await logAuditEvent(ctx, email, 'tester.session.activated', code, {
      deviceId,
      firstActivation: !row.deviceId
    });

    return {
      ok: true,
      code,
      fullName: row.fullName ?? 'Tester',
      trialStartsAt,
      trialExpiresAt,
      daysRemaining: daysLeft(trialExpiresAt),
      hasMasterPass: true
    };
  }
});

/** Live trial state for the signed-in tester (drives the countdown badge). */
export const mySession = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { active: false, reason: 'unauthenticated' as const };
    const subject = identity.subject ?? '';
    const session = await ctx.db
      .query('testerSessions')
      .withIndex('by_subject', (q) => q.eq('subject', subject))
      .first();
    if (!session) return { active: false, reason: 'no-session' as const };

    const code = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', session.code))
      .first();
    if (!code) return { active: false, reason: 'unknown-code' as const };

    const now = Date.now();
    const expired = !!code.trialExpiresAt && code.trialExpiresAt <= now;
    const active = !session.revoked && code.status !== 'revoked' && !expired;

    return {
      active,
      reason: session.revoked
        ? ('revoked' as const)
        : code.status === 'revoked'
          ? ('revoked' as const)
          : expired
            ? ('expired' as const)
            : ('active' as const),
      code: code.code,
      fullName: code.fullName ?? null,
      deviceId: session.deviceId,
      deviceLabel: session.deviceLabel ?? code.deviceLabel ?? null,
      trialStartsAt: code.trialStartsAt ?? null,
      trialExpiresAt: code.trialExpiresAt ?? null,
      daysRemaining: daysLeft(code.trialExpiresAt),
      loginCount: code.loginCount ?? 0,
      lastLoginAt: code.lastLoginAt ?? null
    };
  }
});

/** Cheap heartbeat so the admin console can show which testers are live. */
export const touchSession = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { ok: false };
    const session = await ctx.db
      .query('testerSessions')
      .withIndex('by_subject', (q) => q.eq('subject', identity.subject ?? ''))
      .first();
    if (!session) return { ok: false };
    await ctx.db.patch(session._id, { lastSeenAt: Date.now() });
    return { ok: true };
  }
});

async function callerEmail(
  ctx: QueryCtx | MutationCtx,
  identity: { subject?: string; email?: string; name?: string }
): Promise<string> {
  if (identity.email) return identity.email.trim().toLowerCase();
  const userId = (identity.subject ?? '').split('|')[0];
  const doc: any = userId ? await ctx.db.get(userId as any) : null;
  return String(doc?.email || '').trim().toLowerCase();
}

// ── Admin: user management + state overview ──────────────────────────────────

/**
 * Everything the admin user-management / state interface renders: every tester
 * code with its registration, device binding and trial state, the paying
 * subscribers, and the live counters. NIN is masked — `revealNin` is the
 * audited way to see it in full.
 */
export const overview = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 300), 1), 1000);
    const now = Date.now();

    const codes = (await ctx.db.query('testerCodes').collect())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);

    const sessions = await ctx.db.query('testerSessions').collect();
    const sessionsByCode = new Map<string, { live: boolean; lastSeenAt: number }>();
    for (const s of sessions) {
      const prev = sessionsByCode.get(s.code);
      const live = !!s.deviceId && now - s.lastSeenAt < 30 * 60_000 && !s.revoked;
      if (!prev || s.lastSeenAt > prev.lastSeenAt) {
        sessionsByCode.set(s.code, { live: live || !!prev?.live, lastSeenAt: s.lastSeenAt });
      }
    }

    const testers = codes.map((c) => {
      const session = sessionsByCode.get(c.code);
      const expired = !!c.trialExpiresAt && c.trialExpiresAt <= now;
      const days = daysLeft(c.trialExpiresAt);
      return {
        code: c.code,
        status: c.status,
        label: c.label ?? null,
        batch: c.batch ?? null,
        createdBy: c.createdBy,
        createdAt: c.createdAt,
        fullName: c.fullName ?? null,
        ninMasked: maskNin(c.nin),
        ninLast4: c.nin ? c.nin.slice(-4) : null,
        testerEmail: c.testerEmail ?? null,
        actualEmail: c.actualEmail ?? null,
        hasPreferredPassword: !!c.hasPreferredPassword,
        mobile: c.mobile ?? null,
        stateOfResidence: c.stateOfResidence ?? null,
        registeredAt: c.registeredAt ?? null,
        deviceId: c.deviceId ? `${c.deviceId.slice(0, 12)}…` : null,
        deviceLabel: c.deviceLabel ?? null,
        trialStartsAt: c.trialStartsAt ?? null,
        trialExpiresAt: c.trialExpiresAt ?? null,
        daysRemaining: days,
        loginCount: c.loginCount ?? 0,
        lastLoginAt: c.lastLoginAt ?? null,
        sessionActive: !!session?.live,
        lastSeenAt: session?.lastSeenAt ?? null,
        revokedAt: c.revokedAt ?? null,
        notes: c.notes ?? null
      };
    });

    const profiles = await ctx.db.query('userProfiles').collect();
    const subscribers = profiles
      .filter((p) => p.isSubscribed || (p.subscriptionExpiresAt ?? 0) > now)
      .map((p) => ({
        email: p.email,
        fullName: p.fullName,
        mobile: p.mobile ?? null,
        stateOfResidence: p.stateOfResidence ?? null,
        role: p.role ?? 'user',
        tier: p.subscriptionTier ?? null,
        isSubscribed: !!p.isSubscribed,
        subscriptionExpiresAt: p.subscriptionExpiresAt ?? null,
        daysRemaining: daysLeft(p.subscriptionExpiresAt),
        updatedAt: p.updatedAt
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);

    const presenceRows = await ctx.db
      .query('presence')
      .withIndex('by_lastSeen', (q) => q.gt('lastSeen', now - PRESENCE_WINDOW_MS))
      .collect();

    return {
      generatedAt: now,
      trialDays: TESTER_TRIAL_DAYS,
      testers,
      subscribers,
      counts: {
        codesIssued: testers.length,
        codesAwaitingRegistration: testers.filter((t) => t.status === 'issued').length,
        claimable: testers.filter((t) => t.status === 'claimed').length,
        revoked: testers.filter((t) => t.status === 'revoked').length,
        registered: testers.filter((t) => !!t.registeredAt).length,
        deviceBound: testers.filter((t) => !!t.deviceId).length,
        activeTrials: testers.filter(
          (t) => t.status === 'claimed' && t.trialExpiresAt && t.trialExpiresAt > now
        ).length,
        expiredTrials: testers.filter((t) => t.trialExpiresAt && t.trialExpiresAt <= now).length,
        expiringSoon: testers.filter(
          (t) =>
            t.trialExpiresAt && t.trialExpiresAt > now && t.trialExpiresAt - now <= 7 * 24 * 60 * 60 * 1000
        ).length,
        onlineNow: presenceRows.length
      }
    };
  }
});

/** Admin: the free-text note on a code. */
export const setNotes = mutation({
  args: { code: v.string(), notes: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const code = normalizeCode(args.code);
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', code))
      .first();
    if (!row) throw new ConvexError(`No tester code "${code}" found.`);
    await ctx.db.patch(row._id, { notes: args.notes.trim() || undefined });
    await logAuditEvent(ctx, admin.email, 'tester.code.noted', code);
    return { ok: true };
  }
});

// ── Internals ────────────────────────────────────────────────────────────────

export const findByCodeInternal = internalMutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('testerCodes')
      .withIndex('by_code', (q) => q.eq('code', normalizeCode(args.code)))
      .first();
    return row ?? null;
  }
});
