'use client';

import { useSearchParams } from 'next/navigation';
import { searchGames, getAllCategories } from '@/data/games';
import GameGrid from '@/components/game/GameGrid';
import Link from 'next/link';
import { Suspense } from 'react';

function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const results = query ? searchGames(query) : [];
  const categories = getAllCategories();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">
        {query ? `Results for "${query}"` : 'Search'}
      </h1>
      {query && (
        <p className="text-muted mb-8">
          {results.length} game{results.length !== 1 ? 's' : ''} found
        </p>
      )}
      {results.length > 0 ? (
        <GameGrid games={results} />
      ) : query ? (
        /* No results state */
        <div className="text-center py-16">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted/40 mb-4">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 11h6M11 8v6" strokeOpacity="0.5" />
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
                className="text-sm px-3 py-1.5 rounded-lg border border-border text-muted hover:text-accent hover:border-accent/40 transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* Empty search state */
        <div className="text-center py-16">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted/30 mb-4">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p className="text-foreground font-medium mb-2">Search for games</p>
          <p className="text-muted text-sm mb-6">
            Find games by name, description, or category
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/category/${cat.toLowerCase()}`}
                className="text-sm px-3 py-1.5 rounded-lg border border-border text-muted hover:text-accent hover:border-accent/40 transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8"><p className="text-muted">Loading...</p></div>}>
      <SearchResults />
    </Suspense>
  );
}
