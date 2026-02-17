'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { getAllCategories } from '@/data/games';

export default function Navbar() {
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const categories = getAllCategories();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setMobileOpen(false);
    }
  };

  const closeMobile = () => setMobileOpen(false);

  const isActiveCategory = (cat: string) =>
    pathname === `/category/${cat.toLowerCase()}`;

  return (
    <nav
      className={`sticky top-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md border-b transition-colors duration-300 ${
        scrolled ? 'border-accent/30' : 'border-border'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={closeMobile}>
          <span className="text-2xl font-black bg-gradient-to-r from-accent to-[#ff7eb3] bg-clip-text text-transparent">
            Spryte
          </span>
          <span className="text-lg font-semibold text-foreground hidden sm:block">
            Games
          </span>
        </Link>

        {/* Desktop categories */}
        <div className="hidden md:flex items-center gap-1">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat.toLowerCase()}`}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isActiveCategory(cat)
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-muted hover:text-foreground hover:bg-card'
              }`}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden sm:block flex-1 max-w-xs">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games..."
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </form>

        {/* Hamburger button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-muted hover:text-foreground transition-colors"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-[#0a0a0f]/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="sm:hidden">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games..."
                className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              />
            </form>

            {/* Mobile category links */}
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/category/${cat.toLowerCase()}`}
                  onClick={closeMobile}
                  className={`px-3 py-2.5 text-sm rounded-lg transition-colors text-center ${
                    isActiveCategory(cat)
                      ? 'bg-accent/15 text-accent font-medium'
                      : 'text-muted hover:text-foreground bg-card hover:bg-card-hover'
                  }`}
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
