// Client-side selection state for the AI Predictor.
//
// Users pick the scheduled matches/games they want the predictor to analyse,
// then switch to other sports and repeat. Selections are scoped per
// (sportId, dayKey) and persisted to localStorage so they survive navigation
// and page reloads. Every helper takes an optional injected storage so the
// logic stays unit-testable in Node (where localStorage does not exist).

export const PREDICTOR_MAX_SELECTIONS = 10;

const STORAGE_PREFIX = 'pulseodds.predictor.selection.v1.';

export type SelectionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): SelectionStorage | null {
  try {
    return typeof globalThis !== 'undefined' && globalThis.localStorage ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

export function selectionKey(sportId: string, dayKey: string): string {
  return `${STORAGE_PREFIX}${sportId}.${dayKey}`;
}

export function loadSelection(
  sportId: string,
  dayKey: string,
  storage: SelectionStorage | null = defaultStorage()
): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(selectionKey(sportId, dayKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSelection(
  sportId: string,
  dayKey: string,
  matchIds: string[],
  storage: SelectionStorage | null = defaultStorage()
): void {
  if (!storage) return;
  try {
    const unique = Array.from(new Set(matchIds.filter((x): x is string => typeof x === 'string')))
      .slice(0, PREDICTOR_MAX_SELECTIONS);
    if (unique.length === 0) {
      storage.removeItem(selectionKey(sportId, dayKey));
    } else {
      storage.setItem(selectionKey(sportId, dayKey), JSON.stringify(unique));
    }
  } catch {
    /* storage unavailable — selection is ephemeral for this session */
  }
}

// Returns the new selection set. When the cap is reached and `matchId` is new,
// the current set is returned unchanged and `capped` is true so the UI can
// surface the limit to the user.
export function toggleSelection(
  sportId: string,
  dayKey: string,
  matchId: string,
  storage: SelectionStorage | null = defaultStorage()
): { selection: string[]; capped: boolean } {
  const current = loadSelection(sportId, dayKey, storage);
  if (current.includes(matchId)) {
    const next = current.filter((id) => id !== matchId);
    saveSelection(sportId, dayKey, next, storage);
    return { selection: next, capped: false };
  }
  if (current.length >= PREDICTOR_MAX_SELECTIONS) {
    return { selection: current, capped: true };
  }
  const next = [...current, matchId];
  saveSelection(sportId, dayKey, next, storage);
  return { selection: next, capped: false };
}

export function clearSelection(
  sportId: string,
  dayKey: string,
  storage: SelectionStorage | null = defaultStorage()
): void {
  saveSelection(sportId, dayKey, [], storage);
}

// Drop selections whose matches no longer exist in the day cache, so the UI
// never carries dangling ids. Returns the pruned set (also persisted).
export function pruneSelection(
  sportId: string,
  dayKey: string,
  validMatchIds: string[],
  storage: SelectionStorage | null = defaultStorage()
): string[] {
  const valid = new Set(validMatchIds);
  const kept = loadSelection(sportId, dayKey, storage).filter((id) => valid.has(id));
  saveSelection(sportId, dayKey, kept, storage);
  return kept;
}
