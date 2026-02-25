'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { searchGames, getAllCategories } from '@/data/games';
import { categoryColors, categoryIcons } from '@/data/categories';
import { AnimatePresence, motion } from 'framer-motion';
import type { Game } from '@/types/game';

const RECENT_KEY = 'spryte-recent-searches';
const MAX_RECENT = 5;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const recent = getRecentSearches().filter((s) => s !== query);
  recent.unshift(query);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results: Game[] = query.trim() ? searchGames(query) : [];
  const categories = getAllCategories();
  const recentSearches = open ? getRecentSearches() : [];

  const openPalette = useCallback(() => {
    setOpen(true);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setSelectedIndex(0);
  }, []);

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (open) {
          closePalette();
        } else {
          openPalette();
        }
      }
      if (e.key === 'Escape' && open) {
        closePalette();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, openPalette, closePalette]);

  // Focus input when palette opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const navigateToGame = (slug: string) => {
    if (query.trim()) addRecentSearch(query.trim());
    closePalette();
    router.push(`/games/${slug}`);
  };

  const navigateToCategory = (cat: string) => {
    closePalette();
    router.push(`/category/${cat.toLowerCase()}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = results.length || 0;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(totalItems, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      navigateToGame(results[selectedIndex].slug);
    }
  };

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <>
      {/* Search trigger button in navbar */}
      <button
        onClick={openPalette}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white/[0.04] border border-white/[0.06] text-dim hover:bg-white/[0.08] hover:text-foreground transition-all duration-200 text-[0.8rem]"
        aria-label="Search games"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
        </svg>
        Search
        <kbd className="hidden lg:inline-block text-[0.65rem] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-dim font-mono">
          {'\u2318'}K
        </kbd>
      </button>

      {/* Palette overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={closePalette}
            />

            {/* Palette */}
            <motion.div
              className="relative w-full max-w-[560px] mx-4 bg-surface border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-label="Search games"
            >
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.06]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dim shrink-0" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search games..."
                  className="flex-1 bg-transparent text-foreground text-[0.95rem] placeholder:text-dim/60 outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                <kbd className="text-[0.6rem] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-dim font-mono">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[50vh] overflow-y-auto">
                {query.trim() ? (
                  results.length > 0 ? (
                    <div className="py-2">
                      <div className="px-5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim">
                        Games
                      </div>
                      {results.map((game, i) => (
                        <button
                          key={game.slug}
                          onClick={() => navigateToGame(game.slug)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                            i === selectedIndex
                              ? 'bg-white/[0.06]'
                              : 'hover:bg-white/[0.04]'
                          }`}
                          onMouseEnter={() => setSelectedIndex(i)}
                        >
                          <div
                            className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center"
                            style={{ background: `${game.color}22` }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={game.color} aria-hidden="true">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[0.85rem] font-medium text-foreground truncate">
                              {game.title}
                            </div>
                            <div className="text-[0.7rem] text-dim truncate">
                              {game.categories.join(' / ')} &middot; {game.difficulty}
                            </div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-dim/40 shrink-0" aria-hidden="true">
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center">
                      <p className="text-dim text-[0.85rem]">No games found for &ldquo;{query}&rdquo;</p>
                    </div>
                  )
                ) : (
                  <div className="py-2">
                    {/* Recent searches */}
                    {recentSearches.length > 0 && (
                      <div className="mb-2">
                        <div className="px-5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim">
                          Recent
                        </div>
                        {recentSearches.map((search) => (
                          <button
                            key={search}
                            onClick={() => setQuery(search)}
                            className="w-full flex items-center gap-3 px-5 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim/50 shrink-0" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span className="text-[0.85rem] text-muted">{search}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Category quick links */}
                    <div>
                      <div className="px-5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim">
                        Categories
                      </div>
                      <div className="px-5 py-2 flex flex-wrap gap-2">
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            onClick={() => navigateToCategory(cat)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12] transition-all text-[0.8rem] text-muted hover:text-foreground"
                          >
                            <span aria-hidden="true">{categoryIcons[cat] || '🎮'}</span>
                            <span>{cat}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
