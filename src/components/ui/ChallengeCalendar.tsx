'use client';

import { useMemo } from 'react';
import { getCompletedDays, getStreak, getBestStreak } from '@/lib/daily-challenge';

export default function ChallengeCalendar() {
  const completedDays = useMemo(() => new Set(getCompletedDays()), []);
  const streak = getStreak();
  const bestStreak = getBestStreak();

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const monthName = today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">{monthName}</h3>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted">
            Current: <span className="text-orange-400 font-semibold">{streak} days</span>
          </span>
          <span className="text-muted">
            Best: <span className="text-foreground font-semibold">{bestStreak} days</span>
          </span>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-[10px] text-dim py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dateStr = getDateStr(day);
          const isCompleted = completedDays.has(dateStr);
          const isToday = day === today.getDate();

          return (
            <div
              key={day}
              className={`aspect-square rounded-lg flex items-center justify-center text-xs transition-all ${
                isToday
                  ? 'ring-1 ring-accent font-bold text-foreground'
                  : ''
              } ${
                isCompleted
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-dim'
              }`}
            >
              {isCompleted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-label={`Day ${day} completed`}>
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                day
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
