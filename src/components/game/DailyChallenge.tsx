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

  if (!challenge) return null;

  return (
    <div
      className={`relative rounded-2xl border overflow-hidden h-full flex flex-col transition-all duration-300 ${
        completed
          ? 'bg-green-500/[0.06] border-green-500/20'
          : 'bg-card border-white/[0.06]'
      }`}
    >
      <div className="flex-1 flex flex-col p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0 ${
                completed ? 'bg-green-500/20' : 'bg-accent/10'
              }`}
            >
              {completed ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <span className="text-sm" aria-hidden="true">🎯</span>
              )}
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-accent block leading-none">
                Daily Challenge
              </span>
              {completed && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-green-400">
                  Completed
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
            aria-label={`${streak} day streak. Click to view calendar.`}
          >
            <span className="text-orange-400 text-sm">🔥</span>
            <span className="font-bold text-foreground">{streak}</span>
          </button>
        </div>

        {/* Challenge info */}
        <p className="font-semibold text-foreground text-sm leading-snug mb-1">
          {challenge.description}
        </p>
        <p className="text-xs text-muted mb-1">
          in <span className="text-foreground">{challenge.gameTitle}</span>
        </p>
        <p className="text-[0.65rem] text-dim">
          {challenge.type === 'score' && `Target: ${challenge.target} points`}
          {challenge.type === 'level' && `Target: Level ${challenge.target}`}
          {challenge.type === 'completion' && `Complete ${challenge.target} session${challenge.target > 1 ? 's' : ''}`}
        </p>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Play button */}
        {!completed && (
          <Link
            href={`/games/${challenge.gameSlug}`}
            className="flex items-center justify-center gap-2 w-full mt-4 px-4 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:-translate-y-0.5 transition-all shadow-[0_4px_16px_rgba(233,69,96,0.3)]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play Challenge
          </Link>
        )}
      </div>

      {/* Calendar dropdown */}
      {showCalendar && (
        <div className="border-t border-white/[0.06] p-4 animate-fade-in">
          <ChallengeCalendar />
        </div>
      )}
    </div>
  );
}
