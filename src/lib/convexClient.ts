export type ConvexSportId =
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'rally'
  | 'hockey'
  | 'instant-football'
  | 'instant-basketball'
  | 'vfootball'
  | 'baseball';

export type Id<T extends string> = string & { __convexId: T };

export interface SavedScreenerDoc {
  _id: Id<'savedScreeners'>;
  sportId: ConvexSportId;
  title: string;
  notes?: string;
  scopes: any;
  verdict?: {
    headline: string;
    chips: { label: string; value: string; status: 'green' | 'amber' | 'red' | 'empty' }[];
    masterLedger?: any;
    aiInsights?: any;
    topPick?: {
      marketId: string;
      marketTitle: string;
      label: string;
      probability: number;
      odds: number;
      ev?: number;
    };
  };
  sessionId: string;
  createdAt: number;
  updatedAt: number;
}

const SESSION_KEY = 'sportsScreener_sessionId_v1';

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'anonymous-static';
  let id: string | null = '';
  try { id = localStorage.getItem(SESSION_KEY); } catch (_) { id = null; }
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem(SESSION_KEY, id); } catch (_) { /* ignore */ }
  }
  return id;
}

const DEFAULT_URL = 'https://modest-lark-218.eu-west-1.convex.cloud';

export function getConvexUrl(): string {
  try {
    const meta = (import.meta as unknown as { env?: Record<string, string | undefined> });
    if (meta?.env?.PUBLIC_CONVEX_URL) return meta.env.PUBLIC_CONVEX_URL;
    const viteEnv = (globalThis as any)?.import_meta_env;
    if (viteEnv?.PUBLIC_CONVEX_URL) return viteEnv.PUBLIC_CONVEX_URL;
  } catch (_) { /* SSR safe — ignore */ }
  return DEFAULT_URL;
}

type HttpClientLike = {
  query: (name: string, args: any) => Promise<any>;
  mutation: (name: string, args: any) => Promise<any>;
  action: (name: string, args: any) => Promise<any>;
  setAuth: (token: string) => void;
  clearAuth: () => void;
};

let cachedClient: HttpClientLike | null = null;
let cachedUrl: string | null = null;
let pendingAuthToken: string | null = null;

export async function getConvexClient(): Promise<HttpClientLike> {
  const url = getConvexUrl();
  if (cachedClient && cachedUrl === url) return cachedClient;
  const mod = await import('convex/browser');
  cachedUrl = url;
  cachedClient = new mod.ConvexHttpClient(url) as HttpClientLike;
  if (pendingAuthToken) cachedClient.setAuth(pendingAuthToken);
  return cachedClient;
}

// Attach (or clear) the Convex auth token on the shared client. This is what
// lets the backend see `ctx.auth.getUserIdentity()` on subsequent calls.
// Only real Convex JWTs are attached — the legacy emulated sessions use fake
// `token_...` strings, and sending those would 401 every anonymous call.
function isRealConvexToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && token.length > 40 && !token.startsWith('token_');
}

export function setConvexAuthToken(token: string | null | undefined) {
  const real = isRealConvexToken(token) ? token : null;
  pendingAuthToken = real;
  if (cachedClient) {
    if (real) cachedClient.setAuth(real);
    else cachedClient.clearAuth();
  }
}

export function clearConvexAuthToken() {
  setConvexAuthToken(null);
}

export async function callConvex<Ret = any>(name: string, args: any = {}): Promise<Ret> {
  const client = await getConvexClient();
  return client.mutation(name, args) as Promise<Ret>;
}

export async function queryConvex<Ret = any>(name: string, args: any = {}): Promise<Ret> {
  const client = await getConvexClient();
  return client.query(name, args) as Promise<Ret>;
}

export const api = {
  auth: {
    signIn: 'auth:signIn',
    signOut: 'auth:signOut'
  },
  drafts: {
    get: 'drafts:get',
    save: 'drafts:save',
    remove: 'drafts:remove'
  },
  savedScreeners: {
    list: 'savedScreeners:list',
    get: 'savedScreeners:get',
    save: 'savedScreeners:save',
    update: 'savedScreeners:update',
    remove: 'savedScreeners:remove'
  },
  users: {
    registerProfile: 'users:registerProfile',
    getProfile: 'users:getProfile',
    markSubscribed: 'users:markSubscribed',
    checkSubscription: 'users:checkSubscription'
  }
};

export interface DraftDoc {
  _id: Id<'drafts'>;
  owner: string;
  sessionId: string;
  userId?: string;
  sportId: ConvexSportId;
  scopes: any;
  updatedAt: number;
}

// Authenticated Convex signIn/signOut helpers (Password provider).
export async function convexSignIn(opts: {
  email: string;
  password: string;
  flow: 'signIn' | 'signUp';
}): Promise<{ token: string; subject: string | null } | null> {
  try {
    const client = await getConvexClient();
    const res: any = await client.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: opts.flow, email: opts.email, password: opts.password }
    });
    const tokens: any[] = Array.isArray(res?.tokens) ? res.tokens : [];
    const authToken = tokens.find((t) => t?.name === 'auth')?.value ?? tokens[0]?.value;
    if (authToken) {
      setConvexAuthToken(authToken);
      return { token: authToken, subject: res?.signedIn?.user?.subject ?? null };
    }
    return null;
  } catch (err: any) {
    console.warn('[Convex] auth:signIn failed, falling back to local session:', err?.message || err);
    return null;
  }
}

export async function convexSignOut(): Promise<void> {
  try {
    const client = await getConvexClient();
    await client.action(api.auth.signOut, {});
  } catch (_) { /* ignore */ }
  clearConvexAuthToken();
}
