'use client';

import { useFavorites } from '@/hooks/useFavorites';
import { getGameBySlug } from '@/data/games';
import GameCard from './GameCard';
import ScrollableRow from '@/components/layout/ScrollableRow';

export default function Favorites() {
  const { favorites } = useFavorites();

  const favoriteGames = favorites
    .map((slug) => getGameBySlug(slug))
    .filter(Boolean) as NonNullable<ReturnType<typeof getGameBySlug>>[];

  if (favoriteGames.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-400 shrink-0" aria-hidden="true">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Favorites</h2>
        <span className="text-[0.65rem] text-dim">{favoriteGames.length}</span>
      </div>
      <ScrollableRow className="flex gap-3 overflow-x-auto pb-2 snap-scroll-x">
        {favoriteGames.map((game) => (
          <div key={game.slug} className="shrink-0 w-[180px]">
            <GameCard game={game} />
          </div>
        ))}
      </ScrollableRow>
    </section>
  );
}
