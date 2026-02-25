import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT = 6;

interface UserPrefsState {
  favorites: string[];
  recentlyPlayed: string[];
  soundMuted: boolean;
  volume: number;

  // Actions
  toggleFavorite: (slug: string) => void;
  isFavorite: (slug: string) => boolean;
  addRecentlyPlayed: (slug: string) => void;
  toggleMute: () => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
}

export const useUserPrefsStore = create<UserPrefsState>()(
  persist(
    (set, get) => ({
      favorites: [],
      recentlyPlayed: [],
      soundMuted: false,
      volume: 0.7,

      toggleFavorite: (slug) => {
        set((state) => {
          const next = state.favorites.includes(slug)
            ? state.favorites.filter((s) => s !== slug)
            : [...state.favorites, slug];
          // Dispatch event for backward compatibility
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('favorites-changed'));
          }
          return { favorites: next };
        });
      },

      isFavorite: (slug) => get().favorites.includes(slug),

      addRecentlyPlayed: (slug) => {
        set((state) => ({
          recentlyPlayed: [slug, ...state.recentlyPlayed.filter((s) => s !== slug)].slice(0, MAX_RECENT),
        }));
      },

      toggleMute: () => {
        set((state) => ({ soundMuted: !state.soundMuted }));
      },

      setMuted: (muted) => set({ soundMuted: muted }),

      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
    }),
    {
      name: 'spryte-user-prefs',
    }
  )
);
