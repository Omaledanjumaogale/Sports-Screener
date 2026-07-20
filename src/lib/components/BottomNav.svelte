<script lang="ts">
  import { page } from '$app/stores';
  import SportSvgIcon from './SportSvgIcon.svelte';

  type SportDef = {
    id: string;
    path: string;
    label: string;
    accent: string;
  };

  const sports: SportDef[] = [
    { id: 'football',   path: '/football',   label: 'Football',   accent: '#22c55e' },
    { id: 'basketball', path: '/basketball', label: 'Basketball', accent: '#f97316' },
    { id: 'tennis',     path: '/tennis',     label: 'Tennis',     accent: '#e879f9' },
    { id: 'rally',      path: '/rally',      label: 'Rally',      accent: '#38bdf8' }
  ];

  function navigate(path: string) {
    if (typeof window !== 'undefined') window.location.assign(path);
  }

  let currentPath = $derived($page.url.pathname);
</script>

<nav class="bottom-nav" aria-label="Sport navigation">
  {#each sports as sport}
    {@const active = currentPath.startsWith(sport.path)}
    <button
      class="nav-item"
      class:active
      style={`--sport-accent: ${sport.accent}`}
      aria-label={`Open ${sport.label} screener`}
      aria-current={active ? 'page' : undefined}
      onclick={() => navigate(sport.path)}
      type="button"
    >
      <span class="nav-icon" aria-hidden="true">
        <SportSvgIcon sport={sport.id as any} size={22} color={active ? sport.accent : 'currentColor'} />
      </span>
      <span class="nav-label">{sport.label}</span>
      {#if active}
        <span class="nav-dot" aria-hidden="true"></span>
      {/if}
    </button>
  {/each}
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 0 8px max(12px, env(safe-area-inset-bottom)) 8px;
    background: rgba(6, 9, 18, 0.82);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    gap: 4px;
    /* Mobile-only: hidden by default, shown via media query */
    display: none;
  }

  @media (min-width: 768px) {
    .bottom-nav { display: none !important; }
  }

  @media (max-width: 767px) {
    .bottom-nav { display: flex; }
  }

  .nav-item {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 10px 4px 6px;
    border: none;
    background: transparent;
    color: var(--c-muted, #8899bb);
    border-radius: 12px;
    transition: color var(--t-base, 180ms ease), background var(--t-base, 180ms ease);
    min-height: 58px;
    cursor: pointer;
  }

  .nav-item:hover {
    color: var(--c-text, #f1f5ff);
    background: rgba(255, 255, 255, 0.05);
  }

  .nav-item.active {
    color: var(--sport-accent);
  }

  .nav-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--t-spring, 280ms cubic-bezier(0.34,1.56,0.64,1));
  }

  .nav-item.active .nav-icon {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 6px var(--sport-accent));
  }

  .nav-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: 1;
    font-family: var(--font-brand, 'Outfit', system-ui);
  }

  .nav-dot {
    position: absolute;
    bottom: 5px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--sport-accent);
    box-shadow: 0 0 6px var(--sport-accent);
    animation: dot-pulse 2s ease-in-out infinite;
  }
</style>
