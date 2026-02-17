'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllCategories } from '@/data/games';

export default function Navbar() {
  const [query, setQuery] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [lastPathname, setLastPathname] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const categories = getAllCategories();
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
  }

  // Body scroll lock when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  // Escape key to close mobile menu
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen) {
      setMobileOpen(false);
      hamburgerRef.current?.focus();
    }
  }, [mobileOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={closeMobile}>
          <Image
            src="/logo.png"
            alt="Spryte Games"
            width={40}
            height={40}
            className="rounded-full"
            priority
          />
          <span className="text-lg font-bold text-foreground hidden sm:block">
            Spryte Games
          </span>
        </Link>

        {/* Desktop categories */}
        <div className="hidden md:flex items-center gap-1" role="list" aria-label="Game categories">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat.toLowerCase()}`}
              role="listitem"
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isActiveCategory(cat)
                  ? 'bg-accent/15 text-accent font-medium'
                  : 'text-muted hover:text-foreground hover:bg-card'
              }`}
              aria-current={isActiveCategory(cat) ? 'page' : undefined}
            >
              {cat}
            </Link>
          ))}
        </div>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden sm:block flex-1 max-w-xs" role="search">
          <div className="relative">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games..."
              aria-label="Search games"
              className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </form>

        {/* Hamburger button */}
        <button
          ref={hamburgerRef}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 text-muted hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
        >
          {mobileOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div
          id="mobile-menu"
          ref={menuRef}
          className="md:hidden border-t border-border bg-[#0a0a0f]/95 backdrop-blur-md animate-slide-down"
          role="menu"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="sm:hidden" role="search">
              <div className="relative">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search games..."
                  aria-label="Search games"
                  className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </form>

            {/* Home link in mobile menu */}
            <Link
              href="/"
              onClick={closeMobile}
              className="block px-3 py-2.5 text-sm rounded-lg text-center text-foreground font-medium bg-card hover:bg-card-hover transition-colors"
              role="menuitem"
            >
              Home
            </Link>

            {/* Mobile category links */}
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/category/${cat.toLowerCase()}`}
                  onClick={closeMobile}
                  role="menuitem"
                  className={`px-3 py-2.5 text-sm rounded-lg transition-colors text-center min-h-[44px] flex items-center justify-center ${
                    isActiveCategory(cat)
                      ? 'bg-accent/15 text-accent font-medium'
                      : 'text-muted hover:text-foreground bg-card hover:bg-card-hover'
                  }`}
                  aria-current={isActiveCategory(cat) ? 'page' : undefined}
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
