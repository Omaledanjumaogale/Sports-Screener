<script lang="ts">
  import { onMount } from 'svelte';
  import { Shield, Brain, Layers, Cpu, Zap, Wifi, WifiOff, Sparkles, Globe, TrendingUp, CheckCircle2 } from '@lucide/svelte';

  let isOnline = $state(true);

  onMount(() => {
    if (typeof window !== 'undefined') {
      isOnline = navigator.onLine;
      const handleOnline = () => { isOnline = true; };
      const handleOffline = () => { isOnline = false; };
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  });

  const offlinePillars = [
    {
      icon: Shield,
      title: 'Prime Directive — Data Fidelity',
      color: '#38bdf8',
      desc: 'Computes strictly on entered odds & lines. Zero external stat scraping, zero hallucinated form, zero unentered assumptions.'
    },
    {
      icon: Brain,
      title: 'Uninflated Market Probability',
      color: '#22c55e',
      desc: 'Plain de-vigged implied probability directly from bookmaker pricing. Probability is never fake-boosted or artificially inflated.'
    },
    {
      icon: Layers,
      title: 'Multi-Angle Confluence Ledger',
      color: '#f97316',
      desc: 'Cross-verifies Primary Scopes, Time Segments, Market Inconsistencies, Scoreline Clusters, and Best Line Rankings into a unified ledger.'
    },
    {
      icon: Cpu,
      title: '4-Tier Confluence Ranking',
      color: '#e879f9',
      desc: 'Refuses high confidence unless multiple independent market angles agree. Contradictions instantly cap candidates to Conflicted Tier.'
    }
  ];

  const onlineAiPillars = [
    {
      icon: Zap,
      title: 'Edge-Driven Neural Verdicts',
      color: '#f97316',
      desc: 'Executes high-speed Cloudflare Workers AI neural model inference directly on edge nodes to generate instant second-opinion analysis without slowing down your screening.'
    },
    {
      icon: Brain,
      title: 'Deep Confluence & Match Verdicts',
      color: '#e879f9',
      desc: 'Cross-analyzes all entered bookmaker odds, time segments, and scoreline clusters to produce clear, structured match verdicts and probability assessments.'
    },
    {
      icon: TrendingUp,
      title: 'Smart Risk & Value Guidance',
      color: '#22c55e',
      desc: 'Delivers automated risk warnings, stake sizing advice, and market value ratings, highlighting hidden risks or strong statistical alignments.'
    },
    {
      icon: Globe,
      title: 'Seamless Dual-Mode Operation',
      color: '#38bdf8',
      desc: 'Operates 100% offline using standalone mathematical rules, then seamlessly attaches live AI recommendations whenever network connectivity is detected.'
    }
  ];
</script>

<div class="master-model-showcase" aria-label="Master Model & Cloudflare AI Framework Showcase">
  <!-- ── 1. The Offline Master Model Framework ────────────────────────── -->
  <div class="showcase-header">
    <div class="header-badge">
      <Brain size={14} />
      <span>Application Brain Box</span>
    </div>
    <h2 class="showcase-title">The Offline Master Model Framework</h2>
    <p class="showcase-sub">
      Multi-sport odds &amp; lines analytical constitution. Operates 100% offline with zero web dependencies. Harmonies 5 sports with standalone screeners, cross-scope ledgers, and 4-tier confluence verification.
    </p>
  </div>

  <!-- Offline Framework 4 Pillars Grid -->
  <div class="pillars-grid">
    {#each offlinePillars as p}
      <div class="pillar-card" style={`--p-color: ${p.color}`}>
        <div class="pillar-icon">
          <p.icon size={20} />
        </div>
        <h3 class="pillar-title">{p.title}</h3>
        <p class="pillar-desc">{p.desc}</p>
      </div>
    {/each}
  </div>

  <!-- ── 2. The Online Cloudflare Workers AI Framework ──────────────── -->
  <div class="showcase-header ai-header">
    <div class="header-badge ai-badge">
      <Sparkles size={14} />
      <span>Cloudflare Workers AI Layer</span>
    </div>

    <!-- Network Status Indicator Badge -->
    <div class="network-status-bar" class:is-online={isOnline}>
      {#if isOnline}
        <span class="status-dot online-dot" aria-hidden="true"></span>
        <Wifi size={14} class="wifi-icon" />
        <span class="status-text">Connected — Online AI Blanket Active</span>
      {:else}
        <span class="status-dot offline-dot" aria-hidden="true"></span>
        <WifiOff size={14} class="wifi-icon" />
        <span class="status-text">Disconnected — Offline Math Mode Active</span>
      {/if}
    </div>

    <h2 class="showcase-title">The Online Cloudflare Workers AI Framework</h2>
    <p class="showcase-sub">
      An intelligent AI layer running on Cloudflare Edge Worker AI. Automatically augments the offline Master Model with instant AI verdicts &amp; recommendations when your device is connected to the internet.
    </p>
  </div>

  <!-- Online AI Framework 4 Pillars Grid -->
  <div class="pillars-grid">
    {#each onlineAiPillars as p}
      <div class="pillar-card" style={`--p-color: ${p.color}`}>
        <div class="pillar-icon">
          <p.icon size={20} />
        </div>
        <h3 class="pillar-title">{p.title}</h3>
        <p class="pillar-desc">{p.desc}</p>
      </div>
    {/each}
  </div>
</div>

<style>
  .master-model-showcase {
    width: 100%;
    margin: 32px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .showcase-header {
    text-align: center;
    max-width: 760px;
    margin-bottom: 28px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .ai-header {
    margin-top: 24px;
  }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--c-orange, #f97316);
    background: color-mix(in srgb, var(--c-orange, #f97316) 12%, var(--c-surface));
    border: 1px solid color-mix(in srgb, var(--c-orange, #f97316) 30%, transparent);
    margin-bottom: 12px;
  }

  .ai-badge {
    color: var(--c-rally, #38bdf8);
    background: color-mix(in srgb, var(--c-rally, #38bdf8) 12%, var(--c-surface));
    border-color: color-mix(in srgb, var(--c-rally, #38bdf8) 30%, transparent);
  }

  /* Network Status Bar */
  .network-status-bar {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 14px;
    transition: all 200ms ease;
    background: color-mix(in srgb, var(--c-amber, #f59e0b) 12%, var(--c-surface-2));
    border: 1px solid color-mix(in srgb, var(--c-amber, #f59e0b) 35%, transparent);
    color: var(--c-amber, #f59e0b);
  }

  .network-status-bar.is-online {
    background: color-mix(in srgb, var(--c-green, #22c55e) 12%, var(--c-surface-2));
    border-color: color-mix(in srgb, var(--c-green, #22c55e) 35%, transparent);
    color: var(--c-green, #22c55e);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
  }

  .online-dot {
    background: var(--c-green, #22c55e);
    box-shadow: 0 0 10px var(--c-green, #22c55e);
    animation: pulse-dot 1.8s ease-in-out infinite;
  }

  .offline-dot {
    background: var(--c-amber, #f59e0b);
    box-shadow: 0 0 6px var(--c-amber, #f59e0b);
  }

  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.3); opacity: 0.6; }
  }

  :global(.wifi-icon) {
    flex-shrink: 0;
  }

  .showcase-title {
    font-size: clamp(20px, 4.5vw, 32px);
    font-weight: 900;
    color: var(--c-text);
    line-height: 1.25;
    margin: 0 0 10px;
  }

  .showcase-sub {
    font-size: clamp(13px, 2.6vw, 15px);
    color: var(--c-muted);
    line-height: 1.6;
    margin: 0;
    font-weight: 500;
  }

  /* Pillars Grid */
  .pillars-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 14px;
    width: 100%;
    margin-bottom: 32px;
  }

  .pillar-card {
    background: var(--c-surface-2);
    border: 1px solid var(--c-border);
    border-radius: 16px;
    padding: 20px;
    text-align: left;
    contain: layout style;
    transition: transform 180ms ease, border-color 180ms ease;
  }

  .pillar-card:hover {
    transform: translateY(-2px);
    border-color: color-mix(in srgb, var(--p-color) 45%, transparent);
  }

  .pillar-icon {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: color-mix(in srgb, var(--p-color) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--p-color) 35%, transparent);
    color: var(--p-color);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }

  .pillar-title {
    font-size: 15px;
    font-weight: 800;
    color: var(--c-text);
    margin: 0 0 6px;
    line-height: 1.3;
  }

  .pillar-desc {
    font-size: 12.5px;
    color: var(--c-muted);
    line-height: 1.5;
    margin: 0;
    font-weight: 500;
  }
</style>

