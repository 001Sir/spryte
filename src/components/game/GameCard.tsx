'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Game } from '@/types/game';
import { useRef, useState, useEffect, useCallback } from 'react';
import { getHighScore } from '@/lib/highscores';
import { useFavorites } from '@/hooks/useFavorites';
import { getGameAchievements, getEarnedAchievements } from '@/lib/achievements';

const difficultyDot: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

type CardSize = 'default' | 'large' | 'wide';

export function GameCardSkeleton({ size = 'default' }: { size?: CardSize }) {
  return (
    <div className={`bg-card border border-white/[0.06] rounded-[14px] overflow-hidden ${size === 'large' ? 'h-full' : ''}`}>
      <div className={`${size === 'large' ? 'aspect-[4/3]' : size === 'wide' ? 'aspect-[16/7]' : 'aspect-[4/3]'} bg-white/[0.02] animate-skeleton-pulse`} />
      <div className="p-3 space-y-2">
        <div className="h-4 w-2/3 bg-white/[0.04] rounded animate-skeleton-pulse" />
        <div className="h-3 w-full bg-white/[0.03] rounded animate-skeleton-pulse" />
        <div className="h-3 w-1/2 bg-white/[0.03] rounded animate-skeleton-pulse" />
      </div>
    </div>
  );
}

export default function GameCard({ game, size = 'default' }: { game: Game; size?: CardSize }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [achievementCount, setAchievementCount] = useState({ earned: 0, total: 0 });
  const { isFavorite, toggleFavorite } = useFavorites();
  const favorited = isFavorite(game.slug);

  useEffect(() => {
    setHighScore(getHighScore(game.slug));
    const gameAchievements = getGameAchievements(game.slug);
    const earned = getEarnedAchievements();
    const earnedCount = gameAchievements.filter((a) => earned[a.id]).length;
    setAchievementCount({ earned: earnedCount, total: gameAchievements.length });
  }, [game.slug]);

  const handleMouseEnter = () => {
    if (game.preview && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
      setVideoReady(true);
    }
  };

  const handleMouseLeave = () => {
    if (game.preview && videoRef.current) {
      videoRef.current.pause();
      setVideoReady(false);
    }
    // Reset tilt
    if (cardRef.current) {
      cardRef.current.style.transform = '';
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateY(-4px)`;
  }, []);

  return (
    <Link
      ref={cardRef}
      href={`/games/${game.slug}`}
      className={`group block bg-card border border-white/[0.06] rounded-[14px] overflow-hidden card-glow hover:border-white/[0.1] focus-visible:-translate-y-1 ${size === 'large' ? 'h-full' : ''}`}
      style={{
        '--glow-color': `${game.color}30`,
        transition: 'box-shadow 0.4s cubic-bezier(0.16,1,0.3,1), border-color 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.2s ease-out',
      } as React.CSSProperties}
      aria-label={`Play ${game.title} — ${game.difficulty} difficulty`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      <div
        className={`${size === 'large' ? 'aspect-[4/3]' : size === 'wide' ? 'aspect-[16/7]' : 'aspect-[4/3]'} relative overflow-hidden`}
        style={{
          background: `linear-gradient(135deg, ${game.color}22, ${game.color}44)`,
          viewTransitionName: `game-thumb-${game.slug}`,
        }}
      >
        {/* Static thumbnail */}
        <Image
          src={game.thumbnail}
          alt={`${game.title} thumbnail`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
          className={`object-cover transition-all duration-500 group-hover:scale-[1.06] ${
            game.preview && videoReady ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ transitionTimingFunction: 'var(--ease-cinematic)' }}
        />
        {/* Video preview on hover */}
        {game.preview && (
          <video
            ref={videoRef}
            src={game.preview}
            muted
            loop
            playsInline
            preload="none"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              videoReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
        {/* Gradient from card bg fading up */}
        <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />
        {/* Accent play button — scales in on hover */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2] play-btn-hover">
          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center shadow-[0_4px_16px_rgba(233,69,96,0.4)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" className="ml-0.5" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
        {/* Badges - top left */}
        <div className="absolute top-2 left-2 flex gap-1 z-[2]">
          {game.featured && (
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-md backdrop-blur-md bg-accent/20 text-accent-hover border border-accent/20">
              Featured
            </span>
          )}
          {game.isNew && (
            <span className="text-[10px] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-md backdrop-blur-md bg-green-500/20 text-green-400 border border-green-500/20">
              New
            </span>
          )}
        </div>
        {/* Achievement badge - bottom left */}
        {achievementCount.earned > 0 && (
          <div className="absolute bottom-2 left-2 z-[2] badge-slide">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-md bg-purple-500/20 text-purple-400 border border-purple-500/20">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
              </svg>
              {achievementCount.earned}/{achievementCount.total}
            </span>
          </div>
        )}
        {/* High score badge - top right */}
        {highScore > 0 && (
          <div className="absolute top-2 right-2 z-[2] badge-slide">
            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md backdrop-blur-md bg-amber-500/20 text-amber-400 border border-amber-500/20">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              {highScore.toLocaleString()}
            </span>
          </div>
        )}
      </div>
      {/* Card body */}
      <div className="p-3">
        <div className="flex items-center gap-1">
          <h3 className="font-semibold text-[0.85rem] text-foreground group-hover:text-accent transition-colors truncate flex-1">
            {game.title}
          </h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(game.slug);
            }}
            className={`shrink-0 p-1 rounded-full transition-all duration-200 hover:scale-110 ${
              favorited ? 'text-rose-400' : 'text-dim/40 hover:text-rose-400/60'
            }`}
            aria-label={favorited ? `Remove ${game.title} from favorites` : `Add ${game.title} to favorites`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={favorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>
        </div>
        <p className="text-[0.7rem] text-dim mt-1 line-clamp-2 leading-relaxed">{game.description}</p>
        {/* Footer: tags + difficulty */}
        <div className="flex items-center gap-1.5 mt-2">
          {game.categories.map((cat) => (
            <span
              key={cat}
              className="text-[0.6rem] text-dim px-2 py-0.5 rounded bg-white/[0.04]"
            >
              {cat}
            </span>
          ))}
          <span className="flex items-center gap-1 ml-auto shrink-0">
            <span
              className="w-[5px] h-[5px] rounded-full"
              style={{ background: difficultyDot[game.difficulty] || '#9896a8' }}
            />
            <span
              className="text-[0.6rem]"
              style={{ color: difficultyDot[game.difficulty] || '#9896a8' }}
            >
              {game.difficulty}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
