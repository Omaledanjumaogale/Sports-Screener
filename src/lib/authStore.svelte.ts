const AUTH_STORAGE_KEY = 'pulseodds_auth_session_v1';

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
        // Check if subscription has expired
        const now = Date.now();
        const isExp = data.user.subscriptionExpiresAt && data.user.subscriptionExpiresAt < now;
        if (isExp) {
          data.user.isSubscribed = false;
        }

        authState.isAuthenticated = true;
        authState.user = data.user;
        authState.token = data.token;
      }
    }
  } catch (e) {
    console.error('Failed to restore auth session:', e);
  } finally {
    authState.isLoading = false;
  }
}

export function setAuthenticated(user: UserSession, token: string) {
  authState.isAuthenticated = true;
  authState.user = user;
  authState.token = token;
  authState.isLoading = false;
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
  const now = Date.now();
  const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;

  authState.user = {
    ...authState.user,
    isSubscribed,
    subscriptionExpiresAt: isSubscribed ? expiresAt : undefined,
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
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Failed to clear auth session:', e);
  }
}
