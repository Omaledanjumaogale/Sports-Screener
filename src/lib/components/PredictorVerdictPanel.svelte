<script lang="ts">
  import { ShieldCheck, AlertTriangle, Link2, CheckCircle2, BarChart3, Gauge } from '@lucide/svelte';
  import type { AiAnalysisResult } from '$lib/cloudflareAi';
  import type { Pick } from '$lib/engine';
  import PredictorPickChart from './PredictorPickChart.svelte';

  import type { GreatMindsDebateResult } from '$lib/predictorTypes';
  import GreatMindsDebatePanel from './GreatMindsDebatePanel.svelte';

  let {
    insight = null as AiAnalysisResult['insights'] | null,
    greatMindsDebate = null as GreatMindsDebateResult | null,
    picks = [] as Pick[],
    metrics = [] as { label: string; value: string; note?: string; status?: string }[],
    agentsRun = [] as string[],
    citations = [] as string[],
    warnings = [] as string[],
    accent = '#6366f1'
  }: {
    insight?: AiAnalysisResult['insights'] | null;
    greatMindsDebate?: GreatMindsDebateResult | null;
    picks?: Pick[];
    metrics?: { label: string; value: string; note?: string; status?: string }[];
    agentsRun?: string[];
    citations?: string[];
    warnings?: string[];
    accent?: string;
  } = $props();
</script>

