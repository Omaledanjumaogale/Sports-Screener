<script lang="ts">
  import { onMount } from 'svelte';
  import AdminMarketPerformance from './AdminMarketPerformance.svelte';
  import { queryConvex, callConvex, subscribeConvexQuery, convexErrorMessage } from '$lib/convexClient';
  import type { PredictorStatsSnapshot } from '$lib/predictorTypes';
  let { history = [] }: { history: PredictorStatsSnapshot[] } = $props();
  let tab = $state('Performance'); let windowDays = $state(14);
  let data = $state<any>(null); let error = $state(''); let busy = $state(false);
  let accounts = $state<any[]>([]); let cursor = $state<string | null>(null); let done = $state(false);
  let migration = $state<any>(null); let table = $state('drafts');
  let reviewCursor = $state<string | undefined>(undefined);
  const series = $derived([...history].sort((a,b)=>a.dayKey.localeCompare(b.dayKey)).slice(-windowDays));
  const points = $derived(series.map((s,i)=>`${20 + i * 560 / Math.max(1,series.length-1)},${180 - (s.data?.overall?.winRatePct ?? 0)*1.6}`).join(' '));
  onMount(() => {
    let disposed=false; let stop: (()=>void) | undefined;
    void subscribeConvexQuery<any>('releaseOps:snapshot',{},value=>{data=value;error='';})
      .then(unsubscribe=>{if(disposed) unsubscribe(); else stop=unsubscribe;})
      .catch(reason=>error=convexErrorMessage(reason,'Operations data unavailable.'));
    return ()=>{disposed=true;stop?.();};
  });
  async function loadAccounts(reset=false) {
    busy=true;error='';
    try { const result=await queryConvex<any>('releaseOps:accounts',{paginationOpts:{numItems:50,cursor:reset?null:cursor}});accounts=reset?result.page:[...accounts,...result.page];cursor=result.continueCursor;done=result.isDone; }
    catch(reason){error=convexErrorMessage(reason,'Accounts unavailable.');}finally{busy=false;}
  }
  async function toggle(key:string,enabled:boolean) {
    busy=true;error='';try{await callConvex('featureFlags:setFlag',{key,enabled,note:'Updated from operations console'});}catch(reason){error=convexErrorMessage(reason,'State update failed.');}finally{busy=false;}
  }
  async function migrate(apply=false) {
    busy=true;error='';try{if(!apply)reviewCursor=migration?.cursor;migration=await callConvex('releaseOps:migrateOwnership',{table,apply,cursor:reviewCursor});}catch(reason){error=convexErrorMessage(reason,'Migration failed.');}finally{busy=false;}
  }
  function download() {
    const payload={exportedAt:new Date().toISOString(),operations:data,performance:series,interpretation:'Retrospective snapshots; not held-out predictive proof. Counts are bounded samples.'};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`pulseodds-operations-${Date.now()}.json`;link.click();URL.revokeObjectURL(url);
  }
