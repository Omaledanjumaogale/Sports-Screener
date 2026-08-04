// Midnight cache cycle for the AI Predictor. Emeka Obi's scheduled duty: purge
// stale predictor days and refresh the next day's cache for every real sport.

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Every 24h purge days older than 7 days.
crons.interval('predictor-purge-daily', { minutes: 1440 }, internal.predictor.purgeAndMarkStale, {});

// Refresh each sport's day cache just after midnight so the morning browse is
// pre-cached. Minute offsets keep the six refreshes from clashing.
const SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball'];

SPORTS.forEach((sport, i) => {
  crons.daily(
    `predictor-refresh-${sport}`,
    { hourUTC: 0, minuteUTC: 12 + i * 6 },
    internal.predictorOrchestrator.runRefreshInternal,
    { sportId: sport as any, dayKey: '', floor: 60 }
  );
});

export default crons;
