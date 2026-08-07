// 12-hourly cache cycle for the AI Predictor. Emeka Obi's scheduled duty: purge
// stale predictor days and refresh the day cache for every real sport twice a
// day (00:00 and 12:00 UTC) so projections stay current for all sports.
//
// Keep this module dependency-light: Convex's analyzer EXECUTES the module body
// to read the cron definitions, so a heavy/toErroring import would abort the
// whole file and silently register zero jobs.

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();
const FLOOR = 52;

// ── Daily purge ───────────────────────────────────────────────────────────────
// Every 24h purge stale days older than 7 days. Uses internalAction so it can
// call the purgeOld mutation from within a Convex action context.
crons.interval('predictor-purge-daily', { minutes: 1440 }, internal.predictor.purgeAndMarkStale, {});

// ── Midnight UTC cache refresh — all six sports ───────────────────────────────
// Staggered by 8 minutes to avoid simultaneous heavy LLM/API bursts. The empty
// dayKey string is resolved inside executeRefresh to today's UTC date.
crons.daily('predictor-refresh-midnight-football',   { hourUTC: 23, minuteUTC: 2  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'football',   dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-midnight-basketball', { hourUTC: 23, minuteUTC: 10 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'basketball', dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-midnight-tennis',     { hourUTC: 23, minuteUTC: 18 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'tennis',     dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-midnight-rally',      { hourUTC: 23, minuteUTC: 26 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rally',      dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-midnight-hockey',     { hourUTC: 23, minuteUTC: 34 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'hockey',     dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-midnight-baseball',   { hourUTC: 23, minuteUTC: 42 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'baseball',   dayKey: '', floor: FLOOR });

// ── Noon UTC cache refresh — all six sports ────────────────────────────────────
// Noon pass keeps the day fresh for the afternoon/evening window.
crons.daily('predictor-refresh-noon-football',   { hourUTC: 11, minuteUTC: 2  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'football',   dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-noon-basketball', { hourUTC: 11, minuteUTC: 10 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'basketball', dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-noon-tennis',     { hourUTC: 11, minuteUTC: 18 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'tennis',     dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-noon-rally',      { hourUTC: 11, minuteUTC: 26 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rally',      dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-noon-hockey',     { hourUTC: 11, minuteUTC: 34 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'hockey',     dayKey: '', floor: FLOOR });
crons.daily('predictor-refresh-noon-baseball',   { hourUTC: 11, minuteUTC: 42 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'baseball',   dayKey: '', floor: FLOOR });

// ── Morning UTC early seed ─────────────────────────────────────────────────────
// 06:00 UTC seed so users in African morning sessions see today's matches already
// populated, without having to wait for the noon refresh.
crons.daily('predictor-seed-morning-football',   { hourUTC: 6, minuteUTC: 2  }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'football',   dayKey: '', floor: FLOOR });
crons.daily('predictor-seed-morning-basketball', { hourUTC: 6, minuteUTC: 10 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'basketball', dayKey: '', floor: FLOOR });
crons.daily('predictor-seed-morning-tennis',     { hourUTC: 6, minuteUTC: 18 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'tennis',     dayKey: '', floor: FLOOR });
crons.daily('predictor-seed-morning-rally',      { hourUTC: 6, minuteUTC: 26 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'rally',      dayKey: '', floor: FLOOR });
crons.daily('predictor-seed-morning-hockey',     { hourUTC: 6, minuteUTC: 34 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'hockey',     dayKey: '', floor: FLOOR });
crons.daily('predictor-seed-morning-baseball',   { hourUTC: 6, minuteUTC: 42 }, internal.predictorOrchestrator.runRefreshInternal, { sportId: 'baseball',   dayKey: '', floor: FLOOR });

export default crons;