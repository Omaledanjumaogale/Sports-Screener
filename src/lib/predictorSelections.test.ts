import { describe, it, expect, beforeEach } from 'vitest';
import {
  selectionKey,
  loadSelection,
  saveSelection,
  toggleSelection,
  clearSelection,
  pruneSelection,
  PREDICTOR_MAX_SELECTIONS
} from './predictorSelections';

// In-memory Storage stand-in so the pure helpers are testable without a DOM.
class MemoryStorage {
  store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('predictorSelections', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('round-trips a selection through save/load', () => {
    saveSelection('football', '2026-08-04', ['m1', 'm2', 'm3'], storage);
    expect(loadSelection('football', '2026-08-04', storage)).toEqual(['m1', 'm2', 'm3']);
    expect(loadSelection('basketball', '2026-08-04', storage)).toEqual([]);
  });

  it('toggles a match in and out', () => {
    expect(toggleSelection('football', 'd1', 'm1', storage)).toEqual({ selection: ['m1'], capped: false });
    expect(toggleSelection('football', 'd1', 'm1', storage)).toEqual({ selection: [], capped: false });
  });

  it('caps selection at the maximum and reports the cap', () => {
    const ids = Array.from({ length: PREDICTOR_MAX_SELECTIONS }, (_, i) => `m${i}`);
    saveSelection('football', 'd1', ids, storage);

    const result = toggleSelection('football', 'd1', 'overflow', storage);
    expect(result.capped).toBe(true);
    expect(result.selection).toHaveLength(PREDICTOR_MAX_SELECTIONS);
    expect(result.selection).not.toContain('overflow');
  });

  it('never exceeds the cap when saving directly', () => {
    const many = Array.from({ length: PREDICTOR_MAX_SELECTIONS + 25 }, (_, i) => `m${i}`);
    saveSelection('tennis', 'd2', many, storage);
    expect(loadSelection('tennis', 'd2', storage)).toHaveLength(PREDICTOR_MAX_SELECTIONS);
  });

  it('prunes dangling match ids against the valid set', () => {
    saveSelection('hockey', 'd3', ['a', 'b', 'c'], storage);
    const pruned = pruneSelection('hockey', 'd3', ['b', 'c'], storage);
    expect(pruned).toEqual(['b', 'c']);
    expect(loadSelection('hockey', 'd3', storage)).toEqual(['b', 'c']);
  });

  it('clearSelection removes persisted state', () => {
    saveSelection('rally', 'd4', ['x'], storage);
    clearSelection('rally', 'd4', storage);
    expect(loadSelection('rally', 'd4', storage)).toEqual([]);
    expect(storage.getItem(selectionKey('rally', 'd4'))).toBeNull();
  });

  it('scopes keys by sport and day', () => {
    expect(selectionKey('football', '2026-08-04')).toContain('football.2026-08-04');
    expect(selectionKey('football', '2026-08-04')).not.toBe(selectionKey('basketball', '2026-08-04'));
  });

  it('tolerates corrupt stored JSON', () => {
    storage.setItem(selectionKey('football', 'd5'), '{not-json');
    expect(loadSelection('football', 'd5', storage)).toEqual([]);
  });

  it('returns an empty selection when storage is null', () => {
    expect(loadSelection('football', 'd6', null)).toEqual([]);
  });
});
