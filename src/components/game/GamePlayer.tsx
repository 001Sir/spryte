'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback } from 'react';

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="w-full max-w-[800px] space-y-3 p-6">
        <div className="animate-skeleton-pulse bg-white/5 rounded-lg h-[300px] w-full" />
        <div className="flex gap-3">
          <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-24" />
          <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-32" />
          <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

const gameComponents: Record<string, ReturnType<typeof dynamic>> = {
  'gravity-well': dynamic(() => import('@/games/gravity-well/GravityWellGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
  'chroma-flood': dynamic(() => import('@/games/chroma-flood/ChromaFloodGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
  'echo-chamber': dynamic(() => import('@/games/echo-chamber/EchoChamberGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
  'terravore': dynamic(() => import('@/games/terravore/TerravoreGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
  'pulse-weaver': dynamic(() => import('@/games/pulse-weaver/PulseWeaverGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
  'orbit-keeper': dynamic(() => import('@/games/orbit-keeper/OrbitKeeperGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
  'symbiosis': dynamic(() => import('@/games/symbiosis/SymbiosisGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
  'drift': dynamic(() => import('@/games/drift/DriftGame'), { ssr: false, loading: () => <LoadingSkeleton /> }),
};

export default function GamePlayer({ slug }: { slug: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const GameComponent = gameComponents[slug];

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const onFSChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', onFSChange);
      return () => document.removeEventListener('fullscreenchange', onFSChange);
    },
    []
  );

  const toggleFullscreen = () => {
    const el = document.getElementById('game-container');
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen();
    }
  };

  if (!GameComponent) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center">
        <p className="text-muted">Game not found</p>
      </div>
    );
  }

  return (
    <div>
      <div
        id="game-container"
        ref={containerRef}
        className="relative bg-black rounded-xl overflow-hidden border border-border"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <GameComponent />
        </div>
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors z-10"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
