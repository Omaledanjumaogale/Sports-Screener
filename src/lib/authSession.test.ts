// Locks in the session-persistence contract: a signed-in user must stay signed
// in until they explicitly log out. Convex Auth issues a 1-hour JWT alongside a
// 30-day refresh token, so the client has to (a) recognise a stale JWT and
// (b) never drop the refresh token while merely clearing the JWT.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  jwtExpiresAt,
  isAuthTokenStale,
  setAuthTokens,
  getAuthRefreshToken,
  clearConvexAuthToken,
  clearConvexAuthTokens,
  refreshAuthSession
} from './convexClient';

const b64url = (value: unknown): string =>
  Buffer.from(JSON.stringify(value))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Build a JWT-shaped string whose `exp` claim is the given epoch second. */
function makeJwt(expSeconds: number): string {
  return `${b64url({ alg: 'RS256', typ: 'JWT' })}.${b64url({ sub: 'user-1', exp: expSeconds })}.c2ln`;
}

// A token long enough to pass the real-Convex-token shape check.
const LONG_JWT = makeJwt(Math.floor(Date.now() / 1000) + 3600);
const REAL_REFRESH = 'refresh-token-value-that-is-long-enough-to-be-real';

beforeEach(() => {
  clearConvexAuthTokens();
});

describe('jwtExpiresAt', () => {
  it('decodes the exp claim into milliseconds', () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    expect(jwtExpiresAt(makeJwt(exp))).toBe(exp * 1000);
  });

  it('returns null for anything that is not a readable JWT', () => {
    expect(jwtExpiresAt(null)).toBeNull();
    expect(jwtExpiresAt(undefined)).toBeNull();
    expect(jwtExpiresAt('not-a-jwt')).toBeNull();
    expect(jwtExpiresAt('a.!!!not-base64!!!.c')).toBeNull();
  });
});

describe('isAuthTokenStale', () => {
  it('treats a missing token as stale so it gets renewed', () => {
    expect(isAuthTokenStale(null)).toBe(true);
  });

  it('accepts a token that still has an hour of life', () => {
    expect(isAuthTokenStale(LONG_JWT)).toBe(false);
  });

  it('rejects a token that already expired', () => {
    const expired = makeJwt(Math.floor(Date.now() / 1000) - 60);
    expect(isAuthTokenStale(expired)).toBe(true);
  });

  it('renews early — inside the 2-minute safety margin', () => {
    const nearly = makeJwt(Math.floor(Date.now() / 1000) + 60);
    expect(isAuthTokenStale(nearly)).toBe(true);
  });

  it('assumes an opaque (non-JWT) token is usable rather than renewing blindly', () => {
    expect(isAuthTokenStale('emulated-session-token')).toBe(false);
  });
});

describe('refresh-token retention', () => {
  it('keeps the refresh token when only the JWT is cleared', () => {
    setAuthTokens({ token: LONG_JWT, refreshToken: REAL_REFRESH });
    expect(getAuthRefreshToken()).toBe(REAL_REFRESH);

    // This is the path sign-in uses before calling auth:signIn; losing the
    // refresh token here is exactly what caused hourly sign-outs.
    clearConvexAuthToken();
    expect(getAuthRefreshToken()).toBe(REAL_REFRESH);
  });

  it('drops the refresh token on a full sign-out', () => {
    setAuthTokens({ token: LONG_JWT, refreshToken: REAL_REFRESH });
    clearConvexAuthTokens();
    expect(getAuthRefreshToken()).toBeNull();
  });

  it('leaves a field untouched when it is omitted', () => {
    setAuthTokens({ token: LONG_JWT, refreshToken: REAL_REFRESH });
    setAuthTokens({ token: LONG_JWT });
    expect(getAuthRefreshToken()).toBe(REAL_REFRESH);
  });

  it('ignores fake/emulated tokens that would 401 every call', () => {
    setAuthTokens({ token: 'token_emulated_123', refreshToken: REAL_REFRESH });
    // Only observable via the refresh path: the emulated JWT is not attached,
    // but the refresh token survives so a real session can still be restored.
    expect(getAuthRefreshToken()).toBe(REAL_REFRESH);
  });
});

describe('refreshAuthSession', () => {
  it('reports "unavailable" (never "invalid") when there is no refresh token', async () => {
    clearConvexAuthTokens();
    const outcome = await refreshAuthSession();
    // Critically: an unavailable refresh must not be treated as a dead session,
    // because that is what would sign a user out.
    expect(outcome.status).toBe('unavailable');
  });
});
