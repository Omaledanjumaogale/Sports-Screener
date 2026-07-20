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
      records = await queryConvex<any[]>(api.savedScreeners.list, { sportId, sessionId }) as SavedScreenerDoc[];
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
        sessionId
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
      await callConvex(api.savedScreeners.remove, { id: doc._id, sessionId });
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
    background: #0d1729;
    border: 1px solid #1a2944;
    border-radius: 14px;
    padding: 16px;
    display: grid;
    gap: 12px;
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
    letter-spacing: 0.01em;
    color: #eaf3ff;
  }
  .sub {
    margin: 4px 0 0;
    color: #7e94b7;
    font-size: 12px;
  }
  .sh-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .btn {
    border: 1px solid #2a3a55;
    background: #111c2f;
    color: #eaf3ff;
    padding: 8px 14px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: border-color 120ms, background 120ms, transform 60ms;
  }
  .btn[disabled] { opacity: 0.5; cursor: not-allowed; }
  .btn:not([disabled]):active { transform: translateY(1px); }
  .btn.primary {
    background: color-mix(in srgb, var(--accent) 70%, transparent);
    border-color: color-mix(in srgb, var(--accent) 50%, transparent);
    color: #fff;
  }
  .btn.primary:not([disabled]):hover { background: color-mix(in srgb, var(--accent) 90%, transparent); }
  .btn.ghost { background: transparent; }
  .btn.ghost:not([disabled]):hover { border-color: #3f5479; }
  .btn.warn:not([disabled]):hover { border-color: #d4a017; color: #ffd975; }
  .btn.danger:not([disabled]):hover { border-color: #c43b3b; color: #ffb1b1; }
  .btn.mini { padding: 5px 10px; font-size: 12px; border-radius: 8px; }

  .err {
    background: #2a1217;
    border: 1px solid #5c2330;
    color: #ffb1b1;
    padding: 10px 12px;
    border-radius: 10px;
    font-size: 13px;
  }

  .save-card {
    background: #0f1a2e;
    border: 1px solid #1e2f4e;
    border-radius: 12px;
    padding: 14px;
    display: grid;
    gap: 10px;
  }
  .save-card h4 { margin: 0 0 4px; color: #eaf3ff; font-size: 14px; }
  .save-card label { display: grid; gap: 4px; }
  .save-card label > span { font-size: 11px; color: #9fb2cc; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; }
  .save-card input, .save-card textarea {
    width: 100%;
    min-height: 42px;
    color: #f7fbff;
    background: #111c2f;
    border: 1px solid #2a3a55;
    border-radius: 8px;
    padding: 10px 12px;
    font: inherit;
    box-sizing: border-box;
  }
  .save-card textarea { resize: vertical; min-height: 76px; }
  .save-foot {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-top: 4px;
  }
  .save-foot .meta { color: #6f84a5; font-size: 12px; }
  .save-foot .row { display: flex; gap: 8px; }

  .empty {
    padding: 24px 18px;
    text-align: center;
    color: #9fb2cc;
    border: 1px dashed #233453;
    border-radius: 10px;
  }
  .empty strong { display: block; color: #eaf3ff; margin-bottom: 6px; }
  .empty p { margin: 4px 0 0; font-size: 12px; color: #7e94b7; }

  .rec-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: grid;
    gap: 8px;
  }
  .rec-item {
    background: #0f1a2e;
    border: 1px solid #1e2f4e;
    border-radius: 10px;
    overflow: hidden;
  }
  .rec-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    flex-wrap: wrap;
  }
  .rec-title {
    all: unset;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 240px;
    color: #eaf3ff;
    padding: 4px 0;
    min-width: 0;
  }
  .rec-title strong {
    font-size: 14px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 520px;
  }
  .chev { color: #9fb2cc; font-size: 11px; width: 14px; text-align: center; }
  .ts { margin-left: auto; color: #6f84a5; font-size: 11px; white-space: nowrap; }
  .rec-buttons { display: flex; gap: 6px; flex: 0 0 auto; }

  .rec-detail {
    padding: 0 14px 14px;
    display: grid;
    gap: 10px;
  }
  .verdict-box, .notes-box {
    background: #101a2f;
    border: 1px solid #1e2f4e;
    border-radius: 10px;
    padding: 10px 12px;
  }
  .verdict-head {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    color: #eaf3ff;
    font-size: 13px;
    margin-bottom: 6px;
    font-weight: 600;
  }
  .top-pick {
    color: #c7d7ee;
    font-size: 12.5px;
  }
  .chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .chip {
    display: inline-flex;
    gap: 6px;
    align-items: baseline;
    padding: 4px 8px;
    border-radius: 999px;
    background: #0c1424;
    border: 1px solid #1e2f4e;
    color: #c7d7ee;
    font-size: 11.5px;
  }
  .chip[data-status='green'] { border-color: #1f6f44; color: #a7e6c4; }
  .chip[data-status='amber'] { border-color: #8a6b1a; color: #ffd975; }
  .chip[data-status='red'] { border-color: #7a2727; color: #ffb1b1; }
  .chip b { color: inherit; font-weight: 800; }
  .notes-box p { margin: 4px 0 0; color: #c7d7ee; font-size: 13px; white-space: pre-wrap; }
  .tag {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    padding: 3px 7px;
    border-radius: 6px;
    margin-right: 8px;
  }
  .scope-meta {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .scope-pill {
    background: #0c1424;
    border: 1px solid #1e2f4e;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    color: #9fb2cc;
  }
</style>
