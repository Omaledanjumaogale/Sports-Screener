<script lang="ts">
  import { Trophy, CheckCircle2, XCircle, MinusCircle, AlertTriangle, ShieldCheck, ChevronDown, ChevronUp, Bot, ExternalLink, HelpCircle, Flame } from '@lucide/svelte';
  import { gradeSelection, type GreatMindsDebateResult, type GreatMindsPick, type SelectionGrade } from '$lib/predictorTypes';
  import { GREAT_MINDS_MODELS } from '$lib/predictorTypes';

  let {
    debate = null as GreatMindsDebateResult | null,
    accent = '#6366f1',
    finalScore = null as string | null,
    finished = false
  }: {
    debate?: GreatMindsDebateResult | null;
    accent?: string;
    finalScore?: string | null;
    finished?: boolean;
  } = $props();

  let showFullTranscript = $state(false);
  let selectedRound = $state<number | null>(null);

  const isFinished = $derived(finished || !!finalScore);
  const gradeOf = (selection: string, marketLabel: string): SelectionGrade => {
    if (!isFinished || !finalScore || !debate) return null;
    return gradeSelection(selection, marketLabel, finalScore, {
      homeTeam: debate.homeTeam,
      awayTeam: debate.awayTeam,
      marketId: marketLabel
    });
  };
  const pickGrades = $derived([
    debate?.consensusPicks.winner ? { key: 'Winner', pick: debate.consensusPicks.winner, grade: gradeOf(debate.consensusPicks.winner.selection, 'result') } : null,
    debate?.consensusPicks.spread ? { key: 'Spread', pick: debate.consensusPicks.spread, grade: gradeOf(debate.consensusPicks.spread.selection, 'spread') } : null,
    debate?.consensusPicks.total ? { key: 'Total', pick: debate.consensusPicks.total, grade: gradeOf(debate.consensusPicks.total.selection, 'total') } : null
  ].filter(Boolean) as { key: string; pick: GreatMindsPick; grade: SelectionGrade }[]);
</script>

