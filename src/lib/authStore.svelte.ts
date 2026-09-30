const AUTH_STORAGE_KEY = 'pulseodds_auth_session_v1';

// Super admin / tester identities come from env so the client never ships a
// password or a privileged email in source. Auth itself is enforced server-side
// (Convex Password provider); these helpers only drive client routing/UI.
export const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || '';
export const TESTER_EMAIL = import.meta.env.VITE_TESTER_EMAIL || '';

/** Tester free trial length (mirrors TESTER_TRIAL_DAYS on the server). */
export const TESTER_TRIAL_DAYS = 90;

import {
  setAuthTokens,
  clearConvexAuthTokens,
  getAuthRefreshToken,
  refreshAuthSession,
  isAuthTokenStale,
  type RefreshOutcome,
  queryConvex,
  api
} from './convexClient';

export function isSuperAdminEmail(email?: string): boolean {
  if (!email) return false;
  // Normalize BOTH sides: env values may carry mixed casing while inputs are
  // user-typed (usually lowercased). A case-sensitive compare silently demotes
  // the super admin on any casing mismatch.
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.trim().toLowerCase();
}

export function isTesterEmail(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === TESTER_EMAIL.trim().toLowerCase();
}

export interface UserSession {
  id: string;
  email: string;
  fullName?: string;
  mobile?: string;
  dob?: string;
  stateOfResidence?: string;
  consentAccepted?: boolean;
  name?: string;
  createdAt?: number;
  isSubscribed?: boolean;
  isAdmin?: boolean;
  isTester?: boolean;
  subscriptionExpiresAt?: number;
  subscriptionTier?: 'punter' | 'master';
  hasMasterPass?: boolean;
  /** The tester access code bound to this session (tester accounts only). */
  testerCode?: string;
  /** Server verdict on why a tester session does/doesn't hold Master Pass. */
  testerReason?: 'active' | 'no-session' | 'not-registered' | 'revoked' | 'expired';
  txRef?: string;
}

// Global reactive auth state using Svelte 5 runes
export const authState = $state({
  isAuthenticated: false,
  isLoading: true,
  user: null as UserSession | null,
  token: null as string | null,
  // Convex Auth issues a 1-hour JWT plus a 30-day refresh token. The refresh
  // token is what keeps a user signed in between those two horizons; dropping it
  // (the previous behaviour) signed everyone out one hour after logging in.
  refreshToken: null as string | null
});

// Persist the whole session — user and BOTH tokens — in one place, so no code
// path can accidentally save a session that cannot be renewed.
function persistSession() {
  if (typeof window === 'undefined') return;
  try {
    if (authState.user && authState.token) {
      localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          user: authState.user,
          token: authState.token,
          refreshToken: authState.refreshToken
        })
      );
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to persist auth session:', e);
  }
}

// Convex Auth JWTs last 60 minutes. Refreshing on a timer — and again before any
// call that finds the token stale — keeps a signed-in user signed in for the
// full 30-day session instead of being logged out mid-session.
const SESSION_MAINTENANCE_MS = 10 * 60 * 1000;
let maintenanceTimer: ReturnType<typeof setInterval> | null = null;

function startSessionMaintenance() {
  if (typeof window === 'undefined' || maintenanceTimer) return;
  maintenanceTimer = setInterval(() => {
    void renewSession();
  }, SESSION_MAINTENANCE_MS);
}

function stopSessionMaintenance() {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = null;
  }
}

/**
 * Exchange the stored refresh token for a fresh JWT. Returns the outcome so the
 * caller can tell "session ended" apart from "could not renew right now" —
 * only the former should ever sign a user out.
 *
 * Pass `force` when a request already failed for auth reasons: the token may not
 * look stale locally yet still be rejected (e.g. after a signing-key rotation).
 */
export async function renewSession(force = false): Promise<RefreshOutcome | null> {
  if (!authState.isAuthenticated || !authState.refreshToken) return null;
  if (!force && !isAuthTokenStale(authState.token)) return null;

  const outcome = await refreshAuthSession();
  if (outcome.status === 'refreshed') {
    authState.token = outcome.token;
    authState.refreshToken = outcome.refreshToken ?? authState.refreshToken;
    persistSession();
  }
  return outcome;
}

