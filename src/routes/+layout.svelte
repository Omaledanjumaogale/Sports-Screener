<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { authState, initAuth } from '$lib/authStore.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    initAuth();
  });

  $effect(() => {
    // Add any routes that don't require authentication here
    const publicPaths = ['/', '/auth'];
    
    // Check if current route is protected and auth is resolved
    if (!publicPaths.includes($page.url.pathname) && !authState.isLoading) {
      if (!authState.isAuthenticated) {
        // Not authenticated, redirect to login page
        goto('/auth');
      }
    }
  });
</script>

<div class="app-root">
  {#if !authState.isLoading || ['/', '/auth'].includes($page.url.pathname)}
    <slot />
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
