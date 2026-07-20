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

<style>
  .line-row-hdp {
    display: grid;
    grid-template-columns: minmax(130px, 0.9fr) 1fr;
    gap: 10px;
    padding: 12px;
    background: #111c2f;
    border-radius: 12px;
    border: 1px solid #1a2944;
  }
  .odds-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 640px) {
    .line-row-hdp { grid-template-columns: 1fr; }
  }
  @media (max-width: 380px) {
    .odds-cols { grid-template-columns: 1fr; }
  }
</style>
