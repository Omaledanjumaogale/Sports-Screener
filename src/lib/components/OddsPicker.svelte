<script lang="ts">
  import { oddsOptions } from '../engine';

  let {
    value = null,
    label = 'Odds',
    placeholder = 'Pick',
    disabled = false,
    step = 0.01,
    id,
    onChange = (_v: number | null) => { void _v; }
  }: {
    value: number | null;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    step?: number;
    id?: string;
    onChange?: (v: number | null) => void;
  } = $props();

  function setOdds(v: string) {
    onChange(v === '' ? null : Number(v));
  }

  function nudge(delta: number) {
    const current = Number(value ?? 2);
    const next = Math.max(1.01, Math.round((current + delta) * 100) / 100);
    onChange(next);
  }

  function formatVal(v: number | null | undefined) {
    return v ? v.toFixed(2) : placeholder;
  }
</script>

<div class="odds-picker" data-disabled={disabled} aria-label={label}>
  <span class="odds-picker-label" id={id ? `${id}-label` : undefined}>{label}</span>
  <div class="odds-picker-controls" role="group" aria-labelledby={id ? `${id}-label` : undefined}>
    <button
      type="button"
      class="nudge minus"
      aria-label={`Decrease ${label}`}
      onclick={() => nudge(-step)}
      {disabled}
    >−</button>
    <select
      {disabled}
      aria-label={`Select ${label}`}
      value={value ?? ''}
      onchange={(e) => setOdds(e.currentTarget.value)}
    >
      <option value="">{formatVal(value)}</option>
      {#each oddsOptions as odd}
        <option value={odd}>{odd.toFixed(2)}</option>
      {/each}
    </select>
    <button
      type="button"
      class="nudge plus"
      aria-label={`Increase ${label}`}
      onclick={() => nudge(step)}
      {disabled}
    >+</button>
  </div>
</div>

<style>
  .odds-picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .odds-picker-label {
    color: #9fb2cc;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: none;
  }
  .odds-picker-controls {
    display: grid;
    grid-template-columns: 40px minmax(100px, 1fr) 40px;
    gap: 6px;
    align-items: center;
  }
  .nudge {
    height: 42px;
    border: 1px solid #2a3a55;
    background: #0c1424;
    color: #f7fbff;
    border-radius: 8px;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    transition: background 120ms, border-color 120ms;
  }
  .nudge:hover:not([disabled]) {
    border-color: #465a7e;
    background: #121e36;
  }
  .nudge:active:not([disabled]) {
    background: #1a2a49;
  }
  .nudge[disabled] {
    opacity: 0.4;
    cursor: not-allowed;
  }
  select {
    width: 100%;
    min-height: 42px;
    color: #f7fbff;
    background: #111c2f;
    border: 1px solid #2a3a55;
    border-radius: 8px;
    padding: 0 32px 0 10px;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    appearance: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%239fb2cc'><path d='M5.5 7.5L10 12l4.5-4.5z'/></svg>");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 14px;
  }
  select:disabled { opacity: 0.4; }
</style>
