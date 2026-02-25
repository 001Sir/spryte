'use client';

import { Game } from '@/types/game';
import GameCard from './GameCard';
import { useInView } from '@/hooks/useInView';

interface GameGridProps {
  games: Game[];
  title?: string;
}

export default function GameGrid({ games, title }: GameGridProps) {
  const { ref, inView } = useInView();

  return (
    <section>
      {title && (
        <h2 className="text-xl font-bold mb-4">{title}</h2>
      )}
      <div
        ref={ref}
        className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 stagger-fade ${inView ? 'in-view' : ''}`}
      >
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </section>
  );
}
