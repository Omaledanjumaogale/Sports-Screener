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
      <div class="stat-row">
        <div class="stat-label">{bar.label}</div>
        <div class="split" aria-hidden="true">
          <div class="split-left" style={`width:${bar.left.pct}%;`}></div>
          <div class="split-right" style={`width:${100 - bar.left.pct}%;`}></div>
        </div>
        <div class="stat-values">
          <span class="side left">{bar.left.label} {bar.left.pct}%</span>
          {#if bar.center}<span class="center">{bar.center}</span>{/if}
          <span class="side right">{bar.right.label} {bar.right.pct}%</span>
        </div>
      </div>
    {/each}
    <p class="stats-note">Probabilities de-vigged from the cached (real) bookmaker odds — not projected form.</p>
  </div>
{/if}

<style>
  .stats-block {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    display: flex;
    flex-direction: column;
    gap: 9px;
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

  .stat-row { display: flex; flex-direction: column; gap: 4px; }
  .stat-label { font-size: 11px; font-weight: 700; color: var(--c-text); }

  .split {
    display: flex;
    height: 7px;
    border-radius: 999px;
    overflow: hidden;
    background: var(--c-border);
    border: 1px solid var(--c-border);
  }
  .split-left {
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #fff));
    transition: width 0.5s ease;
  }
  .split-right {
    background: linear-gradient(90deg, color-mix(in srgb, #f43f5e 80%, #fff), #f43f5e);
    transition: width 0.5s ease;
  }

  .stat-values { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .side.left { color: var(--accent); }
  .side.right { color: #f43f5e; }
  .center { color: var(--c-text-dim, var(--c-text)); font-size: 10.5px; font-weight: 700; text-align: center; }

  .stats-note { font-size: 10px; color: var(--c-text-dim, var(--c-text)); line-height: 1.4; margin: 0; }
</style>