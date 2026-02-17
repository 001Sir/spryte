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
  const diff = difficultyConfig[game.difficulty];

  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: do nothing
    }
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
            >
              {diff.label}
            </span>
          </div>
          <p className="text-muted mt-2">{game.description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Share button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border hover:border-accent/50 text-muted hover:text-foreground transition-colors"
          >
            {copied ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
              className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-accent/50 text-muted hover:text-foreground transition-colors"
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
          className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-accent transition-colors w-full text-left"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className={`transition-transform duration-200 ${howToPlayOpen ? 'rotate-90' : ''}`}
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
          How to Play
        </button>
        {howToPlayOpen && (
          <div className="mt-3 pl-6 text-sm text-muted space-y-2">
            <p><strong className="text-foreground">Controls:</strong> {game.controls}</p>
            <p><strong className="text-foreground">Difficulty:</strong>{' '}
              <span style={{ color: diff.color }}>{diff.label}</span>
              {game.difficulty === 'Easy' && ' — Great for beginners'}
              {game.difficulty === 'Medium' && ' — Some experience recommended'}
              {game.difficulty === 'Hard' && ' — For experienced players'}
            </p>
            <p><strong className="text-foreground">Objective:</strong> {game.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}
