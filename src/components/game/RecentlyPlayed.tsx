'use client';

import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';
import { getGameBySlug } from '@/data/games';
import GameCard from './GameCard';
import ScrollableRow from '@/components/layout/ScrollableRow';
import Link from 'next/link';
import Image from 'next/image';

export default function RecentlyPlayed() {
  const { recent } = useRecentlyPlayed();

  const recentGames = recent
    .map((slug) => getGameBySlug(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getGameBySlug>>[];

  if (recentGames.length === 0) return null;

  const lastPlayed = recentGames[0];
  const otherGames = recentGames.slice(1);

  return (
    <section className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <h2 className="text-2xl font-bold text-foreground">Continue Playing</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>

      {/* Continue Playing — prominent card for last played game */}
      <Link
        href={`/games/${lastPlayed.slug}`}
        className="group block rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.12] bg-card mb-6 transition-all duration-300 card-glow"
        style={{ '--glow-color': `${lastPlayed.color}20` } as React.CSSProperties}
        aria-label={`Continue playing ${lastPlayed.title}`}
      >
        <div className="flex flex-col sm:flex-row">
          <div
            className="relative w-full sm:w-[280px] aspect-[16/10] sm:aspect-auto sm:h-auto shrink-0 overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${lastPlayed.color}22, ${lastPlayed.color}44)` }}
          >
            <Image
              src={lastPlayed.thumbnail}
              alt={`${lastPlayed.title} thumbnail`}
              fill
              sizes="280px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ transitionTimingFunction: 'var(--ease-cinematic)' }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#111024]/80 hidden sm:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#111024] via-transparent to-transparent sm:hidden" />
            {/* Play overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-[0_4px_20px_rgba(233,69,96,0.4)] transition-transform duration-300 group-hover:scale-110">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="white" className="ml-0.5" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="flex-1 p-5 flex flex-col justify-center">
            <span className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-blue-400 mb-1.5">Last Played</span>
            <h3 className="text-lg font-bold text-foreground group-hover:text-accent transition-colors">
              {lastPlayed.title}
            </h3>
            <p className="text-sm text-muted mt-1 line-clamp-2 leading-relaxed">{lastPlayed.description}</p>
            <div className="flex items-center gap-3 mt-3">
              {lastPlayed.categories.map((cat) => (
                <span key={cat} className="text-[0.65rem] text-dim px-2 py-0.5 rounded bg-white/[0.04]">{cat}</span>
              ))}
            </div>
          </div>
        </div>
      </Link>

      {/* Other recently played */}
      {otherGames.length > 0 && (
        <ScrollableRow className="flex gap-4 overflow-x-auto pb-2 snap-scroll-x">
          {otherGames.map((game) => (
            <div key={game.slug} className="shrink-0 w-[200px]">
              <GameCard game={game} />
            </div>
          ))}
        </ScrollableRow>
      )}
    </section>
  );
}
