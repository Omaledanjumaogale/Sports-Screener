// 12-hourly cache cycle for the AI Predictor. Emeka Obi's scheduled duty: purge
// stale predictor days and refresh the day cache for every real sport twice a
// day (00:00 and 12:00 WAT) so projections stay current for all sports.

import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Every 24h purge days older than 7 days.
crons.interval('predictor-purge-daily', { minutes: 1440 }, internal.predictor.purgeAndMarkStale, {});

// Refresh each sport's day cache at 12-hourly cadence: 00:00 and 12:00 WAT
// (UTC+1), which is 23:00 and 11:00 UTC. Staggered minute offsets keep the six
// refreshes (plus scrubbing work per sport) from clashing with each other.
const SPORTS = ['football', 'basketball', 'tennis', 'rally', 'hockey', 'baseball'];

// Two cycles per sport share the same minute offset so they don't overlap.
const SCHEDULES = [
  { name: 'predictor-refresh-midnight', hourUTC: 23 }, // 00:00 WAT
  { name: 'predictor-refresh-noon', hourUTC: 11 }      // 12:00 WAT
];

SPORTS.forEach((sport, i) => {
  SCHEDULES.forEach((s) => {
    crons.daily(
      `${s.name}-${sport}`,
      { hourUTC: s.hourUTC, minuteUTC: 2 + i * 8 },
      internal.predictorOrchestrator.runRefreshInternal,
      { sportId: sport as any, dayKey: '', floor: 60 }
    );
  });
});

export default crons;
