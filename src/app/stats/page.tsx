'use client';

import Link from 'next/link';
import { useStats } from '@/hooks/useStats';
import { getEarnedAchievements } from '@/lib/achievements';
import { getStreak, getBestStreak } from '@/lib/daily-challenge';
import { games } from '@/data/games';
import { useState, useEffect } from 'react';

export default function StatsPage() {
  const { stats, formatTime } = useStats();
  const [earnedCount, setEarnedCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  useEffect(() => {
    setEarnedCount(Object.keys(getEarnedAchievements()).length);
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

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-24">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-dim mb-8" aria-label="Breadcrumbs">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground">Statistics</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">Your Statistics</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
        <SummaryCard
          label="Total Playtime"
          value={formatTime(stats.global.totalTimeMs)}
          icon={<ClockIcon />}
        />
        <SummaryCard
          label="Total Sessions"
          value={String(stats.global.totalSessions)}
          icon={<PlayIcon />}
        />
        <SummaryCard
          label="Games Explored"
          value={`${stats.global.gamesPlayed.length}/${games.length}`}
          icon={<GridIcon />}
        />
        <SummaryCard
          label="Total High Scores"
          value={totalScore.toLocaleString()}
          icon={<StarIcon />}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-12">
        <SummaryCard
          label="Achievements"
          value={String(earnedCount)}
          icon={<TrophyIcon />}
        />
        <SummaryCard
          label="Daily Streak"
          value={`${streak} days`}
          icon={<FireIcon />}
        />
        <SummaryCard
          label="Best Streak"
          value={`${bestStreak} days`}
          icon={<MedalIcon />}
        />
      </div>

      {/* Most played game */}
      {mostPlayedGame && mostPlayed && (
        <section className="mb-12">
          <h2 className="text-lg font-bold mb-4 section-header">Most Played</h2>
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
        <h2 className="text-lg font-bold mb-4 section-header">Per-Game Stats</h2>
        <div className="space-y-3">
          {gameStats.map(({ game, stats: gs }) => (
            <Link
              key={game.slug}
              href={`/games/${game.slug}`}
              className="block bg-card border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.1] transition-all"
            >
              <div className="flex items-center gap-4">
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
                      {/* Sessions bar chart */}
                      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(gs.sessions / maxSessions) * 100}%`,
                            background: game.color,
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

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-white/[0.06] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2 text-muted">{icon}<span className="text-xs">{label}</span></div>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ClockIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>;
}
function PlayIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>;
}
function GridIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>;
}
function StarIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-amber-400" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
}
function TrophyIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V12M14 22V12" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
}
function FireIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400" aria-hidden="true"><path d="M12 12c2-2.96 0-7-1-8 0 3.04-4 4.96-4 8a5 5 0 1 0 10 0c0-1.5-.5-3-1.5-4-.5 2-1.5 3-3.5 4Z" /></svg>;
}
function MedalIcon() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="8" r="6" /><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" /></svg>;
}
