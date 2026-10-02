import { ConvexError } from 'convex/values';
import type { QueryCtx } from './_generated/server';
import { identityDetails, isTesterEmail } from './users';

/** Browser session IDs and caller-supplied user IDs are never authorization. */
export async function authenticatedRecordOwner(ctx: Pick<QueryCtx, 'auth' | 'db'>): Promise<string> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError('Please sign in to synchronize your saved work.');
  const details = await identityDetails(ctx, identity);
  if (!details) throw new ConvexError('Could not verify your account. Please sign in again.');
  // Shared tester credentials must retain session isolation. Ordinary accounts
  // use their stable account ID so new logins and devices share their work.
  return isTesterEmail(details.email) ? identity.subject : identity.subject.split('|')[0];
}

export function ownsRecord<T extends { userId?: string }>(record: T | null, owner: string): record is T {
  return !!record && (record.userId === owner || (!owner.includes('|') && record.userId?.split('|')[0] === owner));
}
