<script lang="ts">
  import { onMount } from 'svelte';

  let {
    value = null,
    label = 'Line',
    options = [] as number[],
    placeholder = 'Pick',
    disabled = false,
    locked = false,
    step = 0.5,
    min = -999,
    max = 999,
    storageKey = '',
    onChange = (_v: number | null) => { void _v; },
    onToggleLock = null as (() => void) | null
  }: {
    value: number | null;
    label?: string;
    options?: number[];
    placeholder?: string;
    disabled?: boolean;
    locked?: boolean;
    step?: number;
    min?: number;
    max?: number;
    storageKey?: string;
    onChange?: (v: number | null) => void;
    onToggleLock?: (() => void) | null;
  } = $props();

  let customInput = $state('');
  let isCustom = $state(false);

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

  // Reflect value in custom input when set externally
  $effect(() => {
    if (value !== null && !options.includes(value)) {
      isCustom = true;
      customInput = String(value);
    }
  });

  function setLine(v: string) {
    isCustom = false;
    customInput = '';
    onChange(v === '' ? null : Number(v));
  }

  function handleCustomInput(val: string) {
    customInput = val;
    if (val === '') { onChange(null); return; }
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, Math.round(num * 100) / 100));
      isCustom = true;
      onChange(clamped);
    }
  }

  function nudge(delta: number) {
    const fallback = options[0] ?? 0;
    const current = Number(value ?? fallback);
    const next = Math.max(min, Math.min(max, Math.round((current + delta) * 100) / 100));
    if (!options.includes(next)) {
      isCustom = true;
      customInput = String(next);
    }
    onChange(next);
  }
</script>

