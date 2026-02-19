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
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/[0.06]" />
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          You might also like
        </h2>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/[0.06]" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {related.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </section>
  );
}
