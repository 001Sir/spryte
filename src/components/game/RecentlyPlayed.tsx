'use client';

import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';
import { getGameBySlug } from '@/data/games';
import GameCard from './GameCard';

export default function RecentlyPlayed() {
  const { recent } = useRecentlyPlayed();

  const recentGames = recent
    .map((slug) => getGameBySlug(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getGameBySlug>>[];

  if (recentGames.length === 0) return null;

  return (
    <section className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400 shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        <h2 className="text-2xl font-bold text-foreground">Recently Played</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-white/[0.06] to-transparent" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-scroll-x">
        {recentGames.map((game) => (
          <div key={game.slug} className="shrink-0 w-[200px]">
            <GameCard game={game} />
          </div>
        ))}
      </div>
    </section>
  );
}
