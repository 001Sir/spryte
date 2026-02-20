'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd, reportLevelComplete } from '@/lib/game-events';

// ─── Constants ───────────────────────────────────────────────────────
const W = 800;
const H = 600;
const BULLET_RADIUS = 5;
const BULLET_SPEED = 7;
const TARGET_RADIUS = 15;
const MAX_BOUNCES = 18;
const TRAIL_LENGTH = 60;
const PREVIEW_BOUNCES = 6;
const PREVIEW_STEPS = 300;
const PARTICLE_COUNT = 18;
const CANNON_RADIUS = 18;


// ─── Types ───────────────────────────────────────────────────────────
interface Vec { x: number; y: number }
interface Wall { x1: number; y1: number; x2: number; y2: number; type: 'normal' | 'boost' | 'split' | 'pass' }
interface Target { x: number; y: number; hit: boolean; hitTime: number }
interface MovingTarget { x: number; y: number; hit: boolean; hitTime: number; ax: number; ay: number; bx: number; by: number; speed: number; t: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface TrailDot { x: number; y: number; alpha: number }
interface Bullet { x: number; y: number; vx: number; vy: number; speed: number; bounces: number; alive: boolean; trail: TrailDot[] }
interface ScorePopup { x: number; y: number; text: string; life: number; maxLife: number }
interface Level {
  walls: Wall[];
  targets: Target[];
  movingTargets: MovingTarget[];
  cannonX: number;
  cannonY: number;
  par: number;
  name: string;
}
type GameState = 'menu' | 'playing' | 'levelComplete' | 'gameover';

// ─── Helpers ─────────────────────────────────────────────────────────
function dot(a: Vec, b: Vec): number { return a.x * b.x + a.y * b.y; }
function len(v: Vec): number { return Math.sqrt(v.x * v.x + v.y * v.y); }
function normalize(v: Vec): Vec { const l = len(v) || 1; return { x: v.x / l, y: v.y / l }; }
function reflect(dir: Vec, normal: Vec): Vec {
  const d = dot(dir, normal);
  return { x: dir.x - 2 * d * normal.x, y: dir.y - 2 * d * normal.y };
}

function lineIntersect(
  px: number, py: number, dx: number, dy: number,
  x1: number, y1: number, x2: number, y2: number,
): { t: number; u: number; nx: number; ny: number } | null {
  const ex = x2 - x1;
  const ey = y2 - y1;
  const denom = dx * ey - dy * ex;
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - px) * ey - (y1 - py) * ex) / denom;
  const u = ((x1 - px) * dy - (y1 - py) * dx) / denom;
  if (t < 0.001 || u < 0 || u > 1) return null;
  // Normal perpendicular to wall segment
  const wLen = Math.sqrt(ex * ex + ey * ey) || 1;
  let nx = -ey / wLen;
  let ny = ex / wLen;
  // Make normal face toward the bullet
  if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; }
  return { t, u, nx, ny };
}

function rectToWalls(x: number, y: number, w: number, h: number, type: Wall['type'] = 'normal'): Wall[] {
  return [
    { x1: x, y1: y, x2: x + w, y2: y, type },
    { x1: x + w, y1: y, x2: x + w, y2: y + h, type },
    { x1: x + w, y1: y + h, x2: x, y2: y + h, type },
    { x1: x, y1: y + h, x2: x, y2: y, type },
  ];
}

function borderWalls(inset: number = 0): Wall[] {
  return [
    ...rectToWalls(inset, inset, W - 2 * inset, H - 2 * inset, 'normal'),
  ];
}

