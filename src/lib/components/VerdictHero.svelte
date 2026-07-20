<script lang="ts">
  import type { Status } from '../engine';

  let {
    headline,
    chips = [] as { label: string; value: string; status: Status }[]
  }: {
    headline: string;
    chips?: { label: string; value: string; status: Status }[];
  } = $props();
</script>

<section class="verdict" aria-label="Screening verdict">
  <!-- Dot grid decorative overlay -->
  <div class="dot-grid" aria-hidden="true"></div>

  <div class="headline-wrap">
    <div class="verdict-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2L10.8 7.2H16.4L11.8 10.4L13.6 15.6L9 12.4L4.4 15.6L6.2 10.4L1.6 7.2H7.2L9 2Z"
              fill="currentColor" opacity="0.9"/>
      </svg>
    </div>
    <p class="headline">{headline}</p>
  </div>

  {#if chips.length}
    <div class="chips" role="list" aria-label="Profile status summary">
      {#each chips as chip}
        <span class={`chip chip-${chip.status}`} role="listitem">
          <b class="chip-label">{chip.label}</b>
          <span class="chip-value">{chip.value}</span>
        </span>
      {/each}
    </div>
  {/if}
</section>

<style>
  .verdict {
    position: relative;
    padding: 20px;
    border-radius: 18px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--accent, #6366f1) 40%, rgba(255,255,255,0.08));
    background:
      linear-gradient(
        145deg,
        color-mix(in srgb, var(--accent, #6366f1) 12%, rgba(255,255,255,0.03)) 0%,
        rgba(255,255,255,0.02) 100%
      );
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    box-shadow: 0 0 32px color-mix(in srgb, var(--accent, #6366f1) 10%, transparent);
    animation: slide-up 0.35s ease both;
  }

  /* Decorative dot-grid overlay */
  .dot-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
    mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%);
  }

  .headline-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }

  .verdict-icon {
    flex-shrink: 0;
    margin-top: 2px;
    width: 22px; height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--accent, #6366f1);
    filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent, #6366f1) 70%, transparent));
  }

  .headline {
    margin: 0;
    line-height: 1.5;
    font-weight: 700;
    font-size: clamp(13.5px, 3.8vw, 15.5px);
    color: var(--c-text, #f1f5ff);
    letter-spacing: -0.008em;
  }

  /* Chips */
  .chips {
    position: relative;
    z-index: 1;
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 16px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 30px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 600;
    border: 1px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.05);
    color: var(--c-text-2, #c8d6ee);
    transition: box-shadow var(--t-base);
    animation: slide-in-right 0.3s ease both;
  }

  .chip-label { font-weight: 800; letter-spacing: 0.02em; }
  .chip-value { font-family: var(--font-mono, 'JetBrains Mono', monospace); opacity: 0.9; }

  .chip-green {
    color: #86efac;
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.22);
    box-shadow: 0 0 10px rgba(34, 197, 94, 0.12);
  }
  .chip-amber {
    color: #fde68a;
    background: rgba(245, 158, 11, 0.10);
    border-color: rgba(245, 158, 11, 0.22);
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.12);
  }
  .chip-red {
    color: #fecdd3;
    background: rgba(251, 113, 133, 0.10);
    border-color: rgba(251, 113, 133, 0.22);
    box-shadow: 0 0 10px rgba(251, 113, 133, 0.12);
  }
  .chip-empty { opacity: 0.55; }
</style>
