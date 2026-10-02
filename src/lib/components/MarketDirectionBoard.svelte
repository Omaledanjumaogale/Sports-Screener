<script lang="ts">
  import type { Pick, ScopeState } from '$lib/engine';
  import { decideMarkets, metDecision } from '$lib/marketDecision';
  let { picks=[], scope=null, sportId='', marketId='' }: {picks?:Pick[];scope?:ScopeState|null;sportId?:string;marketId?:string}=$props();
  const decisions=$derived(decideMarkets(picks,scope).filter(d=>!marketId||d.marketId===marketId));
  const met=$derived(metDecision(scope));
</script>
<section class="direction-board" aria-label="Market direction guidance">
  {#if !marketId}<h3>Decision guide <span>Estimated direction · uncertainty disclosed</span></h3>{/if}
  {#if sportId.includes('basketball') && (!marketId||marketId==='mainTotal')}
    <article class="met-card"><div class="eyebrow">Market Expected Total Points</div><strong>{met.label}</strong><p>MET {met.met??'—'} · Team-total cross-check {met.teamTotalProxy??'—'}</p><p>{met.explanation}</p><small>No measured confidence at this threshold. A synthetic MET line is not a quoted bet; use the actual priced market below.</small></article>
  {/if}
  <div class="decision-grid">
    {#each decisions as d (d.marketId)}
      <article class="decision-card" class:has-pick={!!d.preferred}>
        <div class="eyebrow">{d.title}</div><strong>{d.preferred?.label??'No clear edge'}</strong>
        {#if d.preferred}<div class="estimate">{d.preferred.probability.toFixed(1)}% estimated · @ {d.preferred.odds.toFixed(2)}</div>{/if}
        <p>{d.explanation}</p><small>{d.value}. Confidence is an estimate, not a guaranteed win rate.</small>
      </article>
    {/each}
  </div>
  {#if !decisions.length && !sportId.includes('basketball')}<p class="empty">Complete the market prices to compare directions.</p>{/if}
</section>
<style>
  .direction-board{margin:16px 0;min-width:0}h3{font-size:.95rem;margin:0 0 12px}h3 span{display:block;color:var(--c-muted);font-size:.75rem;font-weight:400;margin-top:4px}.decision-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px}.decision-card,.met-card{padding:14px;border:1px solid var(--c-border);border-radius:14px;background:var(--c-bg-2);box-shadow:var(--depth-card);overflow-wrap:anywhere}.met-card{margin-bottom:12px;border-left:3px solid #22d3ee}.has-pick{border-left:3px solid var(--c-success)}.eyebrow{font-size:.72rem;color:var(--c-muted);margin-bottom:6px}strong{font-size:1rem}.estimate{color:var(--c-success);font-size:.8rem;margin-top:6px}p,small{font-size:.75rem;line-height:1.6;color:var(--c-muted)}p{margin:8px 0}small{display:block}.empty{padding:10px}
</style>
