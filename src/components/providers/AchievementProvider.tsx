'use client';

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import {
  checkNewAchievements,
  getEarnedAchievements,
  getAllAchievements,
  type Achievement,
  type EarnedMap,
  type AchievementExtras,
} from '@/lib/achievements';
import { getStats } from '@/lib/stats';
import { SoundEngine } from '@/lib/sounds';
import AchievementToast from '@/components/ui/AchievementToast';

interface AchievementContextValue {
  earned: EarnedMap;
  total: number;
  earnedCount: number;
}

const AchievementContext = createContext<AchievementContextValue>({
  earned: {},
  total: 0,
  earnedCount: 0,
});

export function useAchievements() {
  return useContext(AchievementContext);
}

export default function AchievementProvider({ children }: { children: React.ReactNode }) {
  const [earned, setEarned] = useState<EarnedMap>({});
  const [queue, setQueue] = useState<Achievement[]>([]);
  const total = getAllAchievements().length;

  // Load earned on mount
  useEffect(() => {
    setEarned(getEarnedAchievements());
  }, []);

  // Listen for stats updates and check achievements
  useEffect(() => {
    const handleStatsUpdate = () => {
      const stats = getStats();
      // Get extras for daily challenge achievements
      let extras: AchievementExtras | undefined;
      try {
        const dailyData = localStorage.getItem('spryte-daily-challenges');
        if (dailyData) {
          const parsed = JSON.parse(dailyData);
          extras = {
            streak: parsed.bestStreak ?? 0,
            completedDays: Object.keys(parsed.completed ?? {}).length,
          };
        }
      } catch {}

      const newAchievements = checkNewAchievements(stats, extras);
      if (newAchievements.length > 0) {
        setEarned(getEarnedAchievements());
        setQueue(newAchievements);
        SoundEngine.play('achievementUnlock');
      }
    };

    window.addEventListener('spryte:stats-updated', handleStatsUpdate);
    return () => window.removeEventListener('spryte:stats-updated', handleStatsUpdate);
  }, []);

  const clearQueue = useCallback(() => setQueue([]), []);

  return (
    <AchievementContext.Provider
      value={{ earned, total, earnedCount: Object.keys(earned).length }}
    >
      {children}
      <AchievementToast queue={queue} onDismiss={clearQueue} />
    </AchievementContext.Provider>
  );
}
