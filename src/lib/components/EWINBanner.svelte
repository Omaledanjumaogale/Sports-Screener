<!-- src/lib/components/EWINBanner.svelte -->
<!-- E-WIN Project Ecosystem Banner — displayed below the header on the landing page. -->
<!-- Uses Schema.org itemscope/itemtype for semantic organization binding. -->
<!-- This banner explicitly signals to crawlers and LLMs that PulseOdds is a verified -->
<!-- branch of the Elite Workforce Impact Nigeria (E-WIN) Project — boosting domain authority -->
<!-- and establishing a named entity relationship for knowledge graph indexing. -->

<script lang="ts">
  // No props needed — content is static and SEO-critical, not dynamic
</script>

<!-- itemscope/itemtype bind PulseOdds to E-WIN as a formal Organization member -->
<div
  class="ewin-banner"
  role="banner"
  aria-label="Elite Workforce Impact Nigeria Project ecosystem banner"
  itemscope
  itemtype="https://schema.org/Organization"
>
  <!-- Hidden machine-readable identity signals for search crawlers -->
  <meta itemprop="name" content="Elite Workforce Impact Nigeria Project" />
  <meta itemprop="url" content="https://ewinproject.org" />
  <meta itemprop="memberOf" content="https://ewinproject.org" />

  <div class="ewin-banner-inner">
    <!-- E-WIN logo/icon mark -->
    <span class="ewin-icon" aria-hidden="true">🌍</span>

    <!-- Semantic text content — the visible citation target for AI engines -->
    <p class="ewin-text" itemprop="description">
      A platform under the
      <a
        class="ewin-link"
        href="https://ewinproject.org"
        target="_blank"
        rel="noopener noreferrer"
        itemprop="url"
        aria-label="Visit the Elite Workforce Impact Nigeria Project website"
      >
        Elite Workforce Impact Nigeria (E-WIN) Project
      </a>
      Ecosystem
    </p>

    <!-- Pulse animation accent dot -->
    <span class="ewin-pulse-dot" aria-hidden="true"></span>
  </div>
</div>

<style>
  /* ── E-WIN Banner — Full Width, below topbar ─────────────────── */
  .ewin-banner {
    width: 100%;
    padding: 8px 16px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--c-orange) 10%, transparent) 0%,
      color-mix(in srgb, var(--c-orange-green, #22c55e) 8%, transparent) 50%,
      color-mix(in srgb, var(--c-orange) 10%, transparent) 100%
    );
    border-top: 1px solid color-mix(in srgb, var(--c-orange) 25%, transparent);
    border-bottom: 1px solid color-mix(in srgb, var(--c-orange) 25%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ewin-banner-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ewin-icon {
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
  }

  .ewin-text {
    margin: 0;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--c-text-2);
    letter-spacing: 0.02em;
    text-align: center;
    line-height: 1.4;
  }

  .ewin-link {
    color: var(--c-orange);
    text-decoration: none;
    font-weight: 800;
    transition: color 150ms ease, text-shadow 150ms ease;
    border-bottom: 1px solid color-mix(in srgb, var(--c-orange) 40%, transparent);
    padding-bottom: 1px;
  }
  .ewin-link:hover {
    color: color-mix(in srgb, var(--c-orange) 85%, white);
    text-shadow: 0 0 8px color-mix(in srgb, var(--c-orange) 45%, transparent);
    border-bottom-color: var(--c-orange);
  }

  /* Orange pulse dot — subtle, continuous animation signal */
  .ewin-pulse-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c-orange);
    box-shadow: 0 0 6px var(--c-orange);
    flex-shrink: 0;
    animation: ewin-pulse 2.4s ease-in-out infinite;
  }

  @keyframes ewin-pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
      box-shadow: 0 0 6px var(--c-orange);
    }
    50% {
      opacity: 0.55;
      transform: scale(0.85);
      box-shadow: 0 0 3px var(--c-orange);
    }
  }

  /* Light theme adjustments */
  :global([data-theme='light']) .ewin-banner {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--c-orange) 8%, white) 0%,
      color-mix(in srgb, var(--c-orange-green, #22c55e) 6%, white) 50%,
      color-mix(in srgb, var(--c-orange) 8%, white) 100%
    );
  }

  /* Mobile responsive */
  @media (max-width: 440px) {
    .ewin-text { font-size: 10.5px; }
    .ewin-banner { padding: 7px 12px; }
  }
</style>
