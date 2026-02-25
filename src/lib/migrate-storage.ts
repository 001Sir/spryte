/**
 * One-time migration from old scattered localStorage keys to consolidated Zustand store keys.
 * Safe to call multiple times — only runs once per browser via a migration flag.
 */

const MIGRATION_KEY = 'spryte-migration-v1';

export function migrateLocalStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    // Already migrated
    if (localStorage.getItem(MIGRATION_KEY)) return;

    // ── Migrate user prefs ──
    const existingPrefs = localStorage.getItem('spryte-user-prefs');
    if (!existingPrefs) {
      const favorites = safeJsonParse<string[]>(localStorage.getItem('spryte-favorites'), []);
      const recentlyPlayed = safeJsonParse<string[]>(localStorage.getItem('spryte-recently-played'), []);
      const soundMuted = safeJsonParse<boolean>(localStorage.getItem('spryte-sound-muted'), false);

      if (favorites.length > 0 || recentlyPlayed.length > 0 || soundMuted) {
        const prefsState = {
          state: {
            favorites,
            recentlyPlayed,
            soundMuted,
            volume: 0.7,
          },
          version: 0,
        };
        localStorage.setItem('spryte-user-prefs', JSON.stringify(prefsState));
      }
    }

    // ── Migrate game data ──
    const existingGameData = localStorage.getItem('spryte-game-data');
    if (!existingGameData) {
      const statsRaw = localStorage.getItem('spryte-stats');
      if (statsRaw) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migrating untyped legacy data
        const stats = safeJsonParse<any>(statsRaw, null);
        if (stats) {
          // Merge in any high scores from individual keys that stats might be missing
          const allKeys = Object.keys(localStorage);
          const highScoreKeys = allKeys.filter((k) => k.startsWith('spryte-highscore-'));

          for (const key of highScoreKeys) {
            const slug = key.replace('spryte-highscore-', '');
            const score = parseInt(localStorage.getItem(key) || '0', 10);
            if (stats.perGame?.[slug] && score > stats.perGame[slug].highScore) {
              stats.perGame[slug].highScore = score;
            }
          }

          const gameDataState = {
            state: { stats },
            version: 0,
          };
          localStorage.setItem('spryte-game-data', JSON.stringify(gameDataState));
        }
      }
    }

    // Mark migration complete
    localStorage.setItem(MIGRATION_KEY, String(Date.now()));
  } catch {
    // Migration failed silently — old keys still work as fallback
  }
}

function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
