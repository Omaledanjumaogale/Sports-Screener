<script lang="ts">
  import type { Pick, ScopeState } from '$lib/engine';
  import { positiveDecisions, expectedTotalDecision } from '$lib/marketDecision';
  let { picks=[], scope=null, sportId='', marketId='' }: {picks?:Pick[];scope?:ScopeState|null;sportId?:string;marketId?:string}=$props();
  const decisions=$derived(positiveDecisions(picks,scope).filter(d=>!marketId||d.marketId===marketId));
  const met=$derived(expectedTotalDecision(scope,sportId,picks));
</script>
{#if decisions.length || (met.label && (!marketId || marketId === 'mainTotal' || marketId === 'gameTotal'))}
<section class="direction-board" aria-label="Market direction guidance">
  {#if !marketId}<h3>Decision guide <span>Estimated direction · uncertainty disclosed</span></h3>{/if}
  {#if met.label && (!marketId || marketId === 'mainTotal' || marketId === 'gameTotal')}
    <article class="met-card"><div class="eyebrow">Market Expected Total · {met.unit}</div><strong>{met.label}</strong><p>{met.explanation}</p><small>{met.quoted ? 'Use the displayed bookmaker line and price.' : 'Directional cross-check only: this synthetic threshold is not a quoted bet.'} Estimates carry uncertainty.</small></article>
  {/if}
  <div class="decision-grid">
    {#each decisions as d (d.marketId)}
      <article class="decision-card" class:has-pick={!!d.preferred}>
        <div class="eyebrow">{d.title}</div><strong>Preferred pick · {d.preferred?.label}</strong>
        {#if d.preferred}<div class="estimate">{d.preferred.probability.toFixed(1)}% estimated · @ {d.preferred.odds.toFixed(2)}</div>{/if}
        <p>{d.explanation}</p><small>{d.value}. Confidence is an estimate, not a guaranteed win rate.</small>
      </article>
    {/each}
  </div>
</section>
{/if}
<style>
  .direction-board{margin:16px 0;min-width:0}h3{font-size:.95rem;margin:0 0 12px}h3 span{display:block;color:var(--c-muted);font-size:.75rem;font-weight:400;margin-top:4px}.decision-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px}.decision-card,.met-card{padding:14px;border:1px solid var(--c-border);border-radius:14px;background:var(--c-bg-2);box-shadow:var(--depth-card);overflow-wrap:anywhere}.met-card{margin-bottom:12px;border-left:3px solid #22d3ee}.has-pick{border-left:3px solid var(--c-success)}.eyebrow{font-size:.72rem;color:var(--c-muted);margin-bottom:6px}strong{font-size:1rem}.estimate{color:var(--c-success);font-size:.8rem;margin-top:6px}p,small{font-size:.75rem;line-height:1.6;color:var(--c-muted)}p{margin:8px 0}small{display:block}
</style>
