'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'spryte-recently-played';
const MAX_RECENT = 6;

export function useRecentlyPlayed() {
  const [recent, setRecent] = useState<string[]>([]);

  // Read from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setRecent(JSON.parse(stored));
    } catch {}
  }, []);

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
