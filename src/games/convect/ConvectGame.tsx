'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd, reportLevelComplete } from '@/lib/game-events';
import { TouchController, isTouchDevice } from '@/lib/touch-controls';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const GRID_COLS = 40;
const GRID_ROWS = 30;
const CELL_W = W / GRID_COLS;   // 20
const CELL_H = H / GRID_ROWS;   // 20

const AMBIENT_TEMP = 0.5;
const DIFFUSION_RATE = 2.0;
const BUOYANCY_SCALE = 180;
const PRESSURE_SCALE = 80;
const PARTICLE_DAMPING = 0.97;
const PARTICLE_RADIUS = 4;
const GOAL_RADIUS = 18;
const GOAL_DWELL_TIME = 0.5;  // seconds particle must stay in goal
const LEVEL_TIMEOUT = 90;     // seconds
const MAX_TRAIL_LEN = 12;

// ─── Colors ──────────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#0a0a1a',
  wall: '#374151',
  wallEdge: '#4b5563',
  ice: '#93c5fd',
  iceCrack: '#60a5fa',
  goalGlow: '#22c55e',
  goalBorder: '#4ade80',
  heatSource: '#ef4444',
  heatGlow: '#f87171',
  coldSink: '#3b82f6',
  coldGlow: '#60a5fa',
  particleCore: '#ffffff',
  primary: '#ef4444',
  hud: '#e5e7eb',
  hudDim: '#9ca3af',
  hudBg: 'rgba(10, 10, 26, 0.85)',
  placing: '#fbbf24',
  simulating: '#22c55e',
  ventBase: '#f59e0b',
  ventBlast: '#fbbf24',
  insulation: '#6b21a8',
  insulationEdge: '#7c3aed',
};

// ─── Inline Types ────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

interface FloatingText {
  x: number; y: number;
  text: string; color: string;
  vy: number;
  life: number; maxLife: number;
}

// ─── Cell Types ──────────────────────────────────────────────────────────────
const EMPTY = 0;
const WALL = 1;
const ICE = 2;
const VENT = 3;
const INSULATION = 4;

// ─── Source Types ────────────────────────────────────────────────────────────
interface Source {
  gx: number; gy: number;
  type: 'heat' | 'cold';
}

interface FlowParticle {
  x: number; y: number;
  vx: number; vy: number;
  goalIndex: number;       // which goal this particle should reach (-1 = any)
  trail: { x: number; y: number }[];
  inGoalTimer: number;     // time spent inside its goal zone
  delivered: boolean;
  temperature: number;     // for coloring
}

interface GoalZone {
  x: number; y: number;    // center pixel coords
  radius: number;
  particleIndex: number;   // which particle should reach this goal (-1 = any)
  reached: boolean;
}

interface SteamVent {
  gx: number; gy: number;
  period: number;          // seconds per cycle
  blastDuration: number;   // seconds of active blasting
  timer: number;           // current cycle time
  active: boolean;
}

// ─── Level Definition ────────────────────────────────────────────────────────
interface LevelDef {
  name: string;
  heatSources: number;
  coldSinks: number;
  particles: { gx: number; gy: number }[];
  goals: { gx: number; gy: number }[];
  walls: { gx: number; gy: number; w: number; h: number }[];
  iceBlocks?: { gx: number; gy: number }[];
  vents?: { gx: number; gy: number; period: number; blastDuration: number }[];
  insulationWalls?: { gx: number; gy: number; w: number; h: number }[];
}

