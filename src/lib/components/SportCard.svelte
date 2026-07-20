<script lang="ts">
  import { ChevronRight, type LucideIcon } from '@lucide/svelte';

  const props = $props<{
    icon: LucideIcon;
    short: string;
    title: string;
    description: string;
    accent: string;
    onClick?: () => void;
    path?: string;
  }>();
  const Icon = $derived(props.icon);
</script>

<button
  class="sport-card"
  style={`--accent:${props.accent}`}
  aria-label={`Open ${props.title}`}
  type="button"
  onclick={() => {
    if (typeof props.onClick === 'function') {
      try { props.onClick(); } catch (_) { /* swallow callback errors */ }
    } else if (props.path && typeof window !== 'undefined') {
      window.location.assign(props.path);
    }
  }}
>
  <div class="icon-wrap" aria-hidden="true">
    <Icon size={26} stroke-width={2.2} />
  </div>
  <div class="card-text">
    <div class="card-toprow">
      <span class="card-short">{props.short}</span>
      <span class="arrow-wrap" aria-hidden="true">
        <ChevronRight size={20} stroke-width={2.5} />
      </span>
    </div>
    <h2 class="card-title">{props.title}</h2>
    <p class="card-desc">{props.description}</p>
  </div>
</button>

<style>
  .sport-card {
    --radius: 18px;
    position: relative;
    display: grid;
    grid-template-columns: 58px 1fr;
    gap: 14px;
    align-items: stretch;
    text-align: left;
    padding: 16px;
    border-radius: var(--radius);
    color: inherit;
    background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.00));
    border: 1px solid #223047;
    overflow: hidden;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
    transition: transform 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
    font: inherit;
  }
  .sport-card::before {
    content: '';
    position: absolute;
    inset: -40% -30% auto auto;
    width: 240px; height: 240px;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 30%, transparent), transparent);
    pointer-events: none;
  }
  .sport-card::after {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent));
  }
  .sport-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--accent) 55%, #223047);
    background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 8%, #111c2f), rgba(255,255,255,0.00));
    box-shadow: 0 10px 30px -12px color-mix(in srgb, var(--accent) 50%, transparent);
  }
  .sport-card:active { transform: translateY(0); }
  .sport-card:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .icon-wrap {
    position: relative;
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 58px;
    height: 58px;
    border-radius: 14px;
    color: var(--accent);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 35%, #0f1726), color-mix(in srgb, var(--accent) 14%, #0f1726));
    border: 1px solid color-mix(in srgb, var(--accent) 40%, #1a2944);
    pointer-events: none;
  }
  .card-text { position: relative; z-index: 1; display: grid; align-content: center; gap: 6px; min-width: 0; pointer-events: none; }
  .card-text > * { pointer-events: none; }
  .card-toprow {
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-short {
    font-size: 10.5px; font-weight: 900; letter-spacing: 0.12em;
    color: var(--accent);
    text-transform: uppercase;
  }
  .arrow-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #8aa0c3;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    transition: transform 140ms ease, color 140ms ease, background 140ms;
  }
  .sport-card:hover .arrow-wrap {
    transform: translateX(3px);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, transparent);
  }
  .card-title {
    font-size: 16px;
    font-weight: 800;
    color: #eaf3ff;
    margin: 0;
  }
  .card-desc {
    color: #9fb2cc;
    font-size: 12.5px;
    line-height: 1.45;
    margin: 0;
  }
</style>
