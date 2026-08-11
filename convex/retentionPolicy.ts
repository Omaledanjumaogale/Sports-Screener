// ── Retention policy decision helpers (pure, unit-testable) ───────────────────
// No Convex imports in this module so vitest can prove the purge selection
// logic directly — without ever running a destructive cron against production
// data. convex/retention.ts wires these into the actual mutation/action.

/**
 * Configured retention window in days, parsed from an env bag.
 * 0 (or unset/invalid/negative) = keep everything forever (default policy).
 */
export function retentionDaysFromEnv(env: Record<string, string | undefined>): number {
  const raw = env?.PREDICTOR_RETENTION_DAYS?.trim();
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

export interface RetentionCandidate {
  status?: string | null;
  finalScore?: string | null;
  startTime?: number;
}

/**
 * Whether a stored match should be purged under a retention policy:
 * - ONLY finished matches (explicit 'finished' status OR a stored finalScore)
 *   are eligible — upcoming/in-play rows are NEVER touched by the retention cron
 *   (that is the predictor.purgeOld stale-day sweep's job).
 * - The match must have actually kicked off (startTime > 0) and started
 *   strictly BEFORE the cutoff. A match starting at/after the cutoff survives.
 */
export function isStaleFinishedMatch(m: RetentionCandidate, cutoff: number): boolean {
  const finished = m.status === 'finished' || !!m.finalScore;
  if (!finished) return false;
  if (!m.startTime || m.startTime <= 0) return false;
  return m.startTime < cutoff;
}