export function initAuth() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.user && data.token) {
        const isAdmin = isSuperAdminEmail(data.user.email);
        const isTester = isTesterEmail(data.user.email);
        if (isAdmin) {
          data.user.isSubscribed = true;
          data.user.isAdmin = true;
          data.user.subscriptionTier = 'master';
          data.user.hasMasterPass = true;
        } else if (isTester) {
          // The tester trial is decided SERVER-side from the device-bound access
          // code, so a restored session carries whatever the server last said —
          // no local fallback may ever mint access for a shared tester login.
          data.user.isTester = true;
          const now = Date.now();
          const exp = data.user.subscriptionExpiresAt;
          data.user.isSubscribed = !!data.user.hasMasterPass && (!exp || now <= exp);
          data.user.hasMasterPass = data.user.isSubscribed;
        } else {
          // Check if subscription has expired for normal users
          const now = Date.now();
          const isExp = data.user.subscriptionExpiresAt && data.user.subscriptionExpiresAt < now;
          if (isExp) {
            data.user.isSubscribed = false;
          }
        }

        authState.isAuthenticated = true;
        authState.user = data.user;
        authState.token = data.token;
        authState.refreshToken = typeof data.refreshToken === 'string' ? data.refreshToken : null;
        setAuthTokens({ token: data.token, refreshToken: authState.refreshToken });
        startSessionMaintenance();
        // Re-sync access flags from the server in the background so webhook
        // upgrades / trial expiry are reflected without a full reload.
        void refreshAccess();
      }
    }
  } catch (e) {
    console.error('Failed to restore auth session:', e);
  } finally {
    authState.isLoading = false;
  }
}

export function setAuthenticated(user: UserSession, token: string, refreshToken?: string | null) {
  const isAdmin = isSuperAdminEmail(user.email);
  const isTester = isTesterEmail(user.email);
  if (isAdmin) {
    user.isSubscribed = true;
    user.isAdmin = true;
    user.subscriptionTier = 'master';
    user.hasMasterPass = true;
  } else if (isTester) {
    user.isTester = true;
    // Server truth only: the trial lives on the device-bound access code and is
    // resolved by `deriveAccess`. A tester with no code, no session, a revoked
    // code or an expired window gets NO Master Pass here either.
    const exp = user.subscriptionExpiresAt;
    const serverActive = !!user.hasMasterPass && (!exp || Date.now() <= exp);
    user.isSubscribed = serverActive;
    user.hasMasterPass = serverActive;
  }

  authState.isAuthenticated = true;
  authState.user = user;
  authState.token = token;
  authState.refreshToken = refreshToken ?? getAuthRefreshToken();
  authState.isLoading = false;
  setAuthTokens({ token, refreshToken: authState.refreshToken });
  persistSession();
  startSessionMaintenance();
}

// Re-sync subscription/access flags from the server (Convex `users:me`). This
// reflects webhook-driven upgrades (e.g. a Flutterwave payment completing on
// another device) without a full reload. Non-blocking and silently ignored when
// the session token is emulated/expired.
export async function refreshAccess(): Promise<void> {
  if (!authState.isAuthenticated || !authState.user || !authState.token) return;
  if (typeof window === 'undefined') return;
  try {
    applyServerAccess(await queryConvex<any>(api.users.me, {}));
  } catch (err: any) {
    const msg = String(err?.message || err);
    // A lapsed JWT is an ORDINARY event — they last one hour — and never a
    // reason to sign the user out. When the server says the identity could not
    // be established, mint a fresh token from the refresh token and retry once.
    //
    // This replaces the old behaviour of calling setUnauthenticated() here,
    // which is what silently logged everyone out roughly an hour after login.
    if (/Could not verify|invalid token claim|token expired|TokenExpired|Not signed in/i.test(msg)) {
      const outcome = await renewSession(true);
      if (outcome?.status === 'refreshed') {
        try {
          applyServerAccess(await queryConvex<any>(api.users.me, {}));
        } catch (retryErr: any) {
          console.warn('refreshAccess retry skipped:', retryErr?.message || retryErr);
        }
        return;
      }
      if (outcome?.status === 'invalid') {
        // The server rejected the refresh token itself: the session is genuinely
        // over (revoked or past its 30-day inactivity window).
        console.warn('refreshAccess: session rejected by the server — signing out.');
        setUnauthenticated();
        return;
      }
      console.warn('refreshAccess: could not renew the token right now; keeping the session.');
      return;
    }
    console.warn('refreshAccess skipped:', msg);
  }
}

