'use client';

import GameCard from '@/components/game/GameCard';
import { useInView } from '@/hooks/useInView';
import type { Game } from '@/types/game';

interface BentoGameGridProps {
  games: Game[];
}

export default function BentoGameGrid({ games }: BentoGameGridProps) {
  const { ref, inView } = useInView();

  // First featured game gets 2x2, new games get 2x1, rest are 1x1
  const featured = games.find((g) => g.featured);
  const newGames = games.filter((g) => g.isNew && g !== featured);
  const regularGames = games.filter((g) => !g.featured && !g.isNew);

  return (
    <div
      ref={ref}
      className={`grid grid-cols-2 md:grid-cols-4 gap-4 stagger-fade ${inView ? 'in-view' : ''}`}
    >
      {/* Featured game — 2×2 span */}
      {featured && (
        <div className="col-span-2 row-span-2">
          <GameCard game={featured} size="large" />
        </div>
      )}

      {/* New games — 2×1 span */}
      {newGames.map((game) => (
        <div key={game.slug} className="col-span-2 md:col-span-2">
          <GameCard game={game} size="wide" />
        </div>
      ))}

      {/* Regular games — 1×1 */}
      {regularGames.map((game) => (
        <div key={game.slug}>
          <GameCard game={game} />
        </div>
      ))}
    </div>
  );
}
