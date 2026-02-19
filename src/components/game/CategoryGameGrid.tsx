'use client';

import { useState } from 'react';
import { Game } from '@/types/game';
import GameCard from './GameCard';

type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';

const filterColors: Record<string, string> = {
  All: '#9ca3af',
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

const filters: DifficultyFilter[] = ['All', 'Easy', 'Medium', 'Hard'];

export default function CategoryGameGrid({ games }: { games: Game[] }) {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All');

  const filtered = difficulty === 'All'
    ? games
    : games.filter((g) => g.difficulty === difficulty);

  return (
    <>
      {/* Difficulty filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap" role="group" aria-label="Filter by difficulty">
        <span className="text-sm text-muted mr-1" id="difficulty-label">Difficulty:</span>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setDifficulty(f)}
            aria-pressed={difficulty === f}
            className={`text-sm px-3.5 py-1.5 rounded-lg border transition-all duration-200 min-h-[36px] ${
              difficulty === f
                ? 'border-current font-medium shadow-sm'
                : 'border-white/[0.06] text-muted hover:text-foreground hover:border-white/[0.12] hover:bg-white/[0.03]'
            }`}
            style={difficulty === f ? { color: filterColors[f], borderColor: filterColors[f] + '40', background: filterColors[f] + '10' } : undefined}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Results count for screen readers */}
      <div className="sr-only" aria-live="polite" role="status">
        {filtered.length} game{filtered.length !== 1 ? 's' : ''} shown
      </div>

      {/* Games grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3" style={{ color: filterColors[difficulty] + '40' }} aria-hidden="true">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
          </svg>
          <p className="text-foreground font-medium mb-1">No {difficulty.toLowerCase()} games</p>
          <p className="text-muted text-sm">
            Try a different difficulty filter.
          </p>
        </div>
      )}
    </>
  );
}
