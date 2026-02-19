'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllCategories } from '@/data/games';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const router = useRouter();
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

  // Escape key to close mobile menu + "/" shortcut to search
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen) {
      setMobileOpen(false);
      hamburgerRef.current?.focus();
    }
    if (e.key === '/' && !mobileOpen) {
      const active = document.activeElement;
      const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable);
      if (!isInput) {
        e.preventDefault();
        router.push('/search');
      }
    }
  }, [mobileOpen, router]);

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

        {/* Desktop categories */}
        <div className="hidden md:flex items-center gap-8" role="list" aria-label="Game categories">
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

        {/* Desktop search button */}
        <Link
          href="/search"
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-[10px] bg-white/[0.04] border border-white/[0.06] text-dim hover:bg-white/[0.08] hover:text-foreground transition-all duration-200 text-[0.8rem]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          Search
          <kbd className="hidden lg:inline-block text-[0.65rem] px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.06] text-dim font-mono">/</kbd>
        </Link>

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
          className="md:hidden border-t border-white/[0.06] frosted-glass animate-slide-down"
          role="menu"
        >
          <div className="max-w-7xl mx-auto px-4 py-4 space-y-3">
            {/* Mobile search */}
            <Link
              href="/search"
              onClick={closeMobile}
              className="sm:hidden flex items-center gap-2 px-3 py-2.5 text-sm rounded-lg text-muted hover:text-foreground bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
              role="menuitem"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              Search games...
            </Link>

            {/* Home link in mobile menu */}
            <Link
              href="/"
              onClick={closeMobile}
              className="block px-3 py-2.5 text-sm rounded-lg text-center text-foreground font-medium bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
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
                      : 'text-muted hover:text-foreground bg-white/[0.04] hover:bg-white/[0.06]'
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
