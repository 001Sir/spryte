import { describe, it, expect, beforeEach } from 'vitest';
import { checkNewAchievements, getAllAchievements, getEarnedAchievements } from '../achievements';
import type { StatsData } from '../stats';

function makeStats(overrides?: Partial<StatsData>): StatsData {
  return {
    perGame: {},
    global: { totalSessions: 0, totalTimeMs: 0, gamesPlayed: [] },
    ...overrides,
  };
}

describe('achievements', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has a complete list of achievements', () => {
    const all = getAllAchievements();
    expect(all.length).toBeGreaterThanOrEqual(30);
  });

  it('returns no earned achievements initially', () => {
    expect(Object.keys(getEarnedAchievements())).toHaveLength(0);
  });

  it('earns first-steps after 1 session', () => {
    const stats = makeStats({ global: { totalSessions: 1, totalTimeMs: 1000, gamesPlayed: ['drift'] } });
    const earned = checkNewAchievements(stats);
    const ids = earned.map((a) => a.id);
    expect(ids).toContain('first-steps');
  });

  it('earns per-game score achievement', () => {
    const stats = makeStats({
      perGame: {
        'gravity-well': {
          sessions: 5,
          totalTimeMs: 10000,
          highScore: 600,
          bestLevel: 3,
          completions: 5,
          firstPlayed: Date.now(),
          lastPlayed: Date.now(),
        },
      },
      global: { totalSessions: 5, totalTimeMs: 10000, gamesPlayed: ['gravity-well'] },
    });
    const earned = checkNewAchievements(stats);
    const ids = earned.map((a) => a.id);
    expect(ids).toContain('gw-scorer');
  });

  it('does not re-earn achievements', () => {
    const stats = makeStats({ global: { totalSessions: 1, totalTimeMs: 1000, gamesPlayed: ['drift'] } });
    const earned1 = checkNewAchievements(stats);
    expect(earned1.some((a) => a.id === 'first-steps')).toBe(true);

    const earned2 = checkNewAchievements(stats);
    expect(earned2.some((a) => a.id === 'first-steps')).toBe(false);
  });

  it('earns dedicated achievement at 50 sessions', () => {
    const stats = makeStats({
      global: { totalSessions: 50, totalTimeMs: 100000, gamesPlayed: ['drift'] },
    });
    const earned = checkNewAchievements(stats);
    const ids = earned.map((a) => a.id);
    expect(ids).toContain('dedicated');
  });

  it('earns daily challenge achievements with extras', () => {
    const stats = makeStats({ global: { totalSessions: 1, totalTimeMs: 1000, gamesPlayed: ['drift'] } });
    const earned = checkNewAchievements(stats, { streak: 7, completedDays: 7 });
    const ids = earned.map((a) => a.id);
    expect(ids).toContain('first-challenge');
    expect(ids).toContain('week-warrior');
  });
});
