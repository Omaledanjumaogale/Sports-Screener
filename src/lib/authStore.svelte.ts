const AUTH_STORAGE_KEY = 'pulseodds_auth_session_v1';
export const SUPER_ADMIN_EMAIL = 'omaledanjumaogale@gmail.com';
export const TESTER_EMAIL = 'tester@gmail.com';
export const TESTER_PASSWORD = 'Share&getbloacked#';
const TESTER_TRIAL_START_KEY = 'pulseodds_tester_trial_start_v1';

import { setConvexAuthToken, clearConvexAuthToken } from './convexClient';

export function isSuperAdminEmail(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SUPER_ADMIN_EMAIL;
}

export function isTesterEmail(email?: string): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === TESTER_EMAIL;
}

export function getTesterTrialExpiresAt(): number {
  if (typeof window === 'undefined') return Date.now() + 30 * 24 * 60 * 60 * 1000;
  let start = 0;
  try {
    const raw = localStorage.getItem(TESTER_TRIAL_START_KEY);
    if (raw) start = parseInt(raw, 10);
    if (!start || isNaN(start)) {
      start = Date.now();
      localStorage.setItem(TESTER_TRIAL_START_KEY, start.toString());
    }
  } catch (_) {
    start = Date.now();
  }
  return start + 30 * 24 * 60 * 60 * 1000; // 1 month (30 days)
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
  txRef?: string;
}

// Global reactive auth state using Svelte 5 runes
export const authState = $state({
  isAuthenticated: false,
  isLoading: true,
  user: null as UserSession | null,
  token: null as string | null
});

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
        } else if (isTester) {
          const expAt = getTesterTrialExpiresAt();
          const now = Date.now();
          data.user.isTester = true;
          data.user.subscriptionExpiresAt = expAt;
          data.user.isSubscribed = now <= expAt;
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
        setConvexAuthToken(data.token);
      }
    }
  } catch (e) {
    console.error('Failed to restore auth session:', e);
  } finally {
    authState.isLoading = false;
  }
}

export function setAuthenticated(user: UserSession, token: string) {
  const isAdmin = isSuperAdminEmail(user.email);
  const isTester = isTesterEmail(user.email);
  if (isAdmin) {
    user.isSubscribed = true;
    user.isAdmin = true;
  } else if (isTester) {
    const expAt = getTesterTrialExpiresAt();
    const now = Date.now();
    user.isTester = true;
    user.subscriptionExpiresAt = expAt;
    user.isSubscribed = now <= expAt;
  }

  authState.isAuthenticated = true;
  authState.user = user;
  authState.token = token;
  authState.isLoading = false;
  setConvexAuthToken(token);

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user, token }));
    }
  } catch (e) {
    console.error('Failed to store auth session:', e);
  }
}

export function setSubscribedStatus(isSubscribed: boolean, txRef?: string, durationDays = 30) {
  if (!authState.user) return;
  const isAdmin = isSuperAdminEmail(authState.user.email);
  const isTester = isTesterEmail(authState.user.email);
  const now = Date.now();
  const expiresAt = isTester ? getTesterTrialExpiresAt() : (now + durationDays * 24 * 60 * 60 * 1000);

  authState.user = {
    ...authState.user,
    isSubscribed: isAdmin || (isTester ? now <= expiresAt : isSubscribed),
    isAdmin: isAdmin || authState.user.isAdmin,
    isTester: isTester || authState.user.isTester,
    subscriptionExpiresAt: isAdmin ? undefined : expiresAt,
    txRef: txRef ?? authState.user.txRef
  };

  try {
    if (typeof window !== 'undefined' && authState.token) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: authState.user, token: authState.token }));
    }
  } catch (e) {
    console.error('Failed to update subscription in auth session:', e);
  }
}

export function setUnauthenticated() {
  authState.isAuthenticated = false;
  authState.user = null;
  authState.token = null;
  authState.isLoading = false;
  clearConvexAuthToken();
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to clear auth session:', e);
  }
}
