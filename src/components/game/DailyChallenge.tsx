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
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[1.3rem] font-bold tracking-tight">Daily Challenge</h2>
      </div>
      <div
        className={`relative rounded-2xl border overflow-hidden transition-all duration-300 ${
          completed
            ? 'bg-green-500/[0.06] border-green-500/20'
            : 'bg-card border-white/[0.06]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
          {/* Game icon area */}
          <div
            className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
              completed ? 'bg-green-500/20' : 'bg-accent/10'
            }`}
          >
            {completed ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <span aria-hidden="true">🎯</span>
            )}
          </div>

          {/* Challenge info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                Today&apos;s Challenge
              </span>
              {completed && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-green-400">
                  Completed
                </span>
              )}
            </div>
            <p className="font-semibold text-foreground">
              {challenge.description} in {challenge.gameTitle}
            </p>
            <p className="text-xs text-muted mt-0.5">
              {challenge.type === 'score' && `Target: ${challenge.target} points`}
              {challenge.type === 'level' && `Target: Level ${challenge.target}`}
              {challenge.type === 'completion' && `Complete ${challenge.target} session${challenge.target > 1 ? 's' : ''}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Streak counter */}
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors"
              aria-label={`${streak} day streak. Click to view calendar.`}
            >
              <span className="text-orange-400">🔥</span>
              <span className="font-semibold text-foreground">{streak}</span>
              <span className="text-xs text-muted">streak</span>
            </button>

            {/* Play button */}
            {!completed && (
              <Link
                href={`/games/${challenge.gameSlug}`}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm hover:-translate-y-0.5 transition-all shadow-[0_4px_16px_rgba(233,69,96,0.3)]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
                Play
              </Link>
            )}
          </div>
        </div>

        {/* Calendar dropdown */}
        {showCalendar && (
          <div className="border-t border-white/[0.06] p-5 animate-fade-in">
            <ChallengeCalendar />
          </div>
        )}
      </div>
    </section>
  );
}
