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
    accent = '#6aa6ff'
  }: {
    sportId: ConvexSportId;
    sportTitle: string;
    scopes: any[];
    analysis: Analysis | null;
    accent?: string;
  } = $props();

  import { authState } from '../authStore.svelte';

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
    } catch (e: any) {
      error = e?.message ?? 'Could not load history. Using offline mode.';
      records = [];
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
            chips: analysis.chips.map((c) => ({ label: c.label, value: c.value, status: c.status })),
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
      const found = records.find((r) => String(r._id) === String(id)) ?? records[0];
      if (found) dispatch('saved', { doc: found });
    } catch (e: any) {
      error = e?.message ?? 'Failed to save screener';
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
      await callConvex(api.savedScreeners.remove, { id: doc._id, sessionId, userId: authState.user?.id });
      if (expandedId === String(doc._id)) expandedId = null;
      await refresh();
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
    <div>
      <h3>Screener History</h3>
      <p class="sub">Save verdicts for later review. Stored in Convex · synced with this browser.</p>
    </div>
    <div class="sh-actions">
      {#if mode !== 'list'}
        <button type="button" class="btn ghost" onclick={() => { mode = 'list'; error = null; }} disabled={working}>Back</button>
      {/if}
      <button type="button" class="btn primary" onclick={() => openSaveDialog()} disabled={working}>+ Save Current</button>
    </div>
  </div>

  {#if error}
    <div class="err" role="alert">{error}</div>
  {/if}

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
                <span class="ts">{fmt(rec.updatedAt)}</span>
              </button>
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
                      <span class="tag">Verdict</span>
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
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px) saturate(160%);
    -webkit-backdrop-filter: blur(16px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 18px;
    padding: 18px;
    display: grid;
    gap: 14px;
  }
  .sh-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }
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
  }
  .sh-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  /* Buttons */
  .btn {
    border: 1px solid rgba(255,255,255,0.09);
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(8px);
    color: var(--c-text, #f1f5ff);
    padding: 8px 16px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    font-family: var(--font-brand, 'Outfit', system-ui);
    cursor: pointer;
    transition: border-color 120ms, background 120ms, transform 60ms, box-shadow 120ms;
  }
  .btn[disabled] { opacity: 0.45; cursor: not-allowed; }
  .btn:not([disabled]):active { transform: scale(0.96); }
  .btn.primary {
    background: color-mix(in srgb, var(--accent) 22%, rgba(255,255,255,0.05));
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    color: #fff;
    box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 15%, transparent);
  }
  .btn.primary:not([disabled]):hover {
    background: color-mix(in srgb, var(--accent) 35%, rgba(255,255,255,0.05));
    box-shadow: 0 0 24px color-mix(in srgb, var(--accent) 25%, transparent);
  }
  .btn.ghost { background: transparent; }
  .btn.ghost:not([disabled]):hover { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.15); }
  .btn.warn:not([disabled]):hover { border-color: rgba(251,191,36,0.5); color: #fde68a; }
  .btn.danger:not([disabled]):hover { border-color: rgba(251,113,133,0.5); color: #fecdd3; }
  .btn.mini { padding: 5px 11px; font-size: 12px; border-radius: 8px; }

  /* Error */
  .err {
    background: rgba(251,113,133,0.08);
    border: 1px solid rgba(251,113,133,0.25);
    color: #fecdd3;
    padding: 10px 14px;
    border-radius: 10px;
    font-size: 13px;
  }

  /* Save form */
  .save-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
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
    background: rgba(255,255,255,0.05);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255,255,255,0.09);
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
  .save-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
  .save-foot .meta { color: var(--c-muted, #8899bb); font-size: 12px; }
  .save-foot .row { display: flex; gap: 8px; }

  /* Empty */
  .empty {
    padding: 28px 18px;
    text-align: center;
    color: var(--c-muted, #8899bb);
    border: 1px dashed rgba(255,255,255,0.1);
    border-radius: 12px;
    background: rgba(255,255,255,0.02);
  }
  .empty strong { display: block; color: var(--c-text, #f1f5ff); margin-bottom: 8px; font-size: 15px; }
  .empty p { margin: 4px 0 0; font-size: 12.5px; color: var(--c-muted, #8899bb); line-height: 1.5; }

  /* Record list */
  .rec-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  .rec-item {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    overflow: hidden;
    transition: border-color var(--t-base);
  }
  .rec-item:hover { border-color: color-mix(in srgb, var(--accent) 25%, rgba(255,255,255,0.07)); }
  .rec-item[data-expanded] { border-color: color-mix(in srgb, var(--accent) 30%, rgba(255,255,255,0.08)); }
  .rec-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 13px; flex-wrap: wrap; }
  .rec-title {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 9px;
    flex: 1 1 220px;
    color: var(--c-text, #f1f5ff);
    padding: 4px 0;
    min-width: 0;
  }
  .rec-title:hover { color: #fff; }
  .rec-title strong { font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 520px; font-weight: 700; }
  .chev { color: var(--accent); font-size: 11px; width: 14px; text-align: center; }
  .ts { margin-left: auto; color: var(--c-muted, #8899bb); font-size: 11px; white-space: nowrap; font-family: var(--font-mono, 'JetBrains Mono', monospace); }
  .rec-buttons { display: flex; gap: 6px; flex: 0 0 auto; }

  /* Expanded detail */
  .rec-detail { padding: 0 14px 14px; display: grid; gap: 10px; animation: slide-up 0.2s ease both; }
  .verdict-box, .notes-box {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 10px;
    padding: 11px 13px;
  }
  .verdict-head { display: flex; gap: 10px; align-items: flex-start; color: var(--c-text, #f1f5ff); font-size: 13px; margin-bottom: 7px; font-weight: 600; }
  .top-pick { color: var(--c-text-2, #c8d6ee); font-size: 12.5px; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .chip {
    display: inline-flex; gap: 6px; align-items: baseline;
    padding: 4px 9px; border-radius: 999px;
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    color: var(--c-text-2, #c8d6ee); font-size: 11.5px;
  }
  .chip[data-status='green'] { border-color: rgba(74,222,128,0.22); color: #86efac; background: rgba(74,222,128,0.07); }
  .chip[data-status='amber'] { border-color: rgba(251,191,36,0.22); color: #fde68a; background: rgba(251,191,36,0.07); }
  .chip[data-status='red']   { border-color: rgba(251,113,133,0.22); color: #fecdd3; background: rgba(251,113,133,0.07); }
  .chip b { color: inherit; font-weight: 800; }
  .notes-box p { margin: 5px 0 0; color: var(--c-text-2, #c8d6ee); font-size: 13px; white-space: pre-wrap; line-height: 1.55; }
  .tag {
    font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, rgba(255,255,255,0.04));
    padding: 3px 8px; border-radius: 6px; margin-right: 8px;
    border: 1px solid color-mix(in srgb, var(--accent) 22%, transparent);
  }
  .scope-meta { display: flex; gap: 6px; flex-wrap: wrap; }
  .scope-pill {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    padding: 4px 9px; border-radius: 8px;
    font-size: 11px; color: var(--c-muted, #8899bb); font-weight: 600;
  }
</style>