// Merge the server's authoritative access flags into the local session. Server
// truth wins (webhook upgrades, trial expiry) while local-only fields the server
// does not own (txRef) are preserved.
function applyServerAccess(me: any): void {
  if (!me || !me.email || !authState.user) return;
  const isTester = !!me.isTester;
  const user: UserSession = {
    ...authState.user,
    email: me.email,
    fullName: me.name || authState.user.fullName,
    isAdmin: !!me.isAdmin,
    isTester,
    isSubscribed: !!me.isSubscribed,
    subscriptionExpiresAt: me.subscriptionExpiresAt ?? me.trialExpiresAt,
    subscriptionTier: me.subscriptionTier || authState.user.subscriptionTier,
    hasMasterPass: !!me.hasMasterPass,
    testerCode: isTester ? (me.testerCode ?? authState.user.testerCode) : undefined,
    testerReason: isTester ? me.testerReason : undefined,
    txRef: authState.user.txRef
  };
  authState.isAuthenticated = true;
  authState.user = user;
  persistSession();
}

/**
 * Live trial state for the signed-in tester, derived from the server-owned
 * window. Returns null for non-tester sessions so the UI can simply skip it.
 */
export function testerTrialState(user?: UserSession | null): {
  isTester: boolean;
  code?: string;
  expiresAt?: number;
  daysLeft: number | null;
  active: boolean;
  reason?: UserSession['testerReason'];
} | null {
  if (!user || !isTesterEmail(user.email)) return null;
  const expiresAt = user.subscriptionExpiresAt;
  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 86_400_000))
    : null;
  return {
    isTester: true,
    code: user.testerCode,
    expiresAt,
    daysLeft,
    active: !!user.hasMasterPass && (!expiresAt || Date.now() <= expiresAt),
    reason: user.testerReason
  };
}

/**
 * Ask the server for the tester's live session state. Returns the state, or
 * null when the caller is not a tester. Used to drive the countdown badge and
 * to detect the moment a trial lapses (the server then reports inactive).
 */
export async function fetchTesterSession(): Promise<any | null> {
  if (!authState.isAuthenticated || !authState.user || !authState.token) return null;
  if (!isTesterEmail(authState.user.email)) return null;
  try {
    return await queryConvex<any>(api.testerCodes.mySession, {});
  } catch (err: any) {
    console.warn('tester session lookup skipped:', err?.message || err);
    return null;
  }
}

export function setSubscribedStatus(isSubscribed: boolean, txRef?: string, tier?: 'punter' | 'master') {
  if (!authState.user) return;
  const isAdmin = isSuperAdminEmail(authState.user.email);
  const isTester = isTesterEmail(authState.user.email);

  // A tester's window is owned by the server (their access code), so a payment
  // callback must never overwrite it with a fresh 30-day period.
  if (isTester && !isAdmin) {
    authState.user = { ...authState.user, txRef: txRef ?? authState.user.txRef };
    persistSession();
    return;
  }

  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  const effectiveTier: 'punter' | 'master' | undefined =
    isAdmin ? 'master' : tier ?? authState.user.subscriptionTier ?? 'punter';

  authState.user = {
    ...authState.user,
    isSubscribed: isAdmin || isSubscribed,
    isAdmin: isAdmin || authState.user.isAdmin,
    isTester: isAdmin ? false : authState.user.isTester,
    subscriptionExpiresAt: isAdmin ? undefined : expiresAt,
    subscriptionTier: effectiveTier,
    hasMasterPass: isAdmin || (isSubscribed && effectiveTier === 'master'),
    txRef: txRef ?? authState.user.txRef
  };

  persistSession();
}

export function setUnauthenticated() {
  authState.isAuthenticated = false;
  authState.user = null;
  authState.token = null;
  authState.refreshToken = null;
  authState.isLoading = false;
  stopSessionMaintenance();
  // Also drop the refresh token, otherwise a later background call could
  // silently restore the session the user just ended.
  clearConvexAuthTokens();
  persistSession();
}

// The AI Predictor is a Master Pass feature. `hasMasterPass` is the SERVER's
// verdict (admin, active code-bound tester trial, or master subscriber) — the
// client never grants itself access.
export function canAccessPredictor(user?: UserSession | null): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (user.hasMasterPass) {
    const exp = user.subscriptionExpiresAt;
    return !exp || Date.now() <= exp;
  }
  return false;
}