<div class="line-picker" class:is-locked={locked} aria-label={label}>
  <div class="picker-header">
    <span class="line-picker-label">{label}</span>
    {#if onToggleLock}
      <button
        type="button"
        class="lock-btn"
        class:locked={locked}
        title={locked ? "Locked — auto-fill will not change this line. Click to unlock" : "Unlocked — click to lock line"}
        aria-label={locked ? "Unlock line" : "Lock line"}
        onclick={onToggleLock}
      >
        {#if locked}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Locked</span>
        {:else}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
          <span>Lock</span>
        {/if}
      </button>
    {/if}
  </div>

  <!-- Custom line input — always at top so user doesn't have to scroll -->
  <div class="custom-row">
    <label class="custom-row-label" for={`lp-custom-${label.replace(/\s+/g, '-')}`}>
      Custom line
    </label>
    <div class="custom-inline">
      <input
        type="number"
        step={step}
        {min}
        {max}
        id={`lp-custom-${label.replace(/\s+/g, '-')}`}
        placeholder={`e.g. ${options[0] ?? 2.5}`}
        value={isCustom ? customInput : (value !== null ? String(value) : '')}
        disabled={disabled || locked}
        oninput={(e) => {
          const val = e.currentTarget.value;
          if (val === '') { isCustom = false; customInput = ''; onChange(null); return; }
          handleCustomInput(val);
        }}
        aria-label={`Custom ${label}`}
      />
      {#if isCustom && !locked}
        <button
          type="button"
          class="clear-custom"
          title="Clear custom line"
          aria-label="Clear custom line"
          onclick={() => { isCustom = false; customInput = ''; onChange(null); }}
        >×</button>
      {/if}
    </div>
  </div>

  <div class="divider-or"><span>or choose preset</span></div>

  <!-- Nudge + preset dropdown row -->
  <div class="line-picker-controls" role="group">
    <button
      type="button"
      class="nudge"
      aria-label={`Decrease ${label}`}
      onclick={() => nudge(-step)}
      disabled={disabled || locked}
    >−</button>

    <select
      disabled={disabled || locked}
      aria-label={`Select ${label}`}
      value={!isCustom && value !== null ? String(value) : ''}
      onchange={(e) => setLine(e.currentTarget.value)}
    >
      <option value="">{isCustom ? `Custom: ${value}` : (value !== null ? value : placeholder)}</option>
      {#each options as line}
        <option value={line}>{line}</option>
      {/each}
    </select>

    <button
      type="button"
      class="nudge"
      aria-label={`Increase ${label}`}
      onclick={() => nudge(step)}
      disabled={disabled || locked}
    >+</button>
  </div>
</div>

<style>
  .line-picker {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .line-picker-label {
    color: var(--c-muted);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding-left: 2px;
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .lock-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 1px solid var(--c-border-sm, rgba(255,255,255,0.08));
    color: var(--c-muted, #8899bb);
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 120ms ease;
  }

  .lock-btn:hover {
    color: #f59e0b;
    border-color: color-mix(in srgb, #f59e0b 40%, transparent);
    background: color-mix(in srgb, #f59e0b 8%, transparent);
  }

  .lock-btn.locked {
    background: color-mix(in srgb, #f59e0b 16%, transparent);
    border-color: color-mix(in srgb, #f59e0b 40%, transparent);
    color: #f59e0b;
  }

  .line-picker.is-locked .custom-inline input {
    border-color: color-mix(in srgb, #f59e0b 50%, transparent);
    background: color-mix(in srgb, #f59e0b 5%, var(--c-input-bg));
  }

  /* Custom row */
  .custom-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .custom-row-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--c-muted);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding-left: 2px;
  }

  .custom-inline {
    position: relative;
    display: flex;
    align-items: center;
  }

  .custom-inline input {
    width: 100%;
    min-height: 40px;
    color: var(--c-input-text);
    background: var(--c-input-bg);
    border: 1px solid color-mix(in srgb, var(--accent, #f97316) 45%, var(--c-input-border));
    border-radius: 10px;
    padding: 0 28px 0 11px;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 13px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent, #f97316) 8%, transparent);
    transition: border-color var(--t-base), box-shadow var(--t-base);
  }

  .custom-inline input:focus {
    outline: none;
    border-color: var(--accent, #f97316);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #f97316) 14%, transparent);
  }

  .custom-inline input::placeholder {
    color: var(--c-faint);
    font-weight: 500;
    font-size: 11.5px;
  }

  .custom-inline input::-webkit-inner-spin-button,
  .custom-inline input::-webkit-outer-spin-button { opacity: 0.4; }

  .clear-custom {
    position: absolute;
    right: 7px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--c-muted);
    font-size: 17px;
    cursor: pointer;
    line-height: 1;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: color var(--t-fast), background var(--t-fast);
  }

  .clear-custom:hover {
    color: var(--c-red);
    background: color-mix(in srgb, var(--c-red) 12%, transparent);
  }

  /* OR divider */
  .divider-or {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 2px 0;
  }

  .divider-or::before,
  .divider-or::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--c-border-sm);
  }

  .divider-or span {
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-faint);
    white-space: nowrap;
  }

  .line-picker-controls {
    display: grid;
    grid-template-columns: 38px minmax(90px, 1fr) 38px;
    gap: 5px;
    align-items: center;
  }

  .nudge {
    height: 40px;
    border: 1px solid var(--c-input-border);
    background: var(--c-input-bg);
    color: var(--c-text);
    border-radius: 10px;
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    touch-action: manipulation;
    transition:
      background var(--t-fast, 100ms ease),
      border-color var(--t-fast, 100ms ease),
      box-shadow var(--t-fast, 100ms ease),
      transform 60ms ease;
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

  select {
    width: 100%;
    min-height: 40px;
    color: var(--c-input-text);
    background: var(--c-input-bg);
    border: 1px solid var(--c-input-border);
    border-radius: 10px;
    padding: 0 28px 0 12px;
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
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%238899bb'><path d='M5.5 7.5L10 12l4.5-4.5z'/></svg>");
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
    background: var(--c-option-bg);
    color: var(--c-option-text);
    font-family: 'JetBrains Mono', monospace;
  }
</style>
