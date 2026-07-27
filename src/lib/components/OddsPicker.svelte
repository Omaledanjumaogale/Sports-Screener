<script lang="ts">
  import { onMount } from 'svelte';
  import { oddsOptions } from '../engine';

  let {
    value = null,
    label = 'Odds',
    placeholder = 'Pick odds',
    disabled = false,
    step = 0.01,
    id,
    storageKey = '',
    onChange = (_v: number | null) => { void _v; }
  }: {
    value: number | null;
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    step?: number;
    id?: string;
    storageKey?: string;
    onChange?: (v: number | null) => void;
  } = $props();

  let isCustom = $state(false);
  let customValue = $state('');

  onMount(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const num = parseFloat(saved);
        if (!isNaN(num)) onChange(num);
      }
    }
  });

  $effect(() => {
    if (storageKey) {
      if (value !== null) {
        localStorage.setItem(storageKey, String(value));
      } else {
        localStorage.removeItem(storageKey);
      }
    }
  });

  $effect(() => {
    if (value !== null) {
      if (value > 10 || !oddsOptions.includes(value)) {
        isCustom = true;
        customValue = String(value);
      }
    }
  });

  function setOdds(v: string) {
    if (v === 'custom') {
      isCustom = true;
      if (value !== null) customValue = String(value);
      return;
    }
    isCustom = false;
    onChange(v === '' ? null : Number(v));
  }

  function handleCustomInput(val: string) {
    customValue = val;
    const num = parseFloat(val);
    if (!isNaN(num) && num > 1) {
      onChange(Math.round(num * 100) / 100);
    } else if (val === '') {
      onChange(null);
    }
  }

  function nudge(delta: number) {
    const current = Number(value ?? 2.0);
    const next = Math.max(1.01, Math.round((current + delta) * 100) / 100);
    if (next > 10 || isCustom) {
      isCustom = true;
      customValue = String(next);
    }
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

    {#if isCustom}
      <div class="custom-wrap">
        <input
          type="number"
          step="0.01"
          min="1.01"
          placeholder="Enter odds (>10)"
          value={customValue}
          {disabled}
          oninput={(e) => handleCustomInput(e.currentTarget.value)}
        />
        <button
          type="button"
          class="reset-custom"
          title="Back to dropdown list"
          aria-label="Clear custom odds"
          onclick={() => { isCustom = false; onChange(null); }}
        >×</button>
      </div>
    {:else}
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
        <option value="custom">Custom (&gt;10.00)…</option>
      </select>
    {/if}

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
    gap: 5px;
    min-width: 0;
  }

  .odds-picker-label {
    color: var(--c-muted);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding-left: 2px;
  }

  .odds-picker-controls {
    display: grid;
    grid-template-columns: 38px minmax(90px, 1fr) 38px;
    gap: 5px;
    align-items: center;
  }

  /* Nudge buttons */
  .nudge {
    height: 44px;
    border: 1px solid var(--c-input-border);
    background: var(--c-input-bg);
    backdrop-filter: blur(8px);
    color: var(--c-text);
    border-radius: 10px;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    transition:
      background var(--t-fast, 100ms ease),
      border-color var(--t-fast, 100ms ease),
      box-shadow var(--t-fast, 100ms ease),
      transform 60ms ease;
    cursor: pointer;
    touch-action: manipulation;
  }
  .nudge:hover:not([disabled]) {
    border-color: color-mix(in srgb, var(--accent, #f97316) 50%, var(--c-border));
    background: var(--c-glass-hover);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent, #f97316) 15%, transparent);
    color: var(--accent, #f97316);
  }
  .nudge:active:not([disabled]) {
    transform: scale(0.92);
    background: var(--c-glass-active);
  }
  .nudge[disabled] { opacity: 0.35; cursor: not-allowed; }

  /* Select */
  select {
    width: 100%;
    min-height: 44px;
    color: var(--c-input-text);
    background: var(--c-input-bg);
    backdrop-filter: blur(8px);
    border: 1px solid var(--c-input-border);
    border-radius: 10px;
    padding: 0 30px 0 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 13.5px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    appearance: none;
    cursor: pointer;
    transition:
      border-color var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease),
      background var(--t-base, 180ms ease);
    background-image:
      url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%238899bb'><path d='M5.5 7.5L10 12l4.5-4.5z'/></svg>"),
      none;
    background-repeat: no-repeat;
    background-position: right 8px center;
    background-size: 14px;
  }
  select:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--accent, #f97316) 65%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #f97316) 12%, transparent);
    background-color: var(--c-glass-hover);
  }
  select:disabled { opacity: 0.35; cursor: not-allowed; }
  select option {
    background: var(--c-option-bg, #0d1525);
    color: var(--c-option-text, #f1f5ff);
    font-family: 'JetBrains Mono', monospace;
  }

  /* Custom input */
  .custom-wrap {
    display: flex;
    align-items: center;
    position: relative;
    width: 100%;
  }
  .custom-wrap input {
    width: 100%;
    min-height: 44px;
    color: var(--c-input-text);
    background: var(--c-input-bg);
    backdrop-filter: blur(8px);
    border: 1px solid color-mix(in srgb, var(--accent, #f97316) 55%, var(--c-input-border));
    border-radius: 10px;
    padding: 0 28px 0 12px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 13.5px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #f97316) 10%, transparent);
    transition: border-color var(--t-base), box-shadow var(--t-base);
  }
  .custom-wrap input:focus {
    outline: none;
    border-color: var(--accent, #f97316);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent, #f97316) 18%, transparent);
  }
  .custom-wrap input::-webkit-inner-spin-button,
  .custom-wrap input::-webkit-outer-spin-button { opacity: 0.4; }

  .reset-custom {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--c-muted);
    font-size: 18px;
    cursor: pointer;
    line-height: 1;
    width: 22px; height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color var(--t-fast), background var(--t-fast);
  }
  .reset-custom:hover {
    color: var(--c-red);
    background: color-mix(in srgb, var(--c-red) 12%, transparent);
  }

  /* Disabled wrapper */
  .odds-picker[data-disabled="true"] {
    opacity: 0.45;
    pointer-events: none;
  }
</style>
