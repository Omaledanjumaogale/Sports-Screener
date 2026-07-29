<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Zap, Wifi, WifiOff, RefreshCw, Bot, AlertTriangle, CheckCircle2, ShieldCheck } from '@lucide/svelte';
  import {
    requestCloudflareAiAnalysis,
    isOnline,
    type AiAnalysisRequest,
    type AiAnalysisResult
  } from '$lib/cloudflareAi';
  import type { MasterConfluenceLedger, Profile, Pick, SportId } from '$lib/engine';

  let {
    sportId = 'football' as SportId,
    sportTitle = 'Sports',
    scopeTitle = '',
    ledger = null as MasterConfluenceLedger | null,
    profiles = [] as Profile[],
    picks = [] as Pick[],
    metrics = [] as { label: string; value: string; note?: string }[],
    accent = '#38bdf8',
    autoFetch = true,
    compact = false
  }: {
    sportId?: SportId;
    sportTitle?: string;
    scopeTitle?: string;
    ledger?: MasterConfluenceLedger | null;
    profiles?: Profile[];
    picks?: Pick[];
    metrics?: { label: string; value: string; note?: string }[];
    accent?: string;
    autoFetch?: boolean;
    compact?: boolean;
  } = $props();

  let online: boolean = $state(true);
  let loading: boolean = $state(false);
  let result: AiAnalysisResult | null = $state(null);
  let errorMessage: string | null = $state(null);
  let autoTriggered: boolean = $state(false);

  function checkNetwork() {
    online = isOnline();
  }

  async function generateInsights(isAuto = false) {
    if (!online || loading) return;
    // Don't re-auto-trigger if already has a result
    if (isAuto && result) return;
    loading = true;
    errorMessage = null;

    const req: AiAnalysisRequest = {
      sportId,
      sportTitle,
      scopeTitle,
      ledger,
      profiles,
      picks,
      metrics
    };

    const res = await requestCloudflareAiAnalysis(req);
    loading = false;

    if (res.success) {
      result = res;
    } else {
      errorMessage = res.error || 'Failed to fetch Cloudflare Workers AI insights.';
    }
  }

  let handleOnline: () => void;
  let handleOffline: () => void;

  onMount(() => {
    checkNetwork();
    handleOnline = () => {
      online = true;
      // Auto-trigger when connection restored and autoFetch is on
      if (autoFetch && !autoTriggered) {
        autoTriggered = true;
        void generateInsights(true);
      }
    };
    handleOffline = () => { online = false; };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Auto-trigger immediately if online and autoFetch enabled
    if (autoFetch && online) {
      autoTriggered = true;
      void generateInsights(true);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      if (handleOnline) window.removeEventListener('online', handleOnline);
      if (handleOffline) window.removeEventListener('offline', handleOffline);
    }
  });
</script>

