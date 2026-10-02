export type ConvexSportId =
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'rally'
  | 'hockey'
  | 'instant-football'
  | 'instant-basketball'
  | 'vfootball'
  | 'baseball'
  | 'rugby'
  | 'cricket'
  | 'mma'
  | 'volleyball';

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

const DEFAULT_URL = 'https://gallant-minnow-735.eu-west-1.convex.cloud';

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

/**
 * The user-facing message for a thrown Convex error.
 *
 * Why this exists: Convex redacts plain `Error` messages on PRODUCTION
 * deployments — the client only ever sees "[Request ID: …] Server Error". A
 * backend that wants its rules READ (paywall notices, "this tester code is
 * already active on another device", validation failures) must throw a
 * `ConvexError`, whose payload arrives here as `error.data`. This unwraps that
 * payload, falls back to `message` for anything else, and strips the transport
 * decoration so the UI never shows a Request ID to a user.
 */
export function convexErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const anyErr = err as { data?: unknown; message?: unknown } | null;
  const data = anyErr?.data;
  let msg = '';
  if (typeof data === 'string') msg = data;
  else if (data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string') {
    msg = (data as { message: string }).message;
  } else if (typeof anyErr?.message === 'string') {
    msg = anyErr.message;
  }
  msg = msg.replace(/^\[Request ID: [^\]]+\]\s*/i, '').trim();
  // Convex surfaces "plan limits exceeded / disabled" in several shapes: the
  // CLI shows the plain reason, the HTTP transport redacts it to "Server
  // Error". When the raw text names the condition directly, translate it.
  const planDisabled =
    /free plan limits|deployments? (?:have|has) been disabled|exceeded the (?:free )?plan|please upgrade to a pro plan|account.*paused|team.*paused/i;
  if (planDisabled.test(msg)) {
    return 'The AI backend is temporarily offline (free hosting limits reached). Login and live data will resume once hosting resets — nothing is wrong with your credentials.';
  }
  if (!msg || /^server error$/i.test(msg)) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return 'You appear to be offline. Reconnect and try again.';
    }
    return fallback;
  }
  return msg;
}

// Realtime (WebSocket) Convex client — powers live query subscriptions. It is
// created lazily on first subscribe and kept alongside the one-shot HTTP client.
type AuthTokenArgs = { forceRefreshToken: boolean };
type AuthTokenFetcher = (args: AuthTokenArgs) => Promise<string | null | undefined>;

type RealtimeClientLike = {
  // The WebSocket client supports the callback form and re-invokes it with
  // `forceRefreshToken: true` whenever a request is rejected for auth reasons.
  setAuth: (fetchToken: string | AuthTokenFetcher, onChange?: () => void) => void;
  onUpdate: (
    query: string,
    args: any,
    callback: (result: any) => void,
    onError?: (err?: any) => void
  ) => (() => void) & { getCurrentValue?: () => any };
  close?: () => void;
};

let cachedClient: HttpClientLike | null = null;
let cachedUrl: string | null = null;

// The live JWT is short-lived (Convex Auth issues a 1-hour token) while the
// refresh token lives for the session's full 30-day duration. BOTH must be kept:
// without the refresh token every session silently ended an hour after login.
let pendingAuthToken: string | null = null;
let pendingRefreshToken: string | null = null;

let realtimeClient: RealtimeClientLike | null = null;

async function getRealtimeClient(): Promise<RealtimeClientLike> {
  if (realtimeClient) return realtimeClient;
  const mod = await import('convex/browser');
  realtimeClient = new mod.ConvexClient(getConvexUrl()) as RealtimeClientLike;
  realtimeClient.setAuth(realtimeFetchToken, () => {});
  return realtimeClient;
}

