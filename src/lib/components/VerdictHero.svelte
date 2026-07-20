<script lang="ts">
  import type { Status } from '../engine';

  let {
    headline,
    chips = [] as { label: string; value: string; status: Status }[]
  }: {
    headline: string;
    chips?: { label: string; value: string; status: Status }[];
  } = $props();
</script>

<section class="verdict" aria-label="Screening verdict">
  <div class="headline-wrap">
    <p class="headline">{headline}</p>
  </div>
  {#if chips.length}
    <div class="chips" role="list" aria-label="Profile status chips">
      {#each chips as chip}
        <span class={`chip ${chip.status}`} role="listitem">
          <b>{chip.label}</b>
          <span class="chip-value">{chip.value}</span>
        </span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .verdict {
    padding: 18px;
    border: 1px solid color-mix(in srgb, var(--accent, #22c55e) 45%, #223047);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent, #22c55e) 14%, #0f1726) 0%, #0f1726 100%);
    border-radius: 14px;
    margin-bottom: 2px;
  }
  .headline-wrap {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .headline {
    margin: 0;
    line-height: 1.45;
    font-weight: 750;
    font-size: clamp(14px, 4vw, 16px);
    color: #eaf3ff;
    letter-spacing: -0.005em;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 14px;
  }
  .chip {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    min-height: 32px;
    padding: 4px 12px;
    border-radius: 999px;
    background: #172238;
    color: #cad8ec;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid rgba(255,255,255,0.03);
  }
  .chip b { font-weight: 800; letter-spacing: 0.02em; }
  .chip-value { font-variant-numeric: tabular-nums; opacity: 0.92; }
  .chip.green { color: #7ef0b2; background: #0b2e20; border-color: rgba(34,197,94,0.18); }
  .chip.amber { color: #ffd27a; background: #2e240b; border-color: rgba(245,158,11,0.18); }
  .chip.red   { color: #ff99a3; background: #2e0f15; border-color: rgba(251,113,133,0.18); }
  .chip.empty { opacity: 0.6; }
</style>
