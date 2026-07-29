<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Zap, Wifi, WifiOff, RefreshCw, Bot, AlertTriangle, CheckCircle2, ShieldCheck, Cpu } from '@lucide/svelte';
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
  let hasData: boolean = $state(false);

  // Track a debounce timer
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentAbort: AbortController | null = null;

  // ── Compute whether there's real data to analyze ─────────────────────────
  function computeHasData(): boolean {
    const hasMetrics = metrics.some((m) => m.value && m.value !== '-' && m.value !== '0');
    const hasPicks = picks.length > 0;
    const hasLedger = !!ledger?.candidateLabel;
    return hasMetrics || hasPicks || hasLedger;
  }

  // ── Main analysis function ────────────────────────────────────────────────
  async function generateInsights(isAuto = false) {
    if (!online || loading) return;

    const req: AiAnalysisRequest = {
      sportId,
      sportTitle,
      scopeTitle,
      ledger,
      profiles,
      picks,
      metrics
    };

    // Cancel any in-flight request
    if (currentAbort) { currentAbort.abort(); currentAbort = null; }
    currentAbort = new AbortController();

    loading = true;
    errorMessage = null;

    const res = await requestCloudflareAiAnalysis(req, currentAbort.signal);
    loading = false;
    currentAbort = null;

    if (res.success) {
      result = res;
      errorMessage = null;
    } else if (res.isOffline) {
      online = false;
    } else {
      errorMessage = res.error || 'AI analysis failed. Please retry.';
    }
  }

  // ── Auto-trigger with debounce whenever picks/metrics/ledger change ───────
  $effect(() => {
    // Access reactive props to establish dependency tracking
    const _picks = picks;
    const _metrics = metrics;
    const _ledger = ledger;
    const _online = online;
    const dataReady = computeHasData();

    hasData = dataReady;

    if (!autoFetch || !_online || !dataReady) return;

    // Debounce 1.5s so rapid odds entry doesn't spam the API
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      void generateInsights(true);
    }, 1500);
  });

  // ── Network event listeners ───────────────────────────────────────────────
  let handleOnline: () => void;
  let handleOffline: () => void;

  onMount(() => {
    online = isOnline();

    handleOnline = () => {
      online = true;
      // Trigger immediately when reconnecting if there's data
      if (autoFetch && computeHasData() && !result) {
        void generateInsights(true);
      }
    };
    handleOffline = () => {
      online = false;
      if (currentAbort) { currentAbort.abort(); currentAbort = null; }
      loading = false;
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
  });

  onDestroy(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (currentAbort) { currentAbort.abort(); currentAbort = null; }
    if (typeof window !== 'undefined') {
      if (handleOnline) window.removeEventListener('online', handleOnline);
      if (handleOffline) window.removeEventListener('offline', handleOffline);
    }
  });

  // ── Provider display label ────────────────────────────────────────────────
  function getProviderLabel(r: AiAnalysisResult): string {
    if (r.provider === 'openrouter') return 'OpenRouter · Mistral 7B';
    return 'Cloudflare Workers AI · Llama 3.1 8B';
  }
</script>

