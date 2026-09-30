<script lang="ts">
  import {
    ShieldCheck, AlertTriangle, Link2, CheckCircle2, XCircle, MinusCircle,
    ListOrdered, Plus, Check
  } from '@lucide/svelte';
  import type { AiAnalysisResult } from '$lib/cloudflareAi';
  import type { Pick } from '$lib/engine';
  import type { PredictorMatch, SelectionGrade } from '$lib/predictorTypes';
  import { gradeSelection } from '$lib/predictorTypes';
  import { pickSegment } from '$lib/predictorSegments';
  import { isInBuilder, addToBuilder, removeFromBuilder } from '$lib/betSlipStore.svelte';

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
    accent = '#22d3ee',
    finalScore = null as string | null,
    match = null as PredictorMatch | null
  }: {
    insight?: AiAnalysisResult['insights'] | null;
    greatMindsDebate?: GreatMindsDebateResult | null;
    picks?: Pick[];
    metrics?: { label: string; value: string; note?: string; status?: string }[];
    agentsRun?: string[];
    citations?: string[];
    warnings?: string[];
    accent?: string;
    finalScore?: string | null;
    match?: PredictorMatch | null;
  } = $props();

  interface RankedRow {
    key: string;
    selection: string;
    marketTitle: string;
    marketId: string;
    pct: number;
    odds: number | null;
    edge: string;
    ev: number | null;
    reason: string;
    fromInsight: boolean;
  }

  const norm = (s: unknown) =>
    String(s ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9.+-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const sideOf = (s: unknown): string => {
    const t = norm(s);
    if (/\bover\b/.test(t)) return 'over';
    if (/\bunder\b/.test(t)) return 'under';
    if (/\byes\b/.test(t)) return 'yes';
    if (/\bno\b/.test(t)) return 'no';
    if (/\bdraw\b/.test(t)) return 'draw';
    if (/\bhome\b/.test(t)) return 'home';
    if (/\baway\b/.test(t)) return 'away';
    return '';
  };

  const firstNumber = (s: unknown): number | null => {
    const m = norm(s).match(/(\d+(?:\.\d+)?)/);
    return m ? Number(m[1]) : null;
  };

  // Two labels describe the same market when they are textually nested OR share
  // the same side keyword AND the same line (e.g. "Over 2.5" vs "Over 2.5 Goals").
  const sameMarket = (a: unknown, b: unknown): boolean => {
    const na = norm(a);
    const nb = norm(b);
    if (!na || !nb) return false;
    if (na === nb || na.includes(nb) || nb.includes(na)) return true;
    const sa = sideOf(a);
    const sb = sideOf(b);
    const la = firstNumber(a);
    const lb = firstNumber(b);
    return !!sa && sa === sb && la !== null && la === lb;
  };

  const pctOf = (v: unknown): number => {
    const n = parseFloat(String(v ?? '').replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) ? n : 0;
  };

  // ── ONE ranked Research & Analysis summary ────────────────────────────────
  // The engine's qualifying picks and the LLM's top selections used to render as
  // two separate lists ("All qualifying picks by market" + "Top selections")
  // that repeated the same markets. They are now harmonised into a SINGLE list
  // ranked by probability/confidence, de-duplicated on market identity.
  const ranked = $derived.by<RankedRow[]>(() => {
    const rows: RankedRow[] = [];

    for (const p of picks) {
      rows.push({
        key: `${p.marketId || 'm'}:${p.label}`,
        selection: String(p.label ?? ''),
        marketTitle: String(p.marketTitle ?? ''),
        marketId: String(p.marketId ?? ''),
        pct: Number(p.probability) || 0,
        odds: Number.isFinite(Number(p.odds)) ? Number(p.odds) : null,
        edge: p.ev !== undefined ? `EV ${Number(p.ev).toFixed(2)}` : '',
        ev: p.ev !== undefined ? Number(p.ev) : null,
        reason: '',
        fromInsight: false
      });
    }

    for (const t of insight?.top3Selections ?? []) {
      const pct = pctOf(t.confidence);
      const existing = rows.find(
        (r) => sameMarket(r.selection, t.selection) || sameMarket(r.marketTitle, t.marketTitle)
      );
      if (existing) {
        // The LLM agrees with an engine pick — enrich, never duplicate.
        existing.reason = t.reason || existing.reason;
        existing.edge = existing.edge || t.punterEdge || '';
        if (existing.pct <= 0) existing.pct = pct;
        existing.fromInsight = true;
      } else {
        rows.push({
          key: `llm:${norm(t.selection)}`,
          selection: String(t.selection ?? ''),
          marketTitle: String(t.marketTitle ?? ''),
          marketId: '',
          pct,
          odds: null,
          edge: t.punterEdge || '',
          ev: null,
          reason: t.reason || '',
          fromInsight: true
        });
      }
    }

    return rows.sort((a, b) => b.pct - a.pct);
  });

  const gradeOf = (row: RankedRow): SelectionGrade => {
    if (!finalScore) return null;
    return gradeSelection(row.selection, row.marketTitle, finalScore, {
      homeTeam: match?.homeTeam,
      awayTeam: match?.awayTeam,
      marketId: row.marketId
    });
  };

  const inSlip = (row: RankedRow): boolean =>
    !!match && isInBuilder(match.matchId, row.selection);

  function toggleSlip(row: RankedRow): void {
    if (!match) return;
    if (inSlip(row)) {
      void removeFromBuilder(match.matchId, row.selection);
      return;
    }
    void addToBuilder({
      sportId: match.sportId ?? '',
      dayKey: match.dayKey || '',
      matchId: match.matchId,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      league: match.league,
      marketTitle: row.marketTitle,
      selection: row.selection,
      odds: row.odds ?? 1.01,
      publishedPct: row.pct,
      kickoff: match.startTime
    });
  }

  const wonRows = $derived(ranked.filter((r) => gradeOf(r) === 'win').length);
  const settledRows = $derived(ranked.filter((r) => gradeOf(r) !== null).length);
</script>

{#if insight || ranked.length > 0}
  <div class="verdict-panel" style={`--accent:${accent}`}>
    <div class="panel-head">
      <span class="head-title"><ShieldCheck size={16} stroke-width={2.2} /> Agent Verdict</span>
      {#if settledRows > 0}
        <span class="settled-pill" title="Selections that won / selections graded">
          {wonRows}/{settledRows} won
        </span>
      {/if}
    </div>

    {#if insight?.verdictSummary}
      <p class="summary">{insight.verdictSummary}</p>
    {/if}

    {#if insight?.crossCheckAnalysis}
      <p class="sub">{insight.crossCheckAnalysis}</p>
    {/if}

    <!-- ── Research & Analysis Summary — the single ranked interface ── -->
    {#if ranked.length > 0}
      <div class="chart-block">
        <div class="block-title">
          <ListOrdered size={13} stroke-width={2.2} />
          Research &amp; analysis summary — ranked by confidence
          <span class="count-pill">{ranked.length}</span>
        </div>
        <div class="ranked-list" role="list" aria-label="Market options ranked by confidence">
          {#each ranked as row, i (row.key)}
            {@const seg = pickSegment(row.marketId || row.marketTitle)}
            {@const g = gradeOf(row)}
            <div class="ranked-row" role="listitem" style={`--seg-accent:${seg.accent}`}>
              <span class="rank" title={`Rank #${i + 1} of ${ranked.length}`}>#{i + 1}</span>
              <div class="ranked-main">
                <div class="ranked-top">
                  <span class="seg-tag">{seg.short}</span>
                  <span class="selection">{row.selection}</span>
                  {#if row.fromInsight}<span class="ai-chip">AI</span>{/if}
                  {#if g}
                    <span class="grade-pill grade-{g}">
                      {#if g === 'win'}<CheckCircle2 size={11} /> WON
                      {:else if g === 'loss'}<XCircle size={11} /> LOST
                      {:else}<MinusCircle size={11} /> PUSH{/if}
                    </span>
                  {/if}
                </div>
                <span class="market">{row.marketTitle || 'Market'}{#if row.odds !== null && row.odds > 1} · @ {row.odds.toFixed(2)}{/if}</span>
                {#if row.reason}<p class="reason">{row.reason}</p>{/if}
                <div class="track" aria-hidden="true">
                  <div class="bar" style={`width:${Math.min(100, row.pct)}%;`}></div>
                </div>
              </div>
              <div class="ranked-right">
                <span class="confidence">{row.pct.toFixed(1)}%</span>
                {#if row.edge}<span class="edge">{row.edge}</span>{/if}
                {#if match}
                  <button
                    class="slip-btn"
                    class:in-slip={inSlip(row)}
                    type="button"
                    aria-label={inSlip(row) ? `Remove ${row.selection} from bet slip` : `Add ${row.selection} to bet slip`}
                    title={inSlip(row) ? 'Remove from bet slip' : 'Add to bet slip'}
                    onclick={(e) => {
                      e.stopPropagation();
                      toggleSlip(row);
                    }}
                  >
                    {#if inSlip(row)}<Check size={12} stroke-width={3} /> Added{:else}<Plus size={12} stroke-width={3} /> Slip{/if}
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    {#if metrics.length > 0}
      <div class="chart-block">
        <div class="block-title"><ListOrdered size={13} stroke-width={2.2} /> Key metrics</div>
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

    {#if insight?.crossCheckSteps && insight.crossCheckSteps.length > 0}
      <div class="steps">
        <div class="steps-title">Cross-check steps</div>
        <ol>
          {#each insight.crossCheckSteps as s, i (i)}
            <li>{s}</li>
          {/each}
        </ol>
      </div>
    {/if}

    {#if insight?.stakeAdvice || insight?.riskWarning}
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
      <GreatMindsDebatePanel debate={greatMindsDebate} {accent} {finalScore} finished={!!finalScore} />
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

  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }

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

  .settled-pill {
    font-size: 10.5px;
    font-weight: 800;
    padding: 3px 9px;
    border-radius: 999px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    color: var(--c-text-dim, var(--c-text));
    font-variant-numeric: tabular-nums;
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

  .count-pill {
    font-size: 10px;
    font-weight: 800;
    color: color-mix(in srgb, var(--accent) 85%, #fff);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    padding: 1px 8px;
    border-radius: 999px;
    font-variant-numeric: tabular-nums;
    margin-left: 4px;
  }

  .ranked-list { display: flex; flex-direction: column; gap: 6px; }

  .ranked-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 11px;
    border-radius: 12px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    border-left: 3px solid var(--seg-accent, var(--accent));
  }

  .rank {
    font-weight: 900;
    color: var(--seg-accent, var(--accent));
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    min-width: 26px;
    padding-top: 1px;
  }

  .ranked-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }

  .ranked-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }

  .seg-tag {
    font-size: 9.5px;
    font-weight: 800;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 5px;
    color: var(--seg-accent, var(--accent));
    background: color-mix(in srgb, var(--seg-accent, var(--accent)) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--seg-accent, var(--accent)) 38%, transparent);
  }

  .selection { font-weight: 800; font-size: 13px; color: var(--c-text); }

  .ai-chip {
    font-size: 9px;
    font-weight: 900;
    letter-spacing: 0.06em;
    padding: 1px 5px;
    border-radius: 5px;
    color: #a78bfa;
    background: color-mix(in srgb, #a78bfa 15%, transparent);
    border: 1px solid color-mix(in srgb, #a78bfa 38%, transparent);
  }

  .grade-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9.5px;
    font-weight: 900;
    letter-spacing: 0.04em;
    padding: 1px 6px;
    border-radius: 5px;
  }
  .grade-win { color: #34d399; background: color-mix(in srgb, #34d399 16%, transparent); }
  .grade-loss { color: #ef4444; background: color-mix(in srgb, #ef4444 16%, transparent); }
  .grade-push { color: var(--c-text-dim, var(--c-text)); background: var(--c-glass-md); }

  .market { font-size: 11px; color: var(--c-text-dim, var(--c-text)); }
  .reason { font-size: 11.5px; color: var(--c-text); margin: 2px 0 0; line-height: 1.45; }

  .track {
    height: 5px;
    border-radius: 999px;
    background: var(--c-glass-md);
    overflow: hidden;
    margin-top: 3px;
  }
  .bar { height: 100%; background: var(--seg-accent, var(--accent)); border-radius: 999px; }

  .ranked-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    flex-shrink: 0;
  }

  .confidence { font-weight: 900; font-size: 14px; color: #34d399; font-variant-numeric: tabular-nums; }
  .edge { font-size: 10px; color: #34d399; font-weight: 700; }

  .slip-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 26px;
    padding: 3px 9px;
    border-radius: 8px;
    font-size: 10.5px;
    font-weight: 800;
    cursor: pointer;
    background: var(--c-glass-sm);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    color: var(--accent);
  }
  .slip-btn.in-slip { background: color-mix(in srgb, #34d399 15%, transparent); border-color: #34d399; color: #34d399; }

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
  .p-metric.st-green { border-color: color-mix(in srgb, #34d399 30%, var(--c-border-md)); }
  .p-metric.st-amber { border-color: color-mix(in srgb, #f59e0b 30%, var(--c-border-md)); }
  .p-metric.st-red { border-color: color-mix(in srgb, #ef4444 30%, var(--c-border-md)); }

  .pm-label { font-size: 10px; color: var(--c-text-dim, var(--c-text)); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .p-metric.st-green .pm-value { color: #34d399; }
  .p-metric.st-amber .pm-value { color: #f59e0b; }
  .p-metric.st-red .pm-value { color: #ef4444; }
  .pm-value { font-size: 17px; font-weight: 900; color: var(--c-text); font-family: var(--font-mono, 'JetBrains Mono', monospace); line-height: 1; }
  .pm-note { font-size: 10px; color: var(--c-text-dim, var(--c-text)); line-height: 1.3; }

  .steps { margin-top: 12px; }
  .steps-title { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim, var(--c-text)); margin-bottom: 8px; }
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
    background: color-mix(in srgb, #34d399 8%, transparent);
    border: 1px solid color-mix(in srgb, #34d399 25%, transparent);
    margin: 0;
  }

  .advice-ic { color: #34d399; flex-shrink: 0; margin-top: 1px; display: inline-flex; }

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
