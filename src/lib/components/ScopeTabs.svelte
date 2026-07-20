<script lang="ts">
  let {
    tabs,
    selectedIndex,
    onSelect
  }: {
    tabs: { id: string; title: string }[];
    selectedIndex: number;
    onSelect: (index: number) => void;
  } = $props();
</script>

<div class="scope-tabs" aria-label="Match scope tabs" role="tablist">
  {#each tabs as tab, index}
    <button
      role="tab"
      aria-selected={index === selectedIndex}
      aria-controls={`scope-${tab.id}`}
      id={`tab-${tab.id}`}
      class:active={index === selectedIndex}
      onclick={() => onSelect(index)}
      tabindex={index === selectedIndex ? 0 : -1}
      onkeydown={(e) => {
        if (e.key === 'ArrowRight') onSelect((index + 1) % tabs.length);
        if (e.key === 'ArrowLeft') onSelect((index - 1 + tabs.length) % tabs.length);
      }}
    >
      {tab.title}
    </button>
  {/each}
</div>

<style>
  .scope-tabs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding: 10px 0 16px;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
  }
  .scope-tabs::-webkit-scrollbar { display: none; }
  .scope-tabs button {
    flex: 0 0 auto;
    scroll-snap-align: start;
    border: 1px solid #27344a;
    color: #dbe8f9;
    background: #101827;
    border-radius: 10px;
    min-height: 44px;
    padding: 0 16px;
    font-weight: 700;
    font-size: 13.5px;
    transition: background 120ms, border-color 120ms, color 120ms;
  }
  .scope-tabs button:hover { border-color: #465a7e; }
  .scope-tabs button.active {
    border-color: var(--accent, #22c55e);
    background: color-mix(in srgb, var(--accent, #22c55e) 20%, #101827);
    color: #ffffff;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent, #22c55e) 40%, transparent) inset;
  }
</style>
