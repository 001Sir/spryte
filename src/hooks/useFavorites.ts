'use client';

import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'spryte-favorites';

function getSnapshot(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Keep a cached reference so useSyncExternalStore doesn't re-render unnecessarily
let cached: string[] = [];

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };
  // Also listen for custom events so multiple components stay in sync
  const customHandler = () => callback();
  window.addEventListener('storage', handler);
  window.addEventListener('favorites-changed', customHandler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener('favorites-changed', customHandler);
  };
}

function getStoreSnapshot(): string[] {
  const next = getSnapshot();
  if (JSON.stringify(next) !== JSON.stringify(cached)) {
    cached = next;
  }
  return cached;
}

function getServerSnapshot(): string[] {
  return [];
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getStoreSnapshot, getServerSnapshot);

  const toggleFavorite = useCallback((slug: string) => {
    try {
      const current = getSnapshot();
      const next = current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      cached = next;
      window.dispatchEvent(new Event('favorites-changed'));
    } catch {}
  }, []);

  const isFavorite = useCallback(
    (slug: string) => favorites.includes(slug),
    [favorites]
  );

  return { favorites, toggleFavorite, isFavorite };
}
