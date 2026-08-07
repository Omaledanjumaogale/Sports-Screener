<script lang="ts">
  import { Trophy, Clock3, ShieldCheck, TrendingUp, Check, ChevronDown, BarChart3, Gauge, X, Sparkles } from '@lucide/svelte';
  import type { PredictorMatch } from '$lib/predictorTypes';
  import { DEFAULT_CONFIDENCE_FLOOR } from '$lib/predictorTypes';
  import type { Analysis, Pick } from '$lib/engine';
  import { formatWAT } from '$lib/watTime';
  import PredictorPickChart from './PredictorPickChart.svelte';
  import PredictorMatchStats from './PredictorMatchStats.svelte';
  import { generateGreatMindsDebate } from '$lib/greatMindsEngine';

  let {
    match,
    analysis = null as Analysis | null,
    qualifying = [] as Pick[],
    insight = null as any,
    accent = '#6366f1',
    expanded = false,
    selectable = false,
    selected = false,
    disabled = false,
    inPlay = false,
    onSelect = () => {},
    onClick = () => {}
  }: {
    match: PredictorMatch;
    analysis?: Analysis | null;
    qualifying?: Pick[];
    insight?: any;
    accent?: string;
    expanded?: boolean;
    selectable?: boolean;
    selected?: boolean;
    disabled?: boolean;
    inPlay?: boolean;
    onSelect?: () => void;
    onClick?: () => void;
  } = $props();

  let localOpen = $state(false);
  const open = $derived(expanded);

  const kickoff = $derived(formatWAT(match.startTime));
  const top = $derived(qualifying[0] ?? null);
  const bestPct = $derived(top ? Number(top.probability).toFixed(1) : null);
  const bottomPicks = $derived(qualifying.length >= 3 ? qualifying.slice(0, 3) : qualifying);
  const metrics = $derived((analysis?.metrics ?? []).slice(0, 4));

  const greatMindsData = $derived(generateGreatMindsDebate(match, analysis));
</script>

<div
  class="match-card"
  class:is-selected={selected}
  class:is-disabled={disabled}
  class:is-in-play={inPlay}
  class:is-selectable={selectable}
  class:is-open={open}
  style={`--accent:${accent}`}
  role="button"
  aria-label={`${match.homeTeam} vs ${match.awayTeam} — ${open ? 'Collapse' : 'Expand'} analysis${inPlay ? ' (in play)' : ''}`}
  tabindex={disabled ? -1 : 0}
  onclick={(e) => {
    if (disabled) return;
    onClick();
  }}
  onkeydown={(e) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }}
  aria-expanded={open ? 'true' : 'false'}
