<script lang="ts">
  import { ArrowLeft, RotateCcw } from '@lucide/svelte';
  import SportSvgIcon from './SportSvgIcon.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  type SportId = 'football' | 'basketball' | 'tennis' | 'rally';

  let {
    title,
    short,
    accent,
    sportId,
    onBack,
    onClear
  }: {
    title: string;
    short: string;
    accent: string;
    sportId?: SportId;
    onBack: () => void;
    onClear: () => void;
  } = $props();
</script>

<header class="topbar" style={`--accent:${accent}`}>
  <button class="icon-btn" aria-label="Back to sports selection" onclick={onBack} type="button">
    <ArrowLeft size={20} stroke-width={2.5} />
  </button>

  <div class="title-block">
    <div class="title-row">
      {#if sportId}
        <span class="sport-icon" aria-hidden="true">
          <SportSvgIcon sport={sportId} size={18} color={accent} />
        </span>
      {/if}
      <span class="eyebrow">{short}</span>
    </div>
    <h1>{title}</h1>
  </div>

  <div class="header-right-actions">
    <ThemeToggle />
    <button class="icon-btn icon-btn--reset" aria-label="Reset all odds" title="Reset all odds" onclick={onClear} type="button">
      <RotateCcw size={18} stroke-width={2.2} />
    </button>
  </div>
</header>

<style>
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    position: sticky;
    top: 0;
    z-index: 50;
    padding: 10px 0 14px;
    background: var(--c-surface-2);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-bottom: 1px solid var(--c-border);
    box-shadow: 0 1px 0 0 color-mix(in srgb, var(--accent) 25%, transparent);
    margin: 0 -2px;
  }

  .header-right-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-block {
    min-width: 0;
    text-align: center;
  }

  .title-row {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 3px;
  }

  .sport-icon {
    display: inline-flex;
    align-items: center;
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--accent) 70%, transparent));
  }

  .eyebrow {
    display: block;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 10.5px;
    font-weight: 800;
    animation: pulse-glow 3s ease-in-out infinite;
  }

  .title-block h1 {
    font-size: clamp(16px, 5vw, 22px);
    margin: 0;
    line-height: 1.15;
    letter-spacing: -0.02em;
    color: var(--c-text);
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-btn {
    width: 46px;
    height: 46px;
    border: 1px solid var(--c-border-md);
    border-radius: 14px;
    background: var(--c-glass-sm);
    backdrop-filter: blur(12px);
    color: var(--c-text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background var(--t-base, 180ms ease),
      border-color var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease),
      transform 80ms ease;
  }

  .icon-btn:hover {
    background: var(--c-glass-hover);
    border-color: var(--c-border-2);
    box-shadow: 0 0 14px var(--c-glass-md);
  }

  .icon-btn--reset:hover {
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    box-shadow: 0 0 14px color-mix(in srgb, var(--accent) 20%, transparent);
    color: var(--accent);
  }

  .icon-btn:active { transform: scale(0.93); }
</style>
