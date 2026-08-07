<script lang="ts">
  import { BarChart3 } from '@lucide/svelte';
  import { derivedMatchStats, type DerivedStatBar } from '$lib/engine';

  let {
    scopes = null as any,
    accent = '#6366f1'
  }: {
    scopes?: any;
    accent?: string;
  } = $props();

  const bars: DerivedStatBar[] = $derived(derivedMatchStats(scopes && typeof scopes === 'object' ? scopes : {}));
</script>

{#if bars.length > 0}
  <div class="stats-block" role="region" aria-label="Match stats" style={`--accent:${accent}`}>
    <div class="stats-title"><span><BarChart3 size={13} stroke-width={2.2} /></span> Match Stats</div>
    {#each bars as bar (bar.key)}
      {@const leftIsHigher = bar.left.pct >= bar.right.pct}
      <div class="stat-row">
        <div class="stat-label">{bar.label}</div>
        <div class="split" aria-hidden="true">
          <div
            class="split-left"
            class:is-dominant={leftIsHigher}
            style={`width:${bar.left.pct}%;`}
          ></div>
          <div
            class="split-right"
            class:is-dominant={!leftIsHigher}
            style={`width:${100 - bar.left.pct}%;`}
          ></div>
        </div>
        <div class="stat-values">
          <span class="side left" class:is-dominant={leftIsHigher}>
            {bar.left.label} <strong>{bar.left.pct.toFixed(1)}%</strong>
          </span>
          {#if bar.center}<span class="center">{bar.center}</span>{/if}
          <span class="side right" class:is-dominant={!leftIsHigher}>
            {bar.right.label} <strong>{bar.right.pct.toFixed(1)}%</strong>
          </span>
        </div>
      </div>
    {/each}
    <p class="stats-note">Probabilities de-vigged from real bookmaker lines — higher probability outcome highlighted in green indicator.</p>
  </div>
{/if}

<style>
  .stats-block {
    margin-top: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--c-surface-2) 90%, var(--accent));
    border: 1px solid color-mix(in srgb, var(--c-border-md) 80%, var(--accent));
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stats-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-text-dim, var(--c-text));
  }
  .stats-title span { display: inline-flex; color: var(--accent); }

  .stat-row { display: flex; flex-direction: column; gap: 5px; }
  .stat-label { font-size: 11.5px; font-weight: 700; color: var(--c-text); }

  .split {
    display: flex;
    height: 9px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--c-border);
    border: 1px solid var(--c-border-md);
  }
  .split-left {
    background: linear-gradient(90deg, #3b82f6, #60a5fa);
    transition: width 0.5s ease;
  }
  .split-left.is-dominant {
    background: linear-gradient(90deg, #10b981, #22c55e);
    box-shadow: 0 0 8px color-mix(in srgb, #22c55e 50%, transparent);
  }

  .split-right {
    background: linear-gradient(90deg, #f97316, #fb923c);
    transition: width 0.5s ease;
  }
  .split-right.is-dominant {
    background: linear-gradient(90deg, #10b981, #22c55e);
    box-shadow: 0 0 8px color-mix(in srgb, #22c55e 50%, transparent);
  }

  .stat-values {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .side { color: var(--c-text-2); }
  .side.is-dominant { color: #22c55e; font-weight: 800; }
  .side.is-dominant strong { color: #22c55e; }
  .center { color: var(--c-text-dim, var(--c-text)); font-size: 11px; font-weight: 700; text-align: center; }

  .stats-note { font-size: 10.5px; color: var(--c-text-dim, var(--c-text)); line-height: 1.4; margin: 0; }
</style>