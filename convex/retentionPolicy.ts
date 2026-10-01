// ── Retention policy decision helpers (pure, unit-testable) ───────────────────
// No Convex imports in this module so vitest can prove the purge selection
// logic directly — without ever running a destructive cron against production
// data. convex/retention.ts wires these into the actual mutation/action.
//
// FREE-PLAN BUDGET NOTE: the historical default kept everything forever. That
// accumulated GBs and disabled the deployment. Defaults here are aggressive
// but overridable by env. PREDICTOR_RETENTION_DAYS=7 /
// PREDICTOR_VERDICT_RETENTION_DAYS=3 are the production defaults.

export const DEFAULT_MATCH_RETENTION_DAYS = 7;
export const DEFAULT_VERDICT_RETENTION_DAYS = 3;

/**
 * Configured retention window in MILLISECONDS for FINISHED matches, parsed
 * from an env bag. Accepts fractional days (0.5 = 12h) or an explicit
 * RETENTION_HOURS env. Returns the default when no valid policy is configured.
 */
export function retentionMsFromEnv(env: Record<string, string | undefined>): number {
  const rawHours = env?.RETENTION_HOURS?.trim();
  if (rawHours) {
    const h = Number(rawHours);
    if (Number.isFinite(h) && h > 0) return Math.floor(h * 3_600_000);
  }
  const raw = env?.PREDICTOR_RETENTION_DAYS?.trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n * 86_400_000);
  // Aggressive default — keeps the deployment under the free-plan budget.
  return DEFAULT_MATCH_RETENTION_DAYS * 86_400_000;
}

export function retentionDaysFromEnv(env: Record<string, string | undefined>): number {
  const raw = env?.PREDICTOR_RETENTION_DAYS?.trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_MATCH_RETENTION_DAYS;
}

/**
 * Verdicts are the largest payloads in the DB (aiReport + debate JSON).
 * They get a SHORTER retention window than the matches themselves — once a
 * match is finished and graded, the verdict only needs to live long enough to
 * power the day's data-bank recompute, not forever.
 */
export function verdictRetentionMsFromEnv(env: Record<string, string | undefined>): number {
  const raw = env?.PREDICTOR_VERDICT_RETENTION_DAYS?.trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n * 86_400_000);
  return DEFAULT_VERDICT_RETENTION_DAYS * 86_400_000;
}

export function verdictRetentionDaysFromEnv(env: Record<string, string | undefined>): number {
  const raw = env?.PREDICTOR_VERDICT_RETENTION_DAYS?.trim();
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return DEFAULT_VERDICT_RETENTION_DAYS;
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

/**
 * Whether a verdict should be purged under the verdict retention window —
 * verdicts may outlast their match (kept around for re-grading) but never
 * forever. The verdict's last `updatedAt` is the natural clock.
 */
export function isStaleVerdict(updatedAt: number, cutoff: number): boolean {
  if (!updatedAt || updatedAt <= 0) return false;
  return updatedAt < cutoff;
}
