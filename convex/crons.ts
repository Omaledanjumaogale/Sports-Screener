// Scheduled cache cycle for the AI Predictor. Emeka Obi's scheduled duty: purge
// stale predictor days and refresh the day cache for every sport once a day at
// midnight WAT so projections stay current.
//
// STORAGE-BUDGET NOTE: this file is sized for the FREE Convex plan. Every cron
// job costs DB reads + writes; every refresh mutates the day row and writes one
// verdict per qualified match. The historical 18-job / 3-refresh-per-day cadence
// accumulated GB of finished matches + verdicts until Convex disabled the
// deployment. We now run ONE daily refresh (midnight WAT) plus the scoring and
// housekeeping jobs, and rely on the bounded hygiene sweep to drop finished
// rows past the retention window.
//
// Keep this module dependency-light: Convex's analyzer EXECUTES the module body
// to read the cron definitions, so a heavy/toErroring import would abort the
// whole file and silently register zero jobs.

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
const FLOOR = 52;
const CAP = 1200;

// ── Daily purge — once per 24h, scans for stale day rows ───────────────────────
crons.interval('predictor-purge-daily', { minutes: 1440 }, internal.predictor.purgeAndMarkStale, {});

// ── Midnight West Africa Time cache refresh — 5 sports, single daily pass ─────
// One pass per sport at 00:02 WAT = 23:02 UTC. Staggered by 8 minutes to avoid
// simultaneous heavy LLM/API bursts. Morning + noon passes were removed in the
// storage-cut pass — the morning list is updated by live score sync and the
// noon pass was duplicating work the cache already contained.
crons.daily('predictor-refresh-football',   { hourUTC: 23, minuteUTC: 2  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'football',   dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-basketball', { hourUTC: 23, minuteUTC: 10 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'basketball', dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-tennis',     { hourUTC: 23, minuteUTC: 18 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'tennis',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-hockey',     { hourUTC: 23, minuteUTC: 26 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'hockey',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-baseball',   { hourUTC: 23, minuteUTC: 34 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'baseball',   dayKey: '', floor: FLOOR, cap: CAP });

// ── Live scoreline synchronization — every 30 minutes (was 15) ────────────────
// Doubled the interval to halve IO; the UI is per-session, half-hour updates
// are still responsive enough for in-play cards.
crons.interval('predictor-sync-live-scores', { minutes: 30 }, internal.scores.syncScoresAction, {});

// ── Past match history & outcome settlement — every 6 hours (was 30-day) ───────
crons.interval('predictor-sync-past-history', { minutes: 360 }, internal.scores.syncPastHistoryAction, {});

// ── AI performance data bank — every 6 hours (was hourly) ─────────────────────
// Re-derives today's accuracy / calibration / Great-Minds / verdict-ranking
// snapshot and the lifetime aggregate from stored results. Every-6-hours keeps
// the data bank fresh without paying hourly recompute IO.
crons.interval('predictor-stats-snapshot', { minutes: 360 }, internal.predictorStats.recomputeStatsSnapshot, {});

// ── Accumulative bet-slip grading — hourly (was 30 min) ────────────────────────
// Halves the IO of grading; legs are still graded on the same day.
crons.interval('betslip-grading', { minutes: 60 }, internal.betSlips.gradeSlipItems, {});

// ── Realtime presence sweep — every 10 minutes ───────────────────────────────
// Removes heartbeat rows older than the presence window so the online counter
// stays accurate and the table never accumulates stale sessions.
crons.interval('presence-sweep', { minutes: 10 }, internal.presence.sweepStalePresence, {});

// ── Finished-match retention — daily + every 6 hours (was hourly) ─────────────
// PREDICTOR_RETENTION_DAYS is the primary knob; the 6-hourly pass guarantees
// sub-day catch-up for any rows aged out between the daily job.
crons.daily('predictor-retention-finished', { hourUTC: 3, minuteUTC: 30 }, internal.retention.purgeFinishedMatchesAction, {});
crons.interval('predictor-retention-periodic', { minutes: 360 }, internal.retention.purgeFinishedMatchesAction, {});

// ── Database hygiene sweep — every 6 hours, bounded & incremental ─────────────
// Each pass deletes at most ~1200 expired/over-retention rows (oldest days
// first) using indexed per-day reads. 6-hourly keeps the deployment flat without
// running the sweep so often that it competes with refresh IO.
crons.interval('db-hygiene-sweep', { minutes: 360 }, internal.hygiene.hygieneSweepAction, {});

// ── Subscription-expiry enforcement — every 6 hours ───────────────────────────
crons.interval('subscription-expiry-enforce', { minutes: 360 }, internal.users.expireLapsedSubscriptions, {});

export default crons;