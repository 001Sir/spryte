'use client';

import Link from 'next/link';
import { useStats } from '@/hooks/useStats';
import { getEarnedAchievements, allAchievements } from '@/lib/achievements';
import { getStreak, getBestStreak } from '@/lib/daily-challenge';
import { games } from '@/data/games';
import { useState, useEffect } from 'react';

function ProgressRing({
  value,
  max,
  size = 80,
  strokeWidth = 6,
  color,
  label,
  displayValue,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  displayValue: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = max > 0 ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold text-foreground">{displayValue}</span>
        </div>
      </div>
      <span className="text-[0.7rem] text-dim text-center">{label}</span>
    </div>
  );
}

export default function StatsPage() {
  const { stats, formatTime } = useStats();
  const [earnedCount, setEarnedCount] = useState(0);
  const [totalAchievements, setTotalAchievements] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    setEarnedCount(Object.keys(getEarnedAchievements()).length);
    setTotalAchievements(allAchievements.length);
    setStreak(getStreak());
    setBestStreak(getBestStreak());
  }, []);

  const totalScore = Object.values(stats.perGame).reduce((sum, g) => sum + g.highScore, 0);

  // Find most played game
  const mostPlayed = Object.entries(stats.perGame).sort(
    (a, b) => b[1].sessions - a[1].sessions
  )[0];
  const mostPlayedGame = mostPlayed
    ? games.find((g) => g.slug === mostPlayed[0])
    : null;

  // Per-game stats sorted by sessions
  const gameStats = games.map((game) => ({
    game,
    stats: stats.perGame[game.slug] || null,
  })).sort((a, b) => (b.stats?.sessions ?? 0) - (a.stats?.sessions ?? 0));

  // Find max sessions for bar chart scaling
  const maxSessions = Math.max(1, ...gameStats.map((g) => g.stats?.sessions ?? 0));

  // Target values for progress rings
  const playtimeHours = stats.global.totalTimeMs / (1000 * 60 * 60);
  const playtimeTarget = Math.max(10, Math.ceil(playtimeHours / 5) * 5); // Next 5h milestone

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-24">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-dim mb-8" aria-label="Breadcrumbs">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground">Statistics</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8 font-[family-name:var(--font-display)]">Your Statistics</h1>

      {/* Progress rings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12">
        <ProgressRing
          value={playtimeHours}
          max={playtimeTarget}
          color="#3b82f6"
          label="Total Playtime"
          displayValue={formatTime(stats.global.totalTimeMs)}
        />
        <ProgressRing
          value={stats.global.totalSessions}
          max={Math.max(50, stats.global.totalSessions)}
          color="#22c55e"
          label="Total Sessions"
          displayValue={String(stats.global.totalSessions)}
        />
        <ProgressRing
          value={totalScore}
          max={Math.max(1000, totalScore)}
          color="#f59e0b"
          label="Total High Scores"
          displayValue={totalScore > 999 ? `${(totalScore / 1000).toFixed(1)}k` : String(totalScore)}
        />
        <ProgressRing
          value={earnedCount}
          max={totalAchievements || 1}
          color="#a855f7"
          label="Achievements"
          displayValue={`${earnedCount}/${totalAchievements}`}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-3 gap-4 mb-12">
        <div className="bg-card border border-white/[0.06] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{stats.global.gamesPlayed.length}/{games.length}</div>
          <div className="text-xs text-dim mt-1">Games Explored</div>
        </div>
        <div className="bg-card border border-white/[0.06] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{streak}</div>
          <div className="text-xs text-dim mt-1">Daily Streak</div>
        </div>
        <div className="bg-card border border-white/[0.06] rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{bestStreak}</div>
          <div className="text-xs text-dim mt-1">Best Streak</div>
        </div>
      </div>

      {/* Most played game */}
      {mostPlayedGame && mostPlayed && (
        <section className="mb-12">
          <h2 className="text-lg font-bold mb-4 section-header font-[family-name:var(--font-display)]">Most Played</h2>
          <Link
            href={`/games/${mostPlayedGame.slug}`}
            className="block bg-card border border-white/[0.06] rounded-xl p-5 hover:border-white/[0.1] transition-all"
            style={{ borderLeftColor: mostPlayedGame.color, borderLeftWidth: '3px' }}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">🏆</div>
              <div>
                <h3 className="font-bold text-lg">{mostPlayedGame.title}</h3>
                <p className="text-sm text-muted">
                  {mostPlayed[1].sessions} sessions &middot;{' '}
                  {formatTime(mostPlayed[1].totalTimeMs)} played &middot;{' '}
                  High score: {mostPlayed[1].highScore.toLocaleString()}
                </p>
              </div>
            </div>
          </Link>
        </section>
      )}

      {/* Per-game stats */}
      <section>
        <h2 className="text-lg font-bold mb-4 section-header font-[family-name:var(--font-display)]">Per-Game Stats</h2>
        <div className="space-y-3">
          {gameStats.map(({ game, stats: gs }, i) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="block bg-card border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-all"
            >
              <div className="flex items-center gap-4">
                {/* Rank number */}
                {gs && gs.sessions > 0 && (
                  <span className="text-[0.7rem] font-bold text-dim w-6 text-center shrink-0">
                    #{i + 1}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-sm truncate">{game.title}</h3>
                    {gs && gs.sessions > 0 && (
                      <span className="text-[10px] text-muted shrink-0">
                        Last played {new Date(gs.lastPlayed).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  {gs && gs.sessions > 0 ? (
                    <>
                      {/* Sessions bar chart — taller with gradient */}
                      <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(gs.sessions / maxSessions) * 100}%`,
                            background: `linear-gradient(90deg, ${game.color}, ${game.color}cc)`,
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                        <span>{gs.sessions} sessions</span>
                        <span>{formatTime(gs.totalTimeMs)}</span>
                        <span>High: {gs.highScore.toLocaleString()}</span>
                        {gs.bestLevel > 0 && <span>Best level: {gs.bestLevel}</span>}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-dim">Not yet played</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
