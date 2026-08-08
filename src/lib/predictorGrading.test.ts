import { describe, it, expect } from 'vitest';
import { parseFinScore, gradeSelection, isTotalMarket, isSpreadMarket, isWinnerMarket } from './predictorTypes';

describe('parseFinScore', () => {
  it('parses a per-sport "home-away" scoreline', () => {
    expect(parseFinScore('2-1')).toEqual({ home: 2, away: 1 });
  });

  it('handles ties and single digits', () => {
    expect(parseFinScore('1-1')).toEqual({ home: 1, away: 1 });
    expect(parseFinScore('0-0')).toEqual({ home: 0, away: 0 });
  });

  it('returns null for missing or prose values', () => {
    expect(parseFinScore(null)).toBeNull();
    expect(parseFinScore('')).toBeNull();
    expect(parseFinScore('abandoned')).toBeNull();
  });

  it('tolerates whitespace', () => {
    expect(parseFinScore(' 3 - 2 ')).toEqual({ home: 3, away: 2 });
  });
});

describe('market family helpers', () => {
  it('recognizes winner/moneyline markets', () => {
    expect(isWinnerMarket('moneyline')).toBe(true);
    expect(isWinnerMarket('result')).toBe(true);
    expect(isWinnerMarket('matchWinner')).toBe(true);
    expect(isWinnerMarket('over/under')).toBe(false);
  });

  it('recognizes spread/handicap markets', () => {
    expect(isSpreadMarket('handicap')).toBe(true);
    expect(isSpreadMarket('pointsHandicap')).toBe(true);
    expect(isSpreadMarket('runline')).toBe(true);
    expect(isSpreadMarket('total')).toBe(false);
  });

  it('recognizes totals', () => {
    expect(isTotalMarket('mainTotal')).toBe(true);
    expect(isTotalMarket('gameTotal')).toBe(true);
    expect(isTotalMarket('homeTotal')).toBe(true);
  });
});

describe('gradeSelection', () => {
  it('grades a home winner moneyline pick', () => {
    expect(gradeSelection('Team Alpha', 'moneyline', '2-1', { homeTeam: 'Team Alpha', awayTeam: 'Team Beta' })).toBe('win');
    expect(gradeSelection('Team Alpha', 'moneyline', '0-1', { homeTeam: 'Team Alpha', awayTeam: 'Team Beta' })).toBe('loss');
  });

  it('grades an away winner moneyline pick', () => {
    expect(gradeSelection('Team Beta', 'result', '0-1', { homeTeam: 'Team Alpha', awayTeam: 'Team Beta' })).toBe('win');
    expect(gradeSelection('Team Beta', 'result', '1-0', { homeTeam: 'Team Alpha', awayTeam: 'Team Beta' })).toBe('loss');
  });

  it('grades a draw pick as win only on a tie', () => {
    expect(gradeSelection('Draw', 'result', '1-1', { homeTeam: 'Team Alpha', awayTeam: 'Team Beta' })).toBe('win');
    expect(gradeSelection('Draw', 'result', '2-1', { homeTeam: 'Team Alpha', awayTeam: 'Team Beta' })).toBe('loss');
  });

  it('grades main totals as win/push/loss', () => {
    expect(gradeSelection('Over 2.5 Goals', 'mainTotal', '2-1')).toBe('win');
    expect(gradeSelection('Under 2.5 Goals', 'mainTotal', '2-1')).toBe('loss');
    expect(gradeSelection('Over 3 Goals', 'mainTotal', '2-1')).toBe('push');
    expect(gradeSelection('Over 2.5 Goals', 'mainTotal', '0-0')).toBe('loss');
  });

  it('grades team totals against the named side', () => {
    expect(gradeSelection('Over 1.5 Goals', 'homeTotal', '2-1')).toBe('win');
    expect(gradeSelection('Over 1.5 Goals', 'awayTotal', '2-1')).toBe('loss');
  });

it('grades a spread/handicap pick', () => {
    // Home -0.5 at 2-1 covers (adjusted 1.5 > 1).
    expect(gradeSelection('Home -0.5', 'handicap', '2-1', { homeTeam: 'Home', awayTeam: 'Away' })).toBe('win');
    // Home -1 exactly matches the margin at 2-1 -> push.
    expect(gradeSelection('Home -1', 'handicap', '2-1', { homeTeam: 'Home', awayTeam: 'Away' })).toBe('push');
    // Home -2 at 2-1 loses (adjusted 0 < 1).
    expect(gradeSelection('Home -2', 'handicap', '2-1', { homeTeam: 'Home', awayTeam: 'Away' })).toBe('loss');
    // Away +1 at 1-0: away adjusted 1 == home 1 -> push.
    expect(gradeSelection('Away +1', 'pointsHandicap', '1-0', { homeTeam: 'Home', awayTeam: 'Away' })).toBe('push');
    // Away +1.5 at 1-0: away adjusted 1.5 > 1 -> win.
    expect(gradeSelection('Away +1.5', 'pointsHandicap', '1-0', { homeTeam: 'Home', awayTeam: 'Away' })).toBe('win');
  });

  it('returns null when the scoreline is missing', () => {
    expect(gradeSelection('Home', 'moneyline', null, { homeTeam: 'Home', awayTeam: 'Away' })).toBeNull();
    expect(gradeSelection('Home', 'moneyline', undefined, { homeTeam: 'Home', awayTeam: 'Away' })).toBeNull();
  });

  it('returns null for an unparseable unknown selection', () => {
    expect(gradeSelection('Some rando text', 'customMarket', '2-1')).toBeNull();
  });
});