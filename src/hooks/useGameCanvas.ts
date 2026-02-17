'use client';

import { useEffect, useRef } from 'react';

interface UseGameCanvasOptions {
  width?: number;
  height?: number;
  onInit: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => (() => void) | void;
}

export function useGameCanvas({ width = 800, height = 500, onInit }: UseGameCanvasOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cleanup = onInit(ctx, canvas);
    if (cleanup) cleanupRef.current = cleanup;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [width, height, onInit]);

  return canvasRef;
}

export function createGameLoop(update: () => void, draw: () => void): { start: () => void; stop: () => void } {
  let animId = 0;
  let running = false;

  function loop() {
    if (!running) return;
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  return {
    start() {
      running = true;
      loop();
    },
    stop() {
      running = false;
      cancelAnimationFrame(animId);
    },
  };
}
