<script lang="ts">
  import OddsPicker from './OddsPicker.svelte';

  let {
    odds,
    labels = {} as Record<string, string>,
    columns = 'auto' as number | 'auto',
    onChange = () => {}
  }: {
    odds: Record<string, number | null>;
    labels?: Record<string, string>;
    columns?: number | 'auto';
    onChange?: () => void;
  } = $props();

  let keys = $derived(Object.keys(odds));
  let colNum = $derived(
    typeof columns === 'number'
      ? columns
      : Math.max(1, Math.min(3, Math.ceil(Math.sqrt(Math.max(1, Object.keys(odds).length)))))
  );
</script>

<div class="odds-grid-wrap" style={`--cols:${colNum}`}>
  {#each keys as key, i}
    <OddsPicker
      id={`og-${i}`}
      label={labels[key] ?? key}
      value={odds[key]}
      onChange={(v) => { odds[key] = v; onChange(); }}
    />
  {/each}
</div>

<style>
  .odds-grid-wrap {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    gap: 10px;
    padding-top: 10px;
  }
  @media (max-width: 560px) {
    .odds-grid-wrap { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 360px) {
    .odds-grid-wrap { grid-template-columns: 1fr; }
  }
</style>
