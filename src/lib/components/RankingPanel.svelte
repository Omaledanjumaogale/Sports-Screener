<script lang="ts">
  import type { Pick } from '../engine';

  let {
    picks = [] as Pick[],
    limit = 12,
    accent = '#6366f1'
  }: {
    picks?: Pick[];
    limit?: number;
    accent?: string;
  } = $props();

  const medalColors = [
    { bg: 'linear-gradient(135deg,#ffd700,#f59e0b)', shadow: 'rgba(245,158,11,0.5)' },
    { bg: 'linear-gradient(135deg,#e2e8f0,#94a3b8)', shadow: 'rgba(148,163,184,0.4)' },
    { bg: 'linear-gradient(135deg,#cd7f32,#92400e)', shadow: 'rgba(146,64,14,0.4)' }
  ];
</script>

{#if picks.length}
  <section class="ranking" style={`--accent:${accent}`} aria-label="Live picks ranking">
    <header class="rank-header">
      <h2>
        <span class="trophy-icon" aria-hidden="true">🏆</span>
        Top Picks
      </h2>
      <span class="count-badge">{Math.min(picks.length, limit)} / {picks.length}</span>
    </header>

    <ol class="rank-list" role="list">
      {#each picks.slice(0, limit) as pick, i}
        <li
          class="rank-row"
          class:top-3={i < 3}
          aria-label={`Rank ${i + 1}: ${pick.label}, probability ${pick.probability.toFixed(1)}%`}
        >
          <!-- Rank badge -->
          {#if i < 3}
            <div
              class="rank-badge medal"
              style={`background:${medalColors[i].bg}; box-shadow: 0 0 12px ${medalColors[i].shadow}`}
              aria-hidden="true"
            >
              {i + 1}
            </div>
          {:else}
            <div class="rank-badge" aria-hidden="true">{i + 1}</div>
          {/if}

          <!-- Info -->
          <div class="rank-info">
            <div class="rank-title-row">
              <b class="rank-label">{pick.label}</b>
              {#if pick.confluenceTier}
                <span class={`tier-mini-pill ${pick.confluenceTier.includes('Tier 1') ? 't1' : pick.confluenceTier.includes('Tier 2') ? 't2' : pick.confluenceTier.includes('Conflicted') ? 't-conflict' : ''}`}>
                  {pick.confluenceTier.split(' — ')[0]}
                </span>
              {/if}
              {#if pick.ev !== undefined}
                <span class={`ev-pill ${pick.ev > 0 ? 'ev-pos' : pick.ev < -0.08 ? 'ev-neg' : ''}`}>
                  {pick.ev > 0 ? '+' : ''}{(pick.ev * 100).toFixed(1)}% EV
                </span>
              {/if}
            </div>
            <small class="rank-meta">
              {pick.marketTitle}
              <span class="meta-sep">·</span>
              <span class="mono">{pick.odds.toFixed(2)}</span>
              {#if pick.margin !== undefined}
                <span class="meta-sep">·</span>
                vig {pick.margin.toFixed(1)}%
              {/if}
            </small>
          </div>

          <!-- Probability -->
          <div class="rank-prob">
            <strong class="prob-pct mono">{pick.probability.toFixed(1)}%</strong>
            <div class="prob-bar" role="presentation">
              <div
                class="prob-fill"
                style={`width:${Math.min(100, pick.probability)}%`}
              ></div>
            </div>
          </div>
        </li>
      {/each}
    </ol>
  </section>
{/if}

<style>
  .ranking {
    padding: 18px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    content-visibility: auto;
    contain-intrinsic-size: auto 400px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    animation: slide-up 0.4s ease both;
  }

  .rank-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 14px;
  }
  .rank-header h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 15px;
    font-weight: 800;
    color: var(--c-text, #f1f5ff);
    margin: 0;
    letter-spacing: -0.01em;
  }
  .trophy-icon {
    font-size: 17px;
    filter: drop-shadow(0 0 6px rgba(245,158,11,0.6));
    animation: pulse-glow 3s ease-in-out infinite;
  }
  .count-badge {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--c-glass-sm));
    border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
    padding: 3px 10px;
    border-radius: 999px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }

  .rank-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 3px;
  }

  .rank-row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 10px 8px;
    border-radius: 12px;
    border-top: 1px solid var(--c-border-sm);
    transition: background var(--t-base, 180ms ease);
  }
  .rank-row:hover { background: var(--c-glass-sm); }
  .rank-row.top-3 {
    background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 6%, transparent) 0%, transparent 60%);
  }

  /* Rank badge */
  .rank-badge {
    width: 30px; height: 30px;
    border-radius: 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    background: var(--c-glass-md);
    color: var(--c-muted);
    border: 1px solid var(--c-border-sm);
    flex-shrink: 0;
  }
  .medal {
    color: #000;
    border: none;
    font-weight: 900;
    font-size: 11px;
  }

  /* Info */
  .rank-info { min-width: 0; }
  .rank-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .rank-label {
    font-size: 13.5px;
    color: var(--c-text, #f1f5ff);
    font-weight: 700;
    line-height: 1.2;
  }
  .ev-pill {
    font-size: 9.5px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 999px;
    background: var(--c-glass-md);
    color: var(--c-muted);
    letter-spacing: 0.04em;
    border: 1px solid var(--c-border-sm);
  }
  .ev-pos { color: var(--c-green); background: color-mix(in srgb, var(--c-green) 12%, transparent); border-color: color-mix(in srgb, var(--c-green) 25%, transparent); }
  .ev-neg { color: var(--c-red);   background: color-mix(in srgb, var(--c-red) 12%, transparent); border-color: color-mix(in srgb, var(--c-red) 25%, transparent); }

  .tier-mini-pill {
    font-size: 9.5px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }
  .tier-mini-pill.t1 { background: rgba(34, 197, 94, 0.15); color: #4ade80; border-color: rgba(34, 197, 94, 0.4); }
  .tier-mini-pill.t2 { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: rgba(56, 189, 248, 0.4); }
  .tier-mini-pill.t-conflict { background: rgba(239, 68, 68, 0.15); color: #f87171; border-color: rgba(239, 68, 68, 0.4); }

  .rank-meta {
    display: block;
    color: var(--c-muted, #8899bb);
    margin-top: 3px;
    line-height: 1.4;
    font-size: 11.5px;
    font-weight: 500;
  }
  .meta-sep { color: var(--c-faint, #5a6e8a); margin: 0 3px; }
  .mono { font-family: var(--font-mono, 'JetBrains Mono', monospace); }

  /* Probability */
  .rank-prob { text-align: right; min-width: 68px; }
  .prob-pct {
    display: block;
    color: var(--accent);
    font-size: 15px;
    font-weight: 700;
    line-height: 1;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
  }
  .prob-bar {
    height: 3px;
    width: 64px;
    background: var(--c-border-md);
    border-radius: 3px;
    overflow: hidden;
    margin-top: 6px;
    margin-left: auto;
  }
  .prob-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, #a3e635));
    border-radius: 3px;
    transition: width 400ms ease;
  }
</style>
