'use client';

import { useState } from 'react';
import { Game } from '@/types/game';
import GameCard from './GameCard';

type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';
type SortOption = 'default' | 'difficulty-asc' | 'difficulty-desc' | 'newest' | 'name';

const filterColors: Record<string, string> = {
  All: '#9ca3af',
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

const filters: DifficultyFilter[] = ['All', 'Easy', 'Medium', 'Hard'];

const difficultyOrder: Record<string, number> = { Easy: 1, Medium: 2, Hard: 3 };

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'name', label: 'A → Z' },
  { value: 'difficulty-asc', label: 'Easy → Hard' },
  { value: 'difficulty-desc', label: 'Hard → Easy' },
  { value: 'newest', label: 'Newest First' },
];

function sortGames(games: Game[], sort: SortOption): Game[] {
  const sorted = [...games];
  switch (sort) {
    case 'name':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case 'difficulty-asc':
      return sorted.sort((a, b) => (difficultyOrder[a.difficulty] || 0) - (difficultyOrder[b.difficulty] || 0));
    case 'difficulty-desc':
      return sorted.sort((a, b) => (difficultyOrder[b.difficulty] || 0) - (difficultyOrder[a.difficulty] || 0));
    case 'newest':
      return sorted.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0));
    default:
      return sorted;
  }
}

export default function CategoryGameGrid({ games }: { games: Game[] }) {
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All');
  const [sort, setSort] = useState<SortOption>('default');

  const filtered = difficulty === 'All'
    ? games
    : games.filter((g) => g.difficulty === difficulty);

  const sorted = sortGames(filtered, sort);

  return (
    <>
      {/* Filter & sort controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Difficulty filter */}
        <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Filter by difficulty">
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

        {/* Sort dropdown */}
        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="sort-select" className="text-sm text-muted">Sort:</label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="text-sm px-3 py-1.5 rounded-lg border border-white/[0.06] bg-card text-foreground hover:border-white/[0.12] transition-all duration-200 min-h-[36px] cursor-pointer appearance-none pr-8"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239896a8' stroke-width='2' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count for screen readers */}
      <div className="sr-only" aria-live="polite" role="status">
        {sorted.length} game{sorted.length !== 1 ? 's' : ''} shown
      </div>

      {/* Games grid */}
      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sorted.map((game) => (
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
