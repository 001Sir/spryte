'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';
import { SoundEngine } from '@/lib/sounds';

function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full" role="status" aria-label="Loading game">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={48} height={48} className="rounded-full opacity-30 animate-pulse mb-4" aria-hidden="true" />
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
  const [isMuted, setIsMuted] = useState(() => SoundEngine.muted);
  const { addPlayed } = useRecentlyPlayed();
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const GameComponent = gameComponents[slug];

  // Track this game as recently played
  useEffect(() => {
    addPlayed(slug);
  }, [slug, addPlayed]);

  // Track fullscreen state changes (with webkit fallback for Safari)
  useEffect(() => {
    const onFSChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Safari webkit fullscreen API
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, []);

  const toggleFullscreen = () => {
    const el = containerElRef.current;
    if (!el) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Safari webkit fullscreen API
    const doc = document as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Safari webkit fullscreen API
    const elem = el as any;
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    } else {
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      }
    }
  };

  const toggleMute = () => {
    const muted = SoundEngine.toggleMute();
    setIsMuted(muted);
  };

  // Keyboard shortcuts: F = fullscreen, M = mute — only when game container or body is focused
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Only trigger if focus is within the game container or on the body (not in nav/search)
      const container = containerElRef.current;
      if (!container) return;
      const targetNode = e.target as Node;
      if (!container.contains(targetNode) && e.target !== document.body) return;

      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!GameComponent) {
    return (
      <div className="bg-card border border-border rounded-xl p-10 text-center" role="alert">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-muted/30 mb-3" aria-hidden="true">
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
        </svg>
        <p className="text-foreground font-medium mb-1">Game not found</p>
        <p className="text-muted text-sm">This game may have been moved or removed.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        id="game-container"
        ref={containerElRef}
        className="relative bg-black rounded-xl overflow-hidden border border-border"
        tabIndex={-1}
        onClick={() => SoundEngine.ensureResumed()}
        onTouchStart={() => SoundEngine.ensureResumed()}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <GameComponent />
        </div>
        <button
          onClick={toggleMute}
          className="absolute top-3 right-14 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg transition-all duration-200 z-10 flex items-center gap-1.5 text-xs font-medium min-w-[44px] min-h-[44px] border border-white/10 hover:border-white/20"
          aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
          title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
        >
          {isMuted ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5z" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          )}
        </button>
        <button
          onClick={toggleFullscreen}
          className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg transition-all duration-200 z-10 flex items-center gap-1.5 text-xs font-medium min-w-[44px] min-h-[44px] border border-white/10 hover:border-white/20"
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
        Press <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono">F</kbd> fullscreen · <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono">M</kbd> mute · <kbd className="px-1.5 py-0.5 bg-card border border-border rounded text-[10px] font-mono">P</kbd> pause
      </p>
    </div>
  );
}
