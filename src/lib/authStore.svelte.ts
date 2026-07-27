const AUTH_STORAGE_KEY = 'pulseodds_auth_session_v1';

export interface UserSession {
  id: string;
  email: string;
  name?: string;
  createdAt?: number;
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

