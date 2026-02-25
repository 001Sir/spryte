'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllCategories } from '@/data/games';
import { categoryColors, categoryIcons } from '@/data/categories';
import Settings from '@/components/ui/Settings';
import CommandPalette from '@/components/ui/CommandPalette';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const categories = getAllCategories();
  const menuRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    if (mobileOpen) setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to pathname changes
  }, [pathname]);

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

  const closeMobile = () => setMobileOpen(false);

  const isActiveCategory = (cat: string) =>
    pathname === `/category/${cat.toLowerCase()}`;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-400 ${
        scrolled
          ? 'bg-[#06050e]/92 backdrop-blur-xl border-b border-white/[0.06]'
          : 'bg-transparent border-b border-transparent'
      }`}
      role="navigation"
      aria-label="Main navigation"
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 h-16 flex items-center justify-between gap-4">
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

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8" role="list" aria-label="Navigation">
          <Link
            href="/"
            role="listitem"
            className={`relative text-[0.85rem] font-medium transition-colors py-1 ${
              pathname === '/'
                ? 'text-foreground'
                : 'text-dim hover:text-foreground'
            }`}
            aria-current={pathname === '/' ? 'page' : undefined}
          >
            Home
            {pathname === '/' && (
              <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </Link>
          <Link
            href="/games"
            role="listitem"
            className={`relative text-[0.85rem] font-medium transition-colors py-1 ${
              pathname === '/games'
                ? 'text-foreground'
                : 'text-dim hover:text-foreground'
            }`}
            aria-current={pathname === '/games' ? 'page' : undefined}
          >
            All Games
            {pathname === '/games' && (
              <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-accent rounded-full" />
            )}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat.toLowerCase()}`}
              role="listitem"
              className={`relative text-[0.85rem] font-medium transition-colors py-1 ${
                isActiveCategory(cat)
                  ? 'text-foreground'
                  : 'text-dim hover:text-foreground'
              }`}
              aria-current={isActiveCategory(cat) ? 'page' : undefined}
            >
              {cat}
              {isActiveCategory(cat) && (
                <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-accent rounded-full" />
              )}
            </Link>
          ))}
        </div>

        {/* Desktop right-side buttons */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Stats icon */}
          <Link
            href="/stats"
            className="p-2 text-dim hover:text-foreground transition-colors rounded-lg hover:bg-white/[0.04]"
            aria-label="Statistics"
            title="Statistics"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 20V10M12 20V4M6 20v-6" />
            </svg>
          </Link>
          {/* Achievements icon */}
          <Link
            href="/achievements"
            className="p-2 text-dim hover:text-foreground transition-colors rounded-lg hover:bg-white/[0.04]"
            aria-label="Achievements"
            title="Achievements"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V12M14 22V12" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </Link>
          {/* Settings */}
          <Settings />
          {/* Search — Command Palette */}
          <CommandPalette />
        </div>

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

      {/* Mobile full-screen slide-in panel */}
      {mobileOpen && (
        <>
          {/* Backdrop with blur */}
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={closeMobile}
          />
          <div
            id="mobile-menu"
            ref={menuRef}
            className="fixed top-0 right-0 bottom-0 w-[85vw] max-w-[360px] z-50 bg-surface border-l border-white/[0.06] md:hidden overflow-y-auto"
            style={{
              animation: 'slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            role="menu"
          >
            {/* Close button */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <span className="text-sm font-semibold text-foreground">Menu</span>
              <button
                onClick={closeMobile}
                className="p-2 text-dim hover:text-foreground transition-colors rounded-lg"
                aria-label="Close menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Mobile search */}
              <Link
                href="/search"
                onClick={closeMobile}
                className="flex items-center gap-2.5 px-4 py-3 text-sm rounded-xl text-muted hover:text-foreground bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                role="menuitem"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                Search games...
              </Link>

              {/* Quick links */}
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim mb-3">Navigation</p>
                <div className="space-y-1">
                  <Link href="/" onClick={closeMobile} role="menuitem" className="flex items-center gap-3 px-4 py-3 text-sm rounded-xl text-foreground font-medium hover:bg-white/[0.04] transition-colors min-h-[44px]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                    Home
                  </Link>
                  <Link href="/games" onClick={closeMobile} role="menuitem" className="flex items-center gap-3 px-4 py-3 text-sm rounded-xl text-foreground font-medium hover:bg-white/[0.04] transition-colors min-h-[44px]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                    All Games
                  </Link>
                </div>
              </div>

              {/* Categories */}
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim mb-3">Categories</p>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => {
                    const color = categoryColors[cat] || '#e94560';
                    const icon = categoryIcons[cat] || '🎮';
                    return (
                      <Link
                        key={cat}
                        href={`/category/${cat.toLowerCase()}`}
                        onClick={closeMobile}
                        role="menuitem"
                        className={`flex items-center gap-2.5 px-3 py-3 text-sm rounded-xl transition-colors min-h-[48px] ${
                          isActiveCategory(cat)
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-muted hover:text-foreground bg-white/[0.04] hover:bg-white/[0.06]'
                        }`}
                        aria-current={isActiveCategory(cat) ? 'page' : undefined}
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <span className="text-base" aria-hidden="true">{icon}</span>
                        {cat}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Stats / Achievements / Settings row */}
              <div>
                <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim mb-3">More</p>
                <div className="flex items-center gap-2">
                  <Link
                    href="/stats"
                    onClick={closeMobile}
                    role="menuitem"
                    className="flex-1 flex flex-col items-center gap-1.5 px-3 py-3 text-sm rounded-xl text-muted hover:text-foreground bg-white/[0.04] hover:bg-white/[0.06] transition-colors min-h-[56px] justify-center"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>
                    <span className="text-[0.7rem]">Stats</span>
                  </Link>
                  <Link
                    href="/achievements"
                    onClick={closeMobile}
                    role="menuitem"
                    className="flex-1 flex flex-col items-center gap-1.5 px-3 py-3 text-sm rounded-xl text-muted hover:text-foreground bg-white/[0.04] hover:bg-white/[0.06] transition-colors min-h-[56px] justify-center"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 22V12M14 22V12" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>
                    <span className="text-[0.7rem]">Achievements</span>
                  </Link>
                  <div className="flex-1 flex flex-col items-center gap-1.5 px-3 py-3 text-sm rounded-xl text-muted bg-white/[0.04] min-h-[56px] justify-center">
                    <Settings />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </nav>
  );
}
