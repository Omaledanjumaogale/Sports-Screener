// src/lib/draftSync.ts
// Bi-directional sync of live screener drafts between localStorage and Convex.
//
// The engine already persists drafts to localStorage (`sportsScreener_v1_<sport>`).
// This module mirrors those drafts to Convex (`drafts` table) so a signed-in user's
// in-progress work follows them across devices, while localStorage stays as the
// instant/offline layer.

import { callConvex, queryConvex, getSessionId, api, type DraftDoc, type ConvexSportId } from './convexClient';
import type { SportId } from './engine';

const DRAFT_PENDING_KEY = 'sportsScreener_draft_pending_v1';

type PendingDraft = { sportId: string; scopes: any; updatedAt: number };

export function ownerFor(authUserId?: string | null): string {
  return authUserId ?? getSessionId();
}

function readPending(): Record<string, PendingDraft> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(DRAFT_PENDING_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function writePending(map: Record<string, PendingDraft>) {
  try { localStorage.setItem(DRAFT_PENDING_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

// Best-effort push of a draft snapshot to Convex. On failure the draft is queued
// in localStorage so a later `flushPendingDrafts()` uploads it.
export async function pushDraft(
  sportId: SportId | ConvexSportId,
  scopes: any[],
  authUserId?: string | null,
  updatedAt = Date.now()
): Promise<void> {
  const sessionId = getSessionId();
  const owner = ownerFor(authUserId);
  try {
    await callConvex(api.drafts.save, {
      sportId,
      sessionId,
      userId: authUserId ?? undefined,
      scopes: JSON.parse(JSON.stringify(scopes)),
      owner
    });
    const pending = readPending();
    delete pending[sportId];
    writePending(pending);
  } catch {
    const pending = readPending();
    pending[sportId] = { sportId, scopes: JSON.parse(JSON.stringify(scopes)), updatedAt };
    writePending(pending);
  }
}

// Load a Convex draft, if any. Returns `null` when none exists or when offline.
export async function pullDraft(
  sportId: SportId | ConvexSportId,
  authUserId?: string | null
): Promise<{ scopes: any; updatedAt: number } | null> {
  const sessionId = getSessionId();
  try {
    const doc = await queryConvex<DraftDoc | null>(api.drafts.get, {
      sportId,
      sessionId,
      userId: authUserId ?? undefined
    });
    if (doc?.scopes && Array.isArray(doc.scopes)) {
      return { scopes: doc.scopes, updatedAt: doc.updatedAt };
    }
    return null;
  } catch {
    return null;
  }
}

// Upload any queued offline drafts (e.g. after connectivity/auth restore).
export async function flushPendingDrafts(authUserId?: string | null): Promise<void> {
  const pending = readPending();
  const keys = Object.keys(pending);
  if (!keys.length) return;
  const sessionId = getSessionId();
  for (const sportId of keys) {
    const entry = pending[sportId];
    try {
      await callConvex(api.drafts.save, {
        sportId,
        sessionId,
        userId: authUserId ?? undefined,
        scopes: JSON.parse(JSON.stringify(entry.scopes)),
        owner: ownerFor(authUserId)
      });
      delete pending[sportId];
    } catch { /* keep queued; retry next time */ }
  }
  writePending(pending);
}
