import { Game } from '@/types/game';
import GameCard from './GameCard';

interface GameGridProps {
  games: Game[];
  title?: string;
}

export default function GameGrid({ games, title }: GameGridProps) {
  return (
    <section>
      {title && (
        <h2 className="text-xl font-bold mb-4">{title}</h2>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </section>
  );
}
