<script lang="ts">
  import type { Pick } from '$lib/engine';
  import { pickSegment, picksBySegment, PREDICTOR_SEGMENTS } from '$lib/predictorSegments';

  let {
    picks = [] as Pick[],
    limit = 3,
    accent = '#6366f1',
    showEdge = true,
    grouped = false,
    perSegment = 3
  }: {
    picks?: Pick[];
    limit?: number;
    accent?: string;
    showEdge?: boolean;
    grouped?: boolean;
    perSegment?: number;
  } = $props();

  const rows = $derived(picks.slice(0, limit));
  const maxPct = $derived(Math.max(...picks.map((p) => Number(p.probability) || 0), 1));

  const segmentGroups = $derived(
    grouped
      ? PREDICTOR_SEGMENTS.map((seg) => ({
          def: seg,
          items: (picksBySegment(picks).get(seg.key) ?? []).slice(0, perSegment)
        })).filter((g) => g.items.length > 0)
      : []
  );
</script>

{#if grouped}
  <div class="pick-chart grouped" role="list" aria-label="Pick probabilities by market segment" style={`--accent:${accent}`}>
    {#each segmentGroups as g, gi (g.def.key)}
      <div class="segment-group" class:show-all={g.items.length > 1}>
        <div class="segment-head" style={`--seg-accent:${g.def.accent}`}>
          <span class="seg-dot"></span>
          <span class="seg-label">{g.def.label}</span>
          <span class="seg-count">{g.items.length}</span>
        </div>
        {#each g.items as p, i (p.marketId + ':' + p.label)}
          <div class="chart-row">
            <div class="row-top">
              <span class="rank" style={`--seg-accent:${g.def.accent}`}>{g.def.short}</span>
              <span class="label" title={p.marketTitle}>
                <span class="name">{p.label}</span>
                <span class="market" style={`--seg-accent:${g.def.accent}`}>{p.marketTitle}</span>
              </span>
              <span class="pct" style={`--seg-accent:${g.def.accent}`}>{Number(p.probability).toFixed(1)}%</span>
            </div>
            <div class="track" aria-hidden="true">
              <div class="bar" style={`width:${Math.min(100, (Number(p.probability) / maxPct) * 100)}%;`}></div>
            </div>
            {#if showEdge && p.ev !== undefined}
              <div class="row-foot">
                <span class="ev">EV {Number(p.ev).toFixed(2)}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
{:else if rows.length > 0}
  <div class="pick-chart" role="img" aria-label="Top pick probabilities" style={`--accent:${accent}`}>
    {#each rows as p, i (p.marketId + ':' + p.label)}
      {@const seg = pickSegment(p.marketId)}
      <div class="chart-row">
        <div class="row-top">
          <span class="rank" style={`--seg-accent:${seg.accent}`}>{i + 1}</span>
          <span class="label" title={p.marketTitle}>
            <span class="name">{p.label}</span>
            <span class="market" style={`--seg-accent:${seg.accent}`}>{p.marketTitle} · {seg.short}</span>
          </span>
          <span class="pct" style={`--seg-accent:${seg.accent}`}>{Number(p.probability).toFixed(1)}%</span>
        </div>
        <div class="track" aria-hidden="true">
          <div class="bar" style={`width:${Math.min(100, (Number(p.probability) / maxPct) * 100)}%;`}></div>
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
    min-width: 20px;
    height: 20px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--seg-accent, var(--accent)) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--seg-accent, var(--accent)) 45%, transparent);
    color: var(--seg-accent, var(--accent));
    font-size: 10.5px;
    font-weight: 800;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 2px;
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

  .market { font-size: 10.5px; color: color-mix(in srgb, var(--seg-accent, var(--c-text-dim)) 80%, var(--c-text-dim, var(--c-text))); }

  .pct {
    flex-shrink: 0;
    font-weight: 900;
    font-size: 12.5px;
    color: var(--seg-accent, var(--accent));
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
    background: linear-gradient(90deg, var(--seg-accent, var(--accent)), color-mix(in srgb, var(--seg-accent, var(--accent)) 55%, #fff));
    box-shadow: 0 0 8px color-mix(in srgb, var(--seg-accent, var(--accent)) 45%, transparent);
    transition: width 0.6s ease;
  }

  .row-foot { display: flex; justify-content: flex-end; }
  .ev { font-size: 10px; color: #22c55e; font-weight: 700; font-variant-numeric: tabular-nums; }

  /* Grouped / segment layout */
  .pick-chart.grouped { gap: 14px; }

  .segment-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .segment-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 6px;
    border-bottom: 1px dashed color-mix(in srgb, var(--seg-accent) 30%, var(--c-border));
  }

  .seg-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--seg-accent);
    box-shadow: 0 0 8px var(--seg-accent);
  }

  .seg-label {
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--seg-accent);
  }

  .seg-count {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    color: var(--c-text-dim, var(--c-text));
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    padding: 2px 8px;
    border-radius: 999px;
  }
</style>