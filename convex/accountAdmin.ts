// ── Account administration (super-admin only) ─────────────────────────────────
// Server-side credential repair. Used when an account was seeded with a bad
// password hash, so both `signIn` (wrong secret) and `signUp`
// (account exists) fail. The @convex-dev/auth helpers run in an ACTION because
// Scrypt hashing needs the action runtime.

import { action } from './_generated/server';
import { v } from 'convex/values';
import { ConvexError } from 'convex/values';
import {
  retrieveAccount,
  modifyAccountCredentials,
  invalidateSessions
} from '@convex-dev/auth/server';
import { requireAdminInAction } from './access';

/** Reset any account's password server-side and invalidate its sessions. */
export const resetAccountPassword = action({
  args: {
    email: v.string(),
    newPassword: v.string()
  },
  handler: async (ctx, args) => {
    await requireAdminInAction(ctx);
    const email = args.email.trim();
    if (!email || !args.newPassword || args.newPassword.length < 8) {
      throw new ConvexError('Provide an email and a password of at least 8 characters.');
    }

    let account: { _id: unknown; userId: unknown } | null = null;
    let user: { _id: unknown } | null = null;
    try {
      const retrieved = await retrieveAccount(ctx, {
        provider: 'password',
        account: { id: email }
      });
      if (retrieved) {
        account = retrieved.account as { _id: unknown; userId: unknown };
        user = retrieved.user as { _id: unknown };
      }
    } catch {
      account = null;
    }

    if (!account || !user) {
      throw new ConvexError(`No password account exists for ${email}.`);
    }

    await modifyAccountCredentials(ctx, {
      provider: 'password',
      account: { id: email, secret: args.newPassword }
    });
    await invalidateSessions(ctx, { userId: user._id as never });
    return { ok: true, email };
  }
});
