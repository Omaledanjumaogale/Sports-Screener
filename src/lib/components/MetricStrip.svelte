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
    background: var(--c-glass-sm);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--c-border-md);
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
    border-color: color-mix(in srgb, var(--c-green) 28%, var(--c-border-md));
    background: linear-gradient(160deg, color-mix(in srgb, var(--c-green) 10%, var(--c-glass-sm)), var(--c-glass-sm));
    box-shadow: 0 4px 20px color-mix(in srgb, var(--c-green) 12%, transparent);
  }
  .metric-green:hover { box-shadow: 0 6px 28px color-mix(in srgb, var(--c-green) 20%, transparent); }

  .metric-amber {
    border-color: color-mix(in srgb, var(--c-amber) 28%, var(--c-border-md));
    background: linear-gradient(160deg, color-mix(in srgb, var(--c-amber) 10%, var(--c-glass-sm)), var(--c-glass-sm));
    box-shadow: 0 4px 20px color-mix(in srgb, var(--c-amber) 12%, transparent);
  }
  .metric-amber:hover { box-shadow: 0 6px 28px color-mix(in srgb, var(--c-amber) 20%, transparent); }

  .metric-red {
    border-color: color-mix(in srgb, var(--c-red) 28%, var(--c-border-md));
    background: linear-gradient(160deg, color-mix(in srgb, var(--c-red) 10%, var(--c-glass-sm)), var(--c-glass-sm));
    box-shadow: 0 4px 20px color-mix(in srgb, var(--c-red) 12%, transparent);
  }
  .metric-red:hover { box-shadow: 0 6px 28px color-mix(in srgb, var(--c-red) 20%, transparent); }

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
    color: var(--c-text);
  }
  .metric-green  .metric-value { color: var(--c-green); }
  .metric-amber  .metric-value { color: var(--c-amber); }
  .metric-red    .metric-value { color: var(--c-red); }

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
    background: var(--c-border-md);
  }
  .metric-green  .metric-bar { background: linear-gradient(90deg, var(--c-green), transparent); }
  .metric-amber  .metric-bar { background: linear-gradient(90deg, var(--c-amber), transparent); }
  .metric-red    .metric-bar { background: linear-gradient(90deg, var(--c-red), transparent); }

  .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }

  @media (max-width: 520px) {
    .metric-strip { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 340px) {
    .metric-strip { grid-template-columns: 1fr; }
  }
</style>
