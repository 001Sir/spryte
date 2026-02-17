const KEY_PREFIX = 'spryte-highscore-';

export function getHighScore(gameSlug: string): number {
  try {
    const val = localStorage.getItem(`${KEY_PREFIX}${gameSlug}`);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setHighScore(gameSlug: string, score: number): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${gameSlug}`, String(score));
  } catch {
    /* ignore */
  }
}
