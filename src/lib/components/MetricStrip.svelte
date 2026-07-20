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
      <div
        class={`metric metric-${metric.status ?? 'empty'}`}
        aria-label={`${metric.label}: ${metric.value}${metric.note ? ' — ' + metric.note : ''}`}
      >
        <span class="metric-label">{metric.label}</span>
        <strong class="metric-value mono">{metric.value}</strong>
        {#if metric.note}
          <small class="metric-note">{metric.note}</small>
        {/if}
        <!-- Bottom glow bar -->
        <span class="metric-bar" aria-hidden="true"></span>
      </div>
    {/each}
  </section>
{/if}

<style>
  .metric-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 8px;
    animation: fade-in 0.4s ease both;
  }

  .metric {
    position: relative;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 14px 14px 18px;
    transition:
      transform var(--t-base),
      box-shadow var(--t-base),
      border-color var(--t-base);
    min-width: 0;
  }

  .metric:hover {
    transform: translateY(-2px);
  }

  /* Status variants */
  .metric-green {
    border-color: rgba(74, 222, 128, 0.22);
    background: linear-gradient(160deg, rgba(74,222,128,0.07), rgba(255,255,255,0.03));
    box-shadow: 0 4px 20px rgba(74, 222, 128, 0.08);
  }
  .metric-green:hover { box-shadow: 0 6px 28px rgba(74, 222, 128, 0.16); }

  .metric-amber {
    border-color: rgba(251, 191, 36, 0.22);
    background: linear-gradient(160deg, rgba(251,191,36,0.07), rgba(255,255,255,0.03));
    box-shadow: 0 4px 20px rgba(251, 191, 36, 0.08);
  }
  .metric-amber:hover { box-shadow: 0 6px 28px rgba(251, 191, 36, 0.16); }

  .metric-red {
    border-color: rgba(251, 113, 133, 0.22);
    background: linear-gradient(160deg, rgba(251,113,133,0.07), rgba(255,255,255,0.03));
    box-shadow: 0 4px 20px rgba(251, 113, 133, 0.08);
  }
  .metric-red:hover { box-shadow: 0 6px 28px rgba(251, 113, 133, 0.16); }

  .metric-label {
    display: block;
    color: var(--c-muted, #8899bb);
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .metric-value {
    display: block;
    font-size: clamp(20px, 5vw, 26px);
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    letter-spacing: -0.02em;
    line-height: 1;
    margin-bottom: 5px;
    color: var(--c-text, #f1f5ff);
  }
  .metric-green  .metric-value { color: #4ade80; }
  .metric-amber  .metric-value { color: #fbbf24; }
  .metric-red    .metric-value { color: #fb7185; }

  .metric-note {
    display: block;
    color: var(--c-muted, #8899bb);
    font-size: 10.5px;
    line-height: 1.4;
    font-weight: 500;
  }

  /* Bottom neon bar */
  .metric-bar {
    position: absolute;
    bottom: 0; left: 12px; right: 12px;
    height: 2px;
    border-radius: 1px;
    background: rgba(255, 255, 255, 0.06);
  }
  .metric-green  .metric-bar { background: linear-gradient(90deg, #4ade80, transparent); }
  .metric-amber  .metric-bar { background: linear-gradient(90deg, #fbbf24, transparent); }
  .metric-red    .metric-bar { background: linear-gradient(90deg, #fb7185, transparent); }

  .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }

  @media (max-width: 520px) {
    .metric-strip { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 340px) {
    .metric-strip { grid-template-columns: 1fr; }
  }
</style>
