<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import {
    api,
    callConvex,
    queryConvex,
    getSessionId,
    type ConvexSportId,
    type SavedScreenerDoc
  } from '../convexClient';
  import type { Analysis } from '../engine';

  const dispatch = createEventDispatcher<{
    load: { scopes: any[]; doc: SavedScreenerDoc };
    saved: { doc: SavedScreenerDoc };
    close: never;
  }>();

  let {
    sportId,
    sportTitle,
    scopes,
    analysis,
    aiResult = null as any,
    accent = '#6aa6ff'
  }: {
    sportId: ConvexSportId;
    sportTitle: string;
    scopes: any[];
    analysis: Analysis | null;
    aiResult?: any;
    accent?: string;
  } = $props();

  import { authState } from '../authStore.svelte';

  // ── Local storage fallback key ────────────────────────────────
  const LS_KEY = () => `sportsScreener_history_${sportId}_v1`;

  function lsLoad(): SavedScreenerDoc[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(LS_KEY());
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function lsSave(docs: SavedScreenerDoc[]) {
    try { localStorage.setItem(LS_KEY(), JSON.stringify(docs)); } catch { /* ignore */ }
  }

  let mode: 'list' | 'save' | 'edit' = $state('list');
  let records: SavedScreenerDoc[] = $state([]);
  let loading: boolean = $state(true);
  let working: boolean = $state(false);
  let error: string | null = $state(null);
  let titleInput: string = $state('');
  let notesInput: string = $state('');
  let editingDoc: SavedScreenerDoc | null = $state(null);
  let expandedId: string | null = $state(null);
  let sessionId: string = $state('');
  let usingOffline: boolean = $state(false);

  onMount(() => {
    sessionId = getSessionId();
    void refresh();
  });

  async function refresh() {
    loading = true;
    error = null;
    try {
      const userId = authState.user?.id;
      records = await queryConvex<any[]>(api.savedScreeners.list, { sportId, sessionId, userId }) as SavedScreenerDoc[];
      usingOffline = false;
    } catch (e: any) {
      // Silently fall back to localStorage
      usingOffline = true;
      records = lsLoad();
    } finally {
      loading = false;
    }
  }

  function stampTitle(): string {
    const now = new Date();
    const d = now.toLocaleString(undefined, { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const tag = scopes[0]?.teamA && scopes[0]?.teamB
      ? `${scopes[0].teamA} vs ${scopes[0].teamB}`
      : `${sportTitle} Analysis`;
    return `${tag} · ${d}`;
  }

  function openSaveDialog(doc?: SavedScreenerDoc) {
    if (doc) {
      editingDoc = doc;
      mode = 'edit';
      titleInput = doc.title;
      notesInput = doc.notes ?? '';
    } else {
      editingDoc = null;
      mode = 'save';
      titleInput = stampTitle();
      notesInput = '';
    }
  }

  async function submitSave() {
    if (!titleInput.trim()) return;
    working = true;
    error = null;
    try {
      const verdictPayload = analysis
        ? {
            headline: analysis.headline,
            chips: analysis.chips?.map((c) => ({ label: c.label, value: c.value, status: c.status })),
            masterLedger: analysis.masterLedger ? {
              candidateLabel: analysis.masterLedger.candidateLabel,
              marketProbability: analysis.masterLedger.marketProbability,
              bookmakerMargin: analysis.masterLedger.bookmakerMargin,
              tier: analysis.masterLedger.tier,
              agreeCount: analysis.masterLedger.agreeCount,
              disagreeCount: analysis.masterLedger.disagreeCount
            } : undefined,
            aiInsights: aiResult?.insights ? { ...aiResult.insights } : undefined,
            topPick: analysis.picks?.[0]
              ? {
                  marketId: analysis.picks[0].marketId,
                  marketTitle: analysis.picks[0].marketTitle,
                  label: analysis.picks[0].label,
                  probability: analysis.picks[0].probability,
                  odds: analysis.picks[0].odds,
                  ev: analysis.picks[0].ev
                }
              : undefined
          }
        : undefined;

      if (usingOffline) {
        // Save to localStorage
        const now = Date.now();
        const existing = lsLoad();
        let found: SavedScreenerDoc | undefined;
        if (editingDoc?._id) {
          const idx = existing.findIndex((r) => r._id === editingDoc!._id);
          if (idx !== -1) {
            existing[idx] = { ...existing[idx], title: titleInput.trim(), notes: notesInput.trim() || undefined, scopes: JSON.parse(JSON.stringify(scopes)), verdict: verdictPayload, updatedAt: now };
            found = existing[idx];
          }
        }
        if (!found) {
          const newDoc: SavedScreenerDoc = {
            _id: ('ls_' + Date.now().toString(36) + Math.random().toString(36).slice(2)) as any,
            sportId,
            title: titleInput.trim(),
            notes: notesInput.trim() || undefined,
            scopes: JSON.parse(JSON.stringify(scopes)),
            verdict: verdictPayload,
            sessionId,
            createdAt: now,
            updatedAt: now
          };
          existing.unshift(newDoc);
          found = newDoc;
        }
        lsSave(existing);
        records = existing;
        mode = 'list';
        if (found) dispatch('saved', { doc: found });
      } else {
        const args: any = {
          sportId,
          title: titleInput.trim(),
          notes: notesInput.trim() || undefined,
          scopes: JSON.parse(JSON.stringify(scopes)),
          verdict: verdictPayload,
          sessionId,
          userId: authState.user?.id
        };
        if (editingDoc?._id) args._id = editingDoc._id;
        const id = await callConvex<any>(api.savedScreeners.save, args);
        mode = 'list';
        await refresh();
        const found2 = records.find((r) => String(r._id) === String(id)) ?? records[0];
        if (found2) dispatch('saved', { doc: found2 });
      }
    } catch (e: any) {
      // Try localStorage fallback if convex fails mid-session
      usingOffline = true;
      error = null;
      await submitSave();
    } finally {
      working = false;
    }
  }

  async function confirmDelete(doc: SavedScreenerDoc) {
    const ok = window.confirm(`Delete "${doc.title}"? This cannot be undone.`);
    if (!ok) return;
    working = true;
    error = null;
    try {
      if (usingOffline || String(doc._id).startsWith('ls_')) {
        const existing = lsLoad().filter((r) => r._id !== doc._id);
        lsSave(existing);
        records = existing;
      } else {
        await callConvex(api.savedScreeners.remove, { id: doc._id, sessionId, userId: authState.user?.id });
        if (expandedId === String(doc._id)) expandedId = null;
        await refresh();
      }
    } catch (e: any) {
      error = e?.message ?? 'Failed to delete screener';
    } finally {
      working = false;
    }
  }

  function loadDoc(doc: SavedScreenerDoc) {
    try {
      dispatch('load', { scopes: doc.scopes, doc });
    } catch (_e) {
      error = 'Could not restore screener state';
    }
  }

  function toggleExpand(id: string) {
    expandedId = expandedId === id ? null : id;
  }

  function fmt(ts: number) {
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }
</script>

<section class="sh-root" style={`--accent:${accent}`} aria-label="Saved screeners history">
  <div class="sh-head">
    <div class="sh-meta">
      <h3>Screener History</h3>
      <p class="sub">
        Save verdicts for later review.
        {#if usingOffline}
          <span class="offline-badge">Saved to this device</span>
        {:else}
          Stored in Convex · synced with this browser.
        {/if}
      </p>
    </div>
    <div class="sh-actions">
      {#if mode !== 'list'}
        <button type="button" class="btn ghost" onclick={() => { mode = 'list'; error = null; }} disabled={working}>Back</button>
      {/if}
      <button type="button" class="btn primary" onclick={() => openSaveDialog()} disabled={working}>+ Save Current</button>
    </div>
  </div>

  {#if mode === 'save' || mode === 'edit'}
    <div class="save-card" aria-labelledby="save-dialog-title">
      <h4 id="save-dialog-title">{mode === 'edit' ? 'Update saved screener' : 'Save current screener & verdict'}</h4>
      <label>
        <span>Title</span>
        <input
          type="text"
          bind:value={titleInput}
          placeholder="e.g. Man Utd vs Arsenal FT Over 2.5 · 26 Jul"
          maxlength="120"
          required
        />
      </label>
      <label>
        <span>Notes (optional)</span>
        <textarea
          bind:value={notesInput}
          placeholder="Any context you want to remember later: league, source of odds, live scenario etc."
          rows="3"
          maxlength="500"
        ></textarea>
      </label>
      <div class="save-foot">
        <span class="meta">{scopes.length} scope{scopes.length === 1 ? '' : 's'} · Auto-saves full market state + verdict</span>
        <div class="row">
          <button type="button" class="btn ghost" onclick={() => { mode = 'list'; error = null; }} disabled={working}>Cancel</button>
          <button type="button" class="btn primary" onclick={submitSave} disabled={working || !titleInput.trim()}>
            {working ? 'Saving…' : (mode === 'edit' ? 'Update' : 'Save')}
          </button>
        </div>
      </div>
    </div>
  {:else}
    {#if error}
      <div class="err" role="alert">{error}</div>
    {/if}
    {#if loading}
      <div class="empty">Loading history…</div>
    {:else if !records.length}
      <div class="empty">
        <strong>No saved screeners yet.</strong>
        <p>Click <em>+ Save Current</em> to preserve this analysis with its verdict and all market selections.</p>
      </div>
    {:else}
      <ul class="rec-list">
        {#each records as rec (String(rec._id))}
          {@const isExpanded = expandedId === String(rec._id)}
          <li class="rec-item" data-expanded={isExpanded || undefined}>
            <div class="rec-row">
              <button type="button" class="rec-title" onclick={() => toggleExpand(String(rec._id))}>
                <span class="chev" aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                <strong>{rec.title}</strong>
              </button>
              <span class="ts">{fmt(rec.updatedAt)}</span>
              <div class="rec-buttons" role="group" aria-label="Record actions">
                <button
                  type="button"
                  class="btn mini ghost"
                  title="Load this screener state into the current page"
                  onclick={() => loadDoc(rec)}
                >Load</button>
                <button
                  type="button"
                  class="btn mini warn"
                  title="Edit title or notes"
                  onclick={() => openSaveDialog(rec)}
                  disabled={working}
                >Edit</button>
                <button
                  type="button"
                  class="btn mini danger"
                  title="Delete permanently"
                  onclick={() => confirmDelete(rec)}
                  disabled={working}
                >Delete</button>
              </div>
            </div>
            {#if isExpanded}
              <div class="rec-detail">
                {#if rec.verdict}
                  <div class="verdict-box">
                    <div class="verdict-head">
                      <span class="tag">Verdict Hero</span>
                      {rec.verdict.headline}
                    </div>
                    {#if rec.verdict.topPick}
                      <div class="top-pick">
                        <strong>Top pick:</strong>
                        {rec.verdict.topPick.label} @ {rec.verdict.topPick.probability.toFixed(1)}% ({rec.verdict.topPick.odds.toFixed(2)})
                      </div>
                    {/if}
                    {#if rec.verdict.chips?.length}
                      <div class="chip-row">
                        {#each rec.verdict.chips as c}
                          <span class="chip" data-status={c.status}><b>{c.label}</b> {c.value}</span>
                        {/each}
                      </div>
                    {/if}

                    <!-- Saved Master Verdict Card -->
                    {#if rec.verdict.masterLedger}
                      <div class="saved-section master-card-saved">
                        <span class="tag master-tag">Master Verdict Card</span>
                        <div class="master-summary-row">
                          <span class="cand-label">{rec.verdict.masterLedger.candidateLabel}</span>
                          <span class="tier-pill">{rec.verdict.masterLedger.tier}</span>
                          <span class="stat-pill">Real Win Chance: {rec.verdict.masterLedger.marketProbability ?? '-'}%</span>
                          <span class="stat-pill">Bookies Profit Cut: {rec.verdict.masterLedger.bookmakerMargin ?? '-'}%</span>
                        </div>
                      </div>
                    {/if}

                    <!-- Saved AI Copilot Real-Time Analysis -->
                    {#if rec.verdict.aiInsights}
                      <div class="saved-section ai-insights-saved">
                        <span class="tag ai-tag">AI Copilot Analysis</span>
                        <p class="ai-verdict-summary"><strong>AI Verdict:</strong> {rec.verdict.aiInsights.verdictSummary}</p>
                        {#if rec.verdict.aiInsights.valueAssessment}
                          <p class="ai-sub-text"><strong>Value Read:</strong> {rec.verdict.aiInsights.valueAssessment}</p>
                        {/if}
                        {#if rec.verdict.aiInsights.top3Selections?.length}
                          <div class="saved-top3-list">
                            {#each rec.verdict.aiInsights.top3Selections as item}
                              <div class="top3-saved-pill">
                                <span class="rank">#{item.rank}</span>
                                <span class="name">{item.selection}</span>
                                <span class="conf">{item.confidence}</span>
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/if}
                  </div>
                {/if}
                {#if rec.notes}
                  <div class="notes-box">
                    <span class="tag">Notes</span>
                    <p>{rec.notes}</p>
                  </div>
                {/if}
                <div class="scope-meta">
                  {#each rec.scopes as s}
                    <span class="scope-pill">{s.title} · {Object.keys(s.markets ?? {}).length} markets</span>
                  {/each}
                </div>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .sh-root {
    background: var(--c-surface-2, rgba(255, 255, 255, 0.04));
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid var(--c-border, rgba(255, 255, 255, 0.08));
    border-radius: 18px;
    padding: 18px;
    display: grid;
    content-visibility: auto;
    contain-intrinsic-size: auto 400px;
    gap: 14px;
  }

  .verdict-box {
    margin-top: 8px;
    background: var(--c-surface-1, rgba(0, 0, 0, 0.22));
    border: 1px solid var(--c-border-sm, rgba(255, 255, 255, 0.08));
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .saved-section {
    border-top: 1px solid var(--c-border-sm, rgba(255, 255, 255, 0.06));
    padding-top: 8px;
    margin-top: 4px;
  }

  .master-tag { color: var(--accent, #6366f1) !important; background: color-mix(in srgb, var(--accent, #6366f1) 16%, transparent) !important; }
  .ai-tag { color: var(--c-orange) !important; background: color-mix(in srgb, #f38020 16%, transparent) !important; }

  .master-summary-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
    font-size: 11.5px;
  }

  .cand-label { font-weight: 800; color: var(--c-text, #ffffff); }
  .tier-pill { font-weight: 700; color: var(--accent, #6aa6ff); }
  .stat-pill { color: var(--c-muted, #8899bb); font-size: 11px; }

  .ai-verdict-summary { margin: 4px 0 2px; font-size: 12px; color: var(--c-text-sub, #d0d7e6); line-height: 1.4; }
  .ai-sub-text { margin: 0; font-size: 11.5px; color: var(--c-muted, #8899bb); line-height: 1.35; }

  .saved-top3-list {
    display: flex;
    gap: 6px;
    margin-top: 6px;
    flex-wrap: wrap;
  }

  .top3-saved-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--c-glass-sm);
    border: 1px solid var(--c-border-sm);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
  }
  .top3-saved-pill .rank { color: var(--c-amber); font-weight: 900; }
  .top3-saved-pill .name { color: var(--c-text, #ffffff); font-weight: 700; }
  .top3-saved-pill .conf { color: var(--c-green, #4ade80); font-weight: 800; font-size: 10px; }

  .sh-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .sh-meta { flex: 1 1 200px; min-width: 0; }

  h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--c-text, #f1f5ff);
  }

  .sub {
    margin: 5px 0 0;
    color: var(--c-muted, #8899bb);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .offline-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10.5px;
    font-weight: 800;
    color: var(--c-amber, #f59e0b);
    background: color-mix(in srgb, var(--c-amber, #f59e0b) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--c-amber, #f59e0b) 30%, transparent);
    padding: 2px 8px;
    border-radius: 999px;
  }

  .sh-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    flex-shrink: 0;
  }

  /* Buttons */
  .btn {
    border: 1px solid var(--c-border, rgba(255,255,255,0.09));
    background: var(--c-glass-md);
    backdrop-filter: blur(8px);
    color: var(--c-text, #f1f5ff);
    padding: 8px 16px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    font-family: var(--font-brand, 'Outfit', system-ui);
    cursor: pointer;
    transition: border-color 120ms, background 120ms, transform 60ms, box-shadow 120ms;
    white-space: nowrap;
  }
  .btn[disabled] { opacity: 0.45; cursor: not-allowed; }
  .btn:not([disabled]):active { transform: scale(0.96); }

  .btn.primary {
    background: color-mix(in srgb, var(--accent) 22%, rgba(255,255,255,0.05));
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    color: var(--c-on-accent);
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 15%, transparent);
  }
  .btn.primary:not([disabled]):hover {
    background: color-mix(in srgb, var(--accent) 35%, rgba(255,255,255,0.05));
    box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .btn.ghost { background: transparent; }
  .btn.ghost:not([disabled]):hover { background: var(--c-glass-hover); border-color: var(--c-border-md); }
  .btn.warn:not([disabled]):hover { border-color: rgba(251,191,36,0.5); color: var(--c-amber); }
  .btn.danger:not([disabled]):hover { border-color: rgba(251,113,133,0.5); color: var(--c-red); }
  .btn.mini { padding: 5px 11px; font-size: 12px; border-radius: 8px; }

  /* Save form */
  .save-card {
    background: var(--c-surface-3);
    border: 1px solid var(--c-border);
    border-radius: 14px;
    padding: 16px;
    display: grid;
    gap: 12px;
  }
  .save-card h4 { margin: 0 0 4px; color: var(--c-text, #f1f5ff); font-size: 14px; font-weight: 800; }
  .save-card label { display: grid; gap: 6px; }
  .save-card label > span {
    font-size: 10.5px;
    color: var(--c-muted, #8899bb);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .save-card input, .save-card textarea {
    width: 100%;
    min-height: 44px;
    color: var(--c-text, #f1f5ff);
    background: var(--c-input-bg);
    backdrop-filter: blur(8px);
    border: 1px solid var(--c-input-border);
    border-radius: 10px;
    padding: 10px 14px;
    font: inherit;
    box-sizing: border-box;
    transition: border-color var(--t-base), box-shadow var(--t-base);
  }
  .save-card input:focus, .save-card textarea:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 10%, transparent);
  }
  .save-card textarea { resize: vertical; min-height: 80px; }
  .save-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .save-foot .meta { color: var(--c-muted, #8899bb); font-size: 12px; flex: 1 1 180px; }
  .save-foot .row { display: flex; gap: 8px; flex-shrink: 0; }

  /* Empty */
  .empty {
    padding: 28px 18px;
    text-align: center;
    color: var(--c-muted, #8899bb);
    border: 1px dashed var(--c-border-md);
    border-radius: 12px;
    background: var(--c-glass-sm);
  }
  .empty strong { display: block; color: var(--c-text, #f1f5ff); margin-bottom: 8px; font-size: 15px; }
  .empty p { margin: 4px 0 0; font-size: 12.5px; color: var(--c-muted, #8899bb); line-height: 1.5; }

  /* Error */
  .err {
    background: rgba(251,113,133,0.08);
    border: 1px solid rgba(251,113,133,0.25);
    color: var(--c-red);
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
  }

  /* Record list */
  .rec-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  .rec-item {
    background: var(--c-surface-1);
    border: 1px solid var(--c-border-sm);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color var(--t-base);
  }
  .rec-item:hover { border-color: color-mix(in srgb, var(--accent) 25%, rgba(255,255,255,0.07)); }
  .rec-item[data-expanded] { border-color: color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.08)); }

  .rec-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 13px;
    flex-wrap: wrap;
  }

  .rec-title {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 160px;
    min-width: 0;
    color: var(--c-text, #f1f5ff);
    padding: 4px 0;
  }
  .rec-title:hover { color: var(--c-orange); }
  .rec-title strong {
    font-size: 13.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    font-weight: 700;
  }

  .chev { color: var(--accent); font-size: 11px; width: 14px; text-align: center; flex-shrink: 0; }
  .ts {
    color: var(--c-muted, #8899bb);
    font-size: 11px;
    white-space: nowrap;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    flex-shrink: 0;
    order: 3;
  }
  .rec-buttons {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
    order: 4;
    flex-wrap: wrap;
  }

  @media (max-width: 500px) {
    .rec-row { padding: 10px 10px; gap: 6px; }
    .rec-title { flex: 1 1 100%; }
    .ts { order: 2; margin-left: auto; }
    .rec-buttons { order: 3; width: 100%; justify-content: flex-start; }
    .btn.mini { flex: 1; justify-content: center; display: flex; align-items: center; }
  }

  /* Expanded detail */
  .rec-detail { padding: 0 14px 14px; display: grid; gap: 10px; animation: slide-up 0.2s ease both; }
  .verdict-box, .notes-box {
    background: var(--c-surface-1);
    border: 1px solid var(--c-border-sm);
    border-radius: 10px;
    padding: 11px 13px;
  }
  .verdict-head { display: flex; gap: 10px; align-items: flex-start; color: var(--c-text, #f1f5ff); font-size: 13px; margin-bottom: 7px; font-weight: 600; flex-wrap: wrap; }
  .top-pick { color: var(--c-text-2, #c8d6ee); font-size: 12.5px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip {
    display: inline-flex; gap: 6px; align-items: baseline;
    padding: 4px 9px; border-radius: 999px;
    background: var(--c-glass-sm); border: 1px solid var(--c-border-sm);
    color: var(--c-text-2, #c8d6ee); font-size: 11.5px;
  }
  .chip[data-status='green'] { border-color: rgba(74,222,128,0.22); color: var(--c-green); background: rgba(74,222,128,0.07); }
  .chip[data-status='amber'] { border-color: rgba(251,191,36,0.22); color: var(--c-amber); background: rgba(251,191,36,0.07); }
  .chip[data-status='red']   { border-color: rgba(251,113,133,0.22); color: var(--c-red); background: rgba(251,113,133,0.07); }
  .chip b { color: inherit; font-weight: 800; }
  .notes-box p { margin: 5px 0 0; color: var(--c-text-2, #c8d6ee); font-size: 13px; white-space: pre-wrap; line-height: 1.55; }
  .tag {
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, rgba(255,255,255,0.04));
    padding: 3px 8px; border-radius: 6px; margin-right: 8px;
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
    white-space: nowrap;
  }
  .scope-meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .scope-pill {
    background: var(--c-glass-sm); border: 1px solid var(--c-border-sm);
    padding: 4px 9px; border-radius: 8px;
    font-size: 11px; color: var(--c-muted, #8899bb); font-weight: 600;
  }
</style>