// Subscribe to a live Convex query. Resolves to an unsubscribe function. The
// WebSocket client auto-reconnects, but a transient query failure must not kill
// the live subscription silently: we retry with 1s/2s/4s backoff (up to 3
// attempts) before giving up, keeping the UI in sync with the backend.
export async function subscribeConvexQuery<Result = any>(
  name: string,
  args: any,
  onChange: (result: Result | null) => void,
  onError?: (err: unknown) => void
): Promise<() => void> {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  let retries = 0;
  const MAX_RETRIES = 3;

  const cleanup = () => {
    if (unsub && typeof unsub === 'function') {
      try {
        unsub();
      } catch {
        /* already dead */
      }
      unsub = null;
    }
  };

  const trySubscribe = async () => {
    if (cancelled) return;
    try {
      const client = await getRealtimeClient();
      if (cancelled) return;
      unsub = client.onUpdate(name, args, onChange, (err) => {
        const msg = (err as any)?.message || err;
        console.warn(`[Convex] realtime query '${name}' failed:`, msg);
        onError?.(err);
        if (!cancelled && retries < MAX_RETRIES) {
          retries += 1;
          const delay = 1000 * 2 ** (retries - 1);
          cleanup();
          setTimeout(() => void trySubscribe(), delay);
        }
      });
    } catch (err) {
      const msg = (err as any)?.message || err;
      console.warn('[Convex] realtime client unavailable:', msg);
      onError?.(err);
    }
  };

  await trySubscribe();
  return () => {
    cancelled = true;
    cleanup();
  };
}

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

// Push the current token onto the HTTP client. `ConvexHttpClient` only accepts a
// PLAIN STRING (it interpolates `Bearer ${auth}` straight into the header), so
// the HTTP path relies on `ensureFreshAuthToken()` instead of a callback.
function applyHttpAuth() {
  if (!cachedClient) return;
  if (pendingAuthToken) cachedClient.setAuth(pendingAuthToken);
  else cachedClient.clearAuth();
}

// Called by the WebSocket client both initially and on auth rejection.
async function realtimeFetchToken(args: AuthTokenArgs): Promise<string | null | undefined> {
  // Forced (the server just rejected us) or simply stale (the socket would
  // otherwise connect anonymously): renew before handing a token over.
  const needsRenewal = args?.forceRefreshToken || isAuthTokenStale(pendingAuthToken);
  if (needsRenewal && pendingRefreshToken) {
    const outcome = await refreshAuthSession();
    if (outcome.status === 'refreshed') return outcome.token;
  }
  return pendingAuthToken;
}

/**
 * Store the session's tokens. Pass `undefined` for a field to leave it as-is,
 * so clearing the JWT does not also discard the refresh token.
 */
export function setAuthTokens(tokens: { token?: string | null; refreshToken?: string | null }) {
  if ('token' in tokens) pendingAuthToken = isRealConvexToken(tokens.token) ? tokens.token : null;
  if ('refreshToken' in tokens) pendingRefreshToken = tokens.refreshToken ?? null;
  applyHttpAuth();
  if (realtimeClient) realtimeClient.setAuth(realtimeFetchToken, () => {});
}

export function getAuthRefreshToken(): string | null {
  return pendingRefreshToken;
}

/** Decode a JWT's `exp` claim (ms since epoch), or null when unreadable. */
export function jwtExpiresAt(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // Browser-only: on the server (no atob) report "unreadable" rather than
    // guessing, which leaves the caller's opaque-token fallback in charge.
    if (typeof atob !== 'function') return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(padded);
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch (_) {
    return null;
  }
}

// Renew a little before the token actually dies so an in-flight request can
// never race the expiry.
const AUTH_REFRESH_MARGIN_MS = 2 * 60 * 1000;

export function isAuthTokenStale(token: string | null | undefined): boolean {
  if (!token) return true;
  const exp = jwtExpiresAt(token);
  if (exp === null) return false; // opaque token: cannot judge, assume usable
  return Date.now() >= exp - AUTH_REFRESH_MARGIN_MS;
}

export type RefreshOutcome =
  | { status: 'refreshed'; token: string; refreshToken: string | null }
  // No refresh token, or a transport/network failure: the session may still be
  // perfectly valid, so callers must NOT sign the user out.
  | { status: 'unavailable' }
  // The server rejected the refresh token: the session really is over.
  | { status: 'invalid' };

let refreshInFlight: Promise<RefreshOutcome> | null = null;

/**
 * Mint a fresh JWT from the stored refresh token. Convex Auth's `signIn` action
 * accepts `{ refreshToken }` and returns a new token pair, which is exactly how
 * the official client keeps a session alive past the 1-hour JWT lifetime.
 *
 * The current (expired / unverifiable) JWT is detached first: Convex rejects the
 * WHOLE request with "Could not verify OIDC token claim" when an unverifiable
 * token rides along in the Authorization header — including on `auth:signIn`.
 */
