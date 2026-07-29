<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authState, initAuth } from '$lib/authStore.svelte';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import NotificationToast from '$lib/components/NotificationToast.svelte';

  // Svelte 5: accept children snippet for rendering child pages
  let { children } = $props();

  onMount(() => {
    initAuth();
  });

  // Auth guard — runs only in the browser, never during SSR pre-rendering
  $effect(() => {
    if (!browser) return;

    const publicPaths = ['/', '/auth', '/checkout'];
    if (!publicPaths.includes($page.url.pathname) && !authState.isLoading) {
      if (!authState.isAuthenticated) {
        goto('/auth?mode=signup&redirect=checkout');
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
    outline: 2px solid var(--c-indigo, #6366f1);
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
    border: 3px solid color-mix(in srgb, var(--c-orange, #f97316) 20%, transparent);
    border-top-color: var(--c-orange, #f97316);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
