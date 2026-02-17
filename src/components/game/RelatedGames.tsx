import { Game } from '@/types/game';
import { games } from '@/data/games';
import GameCard from './GameCard';

export default function RelatedGames({ currentGame }: { currentGame: Game }) {
  const related = games
    .filter(
      (g) =>
        g.slug !== currentGame.slug &&
        g.categories.some((c) => currentGame.categories.includes(c))
    )
    .slice(0, 4);

  if (related.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold mb-4">Related Games</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {related.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </section>
  );
}