{#if insight}
  <div class="verdict-panel" style={`--accent:${accent}`}>
    <div class="panel-head">
      <span class="head-title"><ShieldCheck size={16} stroke-width={2.2} /> Agent Verdict</span>
    </div>

    {#if insight.verdictSummary}
      <p class="summary">{insight.verdictSummary}</p>
    {/if}

    {#if insight.crossCheckAnalysis}
      <p class="sub">{insight.crossCheckAnalysis}</p>
    {/if}

    {#if picks.length > 0}
      <div class="chart-block">
        <div class="block-title"><BarChart3 size={13} stroke-width={2.2} /> Picks by Real Win Chance</div>
        <PredictorPickChart picks={picks} limit={3} {accent} />
      </div>
    {/if}

    {#if metrics.length > 0}
      <div class="chart-block">
        <div class="block-title"><BarChart3 size={13} stroke-width={2.2} /> Key metrics</div>
        <div class="panel-metrics">
          {#each metrics as metric}
            <div class={`p-metric ${metric.status ? 'st-' + metric.status : 'st-empty'}`}>
              <span class="pm-label">{metric.label}</span>
              <strong class="pm-value">{metric.value}</strong>
              {#if metric.note}
                <span class="pm-note">{metric.note}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if insight.top3Selections && insight.top3Selections.length > 0}
      <div class="top3">
        <div class="top3-title">Top selections</div>
        {#each insight.top3Selections.slice(0, 3) as t, i (i)}
          <div class="top3-row">
            <span class="rank">#{i + 1}</span>
            <div class="top3-main">
              <span class="selection">{t.selection}</span>
              <span class="market">{t.marketTitle}</span>
              {#if t.reason}<p class="reason">{t.reason}</p>{/if}
            </div>
            <div class="top3-right">
              <span class="confidence">{t.confidence}</span>
              {#if t.punterEdge}<span class="edge">{t.punterEdge}</span>{/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}

    {#if insight.crossCheckSteps && insight.crossCheckSteps.length > 0}
      <div class="steps">
        <div class="steps-title">Cross-check steps</div>
        <ol>
          {#each insight.crossCheckSteps as s, i (i)}
            <li>{s}</li>
          {/each}
        </ol>
      </div>
    {/if}

    {#if insight.stakeAdvice || insight.riskWarning}
      <div class="advice">
        {#if insight.stakeAdvice}
          <p class="advice-line"><span class="advice-ic"><CheckCircle2 size={14} stroke-width={2.2} /></span> <span>{insight.stakeAdvice}</span></p>
        {/if}
        {#if insight.riskWarning}
          <p class="advice-line warn"><span class="advice-ic warn-ic"><AlertTriangle size={14} stroke-width={2.2} /></span> <span>{insight.riskWarning}</span></p>
        {/if}
      </div>
    {/if}

    {#if agentsRun.length > 0}
      <div class="agents">
        <span class="agents-title">Agents on this verdict</span>
        <div class="agent-tags">
          {#each agentsRun as a}
            <span class="agent-tag">{a}</span>
          {/each}
        </div>
      </div>
    {/if}

    {#if warnings.length > 0}
      <div class="warnings">
        {#each warnings as w}
          <p class="warn-line"><AlertTriangle size={13} stroke-width={2.2} /> {w}</p>
        {/each}
      </div>
    {/if}

    {#if citations.length > 0}
      <div class="citations">
        <span class="citations-title"><Link2 size={13} stroke-width={2.2} /> Sources consulted</span>
        <ul>
          {#each citations.slice(0, 6) as c}
            <li>{c}</li>
          {/each}
        </ul>
      </div>
    {/if}

    <!-- Great AI Minds Debate Panel -->
    {#if greatMindsDebate}
      <GreatMindsDebatePanel debate={greatMindsDebate} {accent} />
    {/if}
  </div>
{/if}

<style>
  .verdict-panel {
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 16px;
    padding: 14px 16px;
    background: var(--c-surface-2);
    margin-top: 12px;
  }

  .panel-head { display: flex; align-items: center; margin-bottom: 8px; }

  .head-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 800;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--accent);
  }

  .summary { font-size: 13.5px; line-height: 1.55; color: var(--c-text); margin: 6px 0; }
  .sub { font-size: 12.5px; line-height: 1.5; color: var(--c-text-dim, var(--c-text)); margin: 4px 0 10px; }

  .chart-block { margin-top: 12px; }

  .block-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-text-dim, var(--c-text));
    margin-bottom: 8px;
  }

  .panel-metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(105px, 1fr));
    gap: 8px;
  }

  .p-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 10px 11px;
    border-radius: 12px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    min-width: 0;
  }
  .p-metric.st-green { border-color: color-mix(in srgb, #22c55e 30%, var(--c-border-md)); }
  .p-metric.st-amber { border-color: color-mix(in srgb, #f59e0b 30%, var(--c-border-md)); }
  .p-metric.st-red { border-color: color-mix(in srgb, #ef4444 30%, var(--c-border-md)); }

  .pm-label { font-size: 10px; color: var(--c-text-dim, var(--c-text)); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .p-metric.st-green .pm-value { color: #22c55e; }
  .p-metric.st-amber .pm-value { color: #f59e0b; }
  .p-metric.st-red .pm-value { color: #ef4444; }
  .pm-value { font-size: 17px; font-weight: 900; color: var(--c-text); font-family: var(--font-mono, 'JetBrains Mono', monospace); line-height: 1; }
  .pm-note { font-size: 10px; color: var(--c-text-dim, var(--c-text)); line-height: 1.3; }

  .top3 { margin-top: 10px; }

  .top3-title, .steps-title { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim, var(--c-text)); margin-bottom: 8px; }

  .top3-row {
    display: flex;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    margin-bottom: 6px;
    align-items: flex-start;
  }

  .rank { font-weight: 900; color: var(--accent); font-size: 14px; }

  .top3-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }

  .selection { font-weight: 800; font-size: 13px; color: var(--c-text); }
  .market { font-size: 11px; color: var(--c-text-dim, var(--c-text)); }
  .reason { font-size: 11.5px; color: var(--c-text); margin: 4px 0 0; line-height: 1.45; }

  .top3-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }

  .confidence { font-weight: 900; font-size: 14px; color: #22c55e; }
  .edge { font-size: 10.5px; color: #22c55e; font-weight: 700; }

  .steps ol { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 5px; }
  .steps li { font-size: 12px; color: var(--c-text); line-height: 1.45; }

  .advice { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }

  .advice-line {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 12.5px;
    color: var(--c-text);
    padding: 8px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, #22c55e 8%, transparent);
    border: 1px solid color-mix(in srgb, #22c55e 25%, transparent);
    margin: 0;
  }

  .advice-ic { color: #22c55e; flex-shrink: 0; margin-top: 1px; display: inline-flex; }

  .advice-line.warn {
    background: color-mix(in srgb, #f59e0b 8%, transparent);
    border-color: color-mix(in srgb, #f59e0b 25%, transparent);
  }
  .advice-ic.warn-ic { color: #f59e0b; }

  .agents { margin-top: 12px; }

  .agents-title, .citations-title { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim, var(--c-text)); }

  .agent-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

  .agent-tag {
    font-size: 11px;
    font-weight: 700;
    padding: 4px 9px;
    border-radius: 999px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    color: var(--accent);
  }

  .warnings { margin-top: 10px; display: flex; flex-direction: column; gap: 5px; }

  .warn-line {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    font-size: 12px;
    color: #f59e0b;
    margin: 0;
  }

  .citations { margin-top: 12px; }
  .citations-title { display: inline-flex; align-items: center; gap: 5px; }

  .citations ul { margin: 6px 0 0; padding-left: 18px; }
  .citations li { font-size: 11.5px; color: var(--c-text-dim, var(--c-text)); line-height: 1.5; word-break: break-all; }
</style>
