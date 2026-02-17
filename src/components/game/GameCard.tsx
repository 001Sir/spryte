import Link from 'next/link';
import { Game } from '@/types/game';

const difficultyDot: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

export default function GameCard({ game }: { game: Game }) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className="group block bg-card border border-border rounded-xl overflow-hidden hover:border-accent/50 hover:bg-card-hover transition-all duration-200 hover:scale-[1.02]"
    >
      <div
        className="aspect-[4/3] flex items-center justify-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${game.color}22, ${game.color}44)` }}
      >
        <img
          src={game.thumbnail}
          alt={game.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {/* Badges - top left */}
        <div className="absolute top-2 left-2 flex gap-1">
          {game.featured && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-accent/90 text-white">
              Featured
            </span>
          )}
          {game.isNew && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500 text-white uppercase tracking-wide">
              New
            </span>
          )}
        </div>
        {/* Category badges - top right */}
        <div className="absolute top-2 right-2 flex gap-1">
          {game.categories.map((cat) => (
            <span
              key={cat}
              className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 text-white/70"
            >
              {cat}
            </span>
          ))}
        </div>
        {/* Difficulty badge - bottom left */}
        <div className="absolute bottom-2 left-2">
          <span
            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/50 backdrop-blur-sm"
            style={{ color: difficultyDot[game.difficulty] || '#888' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: difficultyDot[game.difficulty] || '#888' }}
            />
            {game.difficulty}
          </span>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm text-foreground group-hover:text-accent transition-colors">
          {game.title}
        </h3>
        <p className="text-xs text-muted mt-1 line-clamp-2">{game.description}</p>
      </div>
    </Link>
  );
}
