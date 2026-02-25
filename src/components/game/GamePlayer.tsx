'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRecentlyPlayed } from '@/hooks/useRecentlyPlayed';
import { useGameEvents } from '@/hooks/useGameEvents';
import { SoundEngine } from '@/lib/sounds';
import { incrementPlayCount } from '@/lib/playcounts';
import { getHighScore } from '@/lib/highscores';
import { getGameBySlug } from '@/data/games';
import type { GameEndDetail } from '@/lib/game-events';
import GameRecorder from './GameRecorder';
import ShareScoreButton from '@/components/ui/ShareScoreButton';

function BrandedLoading({ title, color }: { title?: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full gap-4" role="status" aria-label="Loading game">
      <div
        className="w-12 h-12 rounded-full border-2 border-transparent animate-spin"
        style={{
          borderTopColor: color || '#e94560',
          borderRightColor: `${color || '#e94560'}40`,
        }}
      />
      {title && (
        <p className="text-foreground font-semibold text-sm">{title}</p>
      )}
      <p className="text-dim text-xs">
        Press <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[10px] font-mono">F</kbd> for fullscreen, <kbd className="px-1 py-0.5 bg-white/[0.06] rounded text-[10px] font-mono">M</kbd> to mute
      </p>
    </div>
  );
}

const gameComponents: Record<string, ReturnType<typeof dynamic>> = {
  'gravity-well': dynamic(() => import('@/games/gravity-well/GravityWellGame'), { ssr: false, loading: () => <BrandedLoading title="Gravity Well" color="#7c3aed" /> }),
  'chroma-flood': dynamic(() => import('@/games/chroma-flood/ChromaFloodGame'), { ssr: false, loading: () => <BrandedLoading title="Chroma Flood" color="#06b6d4" /> }),
  'echo-chamber': dynamic(() => import('@/games/echo-chamber/EchoChamberGame'), { ssr: false, loading: () => <BrandedLoading title="Echo Chamber" color="#7c3aed" /> }),
  'terravore': dynamic(() => import('@/games/terravore/TerravoreGame'), { ssr: false, loading: () => <BrandedLoading title="Terravore" color="#e94560" /> }),
  'pulse-weaver': dynamic(() => import('@/games/pulse-weaver/PulseWeaverGame'), { ssr: false, loading: () => <BrandedLoading title="Pulse Weaver" color="#e94560" /> }),
  'orbit-keeper': dynamic(() => import('@/games/orbit-keeper/OrbitKeeperGame'), { ssr: false, loading: () => <BrandedLoading title="Orbit Keeper" color="#7c3aed" /> }),
  'symbiosis': dynamic(() => import('@/games/symbiosis/SymbiosisGame'), { ssr: false, loading: () => <BrandedLoading title="Symbiosis" color="#22c55e" /> }),
  'drift': dynamic(() => import('@/games/drift/DriftGame'), { ssr: false, loading: () => <BrandedLoading title="Drift" color="#06b6d4" /> }),
  'spectrum': dynamic(() => import('@/games/spectrum/SpectrumGame'), { ssr: false, loading: () => <BrandedLoading title="Spectrum" color="#f59e0b" /> }),
  'deja-vu': dynamic(() => import('@/games/deja-vu/DejaVuGame'), { ssr: false, loading: () => <BrandedLoading title="Déjà Vu" color="#06b6d4" /> }),
  'slide-devil': dynamic(() => import('@/games/slide-devil/SlideDevilGame'), { ssr: false, loading: () => <BrandedLoading title="Slide Devil" color="#e94560" /> }),
  'whats-missing': dynamic(() => import('@/games/whats-missing/WhatsMissingGame'), { ssr: false, loading: () => <BrandedLoading title="What's Missing?" color="#f59e0b" /> }),
  'cascade': dynamic(() => import('@/games/cascade/CascadeGame'), { ssr: false, loading: () => <BrandedLoading title="Cascade" color="#f59e0b" /> }),
  'ricochet': dynamic(() => import('@/games/ricochet/RicochetGame'), { ssr: false, loading: () => <BrandedLoading title="Ricochet" color="#0ea5e9" /> }),
  'burn': dynamic(() => import('@/games/burn/BurnGame'), { ssr: false, loading: () => <BrandedLoading title="Burn" color="#e94560" /> }),
  'rift': dynamic(() => import('@/games/rift/RiftGame'), { ssr: false, loading: () => <BrandedLoading title="Rift" color="#00f0ff" /> }),
};

