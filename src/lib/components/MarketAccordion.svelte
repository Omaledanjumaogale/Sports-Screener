<script lang="ts">
  let {
    title,
    primary = false,
    open = false,
    accent = '#6366f1',
    children
  }: {
    title: string;
    primary?: boolean;
    open?: boolean;
    accent?: string;
    children?: any;
  } = $props();
</script>

<details class="market" {open} style={`--accent:${accent}`}>
  <summary aria-label={`${title} market${primary ? ' — primary' : ''}`}>
    {#if primary}
      <span class="primary-stripe" aria-hidden="true"></span>
    {/if}
    <span class="market-title">{title}</span>
    {#if primary}
      <em class="primary-tag" aria-label="Primary market">Primary</em>
    {/if}
    <span class="chevron" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </span>
  </summary>
  <div class="market-body">
    {@render children?.()}
  </div>
</details>

<style>
  .market {
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 14px;
    overflow: hidden;
    transition:
      border-color var(--t-base, 180ms ease),
      box-shadow var(--t-base, 180ms ease);
  }
  .market[open] {
    border-color: color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.08));
    box-shadow: 0 4px 24px color-mix(in srgb, var(--accent) 8%, transparent);
  }

  summary {
    list-style: none;
    min-height: 52px;
    padding: 0 16px;
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
    cursor: pointer;
    user-select: none;
    transition: background var(--t-fast, 100ms ease);
    font-weight: 700;
    position: relative;
  }
  summary::-webkit-details-marker { display: none; }
  summary:hover { background: rgba(255, 255, 255, 0.04); }

  /* Primary accent bar */
  .primary-stripe {
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent));
    border-radius: 14px 0 0 14px;
  }
  .market[open] .primary-stripe { width: 4px; }

  .market-title {
    font-size: 13.5px;
    color: var(--c-text, #f1f5ff);
    letter-spacing: -0.01em;
    padding-left: 0;
  }
  .market[open] .market-title { color: #fff; }

  .primary-tag {
    font-style: normal;
    color: var(--accent);
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 900;
    letter-spacing: 0.07em;
    padding: 3px 9px;
    background: color-mix(in srgb, var(--accent) 14%, rgba(255,255,255,0.04));
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
    box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 12%, transparent);
  }

  .chevron {
    width: 28px; height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--c-muted, #8899bb);
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    transition:
      transform 250ms cubic-bezier(0.34, 1.56, 0.64, 1),
      color var(--t-base, 180ms ease),
      background var(--t-base, 180ms ease);
  }
  .market[open] .chevron {
    transform: rotate(180deg);
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, rgba(255,255,255,0.05));
  }

  .market-body {
    padding: 4px 14px 16px;
    border-top: 1px solid rgba(255,255,255,0.06);
    animation: slide-up 0.22s ease both;
  }
</style>
