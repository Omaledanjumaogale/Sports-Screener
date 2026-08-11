// Scheduled cache cycle for the AI Predictor. Emeka Obi's scheduled duty: purge
// stale predictor days and refresh the day cache for every sport three times a
// day (1:00 AM WAT, 7:00 AM WAT & 1:00 PM WAT) so projections stay current.
//
// Keep this module dependency-light: Convex's analyzer EXECUTES the module body
// to read the cron definitions, so a heavy/toErroring import would abort the
// whole file and silently register zero jobs.

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
const FLOOR = 52;
const CAP = 1200;

// ── Daily purge ───────────────────────────────────────────────────────────────
// Every 24h purge stale days older than 7 days.
crons.interval('predictor-purge-daily', { minutes: 1440 }, internal.predictor.purgeAndMarkStale, {});

// ── Midnight West Africa Time (1:00 AM WAT / 00:00 WAT) cache refresh — all 11 sports ─
// Staggered by 8 minutes to avoid simultaneous heavy LLM/API bursts.
crons.daily('predictor-refresh-midnight-football',   { hourUTC: 23, minuteUTC: 2  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'football',   dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-basketball', { hourUTC: 23, minuteUTC: 10 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'basketball', dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-tennis',     { hourUTC: 23, minuteUTC: 18 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'tennis',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-rally',      { hourUTC: 23, minuteUTC: 26 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rally',      dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-hockey',     { hourUTC: 23, minuteUTC: 34 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'hockey',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-baseball',   { hourUTC: 23, minuteUTC: 42 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'baseball',   dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-americanfootball', { hourUTC: 23, minuteUTC: 50 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'americanfootball', dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-rugby',      { hourUTC: 23, minuteUTC: 58 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rugby',      dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-cricket',    { hourUTC: 0, minuteUTC: 6  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'cricket',    dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-mma',        { hourUTC: 0, minuteUTC: 14 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'mma',        dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-midnight-volleyball', { hourUTC: 0, minuteUTC: 22 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'volleyball', dayKey: '', floor: FLOOR, cap: CAP });

// ── Afternoon West Africa Time (1:00 PM WAT) cache refresh — all 11 sports ─────
// Midday pass keeps predictions fresh for afternoon/evening match windows.
crons.daily('predictor-refresh-noon-football',   { hourUTC: 11, minuteUTC: 2  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'football',   dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-basketball', { hourUTC: 11, minuteUTC: 10 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'basketball', dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-tennis',     { hourUTC: 11, minuteUTC: 18 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'tennis',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-rally',      { hourUTC: 11, minuteUTC: 26 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rally',      dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-hockey',     { hourUTC: 11, minuteUTC: 34 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'hockey',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-baseball',   { hourUTC: 11, minuteUTC: 42 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'baseball',   dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-americanfootball', { hourUTC: 11, minuteUTC: 50 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'americanfootball', dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-rugby',      { hourUTC: 11, minuteUTC: 58 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rugby',      dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-cricket',    { hourUTC: 12, minuteUTC: 6  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'cricket',    dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-mma',        { hourUTC: 12, minuteUTC: 14 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'mma',        dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-refresh-noon-volleyball', { hourUTC: 12, minuteUTC: 22 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'volleyball', dayKey: '', floor: FLOOR, cap: CAP });

// ── Morning West Africa Time (7:00 AM WAT) early seed ──────────────────────────
// 7:00 AM WAT seed ensures morning users see today's matches populated early.
crons.daily('predictor-seed-morning-football',   { hourUTC: 6, minuteUTC: 2  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'football',   dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-basketball', { hourUTC: 6, minuteUTC: 10 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'basketball', dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-tennis',     { hourUTC: 6, minuteUTC: 18 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'tennis',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-rally',      { hourUTC: 6, minuteUTC: 26 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rally',      dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-hockey',     { hourUTC: 6, minuteUTC: 34 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'hockey',     dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-baseball',   { hourUTC: 6, minuteUTC: 42 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'baseball',   dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-americanfootball', { hourUTC: 6, minuteUTC: 50 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'americanfootball', dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-rugby',      { hourUTC: 6, minuteUTC: 58 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rugby',      dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-cricket',    { hourUTC: 7, minuteUTC: 6  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'cricket',    dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-mma',        { hourUTC: 7, minuteUTC: 14 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'mma',        dayKey: '', floor: FLOOR, cap: CAP });
crons.daily('predictor-seed-morning-volleyball', { hourUTC: 7, minuteUTC: 22 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'volleyball', dayKey: '', floor: FLOOR, cap: CAP });


// ── Live scoreline synchronization — every 5 minutes ──────────────────────────
// Synchronizes real-time live scorelines and score updates for today's active
// matches across all sports so the application UI stays current in real time.
crons.interval('predictor-sync-live-scores', { minutes: 5 }, internal.scores.syncScoresAction, {});

// ── Past match history & outcome settlement — every 3 hours ────────────────────
// Scans completed matches from past days, fetches final scorelines, updates match
// statuses to 'finished', and settles PnL historical summaries.
crons.interval('predictor-sync-past-history', { minutes: 180 }, internal.scores.syncPastHistoryAction, {});

// ── Finished-match retention — daily ───────────────────────────────────────────
// Completed games accumulate indefinitely by default. When PREDICTOR_RETENTION_DAYS
// is configured, outdated finished matches (and their verdicts) are wiped once a
// day per the retention policy; otherwise this job is a no-op.
crons.daily('predictor-retention-finished', { hourUTC: 3, minuteUTC: 30 }, internal.retention.purgeFinishedMatchesAction, {});

export default crons;