'use client';

import { useEffect, useRef } from 'react';
import { startSession, endSession } from '@/lib/stats';
import { checkDailyCompletion } from '@/lib/daily-challenge';
import type { GameStartDetail, GameEndDetail } from '@/lib/game-events';

export function useGameEvents() {
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const handleStart = (e: Event) => {
      const { slug } = (e as CustomEvent<GameStartDetail>).detail;
      // End any existing session before starting a new one
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current, 0, false);
      }
      sessionIdRef.current = startSession(slug);
    };

    const handleEnd = (e: Event) => {
      const { slug, score, completed, level } = (e as CustomEvent<GameEndDetail>).detail;
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current, score, completed, level);
        sessionIdRef.current = null;
      }
      // Check if this completes today's daily challenge
      checkDailyCompletion(slug, score, level);
    };

    window.addEventListener('spryte:game-start', handleStart);
    window.addEventListener('spryte:game-end', handleEnd);

    return () => {
      window.removeEventListener('spryte:game-start', handleStart);
      window.removeEventListener('spryte:game-end', handleEnd);
      // Clean up any active session on unmount
      if (sessionIdRef.current) {
        endSession(sessionIdRef.current, 0, false);
        sessionIdRef.current = null;
      }
    };
  }, []);
}
