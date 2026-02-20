import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDailyChallenge,
  completeDailyChallenge,
  getDailyChallengeStatus,
  getStreak,
  getCompletedDays,
} from '../daily-challenge';

describe('daily-challenge', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns deterministic challenge for same date', () => {
    const date = new Date('2026-02-20');
    const c1 = getDailyChallenge(date);
    const c2 = getDailyChallenge(date);
    expect(c1.id).toBe(c2.id);
    expect(c1.gameSlug).toBe(c2.gameSlug);
    expect(c1.target).toBe(c2.target);
  });

  it('returns different challenges for different dates', () => {
    const c1 = getDailyChallenge(new Date('2026-01-01'));
    const c2 = getDailyChallenge(new Date('2026-06-15'));
    // At least one field should differ (technically could collide but extremely unlikely)
    const differ = c1.gameSlug !== c2.gameSlug || c1.target !== c2.target || c1.type !== c2.type;
    expect(differ).toBe(true);
  });

  it('has proper challenge structure', () => {
    const c = getDailyChallenge();
    expect(c.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(c.gameSlug).toBeTruthy();
    expect(c.gameTitle).toBeTruthy();
    expect(c.description).toBeTruthy();
    expect(['score', 'level', 'completion']).toContain(c.type);
    expect(c.target).toBeGreaterThan(0);
  });

  it('marks challenge as completed', () => {
    const c = getDailyChallenge();
    expect(getDailyChallengeStatus(c.id)).toBe(false);
    completeDailyChallenge(c.id);
    expect(getDailyChallengeStatus(c.id)).toBe(true);
  });

  it('tracks completed days', () => {
    completeDailyChallenge('2026-02-01');
    completeDailyChallenge('2026-02-02');
    const days = getCompletedDays();
    expect(days).toHaveLength(2);
    expect(days).toContain('2026-02-01');
    expect(days).toContain('2026-02-02');
  });

  it('calculates streak correctly', () => {
    // Complete today
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    completeDailyChallenge(todayStr);
    expect(getStreak()).toBe(1);
  });

  it('streak is 0 when no challenges completed', () => {
    expect(getStreak()).toBe(0);
  });
});
