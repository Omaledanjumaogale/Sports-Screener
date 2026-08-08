<script lang="ts">
  import { TrendingUp, Flame, Moon, Award, DollarSign, BarChart2, Brain, Bot, RefreshCw } from '@lucide/svelte';
  import { generateDailyPnlSummary } from '$lib/greatMindsEngine';
  import type { DailyPnlSummaryData, PnlSportFilter, PnlMarketFilter, PredictorMatch, PredictorSportId } from '$lib/predictorTypes';
  import { PREDICTOR_SPORTS } from '$lib/predictorTypes';
  import { GREAT_MINDS_MODELS } from '$lib/predictorTypes';
  import { onMount } from 'svelte';

  let {
    matches = [] as PredictorMatch[]
  }: {
    matches?: PredictorMatch[];
  } = $props();

  let selectedSport = $state<PnlSportFilter>('ALL');
  let selectedFilter = $state<PnlMarketFilter>('ALL');
  let lastRefreshedAt = $state<Date | null>(null);

  const data = $derived(generateDailyPnlSummary(matches, selectedSport, selectedFilter));

  // Update lastRefreshedAt whenever the matches data changes.
  $effect(() => {
    if (matches.length > 0) lastRefreshedAt = new Date();
  });

  function formatRefreshTime(d: Date): string {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  const filters: { key: PnlMarketFilter; label: string }[] = [
    { key: 'ALL', label: 'ALL' },
    { key: 'MONEYLINE', label: 'MONEYLINE' },
    { key: 'SPREAD', label: 'SPREAD' },
    { key: 'TOTAL', label: 'TOTAL' }
  ];

  const sportTabs: { key: PnlSportFilter; label: string }[] = [
    { key: 'ALL', label: 'All Sports' },
    ...PREDICTOR_SPORTS.map((s: PredictorSportId) => ({
      key: s,
      label: s === 'rally' ? 'Table Tennis' : s === 'americanfootball' ? 'Am. Football' : s === 'mma' ? 'MMA' : s.charAt(0).toUpperCase() + s.slice(1)
    }))
  ];

  function modelLabel(id: string): string {
    const m = GREAT_MINDS_MODELS.find((mm) => mm.id === id);
    return m?.name ?? id;
  }
</script>

<section class="pnl-summary-container" aria-label="Daily P&L &amp; Consensus Performance Summary">
  <header class="pnl-header">
    <div class="pnl-title-group">
      <span class="pnl-icon"><BarChart2 size={18} stroke-width={2.2} /></span>
      <h2>Daily Performance &amp; Consensus Summary</h2>
      <span class="live-badge" aria-label="Live updates enabled">
        <span class="live-dot" aria-hidden="true"></span>
        Live
      </span>
    </div>

    <div class="pnl-meta-row">
      {#if matches.length > 0}
        <span class="pnl-match-count" aria-label="{matches.length} matches tracked">
          {matches.length} {matches.length === 1 ? 'match' : 'matches'}
        </span>
      {/if}
      {#if lastRefreshedAt}
        <span class="pnl-refresh-time" aria-live="polite" aria-atomic="true">
          <RefreshCw size={11} stroke-width={2.4} />
          Updated {formatRefreshTime(lastRefreshedAt)}
        </span>
      {/if}
    </div>

    <div class="pnl-filters" role="tablist">
      {#each filters as f}
        <button
          type="button"
          role="tab"
          class="filter-tab"
          class:active={selectedFilter === f.key}
          aria-selected={selectedFilter === f.key}
          onclick={() => (selectedFilter = f.key)}
        >
          {f.label}
        </button>
      {/each}
    </div>
  </header>

  <!-- Sport Selector -->
  <div class="sport-selector" role="tablist" aria-label="Filter summary by sport">
    {#each sportTabs as t}
      <button
        type="button"
        role="tab"
        class="sport-tab"
        class:active={selectedSport === t.key}
        aria-selected={selectedSport === t.key}
        onclick={() => (selectedSport = t.key)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <!-- Stat Cards Grid -->
  <div class="stat-cards-grid">
    {#each data.rows as row}
      <div class="stat-card" class:is-overall={row.ratioKey === 'ALL'}>
        <div class="card-head">
          <span class="card-badge">
            {#if row.ratioKey === '5/5'}
              <Flame size={14} class="flame-ic" />
            {:else if row.ratioKey === '4/5'}
              <Flame size={14} class="moon-ic" />
            {:else if row.ratioKey === '3/5'}
              <Award size={14} class="award-ic" />
            {:else}
              <TrendingUp size={14} class="overall-ic" />
            {/if}
            {row.consensusLabel}
          </span>
        </div>

        <div class="main-winrate" class:is-positive={row.winRatePct >= 60} class:is-negative={row.winRatePct < 50}>
          {row.winRatePct}%
        </div>

        <div class="record-line">
          {row.wins}W - {row.losses}L ({row.picksCount} picks)
        </div>

        <div class="pnl-metrics">
          <span class="units-pnl" class:is-pos={row.unitsPnl > 0} class:is-neg={row.unitsPnl < 0}>
            {row.unitsPnl > 0 ? '+' : ''}{row.unitsPnl}u
          </span>
          <span class="roi-pct" class:is-pos={row.roiPct > 0} class:is-neg={row.roiPct < 0}>
            {row.roiPct > 0 ? '+' : ''}{row.roiPct}% ROI
          </span>
        </div>
      </div>
    {/each}
  </div>

  <!-- Detailed Table -->
  <div class="table-wrapper">
    <table class="pnl-table">
      <thead>
        <tr>
          <th>CONSENSUS</th>
          <th>PICKS</th>
          <th>WINS</th>
          <th>LOSSES</th>
          <th>PUSH</th>
          <th>WIN RATE</th>
          <th>UNITS P&L</th>
          <th>ROI</th>
        </tr>
      </thead>
      <tbody>
        {#each data.rows as row}
          <tr class:is-overall-row={row.ratioKey === 'ALL'}>
            <td class="consensus-cell">
              <span class="cell-tag tag-{row.ratioKey.replace('/', '-')}">
                {row.ratioKey === 'ALL' ? 'ALL' : row.ratioKey}
              </span>
            </td>
            <td>{row.picksCount}</td>
            <td class="text-win">{row.wins}</td>
            <td class="text-loss">{row.losses}</td>
            <td>{row.push > 0 ? row.push : '—'}</td>
            <td>
              <span class="rate-badge" class:rate-high={row.winRatePct >= 60} class:rate-low={row.winRatePct < 50}>
                {row.winRatePct}%
              </span>
            </td>
            <td class="val-units" class:is-pos={row.unitsPnl > 0} class:is-neg={row.unitsPnl < 0}>
              {row.unitsPnl > 0 ? '+' : ''}{row.unitsPnl}u
            </td>
            <td class="val-roi" class:is-pos={row.roiPct > 0} class:is-neg={row.roiPct < 0}>
              {row.roiPct > 0 ? '+' : ''}{row.roiPct}%
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Great AI Minds Performance Panel -->
  <div class="minds-panel">
    <div class="minds-panel-head">
      <span class="minds-panel-icon"><Brain size={16} /></span>
      <h3>Great AI Minds Performance</h3>
      <span class="minds-count-chip">{data.greatMindsStats.totalDebatesCount} debates</span>
    </div>

    <div class="minds-grid">
      {#each GREAT_MINDS_MODELS as model}
        {@const acc = data.greatMindsStats.modelAccuracyMap[model.id] ?? 0}
        {@const isTop = data.greatMindsStats.topModel === model.name}
        <div class="model-card" class:is-top={isTop}>
          <span class="model-bot"><Bot size={13} /></span>
          <span class="model-name">{model.name}</span>
          {#if isTop}<span class="model-top-tag">TOP</span>{/if}
          <div class="model-bar-bg"><div class="model-bar" style={`width:${acc}%`}></div></div>
          <span class="model-acc" class:is-pos={acc >= 50}>{acc}%</span>
        </div>
      {/each}
    </div>

    <div class="minds-summary-row">
      <span>Unanimous (5/5) win rate: <strong>{data.greatMindsStats.unanimousWinRatePct}%</strong></span>
      <span>Strong (4/5) win rate: <strong>{data.greatMindsStats.strongWinRatePct}%</strong></span>
      <span>Majority (3/5) win rate: <strong>{data.greatMindsStats.majorityWinRatePct}%</strong></span>
      <span>Leading model: <strong>{data.greatMindsStats.topModel}</strong></span>
    </div>
  </div>
</section>

<style>
  .pnl-summary-container {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }

  .pnl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 12px;
  }

  .pnl-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .pnl-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(99, 102, 241, 0.2);
    color: #818cf8;
  }

  .pnl-title-group h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: -0.01em;
  }

  .pnl-filters {
    display: flex;
    gap: 6px;
    background: rgba(0, 0, 0, 0.3);
    padding: 4px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .filter-tab {
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 6px 14px;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .filter-tab:hover {
    color: #f8fafc;
  }

  .filter-tab.active {
    background: #10b981;
    color: #0f172a;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
  }

  /* Stat Cards Grid */
  .stat-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }

  .stat-card {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .stat-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .stat-card.is-overall {
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(16, 185, 129, 0.1) 100%);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .card-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.04em;
    text-transform: uppercase;

    :global(.flame-ic) { color: #f59e0b; }
    :global(.moon-ic) { color: #10b981; }
    :global(.award-ic) { color: #3b82f6; }
    :global(.overall-ic) { color: #a855f7; }
  }

  .main-winrate {
    font-size: 2.2rem;
    font-weight: 800;
    line-height: 1.1;
    margin: 8px 0 4px;
    color: #f8fafc;
  }

  .main-winrate.is-positive {
    color: #10b981;
  }

  .main-winrate.is-negative {
    color: #ef4444;
  }

  .record-line {
    font-size: 0.8rem;
    color: #94a3b8;
    margin-bottom: 10px;
  }

  .pnl-metrics {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85rem;
    font-weight: 700;
  }

  .is-pos { color: #10b981; }
  .is-neg { color: #ef4444; }

  /* Table Styling */
  .table-wrapper {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .pnl-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    text-align: left;
  }

  .pnl-table th {
    background: rgba(15, 23, 42, 0.95);
    color: #64748b;
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .pnl-table td {
    padding: 12px 14px;
    color: #cbd5e1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .pnl-table tr:last-child td {
    border-bottom: none;
  }

  .is-overall-row {
    background: rgba(16, 185, 129, 0.05);
    font-weight: 700;
  }

  .cell-tag {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.08);
  }

  .tag-5-5 { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
  .tag-4-5 { background: rgba(16, 185, 129, 0.15); color: #34d399; }
  .tag-3-5 { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
  .tag-ALL { background: rgba(168, 85, 247, 0.15); color: #c084fc; }

  .text-win { color: #10b981; font-weight: 700; }
  .text-loss { color: #ef4444; font-weight: 700; }

  .rate-badge {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 700;
  }

  .rate-high { background: rgba(16, 185, 129, 0.2); color: #34d399; }
  .rate-low { background: rgba(239, 68, 68, 0.2); color: #f87171; }

  @media (max-width: 640px) {
    .pnl-summary-container {
      padding: 14px;
    }

    .pnl-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .stat-cards-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  /* Sport selector */
  .sport-selector {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    margin-bottom: 16px;
    padding: 4px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .sport-tab {
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 6px 12px;
    font-size: 0.75rem;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .sport-tab:hover {
    color: #f8fafc;
  }

  .sport-tab.active {
    background: #6366f1;
    color: #fff;
    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);
  }

  /* Great AI Minds panel */
  .minds-panel {
    margin-top: 20px;
    background: rgba(30, 41, 59, 0.55);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 16px;
  }

  .minds-panel-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
  }

  .minds-panel-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: rgba(168, 85, 247, 0.2);
    color: #a855f7;
  }

  .minds-panel-head h3 {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 700;
    color: #f8fafc;
    flex: 1;
  }

  .minds-count-chip {
    font-size: 0.7rem;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.08);
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .minds-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    gap: 10px;
  }

  .model-card {
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .model-card.is-top {
    border-color: rgba(168, 85, 247, 0.5);
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.7), rgba(168, 85, 247, 0.12));
  }

  .model-bot {
    display: inline-flex;
    color: #a855f7;
  }

  .model-name {
    font-size: 0.8rem;
    font-weight: 700;
    color: #e2e8f0;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .model-top-tag {
    font-size: 0.62rem;
    font-weight: 800;
    color: #0f172a;
    background: #a855f7;
    border-radius: 4px;
    padding: 1px 6px;
    letter-spacing: 0.05em;
  }

  .model-bar-bg {
    height: 6px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .model-bar {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #a855f7, #6366f1);
    transition: width 0.4s ease;
  }

  .model-acc {
    font-size: 0.9rem;
    font-weight: 800;
    color: #e2e8f0;
  }

  .model-acc.is-pos {
    color: #34d399;
  }

  .minds-summary-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 18px;
    margin-top: 14px;
    font-size: 0.78rem;
    color: #94a3b8;
  }

  .minds-summary-row strong {
    color: #f8fafc;
    font-weight: 700;
  }

  /* Live badge and meta row */
  .pnl-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .live-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #34d399;
    background: color-mix(in srgb, #34d399 12%, transparent);
    border: 1px solid color-mix(in srgb, #34d399 30%, transparent);
    border-radius: 999px;
    padding: 2px 8px;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 6px #34d399;
    animation: livePulse 2s ease-in-out infinite;
  }

  @keyframes livePulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  .pnl-meta-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .pnl-match-count {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(148, 163, 184, 0.1);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 999px;
    padding: 2px 10px;
  }

  .pnl-refresh-time {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    color: #64748b;
    font-variant-numeric: tabular-nums;
  }
</style>
