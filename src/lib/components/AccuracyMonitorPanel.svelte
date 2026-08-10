<script lang="ts">
  import { Activity, ShieldCheck, TrendingUp, AlertTriangle, CheckCircle2, Crosshair } from '@lucide/svelte';
  import { buildAccuracyReport, type AccuracyRow } from '$lib/predictorAccuracy';
  import type { PredictorMatch } from '$lib/predictorTypes';

  let {
    matches = [] as PredictorMatch[]
  }: {
    matches?: PredictorMatch[];
  } = $props();

  const report = $derived(buildAccuracyReport(matches));

  function gapClass(row: AccuracyRow): string {
    const gap = Math.abs(row.calibrationGapPct);
    if (row.picks < 5) return 'gap-neutral';
    if (gap <= 5) return 'gap-good';
    if (gap <= 12) return 'gap-warn';
    return 'gap-bad';
  }

  function gapLabel(row: AccuracyRow): string {
    if (row.picks < 5) return '—';
    const g = row.calibrationGapPct;
    return `${g > 0 ? '+' : ''}${g.toFixed(1)}%`;
  }
</script>

<section class="monitor-container" aria-label="Prediction Accuracy Monitoring">
  <header class="monitor-header">
    <div class="monitor-title-group">
      <span class="monitor-icon"><Activity size={18} stroke-width={2.2} /></span>
      <h2>Prediction Accuracy Monitoring</h2>
      <span class="monitor-chip">
        {report.finishedMatches} finished {report.finishedMatches === 1 ? 'match' : 'matches'}
      </span>
    </div>
    <p class="monitor-sub">
      Grades every resolved Great Minds pick against the real final score. The
      <strong>calibration gap</strong> compares the average published Real Win Chance with the actual win
      rate — 0% means the verdicts are delivering exactly what they promise.
    </p>
  </header>

  {#if report.overall.picks === 0}
    <div class="empty-state">
      <ShieldCheck size={22} />
      <span>No finished matches with scores yet — the monitor activates once the first results settle.</span>
    </div>
  {:else}
    <!-- Overall stat cards -->
    <div class="overall-cards">
      <div class="o-card">
        <span class="o-label">Resolved picks</span>
        <span class="o-value">{report.overall.picks}</span>
        <span class="o-sub">{report.overall.wins}W · {report.overall.losses}L · {report.overall.pushes}P</span>
      </div>
      <div class="o-card">
        <span class="o-label">Actual win rate</span>
        <span class="o-value" class:is-pos={report.overall.winRatePct >= 60} class:is-neg={report.overall.winRatePct < 50}>
          {report.overall.winRatePct}%
        </span>
        <span class="o-sub">of resolved picks</span>
      </div>
      <div class="o-card">
        <span class="o-label">Avg published</span>
        <span class="o-value">{report.overall.avgPredictedPct}%</span>
        <span class="o-sub">mean Real Win Chance</span>
      </div>
      <div class="o-card">
        <span class="o-label">Calibration gap</span>
        <span class="o-value {gapClass(report.overall)}">
          {gapLabel(report.overall)}
        </span>
        <span class="o-sub">promised vs delivered</span>
      </div>
    </div>

    <!-- By signal band -->
    <div class="monitor-block">
      <h3 class="block-title"><Crosshair size={14} /> Calibration by signal band</h3>
      <div class="table-wrapper">
        <table class="monitor-table">
          <thead>
            <tr>
              <th>SIGNAL</th>
              <th>PICKS</th>
              <th>W / L / P</th>
              <th>WIN RATE</th>
              <th>AVG PUBLISHED</th>
              <th>GAP</th>
            </tr>
          </thead>
          <tbody>
            {#each report.byBand as row}
              <tr>
                <td>
                  <span class="band-tag band-{row.group === 'Top Signal' ? 'top' : row.group === 'Strong Signal' ? 'strong' : row.group === 'Qualifying' ? 'qual' : 'ref'}">
                    {row.group}
                  </span>
                </td>
                <td>{row.picks}</td>
                <td class="wlp">{row.wins} / {row.losses} / {row.pushes}</td>
                <td><span class="rate-pill" class:rate-high={row.winRatePct >= 60} class:rate-low={row.winRatePct < 50}>{row.winRatePct}%</span></td>
                <td>{row.avgPredictedPct}%</td>
                <td><span class="gap-pill {gapClass(row)}">{gapLabel(row)}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="monitor-split">
      <!-- By market -->
      <div class="monitor-block">
        <h3 class="block-title"><TrendingUp size={14} /> By market</h3>
        <div class="table-wrapper">
          <table class="monitor-table">
            <thead>
              <tr><th>MARKET</th><th>PICKS</th><th>W / L / P</th><th>WIN RATE</th><th>GAP</th></tr>
            </thead>
            <tbody>
              {#each report.byMarket as row}
                <tr>
                  <td>{row.group}</td>
                  <td>{row.picks}</td>
                  <td class="wlp">{row.wins} / {row.losses} / {row.pushes}</td>
                  <td><span class="rate-pill" class:rate-high={row.winRatePct >= 60} class:rate-low={row.winRatePct < 50}>{row.winRatePct}%</span></td>
                  <td><span class="gap-pill {gapClass(row)}">{gapLabel(row)}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <!-- By sport -->
      <div class="monitor-block">
        <h3 class="block-title"><CheckCircle2 size={14} /> By sport</h3>
        <div class="table-wrapper">
          <table class="monitor-table">
            <thead>
              <tr><th>SPORT</th><th>PICKS</th><th>W / L / P</th><th>WIN RATE</th><th>GAP</th></tr>
            </thead>
            <tbody>
              {#each report.bySport as row}
                <tr>
                  <td class="sport-cell">{row.group}</td>
                  <td>{row.picks}</td>
                  <td class="wlp">{row.wins} / {row.losses} / {row.pushes}</td>
                  <td><span class="rate-pill" class:rate-high={row.winRatePct >= 60} class:rate-low={row.winRatePct < 50}>{row.winRatePct}%</span></td>
                  <td><span class="gap-pill {gapClass(row)}">{gapLabel(row)}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <footer class="monitor-foot">
      <AlertTriangle size={13} />
      <span>
        Small samples (under 5 picks) are not calibration-rated. Gaps grow more trustworthy as results accumulate
        across days — compare this panel against the Daily P&amp;L to spot per-market drift early.
      </span>
    </footer>
  {/if}
</section>

<style>
  .monitor-container {
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 24px;
    backdrop-filter: blur(12px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  }

  .monitor-header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 14px;
    margin-bottom: 16px;
  }

  .monitor-title-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .monitor-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .monitor-title-group h2 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: -0.01em;
  }

  .monitor-chip {
    font-size: 0.7rem;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.08);
    padding: 4px 10px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .monitor-sub {
    margin: 10px 0 0;
    font-size: 0.8rem;
    color: #94a3b8;
    line-height: 1.5;
  }

  .monitor-sub strong {
    color: #e2e8f0;
  }

  .empty-state {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #64748b;
    font-size: 0.85rem;
    background: rgba(30, 41, 59, 0.5);
    border: 1px dashed rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 18px;
  }

  .empty-state :global(svg) {
    color: #34d399;
    flex-shrink: 0;
  }

  .overall-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }

  .o-card {
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: transform 0.2s ease, border-color 0.2s ease;
  }

  .o-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.18);
  }

  .o-label {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #64748b;
  }

  .o-value {
    font-size: 1.6rem;
    font-weight: 800;
    color: #f8fafc;
    line-height: 1.1;
  }

  .o-value.is-pos { color: #34d399; }
  .o-value.is-neg { color: #f87171; }
  .o-value.gap-good { color: #34d399; }
  .o-value.gap-warn { color: #fbbf24; }
  .o-value.gap-bad { color: #f87171; }
  .o-value.gap-neutral { color: #94a3b8; }

  .o-sub {
    font-size: 0.72rem;
    color: #64748b;
  }

  .monitor-block {
    margin-bottom: 16px;
  }

  .block-title {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 0 0 10px;
    font-size: 0.82rem;
    font-weight: 700;
    color: #cbd5e1;
  }

  .block-title :global(svg) {
    color: #34d399;
  }

  .monitor-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 900px) {
    .monitor-split {
      grid-template-columns: 1fr;
    }
  }

  .table-wrapper {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .monitor-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
    text-align: left;
  }

  .monitor-table th {
    background: rgba(15, 23, 42, 0.95);
    color: #64748b;
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 10px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .monitor-table td {
    padding: 10px 12px;
    color: #cbd5e1;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    white-space: nowrap;
  }

  .monitor-table tr:last-child td {
    border-bottom: none;
  }

  .wlp {
    color: #94a3b8;
    font-variant-numeric: tabular-nums;
  }

  .sport-cell {
    text-transform: capitalize;
  }

  .band-tag {
    display: inline-block;
    padding: 3px 9px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .band-top { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
  .band-strong { background: rgba(16, 185, 129, 0.15); color: #34d399; }
  .band-qual { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
  .band-ref { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }

  .rate-pill {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 5px;
    font-weight: 700;
  }

  .rate-high { background: rgba(16, 185, 129, 0.2); color: #34d399; }
  .rate-low { background: rgba(239, 68, 68, 0.2); color: #f87171; }

  .gap-pill {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 5px;
    font-weight: 700;
  }

  .gap-pill.gap-good { background: rgba(16, 185, 129, 0.18); color: #34d399; }
  .gap-pill.gap-warn { background: rgba(245, 158, 11, 0.18); color: #fbbf24; }
  .gap-pill.gap-bad { background: rgba(239, 68, 68, 0.2); color: #f87171; }
  .gap-pill.gap-neutral { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }

  .monitor-foot {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 6px;
    font-size: 0.72rem;
    color: #64748b;
    line-height: 1.5;
  }

  .monitor-foot :global(svg) {
    color: #fbbf24;
    flex-shrink: 0;
    margin-top: 1px;
  }

  @media (max-width: 640px) {
    .monitor-container {
      padding: 14px;
    }
    .overall-cards {
      grid-template-columns: 1fr 1fr;
    }
  }
</style>
