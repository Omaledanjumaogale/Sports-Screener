<script lang="ts">
  import type { Pick } from '../engine';

  let {
    picks = [] as Pick[],
    limit = 12,
    accent = '#22c55e'
  }: {
    picks?: Pick[];
    limit?: number;
    accent?: string;
  } = $props();
</script>

{#if picks.length}
  <section class="ranking" style={`--accent:${accent}`} aria-label="Live picks ranking">
    <header class="ranking-header">
      <h2>Live Ranking</h2>
      <span class="count">{Math.min(picks.length, limit)} / {picks.length}</span>
    </header>
    <ol class="rank-list" role="list">
      {#each picks.slice(0, limit) as pick, i}
        <li class="rank-row" style={`--row-accent:${i < 3 ? accent : 'transparent'}`} aria-label={`Rank ${i + 1}: ${pick.label}, probability ${pick.probability.toFixed(1)}%`}>
          <div class="rank-index" aria-hidden="true">{i + 1}</div>
          <div class="rank-info">
            <div class="rank-title">
              <b>{pick.label}</b>
              {#if pick.ev !== undefined}
                <span class={`ev-tag ${pick.ev > 0 ? 'pos' : pick.ev < -0.08 ? 'neg' : ''}`}>
                  {pick.ev > 0 ? '+' : ''}{(pick.ev * 100).toFixed(1)}% EV
                </span>
              {/if}
            </div>
            <small class="rank-meta">
              {pick.marketTitle} · odds {pick.odds.toFixed(2)}
              {#if pick.margin !== undefined} · vig {pick.margin.toFixed(1)}%{/if}
            </small>
          </div>
          <div class="rank-prob">
            <strong>{pick.probability.toFixed(1)}%</strong>
            <div class="prob-bar" role="presentation">
              <div class="prob-fill" style={`width:${Math.min(100, pick.probability)}%`}></div>
            </div>
          </div>
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .ranking {
    margin-top: 14px;
    padding: 16px;
    border: 1px solid #223047;
    background: #0f1726;
    border-radius: 14px;
  }
  .ranking-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }
  .ranking-header h2 {
    font-size: 15px;
    margin: 0;
    color: #eaf3ff;
    letter-spacing: -0.005em;
  }
  .count {
    font-size: 11px;
    font-weight: 700;
    color: #8ea3c3;
    background: #111c2f;
    padding: 3px 9px;
    border-radius: 999px;
  }
  .rank-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 2px;
  }
  .rank-row {
    display: grid;
    grid-template-columns: 28px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 10px 10px 8px;
    border-radius: 10px;
    background: linear-gradient(90deg, color-mix(in srgb, var(--row-accent) 8%, transparent), transparent 40%);
    border-top: 1px solid #1b2840;
    transition: background 120ms;
  }
  .rank-row:hover { background: #111c2f; }
  .rank-index {
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    background: #1a2944;
    color: #8ea3c3;
    font-size: 12px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .rank-row:nth-child(1) .rank-index { background: color-mix(in srgb, var(--accent) 28%, #1a2944); color: #fff; }
  .rank-row:nth-child(2) .rank-index { background: color-mix(in srgb, var(--accent) 18%, #1a2944); color: #eaf3ff; }
  .rank-row:nth-child(3) .rank-index { background: color-mix(in srgb, var(--accent) 10%, #1a2944); color: #eaf3ff; }

  .rank-info { min-width: 0; }
  .rank-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rank-title b {
    font-size: 13.5px;
    color: #eaf3ff;
    font-weight: 750;
  }
  .ev-tag {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 999px;
    background: #1a2944;
    color: #c7d7ee;
    letter-spacing: 0.02em;
  }
  .ev-tag.pos { color: #7ef0b2; background: #0d3324; }
  .ev-tag.neg { color: #ff99a3; background: #35131a; }
  .rank-meta {
    display: block;
    color: #9fb2cc;
    margin-top: 3px;
    line-height: 1.4;
    font-size: 11.5px;
  }
  .rank-prob {
    text-align: right;
    min-width: 72px;
  }
  .rank-prob strong {
    display: block;
    color: var(--accent);
    font-size: 15px;
    font-variant-numeric: tabular-nums;
    font-weight: 800;
    line-height: 1;
  }
  .prob-bar {
    height: 4px;
    width: 68px;
    background: #1a2944;
    border-radius: 4px;
    overflow: hidden;
    margin-top: 5px;
    margin-left: auto;
  }
  .prob-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 50%, #38bdf8));
    border-radius: 4px;
    transition: width 200ms ease;
  }
</style>
