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

function MiniProgressRing({
  value,
  size = 32,
  strokeWidth = 3,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(value, 1));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#a855f7"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[8px] font-bold text-dim">{Math.round(value * 100)}%</span>
      </div>
    </div>
  );
}

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
  const progressFraction = all.length > 0 ? earnedCount / all.length : 0;

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

  // Hero progress ring
  const heroSize = 80;
  const heroStroke = 6;
  const heroRadius = (heroSize - heroStroke) / 2;
  const heroCircumference = 2 * Math.PI * heroRadius;
  const heroOffset = heroCircumference * (1 - progressFraction);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-24">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-dim mb-8" aria-label="Breadcrumbs">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground">Achievements</span>
      </nav>

      {/* Hero header with progress ring */}
      <div className="flex items-center gap-6 mb-10">
        <div className="relative shrink-0" style={{ width: heroSize, height: heroSize }}>
          <svg width={heroSize} height={heroSize} className="-rotate-90">
            <circle
              cx={heroSize / 2}
              cy={heroSize / 2}
              r={heroRadius}
              fill="none"
              stroke="rgba(255,255,255,0.04)"
              strokeWidth={heroStroke}
            />
            <circle
              cx={heroSize / 2}
              cy={heroSize / 2}
              r={heroRadius}
              fill="none"
              stroke="#a855f7"
              strokeWidth={heroStroke}
              strokeLinecap="round"
              strokeDasharray={heroCircumference}
              strokeDashoffset={heroOffset}
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-foreground">{progressPct}%</span>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-display)]">Achievements</h1>
          <p className="text-muted mt-1">
            {earnedCount} of {all.length} unlocked
          </p>
        </div>
      </div>

      {/* Achievement groups */}
      {groups.map((group) => (
        <section key={group.title} className="mb-12">
          <h2 className="text-lg font-bold mb-4 section-header font-[family-name:var(--font-display)]">{group.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {group.items.map((a) => {
              const isEarned = !!earned[a.id];
              const isSecret = a.secret && !isEarned;
              const progress = stats ? getAchievementProgress(a.id, stats) : 0;
              const date = isEarned
                ? new Date(earned[a.id].earnedAt).toLocaleDateString()
                : null;

              // Secret/locked card
              if (isSecret) {
                return (
                  <div
                    key={a.id}
                    className="rounded-xl border border-white/[0.04] p-4 bg-card/30 backdrop-blur-sm relative overflow-hidden"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dim/40" aria-hidden="true">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-dim/60">Secret Achievement</p>
                        <p className="text-xs text-dim/40 mt-0.5">Keep playing to unlock</p>
                      </div>
                    </div>
                  </div>
                );
              }

              // Earned card
              if (isEarned) {
                return (
                  <div
                    key={a.id}
                    className="rounded-xl border border-purple-500/30 p-4 bg-card relative overflow-hidden animate-shimmer"
                    style={{
                      boxShadow: '0 0 20px rgba(168, 85, 247, 0.08)',
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0" aria-hidden="true">{a.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{a.title}</p>
                        <p className="text-xs text-muted mt-0.5">{a.description}</p>
                        <p className="text-[10px] text-purple-400 mt-1.5 font-medium">
                          Unlocked {date}
                        </p>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" className="shrink-0 mt-1" aria-label="Earned">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                  </div>
                );
              }

              // In-progress / locked card
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-white/[0.04] p-4 bg-card/50 opacity-70"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 grayscale" aria-hidden="true">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{a.title}</p>
                      <p className="text-xs text-muted mt-0.5">{a.description}</p>
                    </div>
                    {progress > 0 ? (
                      <MiniProgressRing value={progress} />
                    ) : null}
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
