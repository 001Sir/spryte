'use client';

import { useState, useCallback } from 'react';
import { generateScoreCard } from '@/lib/score-card';

interface ShareScoreButtonProps {
  gameTitle: string;
  gameSlug: string;
  score: number;
  isNewHigh: boolean;
  gameColor: string;
}

export default function ShareScoreButton({
  gameTitle,
  gameSlug,
  score,
  isNewHigh,
  gameColor,
}: ShareScoreButtonProps) {
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);

    try {
      const blob = await generateScoreCard({
        gameTitle,
        score,
        isNewHigh,
        gameColor,
      });

      const file = new File([blob], `${gameSlug}-score.png`, { type: 'image/png' });

      // Try Web Share API with file (mobile)
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `${gameTitle} — ${score.toLocaleString()} points`,
          text: `I scored ${score.toLocaleString()} in ${gameTitle} on Spryte Games!${isNewHigh ? ' New high score!' : ''}`,
          files: [file],
        });
        setShared(true);
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setShared(true);
        } catch {
          // Final fallback: download the image
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${gameSlug}-score.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          setShared(true);
        }
      }
    } catch {
      // User cancelled share — not an error
    } finally {
      setSharing(false);
      if (shared) setTimeout(() => setShared(false), 3000);
    }
  }, [gameTitle, gameSlug, score, isNewHigh, gameColor, sharing, shared]);

  return (
    <button
      onClick={handleShare}
      disabled={sharing}
      className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg border border-white/[0.06] hover:border-accent/50 text-muted hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 disabled:opacity-50"
    >
      {sharing ? (
        <span className="animate-pulse">Generating...</span>
      ) : shared ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-green-400">Shared!</span>
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
          </svg>
          Share Score
        </>
      )}
    </button>
  );
}
