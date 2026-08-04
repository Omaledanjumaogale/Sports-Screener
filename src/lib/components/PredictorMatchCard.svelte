<script lang="ts">
  import { Trophy, Clock3, ShieldCheck, TrendingUp, Check } from '@lucide/svelte';
  import type { PredictorMatch } from '$lib/predictorTypes';
  import type { Analysis, Pick } from '$lib/engine';

  let {
    match,
    analysis = null as Analysis | null,
    qualifying = [] as Pick[],
    accent = '#6366f1',
    expanded = false,
    selectable = false,
    selected = false,
    disabled = false,
    onSelect = () => {}
  }: {
    match: PredictorMatch;
    analysis?: Analysis | null;
    qualifying?: Pick[];
    accent?: string;
    expanded?: boolean;
    selectable?: boolean;
    selected?: boolean;
    disabled?: boolean;
    onSelect?: () => void;
  } = $props();

  const kickoff = $derived(
    new Date(match.startTime).toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  );

  const top = $derived(qualifying[0] ?? null);
  const bestPct = $derived(top ? Number(top.probability).toFixed(1) : null);
</script>

<article
  class="match-card"
  class:is-selected={selected}
  class:is-disabled={disabled}
  class:is-selectable={selectable}
  style={`--accent:${accent}`}
  onclick={selectable && !disabled ? onSelect : undefined}
  aria-hidden={selectable ? 'false' : undefined}
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
          aria-disabled={disabled}
          disabled={disabled}
          aria-label={`${selected ? 'Remove' : 'Add'} ${match.homeTeam} vs ${match.awayTeam} ${disabled ? '(already in play)' : ''}`}
          title={disabled ? 'Match already in play — pre-match model not valid' : selected ? 'Remove from analysis' : 'Add to analysis'}
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
    </div>
    <div class="meta">
      {#if disabled}
        <span class="chip live">In play</span>
      {/if}
      <span class="chip league" title={match.league}>{match.league}</span>
      <span class="chip time"><Clock3 size={12} stroke-width={2.2} />{kickoff}</span>
      <span class="chip source">{match.source}</span>
    </div>
  </header>

  {#if bestPct}
    <div class="confidence-band">
      <span class="shield"><ShieldCheck size={15} stroke-width={2.4} /></span>
      <div class="conf-text">
        <span class="conf-pct">{bestPct}%</span>
        <span class="conf-label">Real Win Chance — cleared the {Math.round(Number(top!.probability)) >= 60 ? '60%' : '60%'} floor</span>
      </div>
      <span class="edge"><TrendingUp size={14} stroke-width={2.2} />{top!.label}</span>
    </div>
  {:else}
    <div class="no-pick">No selection cleared the confidence floor this cycle.</div>
  {/if}

  {#if expanded && analysis}
    <div class="expanded">
      <div class="exp-title">Top qualifying selections</div>
      {#if qualifying.length > 0}
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
            {Number(top.probability) >= 60 ? 'Highest-confidence signal this cycle.' : ''}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</article>

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

  .expanded { margin-top: 14px; border-top: 1px solid var(--c-border); padding-top: 12px; }

  .exp-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--c-text-dim, var(--c-text)); margin-bottom: 8px; }

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
</style>
