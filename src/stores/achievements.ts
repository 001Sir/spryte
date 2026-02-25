import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EarnedMap } from '@/lib/achievements';

interface AchievementState {
  earned: EarnedMap;

  // Actions
  markEarned: (id: string) => void;
  isEarned: (id: string) => boolean;
  getEarnedCount: () => number;
}

export const useAchievementStore = create<AchievementState>()(
  persist(
    (set, get) => ({
      earned: {},

      markEarned: (id) => {
        if (get().earned[id]) return; // Already earned
        set((state) => ({
          earned: {
            ...state.earned,
            [id]: { earnedAt: Date.now() },
          },
        }));
      },

      isEarned: (id) => !!get().earned[id],

      getEarnedCount: () => Object.keys(get().earned).length,
    }),
    {
      name: 'spryte-achievements-store',
    }
  )
);
