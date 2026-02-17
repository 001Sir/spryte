'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';

function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full" role="status" aria-label="Loading game">
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
  const { addPlayed } = useRecentlyPlayed();
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const GameComponent = gameComponents[slug];

  // Track this game as recently played
  useEffect(() => {
    addPlayed(slug);
  }, [slug]);

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerElRef.current = node;
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

  // Keyboard shortcut: F to toggle fullscreen — only when game container or body is focused
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        // Don't trigger if user is typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        // Only trigger if focus is within the game container or on the body (not in nav/search)
        const container = containerElRef.current;
        if (!container) return;
        const targetNode = e.target as Node;
        if (!container.contains(targetNode) && e.target !== document.body) return;
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!GameComponent) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center" role="alert">
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
        tabIndex={-1}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <GameComponent />
        </div>
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white px-3 py-2 rounded-lg transition-colors z-10 flex items-center gap-1.5 text-xs font-medium min-w-[44px] min-h-[44px]"
          aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
          title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
        >
          {isFullscreen ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
              Exit
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
              Fullscreen
            </>
          )}
        </button>
      </div>
      <p className="text-xs text-muted mt-2 text-center">
        Press <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono">F</kbd> to toggle fullscreen when game is focused
      </p>
    </div>
  );
}