// ─── Level Definitions ───────────────────────────────────────────────
function makeLevels(): Level[] {
  const bw = borderWalls;
  const rw = rectToWalls;
  return [
    // ── LEVELS 1-5: Simple rooms, 1-2 targets ──
    // Level 1: Direct shot
    {
      name: 'First Shot',
      walls: [...bw()],
      targets: [{ x: 600, y: 300, hit: false, hitTime: 0 }],
      movingTargets: [],
      cannonX: 100, cannonY: 300,
      par: 0,
    },
    // Level 2: One bounce off top wall
    {
      name: 'Off the Wall',
      walls: [...bw()],
      targets: [{ x: 650, y: 150, hit: false, hitTime: 0 }],
      movingTargets: [],
      cannonX: 100, cannonY: 450,
      par: 1,
    },
    // Level 3: Two targets in a line
    {
      name: 'Double Tap',
      walls: [...bw()],
      targets: [
        { x: 350, y: 300, hit: false, hitTime: 0 },
        { x: 600, y: 300, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 300,
      par: 0,
    },
    // Level 4: Bounce off side wall to reach hidden target
    {
      name: 'Around the Corner',
      walls: [
        ...bw(),
        ...rw(350, 100, 14, 400),
      ],
      targets: [
        { x: 600, y: 300, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 300,
      par: 2,
    },
    // Level 5: Two targets with one bounce
    {
      name: 'Bank Shot',
      walls: [...bw()],
      targets: [
        { x: 400, y: 100, hit: false, hitTime: 0 },
        { x: 650, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 500,
      par: 1,
    },

    // ── LEVELS 6-10: L-shaped rooms, 2-3 targets, 2-3 bounces ──
    // Level 6: L-shaped room
    {
      name: 'L-Bend',
      walls: [
        ...bw(),
        ...rw(350, 0, 14, 350),
        ...rw(350, 350, 250, 14),
      ],
      targets: [
        { x: 200, y: 150, hit: false, hitTime: 0 },
        { x: 650, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 500,
      par: 2,
    },
    // Level 7: Narrow corridor with 2 targets
    {
      name: 'Corridor',
      walls: [
        ...bw(),
        ...rw(0, 200, 600, 14),
        ...rw(200, 400, 600, 14),
      ],
      targets: [
        { x: 700, y: 100, hit: false, hitTime: 0 },
        { x: 100, y: 300, hit: false, hitTime: 0 },
        { x: 700, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 50, cannonY: 100,
      par: 3,
    },
    // Level 8: Two pillars
    {
      name: 'Twin Pillars',
      walls: [
        ...bw(),
        ...rw(250, 150, 30, 300),
        ...rw(520, 150, 30, 300),
      ],
      targets: [
        { x: 390, y: 150, hit: false, hitTime: 0 },
        { x: 390, y: 450, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 300,
      par: 2,
    },
    // Level 9: Zigzag
    {
      name: 'Zigzag',
      walls: [
        ...bw(),
        ...rw(200, 0, 14, 400),
        ...rw(400, 200, 14, 400),
        ...rw(600, 0, 14, 400),
      ],
      targets: [
        { x: 300, y: 500, hit: false, hitTime: 0 },
        { x: 500, y: 100, hit: false, hitTime: 0 },
        { x: 720, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 80, cannonY: 100,
      par: 3,
    },
    // Level 10: Center block
    {
      name: 'The Vault',
      walls: [
        ...bw(),
        ...rw(300, 200, 200, 200),
      ],
      targets: [
        { x: 150, y: 150, hit: false, hitTime: 0 },
        { x: 650, y: 150, hit: false, hitTime: 0 },
        { x: 650, y: 450, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 150, cannonY: 450,
      par: 3,
    },

    // ── LEVELS 11-15: Complex rooms with interior walls, 3-4 targets ──
    // Level 11: Multiple chambers
    {
      name: 'Chambers',
      walls: [
        ...bw(),
        ...rw(250, 0, 14, 250),
        ...rw(250, 350, 14, 250),
        ...rw(550, 0, 14, 250),
        ...rw(550, 350, 14, 250),
      ],
      targets: [
        { x: 130, y: 300, hit: false, hitTime: 0 },
        { x: 400, y: 150, hit: false, hitTime: 0 },
        { x: 400, y: 450, hit: false, hitTime: 0 },
        { x: 680, y: 300, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 130, cannonY: 100,
      par: 4,
    },
    // Level 12: Cross
    {
      name: 'Crossroads',
      walls: [
        ...bw(),
        ...rw(300, 0, 14, 200),
        ...rw(486, 0, 14, 200),
        ...rw(300, 400, 14, 200),
        ...rw(486, 400, 14, 200),
        ...rw(0, 220, 200, 14),
        ...rw(0, 366, 200, 14),
        ...rw(600, 220, 200, 14),
        ...rw(600, 366, 200, 14),
      ],
      targets: [
        { x: 100, y: 100, hit: false, hitTime: 0 },
        { x: 700, y: 100, hit: false, hitTime: 0 },
        { x: 700, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 500,
      par: 4,
    },
    // Level 13: Maze-like
    {
      name: 'The Maze',
      walls: [
        ...bw(),
        ...rw(150, 120, 14, 360),
        ...rw(300, 0, 14, 360),
        ...rw(450, 240, 14, 360),
        ...rw(600, 0, 14, 360),
      ],
      targets: [
        { x: 225, y: 80, hit: false, hitTime: 0 },
        { x: 375, y: 500, hit: false, hitTime: 0 },
        { x: 525, y: 80, hit: false, hitTime: 0 },
        { x: 700, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 60, cannonY: 550,
      par: 5,
    },
    // Level 14: Nested boxes
    {
      name: 'Nesting',
      walls: [
        ...bw(),
        ...rw(150, 100, 500, 14),
        ...rw(150, 100, 14, 400),
        ...rw(150, 486, 500, 14),
        ...rw(636, 100, 14, 400),
        // Inner box opening
        ...rw(280, 220, 240, 14),
        ...rw(280, 220, 14, 160),
        ...rw(280, 366, 240, 14),
        ...rw(506, 220, 14, 160),
      ],
      targets: [
        { x: 400, y: 300, hit: false, hitTime: 0 },
        { x: 200, y: 200, hit: false, hitTime: 0 },
        { x: 600, y: 440, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 60, cannonY: 300,
      par: 4,
    },
    // Level 15: Diagonal layout
    {
      name: 'Staircase',
      walls: [
        ...bw(),
        ...rw(150, 400, 200, 14),
        ...rw(300, 280, 200, 14),
        ...rw(450, 160, 200, 14),
      ],
      targets: [
        { x: 250, y: 500, hit: false, hitTime: 0 },
        { x: 400, y: 350, hit: false, hitTime: 0 },
        { x: 550, y: 100, hit: false, hitTime: 0 },
        { x: 700, y: 250, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 60, cannonY: 550,
      par: 4,
    },

    // ── LEVELS 16-20: Introduce special surfaces ──
    // Level 16: Speed boost walls
    {
      name: 'Boost Zone',
      walls: [
        ...bw(),
        { x1: 400, y1: 0, x2: 400, y2: 600, type: 'boost' as const },
        ...rw(200, 200, 14, 200),
      ],
      targets: [
        { x: 600, y: 150, hit: false, hitTime: 0 },
        { x: 600, y: 450, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 300,
      par: 2,
    },
    // Level 17: Split walls
    {
      name: 'Splitter',
      walls: [
        ...bw(),
        { x1: 400, y1: 200, x2: 400, y2: 400, type: 'split' as const },
      ],
      targets: [
        { x: 600, y: 150, hit: false, hitTime: 0 },
        { x: 600, y: 450, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 300,
      par: 1,
    },
    // Level 18: Pass-through walls
    {
      name: 'Ghost Wall',
      walls: [
        ...bw(),
        { x1: 300, y1: 100, x2: 300, y2: 500, type: 'pass' as const },
        ...rw(500, 150, 14, 300),
      ],
      targets: [
        { x: 400, y: 300, hit: false, hitTime: 0 },
        { x: 700, y: 300, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 100, cannonY: 300,
      par: 2,
    },
    // Level 19: Mixed special walls
    {
      name: 'Mixed Signals',
      walls: [
        ...bw(),
        { x1: 300, y1: 0, x2: 300, y2: 300, type: 'boost' as const },
        { x1: 500, y1: 300, x2: 500, y2: 600, type: 'split' as const },
        ...rw(300, 400, 200, 14),
      ],
      targets: [
        { x: 150, y: 150, hit: false, hitTime: 0 },
        { x: 650, y: 150, hit: false, hitTime: 0 },
        { x: 650, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 150, cannonY: 500,
      par: 3,
    },
    // Level 20: Split chamber
    {
      name: 'Fork in the Road',
      walls: [
        ...bw(),
        ...rw(350, 0, 14, 200),
        ...rw(350, 400, 14, 200),
        { x1: 350, y1: 200, x2: 350, y2: 400, type: 'split' as const },
        ...rw(550, 100, 14, 160),
        ...rw(550, 340, 14, 160),
      ],
      targets: [
        { x: 250, y: 300, hit: false, hitTime: 0 },
        { x: 680, y: 150, hit: false, hitTime: 0 },
        { x: 680, y: 450, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 80, cannonY: 300,
      par: 2,
    },

    // ── LEVELS 21-25: Moving targets, tight corridors ──
    // Level 21: Single moving target
    {
      name: 'On the Move',
      walls: [
        ...bw(),
        ...rw(350, 150, 14, 300),
      ],
      targets: [],
      movingTargets: [
        { x: 600, y: 200, hit: false, hitTime: 0, ax: 500, ay: 150, bx: 700, by: 450, speed: 0.4, t: 0 },
      ],
      cannonX: 100, cannonY: 300,
      par: 2,
    },
    // Level 22: Tight corridor with moving targets
    {
      name: 'Tight Squeeze',
      walls: [
        ...bw(),
        ...rw(0, 180, 600, 14),
        ...rw(200, 420, 600, 14),
      ],
      targets: [
        { x: 700, y: 90, hit: false, hitTime: 0 },
      ],
      movingTargets: [
        { x: 400, y: 300, hit: false, hitTime: 0, ax: 250, ay: 300, bx: 550, by: 300, speed: 0.5, t: 0 },
        { x: 400, y: 520, hit: false, hitTime: 0, ax: 250, ay: 520, bx: 550, by: 520, speed: 0.6, t: 0.5 },
      ],
      cannonX: 50, cannonY: 90,
      par: 3,
    },
    // Level 23: Snaking corridor
    {
      name: 'Snake Path',
      walls: [
        ...bw(),
        ...rw(200, 0, 14, 400),
        ...rw(400, 200, 14, 400),
        ...rw(600, 0, 14, 400),
      ],
      targets: [
        { x: 100, y: 500, hit: false, hitTime: 0 },
        { x: 500, y: 100, hit: false, hitTime: 0 },
      ],
      movingTargets: [
        { x: 300, y: 500, hit: false, hitTime: 0, ax: 250, ay: 480, bx: 370, by: 520, speed: 0.3, t: 0 },
      ],
      cannonX: 100, cannonY: 100,
      par: 4,
    },
    // Level 24: Two rooms, one moving target each
    {
      name: 'Dual Arena',
      walls: [
        ...bw(),
        ...rw(400, 0, 14, 250),
        ...rw(400, 350, 14, 250),
      ],
      targets: [
        { x: 200, y: 300, hit: false, hitTime: 0 },
      ],
      movingTargets: [
        { x: 600, y: 200, hit: false, hitTime: 0, ax: 500, ay: 150, bx: 700, by: 150, speed: 0.5, t: 0 },
        { x: 600, y: 450, hit: false, hitTime: 0, ax: 500, ay: 450, bx: 700, by: 450, speed: 0.5, t: 0.5 },
      ],
      cannonX: 200, cannonY: 550,
      par: 3,
    },
    // Level 25: Moving target with boost
    {
      name: 'Speed Chase',
      walls: [
        ...bw(),
        { x1: 400, y1: 0, x2: 400, y2: 600, type: 'boost' as const },
        ...rw(600, 200, 14, 200),
      ],
      targets: [],
      movingTargets: [
        { x: 650, y: 150, hit: false, hitTime: 0, ax: 500, ay: 100, bx: 750, by: 100, speed: 0.6, t: 0 },
        { x: 650, y: 500, hit: false, hitTime: 0, ax: 500, ay: 500, bx: 750, by: 500, speed: 0.6, t: 0.5 },
        { x: 250, y: 300, hit: false, hitTime: 0, ax: 150, ay: 200, bx: 150, by: 400, speed: 0.3, t: 0 },
      ],
      cannonX: 80, cannonY: 550,
      par: 3,
    },

    // ── LEVELS 26-30: Combination of all mechanics ──
    // Level 26: Grand chamber
    {
      name: 'Grand Chamber',
      walls: [
        ...bw(),
        ...rw(200, 150, 14, 300),
        ...rw(400, 100, 14, 200),
        ...rw(400, 400, 14, 200),
        { x1: 600, y1: 100, x2: 600, y2: 500, type: 'split' as const },
      ],
      targets: [
        { x: 300, y: 120, hit: false, hitTime: 0 },
        { x: 300, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [
        { x: 700, y: 200, hit: false, hitTime: 0, ax: 650, ay: 150, bx: 750, by: 250, speed: 0.4, t: 0 },
        { x: 700, y: 400, hit: false, hitTime: 0, ax: 650, ay: 350, bx: 750, by: 450, speed: 0.4, t: 0.5 },
      ],
      cannonX: 80, cannonY: 300,
      par: 4,
    },
    // Level 27: Spiral approach
    {
      name: 'Spiral',
      walls: [
        ...bw(),
        ...rw(150, 150, 500, 14),
        ...rw(636, 150, 14, 300),
        ...rw(250, 436, 400, 14),
        ...rw(250, 280, 14, 170),
        { x1: 150, y1: 150, x2: 150, y2: 450, type: 'boost' as const },
      ],
      targets: [
        { x: 400, y: 80, hit: false, hitTime: 0 },
        { x: 680, y: 500, hit: false, hitTime: 0 },
        { x: 400, y: 350, hit: false, hitTime: 0 },
        { x: 200, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [],
      cannonX: 60, cannonY: 80,
      par: 5,
    },
    // Level 28: The Gauntlet
    {
      name: 'The Gauntlet',
      walls: [
        ...bw(),
        ...rw(200, 0, 14, 200),
        ...rw(200, 300, 14, 100),
        ...rw(200, 500, 14, 100),
        ...rw(400, 100, 14, 100),
        ...rw(400, 300, 14, 300),
        { x1: 600, y1: 0, x2: 600, y2: 250, type: 'split' as const },
        ...rw(600, 350, 14, 250),
      ],
      targets: [
        { x: 100, y: 100, hit: false, hitTime: 0 },
        { x: 300, y: 450, hit: false, hitTime: 0 },
        { x: 500, y: 150, hit: false, hitTime: 0 },
      ],
      movingTargets: [
        { x: 700, y: 500, hit: false, hitTime: 0, ax: 650, ay: 400, bx: 750, by: 550, speed: 0.5, t: 0 },
      ],
      cannonX: 100, cannonY: 550,
      par: 5,
    },
    // Level 29: All mechanics
    {
      name: 'Everything',
      walls: [
        ...bw(),
        ...rw(250, 100, 14, 200),
        { x1: 250, y1: 400, x2: 250, y2: 600, type: 'boost' as const },
        { x1: 500, y1: 0, x2: 500, y2: 300, type: 'split' as const },
        { x1: 500, y1: 300, x2: 500, y2: 600, type: 'pass' as const },
        ...rw(650, 200, 14, 200),
      ],
      targets: [
        { x: 150, y: 150, hit: false, hitTime: 0 },
        { x: 370, y: 500, hit: false, hitTime: 0 },
      ],
      movingTargets: [
        { x: 700, y: 150, hit: false, hitTime: 0, ax: 550, ay: 100, bx: 750, by: 100, speed: 0.5, t: 0 },
        { x: 700, y: 500, hit: false, hitTime: 0, ax: 550, ay: 480, bx: 750, by: 480, speed: 0.5, t: 0.5 },
        { x: 370, y: 300, hit: false, hitTime: 0, ax: 300, ay: 350, bx: 450, by: 350, speed: 0.4, t: 0.3 },
      ],
      cannonX: 80, cannonY: 300,
      par: 4,
    },
    // Level 30: The Final Shot
    {
      name: 'The Final Shot',
      walls: [
        ...bw(),
        ...rw(200, 80, 14, 200),
        ...rw(200, 380, 14, 140),
        { x1: 350, y1: 200, x2: 350, y2: 400, type: 'split' as const },
        { x1: 500, y1: 100, x2: 500, y2: 250, type: 'boost' as const },
        ...rw(500, 350, 14, 170),
        { x1: 650, y1: 0, x2: 650, y2: 300, type: 'pass' as const },
        ...rw(650, 400, 14, 200),
      ],
      targets: [
        { x: 120, y: 150, hit: false, hitTime: 0 },
        { x: 280, y: 500, hit: false, hitTime: 0 },
        { x: 420, y: 100, hit: false, hitTime: 0 },
      ],
      movingTargets: [
        { x: 580, y: 500, hit: false, hitTime: 0, ax: 520, ay: 480, bx: 630, by: 480, speed: 0.6, t: 0 },
        { x: 730, y: 400, hit: false, hitTime: 0, ax: 680, ay: 350, bx: 760, by: 500, speed: 0.4, t: 0.5 },
      ],
      cannonX: 120, cannonY: 400,
      par: 5,
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────
export default function RicochetGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ─── Game State ───────────────────────────────────────────
    let state: GameState = 'menu';
    const levels = makeLevels();
    let currentLevel = 0;
    let totalScore = 0;
    let levelScore = 0;
    let highScore = getHighScore('ricochet');
    let levelsCompleted = 0;
    let totalBounces = 0;
    let totalShots = 0;

    // Bullet state
    let bullets: Bullet[] = [];
    let hasFired = false;
    let allTargetsHit = false;
    let levelCompleteTimer = 0;
    let shotBounces = 0;

    // Aiming
    let isDragging = false;
    let aimAngle = 0;

    // VFX
    let particles: Particle[] = [];
    let scorePopups: ScorePopup[] = [];
    let time = 0;
    let paused = false;

    // Screen shake
    let shakeAmount = 0;
    let shakeTimer = 0;

    // Level transition fade
    let transitionAlpha = 0;

    // Level-Complete display state
    let showLevelComplete = false;
    let levelCompleteData = { bounces: 0, par: 0, targetsHit: 0, bonus: 0, total: 0 };

    // ─── Get current level data ──────────────────────────────
    function getLevel(): Level {
      return levels[currentLevel];
    }

    // ─── Reset level ─────────────────────────────────────────
    function resetLevel() {
      const level = getLevel();
      for (const t of level.targets) { t.hit = false; t.hitTime = 0; }
      for (const t of level.movingTargets) { t.hit = false; t.hitTime = 0; t.t = 0; }
      bullets = [];
      hasFired = false;
      allTargetsHit = false;
      levelCompleteTimer = 0;
      shotBounces = 0;
      particles = [];
      scorePopups = [];
      showLevelComplete = false;
      isDragging = false;
    }

    // ─── Start game ──────────────────────────────────────────
    function startGame() {
      state = 'playing';
      currentLevel = 0;
      totalScore = 0;
      levelsCompleted = 0;
      totalBounces = 0;
      totalShots = 0;
      resetLevel();
      SoundEngine.play('click');
      SoundEngine.startAmbient('synth-combat');
      reportGameStart('ricochet');
    }

    // ─── Advance to next level ───────────────────────────────
    function nextLevel() {
      currentLevel++;
      if (currentLevel >= levels.length) {
        state = 'gameover';
        SoundEngine.play('victoryFanfare');
        if (totalScore > highScore) {
          highScore = totalScore;
          setHighScore('ricochet', totalScore);
          SoundEngine.play('newHighScore');
        }
        reportGameEnd('ricochet', totalScore, true);
      } else {
        state = 'playing';
        resetLevel();
        transitionAlpha = 1.0;
      }
    }

    // ─── Fire bullet ─────────────────────────────────────────
    function fireBullet(angle: number) {
      if (hasFired) return;
      hasFired = true;
      totalShots++;
      const level = getLevel();
      const dir = normalize({ x: Math.cos(angle), y: Math.sin(angle) });
      bullets = [{
        x: level.cannonX,
        y: level.cannonY,
        vx: dir.x * BULLET_SPEED,
        vy: dir.y * BULLET_SPEED,
        speed: BULLET_SPEED,
        bounces: 0,
        alive: true,
        trail: [],
      }];
      shotBounces = 0;
      SoundEngine.play('shoot');
    }

    // ─── Spawn particles ─────────────────────────────────────
    function spawnParticles(x: number, y: number, color: string, count: number = PARTICLE_COUNT) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 1.5 + Math.random() * 3.5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.5 + Math.random() * 0.5,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    // ─── Spawn score popup ───────────────────────────────────
    function spawnScorePopup(x: number, y: number, text: string) {
      scorePopups.push({ x, y, text, life: 1, maxLife: 1.2 });
    }

    // ─── Trajectory preview ──────────────────────────────────
    function computeTrajectory(startX: number, startY: number, angle: number): Vec[] {
      const level = getLevel();
      const points: Vec[] = [];
      let px = startX;
      let py = startY;
      let dx = Math.cos(angle) * BULLET_SPEED;
      let dy = Math.sin(angle) * BULLET_SPEED;
      let bounceCount = 0;

      points.push({ x: px, y: py });

      for (let step = 0; step < PREVIEW_STEPS && bounceCount <= PREVIEW_BOUNCES; step++) {
        // Check wall intersection
        let closest: { t: number; nx: number; ny: number; wallType: Wall['type'] } | null = null;

        for (const wall of level.walls) {
          const hit = lineIntersect(px, py, dx, dy, wall.x1, wall.y1, wall.x2, wall.y2);
          if (hit && (!closest || hit.t < closest.t)) {
            closest = { t: hit.t, nx: hit.nx, ny: hit.ny, wallType: wall.type };
          }
        }

        if (closest && closest.t < 1) {
          px += dx * closest.t;
          py += dy * closest.t;
          points.push({ x: px, y: py });

          if (closest.wallType === 'pass') {
            // Pass through, continue same direction
            px += dx * 0.01;
            py += dy * 0.01;
          } else {
            const n: Vec = { x: closest.nx, y: closest.ny };
            const ref = reflect({ x: dx, y: dy }, n);
            dx = ref.x;
            dy = ref.y;
            if (closest.wallType === 'boost') {
              dx *= 1.5;
              dy *= 1.5;
            }
            bounceCount++;
            // Nudge off wall
            px += closest.nx * 0.5;
            py += closest.ny * 0.5;
          }
        } else {
          px += dx;
          py += dy;
          points.push({ x: px, y: py });
        }
      }

      return points;
    }

    // ─── Update bullet physics ───────────────────────────────
    function updateBullets() {
      const level = getLevel();
      const newBullets: Bullet[] = [];

      for (const bullet of bullets) {
        if (!bullet.alive) continue;

        // Add to trail
        bullet.trail.push({ x: bullet.x, y: bullet.y, alpha: 1 });
        if (bullet.trail.length > TRAIL_LENGTH) bullet.trail.shift();

        // Sub-stepping for accuracy
        let remaining = 1;
        let iters = 0;
        while (remaining > 0.001 && iters < 10) {
          iters++;
          const stepDx = bullet.vx * remaining;
          const stepDy = bullet.vy * remaining;

          // Find nearest wall intersection
          let closest: { t: number; nx: number; ny: number; wall: Wall } | null = null;

          for (const wall of level.walls) {
            const hit = lineIntersect(bullet.x, bullet.y, stepDx, stepDy, wall.x1, wall.y1, wall.x2, wall.y2);
            if (hit && (!closest || hit.t < closest.t)) {
              closest = { t: hit.t, nx: hit.nx, ny: hit.ny, wall: wall };
            }
          }

          if (closest && closest.t <= 1) {
            // Move to collision point
            bullet.x += stepDx * closest.t;
            bullet.y += stepDy * closest.t;
            remaining *= (1 - closest.t);

            const wallType = closest.wall.type;

            if (wallType === 'pass') {
              // Pass through: keep going
              bullet.x += bullet.vx * 0.01;
              bullet.y += bullet.vy * 0.01;
              spawnParticles(bullet.x, bullet.y, '#4ade80', 4);
              SoundEngine.play('portalEnter');
            } else if (wallType === 'split') {
              // Split: reflect bullet normally, spawn a second bullet mirrored across the normal
              const n: Vec = { x: closest.nx, y: closest.ny };
              const tangent: Vec = { x: -n.y, y: n.x };
              const ref = reflect({ x: bullet.vx, y: bullet.vy }, n);

              // First bullet gets normal reflection
              bullet.vx = ref.x;
              bullet.vy = ref.y;
              bullet.bounces++;
              shotBounces++;

              // Nudge off wall
              bullet.x += closest.nx * 1;
              bullet.y += closest.ny * 1;

              // Second bullet: mirror of the reflection across the wall normal
              // This negates the tangential component while keeping the normal component
              const refNorm = dot(ref, n);
              const refTan = dot(ref, tangent);
              const split2vx = refNorm * n.x - refTan * tangent.x;
              const split2vy = refNorm * n.y - refTan * tangent.y;
              // Normalize to same speed
              const sLen = Math.sqrt(split2vx * split2vx + split2vy * split2vy) || 1;
              const bSpeed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy) || 1;

              newBullets.push({
                x: bullet.x,
                y: bullet.y,
                vx: (split2vx / sLen) * bSpeed,
                vy: (split2vy / sLen) * bSpeed,
                speed: bullet.speed,
                bounces: bullet.bounces,
                alive: true,
                trail: [{ x: bullet.x, y: bullet.y, alpha: 1 }],
              });

              SoundEngine.play('ricochetSplit');
              spawnParticles(bullet.x, bullet.y, '#c084fc', 10);
              shakeAmount = 2;
              shakeTimer = 0.15;
            } else {
              // Normal or boost reflection
              const n: Vec = { x: closest.nx, y: closest.ny };
              const ref = reflect({ x: bullet.vx, y: bullet.vy }, n);
              bullet.vx = ref.x;
              bullet.vy = ref.y;

              if (wallType === 'boost') {
                bullet.vx *= 1.5;
                bullet.vy *= 1.5;
                bullet.speed *= 1.5;
                spawnParticles(bullet.x, bullet.y, '#38bdf8', 10);
                SoundEngine.play('ricochetFire');
              }

              bullet.bounces++;
              shotBounces++;
              SoundEngine.play('bounce');

              // Screen shake on bounce
              shakeAmount = 1.5;
              shakeTimer = 0.1;

              // Nudge off wall
              bullet.x += closest.nx * 1;
              bullet.y += closest.ny * 1;

              // Wall hit particles
              spawnParticles(bullet.x, bullet.y, '#ffffff', 4);
            }

            if (bullet.bounces > MAX_BOUNCES) {
              bullet.alive = false;
            }
          } else {
            // No collision, move full step
            bullet.x += stepDx;
            bullet.y += stepDy;
            remaining = 0;
          }
        }

        // Check if out of bounds (safety)
        if (bullet.x < -50 || bullet.x > W + 50 || bullet.y < -50 || bullet.y > H + 50) {
          bullet.alive = false;
        }

        // Check target hits
        for (const target of level.targets) {
          if (target.hit) continue;
          const dx = bullet.x - target.x;
          const dy = bullet.y - target.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < TARGET_RADIUS + BULLET_RADIUS) {
            target.hit = true;
            target.hitTime = time;
            SoundEngine.play('ricochetHit');
            spawnParticles(target.x, target.y, '#22d3ee', PARTICLE_COUNT);
            spawnParticles(target.x, target.y, '#facc15', 8);
            const pts = 100;
            levelScore += pts;
            spawnScorePopup(target.x, target.y, `+${pts}`);
          }
        }

        for (const target of level.movingTargets) {
          if (target.hit) continue;
          const dx = bullet.x - target.x;
          const dy = bullet.y - target.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < TARGET_RADIUS + BULLET_RADIUS) {
            target.hit = true;
            target.hitTime = time;
            SoundEngine.play('ricochetHit');
            spawnParticles(target.x, target.y, '#22d3ee', PARTICLE_COUNT);
            spawnParticles(target.x, target.y, '#f472b6', 8);
            const pts = 150; // Moving targets worth more
            levelScore += pts;
            spawnScorePopup(target.x, target.y, `+${pts}`);
          }
        }
      }

      // Add any split bullets
      for (const nb of newBullets) {
        bullets.push(nb);
      }

      // Check if all targets hit
      const allStaticHit = level.targets.every(t => t.hit);
      const allMovingHit = level.movingTargets.every(t => t.hit);
      if (allStaticHit && allMovingHit && !allTargetsHit && hasFired) {
        const anyAlive = bullets.some(b => b.alive);
        const totalTargets = level.targets.length + level.movingTargets.length;
        if (totalTargets > 0 && (anyAlive || totalTargets === level.targets.filter(t => t.hit).length + level.movingTargets.filter(t => t.hit).length)) {
          allTargetsHit = true;
          levelCompleteTimer = time;

          // Calculate bonus
          const par = level.par;
          let bounceBonus = 0;
          if (shotBounces <= par) {
            bounceBonus = (par - shotBounces + 1) * 50;
            levelScore += bounceBonus;
          }
          totalBounces += shotBounces;

          levelsCompleted++;
          totalScore += levelScore;

          // Store display data
          levelCompleteData = {
            bounces: shotBounces,
            par: par,
            targetsHit: totalTargets,
            bonus: bounceBonus,
            total: levelScore,
          };

          SoundEngine.play('levelComplete');
          reportLevelComplete('ricochet', currentLevel + 1, levelScore);

          // Kill remaining bullets nicely
          for (const b of bullets) {
            if (b.alive) {
              spawnParticles(b.x, b.y, '#22d3ee', 10);
            }
            b.alive = false;
          }
        }
      }

      // Check if all bullets are dead and we haven't completed the level
      const anyAlive = bullets.some(b => b.alive);
      if (hasFired && !anyAlive && !allTargetsHit) {
        // Failed - auto reset after a short delay
        // We just let it sit, player can press R or click
      }
    }

    // ─── Update moving targets ───────────────────────────────
    function updateMovingTargets(dt: number) {
      const level = getLevel();
      for (const mt of level.movingTargets) {
        if (mt.hit) continue;
        mt.t = ((mt.t + dt * mt.speed) % 2 + 2) % 2; // safe modulo for ping-pong
        const progress = mt.t <= 1 ? mt.t : 2 - mt.t;
        mt.x = mt.ax + (mt.bx - mt.ax) * progress;
        mt.y = mt.ay + (mt.by - mt.ay) * progress;
      }
    }

    // ─── Update particles ────────────────────────────────────
    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt / p.maxLife;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    // ─── Update score popups ─────────────────────────────────
    function updatePopups(dt: number) {
      for (let i = scorePopups.length - 1; i >= 0; i--) {
        const p = scorePopups[i];
        p.y -= 0.8;
        p.life -= dt / p.maxLife;
        if (p.life <= 0) scorePopups.splice(i, 1);
      }
    }

    // ─── Update trail alpha ──────────────────────────────────
    function updateTrails() {
      for (const bullet of bullets) {
        for (let i = 0; i < bullet.trail.length; i++) {
          bullet.trail[i].alpha = (i + 1) / bullet.trail.length;
        }
      }
    }

    // ─── Drawing ─────────────────────────────────────────────

    function drawBackground() {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = 'rgba(34,211,238,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    function drawWalls() {
      const level = getLevel();
      for (const wall of level.walls) {
        const colors: Record<Wall['type'], string> = {
          normal: '#e0f2fe',
          boost: '#38bdf8',
          split: '#c084fc',
          pass: '#4ade80',
        };
        const glowColors: Record<Wall['type'], string> = {
          normal: 'rgba(224,242,254,0.15)',
          boost: 'rgba(56,189,248,0.3)',
          split: 'rgba(192,132,252,0.3)',
          pass: 'rgba(74,222,128,0.2)',
        };

        ctx.save();
        ctx.strokeStyle = colors[wall.type];
        ctx.lineWidth = wall.type === 'normal' ? 2 : 3;
        if (wall.type === 'pass') {
          ctx.setLineDash([8, 6]);
        }
        ctx.shadowColor = glowColors[wall.type];
        ctx.shadowBlur = wall.type === 'normal' ? 4 : 10;
        ctx.beginPath();
        ctx.moveTo(wall.x1, wall.y1);
        ctx.lineTo(wall.x2, wall.y2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawTargets() {
      const level = getLevel();
      const allTargets = [
        ...level.targets.map(t => ({ ...t, moving: false })),
        ...level.movingTargets.map(t => ({ ...t, moving: true })),
      ];

      for (const target of allTargets) {
        const pulse = Math.sin(time * 3 + target.x * 0.1) * 0.2 + 0.8;

        if (target.hit) {
          // Hit animation: shrinking green circle
          const since = time - target.hitTime;
          if (since > 1) continue;
          const scale = 1 - since;
          const alpha = scale;

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.arc(target.x, target.y, TARGET_RADIUS * scale, 0, Math.PI * 2);
          ctx.fillStyle = '#4ade80';
          ctx.shadowColor = '#4ade80';
          ctx.shadowBlur = 15;
          ctx.fill();
          ctx.restore();
        } else {
          // Unhit: pulsing glow
          const color = target.moving ? '#f472b6' : '#fb923c';
          const glowColor = target.moving ? 'rgba(244,114,182,0.5)' : 'rgba(251,146,60,0.5)';

          // Outer glow ring
          ctx.save();
          ctx.beginPath();
          ctx.arc(target.x, target.y, TARGET_RADIUS + 4 + pulse * 3, 0, Math.PI * 2);
          ctx.strokeStyle = glowColor;
          ctx.lineWidth = 2;
          ctx.shadowColor = glowColor;
          ctx.shadowBlur = 12 * pulse;
          ctx.stroke();
          ctx.restore();

          // Inner fill
          ctx.save();
          ctx.beginPath();
          ctx.arc(target.x, target.y, TARGET_RADIUS, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(target.x, target.y, 0, target.x, target.y, TARGET_RADIUS);
          grad.addColorStop(0, '#ffffff');
          grad.addColorStop(0.4, color);
          grad.addColorStop(1, 'rgba(0,0,0,0.3)');
          ctx.fillStyle = grad;
          ctx.shadowColor = color;
          ctx.shadowBlur = 15 * pulse;
          ctx.fill();
          ctx.restore();

          // Moving target indicator: small orbit dots
          if (target.moving) {
            for (let i = 0; i < 3; i++) {
              const a = time * 2 + (Math.PI * 2 * i) / 3;
              const ox = target.x + Math.cos(a) * (TARGET_RADIUS + 8);
              const oy = target.y + Math.sin(a) * (TARGET_RADIUS + 8);
              ctx.beginPath();
              ctx.arc(ox, oy, 2, 0, Math.PI * 2);
              ctx.fillStyle = '#f472b6';
              ctx.fill();
            }
          }
        }
      }
    }

    function drawCannon() {
      const level = getLevel();
      const cx = level.cannonX;
      const cy = level.cannonY;

      // Cannon base
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, CANNON_RADIUS, 0, Math.PI * 2);
      const baseGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CANNON_RADIUS);
      baseGrad.addColorStop(0, '#22d3ee');
      baseGrad.addColorStop(0.6, '#0891b2');
      baseGrad.addColorStop(1, '#164e63');
      ctx.fillStyle = baseGrad;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();

      // Cannon barrel (direction indicator)
      if (isDragging && !hasFired) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(aimAngle);
        ctx.fillStyle = '#e0f2fe';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 8;
        ctx.fillRect(0, -4, CANNON_RADIUS + 8, 8);
        // Barrel tip
        ctx.beginPath();
        ctx.arc(CANNON_RADIUS + 8, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.restore();
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    function drawTrajectoryPreview() {
      if (!isDragging || hasFired) return;
      const level = getLevel();
      const points = computeTrajectory(level.cannonX, level.cannonY, aimAngle);

      // Draw dotted line
      ctx.save();
      ctx.strokeStyle = 'rgba(34,211,238,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.shadowColor = 'rgba(34,211,238,0.3)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        if (i === 0) ctx.moveTo(points[i].x, points[i].y);
        else ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.restore();

      // Bounce point indicators
      ctx.save();
      for (let i = 1; i < points.length - 1; i++) {
        // Check if this is a bounce point (direction changes)
        if (i > 0 && i < points.length - 1) {
          const prevDx = points[i].x - points[i - 1].x;
          const prevDy = points[i].y - points[i - 1].y;
          const nextDx = points[i + 1].x - points[i].x;
          const nextDy = points[i + 1].y - points[i].y;
          const cross = prevDx * nextDy - prevDy * nextDx;
          if (Math.abs(cross) > 0.1) {
            ctx.beginPath();
            ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(34,211,238,0.6)';
            ctx.shadowColor = '#22d3ee';
            ctx.shadowBlur = 8;
            ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    function drawBullets() {
      for (const bullet of bullets) {
        if (!bullet.alive) continue;

        // Trail
        ctx.save();
        for (let i = 0; i < bullet.trail.length; i++) {
          const t = bullet.trail[i];
          const alpha = t.alpha * 0.8;
          const size = BULLET_RADIUS * (0.3 + 0.7 * t.alpha);
          ctx.beginPath();
          ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(34,211,238,${alpha * 0.4})`;
          ctx.fill();
        }
        ctx.restore();

        // Trail glow line
        if (bullet.trail.length > 1) {
          ctx.save();
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          const gradient = ctx.createLinearGradient(
            bullet.trail[0].x, bullet.trail[0].y,
            bullet.x, bullet.y
          );
          gradient.addColorStop(0, 'rgba(34,211,238,0)');
          gradient.addColorStop(0.5, 'rgba(34,211,238,0.3)');
          gradient.addColorStop(1, 'rgba(255,255,255,0.8)');
          ctx.strokeStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(bullet.trail[0].x, bullet.trail[0].y);
          for (let i = 1; i < bullet.trail.length; i++) {
            ctx.lineTo(bullet.trail[i].x, bullet.trail[i].y);
          }
          ctx.lineTo(bullet.x, bullet.y);
          ctx.stroke();
          ctx.restore();
        }

        // Bullet glow
        ctx.save();
        const glowGrad = ctx.createRadialGradient(bullet.x, bullet.y, 0, bullet.x, bullet.y, BULLET_RADIUS * 4);
        glowGrad.addColorStop(0, 'rgba(255,255,255,0.6)');
        glowGrad.addColorStop(0.3, 'rgba(34,211,238,0.3)');
        glowGrad.addColorStop(1, 'rgba(34,211,238,0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, BULLET_RADIUS * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Bullet core
        ctx.save();
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#22d3ee';
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.restore();
      }
    }

    function drawParticles() {
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      }
    }

    function drawPopups() {
      for (const p of scorePopups) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    }

    function drawHUD() {
      const level = getLevel();
      ctx.save();

      // Level number
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`LEVEL ${currentLevel + 1}/${levels.length}`, 20, 30);

      // Level name
      ctx.font = '14px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(level.name, 20, 50);

      // Par info — prominent display with color coding
      ctx.textAlign = 'right';
      if (hasFired) {
        // Show bounces vs par with color: green under, yellow at, red over
        ctx.font = 'bold 18px monospace';
        let parColor: string;
        if (shotBounces < level.par) {
          parColor = '#4ade80'; // green — under par
        } else if (shotBounces === level.par) {
          parColor = '#facc15'; // yellow — at par
        } else {
          parColor = '#f87171'; // red — over par
        }
        ctx.fillStyle = parColor;
        ctx.shadowColor = parColor;
        ctx.shadowBlur = 6;
        ctx.fillText(`BOUNCES: ${shotBounces} / PAR: ${level.par}`, W - 20, 32);
        ctx.shadowBlur = 0;
      } else {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`PAR: ${level.par} bounce${level.par !== 1 ? 's' : ''}`, W - 20, 32);
      }

      // Targets remaining
      const totalTargets = level.targets.length + level.movingTargets.length;
      const hitTargets = level.targets.filter(t => t.hit).length + level.movingTargets.filter(t => t.hit).length;
      ctx.textAlign = 'center';
      ctx.font = '14px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Targets: ${hitTargets}/${totalTargets}`, W / 2, 30);

      // Total score
      ctx.textAlign = 'left';
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`Score: ${totalScore + levelScore}`, 20, H - 20);

      // Retry hint
      if (hasFired && !allTargetsHit && !bullets.some(b => b.alive)) {
        ctx.textAlign = 'center';
        ctx.font = '16px monospace';
        ctx.fillStyle = '#94a3b8';
        const blink = Math.sin(time * 4) > 0;
        if (blink) {
          ctx.fillText('Press R or click to retry', W / 2, H - 20);
        }
      }

      // Controls hint
      if (!hasFired && !isDragging) {
        ctx.textAlign = 'center';
        ctx.font = '13px monospace';
        ctx.fillStyle = '#475569';
        ctx.fillText('Click & drag to aim, release to fire', W / 2, H - 15);
      }

      ctx.restore();
    }

    function drawLevelComplete() {
      if (!showLevelComplete) return;

      const since = time - levelCompleteTimer;
      const alpha = Math.min(1, since * 2);

      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = alpha;

      // Title
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 20;
      ctx.fillText('LEVEL COMPLETE!', W / 2, 180);

      // Perfect shot text for 0 bounces (direct hit)
      if (levelCompleteData.bounces === 0) {
        const perfectPulse = Math.sin(time * 4) * 0.15 + 0.85;
        ctx.font = `bold ${Math.round(28 * perfectPulse)}px monospace`;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 25;
        ctx.fillText('PERFECT SHOT!', W / 2, 220);
        ctx.shadowBlur = 0;
      }

      // Stats
      ctx.shadowBlur = 0;
      ctx.font = '18px monospace';
      ctx.fillStyle = '#e2e8f0';
      const statsYOffset = levelCompleteData.bounces === 0 ? 20 : 0;
      ctx.fillText(`Targets Hit: ${levelCompleteData.targetsHit}`, W / 2, 240 + statsYOffset);

      ctx.fillStyle = levelCompleteData.bounces <= levelCompleteData.par ? '#4ade80' : '#fb923c';
      ctx.fillText(`Bounces: ${levelCompleteData.bounces} (Par: ${levelCompleteData.par})`, W / 2, 270 + statsYOffset);

      if (levelCompleteData.bonus > 0) {
        ctx.fillStyle = '#facc15';
        ctx.fillText(`Under Par Bonus: +${levelCompleteData.bonus}`, W / 2, 300 + statsYOffset);
      }

      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.fillText(`Level Score: ${levelCompleteData.total}`, W / 2, 350 + statsYOffset);

      ctx.font = '16px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Total: ${totalScore}`, W / 2, 380 + statsYOffset);

      // Continue
      const blink = Math.sin(time * 3) > 0;
      if (blink && since > 0.8) {
        ctx.font = '16px monospace';
        ctx.fillStyle = '#64748b';
        ctx.fillText('Click to continue', W / 2, 440 + statsYOffset);
      }

      ctx.restore();
    }

    function drawMenu() {
      drawBackground();

      ctx.save();

      // Title
      ctx.textAlign = 'center';
      ctx.font = 'bold 56px monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 30;
      ctx.fillText('RICOCHET', W / 2, 200);

      // Tagline
      ctx.shadowBlur = 0;
      ctx.font = '20px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('One Shot. Every Target.', W / 2, 250);

      // Decorative bullet trail
      ctx.save();
      const trailY = 290;
      for (let i = 0; i < 40; i++) {
        const x = W / 2 - 200 + i * 10;
        const alpha = 1 - Math.abs(i - 20) / 20;
        const pulse = Math.sin(time * 2 + i * 0.2) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(x, trailY + Math.sin(time + i * 0.3) * 8, 2.5 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${alpha * pulse})`;
        ctx.fill();
      }
      ctx.restore();

      // Instructions
      ctx.font = '16px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText('Click & drag to aim your shot', W / 2, 350);
      ctx.fillText('Hit all targets with a single bullet', W / 2, 375);
      ctx.fillText(`${levels.length} levels of ricochet puzzles`, W / 2, 400);

      // High score
      if (highScore > 0) {
        ctx.font = '16px monospace';
        ctx.fillStyle = '#facc15';
        ctx.fillText(`High Score: ${highScore}`, W / 2, 450);
      }

      // Start prompt
      const blink = Math.sin(time * 3) > 0;
      if (blink) {
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('Click or Press ENTER to Start', W / 2, 500);
      }

      ctx.restore();
    }

    function drawGameOver() {
      drawBackground();

      ctx.save();

      // Title
      ctx.textAlign = 'center';
      ctx.font = 'bold 48px monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 25;
      ctx.fillText('ALL LEVELS COMPLETE!', W / 2, 160);
      ctx.shadowBlur = 0;

      // Stats
      ctx.font = '20px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`Final Score: ${totalScore}`, W / 2, 230);

      ctx.font = '16px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Levels Completed: ${levelsCompleted}`, W / 2, 270);
      ctx.fillText(`Total Shots: ${totalShots}`, W / 2, 300);
      ctx.fillText(`Total Bounces: ${totalBounces}`, W / 2, 330);

      // High score
      if (totalScore >= highScore) {
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = '#facc15';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 15;
        ctx.fillText('NEW HIGH SCORE!', W / 2, 390);
        ctx.shadowBlur = 0;
      }

      ctx.font = '16px monospace';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`Best: ${highScore}`, W / 2, 420);

      // Decorative particles
      for (let i = 0; i < 30; i++) {
        const angle = (Math.PI * 2 * i) / 30 + time * 0.3;
        const radius = 120 + Math.sin(time * 1.5 + i) * 20;
        const px = W / 2 + Math.cos(angle) * radius;
        const py = 300 + Math.sin(angle) * radius * 0.3;
        const alpha = 0.3 + Math.sin(time + i) * 0.2;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${alpha})`;
        ctx.fill();
      }

      // Restart prompt
      const blink = Math.sin(time * 3) > 0;
      if (blink) {
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = '#22d3ee';
        ctx.fillText('Click or Press ENTER to Play Again', W / 2, 500);
      }

      ctx.restore();
    }

    function drawPaused() {
      ctx.save();
      ctx.fillStyle = 'rgba(10,10,15,0.7)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'center';
      ctx.font = 'bold 36px monospace';
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 15;
      ctx.fillText('PAUSED', W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.font = '16px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('Press P to resume', W / 2, H / 2 + 20);
      ctx.restore();
    }

    // ─── Input Handling ──────────────────────────────────────

    function getCanvasPos(e: MouseEvent | TouchEvent): Vec {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      if ('touches' in e) {
        const touch = e.touches[0] || e.changedTouches[0];
        return {
          x: (touch.clientX - rect.left) * scaleX,
          y: (touch.clientY - rect.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      SoundEngine.ensureResumed();

      if (state === 'menu') {
        startGame();
        return;
      }

      if (state === 'gameover') {
        startGame();
        return;
      }

      if (state === 'playing') {
        if (showLevelComplete) {
          const since = time - levelCompleteTimer;
          if (since > 0.8) {
            showLevelComplete = false;
            levelScore = 0;
            nextLevel();
          }
          return;
        }

        // If bullet is dead and level not complete, retry
        if (hasFired && !allTargetsHit && !bullets.some(b => b.alive)) {
          resetLevel();
          return;
        }

        if (!hasFired) {
          isDragging = true;
        }
      }
    }

    function onMouseMove(e: MouseEvent) {
      const pos = getCanvasPos(e);

      if (isDragging && state === 'playing' && !hasFired) {
        const level = getLevel();
        const dx = pos.x - level.cannonX;
        const dy = pos.y - level.cannonY;
        aimAngle = Math.atan2(dy, dx);
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (isDragging && state === 'playing' && !hasFired) {
        const pos = getCanvasPos(e);
        const level = getLevel();
        const dx = pos.x - level.cannonX;
        const dy = pos.y - level.cannonY;
        const dist = len({ x: dx, y: dy });
        if (dist > 15) {
          aimAngle = Math.atan2(dy, dx);
          fireBullet(aimAngle);
        }
        isDragging = false;
      }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      SoundEngine.ensureResumed();

      if (state === 'menu') { startGame(); return; }
      if (state === 'gameover') { startGame(); return; }

      if (state === 'playing') {
        if (showLevelComplete) {
          const since = time - levelCompleteTimer;
          if (since > 0.8) { showLevelComplete = false; levelScore = 0; nextLevel(); }
          return;
        }
        if (hasFired && !allTargetsHit && !bullets.some(b => b.alive)) { resetLevel(); return; }
        if (!hasFired) {
          isDragging = true;
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      const pos = getCanvasPos(e);

      if (isDragging && state === 'playing' && !hasFired) {
        const level = getLevel();
        const dx = pos.x - level.cannonX;
        const dy = pos.y - level.cannonY;
        aimAngle = Math.atan2(dy, dx);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      if (isDragging && state === 'playing' && !hasFired) {
        const pos = getCanvasPos(e);
        const level = getLevel();
        const dx = pos.x - level.cannonX;
        const dy = pos.y - level.cannonY;
        const dist = len({ x: dx, y: dy });
        if (dist > 15) {
          aimAngle = Math.atan2(dy, dx);
          fireBullet(aimAngle);
        }
        isDragging = false;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (state === 'menu') { startGame(); e.preventDefault(); return; }
        if (state === 'gameover') { startGame(); e.preventDefault(); return; }
        if (state === 'playing' && showLevelComplete) {
          const since = time - levelCompleteTimer;
          if (since > 0.8) { showLevelComplete = false; levelScore = 0; nextLevel(); }
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'r' || e.key === 'R') {
        if (state === 'playing') {
          resetLevel();
        }
      }

      if (e.key === 'p' || e.key === 'P') {
        if (state === 'playing') {
          paused = !paused;
        }
      }
    }

    // ─── Event listeners ─────────────────────────────────────
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    // ─── Game Loop ───────────────────────────────────────────
    let lastTime = performance.now();
    let animFrame = 0;

    function gameLoop(now: number) {
      animFrame = requestAnimationFrame(gameLoop);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05); // Cap delta

      if (!paused) {
        time += dt;
      }

      if (state === 'menu') {
        drawMenu();
        return;
      }

      if (state === 'gameover') {
        drawGameOver();
        return;
      }

      if (state === 'playing') {
        if (!paused) {
          updateMovingTargets(dt);

          if (hasFired && !allTargetsHit) {
            updateBullets();
          }

          updateParticles(dt);
          updatePopups(dt);
          updateTrails();

          // Update screen shake
          if (shakeTimer > 0) {
            shakeTimer -= dt;
            if (shakeTimer <= 0) {
              shakeTimer = 0;
              shakeAmount = 0;
            }
          }

          // Update level transition fade
          if (transitionAlpha > 0) {
            transitionAlpha = Math.max(0, transitionAlpha - dt * 2.0); // ~0.5s fade
          }

          // Level complete transition
          if (allTargetsHit && !showLevelComplete) {
            const since = time - levelCompleteTimer;
            if (since > 0.6) {
              showLevelComplete = true;
            }
          }
        }

        // Draw — apply screen shake
        ctx.save();
        if (shakeTimer > 0 && shakeAmount > 0) {
          const sx = (Math.random() - 0.5) * 2 * shakeAmount;
          const sy = (Math.random() - 0.5) * 2 * shakeAmount;
          ctx.translate(sx, sy);
        }

        drawBackground();

        // Level transition fade overlay
        if (transitionAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = transitionAlpha;
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }

        drawWalls();
        drawTargets();
        drawCannon();
        drawTrajectoryPreview();
        drawBullets();
        drawParticles();
        drawPopups();
        drawHUD();
        drawLevelComplete();

        ctx.restore(); // end screen shake

        if (paused) {
          drawPaused();
        }
      }
    }

    animFrame = requestAnimationFrame(gameLoop);

    // ─── Cleanup ─────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      SoundEngine.stopAmbient();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={600}
      style={{ width: '100%', maxWidth: 800, display: 'block', margin: '0 auto' }}
    />
  );
}
