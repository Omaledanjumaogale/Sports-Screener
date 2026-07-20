<script lang="ts">
  import { ArrowLeft, RotateCcw } from '@lucide/svelte';

  let {
    title,
    short,
    accent,
    onBack,
    onClear
  }: {
    title: string;
    short: string;
    accent: string;
    onBack: () => void;
    onClear: () => void;
  } = $props();
</script>

<header class="topbar" style={`--accent:${accent}`}>
  <button
    class="icon-button"
    aria-label="Back to sports selection"
    onclick={onBack}
  >
    <ArrowLeft size={22} stroke-width={2.2} />
  </button>
  <div class="title-block">
    <p class="eyebrow">{short}</p>
    <h1>{title}</h1>
  </div>
  <button
    class="icon-button"
    aria-label="Clear all odds for current scope"
    onclick={onClear}
  >
    <RotateCcw size={20} stroke-width={2} />
  </button>
</header>

<style>
  .topbar {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    gap: 10px;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 20;
    background: rgba(8, 11, 18, 0.94);
    -webkit-backdrop-filter: saturate(180%) blur(16px);
    backdrop-filter: saturate(180%) blur(16px);
    padding: 10px 0 14px;
    border-bottom: 1px solid rgba(39, 52, 74, 0.5);
    margin: 0 -2px;
  }
  .eyebrow {
    margin: 0 0 4px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
    font-weight: 800;
  }
  .title-block h1 {
    font-size: clamp(18px, 5.2vw, 24px);
    margin: 0;
    line-height: 1.15;
    letter-spacing: -0.01em;
  }
  .icon-button {
    width: 46px;
    height: 46px;
    border: 1px solid #27344a;
    border-radius: 12px;
    background: #101827;
    color: #f7fbff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 120ms, border-color 120ms, transform 80ms;
  }
  .icon-button:hover { border-color: #465a7e; background: #142036; }
  .icon-button:active { transform: scale(0.96); }
</style>
