'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getAllAchievements,
  getEarnedAchievements,
  getAchievementProgress,
  type EarnedMap,
} from '@/lib/achievements';
import { getStats, type StatsData } from '@/lib/stats';

export default function AchievementsPage() {
  const [earned, setEarned] = useState<EarnedMap>({});
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    setEarned(getEarnedAchievements());
    setStats(getStats());

    const handler = () => {
      setEarned(getEarnedAchievements());
      setStats(getStats());
    };
    window.addEventListener('spryte:stats-updated', handler);
    return () => window.removeEventListener('spryte:stats-updated', handler);
  }, []);

  const all = getAllAchievements();
  const earnedCount = Object.keys(earned).length;
  const progressPct = all.length > 0 ? Math.round((earnedCount / all.length) * 100) : 0;

  const perGame = all.filter((a) => a.category === 'per-game');
  const crossGame = all.filter((a) => a.category === 'cross-game');
  const meta = all.filter((a) => a.category === 'meta');
  const daily = all.filter((a) => a.category === 'daily');

  const groups = [
    { title: 'Per-Game Achievements', items: perGame },
    { title: 'Cross-Game Achievements', items: crossGame },
    { title: 'Daily Challenge Achievements', items: daily },
    { title: 'Meta Achievements', items: meta },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-24">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-dim mb-8" aria-label="Breadcrumbs">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground">Achievements</span>
      </nav>

      <h1 className="text-3xl font-bold mb-2">Achievements</h1>
      <p className="text-muted mb-8">
        {earnedCount} of {all.length} unlocked
      </p>

      {/* Overall progress bar */}
      <div className="mb-12">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted">Overall Progress</span>
          <span className="font-semibold text-accent">{progressPct}%</span>
        </div>
        <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Achievement groups */}
      {groups.map((group) => (
        <section key={group.title} className="mb-12">
          <h2 className="text-lg font-bold mb-4 section-header">{group.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((a) => {
              const isEarned = !!earned[a.id];
              const isSecret = a.secret && !isEarned;
              const progress = stats ? getAchievementProgress(a.id, stats) : 0;
              const date = isEarned
                ? new Date(earned[a.id].earnedAt).toLocaleDateString()
                : null;

              return (
                <div
                  key={a.id}
                  className={`rounded-xl border p-4 transition-all duration-300 ${
                    isEarned
                      ? 'bg-card border-accent/30 shadow-[0_0_12px_rgba(233,69,96,0.1)]'
                      : 'bg-card/50 border-white/[0.04] opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`text-2xl shrink-0 ${isEarned ? '' : 'grayscale'}`}
                      aria-hidden="true"
                    >
                      {isSecret ? '???' : a.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        {isSecret ? '???' : a.title}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {isSecret ? 'Keep playing to unlock this secret achievement' : a.description}
                      </p>
                      {isEarned && date && (
                        <p className="text-[10px] text-accent mt-1.5">
                          Unlocked {date}
                        </p>
                      )}
                      {!isEarned && !isSecret && progress > 0 && (
                        <div className="mt-2">
                          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent/50 rounded-full transition-all"
                              style={{ width: `${Math.round(progress * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-dim mt-0.5 block">
                            {Math.round(progress * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                    {isEarned && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" className="shrink-0 mt-1" aria-label="Earned">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
