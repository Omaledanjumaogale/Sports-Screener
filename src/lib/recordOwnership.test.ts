import { describe, expect, it } from 'vitest';
import { authenticatedRecordOwner, ownsRecord } from '../../convex/recordOwnership';

describe('cloud record authorization', () => {
  it('rejects anonymous callers rather than trusting a browser session ID', async () => {
    await expect(authenticatedRecordOwner({ auth: { getUserIdentity: async () => null } } as any))
      .rejects.toThrow('Please sign in');
  });

  it('uses only the verified identity', async () => {
    expect(await authenticatedRecordOwner({ auth: { getUserIdentity: async () => ({ subject: 'account|session', email: 'user@example.com' }) } } as any))
      .toBe('account');
  });

  it('rejects missing, anonymous and other users records', () => {
    expect(ownsRecord(null, 'owner')).toBe(false);
    expect(ownsRecord({}, 'owner')).toBe(false);
    expect(ownsRecord({ userId: 'another' }, 'owner')).toBe(false);
    expect(ownsRecord({ userId: 'owner' }, 'owner')).toBe(true);
    expect(ownsRecord({ userId: 'owner|old-session' }, 'owner')).toBe(true);
    expect(ownsRecord({ userId: 'tester|other-session' }, 'tester|session')).toBe(false);
  });
});
