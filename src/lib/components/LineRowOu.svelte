<script lang="ts">
  import LinePicker from './LinePicker.svelte';
  import OddsPicker from './OddsPicker.svelte';
  import type { LinePair } from '../engine';

  let {
    pair,
    lineOptions = [] as number[],
    index = 0,
    onChange = () => {}
  }: {
    pair: LinePair;
    lineOptions?: number[];
    index?: number;
    onChange?: () => void;
  } = $props();
</script>

<div class="line-row-ou" aria-label={`O/U line row ${index + 1}`} role="group">
  <div class="line-col">
    <LinePicker
      label="Line"
      value={pair.line}
      options={lineOptions}
      onChange={(v) => { pair.line = v; onChange(); }}
    />
  </div>
  <div class="odds-cols">
    <OddsPicker
      id={`ou-${index}-over`}
      label="Over"
      value={pair.over}
      onChange={(v) => { pair.over = v; onChange(); }}
    />
    <OddsPicker
      id={`ou-${index}-under`}
      label="Under"
      value={pair.under}
      onChange={(v) => { pair.under = v; onChange(); }}
    />
  </div>
</div>

<style>
  .line-row-ou {
    display: grid;
    grid-template-columns: minmax(120px, 0.9fr) 1fr;
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
    .line-row-ou { grid-template-columns: 1fr; }
    .odds-cols { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 380px) {
    .odds-cols { grid-template-columns: 1fr; }
  }
</style>
