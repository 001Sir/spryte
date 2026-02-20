import { describe, it, expect, beforeEach, vi } from 'vitest';
import { startSession, endSession, getStats, getGameStats } from '../stats';

describe('stats', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty stats initially', () => {
    const stats = getStats();
    expect(stats.global.totalSessions).toBe(0);
    expect(stats.global.totalTimeMs).toBe(0);
    expect(stats.global.gamesPlayed).toEqual([]);
    expect(Object.keys(stats.perGame)).toHaveLength(0);
  });

  it('tracks a session', () => {
    const id = startSession('test-game');
    endSession(id, 100, true, 3);

    const stats = getStats();
    expect(stats.global.totalSessions).toBe(1);
    expect(stats.global.gamesPlayed).toContain('test-game');
    expect(stats.perGame['test-game'].sessions).toBe(1);
    expect(stats.perGame['test-game'].highScore).toBe(100);
    expect(stats.perGame['test-game'].bestLevel).toBe(3);
    expect(stats.perGame['test-game'].completions).toBe(1);
  });

  it('tracks high score correctly', () => {
    const id1 = startSession('test-game');
    endSession(id1, 200, true);

    const id2 = startSession('test-game');
    endSession(id2, 100, true);

    const gs = getGameStats('test-game');
    expect(gs?.highScore).toBe(200); // keeps the higher score
  });

  it('tracks multiple games separately', () => {
    const id1 = startSession('game-a');
    endSession(id1, 50, true);

    const id2 = startSession('game-b');
    endSession(id2, 75, false);

    const stats = getStats();
    expect(stats.global.totalSessions).toBe(2);
    expect(stats.global.gamesPlayed).toHaveLength(2);
    expect(stats.perGame['game-a'].highScore).toBe(50);
    expect(stats.perGame['game-b'].highScore).toBe(75);
    expect(stats.perGame['game-b'].completions).toBe(0);
  });

  it('returns null for unknown game stats', () => {
    expect(getGameStats('nonexistent')).toBeNull();
  });

  it('ignores endSession for unknown session ID', () => {
    endSession('fake-id', 100, true);
    const stats = getStats();
    expect(stats.global.totalSessions).toBe(0);
  });

  it('dispatches stats-updated event', () => {
    const handler = vi.fn();
    window.addEventListener('spryte:stats-updated', handler);

    const id = startSession('test-game');
    endSession(id, 100, true);

    expect(handler).toHaveBeenCalled();
    window.removeEventListener('spryte:stats-updated', handler);
  });
});