</script>
<section class="ops" aria-label="Enterprise operations dashboard">
  <header><div><p class="eyebrow">Operations workspace</p><h2>Performance, access and service health</h2></div><button onclick={download} disabled={!data}>Export report</button></header>
  <nav aria-label="Operations views">{#each ['Performance','Markets','Services','Accounts','Evidence','Migrations'] as name}<button aria-pressed={tab===name} onclick={()=>{tab=name;if(name==='Accounts'&&!accounts.length)void loadAccounts(true);}}>{name}</button>{/each}</nav>
  {#if error}<p role="alert" class="error">{error}</p>{/if}
  {#if !data && !error}<p role="status">Connecting to operational metrics…</p>{/if}
  {#if tab==='Performance'}
    <div class="toolbar"><label>Reporting window <select bind:value={windowDays}><option value={7}>7 days</option><option value={14}>14 days</option><option value={30}>30 days</option></select></label><span>{series.length} stored daily snapshots</span></div>
    {#if series.length}<svg viewBox="0 0 600 210" role="img" aria-label="Observed daily win rate from zero to one hundred percent"><title>Observed daily win rate</title><line x1="20" y1="100" x2="580" y2="100" stroke="currentColor" opacity="0.2" /><polyline {points} fill="none" stroke="var(--brand)" stroke-width="3" /><text x="22" y="205" fill="currentColor">{series[0].dayKey}</text><text x="470" y="205" fill="currentColor">{series.at(-1)?.dayKey}</text></svg>{:else}<p>No performance snapshots yet.</p>{/if}
    <div class="scroll"><table><caption>Daily performance source data</caption><thead><tr><th>Date</th><th>Graded picks</th><th>Win rate</th><th>Units proxy</th></tr></thead><tbody>{#each series as row}<tr><td>{row.dayKey}</td><td>{row.gradedPicks}</td><td>{row.data?.overall?.winRatePct ?? '—'}%</td><td>{row.data?.overall?.unitsPnl ?? '—'}</td></tr>{/each}</tbody></table></div>
    <p class="note">Retrospective results and fixed-return units proxies do not establish future profitability. Compare confidence with observed outcomes, sample size and data provenance.</p>
  {:else if tab==='Markets'}
    <AdminMarketPerformance />
  {:else if tab==='Services' && data}
    <div class="cards"><article><h3>Payment configuration</h3><strong>{data.services.paymentsConfigured?'Configured':'Missing configuration'}</strong><p>{data.payments.successful} successful in latest {data.payments.sample} transactions{data.payments.truncated?' (sample capped)':''}. ₦{data.payments.settledNgn.toLocaleString()} settled in this sample.</p></article><article><h3>Password recovery</h3><strong>{data.services.recoveryConfigured?'Provider key configured':'Unavailable'}</strong><p>Configuration does not confirm sender-domain delivery.</p></article><article><h3>Push delivery</h3><strong>Unavailable</strong><p>Notifications remain disabled until delivery is verified.</p></article></div>
    <h3>Feature state controls</h3><div class="controls">{#each ['predictor','payments','maintenance'] as key}{@const flag=data.flags.find((f:any)=>f.key===key)}{@const enabled=flag?.enabled??(key!=='maintenance')}<button disabled={busy} onclick={()=>void toggle(key,!enabled)}>{key}: {enabled?'enabled':'disabled'}</button>{/each}</div>
    <div class="scroll"><table><caption>Scheduled service heartbeats</caption><thead><tr><th>Job</th><th>Last run</th><th>Reported state</th></tr></thead><tbody>{#each data.jobs as job}<tr><td>{job.job}</td><td>{new Date(job.lastRunAt).toLocaleString()}</td><td>{job.ok?'Successful':'Failed'}</td></tr>{/each}</tbody></table></div>
    <h3>Recent sanitized errors</h3>{#each data.errors as entry}<p class="log"><time>{new Date(entry.createdAt).toLocaleString()}</time> · {entry.source}: {entry.message}</p>{/each}
  {:else if tab==='Accounts'}
    <p>Cursor-paginated account inventory. Access state remains enforced by the backend.</p><div class="scroll"><table><thead><tr><th>Account</th><th>Role</th><th>Tier</th><th>Expiry</th></tr></thead><tbody>{#each accounts as account}<tr><td>{account.email}</td><td>{account.role??'user'}</td><td>{account.subscriptionTier??'—'}</td><td>{account.subscriptionExpiresAt?new Date(account.subscriptionExpiresAt).toLocaleDateString():'—'}</td></tr>{/each}</tbody></table></div><button disabled={busy||done} onclick={()=>void loadAccounts()}>{busy?'Loading…':done?'All accounts loaded':'Load next 50'}</button>
  {:else if tab==='Evidence' && data}
    <h3>Immutable pre-match prediction archive</h3><strong>{data.evidence.sample}{data.evidence.truncated?'+':''} archived matches</strong><p>First pre-kickoff reports and odds are retained with capture time, source, quality and model version. Later recomputation cannot overwrite this archive.</p><p>Held-out calibration, Brier score, log loss and actual-odds ROI require evaluation of settled archived outcomes. No measured result is invented when that dataset is unavailable.</p>
    {#if data.evidence.metrics}{@const metrics=data.evidence.metrics}<div class="cards"><article><h3>Resolved selections</h3><strong>{metrics.resolved}</strong><p>{metrics.from??'No dates'} — {metrics.to??'No dates'}</p></article><article><h3>Brier / log loss</h3><strong>{metrics.brierScore?.toFixed(4)??'No settled sample'} / {metrics.logLoss?.toFixed(4)??'—'}</strong></article><article><h3>Calibration gap</h3><strong>{metrics.calibrationGapPct?.toFixed(2)??'—'}%</strong><p>{metrics.pricedPicks} picks with retained prices; gross ROI {metrics.grossRoiPct?.toFixed(2)??'—'}% before fees and slippage.</p></article></div><p class="note">{metrics.interpretation}</p>{/if}
  {:else if tab==='Migrations'}
    <h3>Legacy ownership review</h3><p>Preview 100 records per page. Only verified ordinary account IDs are eligible; shared and anonymous records are skipped.</p><label>Collection <select bind:value={table} onchange={()=>migration=null}><option>drafts</option><option>savedScreeners</option><option>betSlips</option></select></label><button disabled={busy||migration?.done} onclick={()=>void migrate(false)}>Preview next page</button>
    {#if migration}<p role="status">Scanned {migration.scanned}; eligible {migration.eligible}; skipped {migration.skipped}. {migration.applied?'Applied.':'Dry run only.'}</p><button disabled={busy||migration.applied} onclick={()=>void migrate(true)}>Apply first reviewed batch</button>{/if}
  {/if}
  {#if data}<p class="note">Live snapshot: {new Date(data.generatedAt).toLocaleString()}. Configuration, sampled counts and heartbeat reports are distinct from production acceptance. The legacy tester overview below is bounded to 300 recent codes, 20 sessions per code and 1,000 recent profiles; use Accounts to paginate the full account inventory.</p>{/if}
</section>
<style>
  .ops{margin:24px 0;padding:24px;border:1px solid var(--c-border);border-radius:20px;background:var(--c-bg-2);color:var(--c-text)}header{display:flex;justify-content:space-between;gap:16px;align-items:center}h2{margin:4px 0 20px}.eyebrow{color:var(--brand);font-size:.8rem;text-transform:uppercase;letter-spacing:.12em}nav,.controls,.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}button,select{padding:10px 14px;border:1px solid var(--c-border);border-radius:10px;background:var(--c-bg);color:var(--c-text);font:inherit}button[aria-pressed=true]{border-color:var(--brand);color:var(--brand)}button:disabled{opacity:.5}svg{width:100%;max-height:300px}.cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cards article{padding:18px;border:1px solid var(--c-border);border-radius:14px}.scroll{overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}td,th{padding:12px;border-bottom:1px solid var(--c-border)}caption{text-align:left;padding:12px 0}.note{color:var(--c-muted);font-size:.85rem;line-height:1.6}.error{color:var(--c-error)}.log{overflow-wrap:anywhere}@media(max-width:700px){.ops{padding:16px}header{display:block}.cards{grid-template-columns:1fr}}
</style>
