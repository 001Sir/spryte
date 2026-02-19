'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { searchGames, getAllCategories } from '@/data/games';
import GameGrid from '@/components/game/GameGrid';
import Link from 'next/link';
import { Suspense, useState } from 'react';

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const [input, setInput] = useState(query);
  const results = query ? searchGames(query) : [];
  const categories = getAllCategories();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      router.push(`/search?q=${encodeURIComponent(input.trim())}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">
        {query ? `Results for "${query}"` : 'Search'}
      </h1>

      {/* Inline search bar */}
      <form onSubmit={handleSearch} className="mb-8 max-w-lg" role="search">
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
            autoFocus={!query}
            className="w-full bg-card border border-white/[0.06] rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent focus:shadow-[0_0_12px_rgba(233,69,96,0.1)] transition-all duration-200"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-accent hover:bg-accent-hover text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 hover:shadow-[0_0_8px_rgba(233,69,96,0.3)]"
          >
            Search
          </button>
        </div>
      </form>

      {query && (
        <p className="text-muted mb-6 text-sm">
          {results.length} game{results.length !== 1 ? 's' : ''} found
        </p>
      )}
      {results.length > 0 ? (
        <GameGrid games={results} />
      ) : query ? (
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
        /* Empty search state */
        <div className="text-center py-16">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-accent/20 mb-4" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <p className="text-foreground font-medium mb-2">Find your next game</p>
          <p className="text-muted text-sm mb-6">
            Search by name, description, or category
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
