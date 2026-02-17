'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'spryte-recently-played';
const MAX_RECENT = 6;

function getStoredRecent(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// No-op subscribe for useSyncExternalStore (localStorage doesn't emit events for same-tab writes)
function subscribe() {
  return () => {};
}

export function useRecentlyPlayed() {
  // Use useSyncExternalStore for SSR-safe initial state from localStorage
  const initial = useSyncExternalStore(subscribe, getStoredRecent, () => []);
  const [recent, setRecent] = useState<string[]>(initial);

  const addPlayed = useCallback((slug: string) => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let list: string[] = stored ? JSON.parse(stored) : [];
      list = [slug, ...list.filter((s) => s !== slug)].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      setRecent(list);
    } catch {}
  }, []);

  return { recent, addPlayed };
}