export async function refreshAuthSession(): Promise<RefreshOutcome> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async (): Promise<RefreshOutcome> => {
    try {
      const refreshToken = pendingRefreshToken;
      if (!refreshToken) return { status: 'unavailable' };

      const previousToken = pendingAuthToken;
      pendingAuthToken = null;
      applyHttpAuth();

      try {
        const client = await getConvexClient();
        const res: any = await client.action(api.auth.signIn, { refreshToken });
        const tokens = res?.tokens ?? res?.signedIn?.tokens;
        const token = typeof tokens?.token === 'string' ? tokens.token : null;

        if (!token) {
          pendingAuthToken = previousToken;
          applyHttpAuth();
          return { status: 'invalid' };
        }

        const nextRefreshToken =
          typeof tokens?.refreshToken === 'string' ? tokens.refreshToken : refreshToken;
        setAuthTokens({ token, refreshToken: nextRefreshToken });
        return { status: 'refreshed', token, refreshToken: nextRefreshToken };
      } catch (err: any) {
        pendingAuthToken = previousToken;
        applyHttpAuth();
        const msg = String(err?.message ?? err);
        // Only treat this as a dead session when the SERVER judged the refresh
        // token; a network blip or an offline device must never end a session.
        const rejected = /refresh token|refreshtoken|not found|cannot parse|invalid/i.test(msg);
        if (rejected) {
          console.warn('[Convex] refresh token rejected — session ended:', msg);
          return { status: 'invalid' };
        }
        console.warn('[Convex] auth refresh unavailable (keeping session):', msg);
        return { status: 'unavailable' };
      }
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/**
 * Guarantee a usable JWT before an authenticated call. A no-op when nothing is
 * stale, so this adds no latency in the common case.
 */
export async function ensureFreshAuthToken(): Promise<void> {
  if (!pendingRefreshToken) return;
  if (!isAuthTokenStale(pendingAuthToken)) return;
  await refreshAuthSession();
}

export function setConvexAuthToken(token: string | null | undefined) {
  setAuthTokens({ token });
}

export function clearConvexAuthToken() {
  setAuthTokens({ token: null });
}

// Full sign-out: drop the refresh token too, so no later call can resurrect the
// session the user explicitly ended.
export function clearConvexAuthTokens() {
  setAuthTokens({ token: null, refreshToken: null });
}

export async function callConvex<Ret = any>(name: string, args: any = {}): Promise<Ret> {
  await ensureFreshAuthToken();
  const client = await getConvexClient();
  return client.mutation(name, args) as Promise<Ret>;
}

export async function actionConvex<Ret = any>(name: string, args: any = {}): Promise<Ret> {
  await ensureFreshAuthToken();
  const client = await getConvexClient();
  return client.action(name, args) as Promise<Ret>;
}

export async function queryConvex<Ret = any>(name: string, args: any = {}): Promise<Ret> {
  await ensureFreshAuthToken();
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
    checkSubscription: 'users:checkSubscription',
    me: 'users:me',
    syncAccess: 'users:syncAccess',
    verifyFlutterwaveCharge: 'users:verifyFlutterwaveCharge'
  },
  // Tester access codes: admin issues them, testers register against one and
  // activate it on a single device (which starts the 3-month trial clock).
  testerCodes: {
    generate: 'testerCodes:generate',
    revoke: 'testerCodes:revoke',
    restore: 'testerCodes:restore',
    adjust: 'testerCodes:adjust',
    setNotes: 'testerCodes:setNotes',
    revealNin: 'testerCodes:revealNin',
    register: 'testerCodes:register',
    checkCode: 'testerCodes:checkCode',
    testerIdentity: 'testerCodes:testerIdentity',
    activateSession: 'testerCodes:activateSession',
    mySession: 'testerCodes:mySession',
    touchSession: 'testerCodes:touchSession',
    suspend: 'testerCodes:suspend',
    unsuspend: 'testerCodes:unsuspend',
    reactivate: 'testerCodes:reactivate',
    approve: 'testerCodes:approve',
    overview: 'testerCodes:overview'
  },
  usage: {
    beat: 'usage:beat',
    online: 'usage:online'
  },
  predictor: {
    getDay: 'predictor:getDay',
    listMatches: 'predictor:listMatches',
    listMatchesInRange: 'predictor:listMatchesInRange',
    listDaysInRange: 'predictor:listDaysInRange',
    getVerdict: 'predictor:getVerdict',
    // getDailyPnlSummary: settlement is derived client-side from the live
    // matches subscription (server rows power post-match grading only).
    getActiveRun: 'predictor:getActiveRun',
    startRefresh: 'predictor:startRefresh',
    updateMatchResult: 'predictor:updateMatchResult',
    bootstrapToday: 'predictor:bootstrapToday'
  },
  predictorOrchestrator: {
    runRefresh: 'predictorOrchestrator:runRefresh'
  },
  // Persisted AI-performance data bank (admin dashboard).
  predictorStats: {
    getSnapshot: 'predictorStats:getSnapshot',
    getHistory: 'predictorStats:getHistory',
    requestRecompute: 'predictorStats:requestRecompute'
  },
  betSlips: {
    createSlip: 'betSlips:createSlip',
    updateSlip: 'betSlips:updateSlip',
    listSlips: 'betSlips:listSlips',
    getSlipById: 'betSlips:getSlipById',
    deleteSlip: 'betSlips:deleteSlip'
  },
  predictorOps: {
    purgeMalformedMatches: 'predictor:purgeMalformedMatches',
    purgeWrongSportMatches: 'predictor:purgeWrongSportMatches'
  },
  // Emergency storage drain (admin): schedules bounded purge passes so the
  // free-plan deployment never fills up while unattended.
  retention: {
    runAggressivePurge: 'retention:runAggressivePurge'
  },
  scores: {
    triggerScoreSync: 'scores:triggerScoreSync',
    getPredictorTotals: 'scores:getPredictorTotals'
  },
  presence: {
    // NOTE: the Convex function names are `update` / `list` — the previous
    // `presence:updatePresence` / `presence:listPresence` paths did not exist,
    // so every presence call silently failed against "function not found".
    update: 'presence:update',
    list: 'presence:list'
  },
  audit: {
    log: 'auditLog:logAudit'
  },
  push: {
    saveSubscription: 'pushSubscriptions:saveSubscription',
    removeSubscription: 'pushSubscriptions:removeSubscription',
    setEnabled: 'pushSubscriptions:setEnabled'
  },
  email: {
    requestPasswordReset: 'email:requestPasswordReset',
    completePasswordReset: 'email:completePasswordReset'
  },
  flags: {
    list: 'featureFlags:listFlags'
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
}): Promise<{ token: string; refreshToken: string | null; subject: string | null } | null> {
  try {
    const client = await getConvexClient();
    // A persisted-but-invalid JWT is auto-attached to EVERY call — including
    // this one — and the server rejects the whole auth action ("Could not
    // verify OIDC token claim"). Sign-in must always start clean: drop any
    // stale token before the action, for both the as-typed and lowercase
    // attempts.
    clearConvexAuthToken();
    const res: any = await client.action(api.auth.signIn, {
      provider: 'password',
      params: { flow: opts.flow, email: opts.email, password: opts.password }
    });
    // The auth action returns `tokens` as an object ({ token, refreshToken })
    // nested under either `res.tokens` or `res.signedIn.tokens`. Cover both, plus
    // the legacy `[{name,value}]` array form, so sign-in never depends on a
    // specific backend shape.
    const tok = res?.tokens?.token ?? res?.signedIn?.tokens?.token;
    let authToken: string | undefined = typeof tok === 'string' ? tok : undefined;
    if (!authToken && Array.isArray(res?.tokens)) {
      const arr = res.tokens as any[];
      authToken = arr.find((t) => t?.name === 'auth')?.value ?? arr[0]?.value;
    }
    if (authToken) {
      // Keep the refresh token: it is what lets the session outlive the 1-hour
      // JWT instead of silently signing the user out once an hour.
      const refreshToken =
        typeof res?.tokens?.refreshToken === 'string' ? res.tokens.refreshToken
          : typeof res?.signedIn?.tokens?.refreshToken === 'string' ? res.signedIn.tokens.refreshToken
            : null;
      setAuthTokens({ token: authToken, refreshToken });
      return {
        token: authToken,
        refreshToken,
        subject: res?.signedIn?.userId ?? res?.userId ?? null
      };
    }
    return null;
  } catch (err: any) {
    console.warn('[Convex] auth:signIn failed:', err?.message || err);
    return null;
  }
}

export async function convexSignOut(): Promise<void> {
  try {
    const client = await getConvexClient();
    await client.action(api.auth.signOut, {});
  } catch (_) { /* ignore */ }
  // Drop the refresh token as well, otherwise a later request could silently
  // restore the session the user just ended.
  clearConvexAuthTokens();
}
