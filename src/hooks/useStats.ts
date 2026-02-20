'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { getStats, type StatsData } from '@/lib/stats';

const emptyStats: StatsData = {
  perGame: {},
  global: { totalSessions: 0, totalTimeMs: 0, gamesPlayed: [] },
};

let cached: StatsData = emptyStats;

function subscribe(callback: () => void) {
  const handler = () => callback();
  window.addEventListener('spryte:stats-updated', handler);
  return () => window.removeEventListener('spryte:stats-updated', handler);
}

function getStoreSnapshot(): StatsData {
  const next = getStats();
  if (JSON.stringify(next) !== JSON.stringify(cached)) {
    cached = next;
  }
  return cached;
}

function getServerSnapshot(): StatsData {
  return emptyStats;
}

export function useStats() {
  const stats = useSyncExternalStore(subscribe, getStoreSnapshot, getServerSnapshot);

  const formatTime = useCallback((ms: number) => {
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return '<1m';
  }, []);

  return { stats, formatTime };
}
