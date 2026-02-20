const KEY_PREFIX = 'spryte-playcount-';

export function getPlayCount(gameSlug: string): number {
  try {
    const val = localStorage.getItem(`${KEY_PREFIX}${gameSlug}`);
    return val ? parseInt(val, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function incrementPlayCount(gameSlug: string): number {
  try {
    const current = getPlayCount(gameSlug);
    const next = current + 1;
    localStorage.setItem(`${KEY_PREFIX}${gameSlug}`, String(next));
    return next;
  } catch {
    return 0;
  }
}
