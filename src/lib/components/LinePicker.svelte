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
    let fallback = options[0] ?? 0;
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
    gap: 4px;
    min-width: 0;
  }
  .line-picker-label {
    color: #9fb2cc;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .line-picker-controls {
    display: grid;
    grid-template-columns: 40px minmax(90px, 1fr) 40px;
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
  }
  .nudge:hover:not([disabled]) { border-color: #465a7e; background: #121e36; }
  .nudge:active:not([disabled]) { background: #1a2a49; }
  .nudge[disabled] { opacity: 0.4; cursor: not-allowed; }
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
</style>
