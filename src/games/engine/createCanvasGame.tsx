'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd } from '@/lib/game-events';
import { TouchController, isTouchDevice } from '@/lib/touch-controls';
import { setupCanvasDPI } from './utils';

// ── Types ──

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

export interface GameContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  dpr: number;
  touch: TouchController;
  isTouch: boolean;
  keys: Set<string>;
  highScore: number;

  // State management
  state: GameState;
  setState: (state: GameState) => void;

  // Score & session tracking (call these from your game logic)
  reportStart: () => void;
  reportEnd: (score: number, completed: boolean, level?: number) => void;
  updateHighScore: (score: number) => void;
}

export interface GameCallbacks {
  /** Called once when the game first initializes */
  setup?: (ctx: GameContext) => void;

  /** Called every frame during menu state. Return nothing. */
  onMenu?: (ctx: GameContext, dt: number, time: number) => void;

  /** Called every frame during playing state */
  onPlaying?: (ctx: GameContext, dt: number, time: number) => void;

  /** Called every frame during paused state */
  onPaused?: (ctx: GameContext, dt: number, time: number) => void;

  /** Called every frame during gameover state */
  onGameOver?: (ctx: GameContext, dt: number, time: number) => void;

  /** Called on keydown events */
  onKeyDown?: (ctx: GameContext, key: string, e: KeyboardEvent) => void;

  /** Called on keyup events */
  onKeyUp?: (ctx: GameContext, key: string, e: KeyboardEvent) => void;

  /** Called on canvas click/tap */
  onClick?: (ctx: GameContext, x: number, y: number) => void;

  /** Called on touch move (for swipe controls) */
  onTouchMove?: (ctx: GameContext, x: number, y: number) => void;

  /** Called on touch end */
  onTouchEnd?: (ctx: GameContext) => void;

  /** Called on cleanup before the component unmounts */
  cleanup?: (ctx: GameContext) => void;
}

export interface CreateCanvasGameOptions {
  /** Canvas logical width (default 800) */
  width?: number;
  /** Canvas logical height (default 600) */
  height?: number;
  /** Game slug for high score and event reporting */
  slug: string;
  /** Ambient music theme to play (optional) */
  ambientTheme?: string;
}

/**
 * Factory that creates a React component for a canvas-based game.
 *
 * Handles: canvas DPI setup, game loop with delta time, state machine,
 * keyboard tracking, touch controller lifecycle, high score loading,
 * event reporting, and cleanup.
 *
 * Games provide callback functions for each state.
 *
 * Usage:
 * ```tsx
 * const MyGame = createCanvasGame({
 *   slug: 'my-game',
 *   width: 800,
 *   height: 600,
 * }, {
 *   setup(ctx) { ... },
 *   onMenu(ctx, dt, time) { ... },
 *   onPlaying(ctx, dt, time) { ... },
 *   onGameOver(ctx, dt, time) { ... },
 *   onClick(ctx, x, y) { ... },
 * });
 *
 * export default MyGame;
 * ```
 */
export function createCanvasGame(
  options: CreateCanvasGameOptions,
  callbacks: GameCallbacks
) {
  const W = options.width ?? 800;
  const H = options.height ?? 600;

  return function CanvasGame() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rawCtx = canvas.getContext('2d');
      if (!rawCtx) return;

      // DPI setup
      const dpr = setupCanvasDPI(canvas, W, H);

      // Touch controller
      const touch = new TouchController(canvas);
      const isTouch = isTouchDevice();

      // Keyboard state
      const keys = new Set<string>();

      // High score
      let highScore = getHighScore(options.slug);

      // Game state
      let currentState: GameState = 'menu';

      // Game context object
      const gameCtx: GameContext = {
        canvas,
        ctx: rawCtx,
        width: W,
        height: H,
        dpr,
        touch,
        isTouch,
        keys,
        highScore,

        get state() {
          return currentState;
        },
        setState(s: GameState) {
          currentState = s;
        },

        reportStart() {
          reportGameStart(options.slug);
        },
        reportEnd(score: number, completed: boolean, level?: number) {
          reportGameEnd(options.slug, score, completed, level);
        },
        updateHighScore(score: number) {
          if (score > highScore) {
            highScore = score;
            gameCtx.highScore = highScore;
            setHighScore(options.slug, score);
          }
        },
      };

      // Call setup
      callbacks.setup?.(gameCtx);

      // Start ambient if specified
      if (options.ambientTheme) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AmbientTheme not exported from sounds
        SoundEngine.startAmbient(options.ambientTheme as any);
      }

      // ── Event handlers ──

      const onKeyDown = (e: KeyboardEvent) => {
        keys.add(e.key);
        callbacks.onKeyDown?.(gameCtx, e.key, e);
      };

      const onKeyUp = (e: KeyboardEvent) => {
        keys.delete(e.key);
        callbacks.onKeyUp?.(gameCtx, e.key, e);
      };

      const onClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        callbacks.onClick?.(gameCtx, x, y);
      };

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        const x = (t.clientX - rect.left) * scaleX;
        const y = (t.clientY - rect.top) * scaleY;
        callbacks.onClick?.(gameCtx, x, y);
      };

      const onTouchMove = (e: TouchEvent) => {
        if (!callbacks.onTouchMove) return;
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const scaleX = W / rect.width;
        const scaleY = H / rect.height;
        const x = (t.clientX - rect.left) * scaleX;
        const y = (t.clientY - rect.top) * scaleY;
        callbacks.onTouchMove(gameCtx, x, y);
      };

      const onTouchEnd = () => {
        callbacks.onTouchEnd?.(gameCtx);
      };

      const onVisibilityChange = () => {
        if (document.hidden && currentState === 'playing') {
          currentState = 'paused';
        }
      };

      // Attach listeners
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      canvas.addEventListener('click', onClick);
      canvas.addEventListener('touchstart', onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', onTouchMove, { passive: false });
      canvas.addEventListener('touchend', onTouchEnd);
      document.addEventListener('visibilitychange', onVisibilityChange);

      // ── Game loop ──

      let lastTime = 0;
      let animId = 0;

      function loop(timestamp: number) {
        const dt = lastTime === 0 ? 1 / 60 : Math.min((timestamp - lastTime) / 1000, 0.1);
        lastTime = timestamp;
        const time = timestamp / 1000;

        switch (currentState) {
          case 'menu':
            callbacks.onMenu?.(gameCtx, dt, time);
            break;
          case 'playing':
            callbacks.onPlaying?.(gameCtx, dt, time);
            break;
          case 'paused':
            callbacks.onPaused?.(gameCtx, dt, time);
            break;
          case 'gameover':
            callbacks.onGameOver?.(gameCtx, dt, time);
            break;
        }

        animId = requestAnimationFrame(loop);
      }

      animId = requestAnimationFrame(loop);

      // ── Cleanup ──
      return () => {
        cancelAnimationFrame(animId);
        SoundEngine.stopAmbient();
        touch.destroy();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        canvas.removeEventListener('click', onClick);
        canvas.removeEventListener('touchstart', onTouchStart);
        canvas.removeEventListener('touchmove', onTouchMove);
        canvas.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        callbacks.cleanup?.(gameCtx);
      };
    }, []);

    return (
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          width: '100%',
          maxWidth: `${W}px`,
          height: 'auto',
          aspectRatio: `${W}/${H}`,
          display: 'block',
          imageRendering: 'auto' as const,
        }}
      />
    );
  };
}

export default createCanvasGame;
