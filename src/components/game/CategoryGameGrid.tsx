'use client';

import { useState } from 'react';
import { Game } from '@/types/game';
import GameCard from './GameCard';

type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';

const filterColors: Record<string, string> = {
  All: '#888',
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
      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm text-muted mr-1">Difficulty:</span>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setDifficulty(f)}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              difficulty === f
                ? 'border-current font-medium'
                : 'border-border text-muted hover:text-foreground hover:border-border'
            }`}
            style={difficulty === f ? { color: filterColors[f], borderColor: filterColors[f] + '40' } : undefined}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Games grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      ) : (
        <p className="text-muted text-center py-10">
          No {difficulty.toLowerCase()} games in this category.
        </p>
      )}
    </>
  );
}