// ─── 15 Levels ───────────────────────────────────────────────────────────────
const LEVELS: LevelDef[] = [
  // Level 1: Tutorial - simple upward push
  {
    name: 'First Heat',
    heatSources: 3, coldSinks: 0,
    particles: [{ gx: 20, gy: 24 }],
    goals: [{ gx: 20, gy: 6 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },   // top
      { gx: 0, gy: 29, w: 40, h: 1 },   // bottom
      { gx: 0, gy: 0, w: 1, h: 30 },    // left
      { gx: 39, gy: 0, w: 1, h: 30 },   // right
    ],
  },
  // Level 2: L-shaped path
  {
    name: 'Around the Bend',
    heatSources: 3, coldSinks: 1,
    particles: [{ gx: 5, gy: 24 }],
    goals: [{ gx: 34, gy: 6 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      // Horizontal wall blocks direct path
      { gx: 12, gy: 14, w: 20, h: 1 },
    ],
  },
  // Level 3: Two particles, two goals
  {
    name: 'Dual Flow',
    heatSources: 4, coldSinks: 1,
    particles: [{ gx: 10, gy: 24 }, { gx: 30, gy: 24 }],
    goals: [{ gx: 10, gy: 6 }, { gx: 30, gy: 6 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 20, gy: 1, w: 1, h: 14 }, // center divider top
    ],
  },
  // Level 4: Wall maze
  {
    name: 'Maze Runner',
    heatSources: 4, coldSinks: 2,
    particles: [{ gx: 4, gy: 26 }],
    goals: [{ gx: 36, gy: 4 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      // Maze walls
      { gx: 8, gy: 1, w: 1, h: 20 },
      { gx: 16, gy: 10, w: 1, h: 19 },
      { gx: 24, gy: 1, w: 1, h: 20 },
      { gx: 32, gy: 10, w: 1, h: 19 },
    ],
  },
  // Level 5: Three particles, three goals
  {
    name: 'Triple Threat',
    heatSources: 5, coldSinks: 2,
    particles: [{ gx: 8, gy: 25 }, { gx: 20, gy: 25 }, { gx: 32, gy: 25 }],
    goals: [{ gx: 8, gy: 5 }, { gx: 20, gy: 5 }, { gx: 32, gy: 5 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 14, gy: 10, w: 1, h: 12 },
      { gx: 26, gy: 10, w: 1, h: 12 },
    ],
  },
  // Level 6: Cold sinks introduced heavily
  {
    name: 'Cold Front',
    heatSources: 3, coldSinks: 3,
    particles: [{ gx: 20, gy: 5 }],
    goals: [{ gx: 20, gy: 25 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 10, gy: 14, w: 8, h: 1 },
      { gx: 22, gy: 14, w: 8, h: 1 },
    ],
  },
  // Level 7: Converge to center
  {
    name: 'Convergence',
    heatSources: 4, coldSinks: 2,
    particles: [
      { gx: 4, gy: 4 }, { gx: 36, gy: 4 },
      { gx: 4, gy: 26 }, { gx: 36, gy: 26 },
    ],
    goals: [
      { gx: 18, gy: 14 }, { gx: 22, gy: 14 },
      { gx: 18, gy: 16 }, { gx: 22, gy: 16 },
    ],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
    ],
  },
  // Level 8: Limited sources — efficient loops
  {
    name: 'Economy',
    heatSources: 2, coldSinks: 1,
    particles: [{ gx: 10, gy: 24 }, { gx: 30, gy: 24 }],
    goals: [{ gx: 30, gy: 6 }, { gx: 10, gy: 6 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 20, gy: 8, w: 1, h: 14 },
    ],
  },
  // Level 9: Moving wall (timer-based opening)
  {
    name: 'Timed Gate',
    heatSources: 4, coldSinks: 2,
    particles: [{ gx: 10, gy: 15 }],
    goals: [{ gx: 30, gy: 15 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 20, gy: 1, w: 1, h: 12 },
      // Gate section (gy: 13-17) — will be toggled
      { gx: 20, gy: 18, w: 1, h: 11 },
    ],
  },
  // Level 10: Ice blocks
  {
    name: 'Thaw',
    heatSources: 4, coldSinks: 1,
    particles: [{ gx: 6, gy: 15 }],
    goals: [{ gx: 34, gy: 15 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
    ],
    iceBlocks: [
      { gx: 15, gy: 12 }, { gx: 15, gy: 13 }, { gx: 15, gy: 14 },
      { gx: 15, gy: 15 }, { gx: 15, gy: 16 }, { gx: 15, gy: 17 },
      { gx: 25, gy: 12 }, { gx: 25, gy: 13 }, { gx: 25, gy: 14 },
      { gx: 25, gy: 15 }, { gx: 25, gy: 16 }, { gx: 25, gy: 17 },
    ],
  },
  // Level 11: Steam vents
  {
    name: 'Vents',
    heatSources: 3, coldSinks: 2,
    particles: [{ gx: 10, gy: 26 }, { gx: 30, gy: 26 }],
    goals: [{ gx: 10, gy: 4 }, { gx: 30, gy: 4 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 15, gy: 12, w: 10, h: 1 },
    ],
    vents: [
      { gx: 10, gy: 28, period: 4, blastDuration: 1.5 },
      { gx: 30, gy: 28, period: 5, blastDuration: 1.5 },
    ],
  },
  // Level 12: Insulation walls
  {
    name: 'Insulated',
    heatSources: 4, coldSinks: 2,
    particles: [{ gx: 6, gy: 20 }, { gx: 34, gy: 20 }],
    goals: [{ gx: 34, gy: 6 }, { gx: 6, gy: 6 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
    ],
    insulationWalls: [
      { gx: 13, gy: 1, w: 1, h: 20 },
      { gx: 27, gy: 10, w: 1, h: 19 },
    ],
  },
  // Level 13: Combined elements
  {
    name: 'Crucible',
    heatSources: 3, coldSinks: 2,
    particles: [{ gx: 5, gy: 25 }, { gx: 20, gy: 25 }, { gx: 35, gy: 25 }],
    goals: [{ gx: 35, gy: 5 }, { gx: 5, gy: 5 }, { gx: 20, gy: 5 }],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 12, gy: 14, w: 5, h: 1 },
      { gx: 23, gy: 14, w: 5, h: 1 },
    ],
    iceBlocks: [
      { gx: 17, gy: 13 }, { gx: 17, gy: 14 }, { gx: 17, gy: 15 },
      { gx: 22, gy: 13 }, { gx: 22, gy: 14 }, { gx: 22, gy: 15 },
    ],
    vents: [
      { gx: 5, gy: 28, period: 5, blastDuration: 1.5 },
      { gx: 35, gy: 28, period: 6, blastDuration: 1.5 },
    ],
  },
  // Level 14: Large map, 5 particles
  {
    name: 'Grand Design',
    heatSources: 5, coldSinks: 3,
    particles: [
      { gx: 4, gy: 26 }, { gx: 12, gy: 26 }, { gx: 20, gy: 26 },
      { gx: 28, gy: 26 }, { gx: 36, gy: 26 },
    ],
    goals: [
      { gx: 36, gy: 4 }, { gx: 28, gy: 4 }, { gx: 20, gy: 4 },
      { gx: 12, gy: 4 }, { gx: 4, gy: 4 },
    ],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      { gx: 8, gy: 8, w: 1, h: 14 },
      { gx: 16, gy: 8, w: 1, h: 14 },
      { gx: 24, gy: 8, w: 1, h: 14 },
      { gx: 32, gy: 8, w: 1, h: 14 },
    ],
    insulationWalls: [
      { gx: 8, gy: 7, w: 1, h: 1 },
      { gx: 16, gy: 7, w: 1, h: 1 },
      { gx: 24, gy: 7, w: 1, h: 1 },
      { gx: 32, gy: 7, w: 1, h: 1 },
    ],
  },
  // Level 15: Boss level
  {
    name: 'Inferno Core',
    heatSources: 3, coldSinks: 2,
    particles: [
      { gx: 4, gy: 15 }, { gx: 20, gy: 26 }, { gx: 36, gy: 15 },
      { gx: 20, gy: 4 },
    ],
    goals: [
      { gx: 20, gy: 4 }, { gx: 36, gy: 15 }, { gx: 20, gy: 26 },
      { gx: 4, gy: 15 },
    ],
    walls: [
      { gx: 0, gy: 0, w: 40, h: 1 },
      { gx: 0, gy: 29, w: 40, h: 1 },
      { gx: 0, gy: 0, w: 1, h: 30 },
      { gx: 39, gy: 0, w: 1, h: 30 },
      // Inner box
      { gx: 14, gy: 10, w: 12, h: 1 },
      { gx: 14, gy: 20, w: 12, h: 1 },
      { gx: 14, gy: 10, w: 1, h: 4 },
      { gx: 25, gy: 10, w: 1, h: 4 },
      { gx: 14, gy: 17, w: 1, h: 4 },
      { gx: 25, gy: 17, w: 1, h: 4 },
    ],
    iceBlocks: [
      { gx: 14, gy: 14 }, { gx: 14, gy: 15 }, { gx: 14, gy: 16 },
      { gx: 25, gy: 14 }, { gx: 25, gy: 15 }, { gx: 25, gy: 16 },
    ],
    vents: [
      { gx: 20, gy: 28, period: 4, blastDuration: 1.2 },
      { gx: 10, gy: 28, period: 5, blastDuration: 1 },
      { gx: 30, gy: 28, period: 6, blastDuration: 1 },
    ],
    insulationWalls: [
      { gx: 18, gy: 10, w: 4, h: 1 },
      { gx: 18, gy: 20, w: 4, h: 1 },
    ],
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function ConvectGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // DPI-aware setup
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Touch controller
    const touch = new TouchController(canvas);

    // ── Game State ────────────────────────────────────────────────────────
    type GameState = 'menu' | 'playing' | 'gameover';
    type PlayPhase = 'placing' | 'simulating' | 'levelComplete';
    let state: GameState = 'menu';
    let phase: PlayPhase = 'placing';

    // Grid data
    let cellType: number[][] = [];        // EMPTY, WALL, ICE, VENT, INSULATION
    let temperature: number[][] = [];     // 0.0 - 1.0
    let tempBuffer: number[][] = [];      // double-buffer for diffusion
    let vx: number[][] = [];              // velocity X field
    let vy: number[][] = [];              // velocity Y field
    let iceHealth: number[][] = [];       // ice melt progress

    // Sources placed by player
    let sources: Source[] = [];
    let heatRemaining = 0;
    let coldRemaining = 0;

    // Particles & Goals
    let flowParticles: FlowParticle[] = [];
    let goalZones: GoalZone[] = [];
    let deliveredCount = 0;
    let totalParticles = 0;

    // Steam Vents
    let vents: SteamVent[] = [];

    // Gate (level 9)
    let gateOpen = false;
    let gateTimer = 0;
    const GATE_PERIOD = 5;

    // Level / Score
    let level = 0;
    let score = 0;
    let highScore = getHighScore('convect');
    let newHighScoreFlag = false;

    // Timer
    let levelTime = 0;

    // Visual effects
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];

    // Animation
    let frameCount = 0;
    let lastTime = 0;
    let animFrame = 0;
    let menuTime = 0;
    let levelCompleteTimer = 0;

    // Mouse state
    let mouseX = 0;
    let mouseY = 0;
    let cachedRect = canvas.getBoundingClientRect();

    // Menu background simulation
    let menuTemp: number[][] = [];
    let menuVx: number[][] = [];
    let menuVy: number[][] = [];
    let menuParticles: { x: number; y: number; vx: number; vy: number; trail: { x: number; y: number }[] }[] = [];

    // ── Helpers ───────────────────────────────────────────────────────────

    function createGrid<T>(val: T): T[][] {
      const grid: T[][] = [];
      for (let x = 0; x < GRID_COLS; x++) {
        grid[x] = [];
        for (let y = 0; y < GRID_ROWS; y++) {
          grid[x][y] = val;
        }
      }
      return grid;
    }

    function clamp(v: number, min: number, max: number): number {
      return v < min ? min : v > max ? max : v;
    }

    function lerp(a: number, b: number, t: number): number {
      return a + (b - a) * t;
    }

    function tempToColor(t: number): string {
      // Blue (cold) -> dark (neutral) -> red (hot)
      if (t < 0.5) {
        const f = t / 0.5;
        const r = Math.floor(lerp(30, 10, f));
        const g = Math.floor(lerp(60, 10, f));
        const b = Math.floor(lerp(180, 26, f));
        return `rgb(${r},${g},${b})`;
      } else {
        const f = (t - 0.5) / 0.5;
        const r = Math.floor(lerp(10, 200, f));
        const g = Math.floor(lerp(10, 40, f));
        const b = Math.floor(lerp(26, 30, f));
        return `rgb(${r},${g},${b})`;
      }
    }

    function particleTempColor(t: number): string {
      if (t < 0.35) {
        const f = t / 0.35;
        return `rgb(${Math.floor(lerp(80, 200, f))},${Math.floor(lerp(140, 220, f))},${Math.floor(lerp(255, 255, f))})`;
      } else if (t < 0.65) {
        return '#ffffff';
      } else {
        const f = (t - 0.65) / 0.35;
        return `rgb(255,${Math.floor(lerp(220, 80, f))},${Math.floor(lerp(200, 60, f))})`;
      }
    }

    // ── Grid bilinear sampling ────────────────────────────────────────────

    function sampleField(field: number[][], px: number, py: number): number {
      const gx = px / CELL_W - 0.5;
      const gy = py / CELL_H - 0.5;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = gx - x0;
      const fy = gy - y0;

      const get = (x: number, y: number) => {
        if (x < 0 || x >= GRID_COLS || y < 0 || y >= GRID_ROWS) return 0;
        return field[x][y];
      };

      return (
        get(x0, y0) * (1 - fx) * (1 - fy) +
        get(x1, y0) * fx * (1 - fy) +
        get(x0, y1) * (1 - fx) * fy +
        get(x1, y1) * fx * fy
      );
    }

    // ── Initialize Menu Background ────────────────────────────────────────

    function initMenuBackground() {
      menuTemp = createGrid(AMBIENT_TEMP);
      menuVx = createGrid(0);
      menuVy = createGrid(0);
      menuParticles = [];

      // Place some warm and cool areas
      for (let x = 15; x <= 25; x++) {
        for (let y = 22; y <= 27; y++) {
          menuTemp[x][y] = 0.95;
        }
      }
      for (let x = 5; x <= 12; x++) {
        for (let y = 2; y <= 7; y++) {
          menuTemp[x][y] = 0.05;
        }
      }
      for (let x = 28; x <= 35; x++) {
        for (let y = 2; y <= 7; y++) {
          menuTemp[x][y] = 0.05;
        }
      }

      // Create demo particles
      for (let i = 0; i < 20; i++) {
        menuParticles.push({
          x: 100 + Math.random() * 600,
          y: 200 + Math.random() * 300,
          vx: 0, vy: 0,
          trail: [],
        });
      }
    }

    function updateMenuBackground(dt: number) {
      const cols = GRID_COLS;
      const rows = GRID_ROWS;
      const buf = createGrid(0);

      // Maintain sources
      for (let x = 15; x <= 25; x++) {
        for (let y = 22; y <= 27; y++) {
          menuTemp[x][y] = 0.95;
        }
      }
      for (let x = 5; x <= 12; x++) {
        for (let y = 2; y <= 7; y++) {
          menuTemp[x][y] = 0.05;
        }
      }
      for (let x = 28; x <= 35; x++) {
        for (let y = 2; y <= 7; y++) {
          menuTemp[x][y] = 0.05;
        }
      }

      // Diffuse
      for (let x = 1; x < cols - 1; x++) {
        for (let y = 1; y < rows - 1; y++) {
          buf[x][y] = menuTemp[x][y] + DIFFUSION_RATE * dt * (
            menuTemp[x - 1][y] + menuTemp[x + 1][y] +
            menuTemp[x][y - 1] + menuTemp[x][y + 1] -
            4 * menuTemp[x][y]
          );
          buf[x][y] = clamp(buf[x][y], 0, 1);
        }
      }

      // Restore sources
      for (let x = 15; x <= 25; x++) {
        for (let y = 22; y <= 27; y++) {
          buf[x][y] = 0.95;
        }
      }
      for (let x = 5; x <= 12; x++) {
        for (let y = 2; y <= 7; y++) {
          buf[x][y] = 0.05;
        }
      }
      for (let x = 28; x <= 35; x++) {
        for (let y = 2; y <= 7; y++) {
          buf[x][y] = 0.05;
        }
      }

      // Copy buffer
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          menuTemp[x][y] = buf[x][y];
        }
      }

      // Velocity from temperature
      for (let x = 1; x < cols - 1; x++) {
        for (let y = 1; y < rows - 1; y++) {
          menuVx[x][y] = (menuTemp[x + 1][y] - menuTemp[x - 1][y]) * PRESSURE_SCALE;
          menuVy[x][y] = -(menuTemp[x][y] - AMBIENT_TEMP) * BUOYANCY_SCALE;
        }
      }

      // Update menu particles
      for (const p of menuParticles) {
        const svx = sampleFieldMenu(menuVx, p.x, p.y);
        const svy = sampleFieldMenu(menuVy, p.x, p.y);
        p.vx = p.vx * 0.95 + svx * dt;
        p.vy = p.vy * 0.95 + svy * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > MAX_TRAIL_LEN) p.trail.pop();

        // Wrap
        if (p.x < 20) p.x = W - 20;
        if (p.x > W - 20) p.x = 20;
        if (p.y < 20) p.y = H - 20;
        if (p.y > H - 20) p.y = 20;
      }
    }

    function sampleFieldMenu(field: number[][], px: number, py: number): number {
      const gx = px / CELL_W - 0.5;
      const gy = py / CELL_H - 0.5;
      const x0 = clamp(Math.floor(gx), 0, GRID_COLS - 1);
      const y0 = clamp(Math.floor(gy), 0, GRID_ROWS - 1);
      const x1 = clamp(x0 + 1, 0, GRID_COLS - 1);
      const y1 = clamp(y0 + 1, 0, GRID_ROWS - 1);
      const fx = clamp(gx - x0, 0, 1);
      const fy = clamp(gy - y0, 0, 1);
      return (
        field[x0][y0] * (1 - fx) * (1 - fy) +
        field[x1][y0] * fx * (1 - fy) +
        field[x0][y1] * (1 - fx) * fy +
        field[x1][y1] * fx * fy
      );
    }

    initMenuBackground();

    // ── Level Initialization ──────────────────────────────────────────────

    function initLevel(idx: number) {
      const def = LEVELS[idx];
      if (!def) return;

      // Reset grids
      cellType = createGrid(EMPTY);
      temperature = createGrid(AMBIENT_TEMP);
      tempBuffer = createGrid(AMBIENT_TEMP);
      vx = createGrid(0);
      vy = createGrid(0);
      iceHealth = createGrid(0);

      // Place walls
      for (const w of def.walls) {
        for (let dx = 0; dx < w.w; dx++) {
          for (let dy = 0; dy < w.h; dy++) {
            const wx = w.gx + dx;
            const wy = w.gy + dy;
            if (wx >= 0 && wx < GRID_COLS && wy >= 0 && wy < GRID_ROWS) {
              cellType[wx][wy] = WALL;
            }
          }
        }
      }

      // Place ice blocks
      if (def.iceBlocks) {
        for (const ib of def.iceBlocks) {
          if (ib.gx >= 0 && ib.gx < GRID_COLS && ib.gy >= 0 && ib.gy < GRID_ROWS) {
            cellType[ib.gx][ib.gy] = ICE;
            iceHealth[ib.gx][ib.gy] = 1.0;
          }
        }
      }

      // Place insulation walls
      if (def.insulationWalls) {
        for (const iw of def.insulationWalls) {
          for (let dx = 0; dx < iw.w; dx++) {
            for (let dy = 0; dy < iw.h; dy++) {
              const wx = iw.gx + dx;
              const wy = iw.gy + dy;
              if (wx >= 0 && wx < GRID_COLS && wy >= 0 && wy < GRID_ROWS) {
                cellType[wx][wy] = INSULATION;
              }
            }
          }
        }
      }

      // Place vents
      vents = [];
      if (def.vents) {
        for (const v of def.vents) {
          if (v.gx >= 0 && v.gx < GRID_COLS && v.gy >= 0 && v.gy < GRID_ROWS) {
            cellType[v.gx][v.gy] = VENT;
            vents.push({
              gx: v.gx, gy: v.gy,
              period: v.period,
              blastDuration: v.blastDuration,
              timer: 0,
              active: false,
            });
          }
        }
      }

      // Initialize particles
      flowParticles = def.particles.map((p, i) => ({
        x: (p.gx + 0.5) * CELL_W,
        y: (p.gy + 0.5) * CELL_H,
        vx: 0, vy: 0,
        goalIndex: i < def.goals.length ? i : -1,
        trail: [],
        inGoalTimer: 0,
        delivered: false,
        temperature: AMBIENT_TEMP,
      }));

      // Initialize goals
      goalZones = def.goals.map((g, i) => ({
        x: (g.gx + 0.5) * CELL_W,
        y: (g.gy + 0.5) * CELL_H,
        radius: GOAL_RADIUS,
        particleIndex: i < def.particles.length ? i : -1,
        reached: false,
      }));

      // Player resources
      heatRemaining = def.heatSources;
      coldRemaining = def.coldSinks;
      sources = [];
      deliveredCount = 0;
      totalParticles = def.particles.length;
      levelTime = 0;
      gateOpen = false;
      gateTimer = 0;

      // Clear effects
      particles = [];
      floatingTexts = [];
      phase = 'placing';
    }

    // ── Source Placement ──────────────────────────────────────────────────

    function placeSource(gx: number, gy: number, type: 'heat' | 'cold') {
      if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return;
      if (cellType[gx][gy] !== EMPTY) return;

      // Check if source already exists here
      const existing = sources.findIndex(s => s.gx === gx && s.gy === gy);
      if (existing >= 0) {
        // Remove existing source
        const removed = sources[existing];
        if (removed.type === 'heat') heatRemaining++;
        else coldRemaining++;
        sources.splice(existing, 1);
        SoundEngine.play('remove');
        return;
      }

      // Check if cell is occupied by a particle start or goal
      for (const p of flowParticles) {
        const pgx = Math.floor(p.x / CELL_W);
        const pgy = Math.floor(p.y / CELL_H);
        if (pgx === gx && pgy === gy) return;
      }
      for (const g of goalZones) {
        const ggx = Math.floor(g.x / CELL_W);
        const ggy = Math.floor(g.y / CELL_H);
        if (ggx === gx && ggy === gy) return;
      }

      if (type === 'heat' && heatRemaining > 0) {
        sources.push({ gx, gy, type: 'heat' });
        heatRemaining--;
        SoundEngine.play('ignite');
      } else if (type === 'cold' && coldRemaining > 0) {
        sources.push({ gx, gy, type: 'cold' });
        coldRemaining--;
        SoundEngine.play('extinguish');
      }
    }

    // ── Start Simulation ──────────────────────────────────────────────────

    function startSimulation() {
      if (phase !== 'placing') return;
      phase = 'simulating';
      levelTime = 0;
      SoundEngine.play('launch');

      // Apply sources to temperature grid
      for (const s of sources) {
        temperature[s.gx][s.gy] = s.type === 'heat' ? 1.0 : 0.0;
      }
    }

    // ── Reset Level ───────────────────────────────────────────────────────

    function resetLevel() {
      initLevel(level);
      SoundEngine.play('click');
    }

    // ── Physics Update ────────────────────────────────────────────────────

    function updateSimulation(dt: number) {
      const cols = GRID_COLS;
      const rows = GRID_ROWS;

      // ─ Maintain source temperatures ─
      for (const s of sources) {
        temperature[s.gx][s.gy] = s.type === 'heat' ? 1.0 : 0.0;
      }

      // ─ Gate logic (level 9) ─
      if (level === 8) { // 0-indexed
        gateTimer += dt;
        if (gateTimer >= GATE_PERIOD) {
          gateTimer -= GATE_PERIOD;
          gateOpen = !gateOpen;
        }
        // Toggle gate cells
        for (let gy = 13; gy <= 17; gy++) {
          if (gy >= 0 && gy < rows) {
            cellType[20][gy] = gateOpen ? EMPTY : WALL;
          }
        }
      }

      // ─ Steam vent update ─
      for (const v of vents) {
        v.timer += dt;
        if (v.timer >= v.period) v.timer -= v.period;
        v.active = v.timer < v.blastDuration;

        if (v.active) {
          // Blast upward: set temperature hot in column above vent
          for (let dy = 1; dy <= 5; dy++) {
            const vy2 = v.gy - dy;
            if (vy2 >= 0 && vy2 < rows && cellType[v.gx][vy2] === EMPTY) {
              temperature[v.gx][vy2] = Math.min(1.0, temperature[v.gx][vy2] + 0.3 * dt);
            }
          }
          // Spawn vent particles
          if (frameCount % 2 === 0) {
            particles.push({
              x: (v.gx + 0.5) * CELL_W + (Math.random() - 0.5) * 8,
              y: (v.gy) * CELL_H,
              vx: (Math.random() - 0.5) * 20,
              vy: -100 - Math.random() * 80,
              life: 0.5 + Math.random() * 0.3,
              maxLife: 0.8,
              color: COLORS.ventBlast,
              size: 2 + Math.random() * 2,
            });
          }
        }
      }

      // ─ Ice melting ─
      for (let x = 1; x < cols - 1; x++) {
        for (let y = 1; y < rows - 1; y++) {
          if (cellType[x][y] === ICE) {
            // Check neighboring temperatures
            let heatNearby = 0;
            if (x > 0) heatNearby += Math.max(0, temperature[x - 1][y] - 0.6);
            if (x < cols - 1) heatNearby += Math.max(0, temperature[x + 1][y] - 0.6);
            if (y > 0) heatNearby += Math.max(0, temperature[x][y - 1] - 0.6);
            if (y < rows - 1) heatNearby += Math.max(0, temperature[x][y + 1] - 0.6);

            if (heatNearby > 0) {
              iceHealth[x][y] -= heatNearby * dt * 0.8;
              if (iceHealth[x][y] <= 0) {
                cellType[x][y] = EMPTY;
                iceHealth[x][y] = 0;
                // Melt effect
                for (let i = 0; i < 5; i++) {
                  particles.push({
                    x: (x + 0.5) * CELL_W + (Math.random() - 0.5) * CELL_W,
                    y: (y + 0.5) * CELL_H + (Math.random() - 0.5) * CELL_H,
                    vx: (Math.random() - 0.5) * 40,
                    vy: (Math.random() - 0.5) * 40,
                    life: 0.5 + Math.random() * 0.3,
                    maxLife: 0.8,
                    color: COLORS.ice,
                    size: 2 + Math.random() * 2,
                  });
                }
              }
            }
          }
        }
      }

      // ─ Temperature diffusion ─
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          tempBuffer[x][y] = temperature[x][y];
        }
      }

      for (let x = 1; x < cols - 1; x++) {
        for (let y = 1; y < rows - 1; y++) {
          if (cellType[x][y] === WALL || cellType[x][y] === ICE) continue;

          let sum = 0;
          let count = 0;

          // Check neighbors, skip insulation boundaries
          const neighbors = [
            [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
          ];

          for (const [nx, ny] of neighbors) {
            if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
            if (cellType[nx][ny] === WALL || cellType[nx][ny] === ICE) continue;
            // Insulation blocks heat transfer
            if (cellType[x][y] === INSULATION || cellType[nx][ny] === INSULATION) continue;
            sum += temperature[nx][ny];
            count++;
          }

          if (count > 0) {
            tempBuffer[x][y] = temperature[x][y] + DIFFUSION_RATE * dt * (
              sum - count * temperature[x][y]
            ) / count * count; // normalize properly
          }
          tempBuffer[x][y] = clamp(tempBuffer[x][y], 0, 1);
        }
      }

      // Restore source temperatures in buffer
      for (const s of sources) {
        tempBuffer[s.gx][s.gy] = s.type === 'heat' ? 1.0 : 0.0;
      }

      // Swap
      for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
          temperature[x][y] = tempBuffer[x][y];
        }
      }

      // ─ Compute velocity field ─
      for (let x = 1; x < cols - 1; x++) {
        for (let y = 1; y < rows - 1; y++) {
          if (cellType[x][y] === WALL || cellType[x][y] === ICE) {
            vx[x][y] = 0;
            vy[x][y] = 0;
            continue;
          }

          // Horizontal: pressure from temperature gradient
          let leftT = temperature[x - 1][y];
          let rightT = temperature[x + 1][y];
          if (cellType[x - 1][y] === WALL || cellType[x - 1][y] === ICE) leftT = temperature[x][y];
          if (cellType[x + 1][y] === WALL || cellType[x + 1][y] === ICE) rightT = temperature[x][y];

          vx[x][y] = (rightT - leftT) * PRESSURE_SCALE;

          // Vertical: buoyancy (hot rises, cold sinks)
          vy[x][y] = -(temperature[x][y] - AMBIENT_TEMP) * BUOYANCY_SCALE;
        }
      }

      // ─ Update flow particles ─
      for (const fp of flowParticles) {
        if (fp.delivered) continue;

        // Sample velocity field
        const svx = sampleField(vx, fp.x, fp.y);
        const svy = sampleField(vy, fp.x, fp.y);

        // Apply with inertia
        fp.vx = fp.vx * PARTICLE_DAMPING + svx * dt * 60;
        fp.vy = fp.vy * PARTICLE_DAMPING + svy * dt * 60;

        // Limit max speed
        const speed = Math.sqrt(fp.vx * fp.vx + fp.vy * fp.vy);
        const maxSpeed = 200;
        if (speed > maxSpeed) {
          fp.vx = (fp.vx / speed) * maxSpeed;
          fp.vy = (fp.vy / speed) * maxSpeed;
        }

        // Move
        let newX = fp.x + fp.vx * dt;
        let newY = fp.y + fp.vy * dt;

        // Wall collision
        const checkCell = (px: number, py: number): boolean => {
          const gx = Math.floor(px / CELL_W);
          const gy = Math.floor(py / CELL_H);
          if (gx < 0 || gx >= GRID_COLS || gy < 0 || gy >= GRID_ROWS) return true;
          const ct = cellType[gx][gy];
          return ct === WALL || ct === ICE;
        };

        // Collision with padding
        const r = PARTICLE_RADIUS;
        if (checkCell(newX - r, newY) || checkCell(newX + r, newY)) {
          fp.vx *= -0.3;
          newX = fp.x;
        }
        if (checkCell(newX, newY - r) || checkCell(newX, newY + r)) {
          fp.vy *= -0.3;
          newY = fp.y;
        }

        // Bounds
        newX = clamp(newX, CELL_W + r, W - CELL_W - r);
        newY = clamp(newY, CELL_H + r, H - CELL_H - r);

        fp.x = newX;
        fp.y = newY;

        // Sample temperature at particle position
        const gxp = clamp(Math.floor(fp.x / CELL_W), 0, GRID_COLS - 1);
        const gyp = clamp(Math.floor(fp.y / CELL_H), 0, GRID_ROWS - 1);
        fp.temperature = temperature[gxp][gyp];

        // Trail
        fp.trail.unshift({ x: fp.x, y: fp.y });
        if (fp.trail.length > MAX_TRAIL_LEN) fp.trail.pop();

        // Steam vent blast — push particles upward if near active vent
        for (const v of vents) {
          if (!v.active) continue;
          const ventX = (v.gx + 0.5) * CELL_W;
          const ventY = (v.gy + 0.5) * CELL_H;
          const dx = fp.x - ventX;
          const dy = fp.y - ventY;
          if (Math.abs(dx) < CELL_W * 1.5 && dy < 0 && dy > -CELL_H * 6) {
            fp.vy -= 400 * dt;
          }
        }

        // Check goal zones
        const goalIdx = fp.goalIndex;
        if (goalIdx >= 0 && goalIdx < goalZones.length) {
          const goal = goalZones[goalIdx];
          if (!goal.reached) {
            const gdx = fp.x - goal.x;
            const gdy = fp.y - goal.y;
            const dist = Math.sqrt(gdx * gdx + gdy * gdy);
            if (dist < goal.radius + PARTICLE_RADIUS) {
              fp.inGoalTimer += dt;
              if (fp.inGoalTimer >= GOAL_DWELL_TIME) {
                fp.delivered = true;
                goal.reached = true;
                deliveredCount++;
                SoundEngine.play('collectGem');

                // Score
                const basePoints = 100;
                score += basePoints;
                floatingTexts.push({
                  x: goal.x, y: goal.y - 20,
                  text: `+${basePoints}`, color: COLORS.goalGlow,
                  vy: -40, life: 1.2, maxLife: 1.2,
                });

                // Burst particles
                for (let i = 0; i < 12; i++) {
                  const angle = (i / 12) * Math.PI * 2;
                  particles.push({
                    x: goal.x, y: goal.y,
                    vx: Math.cos(angle) * 60 + (Math.random() - 0.5) * 20,
                    vy: Math.sin(angle) * 60 + (Math.random() - 0.5) * 20,
                    life: 0.6 + Math.random() * 0.3,
                    maxLife: 0.9,
                    color: COLORS.goalGlow,
                    size: 2 + Math.random() * 2,
                  });
                }

                // Check if all delivered
                if (deliveredCount >= totalParticles) {
                  onLevelComplete();
                }
              }
            } else {
              fp.inGoalTimer = Math.max(0, fp.inGoalTimer - dt * 2);
            }
          }
        }
      }
    }

    // ── Level Complete ────────────────────────────────────────────────────

    function onLevelComplete() {
      phase = 'levelComplete';
      levelCompleteTimer = 0;

      // Calculate bonuses
      const unusedSources = heatRemaining + coldRemaining;
      const sourceBonus = unusedSources * 50;
      const timeBonus = Math.max(0, Math.floor((60 - levelTime) * 2));
      const perfectBonus = deliveredCount >= totalParticles ? 200 : 0;

      score += sourceBonus + timeBonus + perfectBonus;

      if (sourceBonus > 0) {
        floatingTexts.push({
          x: W / 2, y: H / 2 - 40,
          text: `Source Bonus: +${sourceBonus}`, color: '#fbbf24',
          vy: -25, life: 2, maxLife: 2,
        });
      }
      if (timeBonus > 0) {
        floatingTexts.push({
          x: W / 2, y: H / 2 - 10,
          text: `Time Bonus: +${timeBonus}`, color: '#60a5fa',
          vy: -25, life: 2, maxLife: 2,
        });
      }
      if (perfectBonus > 0) {
        floatingTexts.push({
          x: W / 2, y: H / 2 + 20,
          text: `Perfect: +${perfectBonus}`, color: '#22c55e',
          vy: -25, life: 2, maxLife: 2,
        });
      }

      SoundEngine.play('collectStar');
      reportLevelComplete('convect', level + 1, score);

      // High score check
      if (score > highScore) {
        highScore = score;
        setHighScore('convect', highScore);
        if (!newHighScoreFlag) {
          newHighScoreFlag = true;
          SoundEngine.play('newHighScore');
        }
      }
    }

    // ── Update ────────────────────────────────────────────────────────────

    function update(dt: number) {
      if (phase === 'simulating') {
        levelTime += dt;
        updateSimulation(dt);

        // Timeout check
        if (levelTime >= LEVEL_TIMEOUT) {
          // Not a hard fail — player can still retry
          floatingTexts.push({
            x: W / 2, y: H / 2,
            text: 'TIME UP! Press R to retry', color: '#ef4444',
            vy: -15, life: 3, maxLife: 3,
          });
          phase = 'placing';
          initLevel(level);
        }
      } else if (phase === 'levelComplete') {
        levelCompleteTimer += dt;
        // Auto-advance after 2.5 seconds
        if (levelCompleteTimer >= 2.5) {
          level++;
          if (level >= LEVELS.length) {
            // Game complete!
            state = 'gameover';
            SoundEngine.play('levelComplete');
            reportGameEnd('convect', score, true, level);
          } else {
            initLevel(level);
            SoundEngine.play('levelComplete');
          }
        }
      }

      // Update visual particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Update floating texts
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y += ft.vy * dt;
        ft.life -= dt;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
      }
    }

    // ── Draw Functions ────────────────────────────────────────────────────

    function drawMenu() {
      // Background with temperature visualization
      for (let x = 0; x < GRID_COLS; x++) {
        for (let y = 0; y < GRID_ROWS; y++) {
          const t = menuTemp[x][y];
          ctx.fillStyle = tempToColor(t);
          ctx.globalAlpha = 0.4;
          ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W, CELL_H);
        }
      }
      ctx.globalAlpha = 1;

      // Draw menu particles
      for (const p of menuParticles) {
        // Trail
        for (let i = 1; i < p.trail.length; i++) {
          const alpha = 1 - i / p.trail.length;
          ctx.globalAlpha = alpha * 0.4;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
          ctx.stroke();
        }
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Title
      const pulse = Math.sin(menuTime * 2) * 0.1 + 0.9;
      ctx.save();
      ctx.shadowColor = COLORS.primary;
      ctx.shadowBlur = 20 * pulse;
      ctx.fillStyle = COLORS.primary;
      ctx.font = 'bold 72px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('CONVECT', W / 2, H / 2 - 60);
      ctx.restore();

      // Subtitle
      ctx.fillStyle = COLORS.hudDim;
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Heat Flow Puzzles', W / 2, H / 2 - 10);

      // Instructions
      const blink = Math.sin(menuTime * 3) > 0;
      if (blink) {
        ctx.fillStyle = COLORS.hud;
        ctx.font = '16px monospace';
        ctx.fillText('Press ENTER or Click to Start', W / 2, H / 2 + 50);
      }

      // Controls info
      ctx.fillStyle = COLORS.hudDim;
      ctx.font = '13px monospace';
      ctx.fillText('Left-click: Place Heat  |  Right-click / Shift+click: Place Cold', W / 2, H / 2 + 90);
      ctx.fillText('SPACE: Start Simulation  |  R: Reset Level', W / 2, H / 2 + 110);

      // High score
      if (highScore > 0) {
        ctx.fillStyle = COLORS.primary;
        ctx.font = '14px monospace';
        ctx.fillText(`High Score: ${highScore}`, W / 2, H / 2 + 150);
      }
    }

    function drawGame() {
      // ─ Temperature grid ─
      for (let x = 0; x < GRID_COLS; x++) {
        for (let y = 0; y < GRID_ROWS; y++) {
          const ct = cellType[x][y];
          const t = temperature[x][y];
          const px = x * CELL_W;
          const py = y * CELL_H;

          if (ct === WALL) {
            ctx.fillStyle = COLORS.wall;
            ctx.fillRect(px, py, CELL_W, CELL_H);
            // Edge highlight
            ctx.strokeStyle = COLORS.wallEdge;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(px + 0.5, py + 0.5, CELL_W - 1, CELL_H - 1);
          } else if (ct === ICE) {
            const health = iceHealth[x][y];
            ctx.globalAlpha = 0.5 + health * 0.5;
            ctx.fillStyle = COLORS.ice;
            ctx.fillRect(px, py, CELL_W, CELL_H);
            // Crystal pattern
            if (health > 0.3) {
              ctx.strokeStyle = COLORS.iceCrack;
              ctx.lineWidth = 0.5;
              ctx.globalAlpha = health * 0.6;
              ctx.beginPath();
              ctx.moveTo(px + 3, py + 3);
              ctx.lineTo(px + CELL_W - 3, py + CELL_H - 3);
              ctx.moveTo(px + CELL_W - 3, py + 3);
              ctx.lineTo(px + 3, py + CELL_H - 3);
              ctx.stroke();
            }
            // Cracks when damaged
            if (health < 0.6 && health > 0) {
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.globalAlpha = (1 - health) * 0.5;
              ctx.beginPath();
              ctx.moveTo(px + CELL_W / 2, py);
              ctx.lineTo(px + CELL_W / 2 + (Math.random() - 0.5) * 6, py + CELL_H);
              ctx.stroke();
            }
            ctx.globalAlpha = 1;
          } else if (ct === INSULATION) {
            ctx.fillStyle = COLORS.insulation;
            ctx.fillRect(px, py, CELL_W, CELL_H);
            ctx.strokeStyle = COLORS.insulationEdge;
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 0.5, py + 0.5, CELL_W - 1, CELL_H - 1);
            // Hatching pattern
            ctx.globalAlpha = 0.3;
            ctx.strokeStyle = COLORS.insulationEdge;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + CELL_W, py + CELL_H);
            ctx.moveTo(px + CELL_W, py);
            ctx.lineTo(px, py + CELL_H);
            ctx.stroke();
            ctx.globalAlpha = 1;
          } else if (ct === VENT) {
            const vent = vents.find(v => v.gx === x && v.gy === y);
            ctx.fillStyle = vent && vent.active ? COLORS.ventBlast : COLORS.ventBase;
            ctx.fillRect(px, py, CELL_W, CELL_H);
            // Arrow up indicator
            ctx.fillStyle = '#ffffff';
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            ctx.moveTo(px + CELL_W / 2, py + 3);
            ctx.lineTo(px + 3, py + CELL_H - 3);
            ctx.lineTo(px + CELL_W - 3, py + CELL_H - 3);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          } else {
            // Empty cell — show temperature
            ctx.fillStyle = tempToColor(t);
            ctx.globalAlpha = phase === 'simulating' || phase === 'levelComplete' ? 0.6 : 0.25;
            ctx.fillRect(px, py, CELL_W, CELL_H);
            ctx.globalAlpha = 1;
          }
        }
      }

      // ─ Faint grid lines ─
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= GRID_COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL_W, 0);
        ctx.lineTo(x * CELL_W, H);
        ctx.stroke();
      }
      for (let y = 0; y <= GRID_ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL_H);
        ctx.lineTo(W, y * CELL_H);
        ctx.stroke();
      }

      // ─ Velocity field visualization (faint arrows during simulation) ─
      if (phase === 'simulating' || phase === 'levelComplete') {
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        for (let x = 2; x < GRID_COLS - 2; x += 3) {
          for (let y = 2; y < GRID_ROWS - 2; y += 3) {
            if (cellType[x][y] !== EMPTY) continue;
            const vxv = vx[x][y];
            const vyv = vy[x][y];
            const mag = Math.sqrt(vxv * vxv + vyv * vyv);
            if (mag < 5) continue;
            const cx = (x + 0.5) * CELL_W;
            const cy = (y + 0.5) * CELL_H;
            const scale = Math.min(mag * 0.08, 8);
            const nx = vxv / mag;
            const ny = vyv / mag;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + nx * scale, cy + ny * scale);
            ctx.stroke();
            // Arrowhead
            const ax = cx + nx * scale;
            const ay = cy + ny * scale;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax - nx * 2 + ny * 1.5, ay - ny * 2 - nx * 1.5);
            ctx.lineTo(ax - nx * 2 - ny * 1.5, ay - ny * 2 + nx * 1.5);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // ─ Goal zones ─
      const goalPulse = Math.sin(frameCount * 0.06) * 0.15 + 0.85;
      for (const goal of goalZones) {
        ctx.save();
        if (goal.reached) {
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = COLORS.goalGlow;
          ctx.beginPath();
          ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Glow
          ctx.shadowColor = COLORS.goalGlow;
          ctx.shadowBlur = 12 * goalPulse;
          ctx.strokeStyle = COLORS.goalBorder;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.lineDashOffset = frameCount * 0.3;
          ctx.beginPath();
          ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Inner fill
          ctx.globalAlpha = 0.15 * goalPulse;
          ctx.fillStyle = COLORS.goalGlow;
          ctx.beginPath();
          ctx.arc(goal.x, goal.y, goal.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ─ Sources ─
      for (const s of sources) {
        const sx = (s.gx + 0.5) * CELL_W;
        const sy = (s.gy + 0.5) * CELL_H;
        const pulse2 = Math.sin(frameCount * 0.08) * 0.2 + 0.8;

        ctx.save();
        if (s.type === 'heat') {
          ctx.shadowColor = COLORS.heatSource;
          ctx.shadowBlur = 10 * pulse2;
          ctx.fillStyle = COLORS.heatSource;
          ctx.globalAlpha = 0.8 * pulse2;
          ctx.beginPath();
          ctx.arc(sx, sy, 7 * pulse2, 0, Math.PI * 2);
          ctx.fill();
          // Inner glow
          ctx.fillStyle = COLORS.heatGlow;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.shadowColor = COLORS.coldSink;
          ctx.shadowBlur = 10 * pulse2;
          ctx.fillStyle = COLORS.coldSink;
          ctx.globalAlpha = 0.8 * pulse2;
          ctx.beginPath();
          ctx.arc(sx, sy, 7 * pulse2, 0, Math.PI * 2);
          ctx.fill();
          // Inner glow
          ctx.fillStyle = COLORS.coldGlow;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(sx, sy, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ─ Flow particles ─
      for (const fp of flowParticles) {
        if (fp.delivered) continue;

        // Trail
        const tColor = particleTempColor(fp.temperature);
        for (let i = 1; i < fp.trail.length; i++) {
          const alpha = (1 - i / fp.trail.length) * 0.5;
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = tColor;
          ctx.lineWidth = Math.max(1, PARTICLE_RADIUS * 2 * (1 - i / fp.trail.length));
          ctx.beginPath();
          ctx.moveTo(fp.trail[i - 1].x, fp.trail[i - 1].y);
          ctx.lineTo(fp.trail[i].x, fp.trail[i].y);
          ctx.stroke();
        }

        // Core
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.shadowColor = tColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.particleCore;
        ctx.beginPath();
        ctx.arc(fp.x, fp.y, PARTICLE_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        // Temperature ring
        ctx.strokeStyle = tColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(fp.x, fp.y, PARTICLE_RADIUS + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Goal dwell indicator
        if (fp.inGoalTimer > 0 && !fp.delivered) {
          const progress = fp.inGoalTimer / GOAL_DWELL_TIME;
          ctx.strokeStyle = COLORS.goalGlow;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(fp.x, fp.y, PARTICLE_RADIUS + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
          ctx.stroke();
        }
      }

      // ─ Visual particles ─
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ─ Floating texts ─
      for (const ft of floatingTexts) {
        const alpha = ft.life / ft.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      // ─ Mouse hover preview (placing phase) ─
      if (phase === 'placing' && !isTouchDevice()) {
        const gx = Math.floor(mouseX / CELL_W);
        const gy = Math.floor(mouseY / CELL_H);
        if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS && cellType[gx][gy] === EMPTY) {
          const existing = sources.find(s => s.gx === gx && s.gy === gy);
          if (!existing) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = heatRemaining > 0 ? COLORS.heatSource : COLORS.coldSink;
            ctx.fillRect(gx * CELL_W, gy * CELL_H, CELL_W, CELL_H);
            ctx.globalAlpha = 1;
          }
        }
      }

      // ─ HUD ─
      drawHUD();
    }

    function drawHUD() {
      const def = LEVELS[level];
      if (!def) return;

      // Background bar
      ctx.fillStyle = COLORS.hudBg;
      ctx.fillRect(0, 0, W, 32);

      // Level name (top left)
      ctx.fillStyle = COLORS.hud;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Lv ${level + 1}: ${def.name}`, 10, 16);

      // Score (top center)
      ctx.fillStyle = COLORS.primary;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Score: ${score}`, W / 2, 16);

      // Sources remaining (top right)
      ctx.textAlign = 'right';
      ctx.font = '12px monospace';
      ctx.fillStyle = COLORS.heatSource;
      ctx.fillText(`Heat: ${heatRemaining}`, W - 90, 16);
      ctx.fillStyle = COLORS.coldSink;
      ctx.fillText(`Cold: ${coldRemaining}`, W - 10, 16);

      // Bottom bar
      ctx.fillStyle = COLORS.hudBg;
      ctx.fillRect(0, H - 28, W, 28);

      // Timer (bottom left)
      ctx.fillStyle = COLORS.hudDim;
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const mins = Math.floor(levelTime / 60);
      const secs = Math.floor(levelTime % 60);
      ctx.fillText(`Time: ${mins}:${secs.toString().padStart(2, '0')}`, 10, H - 14);

      // Status indicator (bottom center)
      ctx.textAlign = 'center';
      if (phase === 'placing') {
        ctx.fillStyle = COLORS.placing;
        ctx.fillText('PLACING  [SPACE to simulate]', W / 2, H - 14);
      } else if (phase === 'simulating') {
        ctx.fillStyle = COLORS.simulating;
        ctx.fillText('SIMULATING  [R to reset]', W / 2, H - 14);
      } else if (phase === 'levelComplete') {
        ctx.fillStyle = COLORS.goalGlow;
        ctx.fillText('LEVEL COMPLETE!', W / 2, H - 14);
      }

      // Particles delivered (bottom right)
      ctx.fillStyle = COLORS.hud;
      ctx.textAlign = 'right';
      ctx.font = '12px monospace';
      ctx.fillText(`Delivered: ${deliveredCount}/${totalParticles}`, W - 10, H - 14);

      // High score indicator
      if (newHighScoreFlag) {
        const flash = Math.sin(frameCount * 0.1) > 0;
        if (flash) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('NEW HIGH SCORE!', W / 2, 42);
        }
      }
    }

    function drawGameOver() {
      // Dim background
      ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
      ctx.fillRect(0, 0, W, H);

      const allComplete = level >= LEVELS.length;

      // Title
      ctx.save();
      ctx.shadowColor = allComplete ? COLORS.goalGlow : COLORS.primary;
      ctx.shadowBlur = 20;
      ctx.fillStyle = allComplete ? COLORS.goalGlow : COLORS.primary;
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(allComplete ? 'ALL LEVELS COMPLETE!' : 'GAME OVER', W / 2, H / 2 - 80);
      ctx.restore();

      // Score
      ctx.fillStyle = COLORS.hud;
      ctx.font = '22px monospace';
      ctx.fillText(`Total Score: ${score}`, W / 2, H / 2 - 20);

      // Levels completed
      ctx.fillStyle = COLORS.hudDim;
      ctx.font = '16px monospace';
      ctx.fillText(`Levels Completed: ${level}/${LEVELS.length}`, W / 2, H / 2 + 20);

      // High score
      ctx.fillStyle = COLORS.primary;
      ctx.font = '16px monospace';
      ctx.fillText(`High Score: ${highScore}`, W / 2, H / 2 + 55);

      if (newHighScoreFlag) {
        const flash = Math.sin(frameCount * 0.12) > 0;
        if (flash) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 18px monospace';
          ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 85);
        }
      }

      // Restart prompt
      const blink = Math.sin(menuTime * 3) > 0;
      if (blink) {
        ctx.fillStyle = COLORS.hud;
        ctx.font = '14px monospace';
        ctx.fillText('Press ENTER to Play Again', W / 2, H / 2 + 130);
      }
    }

    function draw() {
      // Clear
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      if (state === 'menu') {
        drawMenu();
      } else if (state === 'playing') {
        drawGame();
      } else if (state === 'gameover') {
        drawGameOver();
      }

      // Touch controller overlay
      touch.draw(ctx, W, H);
    }

    // ── Input Handling ────────────────────────────────────────────────────

    function getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
      cachedRect = canvas!.getBoundingClientRect();
      return {
        x: (clientX - cachedRect.left) * (W / cachedRect.width),
        y: (clientY - cachedRect.top) * (H / cachedRect.height),
      };
    }

    function handleMouseDown(e: MouseEvent) {
      e.preventDefault();
      const pos = getCanvasPos(e.clientX, e.clientY);
      mouseX = pos.x;
      mouseY = pos.y;

      if (state === 'menu') {
        startGame();
        return;
      }

      if (state === 'gameover') {
        restartGame();
        return;
      }

      if (state === 'playing' && phase === 'placing') {
        const gx = Math.floor(pos.x / CELL_W);
        const gy = Math.floor(pos.y / CELL_H);

        // Right-click or shift+click = cold
        if (e.button === 2 || e.shiftKey) {
          placeSource(gx, gy, 'cold');
        } else {
          placeSource(gx, gy, 'heat');
        }
      }
    }

    function handleMouseMove(e: MouseEvent) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      mouseX = pos.x;
      mouseY = pos.y;
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const pos = getCanvasPos(t.clientX, t.clientY);
      mouseX = pos.x;
      mouseY = pos.y;

      if (state === 'menu') {
        startGame();
        return;
      }

      if (state === 'gameover') {
        restartGame();
        return;
      }

      if (state === 'playing' && phase === 'placing') {
        const gx = Math.floor(pos.x / CELL_W);
        const gy = Math.floor(pos.y / CELL_H);
        // Single touch = heat, two-finger touch = cold
        if (e.touches.length >= 2) {
          placeSource(gx, gy, 'cold');
        } else {
          placeSource(gx, gy, 'heat');
        }
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (state === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame();
        }
        return;
      }

      if (state === 'gameover') {
        if (e.key === 'Enter') {
          e.preventDefault();
          restartGame();
        }
        return;
      }

      if (state === 'playing') {
        if (e.key === ' ' || e.key === 'Space') {
          e.preventDefault();
          startSimulation();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          resetLevel();
        }
      }
    }

    function startGame() {
      state = 'playing';
      level = 0;
      score = 0;
      newHighScoreFlag = false;
      initLevel(0);
      SoundEngine.play('click');
      reportGameStart('convect');
    }

    function restartGame() {
      state = 'playing';
      level = 0;
      score = 0;
      newHighScoreFlag = false;
      initLevel(0);
      SoundEngine.play('click');
      reportGameStart('convect');
    }

    function handleResize() {
      cachedRect = canvas!.getBoundingClientRect();
    }

    // ── Event Listeners ───────────────────────────────────────────────────

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    // ── Game Loop ─────────────────────────────────────────────────────────
    let running = true;

    function gameLoop(timestamp: number) {
      if (!running) return;

      if (lastTime === 0) lastTime = timestamp;
      const rawDt = (timestamp - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.1); // cap delta time
      lastTime = timestamp;
      frameCount++;
      menuTime += dt;

      if (state === 'menu') {
        updateMenuBackground(dt);
      } else if (state === 'playing') {
        update(dt);
      }

      draw();
      animFrame = requestAnimationFrame(gameLoop);
    }

    animFrame = requestAnimationFrame(gameLoop);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      running = false;
      cancelAnimationFrame(animFrame);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      touch.destroy();
      SoundEngine.stopAllLoops();
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
