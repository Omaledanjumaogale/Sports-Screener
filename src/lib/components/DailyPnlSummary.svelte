<script lang="ts">
  import { TrendingUp, Flame, Moon, Award, DollarSign, BarChart2 } from '@lucide/svelte';
  import { generateDailyPnlSummary } from '$lib/greatMindsEngine';
  import type { DailyPnlSummaryData } from '$lib/predictorTypes';

  let selectedFilter = $state<'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL'>('ALL');
  const data = $derived(generateDailyPnlSummary(selectedFilter));

  const filters: { key: 'ALL' | 'MONEYLINE' | 'SPREAD' | 'TOTAL'; label: string }[] = [
    { key: 'ALL', label: 'ALL' },
    { key: 'MONEYLINE', label: 'MONEYLINE' },
    { key: 'SPREAD', label: 'SPREAD' },
    { key: 'TOTAL', label: 'TOTAL' }
  ];
</script>

<section class="pnl-summary-container" aria-label="Daily P&L & Consensus Performance Summary">
  <header class="pnl-header">
    <div class="pnl-title-group">
      <span class="pnl-icon"><BarChart2 size={18} stroke-width={2.2} /></span>
      <h2>Daily Performance & Consensus Summary</h2>
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

  <!-- Stat Cards Grid -->
  <div class="stat-cards-grid">
    {#each data.rows as row}
      <div class="stat-card" class:is-overall={row.ratioKey === 'ALL'}>
        <div class="card-head">
          <span class="card-badge">
            {#if row.ratioKey === '5/5'}
              <Flame size={14} class="flame-ic" />
            {:else if row.ratioKey === '4/5'}
              <Moon size={14} class="moon-ic" />
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
</style>
