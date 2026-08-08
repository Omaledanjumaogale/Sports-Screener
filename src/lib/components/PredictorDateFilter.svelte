<script lang="ts">
  import { CalendarRange, Clock3 } from '@lucide/svelte';

  export type TimeBand = 'all' | 'morning' | 'afternoon' | 'evening';

  let {
    fromDay = $bindable(''),
    toDay = $bindable(''),
    timeBand = $bindable('all' as TimeBand)
  }: {
    fromDay?: string;
    toDay?: string;
    timeBand?: TimeBand;
  } = $props();

  const BANDS: { id: TimeBand; label: string; min: number; max: number }[] = [
    { id: 'all', label: 'All times', min: 0, max: 24 },
    { id: 'morning', label: 'Morning', min: 0, max: 12 },
    { id: 'afternoon', label: 'Afternoon', min: 12, max: 18 },
    { id: 'evening', label: 'Evening', min: 18, max: 24 }
  ];

  function quickWindow(days: number) {
    const base = new Date();
    const from = base.toISOString().slice(0, 10);
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + days - 1);
    fromDay = from;
    toDay = d.toISOString().slice(0, 10);
  }

  function setBand(id: TimeBand) {
    timeBand = id;
  }
</script>

<div class="date-filter" style={`--accent:#6366f1`}>
  <div class="panel">
    <div class="panel-head">
      <span class="ph-title"><CalendarRange size={14} stroke-width={2.2} /> Filter by date</span>
    </div>

    <div class="quick-chips">
      <button class="chip" type="button" onclick={() => quickWindow(1)}>
        Today
        {#if fromDay === toDay && toDay === new Date().toISOString().slice(0, 10)}
          <span class="chip-dot" aria-hidden="true"></span>
        {/if}
      </button>
      <button class="chip" type="button" onclick={() => quickWindow(2)}>Tomorrow</button>
      <button class="chip" type="button" onclick={() => quickWindow(3)}>Next 3</button>
      <button class="chip" type="button" onclick={() => quickWindow(7)}>Next 7</button>
    </div>

    <div class="range-inputs">
      <label class="field">
        <span class="field-label">From</span>
        <input type="date" bind:value={fromDay} />
      </label>
      <span class="range-sep">→</span>
      <label class="field">
        <span class="field-label">To</span>
        <input type="date" bind:value={toDay} />
      </label>
    </div>

    <div class="band-row">
      <span class="band-title"><Clock3 size={14} stroke-width={2.2} /> Schedule time</span>
      <div class="bands">
        {#each BANDS as band}
          <button
            class="band {timeBand === band.id ? 'is-active' : ''}"
            type="button"
            onclick={() => setBand(band.id)}
          >
            {band.label}
          </button>
        {/each}
      </div>
    </div>

    <p class="panel-note">
      Showing cached matches for the selected window ({fromDay} → {toDay}) where
      data is available. Empty days show a placeholder.
    </p>
  </div>
</div>

<style>
  .date-filter {
    position: relative;
    margin-bottom: 16px;
  }

  .panel {
    width: 100%;
    background: var(--c-surface-2);
    border: 1px solid var(--c-border-md);
    border-radius: 14px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .panel-head { display: flex; align-items: center; justify-content: space-between; }
  .ph-title { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 800; color: var(--accent); text-transform: uppercase; letter-spacing: 0.05em; }

  .quick-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    flex: 1;
    min-width: 62px;
    padding: 8px 8px;
    border-radius: 10px;
    border: 1px solid var(--c-border);
    background: var(--c-glass-sm);
    color: var(--c-text);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    transition: background var(--t-base, 180ms ease), border-color var(--t-base, 180ms ease), transform 80ms ease;
  }
  .chip:hover { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
  .chip:active { transform: scale(0.97); }
  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  .range-inputs { display: flex; gap: 8px; align-items: flex-end; }
  .range-sep { color: var(--c-text-dim, var(--c-text)); font-weight: 800; padding-bottom: 9px; }
  .field { display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .field-label { font-size: 10.5px; font-weight: 800; color: var(--c-text-dim, var(--c-text)); text-transform: uppercase; letter-spacing: 0.05em; }
  .field input {
    padding: 8px 10px;
    border-radius: 10px;
    border: 1px solid var(--c-border-md);
    background: var(--c-surface-1);
    color: var(--c-text);
    font-size: 13px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    width: 100%;
  }
  .field input:focus { outline: none; border-color: color-mix(in srgb, var(--accent) 60%, transparent); }

  .band-row { display: flex; flex-direction: column; gap: 7px; }
  .band-title { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; font-weight: 800; color: var(--c-text-dim, var(--c-text)); text-transform: uppercase; letter-spacing: 0.05em; }
  .bands { display: flex; gap: 6px; flex-wrap: wrap; }
  .band {
    padding: 6px 10px;
    border-radius: 999px;
    border: 1px solid var(--c-border);
    background: var(--c-glass-sm);
    color: var(--c-text);
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: background var(--t-base, 180ms ease), border-color var(--t-base, 180ms ease);
  }
  .band:hover { border-color: color-mix(in srgb, var(--accent) 55%, transparent); }
  .band.is-active { background: color-mix(in srgb, var(--accent) 16%, transparent); border-color: color-mix(in srgb, var(--accent) 70%, transparent); color: var(--accent); }

  .panel-note { font-size: 11px; color: var(--c-text-dim, var(--c-text)); line-height: 1.5; margin: 0; }
</style>