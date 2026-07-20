<script lang="ts">
  let {
    value = null,
    label = 'Line',
    options = [] as number[],
    placeholder = 'Pick',
    disabled = false,
    step = 0.5,
    min = -999,
    max = 999,
    onChange = (_v: number | null) => { void _v; }
  }: {
    value: number | null;
    label?: string;
    options?: number[];
    placeholder?: string;
    disabled?: boolean;
    step?: number;
    min?: number;
    max?: number;
    onChange?: (v: number | null) => void;
  } = $props();

  function setLine(v: string) {
    onChange(v === '' ? null : Number(v));
  }

  function nudge(delta: number) {
    const fallback = options[0] ?? 0;
    const current = Number(value ?? fallback);
    const next = Math.max(min, Math.min(max, Math.round((current + delta) * 100) / 100));
    onChange(next);
  }
</script>

<div class="line-picker" aria-label={label}>
  <span class="line-picker-label">{label}</span>
  <div class="line-picker-controls" role="group">
    <button
      type="button"
      class="nudge"
      aria-label={`Decrease ${label}`}
      onclick={() => nudge(-step)}
      {disabled}
    >−</button>
    <select
      {disabled}
      aria-label={`Select ${label}`}
      value={value ?? ''}
      onchange={(e) => setLine(e.currentTarget.value)}
    >
      <option value="">{value !== null ? value : placeholder}</option>
      {#each options as line}
        <option value={line}>{line}</option>
      {/each}
    </select>
    <button
      type="button"
      class="nudge"
      aria-label={`Increase ${label}`}
      onclick={() => nudge(step)}
      {disabled}
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
    color: var(--c-muted, #8899bb);
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding-left: 2px;
  }
  .line-picker-controls {
    display: grid;
    grid-template-columns: 38px minmax(90px, 1fr) 38px;
    gap: 5px;
    align-items: center;
  }
  .nudge {
    height: 44px;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    color: var(--c-text, #f1f5ff);
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
    border-color: color-mix(in srgb, var(--accent, #6366f1) 50%, rgba(255,255,255,0.1));
    background: rgba(255, 255, 255, 0.09);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent, #6366f1) 15%, transparent);
    color: var(--accent, #6366f1);
  }
  .nudge:active:not([disabled]) {
    transform: scale(0.92);
    background: rgba(255, 255, 255, 0.12);
  }
  .nudge[disabled] { opacity: 0.35; cursor: not-allowed; }

  select {
    width: 100%;
    min-height: 44px;
    color: var(--c-text, #f1f5ff);
    background: rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.09);
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
    border-color: color-mix(in srgb, var(--accent, #6366f1) 65%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent, #6366f1) 12%, transparent);
    background-color: rgba(255, 255, 255, 0.08);
  }
  select:disabled { opacity: 0.35; cursor: not-allowed; }
  select option {
    background: #0d1525;
    color: #f1f5ff;
    font-family: 'JetBrains Mono', monospace;
  }
</style>
