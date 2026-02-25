'use client';

import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';
import { getGameBySlug } from '@/data/games';
import GameCard from './GameCard';
import ScrollableRow from '@/components/layout/ScrollableRow';

export default function RecentlyPlayed() {
  const { recent } = useRecentlyPlayed();

  const recentGames = recent
    .map((slug) => getGameBySlug(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getGameBySlug>>[];

  if (recentGames.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Continue Playing</h2>
      </div>
      <ScrollableRow className="flex gap-3 overflow-x-auto pb-2 snap-scroll-x">
        {recentGames.map((game) => (
          <div key={game.slug} className="shrink-0 w-[180px]">
            <GameCard game={game} />
          </div>
        ))}
      </ScrollableRow>
    </section>
  );
}