<div class="cf-ai-banner" class:compact style={`--cf-accent: ${accent}`}>
  <!-- Header -->
  <div class="cf-ai-header">
    <div class="cf-brand">
      <span class="ai-icon-box" aria-hidden="true">
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

    <div class="header-right">
      <!-- Auto-analyze status chip -->
      {#if loading}
        <span class="status-chip analyzing" aria-live="polite">
          <span class="spin-dot" aria-hidden="true"></span>
          Analyzing…
        </span>
      {:else if result}
        <span class="status-chip done" aria-label="Analysis complete">
          <CheckCircle2 size={11} />
          Done
        </span>
      {:else if !hasData}
        <span class="status-chip waiting" aria-label="Waiting for data">
          <Cpu size={11} />
          Waiting for odds
        </span>
      {/if}

      <!-- Network badge -->
      <div class="network-badge" class:is-online={online} class:is-offline={!online} aria-label={online ? 'Online' : 'Offline'}>
        {#if online}
          <span class="pulse-dot" aria-hidden="true"></span>
          <Wifi size={12} />
          <span>Online</span>
        {:else}
          <WifiOff size={12} />
          <span>Offline</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- Body -->
  <div class="cf-ai-body">

    <!-- Offline notice -->
    {#if !online}
      <div class="offline-notice" role="status">
        <WifiOff size={14} />
        <div>
          <strong>Offline Mode Active</strong>
          <p>All local Master Model analysis and pick rankings are fully operational. Connect to the internet for AI-powered recommendations.</p>
        </div>
      </div>

    <!-- Waiting for data -->
    {:else if !hasData && !loading && !result}
      <p class="waiting-note">
        <Cpu size={13} class="inline-icon" />
        Enter odds in the markets below — AI analysis will generate automatically once data is detected.
      </p>

    <!-- Loading bar -->
    {:else if loading}
      <div class="loading-state" role="status" aria-label="Generating AI insights">
        <div class="loading-bar">
          <div class="loading-progress"></div>
        </div>
        <p class="loading-text">
          <RefreshCw size={13} class="spin-icon-inline" />
          AI is reading your odds data &amp; generating verdict…
        </p>
      </div>
    {/if}

    <!-- AI Insights Output -->
    {#if result?.insights}
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
          <span class="model-tag">{getProviderLabel(result)}</span>
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

    <!-- Manual trigger: shown when online + has data + no result + not loading -->
    {#if !loading && !result && online && hasData}
      <button
        type="button"
        class="generate-btn"
        onclick={() => generateInsights(false)}
      >
        <Bot size={15} />
        <span>Get AI Recommendation Now</span>
      </button>
    {/if}

    <!-- Error banner -->
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
    background: var(--c-surface-2, rgba(255,255,255,0.04));
    border: 1px solid var(--c-border, rgba(255,255,255,0.09));
    border-radius: 16px;
    padding: 14px 16px;
    margin: 12px 0;
    position: relative;
    overflow: hidden;
    transition: border-color 180ms ease;
  }

  .cf-ai-banner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, #f38020, #faad3f, var(--cf-accent, #38bdf8));
  }

  .cf-ai-banner.compact { padding: 10px 14px; border-radius: 12px; }

  /* Header */
  .cf-ai-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--c-border-sm, rgba(255,255,255,0.06));
    margin-bottom: 12px;
  }

  .cf-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    flex: 1;
  }

  .ai-icon-box {
    width: 32px; height: 32px;
    border-radius: 9px;
    background: color-mix(in srgb, #f38020 16%, transparent);
    border: 1px solid color-mix(in srgb, #f38020 30%, transparent);
    color: #f38020;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .brand-text { min-width: 0; }

  .sub-tag {
    display: block;
    font-size: 9.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #f38020;
    line-height: 1.2;
  }

  .ai-title {
    margin: 0;
    font-size: 13.5px;
    font-weight: 800;
    color: var(--c-text, #f1f5ff);
    line-height: 1.25;
  }

  .ai-title-compact { font-size: 13px; font-weight: 800; color: var(--c-text, #f1f5ff); }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  /* Status chips */
  .status-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 700;
    white-space: nowrap;
  }

  .status-chip.analyzing {
    background: color-mix(in srgb, #f38020 12%, transparent);
    border: 1px solid color-mix(in srgb, #f38020 28%, transparent);
    color: #f38020;
  }

  .status-chip.done {
    background: color-mix(in srgb, var(--c-green, #4ade80) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-green, #4ade80) 25%, transparent);
    color: var(--c-green, #4ade80);
  }

  .status-chip.waiting {
    background: color-mix(in srgb, var(--c-muted, #8899bb) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-muted, #8899bb) 18%, transparent);
    color: var(--c-muted, #8899bb);
  }

  .spin-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    background: #f38020;
    box-shadow: 0 0 5px #f38020;
    animation: pulse-glow 1.4s infinite;
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
    background: color-mix(in srgb, var(--c-green, #4ade80) 10%, transparent);
    border-color: color-mix(in srgb, var(--c-green, #4ade80) 30%, transparent);
    color: var(--c-green, #4ade80);
  }

  .network-badge.is-offline {
    background: color-mix(in srgb, var(--c-muted, #8899bb) 10%, transparent);
    border-color: color-mix(in srgb, var(--c-muted, #8899bb) 25%, transparent);
    color: var(--c-muted, #8899bb);
  }

  .pulse-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--c-green, #4ade80);
    box-shadow: 0 0 6px var(--c-green, #4ade80);
    animation: pulse-glow 2s infinite;
  }

  @keyframes pulse-glow {
    0% { transform: scale(0.95); opacity: 0.8; }
    50% { transform: scale(1.3); opacity: 1; }
    100% { transform: scale(0.95); opacity: 0.8; }
  }

  /* Body states */
  .waiting-note {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--c-muted, #8899bb);
    margin: 0 0 4px;
    line-height: 1.45;
  }

  :global(.inline-icon) { flex-shrink: 0; }

  .offline-notice {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--c-muted, #8899bb) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-muted, #8899bb) 20%, transparent);
    color: var(--c-muted, #8899bb);
    font-size: 12px;
    line-height: 1.4;
  }
  .offline-notice strong { display: block; font-weight: 700; color: var(--c-text, #f1f5ff); margin-bottom: 2px; font-size: 12.5px; }
  .offline-notice p { margin: 0; font-size: 11.5px; }

  /* Loading bar */
  .loading-state { margin: 0 0 8px; }
  .loading-bar { height: 3px; background: var(--c-border-sm, rgba(255,255,255,0.06)); border-radius: 2px; overflow: hidden; margin-bottom: 7px; }
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
    color: var(--c-muted, #8899bb);
    margin: 0;
  }
  :global(.spin-icon-inline) { animation: spin 1s linear infinite; flex-shrink: 0; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  /* Insights grid */
  .insights-container { animation: fade-in 0.25s ease both; }
  @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

  .insights-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  @media (max-width: 480px) { .insights-grid { grid-template-columns: 1fr; } }

  .insight-box {
    background: var(--c-glass-sm, rgba(255,255,255,0.03));
    border: 1px solid var(--c-border-sm, rgba(255,255,255,0.06));
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
    margin-bottom: 5px;
  }

  .insight-box.verdict .box-head { color: var(--cf-accent, #38bdf8); }
  .insight-box.value .box-head { color: var(--c-green, #4ade80); }
  .insight-box.risk .box-head { color: var(--c-orange, #fb923c); }
  .insight-box.action .box-head { color: #f38020; }

  .box-content { margin: 0; font-size: 12px; color: var(--c-text, #f1f5ff); line-height: 1.45; font-weight: 500; }

  .insights-foot {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 9px;
    font-size: 10.5px;
    color: var(--c-faint, #5a6a85);
    flex-wrap: wrap;
  }

  .model-tag {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
    color: var(--c-muted, #8899bb);
  }

  .neuron-tag {
    background: color-mix(in srgb, #f38020 10%, transparent);
    border: 1px solid color-mix(in srgb, #f38020 22%, transparent);
    color: #f38020;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 10px;
    font-weight: 700;
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    background: transparent;
    border: 1px solid var(--c-border-sm, rgba(255,255,255,0.07));
    color: var(--c-muted, #8899bb);
    padding: 3px 10px;
    border-radius: 7px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: color 120ms, border-color 120ms, background 120ms;
  }
  .refresh-btn:hover:not(:disabled) { color: #f38020; border-color: color-mix(in srgb, #f38020 40%, transparent); background: color-mix(in srgb, #f38020 6%, transparent); }
  .refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Manual generate button */
  .generate-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(135deg, #f38020, #e06000);
    color: #fff;
    border: none;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    font-family: var(--font-brand, 'Outfit', system-ui);
    cursor: pointer;
    transition: transform 120ms, box-shadow 120ms;
    box-shadow: 0 2px 12px rgba(243,128,32,0.3);
    margin-top: 6px;
  }
  .generate-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 18px rgba(243,128,32,0.42); }
  .generate-btn:active { transform: translateY(0); }

  /* Error banner */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 12px;
    border-radius: 9px;
    background: color-mix(in srgb, var(--c-red, #f87171) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-red, #f87171) 28%, transparent);
    color: var(--c-red, #f87171);
    font-size: 12px;
    font-weight: 600;
    margin-top: 10px;
    flex-wrap: wrap;
    gap: 8px;
  }

  .retry-btn {
    margin-left: auto;
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--c-red, #f87171) 35%, transparent);
    color: var(--c-red, #f87171);
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms;
    white-space: nowrap;
  }
  .retry-btn:hover { background: color-mix(in srgb, var(--c-red, #f87171) 10%, transparent); }
</style>
