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
const CAP = 1200;

// ── Daily purge ───────────────────────────────────────────────────────────────
// Every 24h purge stale days older than 7 days. Uses internalAction so it can
// call the purgeOld mutation from within a Convex action context.
crons.interval('predictor-purge-daily', { minutes: 1440 }, internal.predictor.purgeAndMarkStale, {});

// ── Midnight UTC cache refresh — all six sports ───────────────────────────────
// Staggered by 8 minutes to avoid simultaneous heavy LLM/API bursts. The empty
// dayKey string is resolved inside executeRefresh to today's UTC date.
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

// ── Noon UTC cache refresh — all six sports ────────────────────────────────────
// Noon pass keeps the day fresh for the afternoon/evening window.
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

// ── Morning UTC early seed ─────────────────────────────────────────────────────
// 06:00 UTC seed so users in African morning sessions see today's matches already
// populated, without having to wait for the noon refresh.
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

export default crons;