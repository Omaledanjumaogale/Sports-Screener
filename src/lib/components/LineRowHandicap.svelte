<script lang="ts">
  import LinePicker from './LinePicker.svelte';
  import OddsPicker from './OddsPicker.svelte';
  import type { HandicapPair } from '../engine';

  let {
    pair,
    lineOptions = [] as number[],
    sideALabel = 'A/Home',
    sideBLabel = 'B/Away',
    index = 0,
    onChange = () => {}
  }: {
    pair: HandicapPair;
    lineOptions?: number[];
    sideALabel?: string;
    sideBLabel?: string;
    index?: number;
    onChange?: () => void;
  } = $props();
</script>

<div class="line-row-hdp" aria-label={`Handicap line row ${index + 1}`} role="group">
  <div class="row-number-badge">
    <span class="row-num" aria-label={`Handicap option ${index + 1}`}>{index + 1}</span>
    <span class="row-label">Handicap Line</span>
    <div class="row-divider" aria-hidden="true"></div>
  </div>
  <div class="row-fields">
    <div class="line-col">
      <LinePicker
        label="Handicap"
        value={pair.line}
        options={lineOptions}
        onChange={(v) => { pair.line = v; onChange(); }}
      />
    </div>
    <div class="odds-cols">
      <OddsPicker
        id={`hdp-${index}-a`}
        label={sideALabel}
        value={pair.sideA}
        onChange={(v) => { pair.sideA = v; onChange(); }}
      />
      <OddsPicker
        id={`hdp-${index}-b`}
        label={sideBLabel}
        value={pair.sideB}
        onChange={(v) => { pair.sideB = v; onChange(); }}
      />
    </div>
  </div>
</div>

<style>
  .line-row-hdp {
    background: var(--c-surface-2, rgba(255, 255, 255, 0.03));
    backdrop-filter: blur(10px);
    border-radius: 14px;
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.07));
    transition: border-color var(--t-base, 180ms ease);
    overflow: hidden;
  }
  .line-row-hdp:focus-within {
    border-color: color-mix(in srgb, var(--accent, #6366f1) 30%, rgba(255,255,255,0.07));
  }

  /* Numbered row header */
  .row-number-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px 0;
  }

  .row-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 6px;
    background: color-mix(in srgb, var(--accent, #f97316) 18%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent, #f97316) 35%, transparent);
    color: var(--accent, #f97316);
    font-size: 11px;
    font-weight: 900;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    flex-shrink: 0;
  }

  .row-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--c-muted, #8899bb);
  }

  .row-divider {
    flex: 1;
    height: 1px;
    background: var(--c-border, rgba(255,255,255,0.07));
  }

  /* Fields area */
  .row-fields {
    display: grid;
    grid-template-columns: minmax(130px, 0.9fr) 1fr;
    gap: 10px;
    padding: 10px 14px 14px;
  }

  .odds-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  @media (max-width: 640px) {
    .row-fields { grid-template-columns: 1fr; }
  }
  @media (max-width: 380px) {
    .odds-cols { grid-template-columns: 1fr; }
  }
</style>

