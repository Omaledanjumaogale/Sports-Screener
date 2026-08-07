<script lang="ts">
  import type { Pick } from '$lib/engine';

  let {
    picks = [] as Pick[],
    limit = 3,
    accent = '#6366f1',
    showEdge = true
  }: {
    picks?: Pick[];
    limit?: number;
    accent?: string;
    showEdge?: boolean;
  } = $props();

  const rows = $derived(picks.slice(0, limit));
  const maxPct = $derived(Math.max(...rows.map((p) => Number(p.probability) || 0), 1));
</script>

{#if rows.length > 0}
  <div class="pick-chart" role="img" aria-label="Top pick probabilities" style={`--accent:${accent}`}>
    {#each rows as p, i (p.marketId + ':' + p.label)}
      <div class="chart-row">
        <div class="row-top">
          <span class="rank">#{i + 1}</span>
          <span class="label" title={p.marketTitle}>
            <span class="name">{p.label}</span>
            <span class="market">{p.marketTitle}</span>
          </span>
          <span class="pct">{Number(p.probability).toFixed(1)}%</span>
        </div>
        <div class="track" aria-hidden="true">
          <div
            class="bar"
            style={`width:${Math.min(100, (Number(p.probability) / maxPct) * 100)}%;`}
          ></div>
        </div>
        {#if showEdge && p.ev !== undefined}
          <div class="row-foot">
            <span class="ev">EV {Number(p.ev).toFixed(2)}</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .pick-chart {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
  }

  .chart-row { display: flex; flex-direction: column; gap: 4px; }

  .row-top {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .rank {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
    color: var(--accent);
    font-size: 10.5px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .label {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
  }

  .name { font-weight: 800; font-size: 12.5px; color: var(--c-text); }

  .market { font-size: 10.5px; color: var(--c-text-dim, var(--c-text)); }

  .pct {
    flex-shrink: 0;
    font-weight: 900;
    font-size: 12.5px;
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }

  .track {
    height: 6px;
    border-radius: 999px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    overflow: hidden;
  }

  .bar {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 55%, #fff));
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 45%, transparent);
    transition: width 0.6s ease;
  }

  .row-foot { display: flex; justify-content: flex-end; }
  .ev { font-size: 10px; color: #22c55e; font-weight: 700; font-variant-numeric: tabular-nums; }
</style>