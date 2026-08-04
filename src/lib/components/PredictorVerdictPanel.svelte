<script lang="ts">
  import { ShieldCheck, AlertTriangle, Link2, CheckCircle2 } from '@lucide/svelte';
  import type { AiAnalysisResult } from '$lib/cloudflareAi';

  let {
    insight = null as AiAnalysisResult['insights'] | null,
    agentsRun = [] as string[],
    citations = [] as string[],
    warnings = [] as string[],
    accent = '#6366f1'
  }: {
    insight?: AiAnalysisResult['insights'] | null;
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
