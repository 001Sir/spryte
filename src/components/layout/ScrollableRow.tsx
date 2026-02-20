'use client';

import { useRef, useState, useEffect, ReactNode } from 'react';

export default function ScrollableRow({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      ro.disconnect();
    };
  }, []);

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.7;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <div className="relative group/scroll">
      <div
        ref={scrollRef}
        className={className}
      >
        {children}
      </div>

      {/* Mobile fade edges — visible on touch devices, hidden on hover-capable */}
      {canScrollLeft && (
        <div
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-[5] md:hidden"
          style={{ background: 'linear-gradient(to right, var(--color-background), transparent)' }}
        />
      )}
      {canScrollRight && (
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-[5] md:hidden"
          style={{ background: 'linear-gradient(to left, var(--color-background), transparent)' }}
        />
      )}

      {/* Desktop arrow buttons — visible on hover */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-white/[0.1] text-foreground items-center justify-center shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200 hover:bg-card hover:border-white/[0.2]"
          aria-label="Scroll left"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 w-10 h-10 rounded-full bg-card/90 backdrop-blur-sm border border-white/[0.1] text-foreground items-center justify-center shadow-lg opacity-0 group-hover/scroll:opacity-100 transition-opacity duration-200 hover:bg-card hover:border-white/[0.2]"
          aria-label="Scroll right"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
