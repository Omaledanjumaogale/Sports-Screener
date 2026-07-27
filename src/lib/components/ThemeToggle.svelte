<script lang="ts">
  import { onMount } from 'svelte';
  import { Sun, Moon } from '@lucide/svelte';
  import { getInitialTheme, applyTheme, toggleTheme, type Theme } from '../theme';

  let currentTheme: Theme = $state('dark');

  onMount(() => {
    currentTheme = getInitialTheme();
    applyTheme(currentTheme);
  });

  function handleToggle() {
    currentTheme = toggleTheme();
  }
</script>

<button
  type="button"
  class="theme-toggle-btn"
  onclick={handleToggle}
  aria-label={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
  title={`Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`}
>
  <div class="icon-wrap" class:is-light={currentTheme === 'light'}>
    {#if currentTheme === 'dark'}
      <Moon size={18} class="moon-icon" />
    {:else}
      <Sun size={18} class="sun-icon" />
    {/if}
  </div>
  <span class="theme-label">{currentTheme === 'dark' ? 'Dark' : 'Light'}</span>
</button>

<style>
  .theme-toggle-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 6px 13px;
    border-radius: 999px;
    background: var(--c-surface-2, rgba(255, 255, 255, 0.08));
    border: 1px solid var(--c-border-2, rgba(255, 255, 255, 0.14));
    color: var(--c-text, #f1f5ff);
    font-size: 12px;
    font-weight: 700;
    font-family: var(--font-brand, 'Outfit', system-ui);
    cursor: pointer;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
    transition:
      background var(--t-base, 180ms ease),
      border-color var(--t-base, 180ms ease),
      color var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease),
      transform 80ms ease;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  .theme-toggle-btn:hover {
    background: color-mix(in srgb, var(--c-orange, #f97316) 14%, var(--c-surface-2));
    border-color: color-mix(in srgb, var(--c-orange, #f97316) 40%, transparent);
    color: var(--c-orange, #f97316);
    box-shadow: 0 0 16px color-mix(in srgb, var(--c-orange, #f97316) 20%, transparent);
  }

  .theme-toggle-btn:active {
    transform: scale(0.94);
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .icon-wrap.is-light {
    transform: rotate(180deg);
  }

  :global(.moon-icon) {
    color: #38bdf8;
    filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.6));
  }

  :global(.sun-icon) {
    color: #f59e0b;
    filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.8));
  }

  .theme-label {
    letter-spacing: 0.02em;
  }
</style>
