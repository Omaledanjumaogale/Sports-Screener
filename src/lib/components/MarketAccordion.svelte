<script lang="ts">
  let {
    title,
    primary = false,
    open = false,
    accent = '#22c55e',
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
    <span class="market-title">{title}</span>
    {#if primary}
      <em class="primary-tag" aria-label="Primary market">Primary</em>
    {/if}
    <span class="chevron" aria-hidden="true">›</span>
  </summary>
  <div class="market-body">
    {@render children?.()}
  </div>
</details>

<style>
  .market {
    border: 1px solid #223047;
    background: #0f1726;
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 140ms;
  }
  .market[open] { border-color: #2e4065; }
  summary {
    list-style: none;
    min-height: 54px;
    padding: 0 16px;
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    align-items: center;
    cursor: pointer;
    user-select: none;
    transition: background 120ms;
    font-weight: 700;
  }
  summary::-webkit-details-marker { display: none; }
  summary:hover { background: #13203a; }
  .market-title {
    font-size: 14px;
    color: #eaf3ff;
    letter-spacing: -0.005em;
  }
  .primary-tag {
    font-style: normal;
    color: var(--accent);
    font-size: 10.5px;
    text-transform: uppercase;
    font-weight: 800;
    letter-spacing: 0.06em;
    padding: 4px 9px;
    background: color-mix(in srgb, var(--accent) 16%, #111c2f);
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  }
  .chevron {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: #8ea3c3;
    font-size: 22px;
    transform: rotate(90deg);
    transition: transform 180ms ease;
    border-radius: 6px;
    background: #111c2f;
  }
  .market[open] .chevron { transform: rotate(-90deg); }
  .market-body {
    padding: 2px 14px 14px;
    border-top: 1px solid #1b2840;
    animation: fadeIn 220ms ease;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
