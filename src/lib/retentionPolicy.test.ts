import { describe, it, expect } from 'vitest';
import { retentionDaysFromEnv, isStaleFinishedMatch } from '../../convex/retentionPolicy';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 11, 12, 0, 0); // 2026-08-11 12:00 UTC
const CUTOFF = NOW - 2 * DAY; // a 2-day retention window

describe('retentionDaysFromEnv', () => {
  it('0 / unset / invalid = keep everything forever (default policy)', () => {
    expect(retentionDaysFromEnv({})).toBe(0);
    expect(retentionDaysFromEnv({ PREDICTOR_RETENTION_DAYS: '0' })).toBe(0);
    expect(retentionDaysFromEnv({ PREDICTOR_RETENTION_DAYS: '-5' })).toBe(0);
    expect(retentionDaysFromEnv({ PREDICTOR_RETENTION_DAYS: 'abc' })).toBe(0);
    expect(retentionDaysFromEnv({ PREDICTOR_RETENTION_DAYS: '  ' })).toBe(0);
  });
  it('parses a positive integer policy and floors fractions', () => {
    expect(retentionDaysFromEnv({ PREDICTOR_RETENTION_DAYS: '7' })).toBe(7);
    expect(retentionDaysFromEnv({ PREDICTOR_RETENTION_DAYS: '2.9' })).toBe(2);
  });
});

describe('isStaleFinishedMatch — purge selects ONLY outdated finished matches', () => {
  const finishedOld = { status: 'finished', finalScore: '2 - 1', startTime: NOW - 3 * DAY };
  const finishedRecent = { status: 'finished', finalScore: '1 - 0', startTime: NOW - 1 * DAY };

  it('purges a finished match that started before the cutoff', () => {
    expect(isStaleFinishedMatch(finishedOld, CUTOFF)).toBe(true);
  });
  it('keeps a finished match that started at or after the cutoff', () => {
    expect(isStaleFinishedMatch(finishedRecent, CUTOFF)).toBe(false);
    expect(isStaleFinishedMatch({ ...finishedOld, startTime: CUTOFF }, CUTOFF)).toBe(false); // boundary: strictly before
  });
  it('NEVER purges upcoming or in-play matches, however old', () => {
    expect(isStaleFinishedMatch({ status: 'upcoming', startTime: NOW - 30 * DAY }, CUTOFF)).toBe(false);
    expect(isStaleFinishedMatch({ status: 'inplay', startTime: NOW - 30 * DAY }, CUTOFF)).toBe(false);
  });
  it('treats a stored finalScore as finished even when the status field lags', () => {
    expect(isStaleFinishedMatch({ status: 'upcoming', finalScore: '3 - 3', startTime: NOW - 4 * DAY }, CUTOFF)).toBe(true);
  });
  it('keeps finished rows that never kicked off (startTime unset/0)', () => {
    expect(isStaleFinishedMatch({ status: 'finished', finalScore: '1 - 1', startTime: 0 }, CUTOFF)).toBe(false);
    expect(isStaleFinishedMatch({ status: 'finished', finalScore: '1 - 1' }, CUTOFF)).toBe(false);
  });
  it('keeps unfinished rows with no scoreline', () => {
    expect(isStaleFinishedMatch({ status: 'inplay', startTime: NOW - 5 * DAY }, CUTOFF)).toBe(false);
    expect(isStaleFinishedMatch({ status: 'upcoming', startTime: NOW + DAY }, CUTOFF)).toBe(false);
  });
});
