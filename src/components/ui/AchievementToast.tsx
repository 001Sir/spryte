'use client';

import { useEffect, useState } from 'react';
import type { Achievement } from '@/lib/achievements';

interface ToastItem {
  achievement: Achievement;
  id: number;
}

let toastId = 0;

export default function AchievementToast({
  queue,
  onDismiss,
}: {
  queue: Achievement[];
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState<ToastItem[]>([]);

  useEffect(() => {
    if (queue.length === 0) return;

    const newItems = queue.map((a) => ({ achievement: a, id: ++toastId }));
    setVisible((prev) => [...prev, ...newItems]);
    onDismiss();
  }, [queue, onDismiss]);

  useEffect(() => {
    if (visible.length === 0) return;
    const timer = setTimeout(() => {
      setVisible((prev) => prev.slice(1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-3 pointer-events-none">
      {visible.map((item) => (
        <div
          key={item.id}
          className="pointer-events-auto animate-toast-in bg-card border border-white/[0.1] rounded-xl px-5 py-4 shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(233,69,96,0.15)] min-w-[280px] max-w-[340px]"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0 mt-0.5" aria-hidden="true">
              {item.achievement.icon}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  Achievement Unlocked
                </span>
              </div>
              <p className="font-semibold text-sm text-foreground truncate">
                {item.achievement.title}
              </p>
              <p className="text-xs text-muted mt-0.5 line-clamp-2">
                {item.achievement.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
