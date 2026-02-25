'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Game } from '@/types/game';
import type { ReactNode } from 'react';
import { useInView } from '@/hooks/useInView';
import { useFavorites } from '@/hooks/useFavorites';

const difficultyDot: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

interface BentoMosaicProps {
  games: Game[];
  dailyChallenge: ReactNode;
}

/** Single bento tile — renders differently based on span size */
function BentoTile({ game, span, priority = false }: { game: Game; span: '2x2' | '2x1' | '1x1'; priority?: boolean }) {
  const isLarge = span === '2x2';
  const isWide = span === '2x1';
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(game.slug);

  return (
    <Link
      href={`/games/${game.slug}`}
      className={`group relative rounded-2xl overflow-hidden bg-card border border-white/[0.04] card-glow transition-all duration-[0.35s] hover:-translate-y-[3px] hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] hover:border-white/[0.08] ${
        isLarge ? 'col-span-2 row-span-2' : isWide ? 'col-span-2' : ''
      }`}
      style={{ '--glow-color': `${game.color}20` } as React.CSSProperties}
      aria-label={`Play ${game.title}`}
    >
      {/* Thumbnail */}
      <Image
        src={game.thumbnail}
        alt={`${game.title}`}
        fill
        priority={priority}
        sizes={isLarge ? '(max-width: 768px) 100vw, 460px' : isWide ? '(max-width: 768px) 100vw, 460px' : '(max-width: 768px) 50vw, 230px'}
        className="object-cover transition-transform duration-[0.6s] group-hover:scale-[1.05]"
        style={{
          transitionTimingFunction: 'var(--ease-cinematic)',
          viewTransitionName: `game-thumb-${game.slug}`,
        }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#06050ef0] via-[#06050eaa] via-50% to-transparent" />

      {/* Play button — appears on hover */}
      <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-accent/90 flex items-center justify-center opacity-0 scale-[0.8] group-hover:opacity-100 group-hover:scale-100 transition-all duration-300 shadow-[0_4px_16px_rgba(233,69,96,0.4)] z-10">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="white" className="ml-0.5"><path d="M8 5v14l11-7z" /></svg>
      </div>

      {/* Favorite button — top left on large/wide, bottom right on 1x1 */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(game.slug);
        }}
        className={`absolute z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 ${
          isLarge || isWide ? 'top-3 left-3' : 'top-2.5 left-2.5'
        } ${
          favorited
            ? 'bg-rose-500/20 backdrop-blur-md text-rose-400'
            : 'bg-black/30 backdrop-blur-md text-white/50 opacity-0 group-hover:opacity-100 hover:text-rose-400'
        }`}
        aria-label={favorited ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* Content overlay at bottom */}
      <div className={`absolute bottom-0 left-0 right-0 z-[2] backdrop-blur-[2px] ${isLarge ? 'p-6' : isWide ? 'p-4' : 'p-3.5'}`}>
        {/* Badges */}
        {(game.featured || game.isNew) && (
          <div className="flex gap-1.5 mb-1.5">
            {game.featured && (
              <span
                className={`${isLarge ? 'text-[10px] px-2.5 py-1' : 'text-[8px] px-2 py-0.5'} font-bold uppercase tracking-[0.08em] rounded backdrop-blur-md`}
                style={{ background: `${game.color}25`, color: game.color, border: `1px solid ${game.color}25` }}
              >
                Featured
              </span>
            )}
            {game.isNew && (
              <span className={`${isLarge ? 'text-[10px] px-2.5 py-1' : 'text-[8px] px-2 py-0.5'} font-bold uppercase tracking-[0.08em] rounded backdrop-blur-md bg-green-500/15 text-green-400 border border-green-500/15`}>
                New
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h3 className={`font-bold text-foreground ${isLarge ? 'text-[1.6rem] tracking-tight' : isWide ? 'text-lg' : 'text-[0.85rem]'}`} style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.7)', ...(isLarge ? { letterSpacing: '-0.02em' } : undefined) }}>
          {game.title}
        </h3>

        {/* Description — only on large and wide */}
        {(isLarge || isWide) && (
          <p className={`text-[#b0aec0] mt-1 line-clamp-2 leading-relaxed ${isLarge ? 'text-[0.85rem]' : 'text-[0.75rem]'}`} style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            {game.description}
          </p>
        )}

        {/* Meta */}
        <div className={`flex items-center gap-1.5 ${isLarge || isWide ? 'mt-2' : 'mt-1'}`}>
          <span
            className="w-[5px] h-[5px] rounded-full"
            style={{ background: difficultyDot[game.difficulty] || '#9896a8' }}
          />
          <span className="text-[0.65rem] text-dim">
            {game.difficulty} · {game.categories[0]}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function BentoMosaic({ games, dailyChallenge }: BentoMosaicProps) {
  const { ref, inView } = useInView();

  const featured = games.find((g) => g.featured);
  const newGames = games.filter((g) => g.isNew && g !== featured);
  const regularGames = games.filter((g) => !g.featured && !g.isNew);

  // Pick two regular games for wide slots to break up the 1x1 wall
  const wideGame1 = regularGames[0];
  const wideGame2 = regularGames[1];
  const gridGames = regularGames.slice(2);

  // Insert a second wide card mid-grid to break up the 1x1 monotony
  const midPoint = Math.ceil(gridGames.length / 2);
  const firstHalf = gridGames.slice(0, midPoint);
  const secondHalf = gridGames.slice(midPoint);

  return (
    <div
      ref={ref}
      className={`grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 auto-rows-[180px] gap-3 mb-16 stagger-fade ${inView ? 'in-view' : ''}`}
    >
      {/* 2×2 Hero — featured game */}
      {featured && <BentoTile game={featured} span="2x2" priority />}

      {/* 2×1 Wide — new games */}
      {newGames.map((game) => (
        <BentoTile key={game.slug} game={game} span="2x1" />
      ))}

      {/* Daily Challenge — 2×1 special card */}
      <div className="col-span-2 rounded-2xl overflow-hidden border border-white/[0.04] hover:-translate-y-[3px] hover:shadow-[0_16px_48px_rgba(0,0,0,0.5)] hover:border-accent/[0.15] transition-all duration-[0.35s] cursor-default">
        {dailyChallenge}
      </div>

      {/* 2×1 Wide — first regular game */}
      {wideGame1 && <BentoTile game={wideGame1} span="2x1" />}

      {/* 1×1 — first half */}
      {firstHalf.map((game) => (
        <BentoTile key={game.slug} game={game} span="1x1" />
      ))}

      {/* 2×1 Wide — second regular game mid-grid to break monotony */}
      {wideGame2 && <BentoTile game={wideGame2} span="2x1" />}

      {/* 1×1 — second half */}
      {secondHalf.map((game) => (
        <BentoTile key={game.slug} game={game} span="1x1" />
      ))}
    </div>
  );
}
