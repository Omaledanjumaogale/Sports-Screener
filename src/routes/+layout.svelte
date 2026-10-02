<script lang="ts">
  import '@fontsource-variable/outfit';
  import '@fontsource/space-grotesk/500.css';
  import '@fontsource/space-grotesk/700.css';
  import '@fontsource/jetbrains-mono/400.css';
  import '@fontsource/jetbrains-mono/700.css';
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authState, initAuth, setUnauthenticated, fetchTesterSession, isTesterEmail } from '$lib/authStore.svelte';
  import { notify } from '$lib/notificationStore';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { api, callConvex, getSessionId } from '$lib/convexClient';
  import NotificationToast from '$lib/components/NotificationToast.svelte';

  // Svelte 5: accept children snippet for rendering child pages
  let { children } = $props();

  onMount(() => {
    initAuth();
  });

  // ── Usage heartbeat (admin console: logins, time spent, online state) ──────
  // One beat on mount, then every 60s while the tab is open. `usage.beat`
  // accumulates FOREGROUND time per identity (idle gaps are discarded server
  // side) and resolves the account + tester code from the auth token, which is
  // what lets the admin console show "who is online" and "how long they used
  // the app" — neither of which was being recorded before.
  //
  // Tester sessions additionally ping `touchSession`, which keeps their
  // `lastSeenAt` fresh so the console's green dot is accurate.
  $effect(() => {
    if (!browser) return;
    // Track the reactive inputs so a login/logout restarts the heartbeat.
    const signedIn = authState.isAuthenticated;
    const isTester = !!authState.user && isTesterEmail(authState.user.email);
    let stopped = false;
    const beat = async () => {
      if (stopped) return;
      try {
        await callConvex(api.usage.beat, { sessionId: getSessionId() });
      } catch (_) {
        /* best-effort — never block the UI on telemetry */
      }
      if (!signedIn || !isTester) return;
      try {
        await callConvex(api.testerCodes.touchSession, {});
      } catch (_) {
        /* best-effort */
      }
    };
    void beat();
    const timer = setInterval(() => void beat(), 60_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  });

  // ── Tester trial enforcement ────────────────────────────────────────────
  // A tester holds Master Pass only while their device-bound access code is
  // live. This watcher catches the moment the server says the window has
  // closed (expired or revoked) and ends the session with a subscription
  // prompt, instead of letting requests fail one by one.
  $effect(() => {
    if (!browser) return;
    const user = authState.user;
    if (!authState.isAuthenticated || !user || !isTesterEmail(user.email)) return;

    let stopped = false;
    const check = async () => {
      if (stopped) return;
      const session = await fetchTesterSession();
      if (stopped || !session || session.active) return;
      stopped = true;
      setUnauthenticated();
      const suspended = session.reason === 'suspended';
      notify(
        session.reason === 'expired'
          ? 'Your 3-month free tester trial has ended. Subscribe to keep using the AI Predictor and screeners.'
          : suspended
            ? 'Your tester access code is suspended. Please contact the administrator — it can be re-activated.'
            : 'Your tester access has been ended. Please contact the administrator or subscribe.',
        'warning',
        session.reason === 'expired' ? 'Free Trial Ended' : suspended ? 'Tester Access Suspended' : 'Tester Access Ended',
        10000
      );
      // An expired trial is a payment prompt; a suspension is an admin matter.
      if (!suspended) void goto('/checkout');
    };

    void check();
    const timer = setInterval(() => void check(), 5 * 60_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  });

  // Auth guard — runs only in the browser, never during SSR pre-rendering
  $effect(() => {
    if (!browser) return;

    const publicPaths = ['/', '/auth', '/checkout', '/tester'];
    if (!publicPaths.includes($page.url.pathname) && !authState.isLoading) {
      if (!authState.isAuthenticated) {
        // Re-check storage synchronously before bouncing: a just-completed
        // login (or an in-flight store propagation) can briefly show an empty
        // reactive user while the persisted session is perfectly valid.
        let hasStoredSession = false;
        try {
          hasStoredSession = !!localStorage.getItem('pulseodds_auth_session_v1');
        } catch (_) {
          hasStoredSession = false;
        }
        if (!hasStoredSession) {
          goto('/auth?mode=signup&redirect=checkout');
        }
      }
    }
  });
</script>

<div class="app-root">
  <NotificationToast />
  {#if !authState.isLoading || ['/', '/auth', '/checkout'].includes($page.url.pathname)}
    {@render children()}
  {:else}
    <div class="loading-screen">
      <div class="spinner"></div>
    </div>
  {/if}
</div>

<style>
  :global(html), :global(body) {
    background: var(--c-bg, #060912);
    color: var(--c-text, #f1f5ff);
    font-family: var(--font-brand, 'Outfit', system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    -webkit-tap-highlight-color: transparent;
  }
  :global(:focus-visible) {
    outline: 2px solid var(--c-indigo, #22d3ee);
    outline-offset: 2px;
    border-radius: 6px;
  }
  :global(select), :global(button), :global(input), :global(textarea) {
    font-family: var(--font-brand, 'Outfit', system-ui, sans-serif);
  }
  :global(button) { cursor: pointer; }
  :global(*), :global(*::before), :global(*::after) { box-sizing: border-box; }
  .app-root { min-height: 100dvh; }

  .loading-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100dvh;
    background: var(--c-bg);
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid color-mix(in srgb, var(--c-orange, #fb923c) 20%, transparent);
    border-top-color: var(--c-orange, #fb923c);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
