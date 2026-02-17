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
      <h2 className="text-2xl font-bold mb-6">Recently Played</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {recentGames.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </section>
  );
}