>
  <header class="match-head">
    <div class="matchup">
      {#if selectable}
        <button
          class="pick-toggle"
          class:on={selected}
          type="button"
          role="checkbox"
          aria-checked={selected}
          aria-disabled={disabled || inPlay}
          disabled={disabled || inPlay}
          aria-label={`${selected ? 'Remove' : 'Add'} ${match.homeTeam} vs ${match.awayTeam}`}
          title={
            disabled || inPlay
              ? inPlay
                ? 'This match is in play — cached verdict remains viewable below'
                : 'Unavailable for selection'
              : selected
                ? 'Remove from analysis'
                : 'Add to analysis'
          }
          onclick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          {#if selected}
            <Check size={14} stroke-width={3} />
          {/if}
        </button>
      {/if}
      <span class="home">{match.homeTeam}</span>
      <span class="vs">vs</span>
      <span class="away">{match.awayTeam}</span>
      <button
        class="expand-toggle"
        type="button"
        aria-label={open ? 'Collapse match details' : 'Expand match details'}
        title={open ? 'Collapse match details' : 'Expand match details'}
        onclick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            onClick();
          }
        }}
      >
        <ChevronDown size={16} stroke-width={2.4} />
      </button>
    </div>
    <div class="meta">
      {#if inPlay}
        <span class="chip live">In play</span>
      {/if}
      <span class="chip league" title={match.league}>{match.league}</span>
      <span class="chip time"><Clock3 size={12} stroke-width={2.2} /> <span class="wat-date">{kickoff}</span></span>
      <span class="chip source">{match.source}</span>
      
      <button
        class="analyze-match-btn"
        type="button"
        aria-label={`${open ? 'Collapse' : 'Analyze'} match analysis`}
        onclick={(e) => {
          e.stopPropagation();
          if (!disabled) {
            onClick();
          }
        }}
      >
        <Sparkles size={13} stroke-width={2.4} />
        <span>{open ? 'Collapse Analysis' : 'Analyze Match'}</span>
      </button>
    </div>
  </header>

  <!-- Great AI Minds Mini Badges -->
  {#if greatMindsData}
    <div class="gm-mini-badges">
      <span class="gm-mini-title"><Trophy size={13} /> Great Minds Verdict:</span>
      {#if greatMindsData.consensusPicks.winner}
        <span class="gm-badge bg-winner">
          {greatMindsData.consensusPicks.winner.selection} <strong class="ratio-text">{greatMindsData.consensusPicks.winner.consensusRatio}</strong> <Check size={11} />
        </span>
      {/if}
      {#if greatMindsData.consensusPicks.spread}
        <span class="gm-badge bg-spread">
          {greatMindsData.consensusPicks.spread.selection} <strong class="ratio-text">{greatMindsData.consensusPicks.spread.consensusRatio}</strong> <Check size={11} />
        </span>
      {/if}
      {#if greatMindsData.consensusPicks.total}
        <span class="gm-badge bg-total">
          {greatMindsData.consensusPicks.total.selection} <strong class="ratio-text">{greatMindsData.consensusPicks.total.consensusRatio}</strong> <Check size={11} />
        </span>
      {/if}
    </div>
  {/if}

  {#if bestPct}
    <div class="confidence-band">
      <span class="shield"><ShieldCheck size={15} stroke-width={2.4} /></span>
      <div class="conf-text">
        <span class="conf-pct">{bestPct}%</span>
        <span class="conf-label">Real Win Chance — cleared the {DEFAULT_CONFIDENCE_FLOOR}% floor</span>
      </div>
      <span class="edge"><TrendingUp size={14} stroke-width={2.2} />{top!.label}</span>
    </div>
  {:else}
    <div class="no-pick">No selection cleared the confidence floor this cycle.</div>
  {/if}

  {#if bottomPicks.length > 0}
    <div class="mini-section">
      <div class="mini-title"><span><BarChart3 size={13} stroke-width={2.2} /></span> Top {bottomPicks.length} picks by Real Win Chance</div>
      <PredictorPickChart picks={bottomPicks} limit={3} {accent} />
    </div>
  {/if}

  {#if metrics.length > 0}
    <div class="mini-metrics">
      <div class="mini-title"><span><Gauge size={13} stroke-width={2.2} /></span> Key metrics</div>
      <div class="mini-metric-grid">
        {#each metrics as metric}
          <div class={`mini-metric ${metric.status ? 'st-' + metric.status : 'st-empty'}`}>
            <span class="mm-label">{metric.label}</span>
            <strong class="mm-value">{metric.value}</strong>
            {#if metric.note}
              <span class="mm-note">{metric.note}</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if open}
    <div class="expanded">
      <PredictorMatchStats scopes={match.scopes} {accent} />
      <div class="exp-title">Research &amp; analysis summary</div>
      {#if insight?.verdictSummary}
        <p class="verdict-summary">{insight.verdictSummary}</p>
      {/if}
      {#if insight?.top3Selections && insight.top3Selections.length > 0}
        <div class="insight-top3">
          {#each insight.top3Selections.slice(0, 3) as t, i (i)}
            <div class="insight-row">
              <span class="rank">#{i + 1}</span>
              <div class="insight-main">
                <span class="selection">{t.selection}</span>
                <span class="market">{t.marketTitle}</span>
              </div>
              <div class="insight-right">
                <span class="confidence">{t.confidence}</span>
                <span class="edge">{t.punterEdge}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else if qualifying.length > 0}
        <ul class="pick-list">
          {#each qualifying.slice(0, 5) as p}
            <li>
              <span class="pick-name">{p.label}</span>
              <span class="pick-market">{p.marketTitle}</span>
              <span class="pick-pct">{Number(p.probability).toFixed(1)}%</span>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">No selections qualify — revisit after the next refresh.</p>
      {/if}
      {#if top}
        <div class="trophy-note">
          <span class="trophy-ic"><Trophy size={15} stroke-width={2.2} /></span>
          <span>
            Top pick <b>{top.label}</b> at {Number(top.odds).toFixed(2)} decimal odds.
            {Number(top.probability) >= DEFAULT_CONFIDENCE_FLOOR ? 'Highest-confidence signal this cycle.' : ''}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .match-card {
    border: 1px solid var(--c-border-md);
    border-radius: 16px;
    background: var(--c-surface-2);
    padding: 14px 16px;
    transition: box-shadow var(--t-base, 180ms ease), border-color var(--t-base, 180ms ease), transform 120ms ease;
  }

  .match-card:hover {
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    box-shadow: 0 4px 24px color-mix(in srgb, var(--accent) 14%, transparent);
  }

  .match-card.is-selected {
    border-color: color-mix(in srgb, var(--accent) 70%, transparent);
    box-shadow: 0 4px 24px color-mix(in srgb, var(--accent) 22%, transparent);
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, transparent), transparent 60%),
      var(--c-surface-2);
  }

  .match-card.is-disabled {
    opacity: 0.55;
  }
  .match-card.is-disabled:hover {
    border-color: var(--c-border-md);
    box-shadow: none;
  }

  .match-card.is-in-play {
    border-color: color-mix(in srgb, #f43f5e 30%, var(--c-border-md));
  }
  .match-card.is-in-play:hover {
    border-color: color-mix(in srgb, #f43f5e 55%, transparent);
    box-shadow: 0 4px 24px color-mix(in srgb, #f43f5e 12%, transparent);
  }

  .match-card.is-selectable { cursor: pointer; }

  .pick-toggle {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 2px solid var(--c-border-2);
    background: transparent;
    color: var(--c-surface-2);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition:
      background var(--t-base, 180ms ease),
      border-color var(--t-base, 180ms ease),
      transform 80ms ease;
  }

  .pick-toggle:hover { border-color: var(--accent); }
  .pick-toggle:active { transform: scale(0.88); }
  .pick-toggle:disabled { cursor: not-allowed; }

  .pick-toggle.on {
    background: var(--accent);
    border-color: var(--accent);
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 50%, transparent);
  }

  .expand-toggle {
    margin-left: auto;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--c-text-dim, var(--c-text));
    border-radius: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: color var(--t-base, 180ms ease), transform 80ms ease;
  }
  .expand-toggle:hover { color: var(--accent); background: var(--c-glass-sm); }

  .chip.live {
    color: #f43f5e;
    border-color: color-mix(in srgb, #f43f5e 40%, transparent);
    background: color-mix(in srgb, #f43f5e 10%, transparent);
  }

  .match-head { display: flex; flex-direction: column; gap: 10px; }

  .matchup {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    font-size: 15.5px;
    letter-spacing: -0.01em;
    color: var(--c-text);
    flex-wrap: wrap;
  }

  .home { color: var(--accent); }
  .vs { color: var(--c-text-dim, #64748b); font-weight: 600; font-size: 12px; }

  .meta { display: flex; flex-wrap: wrap; gap: 6px; }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    color: var(--c-text-dim, var(--c-text));
  }

  .chip.league { color: var(--accent); }
  .chip.time { color: var(--c-text); }
  .wat-date { white-space: normal; line-height: 1.3; }

  .confidence-band {
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, transparent), transparent 70%),
      var(--c-glass-sm);
    border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  }

  .shield { display: inline-flex; color: var(--accent); }

  .conf-text { display: flex; flex-direction: column; line-height: 1.2; flex: 1; min-width: 0; }

  .conf-pct { font-weight: 900; font-size: 17px; color: var(--accent); }

  .conf-label { font-size: 11px; color: var(--c-text-dim, var(--c-text)); }

  .edge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 800;
    color: #22c55e;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 45%;
  }

  .no-pick {
    margin-top: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    font-size: 12px;
    color: var(--c-text-dim, var(--c-text));
    background: var(--c-glass-sm);
    border: 1px dashed var(--c-border);
  }

  .mini-section { margin-top: 14px; }
  .mini-strip { margin-top: 14px; }

  .mini-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--c-text-dim, var(--c-text));
    margin-bottom: 8px;
  }

  .mini-title span { display: inline-flex; color: var(--accent); }

  .mini-metric-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 8px;
  }

  .mini-metric {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 9px 10px;
    border-radius: 12px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    min-width: 0;
  }
  .mini-metric.st-green { border-color: color-mix(in srgb, #22c55e 30%, var(--c-border-md)); }
  .mini-metric.st-amber { border-color: color-mix(in srgb, #f59e0b 30%, var(--c-border-md)); }
  .mini-metric.st-red { border-color: color-mix(in srgb, #ef4444 30%, var(--c-border-md)); }

  .mm-label { font-size: 10px; color: var(--c-text-dim, var(--c-text)); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
  .mini-metric.st-green .mm-value { color: #22c55e; }
  .mini-metric.st-amber .mm-value { color: #f59e0b; }
  .mini-metric.st-red .mm-value { color: #ef4444; }
  .mm-value { font-size: 18px; font-weight: 900; color: var(--c-text); font-family: var(--font-mono, 'JetBrains Mono', monospace); line-height: 1; }
  .mm-note { font-size: 10px; color: var(--c-text-dim, var(--c-text)); line-height: 1.3; }

  .expanded { margin-top: 14px; border-top: 1px solid var(--c-border); padding-top: 12px; }

  .exp-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim, var(--c-text)); margin-bottom: 8px; }

  .verdict-summary { font-size: 13px; line-height: 1.55; color: var(--c-text); margin: 0 0 8px; }

  .insight-top3 { display: flex; flex-direction: column; gap: 6px; }

  .insight-row {
    display: flex;
    gap: 10px;
    padding: 9px 11px;
    border-radius: 12px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border);
    align-items: flex-start;
  }

  .insight-row .rank { font-weight: 900; color: var(--accent); font-size: 13px; }
  .insight-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .insight-main .selection { font-weight: 800; font-size: 12.5px; color: var(--c-text); }
  .insight-main .market { font-size: 10.5px; color: var(--c-text-dim, var(--c-text)); }
  .insight-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
  .insight-right .confidence { font-weight: 900; font-size: 12.5px; color: #22c55e; }
  .insight-right .edge { font-size: 10px; color: #22c55e; font-weight: 700; max-width: none; }

  .pick-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }

  .pick-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--c-glass-sm);
    font-size: 12.5px;
  }

  .pick-name { font-weight: 800; color: var(--c-text); flex: 1; }
  .pick-market { color: var(--c-text-dim, var(--c-text)); font-size: 11px; }
  .pick-pct { color: var(--accent); font-weight: 800; font-variant-numeric: tabular-nums; }

  .trophy-note {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 10px;
    font-size: 12px;
    color: var(--c-text);
    background: linear-gradient(90deg, color-mix(in srgb, #f59e0b 14%, transparent), transparent);
    border: 1px solid color-mix(in srgb, #f59e0b 30%, transparent);
    border-radius: 10px;
    padding: 8px 10px;
  }

  .trophy-ic { color: #f59e0b; flex-shrink: 0; display: inline-flex; }

  .muted { color: var(--c-text-dim, var(--c-text)); font-size: 12px; }

  /* ── Analyze Match Action Button ────────────────────────────── */
  .analyze-match-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 800;
    color: #ffffff;
    background: linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent) 75%, #000));
    border: 1px solid color-mix(in srgb, var(--accent) 50%, #fff);
    box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 30%, transparent);
    cursor: pointer;
    margin-left: auto;
    transition: transform 120ms ease, box-shadow 120ms ease, background 180ms ease;
  }
  .analyze-match-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .analyze-match-btn:active {
    transform: translateY(0);
  }

  /* ── Great AI Minds Mini Badges Bar ─────────────────────────── */
  .gm-mini-badges {
    margin-top: 10px;
    padding: 8px 12px;
    border-radius: 12px;
    background: linear-gradient(135deg, color-mix(in srgb, #6366f1 12%, var(--c-surface-2)), var(--c-surface-2));
    border: 1px solid color-mix(in srgb, #6366f1 30%, transparent);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .gm-mini-title {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--c-text);
  }
  .gm-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 8px;
    line-height: 1.3;
  }
  .gm-badge.bg-winner {
    background: color-mix(in srgb, #10b981 16%, transparent);
    border: 1px solid color-mix(in srgb, #10b981 40%, transparent);
    color: #10b981;
  }
  .gm-badge.bg-spread {
    background: color-mix(in srgb, #6366f1 16%, transparent);
    border: 1px solid color-mix(in srgb, #6366f1 40%, transparent);
    color: #818cf8;
  }
  .gm-badge.bg-total {
    background: color-mix(in srgb, #a855f7 16%, transparent);
    border: 1px solid color-mix(in srgb, #a855f7 40%, transparent);
    color: #c084fc;
  }
  .ratio-text {
    font-weight: 900;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 11px;
    opacity: 0.95;
  }
</style>