<div class="cf-ai-banner" class:compact style={`--cf-accent: ${accent}`}>
  <div class="cf-ai-header">
    <div class="cf-brand">
      <span class="ai-icon-box">
        <Zap size={16} />
      </span>
      {#if !compact}
        <div class="brand-text">
          <span class="sub-tag">Cloudflare Workers AI Copilot</span>
          <h4 class="ai-title">Real-Time Odds &amp; Verdict Analysis</h4>
        </div>
      {:else}
        <span class="ai-title-compact">AI Copilot</span>
      {/if}
    </div>

    <div class="network-badge" class:is-online={online} class:is-offline={!online}>
      {#if online}
        <span class="pulse-dot" aria-hidden="true"></span>
        <Wifi size={12} />
        <span>{loading ? 'Analyzing…' : 'Online'}</span>
      {:else}
        <WifiOff size={12} />
        <span>Offline</span>
      {/if}
    </div>
  </div>

  <div class="cf-ai-body">
    {#if online && !result && !loading && !errorMessage}
      <p class="cf-ai-description">
        Cloudflare Workers AI (Llama 3.1 8B) is analyzing your screener data for instant tactical recommendations.
      </p>
    {:else if !online}
      <div class="offline-notice" role="status">
        <WifiOff size={14} />
        <div>
          <strong>Offline Mode Active</strong>
          <p>All local Master Model analysis, Confluence Ledger, and pick scoring remain fully operational. Connect to the internet for AI-powered recommendations.</p>
        </div>
      </div>
    {/if}

    <!-- Loading state -->
    {#if loading}
      <div class="loading-state" role="status" aria-label="Generating AI insights">
        <div class="loading-bar">
          <div class="loading-progress"></div>
        </div>
        <p class="loading-text">
          <RefreshCw size={13} class="spin-icon-inline" />
          Llama 3.1 is reading the odds &amp; generating your verdict…
        </p>
      </div>
    {/if}

    <!-- AI Insights Output -->
    {#if result && result.insights}
      <div class="insights-container">
        <div class="insights-grid">
          <div class="insight-box verdict">
            <div class="box-head">
              <ShieldCheck size={13} />
              <span>AI Verdict</span>
            </div>
            <p class="box-content">{result.insights.verdictSummary}</p>
          </div>

          <div class="insight-box value">
            <div class="box-head">
              <CheckCircle2 size={13} />
              <span>Value Read</span>
            </div>
            <p class="box-content">{result.insights.valueAssessment}</p>
          </div>

          <div class="insight-box risk">
            <div class="box-head">
              <AlertTriangle size={13} />
              <span>Risk Warning</span>
            </div>
            <p class="box-content">{result.insights.riskWarning}</p>
          </div>

          <div class="insight-box action">
            <div class="box-head">
              <Zap size={13} />
              <span>Slip Action</span>
            </div>
            <p class="box-content">{result.insights.tacticalRecommendation}</p>
          </div>
        </div>

        <div class="insights-foot">
          <span class="model-tag">{result.model}</span>
          {#if result.neuronsUsed}
            <span class="neuron-tag">{result.neuronsUsed.toFixed(2)} Neurons</span>
          {/if}
          <button class="refresh-btn" type="button" onclick={() => generateInsights(false)} disabled={loading}>
            <RefreshCw size={11} />
            Re-analyze
          </button>
        </div>
      </div>
    {/if}

    <!-- Manual trigger when auto didn't fire or user wants fresh analysis -->
    {#if !loading && !result && online}
      <button
        type="button"
        class="generate-btn"
        onclick={() => generateInsights(false)}
      >
        <Bot size={15} />
        <span>Get AI Recommendation Now</span>
      </button>
    {/if}

    {#if errorMessage}
      <div class="error-banner" role="alert">
        <AlertTriangle size={14} />
        <span>{errorMessage}</span>
        {#if online}
          <button type="button" class="retry-btn" onclick={() => generateInsights(false)}>Retry</button>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .cf-ai-banner {
    background: var(--c-surface-2);
    border: 1px solid var(--c-border);
    border-radius: 16px;
    padding: 14px 16px;
    margin: 12px 0;
    position: relative;
    overflow: hidden;
    contain: layout style;
    transition: border-color 180ms ease;
  }

  .cf-ai-banner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #f38020, #faad3f, var(--cf-accent));
  }

  .cf-ai-banner.compact {
    padding: 10px 14px;
    border-radius: 12px;
  }

  .cf-ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--c-border-sm);
    margin-bottom: 10px;
  }

  .cf-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
  }

  .ai-icon-box {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: color-mix(in srgb, #f38020 16%, transparent);
    border: 1px solid color-mix(in srgb, #f38020 30%, transparent);
    color: #f38020;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .sub-tag {
    display: block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #f38020;
    line-height: 1.2;
  }

  .ai-title {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    color: var(--c-text);
    line-height: 1.2;
  }

  .ai-title-compact {
    font-size: 13px;
    font-weight: 800;
    color: var(--c-text);
  }

  /* Network badge */
  .network-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid transparent;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .network-badge.is-online {
    background: color-mix(in srgb, var(--c-green) 10%, transparent);
    border-color: color-mix(in srgb, var(--c-green) 30%, transparent);
    color: var(--c-green);
  }

  .network-badge.is-offline {
    background: color-mix(in srgb, var(--c-muted) 10%, transparent);
    border-color: color-mix(in srgb, var(--c-muted) 25%, transparent);
    color: var(--c-muted);
  }

  .pulse-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c-green);
    box-shadow: 0 0 6px var(--c-green);
    animation: pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1.25); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
  }

  /* Body */
  .cf-ai-description {
    font-size: 12px;
    color: var(--c-muted);
    line-height: 1.45;
    margin: 0 0 10px;
  }

  /* Offline notice */
  .offline-notice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--c-muted) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-muted) 20%, transparent);
    color: var(--c-muted);
    font-size: 12px;
    line-height: 1.4;
  }

  .offline-notice strong {
    display: block;
    font-weight: 700;
    color: var(--c-text);
    margin-bottom: 2px;
    font-size: 12.5px;
  }

  .offline-notice p {
    margin: 0;
    font-size: 11.5px;
  }

  /* Loading bar */
  .loading-state {
    margin: 4px 0 8px;
  }

  .loading-bar {
    height: 3px;
    background: var(--c-border-sm);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 7px;
  }

  .loading-progress {
    height: 100%;
    width: 45%;
    background: linear-gradient(90deg, #f38020, #faad3f);
    border-radius: 2px;
    animation: slide-progress 1.4s ease-in-out infinite;
  }

  @keyframes slide-progress {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(320%); }
  }

  .loading-text {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--c-muted);
    margin: 0;
  }

  :global(.spin-icon-inline) {
    animation: spin 1s linear infinite;
    flex-shrink: 0;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Insights grid */
  .insights-container {
    animation: fade-in 0.25s ease both;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .insights-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  @media (max-width: 480px) {
    .insights-grid { grid-template-columns: 1fr; }
  }

  .insight-box {
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border-sm);
    border-radius: 10px;
    padding: 9px 11px;
  }

  .box-head {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }

  .insight-box.verdict .box-head { color: var(--cf-accent); }
  .insight-box.value .box-head { color: var(--c-green); }
  .insight-box.risk .box-head { color: var(--c-orange); }
  .insight-box.action .box-head { color: #f38020; }

  .box-content {
    margin: 0;
    font-size: 12px;
    color: var(--c-text);
    line-height: 1.4;
    font-weight: 500;
  }

  .insights-foot {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 8px;
    font-size: 10.5px;
    color: var(--c-faint);
    flex-wrap: wrap;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    background: transparent;
    border: 1px solid var(--c-border-sm);
    color: var(--c-muted);
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: color 120ms, border-color 120ms, background 120ms;
  }

  .refresh-btn:hover:not(:disabled) {
    color: #f38020;
    border-color: color-mix(in srgb, #f38020 40%, transparent);
    background: color-mix(in srgb, #f38020 6%, transparent);
  }

  .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Manual generate button */
  .generate-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #f38020, #e06000);
    color: #fff;
    border: none;
    padding: 9px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-brand, 'Outfit', system-ui);
    cursor: pointer;
    transition: transform 120ms, box-shadow 120ms;
    box-shadow: 0 2px 10px rgba(243,128,32,0.28);
    margin-top: 2px;
  }

  .generate-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(243,128,32,0.40);
  }

  .generate-btn:active { transform: translateY(0); }

  /* Error banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--c-red) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-red) 28%, transparent);
    color: var(--c-red);
    font-size: 12px;
    font-weight: 600;
    margin-top: 8px;
  }

  .retry-btn {
    margin-left: auto;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--c-red) 35%, transparent);
    color: var(--c-red);
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms;
  }

  .retry-btn:hover {
    background: color-mix(in srgb, var(--c-red) 10%, transparent);
  }
</style>
