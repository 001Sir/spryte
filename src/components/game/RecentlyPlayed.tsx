'use client';

import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';
import { getGameBySlug } from '@/data/games';
import Link from 'next/link';
import Image from 'next/image';
import ScrollableRow from '@/components/layout/ScrollableRow';

const difficultyDot: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

export default function RecentlyPlayed() {
  const { recent } = useRecentlyPlayed();

  const recentGames = recent
    .map((slug) => getGameBySlug(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getGameBySlug>>[];

  if (recentGames.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2.5 mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <h2 className="text-[0.85rem] font-bold uppercase tracking-[0.06em] text-foreground">Continue Playing</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>
      <ScrollableRow className="flex gap-3 overflow-x-auto pb-2 snap-scroll-x">
        {recentGames.map((game) => (
          <Link
            key={game.slug}
            href={`/games/${game.slug}`}
            className="group shrink-0 relative w-[180px] h-[100px] rounded-xl overflow-hidden border border-white/[0.04] card-glow hover:-translate-y-[2px] hover:border-white/[0.08] transition-all duration-300"
            style={{ '--glow-color': `${game.color}20` } as React.CSSProperties}
            aria-label={`Continue playing ${game.title}`}
          >
            <Image
              src={game.thumbnail}
              alt={game.title}
              fill
              sizes="180px"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
              style={{ transitionTimingFunction: 'var(--ease-cinematic)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#06050ef0] via-[#06050eaa] via-50% to-transparent" />
            {/* Play icon */}
            <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-accent/90 flex items-center justify-center opacity-0 scale-[0.8] group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-[0_4px_16px_rgba(233,69,96,0.4)] z-10">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="white" className="ml-0.5"><path d="M8 5v14l11-7z" /></svg>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2.5 z-[2]">
              <h3 className="text-[0.75rem] font-bold text-foreground truncate" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)' }}>{game.title}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-[4px] h-[4px] rounded-full" style={{ background: difficultyDot[game.difficulty] || '#9896a8' }} />
                <span className="text-[0.6rem] text-dim">{game.difficulty}</span>
              </div>
            </div>
          </Link>
        ))}
      </ScrollableRow>
    </section>
  );
}
