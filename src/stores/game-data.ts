import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StatsData, GameStats } from '@/lib/stats';

// Re-exports for backward compatibility — games can import from here or from the original files
export type { StatsData, GameStats };

interface ActiveSession {
  slug: string;
  startTime: number;
}

interface GameDataState {
  stats: StatsData;
  activeSessions: Record<string, ActiveSession>;
  sessionCounter: number;

  // Actions
  startSession: (slug: string) => string;
  endSession: (sessionId: string, score: number, completed: boolean, level?: number) => void;

  // Computed-like getters
  getHighScore: (slug: string) => number;
  getPlayCount: (slug: string) => number;
}

export const useGameDataStore = create<GameDataState>()(
  persist(
    (set, get) => ({
      stats: {
        perGame: {},
        global: { totalSessions: 0, totalTimeMs: 0, gamesPlayed: [] },
      },
      activeSessions: {},
      sessionCounter: 0,

      startSession: (slug: string) => {
        const id = `session-${get().sessionCounter + 1}-${Date.now()}`;
        set((state) => ({
          sessionCounter: state.sessionCounter + 1,
          activeSessions: {
            ...state.activeSessions,
            [id]: { slug, startTime: Date.now() },
          },
        }));
        return id;
      },

      endSession: (sessionId, score, completed, level) => {
        const session = get().activeSessions[sessionId];
        if (!session) return;

        const elapsed = Date.now() - session.startTime;
        const { slug } = session;

        set((state) => {
          const newActiveSessions = { ...state.activeSessions };
          delete newActiveSessions[sessionId];

          const perGame = { ...state.stats.perGame };
          const gs: GameStats = perGame[slug]
            ? { ...perGame[slug] }
            : {
                sessions: 0,
                totalTimeMs: 0,
                highScore: 0,
                bestLevel: 0,
                completions: 0,
                firstPlayed: Date.now(),
                lastPlayed: Date.now(),
              };

          gs.sessions++;
          gs.totalTimeMs += elapsed;
          gs.lastPlayed = Date.now();
          if (score > gs.highScore) gs.highScore = score;
          if (level !== undefined && level > gs.bestLevel) gs.bestLevel = level;
          if (completed) gs.completions++;

          perGame[slug] = gs;

          const gamesPlayed = state.stats.global.gamesPlayed.includes(slug)
            ? state.stats.global.gamesPlayed
            : [...state.stats.global.gamesPlayed, slug];

          return {
            activeSessions: newActiveSessions,
            stats: {
              perGame,
              global: {
                totalSessions: state.stats.global.totalSessions + 1,
                totalTimeMs: state.stats.global.totalTimeMs + elapsed,
                gamesPlayed,
              },
            },
          };
        });

        // Dispatch event for backward compatibility with existing listeners
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('spryte:stats-updated'));
        }
      },

      getHighScore: (slug) => {
        return get().stats.perGame[slug]?.highScore ?? 0;
      },

      getPlayCount: (slug) => {
        return get().stats.perGame[slug]?.sessions ?? 0;
      },
    }),
    {
      name: 'spryte-game-data',
      partialize: (state) => ({ stats: state.stats }),
    }
  )
);
