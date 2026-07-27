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

<div class="tabs-rail" aria-label="Match time scope" role="tablist">
  <div class="tabs-track">
    {#each tabs as tab, index}
      <button
        role="tab"
        aria-selected={index === selectedIndex}
        aria-controls={`scope-${tab.id}`}
        id={`tab-${tab.id}`}
        class="tab-pill"
        class:active={index === selectedIndex}
        onclick={() => onSelect(index)}
        tabindex={index === selectedIndex ? 0 : -1}
        onkeydown={(e) => {
          if (e.key === 'ArrowRight') onSelect((index + 1) % tabs.length);
          if (e.key === 'ArrowLeft')  onSelect((index - 1 + tabs.length) % tabs.length);
        }}
      >
        {#if index === selectedIndex}
          <span class="active-dot" aria-hidden="true"></span>
        {/if}
        {tab.title}
      </button>
    {/each}
  </div>
</div>

<style>
  .tabs-rail {
    padding: 12px 0 16px;
    overflow: hidden;
  }

  .tabs-track {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
    scroll-snap-type: x mandatory;
    -webkit-overflow-scrolling: touch;
  }
  .tabs-track::-webkit-scrollbar { display: none; }

  .tab-pill {
    flex: 0 0 auto;
    scroll-snap-align: start;
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    min-height: 40px;
    padding: 0 18px;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-brand, 'Outfit', system-ui);
    letter-spacing: -0.005em;
    white-space: nowrap;
    cursor: pointer;
    transition:
      background var(--t-base, 180ms ease),
      border-color var(--t-base, 180ms ease),
      color var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease),
      transform 80ms ease;

    /* Default glass state — theme adaptive */
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    color: var(--c-muted);
    backdrop-filter: blur(10px);
  }

  .tab-pill:hover {
    background: var(--c-glass-lg);
    border-color: var(--c-border-2);
    color: var(--c-text-2);
  }

  .tab-pill:active { transform: scale(0.96); }

  .tab-pill.active {
    background: color-mix(in srgb, var(--accent, #f97316) 18%, var(--c-glass-sm));
    border-color: color-mix(in srgb, var(--accent, #f97316) 55%, transparent);
    color: var(--c-text);
    font-weight: 800;
    box-shadow:
      0 0 16px color-mix(in srgb, var(--accent, #f97316) 25%, transparent),
      0 0 0 1px color-mix(in srgb, var(--accent, #f97316) 30%, transparent) inset;
  }

  .active-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent, #f97316);
    box-shadow: 0 0 8px var(--accent, #f97316);
    animation: dot-pulse 2s ease-in-out infinite;
    flex-shrink: 0;
  }
</style>
