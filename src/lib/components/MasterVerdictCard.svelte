<script lang="ts">
  import type { MasterConfluenceLedger } from '$lib/engine';
  import { ShieldAlert, CheckCircle2, XCircle, HelpCircle, Layers, AlertTriangle } from '@lucide/svelte';

  let { ledger }: { ledger: MasterConfluenceLedger | null } = $props();
</script>

{#if ledger}
  <div class="master-card" class:is-conflicted={ledger.tier === 'Tier 3 — Conflicted'} class:is-tier1={ledger.tier === 'Tier 1 — High Confluence'}>
    <div class="master-header">
      <div class="header-title">
        <span class="brain-badge"><Layers size={14} /> Offline Master Model</span>
        <h3 class="candidate-name">{ledger.candidateLabel}</h3>
      </div>
      <div class="tier-pill" class:tier-1={ledger.tier === 'Tier 1 — High Confluence'} class:tier-2={ledger.tier === 'Tier 2 — Moderate Confluence'} class:tier-conflicted={ledger.tier === 'Tier 3 — Conflicted'}>
        {ledger.tier}
      </div>
    </div>

    <!-- Dual Metrics Display: Probability + Margin -->
    <div class="metrics-grid">
      <div class="metric-box">
        <span class="m-label">Real Win Chance</span>
        <span class="m-val prob-val">{ledger.marketProbability !== null ? `${ledger.marketProbability}%` : '-'}</span>
        <span class="m-sub">Bookies Cut Excluded</span>
      </div>
      <div class="metric-box">
        <span class="m-label">Bookies Profit Cut</span>
        <span class="m-val margin-val">{ledger.bookmakerMargin !== null ? `${ledger.bookmakerMargin}%` : '-'}</span>
        <span class="m-sub">Bookmakers Fee Margin</span>
      </div>
      <div class="metric-box">
        <span class="m-label">Model Agreement Score</span>
        <span class="m-val agree-val">{ledger.agreeCount} / 5</span>
        <span class="m-sub">{ledger.agreeCount} Agree · {ledger.disagreeCount} Disagree</span>
      </div>
    </div>

    <!-- Confluence Ledger Table -->
    <div class="ledger-section">
      <h4 class="ledger-title">Market Agreement Breakdown (Cross-Market &amp; Cross-Scope Checks)</h4>
      <div class="ledger-rows">
        {#each ledger.rows as row}
          <div class="ledger-row" class:vote-agree={row.vote === 'Agree'} class:vote-disagree={row.vote === 'Disagree'}>
            <div class="row-info">
              <span class="row-name">{row.name}</span>
              <span class="row-detail">{row.detail}</span>
            </div>
            <div class="vote-badge" class:badge-agree={row.vote === 'Agree'} class:badge-disagree={row.vote === 'Disagree'} class:badge-na={row.vote === 'N/A'}>
              {#if row.vote === 'Agree'}
                <CheckCircle2 size={13} /> Agree
              {:else if row.vote === 'Disagree'}
                <XCircle size={13} /> Disagree
              {:else}
                <HelpCircle size={13} /> N/A
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Hard Conflict Notice -->
    {#if ledger.tier === 'Tier 3 — Conflicted' && ledger.conflictReason}
      <div class="conflict-alert" role="alert">
        <AlertTriangle class="alert-icon" size={18} />
        <div class="alert-text">
          <strong>Explicit Cross-Market Contradiction:</strong>
          <p>{ledger.conflictReason}</p>
        </div>
      </div>
    {/if}

    <!-- Missing Data Notice -->
    {#if ledger.missingFields.length > 0}
      <div class="missing-fields">
        <span class="missing-label">Unfilled inputs skipping checks:</span>
        <span class="missing-list">{ledger.missingFields.join(' · ')}</span>
      </div>
    {/if}

    <div class="master-footnote">
      <ShieldAlert size={12} />
      <span>This is a market-probability and cross-market-consistency read, not a profit forecast. Staking decisions remain your sole responsibility.</span>
    </div>
  </div>
{/if}

<style>
  .master-card {
    background: var(--c-surface, rgba(15, 23, 42, 0.6));
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.1));
    border-radius: 16px;
    padding: 16px;
    margin-bottom: 20px;
    backdrop-filter: blur(12px);
    transition: all 0.2s ease;
  }
  .master-card.is-tier1 {
    border-color: rgba(34, 197, 94, 0.4);
    box-shadow: 0 0 20px rgba(34, 197, 94, 0.1);
  }
  .master-card.is-conflicted {
    border-color: rgba(239, 68, 68, 0.4);
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.1);
  }

  .master-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--c-border, rgba(255, 255, 255, 0.08));
  }
  .brain-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--c-orange, #f97316);
    margin-bottom: 4px;
  }
  .candidate-name {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: var(--c-text, #ffffff);
  }

  .tier-pill {
    font-size: 12px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
    white-space: nowrap;
  }
  .tier-pill.tier-1 {
    background: rgba(34, 197, 94, 0.15);
    color: #4ade80;
    border-color: rgba(34, 197, 94, 0.4);
  }
  .tier-pill.tier-2 {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border-color: rgba(56, 189, 248, 0.4);
  }
  .tier-pill.tier-conflicted {
    background: rgba(239, 68, 68, 0.15);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 16px;
  }
  .metric-box {
    background: var(--c-surface-elevated, rgba(30, 41, 59, 0.5));
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.06));
    border-radius: 12px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .m-label {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;

  }
  .m-val {
    font-size: 20px;
    font-weight: 900;
    margin: 2px 0;
  }
  .prob-val { color: #38bdf8; }
  .margin-val { color: #fbbf24; }
  .agree-val { color: #4ade80; }
  .m-sub {
    font-size: 10px;
    color: #64748b;
  }

  .ledger-section {
    margin-bottom: 14px;
  }
  .ledger-title {
    font-size: 12px;
    font-weight: 700;
    color: #94a3b8;
    margin: 0 0 8px 0;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .ledger-rows {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ledger-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--c-surface-elevated, rgba(30, 41, 59, 0.4));
    border: 1px solid rgba(255, 255, 255, 0.04);
  }
  .ledger-row.vote-agree {
    background: rgba(34, 197, 94, 0.05);
    border-color: rgba(34, 197, 94, 0.15);
  }
  .ledger-row.vote-disagree {
    background: rgba(239, 68, 68, 0.05);
    border-color: rgba(239, 68, 68, 0.15);
  }
  .row-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .row-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--c-text, #ffffff);
  }
  .row-detail {
    font-size: 11px;
    color: #94a3b8;
  }

  .vote-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }
  .badge-agree {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
  }
  .badge-disagree {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }
  .badge-na {
    background: rgba(148, 163, 184, 0.15);
    color: #94a3b8;
  }

  .conflict-alert {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
    padding: 10px 12px;
    color: #fca5a5;
    margin-bottom: 12px;
  }
  .alert-text strong {
    font-size: 12px;
    display: block;
    margin-bottom: 2px;
    color: #ef4444;
  }
  .alert-text p {
    margin: 0;
    font-size: 12px;
  }

  .missing-fields {
    font-size: 11px;
    color: #64748b;
    margin-bottom: 10px;
  }
  .missing-label {
    font-weight: 600;
  }
  .missing-list {
    color: #94a3b8;
  }

  .master-footnote {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: #64748b;
    padding-top: 8px;
    border-top: 1px dashed var(--c-border, rgba(255, 255, 255, 0.08));
  }

  @media (max-width: 600px) {
    .metrics-grid {
      grid-template-columns: 1fr;
    }
    .master-header {
      flex-direction: column;
    }
  }
</style>
