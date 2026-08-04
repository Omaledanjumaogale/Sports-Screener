// Midnight cache cycle for the AI Predictor. Emeka Obi's scheduled duty: purge
// stale predictor days and refresh the next day's cache for every real sport.

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Every 24h purge days older than 7 days.
crons.interval('predictor-purge-daily', { minutes: 1440 }, internal.predictor.purgeAndMarkStale, {});

// Refresh each sport's day cache between 12:00am and 01:00am WAT (UTC+1), which
// is 23:00–24:00 UTC the previous day. Staggered minute offsets keep the six
// refreshes (plus scrubbing work per sport) from clashing with each other.
const SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball'];

SPORTS.forEach((sport, i) => {
  crons.daily(
    `predictor-refresh-${sport}`,
    { hourUTC: 23, minuteUTC: 2 + i * 8 },
    internal.predictorOrchestrator.runRefreshInternal,
    { sportId: sport as any, dayKey: '', floor: 60 }
  );
});

export default crons;
