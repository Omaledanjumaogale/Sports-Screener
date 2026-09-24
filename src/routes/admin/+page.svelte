<script lang="ts">
  // ── Admin Control Room ──────────────────────────────────────────────────────
  // The operating console for the AI-prediction DATA BANK: everything here is
  // read from Convex snapshots that the score-sync cycle + hourly cron keep
  // re-deriving from real finished results (see convex/predictorStats.ts).
  //   • Daily Performance & Consensus Summary
  //   • Great AI Minds Performance (consensus rank + verdict provider)
  //   • Prediction Accuracy Monitoring (overall / market / sport)
  //   • Calibration by signal band (published % vs realised win rate)
  //   • Verdict rankings — the analysis families that actually resolve well
  //     against final scores
  //
  // Every query is gated server-side with requireAdmin(); the client gate below
  // is only cosmetic.
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { ArrowLeft, Activity, RefreshCw, Database, ShieldAlert, Trash2, Radio, Check, Trophy, Gauge, LineChart } from '@lucide/svelte';
  import { api, queryConvex, callConvex, subscribeConvexQuery } from '$lib/convexClient';
  import { authState } from '$lib/authStore.svelte';
  import { todayKey, dayKeyFor } from '$lib/predictorClient';
  import type {
    PredictorStatsSnapshot,
    PredictorTotals,
    StatsAccuracyRow,
    StatsSnapshotData
  } from '$lib/predictorTypes';

  const isAdmin = $derived(!!authState.user?.isAdmin);

  let lifetime = $state<PredictorStatsSnapshot | null>(null);
  let history = $state<PredictorStatsSnapshot[]>([]);
  let totals = $state<PredictorTotals | null>(null);
  let selectedDay = $state(todayKey());
  let loading = $state(true);
  let error = $state('');
  let notice = $state('');
  let busy = $state('');

  // Days that actually carry a snapshot, newest first — powers the state selector.
  const availableDays = $derived(
    [...history].sort((a, b) => b.dayKey.localeCompare(a.dayKey)).map((s) => s.dayKey)
  );
  const selectedSnapshot = $derived(history.find((s) => s.dayKey === selectedDay) ?? null);
  const scopeData = $derived<StatsSnapshotData | null>(
    (selectedDay === 'lifetime' ? lifetime?.data : selectedSnapshot?.data) ?? lifetime?.data ?? null
  );
  const scopeLabel = $derived(selectedDay === 'lifetime' ? 'Lifetime (45-day window)' : dayLabel(selectedDay));

  // 14-day trend, oldest → newest, for the charts.
  const trend = $derived(
    [...history]
      .sort((a, b) => a.dayKey.localeCompare(b.dayKey))
      .slice(-14)
      .map((s) => ({
        dayKey: s.dayKey,
        winRatePct: s.data?.overall?.winRatePct ?? 0,
        unitsPnl: s.data?.overall?.unitsPnl ?? 0,
        picks: s.data?.overall?.picks ?? 0,
        settled: s.settledMatches ?? 0
      }))
  );

  function dayLabel(key: string): string {
    if (key === 'lifetime') return 'Lifetime';
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return key;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  const pct = (n: number | undefined) => (Number.isFinite(n) ? `${n}` : '—');
  const signed = (n: number | undefined) => (n === undefined ? '—' : `${n > 0 ? '+' : ''}${n}`);
  const barWidth = (v: number, max: number) => (max > 0 ? Math.max(2, Math.min(100, (v / max) * 100)) : 0);
  const maxOf = (rows: StatsAccuracyRow[] | undefined, key: 'winRatePct' | 'avgPredictedPct' | 'picks') =>
    Math.max(1, ...(rows ?? []).map((r) => Number(r?.[key] ?? 0)));

  async function loadAll() {
    loading = true;
    error = '';
    try {
      const [life, hist, tot] = await Promise.all([
        queryConvex<PredictorStatsSnapshot | null>(api.predictorStats.getSnapshot, { scope: 'lifetime' }),
        queryConvex<PredictorStatsSnapshot[]>(api.predictorStats.getHistory, { days: 45 }),
        queryConvex<PredictorTotals>(api.scores.getPredictorTotals, {}).catch(() => null)
      ]);
      lifetime = life;
      history = Array.isArray(hist) ? hist : [];
      totals = tot;
      if (availableDays.length && !availableDays.includes(selectedDay)) selectedDay = 'lifetime';
    } catch (err: any) {
      const msg = String(err?.message || err);
      error = /Admin access required/i.test(msg)
        ? 'Admin access required — sign in with the super-admin account.'
        : msg;
    } finally {
      loading = false;
    }
  }

  let unsubs: (() => void)[] = [];

  onMount(() => {
    void loadAll();
    // Live: the backend rewrites these snapshots on every score-sync cycle, so
    // the console updates itself without polling.
    void subscribeConvexQuery<PredictorStatsSnapshot | null>(
      api.predictorStats.getSnapshot,
      { scope: 'lifetime' },
      (s) => {
        if (s) lifetime = s;
      }
    ).then((u) => unsubs.push(u));
    void subscribeConvexQuery<PredictorStatsSnapshot[]>(
      api.predictorStats.getHistory,
      { days: 45 },
      (rows) => {
        if (Array.isArray(rows)) history = rows;
      }
    ).then((u) => unsubs.push(u));
    return () => {
      unsubs.forEach((u) => u());
      unsubs = [];
    };
  });

  async function run(label: string, fn: () => Promise<unknown>, successMessage: string) {
    busy = label;
    notice = '';
    error = '';
    try {
      await fn();
      notice = successMessage;
    } catch (err: any) {
      error = String(err?.message || err);
    } finally {
      busy = '';
    }
  }

  const recompute = () =>
    run(
      'recompute',
      () => callConvex(api.predictorStats.requestRecompute, { dayKey: dayKeyFor(0) }),
      'Data bank recompute scheduled — snapshots refresh within a few seconds.'
    );

  const syncScores = () =>
    run(
      'scores',
      () => callConvex(api.scores.triggerScoreSync, { dayKey: dayKeyFor(0), includePastDays: true }),
      'Score sync scheduled for today + the past 7 days; finished results will re-grade.'
    );

  const purgeMalformed = () =>
    run(
      'purge',
      () => callConvex(api.predictorOps.purgeMalformedMatches, {}),
      'Malformed cached fixtures purged across every sport.'
    );

  const purgeWrongSport = () =>
    run(
      'wrongSport',
      () => callConvex(api.predictorOps.purgeWrongSportMatches, { sportId: 'football' }),
      'Wrong-sport rows purged from the football cache.'
    );
</script>

<svelte:head>
  <title>AI Performance Data Bank — Admin | PulseOdds</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="admin-root">
  {#if !isAdmin}
    <div class="gate">
      <ShieldAlert size={30} stroke-width={1.7} />
      <h1>Admin access required</h1>
      <p>
        This console exposes the AI-performance data bank (accuracy, calibration and verdict
        rankings). The server gates every query to the super-admin account.
      </p>
      <button class="cta" type="button" onclick={() => void goto('/auth')}>Sign in</button>
      <button class="link-btn" type="button" onclick={() => void goto('/')}>Back to home</button>
    </div>
  {:else}
    <header class="admin-head">
      <button class="icon-btn" aria-label="Back to home" title="Back to home" onclick={() => void goto('/')} type="button">
        <ArrowLeft size={20} stroke-width={2.5} />
      </button>
      <div class="title-block">
        <span class="eyebrow">Super Admin · Control Room</span>
        <h1>AI Performance Data Bank</h1>
        <p class="sub">
          Every settled prediction, stored: accuracy, calibration and verdict rankings measured
          against real final scores across all 11 sports.
        </p>
      </div>
      <span class="live-chip" title="Snapshots stream live from Convex">
        <Radio size={13} stroke-width={2.4} /> Live
      </span>
    </header>

    {#if error}
      <p class="alert error" role="alert">{error}</p>
    {/if}
    {#if notice}
      <p class="alert ok" role="status"><Check size={13} stroke-width={3} /> {notice}</p>
    {/if}

    <!-- ── KPI strip ─────────────────────────────────────────────── -->
    <section class="kpi-strip" aria-label="Headline metrics">
      <div class="kpi">
        <span class="kpi-ic"><Trophy size={15} stroke-width={2.2} /></span>
        <span class="kpi-val">{lifetime?.data?.overall?.winRatePct ?? 0}<em>%</em></span>
        <span class="kpi-lbl">Lifetime win rate</span>
        <span class="kpi-sub">{lifetime?.data?.overall?.wins ?? 0}W · {lifetime?.data?.overall?.losses ?? 0}L</span>
      </div>
      <div class="kpi">
        <span class="kpi-ic"><Activity size={15} stroke-width={2.2} /></span>
        <span class="kpi-val">{lifetime?.gradedPicks ?? totals?.picks ?? 0}</span>
        <span class="kpi-lbl">Graded picks stored</span>
        <span class="kpi-sub">{lifetime?.settledMatches ?? 0} finished matches</span>
      </div>
      <div class="kpi">
        <span class="kpi-ic"><LineChart size={15} stroke-width={2.2} /></span>
        <span class="kpi-val" class:pos={(lifetime?.data?.overall?.unitsPnl ?? 0) > 0} class:neg={(lifetime?.data?.overall?.unitsPnl ?? 0) < 0}>
          {signed(lifetime?.data?.overall?.unitsPnl)}<em>u</em>
        </span>
        <span class="kpi-lbl">Units P&L</span>
        <span class="kpi-sub">ROI {signed(lifetime?.data?.overall?.roiPct)}%</span>
      </div>
      <div class="kpi">
        <span class="kpi-ic"><Gauge size={15} stroke-width={2.2} /></span>
        <span class="kpi-val">{signed(lifetime?.data?.overall?.calibrationGapPct)}<em>pp</em></span>
        <span class="kpi-lbl">Calibration gap</span>
        <span class="kpi-sub">published {pct(lifetime?.data?.overall?.avgPredictedPct)}% vs actual</span>
      </div>
      <div class="kpi">
        <span class="kpi-ic"><Database size={15} stroke-width={2.2} /></span>
        <span class="kpi-val">{lifetime?.data?.daysAggregated ?? history.length}</span>
        <span class="kpi-lbl">Days in data bank</span>
        <span class="kpi-sub">{history.length} daily snapshots</span>
      </div>
      <div class="kpi">
        <span class="kpi-ic"><RefreshCw size={15} stroke-width={2.2} /></span>
        <span class="kpi-val small">{lifetime ? new Date(lifetime.updatedAt).toLocaleTimeString() : '—'}</span>
        <span class="kpi-lbl">Last snapshot write</span>
        <span class="kpi-sub">{lifetime ? new Date(lifetime.updatedAt).toLocaleDateString() : 'awaiting first cycle'}</span>
      </div>
    </section>

    <!-- ── State controls ────────────────────────────────────────── -->
    <section class="controls" aria-label="Console controls">
      <div class="control-group">
        <span class="control-label">Scope</span>
        <select bind:value={selectedDay} aria-label="Select snapshot scope">
          <option value="lifetime">Lifetime (rolling 45 days)</option>
          {#each availableDays as d (d)}
            <option value={d}>{dayLabel(d)} — {d}</option>
          {/each}
        </select>
        <span class="control-hint">showing <strong>{scopeLabel}</strong></span>
      </div>
      <div class="control-group actions">
        <button class="ops-btn" type="button" disabled={!!busy} onclick={recompute}>
          <span class="ic" class:spin={busy === 'recompute'}>
            <RefreshCw size={14} stroke-width={2.4} />
          </span>
          {busy === 'recompute' ? 'Recalculating…' : 'Recalculate data bank'}
        </button>
        <button class="ops-btn" type="button" disabled={!!busy} onclick={syncScores}>
          <span class="ic" class:spin={busy === 'scores'}>
            <Activity size={14} stroke-width={2.4} />
          </span>
          {busy === 'scores' ? 'Syncing…' : 'Sync scores + settle'}
        </button>
        <button class="ops-btn danger" type="button" disabled={!!busy} onclick={purgeMalformed}>
          <Trash2 size={14} stroke-width={2.4} />
          {busy === 'purge' ? 'Purging…' : 'Purge malformed fixtures'}
        </button>
        <button class="ops-btn danger" type="button" disabled={!!busy} onclick={purgeWrongSport}>
          <ShieldAlert size={14} stroke-width={2.4} />
          {busy === 'wrongSport' ? 'Purging…' : 'Purge wrong-sport rows'}
        </button>
      </div>
    </section>

    {#if loading}
      <p class="empty"><Activity size={18} stroke-width={1.8} /> Loading the data bank…</p>
    {:else if !scopeData || (scopeData.overall?.picks ?? 0) === 0}
      <p class="empty">
        No settled predictions stored for {scopeLabel} yet. Snapshots fill automatically as matches
        finish (the 15-minute score sync grades every stored selection).
      </p>
    {:else}
      <!-- ── Daily performance & consensus summary ───────────────── -->
      <section class="panel">
        <h2>Daily Performance &amp; Consensus Summary <span class="tag">{scopeLabel}</span></h2>
        <div class="kpi-inline">
          <span><strong>{scopeData.gradedPicks}</strong> graded picks</span>
          <span><strong>{scopeData.settledMatches}</strong> finished matches</span>
          <span><strong>{scopeData.overall.winRatePct}%</strong> win rate</span>
          <span class:pos={scopeData.overall.unitsPnl > 0} class:neg={scopeData.overall.unitsPnl < 0}>
            <strong>{signed(scopeData.overall.unitsPnl)}u</strong> P&L
          </span>
          <span><strong>{signed(scopeData.overall.roiPct)}%</strong> ROI</span>
        </div>

        <div class="consensus-grid">
          {#each scopeData.consensus ?? [] as c (c.filter)}
            <div class="consensus-card">
              <span class="cc-filter">{c.filter === 'ALL' ? 'OVERALL' : c.filter}</span>
              <span class="cc-rate">{c.winRatePct}<em>%</em></span>
              <span class="cc-meta">{signed(c.unitsPnl)}u · ROI {signed(c.roiPct)}%</span>
              <div class="cc-bar">
                <span style={`width:${barWidth(c.winRatePct, 100)}%`}></span>
              </div>
            </div>
          {/each}
          {#if !(scopeData.consensus ?? []).length}
            <div class="consensus-card muted">
              <span class="cc-filter">CONSENSUS</span>
              <span class="cc-meta">No settled market consensus rows stored for this scope yet.</span>
            </div>
          {/if}
        </div>
      </section>

      <!-- ── Trend chart ─────────────────────────────────────────── -->
      {#if trend.length > 0}
        <section class="panel">
          <h2>Prediction Accuracy Trend <span class="tag">last {trend.length} days</span></h2>
          <div class="chart" role="img" aria-label="Daily win rate and units P&L trend">
            <svg viewBox="0 0 720 220" preserveAspectRatio="none">
              <!-- bars: units P&L -->
              {#each trend as t, i (t.dayKey)}
                {@const unitH = Math.min(60, Math.abs(t.unitsPnl) * 6)}
                {@const cx = 26 + i * (668 / Math.max(trend.length, 1))}
                <rect
                  x={cx}
                  y={t.unitsPnl >= 0 ? 110 - unitH : 118}
                  width={Math.max(6, 668 / Math.max(trend.length, 1) - 14)}
                  height={unitH}
                  rx="2"
                  class={t.unitsPnl >= 0 ? 'bar-pos' : 'bar-neg'}
                />
                <!-- win-rate marker -->
                <circle cx={cx + Math.max(6, 668 / Math.max(trend.length, 1) - 14) / 2} cy={196 - t.winRatePct * 1.5} r="3.4" class="dot" />
              {/each}
              <line x1="12" y1="118" x2="708" y2="118" class="axis" />
              <line x1="12" y1="46" x2="708" y2="46" class="grid" />
              <line x1="12" y1="196" x2="708" y2="196" class="grid" />
              <text x="14" y="42" class="axis-label">100%</text>
              <text x="14" y="114" class="axis-label">0u</text>
              <text x="14" y="192" class="axis-label">0%</text>
            </svg>
            <div class="legend">
              <span><i class="sw pos"></i> units P&L (bars)</span>
              <span><i class="sw dot"></i> daily win rate (dots)</span>
            </div>
          </div>
          <table class="tbl">
            <thead><tr><th>Day</th><th>Picks</th><th>Settled</th><th>Win rate</th><th>Units</th></tr></thead>
            <tbody>
              {#each [...trend].reverse() as t (t.dayKey)}
                <tr>
                  <td>{dayLabel(t.dayKey)}</td>
                  <td>{t.picks}</td>
                  <td>{t.settled}</td>
                  <td>{t.winRatePct}%</td>
                  <td class:pos={t.unitsPnl > 0} class:neg={t.unitsPnl < 0}>{signed(t.unitsPnl)}u</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>
      {/if}

      <!-- ── Calibration by signal band ──────────────────────────── -->
      <section class="panel">
        <h2>Calibration by Signal Band <span class="tag">published % vs realised</span></h2>
        <p class="panel-copy">
          A positive gap means the verdict claimed more than it delivered for that band — the
          primary signal for tightening the engines and confidence floor.
        </p>
        <div class="bands">
          {#each scopeData.byBand as b (b.group)}
            <div class="band-row">
              <span class="band-name">{b.group}</span>
              <div class="band-bars">
                <div class="band-bar">
                  <span class="band-fill predicted" style={`width:${barWidth(b.avgPredictedPct, 100)}%`}></span>
                  <span class="band-cap">published {b.avgPredictedPct}%</span>
                </div>
                <div class="band-bar">
                  <span class="band-fill actual" style={`width:${barWidth(b.winRatePct, 100)}%`}></span>
                  <span class="band-cap">actual {b.winRatePct}%</span>
                </div>
              </div>
              <span class="band-gap" class:pos={b.calibrationGapPct > 0} class:neg={b.calibrationGapPct < 0}>
                {signed(b.calibrationGapPct)}pp
              </span>
              <span class="band-sample">{b.wins}W/{b.losses}L · {b.picks} picks</span>
            </div>
          {/each}
        </div>
      </section>

      <!-- ── Accuracy monitoring by market & sport ───────────────── -->
      <div class="two-col">
        <section class="panel">
          <h2>Accuracy by Market</h2>
          <table class="tbl">
            <thead><tr><th>Market</th><th>Picks</th><th>Win rate</th><th>Gap</th><th>ROI</th></tr></thead>
            <tbody>
              {#each scopeData.byMarket as r (r.group)}
                <tr>
                  <td>{r.group}</td>
                  <td>{r.picks}</td>
                  <td>
                    <span class="mini-bar"><span style={`width:${barWidth(r.winRatePct, 100)}%`}></span></span>
                    {r.winRatePct}%
                  </td>
                  <td class:pos={r.calibrationGapPct > 0} class:neg={r.calibrationGapPct < 0}>{signed(r.calibrationGapPct)}</td>
                  <td class:pos={r.roiPct > 0} class:neg={r.roiPct < 0}>{signed(r.roiPct)}%</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>

        <section class="panel">
          <h2>Accuracy by Sport</h2>
          <table class="tbl">
            <thead><tr><th>Sport</th><th>Picks</th><th>Win rate</th><th>Units</th><th>Gap</th></tr></thead>
            <tbody>
              {#each scopeData.bySport as r (r.group)}
                <tr>
                  <td>{r.group}</td>
                  <td>{r.picks}</td>
                  <td>
                    <span class="mini-bar"><span style={`width:${barWidth(r.winRatePct, 100)}%`}></span></span>
                    {r.winRatePct}%
                  </td>
                  <td class:pos={r.unitsPnl > 0} class:neg={r.unitsPnl < 0}>{signed(r.unitsPnl)}u</td>
                  <td class:pos={r.calibrationGapPct > 0} class:neg={r.calibrationGapPct < 0}>{signed(r.calibrationGapPct)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </section>
      </div>

      <!-- ── Great AI Minds performance ──────────────────────────── -->
      <section class="panel">
        <h2>Great AI Minds Performance <span class="tag">consensus slots &amp; engines</span></h2>
        <div class="two-col inner">
          <div>
            <h3>Consensus pick rank</h3>
            <div class="rank-grid">
              {#each scopeData.byRank as r (r.group)}
                <div class="rank-card">
                  <span class="rank-name">{r.group}</span>
                  <span class="rank-rate">{r.winRatePct}<em>%</em></span>
                  <span class="rank-meta">{r.picks} picks · {signed(r.unitsPnl)}u · gap {signed(r.calibrationGapPct)}</span>
                </div>
              {/each}
            </div>
          </div>
          <div>
            <h3>Verdict engine / provider</h3>
            <table class="tbl">
              <thead><tr><th>Provider</th><th>Picks</th><th>Win rate</th><th>ROI</th></tr></thead>
              <tbody>
                {#each scopeData.byProvider as r (r.group)}
                  <tr>
                    <td>{r.group}</td>
                    <td>{r.picks}</td>
                    <td>{r.winRatePct}%</td>
                    <td class:pos={r.roiPct > 0} class:neg={r.roiPct < 0}>{signed(r.roiPct)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <!-- ── Verdict rankings leaderboard ────────────────────────── -->
      <section class="panel">
        <h2>Verdict Rankings <span class="tag">sport · market, ≥5 settled picks</span></h2>
        <p class="panel-copy">
          Ranked by realised hit rate against final scores — the families of analysis the engine
          should lean on, and the ones to re-tune.
        </p>
        <table class="tbl wide">
          <thead>
            <tr><th>#</th><th>Verdict family</th><th>Picks</th><th>W–L</th><th>Win rate</th><th>Published</th><th>Gap</th><th>Units</th><th>ROI</th></tr>
          </thead>
          <tbody>
            {#each scopeData.rankings.slice(0, 15) as r, i (r.group)}
              <tr>
                <td class="num">{i + 1}</td>
                <td>{r.group}</td>
                <td>{r.picks}</td>
                <td>{r.wins}–{r.losses}</td>
                <td>
                  <span class="mini-bar"><span style={`width:${barWidth(r.winRatePct, 100)}%`}></span></span>
                  {r.winRatePct}%
                </td>
                <td>{r.avgPredictedPct}%</td>
                <td class:pos={r.calibrationGapPct > 0} class:neg={r.calibrationGapPct < 0}>{signed(r.calibrationGapPct)}</td>
                <td class:pos={r.unitsPnl > 0} class:neg={r.unitsPnl < 0}>{signed(r.unitsPnl)}u</td>
                <td class:pos={r.roiPct > 0} class:neg={r.roiPct < 0}>{signed(r.roiPct)}%</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </section>
    {/if}
  {/if}
</div>

<style>
  .admin-root {
    max-width: 1180px;
    margin: 0 auto;
    padding: var(--sp-6, 24px) var(--sp-5, 20px) 64px;
    color: var(--c-text);
  }

  /* ── Gate ─────────────────────────────────────────────── */
  .gate {
    max-width: 460px;
    margin: 12vh auto 0;
    text-align: center;
    display: grid;
    gap: 12px;
    justify-items: center;
    padding: 28px;
    border: 1px solid var(--c-border);
    border-radius: var(--r-xl, 18px);
    background: var(--c-glass-sm);
  }
  .gate h1 { font-size: 20px; margin: 4px 0 0; }
  .gate p { font-size: 13.5px; color: var(--c-text-dim); line-height: 1.55; margin: 0; }

  /* ── Header ───────────────────────────────────────────── */
  .admin-head {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    margin-bottom: 18px;
  }
  .title-block { flex: 1; min-width: 0; }
  .eyebrow {
    font-size: 10.5px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--brand, #a3e635);
    font-weight: 900;
  }
  .admin-head h1 {
    margin: 2px 0 4px;
    font-size: clamp(21px, 3.4vw, 30px);
    letter-spacing: -0.02em;
  }
  .sub { margin: 0; font-size: 13px; color: var(--c-text-dim); max-width: 62ch; line-height: 1.55; }
  .live-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, #22c55e 40%, transparent);
    color: #4ade80;
    background: color-mix(in srgb, #22c55e 12%, transparent);
    white-space: nowrap;
  }

  .alert {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 700;
    padding: 9px 12px;
    border-radius: 10px;
    margin: 0 0 14px;
  }
  .alert.error { border: 1px solid color-mix(in srgb, #f87171 45%, transparent); color: #fca5a5; background: color-mix(in srgb, #ef4444 10%, transparent); }
  .alert.ok { border: 1px solid color-mix(in srgb, #22c55e 40%, transparent); color: #86efac; background: color-mix(in srgb, #22c55e 10%, transparent); }

  /* ── KPI strip ────────────────────────────────────────── */
  .kpi-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .kpi {
    display: grid;
    gap: 3px;
    padding: 13px 14px;
    border: 1px solid var(--c-border);
    border-radius: 14px;
    background:
      radial-gradient(120% 140% at 100% 0%, color-mix(in srgb, var(--brand, #a3e635) 8%, transparent), transparent 60%),
      var(--c-glass-sm);
  }
  .kpi-ic { color: var(--brand, #a3e635); }
  .kpi-val { font-size: 26px; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .kpi-val.small { font-size: 17px; }
  .kpi-val em { font-size: 13px; font-style: normal; opacity: 0.7; margin-left: 2px; }
  .kpi-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 800; color: var(--c-text-dim); }
  .kpi-sub { font-size: 11.5px; color: var(--c-faint, var(--c-text-dim)); }
  .pos { color: #4ade80 !important; }
  .neg { color: #f87171 !important; }

  /* ── Controls ─────────────────────────────────────────── */
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;
    border: 1px solid var(--c-border);
    border-radius: 14px;
    background: var(--c-glass-sm);
    margin-bottom: 16px;
  }
  .control-group { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
  .control-label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--c-text-dim); }
  .control-hint { font-size: 11.5px; color: var(--c-text-dim); }
  select {
    font: inherit;
    font-size: 12.5px;
    font-weight: 700;
    padding: 7px 10px;
    border-radius: 9px;
    border: 1px solid var(--c-border);
    background: var(--c-bg-2, #0b0f14);
    color: var(--c-text);
  }
  .ops-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
    padding: 8px 12px;
    border-radius: 9px;
    border: 1px solid color-mix(in srgb, var(--brand, #a3e635) 35%, transparent);
    background: color-mix(in srgb, var(--brand, #a3e635) 12%, transparent);
    color: var(--c-text);
    cursor: pointer;
  }
  .ops-btn:hover:not(:disabled) { background: color-mix(in srgb, var(--brand, #a3e635) 20%, transparent); }
  .ops-btn.danger { border-color: color-mix(in srgb, #f87171 35%, transparent); background: color-mix(in srgb, #ef4444 10%, transparent); }
  .ops-btn:disabled { opacity: 0.55; cursor: progress; }
  .ic { display: inline-flex; }
  .ic.spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Panels ───────────────────────────────────────────── */
  .panel {
    border: 1px solid var(--c-border);
    border-radius: 16px;
    background: var(--c-glass-sm);
    padding: 16px 16px 18px;
    margin-bottom: 16px;
  }
  .panel h2 {
    margin: 0 0 10px;
    font-size: 14.5px;
    letter-spacing: -0.01em;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .panel h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--c-text-dim); }
  .tag {
    font-size: 10.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 3px 7px;
    border-radius: 6px;
    border: 1px solid var(--c-border);
    color: var(--c-text-dim);
  }
  .panel-copy { margin: 0 0 12px; font-size: 12.5px; color: var(--c-text-dim); line-height: 1.55; max-width: 80ch; }

  .kpi-inline { display: flex; flex-wrap: wrap; gap: 14px; font-size: 12.5px; color: var(--c-text-dim); margin-bottom: 12px; }
  .kpi-inline strong { color: var(--c-text); font-size: 14px; }

  .consensus-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
  .consensus-card {
    display: grid;
    gap: 4px;
    padding: 11px 12px;
    border: 1px solid var(--c-border);
    border-radius: 12px;
    background: var(--c-bg-2, rgba(255,255,255,0.02));
  }
  .consensus-card.muted { opacity: 0.7; }
  .cc-filter { font-size: 10.5px; font-weight: 900; letter-spacing: 0.08em; color: var(--c-text-dim); }
  .cc-rate { font-size: 22px; font-weight: 900; font-variant-numeric: tabular-nums; }
  .cc-rate em { font-size: 12px; font-style: normal; opacity: 0.7; }
  .cc-meta { font-size: 11.5px; color: var(--c-text-dim); }
  .cc-bar { height: 5px; border-radius: 999px; background: color-mix(in srgb, var(--c-text) 12%, transparent); overflow: hidden; }
  .cc-bar span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--brand, #a3e635), var(--accent2, #22d3ee)); }

  /* ── Charts ───────────────────────────────────────────── */
  .chart svg { width: 100%; height: 220px; display: block; }
  .chart .axis { stroke: color-mix(in srgb, var(--c-text) 35%, transparent); stroke-width: 1; }
  .chart .grid { stroke: color-mix(in srgb, var(--c-text) 12%, transparent); stroke-width: 1; stroke-dasharray: 3 5; }
  .chart .axis-label { fill: var(--c-text-dim); font-size: 9px; font-weight: 700; }
  .chart .bar-pos { fill: color-mix(in srgb, #22c55e 72%, transparent); }
  .chart .bar-neg { fill: color-mix(in srgb, #ef4444 68%, transparent); }
  .chart .dot { fill: var(--accent2, #22d3ee); }
  .legend { display: flex; gap: 16px; font-size: 11.5px; color: var(--c-text-dim); margin-top: 6px; }
  .sw { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 5px; }
  .sw.pos { background: #22c55e; }
  .sw.dot { background: var(--accent2, #22d3ee); border-radius: 50%; }

  /* ── Bands ────────────────────────────────────────────── */
  .bands { display: grid; gap: 12px; }
  .band-row {
    display: grid;
    grid-template-columns: 130px 1fr 62px 120px;
    gap: 12px;
    align-items: center;
  }
  .band-name { font-size: 12px; font-weight: 800; }
  .band-bars { display: grid; gap: 4px; }
  .band-bar { position: relative; height: 16px; border-radius: 5px; background: color-mix(in srgb, var(--c-text) 8%, transparent); overflow: hidden; }
  .band-fill { position: absolute; inset: 0 auto 0 0; border-radius: 5px; }
  .band-fill.predicted { background: color-mix(in srgb, #a3e635 42%, transparent); }
  .band-fill.actual { background: linear-gradient(90deg, #22c55e, #22d3ee); }
  .band-cap { position: absolute; left: 7px; top: 1px; font-size: 10.5px; font-weight: 700; color: var(--c-text); }
  .band-gap { font-size: 13px; font-weight: 900; font-variant-numeric: tabular-nums; text-align: right; }
  .band-sample { font-size: 11px; color: var(--c-text-dim); }

  /* ── Tables ───────────────────────────────────────────── */
  .two-col { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; }
  .two-col.inner { gap: 22px; }
  .tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .tbl th {
    text-align: left;
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--c-text-dim);
    padding: 6px 8px;
    border-bottom: 1px solid var(--c-border);
    white-space: nowrap;
  }
  .tbl td { padding: 7px 8px; border-bottom: 1px solid color-mix(in srgb, var(--c-border) 55%, transparent); vertical-align: middle; font-variant-numeric: tabular-nums; }
  .tbl td.num { color: var(--c-text-dim); font-weight: 800; }
  .tbl.wide td:first-child { width: 28px; }
  .mini-bar {
    display: inline-block;
    width: 54px;
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--c-text) 12%, transparent);
    overflow: hidden;
    vertical-align: middle;
    margin-right: 6px;
  }
  .mini-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--brand, #a3e635), var(--accent2, #22d3ee)); }

  .rank-grid { display: grid; gap: 8px; }
  .rank-card {
    display: grid;
    gap: 2px;
    padding: 10px 12px;
    border: 1px solid var(--c-border);
    border-radius: 11px;
    background: var(--c-bg-2, rgba(255,255,255,0.02));
  }
  .rank-name { font-size: 11.5px; font-weight: 800; color: var(--c-text-dim); text-transform: uppercase; letter-spacing: 0.05em; }
  .rank-rate { font-size: 21px; font-weight: 900; }
  .rank-rate em { font-size: 12px; font-style: normal; opacity: 0.7; }
  .rank-meta { font-size: 11.5px; color: var(--c-text-dim); }

  .empty {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 18px;
    border: 1px dashed var(--c-border);
    border-radius: 14px;
    font-size: 13px;
    color: var(--c-text-dim);
  }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font: inherit;
    font-weight: 900;
    font-size: 13px;
    padding: 10px 16px;
    border-radius: 11px;
    border: none;
    background: linear-gradient(135deg, var(--brand, #a3e635), var(--accent2, #22d3ee));
    color: #05130a;
    cursor: pointer;
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--c-border);
    background: var(--c-glass-sm);
    color: var(--c-text);
    cursor: pointer;
    flex-shrink: 0;
  }
  .link-btn {
    background: none;
    border: none;
    font: inherit;
    font-size: 12.5px;
    font-weight: 800;
    color: var(--brand, #a3e635);
    cursor: pointer;
    text-decoration: underline;
  }

  @media (max-width: 720px) {
    .band-row { grid-template-columns: 1fr; gap: 6px; }
    .band-gap, .band-sample { text-align: left; }
  }
</style>
