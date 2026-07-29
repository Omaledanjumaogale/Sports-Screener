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
    sportId,
    sportTitle,
    scopeTitle,
    ledger,
    profiles,
    picks,
    metrics,
    accent = '#38bdf8'
  }: {
    sportId: SportId;
    sportTitle: string;
    scopeTitle: string;
    ledger: MasterConfluenceLedger | null;
    profiles: Profile[];
    picks: Pick[];
    metrics: { label: string; value: string; note?: string }[];
    accent?: string;
  } = $props();

  let online: boolean = $state(true);
  let loading: boolean = $state(false);
  let result: AiAnalysisResult | null = $state(null);
  let errorMessage: string | null = $state(null);

  function checkNetwork() {
    online = isOnline();
  }

  async function generateInsights() {
    if (!online || loading) return;
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
    handleOnline = () => { online = true; };
    handleOffline = () => { online = false; };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      if (handleOnline) window.removeEventListener('online', handleOnline);
      if (handleOffline) window.removeEventListener('offline', handleOffline);
    }
  });
</script>

<div class="cf-ai-banner" style={`--cf-accent: ${accent}`}>
  <div class="cf-ai-header">
    <div class="cf-brand">
      <span class="ai-icon-box">
        <Zap size={16} class="zap-icon" />
      </span>
      <div class="brand-text">
        <span class="sub-tag">Cloudflare Workers AI Copilot</span>
        <h4 class="ai-title">Real-Time Odds & Verdict Assistance</h4>
      </div>
    </div>

    <div class="network-badge" class:is-online={online} class:is-offline={!online}>
      {#if online}
        <span class="pulse-dot"></span>
        <Wifi size={13} />
        <span>Workers AI Online</span>
      {:else}
        <WifiOff size={13} />
        <span>Offline (Master Model Active)</span>
      {/if}
    </div>
  </div>

  <div class="cf-ai-body">
    <p class="cf-ai-description">
      {#if online}
        Cloudflare Workers AI (Llama 3.1 8B Instruct) analyzes your current screener input online to generate instant tactical recommendations.
      {:else}
        Network disconnected. Offline Master Model computations, profile scoring, and Confluence Ledger remain 100% operational locally.
      {/if}
    </p>

    <div class="action-row">
      <button
        type="button"
        class="generate-btn"
        disabled={!online || loading}
        onclick={generateInsights}
      >
        {#if loading}
          <RefreshCw size={15} class="spin-icon" />
          <span>Analyzing via Workers AI...</span>
        {:else if result}
          <RefreshCw size={15} />
          <span>Re-analyze with Cloudflare AI</span>
        {:else}
          <Bot size={15} />
          <span>Get Cloudflare Workers AI Recommendation</span>
        {/if}
      </button>
    </div>

    <!-- AI Output Card -->
    {#if result && result.insights}
      <div class="insights-container">
        <div class="insights-grid">
          <div class="insight-box verdict">
            <div class="box-head">
              <ShieldCheck size={14} />
              <span>AI Executive Verdict</span>
            </div>
            <p class="box-content">{result.insights.verdictSummary}</p>
          </div>

          <div class="insight-box value">
            <div class="box-head">
              <CheckCircle2 size={14} />
              <span>Value Assessment</span>
            </div>
            <p class="box-content">{result.insights.valueAssessment}</p>
          </div>

          <div class="insight-box risk">
            <div class="box-head">
              <AlertTriangle size={14} />
              <span>Risk Warning</span>
            </div>
            <p class="box-content">{result.insights.riskWarning}</p>
          </div>

          <div class="insight-box action">
            <div class="box-head">
              <Zap size={14} />
              <span>Tactical Slip Action</span>
            </div>
            <p class="box-content">{result.insights.tacticalRecommendation}</p>
          </div>
        </div>

        <div class="insights-foot">
          <span class="model-tag">Model: {result.model}</span>
          {#if result.neuronsUsed}
            <span class="neuron-tag">Compute: {result.neuronsUsed.toFixed(2)} Neurons</span>
          {/if}
        </div>
      </div>
    {/if}

    {#if errorMessage}
      <div class="error-banner" role="alert">
        <AlertTriangle size={15} />
        <span>{errorMessage}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .cf-ai-banner {
    background: var(--c-surface-2);
    border: 1px solid var(--c-border);
    border-radius: 16px;
    padding: 16px;
    margin: 14px 0;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    position: relative;
    overflow: hidden;
    transition: border-color var(--t-base, 180ms ease);
  }

  .cf-ai-banner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #f38020, #faad3f, var(--cf-accent));
  }

  .cf-ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--c-border-sm);
  }

  .cf-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .ai-icon-box {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: color-mix(in srgb, #f38020 18%, transparent);
    border: 1px solid color-mix(in srgb, #f38020 35%, transparent);
    color: #f38020;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .sub-tag {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #f38020;
  }

  .ai-title {
    margin: 0;
    font-size: 15px;
    font-weight: 800;
    color: var(--c-text);
  }

  .network-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 700;
    border: 1px solid transparent;
  }

  .network-badge.is-online {
    background: color-mix(in srgb, var(--c-green) 12%, transparent);
    border-color: color-mix(in srgb, var(--c-green) 30%, transparent);
    color: var(--c-green);
  }

  .network-badge.is-offline {
    background: color-mix(in srgb, var(--c-muted) 12%, transparent);
    border-color: color-mix(in srgb, var(--c-muted) 30%, transparent);
    color: var(--c-muted);
  }

  .pulse-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--c-green);
    box-shadow: 0 0 8px var(--c-green);
    animation: pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1.2); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
  }

  .cf-ai-body {
    padding-top: 12px;
  }

  .cf-ai-description {
    font-size: 12.5px;
    color: var(--c-muted);
    line-height: 1.45;
    margin: 0 0 12px;
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .generate-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #f38020, #e66a05);
    color: #ffffff;
    border: none;
    padding: 9px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-brand, 'Outfit', system-ui);
    cursor: pointer;
    transition: transform var(--t-fast, 120ms), box-shadow var(--t-fast, 120ms), opacity var(--t-fast, 120ms);
    box-shadow: 0 2px 10px rgba(243, 128, 32, 0.3);
  }

  .generate-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(243, 128, 32, 0.45);
  }

  .generate-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .generate-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
  }

  :global(.spin-icon) {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .insights-container {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--c-border-sm);
    animation: fade-in 0.3s ease both;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
  }

  .insight-box {
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border-sm);
    border-radius: 10px;
    padding: 10px 12px;
  }

  .box-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }

  .insight-box.verdict .box-head { color: var(--cf-accent); }
  .insight-box.value .box-head { color: var(--c-green); }
  .insight-box.risk .box-head { color: var(--c-orange); }
  .insight-box.action .box-head { color: #f38020; }

  .box-content {
    margin: 0;
    font-size: 12.5px;
    color: var(--c-text);
    line-height: 1.4;
    font-weight: 500;
  }

  .insights-foot {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 10px;
    font-size: 11px;
    color: var(--c-faint);
  }

  .error-banner {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--c-red) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-red) 30%, transparent);
    color: var(--c-red);
    font-size: 12px;
    font-weight: 600;
  }
</style>
