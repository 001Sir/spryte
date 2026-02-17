'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { getGamesByCategory } from '@/data/games';
import GameCard from '@/components/game/GameCard';
import Link from 'next/link';

const categoryColors: Record<string, string> = {
  action: '#e94560',
  arcade: '#f59e0b',
  puzzle: '#06b6d4',
  racing: '#84cc16',
  strategy: '#7c3aed',
};

const categoryIcons: Record<string, string> = {
  action: '⚡',
  arcade: '🕹️',
  puzzle: '🧩',
  racing: '🏎️',
  strategy: '♟️',
};

type DifficultyFilter = 'All' | 'Easy' | 'Medium' | 'Hard';

export default function CategoryPage() {
  const params = useParams();
  const category = params.category as string;
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('All');

  const allCatGames = getGamesByCategory(category);
  const catGames = difficulty === 'All'
    ? allCatGames
    : allCatGames.filter((g) => g.difficulty === difficulty);

  const label = category.charAt(0).toUpperCase() + category.slice(1);
  const color = categoryColors[category] || '#e94560';
  const icon = categoryIcons[category] || '🎮';

  if (allCatGames.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">Category Not Found</h1>
        <p className="text-muted mb-6">No games found in this category.</p>
        <Link href="/" className="text-accent hover:text-accent-hover transition-colors">
          &larr; Back to Home
        </Link>
      </div>
    );
  }

  const filters: DifficultyFilter[] = ['All', 'Easy', 'Medium', 'Hard'];
  const filterColors: Record<string, string> = {
    All: '#888',
    Easy: '#4ade80',
    Medium: '#f59e0b',
    Hard: '#e94560',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Category header */}
      <div
        className="rounded-xl p-6 mb-8 border border-border relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}15, ${color}08, transparent)` }}
      >
        <div
          className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] rounded-full opacity-10 blur-2xl"
          style={{ background: color }}
        />
        <div className="relative">
          <span className="text-3xl mb-2 block">{icon}</span>
          <h1 className="text-3xl font-bold">{label} Games</h1>
          <p className="text-muted mt-1">
            {allCatGames.length} game{allCatGames.length !== 1 ? 's' : ''} in this category
          </p>
        </div>
      </div>

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
      {catGames.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {catGames.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      ) : (
        <p className="text-muted text-center py-10">
          No {difficulty.toLowerCase()} games in this category.
        </p>
      )}
    </div>
  );
}