export default function GamePlayer({ slug }: { slug: string }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(() => SoundEngine.muted);
  const [lastScore, setLastScore] = useState<{ score: number; isNewHigh: boolean } | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const { addPlayed } = useRecentlyPlayed();
  useGameEvents();
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const GameComponent = gameComponents[slug];
  const gameData = getGameBySlug(slug);

  // Track this game as recently played + increment play count
  useEffect(() => {
    addPlayed(slug);
    incrementPlayCount(slug);
  }, [slug, addPlayed]);

  // Listen for game-end to show share button
  useEffect(() => {
    const handleEnd = (e: Event) => {
      const detail = (e as CustomEvent<GameEndDetail>).detail;
      if (detail.slug === slug) {
        const prevHigh = getHighScore(slug);
        setLastScore({ score: detail.score, isNewHigh: detail.score > prevHigh });
      }
    };
    const handleStart = () => setLastScore(null);
    window.addEventListener('spryte:game-end', handleEnd);
    window.addEventListener('spryte:game-start', handleStart);
    return () => {
      window.removeEventListener('spryte:game-end', handleEnd);
      window.removeEventListener('spryte:game-start', handleStart);
    };
  }, [slug]);

  // Track fullscreen state changes (with webkit fallback for Safari)
  useEffect(() => {
    const onFSChange = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Safari webkit fullscreen API
      const inFS = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(inFS);
      if (inFS) {
        // Auto-hide toolbar after 2s in fullscreen
        hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 2000);
      } else {
        setToolbarVisible(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      }
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Show toolbar on mouse move in fullscreen
  const handleMouseMove = useCallback(() => {
    if (!isFullscreen) return;
    setToolbarVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setToolbarVisible(false), 2000);
  }, [isFullscreen]);

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

  // Keyboard shortcuts: F = fullscreen, M = mute
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
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
        onMouseMove={handleMouseMove}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <GameComponent />
        </div>
      </div>

      {/* Toolbar strip below canvas */}
      <div
        className={`flex items-center justify-between mt-2 px-1 transition-opacity duration-300 ${
          isFullscreen && !toolbarVisible ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="flex items-center gap-1.5">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-white/[0.06] hover:bg-card-hover text-dim hover:text-foreground transition-all text-xs font-medium min-h-[36px]"
            aria-label={isMuted ? 'Unmute sound' : 'Mute sound'}
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
          >
            {isMuted ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            )}
            {isMuted ? 'Muted' : 'Sound'}
          </button>

          {/* Fullscreen button */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-white/[0.06] hover:bg-card-hover text-dim hover:text-foreground transition-all text-xs font-medium min-h-[36px]"
            aria-label={isFullscreen ? 'Exit fullscreen mode' : 'Enter fullscreen mode'}
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
            {isFullscreen ? 'Exit' : 'Fullscreen'}
          </button>

          {/* Record */}
          <GameRecorder slug={slug} />
        </div>

        <div className="flex items-center gap-2">
          {lastScore && gameData && (
            <ShareScoreButton
              gameTitle={gameData.title}
              gameSlug={slug}
              score={lastScore.score}
              isNewHigh={lastScore.isNewHigh}
              gameColor={gameData.color}
            />
          )}
          <span className="text-[10px] text-dim hidden sm:block">
            <kbd className="px-1 py-0.5 bg-card border border-white/[0.06] rounded font-mono">F</kbd> fullscreen
            <span className="mx-1">&middot;</span>
            <kbd className="px-1 py-0.5 bg-card border border-white/[0.06] rounded font-mono">M</kbd> mute
          </span>
        </div>
      </div>
    </div>
  );
}