{#if debate}
  <div class="great-minds-panel" style={`--accent:${accent}`}>
        <header class="gm-head">
      <div class="gm-title-badge">
        <Trophy size={18} class="trophy-ic" />
        <h2>THE GREAT AI MINDS RECOMMEND</h2>
      </div>
      <span class="rounds-count">After 5 rounds</span>
    </header>

    {#if (debate.realWinChancePct ?? 0) > 0}
      <div class="cross-verified-strip">
        <ShieldCheck size={16} />
        <span class="cv-value">{debate.realWinChancePct}%</span>
        <span class="cv-label">Cross-Verified Real Win Chance — {debate.realWinChanceTag}</span>
      </div>
    {/if}

    {#if isFinished && finalScore}
      <div class="result-grade-strip">
        <span class="rg-title">Result grade — {finalScore}</span>
        <div class="rg-picks">
          {#each pickGrades as pg}
            {#if pg.grade}
              <span class={`rg-pick rg-${pg.grade === 'win' ? 'win' : pg.grade === 'loss' ? 'loss' : pg.grade === 'void' ? 'void' : 'push'}`} title={pg.pick.selection}>
                {#if pg.grade === 'win'}<CheckCircle2 size={12} />{:else if pg.grade === 'loss'}<XCircle size={12} />{:else if pg.grade === 'void'}<MinusCircle size={12} />{:else}<Flame size={12} />{/if}
                {pg.key} <strong>{pg.pick.selection}</strong>
              </span>
            {:else}
              <span class="rg-pick rg-na" title={pg.pick.selection}>{pg.key} <strong>{pg.pick.selection}</strong></span>
            {/if}
          {/each}
        </div>
      </div>
    {/if}

    <!-- 3 Core Market Recommendations Grid -->
    <div class="recommendations-grid">
      <!-- Winner / Moneyline -->
      {#if debate.consensusPicks.winner}
        {@const p = debate.consensusPicks.winner}
        <div class="rec-card winner-card">
          <span class="market-type-label">WINNER</span>
          <h3 class="rec-selection">{p.selection}</h3>
          <div class="rec-odds-line">
            <span class="odds-val">{p.odds}</span>
            <span class="consensus-tag tag-unanimous">
              <CheckCircle2 size={12} /> {p.consensusRatio}
            </span>
          </div>

          <div class="model-breakdown-list">
            {#each p.modelChoices as choice}
              {@const mDef = GREAT_MINDS_MODELS.find(m => m.id === choice.modelId)}
              <div class="model-row" class:is-dissent={!choice.isAgree}>
                <span class="model-icon" style={`background:${mDef?.iconBg || '#6366f1'}`}>
                  <Bot size={11} />
                </span>
                <span class="model-name">{choice.modelName}</span>
                <span class="model-pick" class:pick-agree={choice.isAgree} class:pick-dissent={!choice.isAgree}>
                  {choice.pick}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Spread / Asian Handicap -->
      {#if debate.consensusPicks.spread}
        {@const p = debate.consensusPicks.spread}
        <div class="rec-card spread-card">
          <span class="market-type-label">SPREAD</span>
          <h3 class="rec-selection">{p.selection}</h3>
          <div class="rec-odds-line">
            <span class="odds-val">{p.odds}</span>
            <span class="consensus-tag tag-strong">
              <CheckCircle2 size={12} /> {p.consensusRatio}
            </span>
          </div>

          <div class="model-breakdown-list">
            {#each p.modelChoices as choice}
              {@const mDef = GREAT_MINDS_MODELS.find(m => m.id === choice.modelId)}
              <div class="model-row" class:is-dissent={!choice.isAgree}>
                <span class="model-icon" style={`background:${mDef?.iconBg || '#6366f1'}`}>
                  <Bot size={11} />
                </span>
                <span class="model-name">{choice.modelName}</span>
                <span class="model-pick" class:pick-agree={choice.isAgree} class:pick-dissent={!choice.isAgree}>
                  {choice.pick}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Total / Over-Under -->
      {#if debate.consensusPicks.total}
        {@const p = debate.consensusPicks.total}
        <div class="rec-card total-card">
          <span class="market-type-label">TOTAL</span>
          <h3 class="rec-selection">{p.selection}</h3>
          <div class="rec-odds-line">
            <span class="odds-val">{p.odds}</span>
            <span class="consensus-tag tag-strong">
              <CheckCircle2 size={12} /> {p.consensusRatio}
            </span>
          </div>

          <div class="model-breakdown-list">
            {#each p.modelChoices as choice}
              {@const mDef = GREAT_MINDS_MODELS.find(m => m.id === choice.modelId)}
              <div class="model-row" class:is-dissent={!choice.isAgree}>
                <span class="model-icon" style={`background:${mDef?.iconBg || '#6366f1'}`}>
                  <Bot size={11} />
                </span>
                <span class="model-name">{choice.modelName}</span>
                <span class="model-pick" class:pick-agree={choice.isAgree} class:pick-dissent={!choice.isAgree}>
                  {choice.pick}
                </span>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>

    <!-- 5-Round Outcome Timeline -->
    <div class="rounds-timeline">
      <div class="timeline-head">
        <ShieldCheck size={16} />
        <h4>5-Round Debate Outcome Timeline</h4>
      </div>

      <div class="rounds-grid">
        {#each debate.rounds as r}
          <div class="round-card" class:is-selected={selectedRound === r.roundNumber}>
            <div class="round-num">ROUND {r.roundNumber}</div>
            <h5 class="round-title">{r.title}</h5>
            <p class="round-summary">{r.moderatorSummary}</p>
          </div>
        {/each}
      </div>
    </div>

    <!-- Expandable Audit Transcript Button -->
    <div class="audit-action">
      <button
        type="button"
        class="transcript-toggle-btn"
        onclick={() => (showFullTranscript = !showFullTranscript)}
      >
        {#if showFullTranscript}
          <ChevronUp size={16} /> Hide Full Audit Transcript
        {:else}
          <ChevronDown size={16} /> View Full Audit Transcript (Convex Persisted)
        {/if}
      </button>
    </div>

    {#if showFullTranscript}
      <div class="transcript-box">
        <pre>{debate.fullTranscript}</pre>
      </div>
    {/if}
  </div>
{/if}

<style>
  .great-minds-panel {
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 16px;
    padding: 20px;
    margin-top: 20px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
  }

  .gm-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 12px;
  }

  .result-grade-strip {
    margin: 12px 0 4px;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px dashed rgba(255, 255, 255, 0.14);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .rg-title {
    display: inline-flex;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #94a3b8;
  }
  .rg-picks { display: flex; flex-wrap: wrap; gap: 6px; }
  .rg-pick {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 700;
    padding: 4px 9px;
    border-radius: 999px;
    color: var(--c-text, #f1f5ff);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
  }
  .rg-win { color: #22c55e; background: rgba(34, 197, 94, 0.12); border-color: rgba(34, 197, 94, 0.4); }
  .rg-loss { color: #ef4444; background: rgba(239, 68, 68, 0.12); border-color: rgba(239, 68, 68, 0.4); }
  .rg-push { color: #f59e0b; background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.4); }
  .rg-void { color: #94a3b8; }
  .rg-na { opacity: 0.55; }

  .gm-title-badge {
    display: flex;
    align-items: center;
    gap: 10px;

    :global(.trophy-ic) {
      color: #fbbf24;
    }

    h2 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: -0.01em;
    }
  }

  .rounds-count {
    font-size: 0.8rem;
    font-weight: 700;
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.06);
    padding: 4px 10px;
    border-radius: 6px;
  }

  .cross-verified-strip {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: -8px 0 20px;
    padding: 12px 14px;
    border-radius: 12px;
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, transparent), transparent 70%),
      rgba(15, 23, 42, 0.85);
    border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    color: #a5b4fc;
  }

  .cv-value {
    font-size: 1.25rem;
    font-weight: 900;
    color: var(--accent);
  }

  .cv-label {
    font-size: 0.82rem;
    font-weight: 700;
    color: #e2e8f0;
  }

  /* 3 Core Market Recommendation Grid */
  .recommendations-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .rec-card {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;
    overflow: hidden;
  }

  .rec-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: #10b981;
  }

  .market-type-label {
    font-size: 0.7rem;
    font-weight: 800;
    color: #64748b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .rec-selection {
    font-size: 1.25rem;
    font-weight: 800;
    color: #f8fafc;
    margin: 0 0 8px;
  }

  .rec-odds-line {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
  }

  .odds-val {
    font-size: 0.95rem;
    font-weight: 800;
    color: #10b981;
  }

  .consensus-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
  }

  .tag-unanimous {
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
  }

  .tag-strong {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  /* Model Breakdown List */
  .model-breakdown-list {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 12px;
  }

  .model-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.78rem;
    padding: 4px 6px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.4);
  }

  .model-row.is-dissent {
    background: rgba(239, 68, 68, 0.1);
  }

  .model-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    color: #fff;
    margin-right: 6px;
  }

  .model-name {
    color: #94a3b8;
    font-weight: 600;
    flex: 1;
    text-align: left;
  }

  .model-pick {
    font-weight: 700;
  }

  .pick-agree {
    color: #34d399;
  }

  .pick-dissent {
    color: #f87171;
  }

  /* Timeline */
  .rounds-timeline {
    margin-bottom: 20px;
  }

  .timeline-head {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #818cf8;
    margin-bottom: 12px;

    h4 {
      margin: 0;
      font-size: 0.95rem;
      font-weight: 700;
      color: #f1f5f9;
    }
  }

  .rounds-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }

  .round-card {
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    padding: 12px;
  }

  .round-num {
    font-size: 0.65rem;
    font-weight: 800;
    color: #818cf8;
    letter-spacing: 0.06em;
    margin-bottom: 4px;
  }

  .round-title {
    margin: 0 0 6px;
    font-size: 0.8rem;
    font-weight: 700;
    color: #f8fafc;
  }

  .round-summary {
    margin: 0;
    font-size: 0.72rem;
    color: #94a3b8;
    line-height: 1.35;
  }

  /* Transcript Toggle */
  .audit-action {
    display: flex;
    justify-content: center;
    margin-top: 10px;
  }

  .transcript-toggle-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #cbd5e1;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
  }

  .transcript-toggle-btn:hover {
    background: rgba(255, 255, 255, 0.12);
    color: #f8fafc;
  }

  .transcript-box {
    margin-top: 14px;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 14px;
    max-height: 250px;
    overflow-y: auto;
  }

  .transcript-box pre {
    margin: 0;
    font-family: monospace;
    font-size: 0.75rem;
    color: #a7f3d0;
    white-space: pre-wrap;
  }
</style>
