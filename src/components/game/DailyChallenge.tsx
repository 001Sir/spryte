'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getDailyChallenge,
  getDailyChallengeStatus,
  getStreak,
  type DailyChallenge as DailyChallengeType,
} from '@/lib/daily-challenge';
import ChallengeCalendar from '@/components/ui/ChallengeCalendar';

export default function DailyChallenge() {
  const [challenge, setChallenge] = useState<DailyChallengeType | null>(null);
  const [completed, setCompleted] = useState(false);
  const [streak, setStreak] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    const c = getDailyChallenge();
    setChallenge(c);
    setCompleted(getDailyChallengeStatus(c.id));
    setStreak(getStreak());

    const handler = () => {
      setCompleted(getDailyChallengeStatus(c.id));
      setStreak(getStreak());
    };
    window.addEventListener('spryte:stats-updated', handler);
    return () => window.removeEventListener('spryte:stats-updated', handler);
  }, []);

  // Skeleton placeholder during hydration — prevents empty cell flash
  if (!challenge) {
    return (
      <div className="h-full flex flex-col justify-center px-6 py-5 bg-gradient-to-br from-accent/[0.08] to-[#7c6bff]/[0.06]">
        <div className="h-2.5 w-24 bg-white/[0.06] rounded animate-skeleton-pulse mb-3" />
        <div className="h-4 w-48 bg-white/[0.04] rounded animate-skeleton-pulse mb-2" />
        <div className="h-3 w-32 bg-white/[0.03] rounded animate-skeleton-pulse" />
      </div>
    );
  }

  return (
    <div
      className={`relative h-full flex flex-col justify-center px-6 py-5 transition-all duration-300 ${
        completed
          ? 'bg-green-500/[0.06]'
          : 'bg-gradient-to-br from-accent/[0.08] to-[#7c6bff]/[0.06]'
      }`}
    >
      {/* Label */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-accent">
          {completed ? '✓' : '🎯'} Daily Challenge
        </span>
        {completed && (
          <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-green-400">
            Completed
          </span>
        )}
      </div>

      {/* Title */}
      <p className="font-bold text-foreground text-[1.05rem] leading-snug mb-1">
        {challenge.description} in {challenge.gameTitle}
      </p>

      {/* Target */}
      <p className="text-[0.72rem] text-dim mb-3">
        {challenge.type === 'score' && `Target: ${challenge.target} points`}
        {challenge.type === 'level' && `Target: Level ${challenge.target}`}
        {challenge.type === 'completion' && `Complete ${challenge.target} session${challenge.target > 1 ? 's' : ''}`}
      </p>

      {/* Bottom row: streak + play */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="flex items-center gap-1 text-sm font-bold hover:opacity-80 transition-opacity"
          aria-label={`${streak} day streak. Click to view calendar.`}
        >
          <span className="text-orange-400">🔥</span>
          <span className="text-foreground">{streak}</span>
          <span className="text-[0.65rem] text-dim font-normal ml-0.5">streak</span>
        </button>

        {!completed && (
          <Link
            href={`/games/${challenge.gameSlug}`}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent text-white font-semibold text-xs hover:bg-accent/90 transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </Link>
        )}
      </div>

      {/* Calendar overlay — positioned above or below depending on space */}
      {showCalendar && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
          <div className="absolute bottom-full left-0 right-0 z-50 mb-1 rounded-2xl bg-card border border-white/[0.06] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.6)] animate-fade-in">
            <ChallengeCalendar />
          </div>
        </>
      )}
    </div>
  );
}
