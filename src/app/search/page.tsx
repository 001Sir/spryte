'use client';

import { searchGames, getAllCategories, games } from '@/data/games';
import GameGrid from '@/components/game/GameGrid';
import GameCard from '@/components/game/GameCard';
import Link from 'next/link';
import { useState } from 'react';

export default function SearchPage() {
  const [input, setInput] = useState('');
  const categories = getAllCategories();
  const featuredGames = games.filter((g) => g.featured || g.isNew).slice(0, 6);

  // Instant search — filter as the user types
  const liveQuery = input.trim();
  const results = liveQuery ? searchGames(liveQuery) : [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">
        {liveQuery ? `Results for "${liveQuery}"` : 'Search'}
      </h1>

      {/* Inline search bar — instant filter, no form submission needed */}
      <div className="mb-8 max-w-lg" role="search">
        <div className="relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search by name, description, or category..."
            aria-label="Search games"
            autoFocus
            className="w-full bg-card border border-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:shadow-[0_0_12px_rgba(233,69,96,0.1)] transition-all duration-200"
          />
          {input && (
            <button
              type="button"
              onClick={() => setInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors p-1"
              aria-label="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {liveQuery && (
        <p className="text-muted mb-6 text-sm">
          {results.length} game{results.length !== 1 ? 's' : ''} found
        </p>
      )}
      {results.length > 0 ? (
        <GameGrid games={results} />
      ) : liveQuery ? (
        /* No results state */
        <div className="text-center py-16">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted/30 mb-4" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 11h6" strokeOpacity="0.5" />
          </svg>
          <p className="text-foreground font-medium mb-2">No games found</p>
          <p className="text-muted text-sm mb-6">
            Try a different search term or browse by category
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/category/${cat.toLowerCase()}`}
                className="text-sm px-4 py-2 rounded-lg border border-white/[0.06] text-muted hover:text-accent hover:border-accent/40 hover:bg-white/[0.02] transition-all duration-200"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* Empty search state — show popular suggestions */
        <div className="py-8">
          <div className="text-center mb-10">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-accent/20 mb-3" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <p className="text-foreground font-medium mb-2">Find your next game</p>
            <p className="text-muted text-sm mb-5">
              Start typing or browse by category
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/category/${cat.toLowerCase()}`}
                  className="text-sm px-4 py-2 rounded-lg border border-white/[0.06] text-muted hover:text-accent hover:border-accent/40 hover:bg-white/[0.02] transition-all duration-200"
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>

          {/* Popular / suggested games */}
          <div>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Popular Games
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {featuredGames.map((game) => (
                <GameCard key={game.slug} game={game} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
