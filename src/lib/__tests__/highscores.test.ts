import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getHighScore, setHighScore } from '../highscores';

describe('highscores', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 0 for unknown game', () => {
    expect(getHighScore('nonexistent')).toBe(0);
  });

  it('stores and retrieves high score', () => {
    setHighScore('test-game', 500);
    expect(getHighScore('test-game')).toBe(500);
  });

  it('overwrites previous score', () => {
    setHighScore('test-game', 100);
    setHighScore('test-game', 200);
    expect(getHighScore('test-game')).toBe(200);
  });

  it('handles localStorage errors gracefully', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(getHighScore('test-game')).toBe(0);
    spy.mockRestore();
  });

  it('uses correct key prefix', () => {
    setHighScore('drift', 999);
    expect(localStorage.getItem('spryte-highscore-drift')).toBe('999');
  });
});
