'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Game } from '@/types/game';
import { useRef, useState } from 'react';

const difficultyDot: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

export default function GameCard({ game }: { game: Game }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);

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
  };

  return (
    <Link
      href={`/games/${game.slug}`}
      className="group block bg-card border border-white/[0.06] rounded-[14px] overflow-hidden card-glow hover:border-white/[0.1] transition-all duration-300 hover:-translate-y-1 focus-visible:-translate-y-1"
      style={{
        '--glow-color': `${game.color}20`,
      } as React.CSSProperties}
      aria-label={`Play ${game.title} — ${game.difficulty} difficulty`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="aspect-[4/3] relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${game.color}22, ${game.color}44)` }}
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#111024] via-transparent to-transparent pointer-events-none" />
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
      </div>
      {/* Card body */}
      <div className="p-3">
        <h3 className="font-semibold text-[0.85rem] text-foreground group-hover:text-accent transition-colors truncate">
          {game.title}
        </h3>
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
          <span
            className="w-[5px] h-[5px] rounded-full ml-auto shrink-0"
            style={{ background: difficultyDot[game.difficulty] || '#9896a8' }}
            aria-label={`${game.difficulty} difficulty`}
          />
        </div>
      </div>
    </Link>
  );
}
