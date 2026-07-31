<script lang="ts">
  import { ChevronRight, Lock } from '@lucide/svelte';
  import SportSvgIcon from './SportSvgIcon.svelte';

  type SportId = 'football' | 'basketball' | 'tennis' | 'rally' | 'hockey' | 'instant-football' | 'instant-basketball' | 'vfootball' | 'baseball';

  const props = $props<{
    sportId?: SportId;
    short: string;
    title: string;
    description: string;
    accent: string;
    onClick?: () => void;
    path?: string;
    icon?: any;
    comingSoon?: boolean;
    emoji?: string;
  }>();
</script>

<button
  class="sport-card"
  class:coming-soon={props.comingSoon}
  style={`--accent:${props.accent}`}
  aria-label={props.comingSoon ? `${props.title} (Coming Soon)` : `Open ${props.title}`}
  type="button"
  disabled={props.comingSoon}
  onclick={() => {
    if (props.comingSoon) return;
    if (typeof props.onClick === 'function') {
      try { props.onClick(); } catch (_) { /* swallow */ }
    } else if (props.path && typeof window !== 'undefined') {
      window.location.assign(props.path);
    }
  }}
>
  <!-- Aurora glow spot -->
  <span class="card-glow" aria-hidden="true"></span>

  <!-- Sport icon -->
  <div class="icon-wrap" aria-hidden="true">
    {#if props.sportId}
      <SportSvgIcon sport={props.sportId} size={28} color={props.accent} />
    {:else if props.emoji}
      <span style="font-size:26px">{props.emoji}</span>
    {:else}
      <span style="font-size:22px">⚡</span>
    {/if}
  </div>

  <!-- Text content -->
  <div class="card-text">
    <div class="card-toprow">
      <span class="card-short">{props.short}</span>
      {#if props.comingSoon}
        <span class="cs-badge" aria-label="Coming Soon">
          <span class="cs-dot"></span>
          COMING SOON
        </span>
      {:else}
        <span class="live-badge" aria-label="Live">
          <span class="live-dot"></span>
          LIVE
        </span>
      {/if}
    </div>
    <h2 class="card-title">{props.title}</h2>
    <p class="card-desc">{props.description}</p>
  </div>

  <!-- Arrow / Lock -->
  <div class="card-arrow" aria-hidden="true">
    {#if props.comingSoon}
      <Lock size={16} stroke-width={2} />
    {:else}
      <ChevronRight size={18} stroke-width={2.5} />
    {/if}
  </div>
</button>

<style>
  .sport-card {
    --radius: 20px;
    position: relative;
    display: grid;
    grid-template-columns: 64px 1fr 28px;
    gap: 14px;
    align-items: center;
    text-align: left;
    padding: 18px;
    border-radius: var(--radius);
    color: var(--c-text);
    background: var(--c-glass-sm);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid var(--c-border-md);
    overflow: hidden;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    font: inherit;
    transition:
      transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 180ms ease,
      box-shadow 200ms ease,
      background 180ms ease;
  }

  /* Left neon border */
  .sport-card::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent));
    border-radius: 20px 0 0 20px;
    transition: width 200ms ease;
  }

  /* Hover / focus states */
  .sport-card:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--c-border-md));
    background: var(--c-glass-lg);
    box-shadow:
      0 12px 40px -10px color-mix(in srgb, var(--accent) 40%, transparent),
      0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent) inset;
  }
  .sport-card:hover::before { width: 4px; }
  .sport-card:active { transform: translateY(0) scale(0.98); }
  .sport-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  /* Aurora glow spot */
  .card-glow {
    position: absolute;
    top: -60px; right: -60px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 25%, transparent), transparent);
    pointer-events: none;
    transition: opacity 200ms ease;
    opacity: 0.6;
  }
  .sport-card:hover .card-glow { opacity: 1; }

  /* Icon wrap */
  .icon-wrap {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 62px;
    height: 62px;
    border-radius: 16px;
    background: linear-gradient(
      150deg,
      color-mix(in srgb, var(--accent) 22%, var(--c-glass-sm)),
      color-mix(in srgb, var(--accent) 8%, var(--c-glass-sm))
    );
    border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--c-border-md));
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 15%, transparent);
    transition: box-shadow 200ms ease;
    flex-shrink: 0;
  }
  .sport-card:hover .icon-wrap {
    box-shadow: 0 0 28px color-mix(in srgb, var(--accent) 35%, transparent);
  }

  /* Card text */
  .card-text {
    position: relative;
    z-index: 1;
    display: grid;
    align-content: center;
    gap: 6px;
    min-width: 0;
    pointer-events: none;
  }

  .card-toprow {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-short {
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 0.14em;
    color: var(--accent);
    text-transform: uppercase;
  }

  .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border-md);
    font-size: 9px;
    font-weight: 800;
    color: var(--c-muted);
    letter-spacing: 0.08em;
  }
  .live-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--c-green);
    box-shadow: 0 0 6px var(--c-green);
    animation: dot-pulse 2s ease-in-out infinite;
  }

  .cs-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-amber) 14%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-amber) 35%, transparent);
    font-size: 8.5px;
    font-weight: 800;
    color: var(--c-amber);
    letter-spacing: 0.08em;
  }
  .cs-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--c-amber);
    box-shadow: 0 0 6px var(--c-amber);
  }

  .sport-card.coming-soon {
    opacity: 0.72;
    cursor: not-allowed;
  }
  .sport-card.coming-soon:hover {
    transform: none;
    box-shadow: none;
    background: var(--c-glass-sm);
  }

  .card-title {
    font-size: 17px;
    font-weight: 800;
    color: var(--c-text);
    margin: 0;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .card-desc {
    color: var(--c-muted);
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    font-weight: 500;
  }

  /* Arrow */
  .card-arrow {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    color: var(--c-muted);
    transition: transform 200ms ease, color 200ms ease, background 200ms ease;
    flex-shrink: 0;
  }
  .sport-card:hover .card-arrow {
    transform: translateX(4px);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 10%, transparent);
  }

  @media (max-width: 340px) {
    .sport-card { grid-template-columns: 52px 1fr 24px; padding: 14px; }
    .icon-wrap { width: 52px; height: 52px; }
  }
</style>
