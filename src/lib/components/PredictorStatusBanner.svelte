<script lang="ts">
  import { Bot, Loader2, AlertTriangle, CheckCircle2 } from '@lucide/svelte';
  import { AGENT_DEFS } from '$lib/agentUi';
  import type { PredictorDay } from '$lib/predictorTypes';

  let {
    day = null as PredictorDay | null,
    progress = 0,
    stage = '',
    running = false,
    error = ''
  }: {
    day?: PredictorDay | null;
    progress?: number;
    stage?: string;
    running?: boolean;
    error?: string;
  } = $props();

  // Active agent label derived from cumulative progress so the meter reads as a
  // team working through the pipeline rather than an opaque spinner.
  const activeAgent = $derived.by(() => {
    if (!running) return null;
    let acc = 0;
    for (const a of AGENT_DEFS) {
      acc += a.weight;
      if (progress <= acc) return a;
    }
    return null;
  });

  const pct = $derived(Math.max(0, Math.min(100, Math.round(progress))));

  const statusLabel = $derived(
    error ? 'Refresh failed — using cached day where available'
    : running ? `${stage || 'Agents at work'}…`
    : day?.status === 'ready' ? 'Day cache ready'
    : day?.status === 'refreshing' ? 'Agents refreshing the day cache'
    : day?.status === 'partial' ? 'Partial cache — few matches cleared the floor'
    : 'No cache yet — start a refresh to wake the agents'
  );
</script>

<div class="predictor-banner" role="status" aria-live="polite">
  <div class="banner-top">
    <span class="brand">
      <Bot size={17} stroke-width={2.2} />
      Eze Ugo &amp; Team
    </span>
    <span class="status-text">{statusLabel}</span>
  </div>

  <div class="meter-wrap">
    <div class="meter-track" aria-hidden="true">
      <div class="meter-fill" style={`width:${pct}%`}></div>
    </div>
    <span class="meter-pct">{pct}%</span>
  </div>

  {#if running && activeAgent}
    <div class="agent-chip">
      <span class="spin"><Loader2 size={14} stroke-width={2.4} /></span>
      <span><b>{activeAgent.name}</b> — {activeAgent.role} ({stage})</span>
    </div>
  {:else if error}
    <div class="agent-chip warn">
      <AlertTriangle size={14} stroke-width={2.4} />
      <span>{error}</span>
    </div>
  {:else if pct >= 100}
    <div class="agent-chip ok">
      <CheckCircle2 size={14} stroke-width={2.4} />
      <span>Handover complete — matches are ready below.</span>
    </div>
  {/if}
</div>

<style>
  .predictor-banner {
    border: 1px solid var(--c-border-md);
    border-radius: 16px;
    padding: 14px 16px;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--c-accent, #6366f1) 10%, transparent), transparent 55%),
      var(--c-surface-2);
    margin-bottom: 14px;
  }

  .banner-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 12px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 800;
    font-size: 13.5px;
    color: var(--c-accent, #6366f1);
  }

  .status-text {
    font-size: 12px;
    color: var(--c-text-dim, var(--c-text));
    text-align: right;
  }

  .meter-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .meter-track {
    flex: 1;
    height: 10px;
    border-radius: 999px;
    background: var(--c-border);
    overflow: hidden;
  }

  .meter-fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--c-accent, #6366f1) 60%, #22d3ee), var(--c-accent, #6366f1));
    box-shadow: 0 0 12px color-mix(in srgb, var(--c-accent, #6366f1) 50%, transparent);
    transition: width 300ms ease;
  }

  .meter-pct {
    font-size: 13px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    min-width: 38px;
    text-align: right;
    color: var(--c-accent, #6366f1);
  }

  .agent-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px 12px;
    border-radius: 12px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    font-size: 12px;
    color: var(--c-text);
  }

  .agent-chip.warn {
    border-color: color-mix(in srgb, #f59e0b 45%, transparent);
    color: #f59e0b;
  }

  .agent-chip.ok {
    border-color: color-mix(in srgb, #22c55e 45%, transparent);
    color: #22c55e;
  }

  .spin { display: inline-flex; animation: spn 1s linear infinite; }

  @keyframes spn { to { transform: rotate(360deg); } }
</style>
