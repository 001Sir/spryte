'use client';

import { Game } from '@/types/game';
import Link from 'next/link';
import { useState } from 'react';

const difficultyConfig = {
  Easy: { color: '#4ade80', bg: '#4ade8015', label: 'Easy' },
  Medium: { color: '#f59e0b', bg: '#f59e0b15', label: 'Medium' },
  Hard: { color: '#e94560', bg: '#e9456015', label: 'Hard' },
};

export default function GameInfo({ game }: { game: Game }) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const diff = difficultyConfig[game.difficulty];

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setShareFailed(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Try native share API as fallback on mobile
      if (navigator.share) {
        try {
          await navigator.share({ title: game.title, url });
          return;
        } catch {
          // User cancelled share - not an error
          return;
        }
      }
      setShareFailed(true);
      setTimeout(() => setShareFailed(false), 2000);
    }
  };

  const scrollToGame = () => {
    document.getElementById('game-container')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mt-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">{game.title}</h1>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ color: diff.color, background: diff.bg }}
              aria-label={`Difficulty: ${diff.label}`}
            >
              {diff.label}
            </span>
          </div>
          <p className="text-muted mt-2">{game.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Back to game button */}
          <button
            onClick={scrollToGame}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors min-h-[36px]"
            aria-label="Scroll to game"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
            Play
          </button>

          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent/50 text-muted hover:text-foreground transition-colors min-h-[36px]"
            aria-label="Share game link"
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copied!
              </>
            ) : shareFailed ? (
              <span className="text-accent">Could not copy</span>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                  <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
                </svg>
                Share
              </>
            )}
          </button>

          {/* Category tags */}
          {game.categories.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat.toLowerCase()}`}
              className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-accent/50 text-muted hover:text-foreground transition-colors min-h-[36px] flex items-center"
            >
              {cat}
            </Link>
          ))}
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-4 flex gap-6 text-sm">
        <div>
          <span className="text-muted">Controls:</span>{' '}
          <span className="text-foreground">{game.controls}</span>
        </div>
      </div>

      {/* How to Play expandable section */}
      <div className="mt-4 border-t border-border pt-4">
        <button
          onClick={() => setHowToPlayOpen(!howToPlayOpen)}
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors w-full text-left min-h-[44px]"
          aria-expanded={howToPlayOpen}
          aria-controls="how-to-play-content"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${howToPlayOpen ? 'rotate-90' : ''}`}
            aria-hidden="true"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          How to Play
        </button>
        {howToPlayOpen && (
          <div id="how-to-play-content" className="mt-3 pl-6 text-sm text-muted space-y-4" role="region" aria-label="How to play instructions">
            {/* Step-by-step instructions */}
            {game.howToPlay ? (
              <div>
                <strong className="text-foreground block mb-2">Instructions:</strong>
                <ol className="list-decimal list-inside space-y-1.5">
                  {game.howToPlay.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            ) : (
              <p><strong className="text-foreground">Objective:</strong> {game.description}</p>
            )}

            {/* Structured controls grid */}
            {game.controlsList ? (
              <div>
                <strong className="text-foreground block mb-2">Controls:</strong>
                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-center">
                  {game.controlsList.map((ctrl, i) => (
                    <div key={i} className="contents">
                      <kbd className="inline-block text-xs font-mono font-semibold px-2 py-1 rounded bg-white/5 border border-white/10 text-foreground whitespace-nowrap">
                        {ctrl.key}
                      </kbd>
                      <span>{ctrl.action}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p><strong className="text-foreground">Controls:</strong> {game.controls}</p>
            )}

            {/* Difficulty info */}
            <p><strong className="text-foreground">Difficulty:</strong>{' '}
              <span style={{ color: diff.color }}>{diff.label}</span>
              {game.difficulty === 'Easy' && ' — Great for beginners'}
              {game.difficulty === 'Medium' && ' — Some experience recommended'}
              {game.difficulty === 'Hard' && ' — For experienced players'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
