<script lang="ts">
  import type { Status } from '../engine';

  let {
    metrics = [] as { label: string; value: string; note?: string; status?: Status }[]
  }: {
    metrics?: { label: string; value: string; note?: string; status?: Status }[];
  } = $props();
</script>

{#if metrics.length}
  <section class="metric-strip" aria-label="Key metrics" role="group">
    {#each metrics as metric}
      <div class={`metric ${metric.status ?? ''}`} aria-label={`${metric.label}: ${metric.value}${metric.note ? ' — ' + metric.note : ''}`}>
        <span class="metric-label">{metric.label}</span>
        <strong class="metric-value">{metric.value}</strong>
        {#if metric.note}
          <small class="metric-note">{metric.note}</small>
        {/if}
      </div>
    {/each}
  </section>
{/if}

<style>
  .metric-strip {
    margin-top: 12px;
    padding: 10px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 8px;
    border: 1px solid #223047;
    background: #0f1726;
    border-radius: 12px;
  }
  .metric {
    min-width: 0;
    background: #111c2f;
    border-radius: 10px;
    padding: 10px 12px;
    border: 1px solid transparent;
    transition: border-color 120ms, background 120ms;
  }
  .metric:focus-visible { outline: 2px solid #38bdf8; outline-offset: 1px; }
  .metric-label {
    display: block;
    color: #8ea3c3;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .metric-value {
    display: block;
    margin: 2px 0 4px;
    font-size: clamp(18px, 4.6vw, 22px);
    color: var(--accent, #22c55e);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
  }
  .metric-note {
    display: block;
    color: #9fb2cc;
    font-size: 10.5px;
    line-height: 1.4;
    font-weight: 500;
  }
  .metric.green { border-color: rgba(34,197,94,0.28); background: linear-gradient(180deg, #0d2a1e, #111c2f); }
  .metric.green .metric-value { color: #4ade80; }
  .metric.amber { border-color: rgba(245,158,11,0.28); background: linear-gradient(180deg, #2a1f0d, #111c2f); }
  .metric.amber .metric-value { color: #fbbf24; }
  .metric.red { border-color: rgba(251,113,133,0.28); background: linear-gradient(180deg, #2a0f15, #111c2f); }
  .metric.red .metric-value { color: #fb7185; }

  @media (max-width: 520px) {
    .metric-strip { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 340px) {
    .metric-strip { grid-template-columns: 1fr; }
  }
</style>
