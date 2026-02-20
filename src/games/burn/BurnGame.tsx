'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd, reportLevelComplete } from '@/lib/game-events';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const COLS = 40;
const ROWS = 30;
const TILE = W / COLS; // 20px

// ─── Terrain Types ────────────────────────────────────────────────────────────
const GRASS = 0;
const TREE = 1;
const BUSH = 2;
const WATER = 3;
const STONE = 4;
const DIRT = 5;
const BUILDING = 6;

// ─── Fire States ──────────────────────────────────────────────────────────────
const UNBURNED = 0;
const IGNITING = 1;
const BURNING = 2;
const BURNED = 3;

// ─── Wind Directions ─────────────────────────────────────────────────────────
const WIND_DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
type WindDir = typeof WIND_DIRS[number];
type WindStrength = 'calm' | 'breezy' | 'strong';

// Direction deltas for wind (dx, dy where +y is south)
const WIND_DX: Record<WindDir, number> = { N: 0, NE: 1, E: 1, SE: 1, S: 0, SW: -1, W: -1, NW: -1 };
const WIND_DY: Record<WindDir, number> = { N: -1, NE: -1, E: 0, SE: 1, S: 1, SW: 1, W: 0, NW: -1 };

// ─── Ignition Times (seconds to ignite from neighbor) ─────────────────────────
const IGNITION_TIME: Record<number, number> = {
  [GRASS]: 0.3,
  [TREE]: 0.8,
  [BUSH]: 0.4,
  [BUILDING]: 1.5,
};

// ─── Burn Duration (seconds of burning before becoming ash) ───────────────────
const BURN_DURATION: Record<number, number> = {
  [GRASS]: 1.0,
  [TREE]: 2.0,
  [BUSH]: 1.2,
  [BUILDING]: 2.5,
};

// ─── Colors ───────────────────────────────────────────────────────────────────
const COLORS = {
  bg: '#0a0a0f',
  grass: '#4ade80',
  grassAlt: '#3fcc73',
  tree: '#166534',
  treeTrunk: '#92400e',
  bush: '#22c55e',
  water: '#3b82f6',
  waterLight: '#60a5fa',
  stone: '#6b7280',
  stoneLight: '#9ca3af',
  dirt: '#92400e',
  dirtLight: '#a3560f',
  building: '#78716c',
  buildingDark: '#57534e',
  fire1: '#f97316',
  fire2: '#ef4444',
  fire3: '#fbbf24',
  fire4: '#f59e0b',
  burned: '#1c1917',
  burnedLight: '#292524',
  igniting: '#fb923c',
  smoke: '#6b7280',
  primary: '#f97316',
  hud: '#e5e7eb',
  hudDim: '#9ca3af',
  hudBg: 'rgba(10, 10, 15, 0.85)',
  targetGreen: '#22c55e',
  targetRed: '#ef4444',
  targetYellow: '#fbbf24',
};

// ─── Particle ─────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
  type: 'fire' | 'smoke' | 'ember' | 'spark' | 'steam';
}

// ─── Level Definitions ────────────────────────────────────────────────────────
interface LevelDef {
  name: string;
  targetMin: number;
  targetMax: number;
  ignitionPoints: number;
  windEnabled: boolean;
  windStrength: WindStrength;
  windShiftInterval: [number, number]; // min, max seconds between shifts
  seed: number;
  waterDensity: number;
  stoneDensity: number;
  dirtDensity: number;
  treeDensity: number;
  bushDensity: number;
  buildingDensity: number;
  riverCount: number;
  pondCount: number;
  stoneWallCount: number;
}

const LEVELS: LevelDef[] = [
  // Level 1: Easy grassy field
  {
    name: 'Meadow', targetMin: 70, targetMax: 80, ignitionPoints: 3,
    windEnabled: false, windStrength: 'calm', windShiftInterval: [99, 99], seed: 42,
    waterDensity: 0.03, stoneDensity: 0.01, dirtDensity: 0.02, treeDensity: 0.05,
    bushDensity: 0.08, buildingDensity: 0, riverCount: 0, pondCount: 1, stoneWallCount: 0,
  },
  // Level 2: Forest with stream
  {
    name: 'Forest Stream', targetMin: 50, targetMax: 60, ignitionPoints: 2,
    windEnabled: false, windStrength: 'calm', windShiftInterval: [99, 99], seed: 137,
    waterDensity: 0.02, stoneDensity: 0.02, dirtDensity: 0.03, treeDensity: 0.3,
    bushDensity: 0.1, buildingDensity: 0, riverCount: 1, pondCount: 0, stoneWallCount: 0,
  },
  // Level 3: Mixed terrain, gentle wind
  {
    name: 'Windy Plains', targetMin: 40, targetMax: 50, ignitionPoints: 2,
    windEnabled: true, windStrength: 'calm', windShiftInterval: [15, 20], seed: 256,
    waterDensity: 0.03, stoneDensity: 0.04, dirtDensity: 0.05, treeDensity: 0.12,
    bushDensity: 0.1, buildingDensity: 0, riverCount: 0, pondCount: 2, stoneWallCount: 0,
  },
  // Level 4: Village introduction
  {
    name: 'Village Edge', targetMin: 45, targetMax: 55, ignitionPoints: 2,
    windEnabled: true, windStrength: 'breezy', windShiftInterval: [12, 18], seed: 333,
    waterDensity: 0.02, stoneDensity: 0.03, dirtDensity: 0.06, treeDensity: 0.1,
    bushDensity: 0.08, buildingDensity: 0.04, riverCount: 0, pondCount: 1, stoneWallCount: 1,
  },
  // Level 5: Strong wind challenge
  {
    name: 'Gale Ridge', targetMin: 40, targetMax: 50, ignitionPoints: 2,
    windEnabled: true, windStrength: 'strong', windShiftInterval: [10, 16], seed: 512,
    waterDensity: 0.04, stoneDensity: 0.05, dirtDensity: 0.04, treeDensity: 0.15,
    bushDensity: 0.1, buildingDensity: 0.02, riverCount: 1, pondCount: 1, stoneWallCount: 0,
  },
  // Level 6: Tight range with buildings
  {
    name: 'Outskirts', targetMin: 35, targetMax: 45, ignitionPoints: 2,
    windEnabled: true, windStrength: 'breezy', windShiftInterval: [10, 15], seed: 666,
    waterDensity: 0.03, stoneDensity: 0.04, dirtDensity: 0.08, treeDensity: 0.08,
    bushDensity: 0.06, buildingDensity: 0.06, riverCount: 0, pondCount: 2, stoneWallCount: 2,
  },
  // Level 7: River maze
  {
    name: 'River Delta', targetMin: 40, targetMax: 50, ignitionPoints: 2,
    windEnabled: true, windStrength: 'breezy', windShiftInterval: [10, 14], seed: 777,
    waterDensity: 0.05, stoneDensity: 0.03, dirtDensity: 0.04, treeDensity: 0.15,
    bushDensity: 0.1, buildingDensity: 0.02, riverCount: 3, pondCount: 0, stoneWallCount: 0,
  },
  // Level 8: Stone walls narrow it
  {
    name: 'Fortress', targetMin: 35, targetMax: 45, ignitionPoints: 2,
    windEnabled: true, windStrength: 'strong', windShiftInterval: [8, 14], seed: 888,
    waterDensity: 0.02, stoneDensity: 0.08, dirtDensity: 0.06, treeDensity: 0.1,
    bushDensity: 0.08, buildingDensity: 0.05, riverCount: 0, pondCount: 1, stoneWallCount: 4,
  },
  // Level 9: Isolated zones
  {
    name: 'Archipelago', targetMin: 30, targetMax: 40, ignitionPoints: 2,
    windEnabled: true, windStrength: 'breezy', windShiftInterval: [8, 13], seed: 999,
    waterDensity: 0.12, stoneDensity: 0.05, dirtDensity: 0.03, treeDensity: 0.12,
    bushDensity: 0.08, buildingDensity: 0.03, riverCount: 2, pondCount: 3, stoneWallCount: 1,
  },
  // Level 10: Frequent wind shifts
  {
    name: 'Tornado Alley', targetMin: 35, targetMax: 45, ignitionPoints: 2,
    windEnabled: true, windStrength: 'strong', windShiftInterval: [5, 10], seed: 1010,
    waterDensity: 0.04, stoneDensity: 0.03, dirtDensity: 0.05, treeDensity: 0.18,
    bushDensity: 0.1, buildingDensity: 0.03, riverCount: 1, pondCount: 1, stoneWallCount: 1,
  },
  // Level 11: Minimal ignition
  {
    name: 'One Match', targetMin: 30, targetMax: 40, ignitionPoints: 1,
    windEnabled: true, windStrength: 'breezy', windShiftInterval: [8, 12], seed: 1111,
    waterDensity: 0.05, stoneDensity: 0.04, dirtDensity: 0.04, treeDensity: 0.15,
    bushDensity: 0.1, buildingDensity: 0.04, riverCount: 1, pondCount: 2, stoneWallCount: 2,
  },
  // Level 12: Complex isolated zones
  {
    name: 'Divide', targetMin: 25, targetMax: 35, ignitionPoints: 2,
    windEnabled: true, windStrength: 'strong', windShiftInterval: [6, 10], seed: 1212,
    waterDensity: 0.08, stoneDensity: 0.06, dirtDensity: 0.06, treeDensity: 0.12,
    bushDensity: 0.08, buildingDensity: 0.04, riverCount: 2, pondCount: 2, stoneWallCount: 3,
  },
  // Level 13: Precision required
  {
    name: 'Scalpel', targetMin: 40, targetMax: 45, ignitionPoints: 2,
    windEnabled: true, windStrength: 'strong', windShiftInterval: [6, 10], seed: 1313,
    waterDensity: 0.06, stoneDensity: 0.05, dirtDensity: 0.05, treeDensity: 0.15,
    bushDensity: 0.1, buildingDensity: 0.04, riverCount: 1, pondCount: 2, stoneWallCount: 2,
  },
  // Level 14: Extreme precision
  {
    name: 'Razor', targetMin: 45, targetMax: 50, ignitionPoints: 1,
    windEnabled: true, windStrength: 'strong', windShiftInterval: [5, 9], seed: 1414,
    waterDensity: 0.05, stoneDensity: 0.06, dirtDensity: 0.06, treeDensity: 0.18,
    bushDensity: 0.08, buildingDensity: 0.05, riverCount: 2, pondCount: 1, stoneWallCount: 3,
  },
  // Level 15: The final burn
  {
    name: 'Inferno', targetMin: 50, targetMax: 55, ignitionPoints: 1,
    windEnabled: true, windStrength: 'strong', windShiftInterval: [4, 8], seed: 1515,
    waterDensity: 0.06, stoneDensity: 0.07, dirtDensity: 0.05, treeDensity: 0.2,
    bushDensity: 0.1, buildingDensity: 0.06, riverCount: 2, pondCount: 2, stoneWallCount: 4,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BurnGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Game State ────────────────────────────────────────────────────────
    type GameState = 'menu' | 'playing' | 'waiting' | 'levelComplete' | 'gameover';
    let state: GameState = 'menu';
    let paused = false;

    // Grid data
    let terrain: number[][] = [];
    let fireState: number[][] = [];
    let ignitionTimer: number[][] = [];   // countdown until tile catches fire
    let burnTimer: number[][] = [];       // countdown until tile becomes ash
    let igniteProgress: number[][] = [];  // 0-1 progress for igniting animation

    // Level
    let level = 0;
    let score = 0;
    let totalScore = 0;
    let ignitionPointsLeft = 0;
    let highScore = getHighScore('burn');
    let newHighScoreFlag = false;

    // Fire stats
    let totalFlammable = 0;
    let burnedCount = 0;
    let currentBurnPercent = 0;
    let fireActive = false;  // is fire still spreading?

    // Wind
    let windDir: WindDir = 'N';
    let windStrength: WindStrength = 'calm';
    let windShiftTimer = 0;
    let windShiftWarning = false;
    let windWarningTimer = 0;
    let windShiftFlash = 0;
    let nextWindShiftTime = 10;

    // Particles
    let particles: Particle[] = [];

    // Click flash for invalid placement feedback
    const clickFlashes: { x: number; y: number; life: number; maxLife: number }[] = [];

    // Animation
    let frameCount = 0;
    let lastTime = 0;
    let deltaTime = 0;
    let animFrame = 0;

    // Sound throttle
    let lastSpreadSound = 0;
    let fireSoundPlaying = false;

    // Menu animation
    let menuTime = 0;

    // Result display
    let resultTimer = 0;

    // Seeded RNG
    let rngState = 0;
    function seedRng(s: number) {
      rngState = s;
    }
    function rng(): number {
      rngState = (rngState * 1664525 + 1013904223) & 0xFFFFFFFF;
      return (rngState >>> 0) / 0xFFFFFFFF;
    }
    function rngInt(min: number, max: number): number {
      return Math.floor(rng() * (max - min + 1)) + min;
    }
    function rngFloat(min: number, max: number): number {
      return rng() * (max - min) + min;
    }

    // ── Helpers ───────────────────────────────────────────────────────────
    function isFlammable(t: number): boolean {
      return t === GRASS || t === TREE || t === BUSH || t === BUILDING;
    }

    function getWindMultiplier(fromCol: number, fromRow: number, toCol: number, toRow: number): number {
      if (windStrength === 'calm') return 1.0;
      const dx = toCol - fromCol;
      const dy = toRow - fromRow;
      const wdx = WIND_DX[windDir];
      const wdy = WIND_DY[windDir];
      // Dot product: if direction matches wind, fire goes faster
      const dot = dx * wdx + dy * wdy;
      const strengthMult = windStrength === 'strong' ? 1.0 : 0.5;
      if (dot > 0) return 1.0 + 1.0 * strengthMult; // downwind: 1.5x-2x faster
      if (dot < 0) return 1.0 - 0.5 * strengthMult; // upwind: 0.5x-0.75x slower
      return 1.0; // perpendicular
    }

    // ── Value Noise ───────────────────────────────────────────────────────
    function valueNoise(x: number, y: number, scale: number): number {
      const sx = x / scale;
      const sy = y / scale;
      const ix = Math.floor(sx);
      const iy = Math.floor(sy);
      const fx = sx - ix;
      const fy = sy - iy;
      // Smoothstep
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      // Hash corners
      const h00 = hash2d(ix, iy);
      const h10 = hash2d(ix + 1, iy);
      const h01 = hash2d(ix, iy + 1);
      const h11 = hash2d(ix + 1, iy + 1);
      // Bilinear interpolation
      const a = h00 + (h10 - h00) * ux;
      const b = h01 + (h11 - h01) * ux;
      return a + (b - a) * uy;
    }

    function hash2d(x: number, y: number): number {
      let h = (x * 374761393 + y * 668265263 + rngState * 1274126177) & 0xFFFFFFFF;
      h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF;
      h = (h ^ (h >> 16));
      return (h >>> 0) / 0xFFFFFFFF;
    }

    // ── Map Generation ────────────────────────────────────────────────────
    function generateMap(lvl: number) {
      const def = LEVELS[lvl];
      seedRng(def.seed + lvl * 7919);

      terrain = Array.from({ length: ROWS }, () => Array(COLS).fill(GRASS));
      fireState = Array.from({ length: ROWS }, () => Array(COLS).fill(UNBURNED));
      ignitionTimer = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      burnTimer = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      igniteProgress = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

      // Base terrain: mostly grass with noise-based variation
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const n1 = valueNoise(x, y, 6);
          const n2 = valueNoise(x + 100, y + 100, 4);
          const n3 = valueNoise(x + 200, y + 200, 8);

          // Trees based on noise
          if (n1 > (1 - def.treeDensity * 2.5) && rng() < def.treeDensity * 3) {
            terrain[y][x] = TREE;
          }
          // Bushes based on different noise
          else if (n2 > (1 - def.bushDensity * 2.5) && rng() < def.bushDensity * 3) {
            terrain[y][x] = BUSH;
          }
          // Stone patches
          else if (n3 > (1 - def.stoneDensity * 3) && rng() < def.stoneDensity * 2) {
            terrain[y][x] = STONE;
          }
          // Dirt patches
          else if (n1 < def.dirtDensity * 2 && rng() < def.dirtDensity * 2) {
            terrain[y][x] = DIRT;
          }
        }
      }

      // Add rivers
      for (let r = 0; r < def.riverCount; r++) {
        const vertical = rng() > 0.5;
        if (vertical) {
          let rx = rngInt(3, COLS - 4);
          for (let y = 0; y < ROWS; y++) {
            rx += rngInt(-1, 1);
            rx = Math.max(1, Math.min(COLS - 2, rx));
            const width = rngInt(1, 2);
            for (let dx = -width; dx <= width; dx++) {
              const xx = rx + dx;
              if (xx >= 0 && xx < COLS) {
                terrain[y][xx] = WATER;
              }
            }
          }
        } else {
          let ry = rngInt(3, ROWS - 4);
          for (let x = 0; x < COLS; x++) {
            ry += rngInt(-1, 1);
            ry = Math.max(1, Math.min(ROWS - 2, ry));
            const width = rngInt(1, 2);
            for (let dy = -width; dy <= width; dy++) {
              const yy = ry + dy;
              if (yy >= 0 && yy < ROWS) {
                terrain[yy][x] = WATER;
              }
            }
          }
        }
      }

      // Add ponds
      for (let p = 0; p < def.pondCount; p++) {
        const px = rngInt(4, COLS - 5);
        const py = rngInt(4, ROWS - 5);
        const radius = rngFloat(2.5, 4.5);
        for (let y = 0; y < ROWS; y++) {
          for (let x = 0; x < COLS; x++) {
            const dx = x - px;
            const dy = y - py;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius + rngFloat(-0.5, 0.5)) {
              terrain[y][x] = WATER;
            }
          }
        }
      }

      // Add stone walls
      for (let sw = 0; sw < def.stoneWallCount; sw++) {
        const horizontal = rng() > 0.5;
        if (horizontal) {
          const wy = rngInt(3, ROWS - 4);
          const startX = rngInt(2, COLS / 2);
          const endX = rngInt(COLS / 2, COLS - 3);
          for (let x = startX; x <= endX; x++) {
            terrain[wy][x] = STONE;
            // Leave gaps
            if (rng() < 0.15) {
              terrain[wy][x] = GRASS;
            }
          }
        } else {
          const wx = rngInt(3, COLS - 4);
          const startY = rngInt(2, ROWS / 2);
          const endY = rngInt(ROWS / 2, ROWS - 3);
          for (let y = startY; y <= endY; y++) {
            terrain[y][wx] = STONE;
            if (rng() < 0.15) {
              terrain[y][wx] = GRASS;
            }
          }
        }
      }

      // Add buildings
      if (def.buildingDensity > 0) {
        const buildingCount = Math.floor(COLS * ROWS * def.buildingDensity * 0.1);
        for (let b = 0; b < buildingCount; b++) {
          const bx = rngInt(2, COLS - 5);
          const by = rngInt(2, ROWS - 5);
          const bw = rngInt(2, 4);
          const bh = rngInt(2, 3);
          // Check if area is mostly grass
          let canPlace = true;
          for (let dy = 0; dy < bh && canPlace; dy++) {
            for (let dx = 0; dx < bw && canPlace; dx++) {
              if (by + dy >= ROWS || bx + dx >= COLS) canPlace = false;
              else if (terrain[by + dy][bx + dx] === WATER) canPlace = false;
            }
          }
          if (canPlace) {
            for (let dy = 0; dy < bh; dy++) {
              for (let dx = 0; dx < bw; dx++) {
                if (by + dy < ROWS && bx + dx < COLS) {
                  terrain[by + dy][bx + dx] = BUILDING;
                }
              }
            }
            // Add dirt path around building
            for (let dy = -1; dy <= bh; dy++) {
              for (let dx = -1; dx <= bw; dx++) {
                const yy = by + dy;
                const xx = bx + dx;
                if (yy >= 0 && yy < ROWS && xx >= 0 && xx < COLS) {
                  if (terrain[yy][xx] === GRASS && rng() < 0.4) {
                    terrain[yy][xx] = DIRT;
                  }
                }
              }
            }
          }
        }
      }

      // Count flammable tiles
      totalFlammable = 0;
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (isFlammable(terrain[y][x])) {
            totalFlammable++;
          }
        }
      }

      burnedCount = 0;
      currentBurnPercent = 0;
      fireActive = false;
      ignitionPointsLeft = def.ignitionPoints;

      // Wind setup
      if (def.windEnabled) {
        windDir = WIND_DIRS[rngInt(0, 7)];
        windStrength = def.windStrength;
        nextWindShiftTime = rngFloat(def.windShiftInterval[0], def.windShiftInterval[1]);
      } else {
        windDir = 'N';
        windStrength = 'calm';
        nextWindShiftTime = 9999;
      }
      windShiftTimer = 0;
      windShiftWarning = false;
      windWarningTimer = 0;
      windShiftFlash = 0;

      particles = [];
    }

    // ── Start Level ───────────────────────────────────────────────────────
    function startLevel(lvl: number) {
      level = lvl;
      generateMap(lvl);
      score = 0;
      newHighScoreFlag = false;
      state = 'playing';
      paused = false;
      resultTimer = 0;
      fireSoundPlaying = false;
    }

    // ── Ignite Tile ───────────────────────────────────────────────────────
    function igniteTile(col: number, row: number) {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
      if (!isFlammable(terrain[row][col])) return false;
      if (fireState[row][col] !== UNBURNED) return false;
      if (ignitionPointsLeft <= 0) return false;

      fireState[row][col] = IGNITING;
      ignitionTimer[row][col] = 0.3; // brief ignition
      igniteProgress[row][col] = 0;
      burnTimer[row][col] = BURN_DURATION[terrain[row][col]] || 1.5;
      ignitionPointsLeft--;
      fireActive = true;

      SoundEngine.play('place');
      return true;
    }

    // ── Extinguish All Fire ───────────────────────────────────────────────
    function extinguishAll() {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (fireState[y][x] === IGNITING || fireState[y][x] === BURNING) {
            fireState[y][x] = BURNED;
            burnedCount++;
          }
        }
      }
      fireActive = false;
      updateBurnPercent();
      evaluateResult();
    }

    // ── Update Burn Percent ───────────────────────────────────────────────
    function updateBurnPercent() {
      if (totalFlammable === 0) {
        currentBurnPercent = 0;
        return;
      }
      currentBurnPercent = (burnedCount / totalFlammable) * 100;
    }

    // ── Evaluate Result ───────────────────────────────────────────────────
    function evaluateResult() {
      const def = LEVELS[level];
      const midTarget = (def.targetMin + def.targetMax) / 2;
      const rangeHalf = (def.targetMax - def.targetMin) / 2;

      if (currentBurnPercent >= def.targetMin && currentBurnPercent <= def.targetMax) {
        // WIN
        const distFromCenter = Math.abs(currentBurnPercent - midTarget);
        const centerRatio = 1 - (distFromCenter / rangeHalf);
        // Score: 300-1000 based on precision
        if (centerRatio > 0.95) {
          score = 1000; // perfect
        } else if (centerRatio > 0.5) {
          score = Math.floor(500 + 500 * centerRatio);
        } else {
          score = Math.floor(300 + 200 * centerRatio);
        }

        totalScore += score;
        reportLevelComplete('burn', level + 1, score);

        // BULLSEYE if within 1% of center target
        const bullseyeThreshold = (def.targetMax - def.targetMin) * 0.01 + 0.5;
        if (distFromCenter <= bullseyeThreshold) {
          SoundEngine.play('bullseye');
        }
        SoundEngine.play('levelComplete');

        if (totalScore > highScore) {
          highScore = totalScore;
          setHighScore('burn', totalScore);
          newHighScoreFlag = true;
          SoundEngine.play('newHighScore');
        }

        state = 'levelComplete';
        resultTimer = 0;
      } else {
        // LOSE
        SoundEngine.play('wrongGuess');
        score = 0;

        reportGameEnd('burn', totalScore, false, level + 1);

        if (totalScore > highScore) {
          highScore = totalScore;
          setHighScore('burn', totalScore);
          newHighScoreFlag = true;
          SoundEngine.play('newHighScore');
        }

        state = 'gameover';
        resultTimer = 0;
      }

      if (fireSoundPlaying) {
        SoundEngine.stopLoop('beamFire');
        fireSoundPlaying = false;
      }
    }

    // ── Spawn Particle ────────────────────────────────────────────────────
    function spawnFireParticle(col: number, row: number) {
      const px = col * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.6;
      const py = row * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.4;
      const colors = [COLORS.fire1, COLORS.fire2, COLORS.fire3, COLORS.fire4];
      particles.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * 20,
        vy: -30 - Math.random() * 40,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.3 + Math.random() * 0.4,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
        type: 'fire',
      });
    }

    function spawnSmokeParticle(col: number, row: number) {
      const px = col * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.8;
      const py = row * TILE + TILE / 2;
      const windVx = WIND_DX[windDir] * (windStrength === 'strong' ? 25 : windStrength === 'breezy' ? 15 : 5);
      const windVy = WIND_DY[windDir] * (windStrength === 'strong' ? 15 : windStrength === 'breezy' ? 8 : 3);
      particles.push({
        x: px, y: py,
        vx: windVx + (Math.random() - 0.5) * 10,
        vy: -15 - Math.random() * 10 + windVy,
        life: 0.8 + Math.random() * 0.8,
        maxLife: 0.8 + Math.random() * 0.8,
        color: COLORS.smoke,
        size: 3 + Math.random() * 4,
        type: 'smoke',
      });
    }

    function spawnEmberParticle(col: number, row: number) {
      const px = col * TILE + TILE / 2 + (Math.random() - 0.5) * TILE;
      const py = row * TILE + TILE / 2;
      const windVx = WIND_DX[windDir] * (windStrength === 'strong' ? 35 : windStrength === 'breezy' ? 20 : 8);
      const windVy = WIND_DY[windDir] * (windStrength === 'strong' ? 20 : windStrength === 'breezy' ? 12 : 4);
      particles.push({
        x: px, y: py,
        vx: windVx + (Math.random() - 0.5) * 30,
        vy: -40 - Math.random() * 30 + windVy,
        life: 0.5 + Math.random() * 0.6,
        maxLife: 0.5 + Math.random() * 0.6,
        color: COLORS.fire3,
        size: 1 + Math.random() * 2,
        type: 'ember',
      });
    }

    function spawnSteamParticle(col: number, row: number) {
      const px = col * TILE + TILE / 2 + (Math.random() - 0.5) * TILE * 0.6;
      const py = row * TILE + TILE / 2;
      const steamColors = ['rgba(200, 220, 255, 0.8)', 'rgba(180, 210, 250, 0.7)', 'rgba(220, 235, 255, 0.6)'];
      particles.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * 12,
        vy: -25 - Math.random() * 20,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.5 + Math.random() * 0.4,
        color: steamColors[Math.floor(Math.random() * steamColors.length)],
        size: 2 + Math.random() * 3,
        type: 'steam',
      });
    }

    // ── Update ────────────────────────────────────────────────────────────
    function update(dt: number) {
      if (state !== 'playing' || paused) return;
      if (dt > 0.1) dt = 0.1; // cap for tab-out

      frameCount++;

      // ── Wind shift ──
      if (LEVELS[level].windEnabled) {
        windShiftTimer += dt;

        // Warning 2 seconds before shift
        if (windShiftTimer > nextWindShiftTime - 2 && !windShiftWarning) {
          windShiftWarning = true;
          windWarningTimer = 2;
          SoundEngine.play('eventWarning');
        }

        if (windWarningTimer > 0) {
          windWarningTimer -= dt;
        }

        if (windShiftTimer >= nextWindShiftTime) {
          // Shift wind
          const oldDir = windDir;
          let newDir = oldDir;
          while (newDir === oldDir) {
            newDir = WIND_DIRS[Math.floor(Math.random() * WIND_DIRS.length)];
          }
          windDir = newDir;
          windShiftTimer = 0;
          windShiftWarning = false;
          windShiftFlash = 1.0;
          const def = LEVELS[level];
          nextWindShiftTime = rngFloat(def.windShiftInterval[0], def.windShiftInterval[1]);
          SoundEngine.play('waveStart');
        }
      }

      // Wind shift flash decay
      if (windShiftFlash > 0) {
        windShiftFlash -= dt * 2;
        if (windShiftFlash < 0) windShiftFlash = 0;
      }

      // ── Fire simulation ──
      let anyActive = false;
      let newBurned = 0;
      const igniteTickedThisFrame: Record<number, boolean> = {};

      // First pass: update existing fire states
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (fireState[y][x] === IGNITING) {
            anyActive = true;
            ignitionTimer[y][x] -= dt;
            igniteProgress[y][x] += dt * 2;
            if (igniteProgress[y][x] > 1) igniteProgress[y][x] = 1;

            if (ignitionTimer[y][x] <= 0) {
              fireState[y][x] = BURNING;
              burnTimer[y][x] = BURN_DURATION[terrain[y][x]] || 1.5;
            }
          } else if (fireState[y][x] === BURNING) {
            anyActive = true;
            burnTimer[y][x] -= dt;

            // Spawn fire particles (every frame for intense fire)
            spawnFireParticle(x, y);
            // Spawn smoke (every 2 frames)
            if (frameCount % 2 === 0) {
              spawnSmokeParticle(x, y);
            }
            // Spawn embers (every 4 frames)
            if (frameCount % 4 === 0 && Math.random() < 0.6) {
              spawnEmberParticle(x, y);
            }

            if (burnTimer[y][x] <= 0) {
              fireState[y][x] = BURNED;
              newBurned++;
            }
          }
        }
      }

      // Second pass: fire spread from burning tiles
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (fireState[y][x] === BURNING) {
            // Try to spread to 4 neighbors
            const neighbors = [[0, -1], [0, 1], [-1, 0], [1, 0]];
            for (const [dx, dy] of neighbors) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
              // Steam sizzle at water boundaries
              if (terrain[ny][nx] === WATER) {
                if (Math.random() < 0.08) {
                  spawnSteamParticle(nx, ny);
                }
                continue;
              }
              if (fireState[ny][nx] !== UNBURNED) continue;
              if (!isFlammable(terrain[ny][nx])) continue;

              // Calculate ignition countdown
              const baseTime = IGNITION_TIME[terrain[ny][nx]] || 0.5;
              const windMult = getWindMultiplier(x, y, nx, ny);
              const adjustedTime = baseTime / windMult;

              // Initialize timer if not started (only the first burning neighbor sets it)
              if (ignitionTimer[ny][nx] === 0) {
                ignitionTimer[ny][nx] = adjustedTime;
              }

              // Count down once per frame, not once per neighbor
              // Use a flag to avoid double-decrementing from multiple burning neighbors
              if (!igniteTickedThisFrame[ny * COLS + nx]) {
                igniteTickedThisFrame[ny * COLS + nx] = true;
                // Use the fastest spread rate from any neighbor
                const currentTimer = ignitionTimer[ny][nx];
                ignitionTimer[ny][nx] = Math.max(0, currentTimer - dt * windMult);
                const totalTime = baseTime;
                igniteProgress[ny][nx] = 1 - (ignitionTimer[ny][nx] / totalTime);
                if (igniteProgress[ny][nx] > 1) igniteProgress[ny][nx] = 1;
                if (igniteProgress[ny][nx] < 0) igniteProgress[ny][nx] = 0;
              }

              if (ignitionTimer[ny][nx] <= 0) {
                fireState[ny][nx] = IGNITING;
                ignitionTimer[ny][nx] = 0.15; // brief ignition flash
                igniteProgress[ny][nx] = 0.8;
                burnTimer[ny][nx] = BURN_DURATION[terrain[ny][nx]] || 1.5;
                anyActive = true;

                // Sound for spread (throttled)
                const now = performance.now();
                if (now - lastSpreadSound > 150) {
                  SoundEngine.play('collectGem');
                  lastSpreadSound = now;
                }
              }
            }
          }
        }
      }

      burnedCount += newBurned;
      updateBurnPercent();

      // Manage fire sound
      if (anyActive && !fireSoundPlaying) {
        SoundEngine.startLoop('beamFire');
        fireSoundPlaying = true;
      } else if (!anyActive && fireSoundPlaying) {
        SoundEngine.stopLoop('beamFire');
        fireSoundPlaying = false;
      }

      // Check if fire died out naturally
      fireActive = anyActive;
      if (!fireActive && burnedCount > 0 && state === 'playing') {
        // Check if there's any tile with a pending ignition timer
        let pendingIgnition = false;
        for (let y = 0; y < ROWS && !pendingIgnition; y++) {
          for (let x = 0; x < COLS && !pendingIgnition; x++) {
            if (fireState[y][x] === UNBURNED && ignitionTimer[y][x] > 0) {
              pendingIgnition = true;
            }
          }
        }
        if (!pendingIgnition) {
          // Fire died out — wait briefly then evaluate
          state = 'waiting';
          resultTimer = 0;
        }
      }

      // ── Update particles ──
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Gravity for embers
        if (p.type === 'ember') {
          p.vy += 50 * dt;
        }
        // Fade and shrink
        p.size *= (1 - dt * 0.5);
      }

      // ── Update click flashes ──
      for (let i = clickFlashes.length - 1; i >= 0; i--) {
        clickFlashes[i].life -= dt;
        if (clickFlashes[i].life <= 0) {
          clickFlashes.splice(i, 1);
        }
      }
    }

    // ── Update waiting state ──────────────────────────────────────────────
    function updateWaiting(dt: number) {
      resultTimer += dt;
      if (resultTimer > 1.0) {
        evaluateResult();
      }
      // Still update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.type === 'ember') p.vy += 50 * dt;
        p.size *= (1 - dt * 0.5);
      }
    }

    // ── Draw Tile ─────────────────────────────────────────────────────────
    function drawTile(x: number, y: number) {
      const px = x * TILE;
      const py = y * TILE;
      const fs = fireState[y][x];
      const time = frameCount * 0.05;

      // Draw base terrain
      if (fs === BURNED) {
        // Charcoal
        const variation = hash2d(x * 17, y * 31) * 0.3;
        ctx.fillStyle = variation > 0.15 ? COLORS.burned : COLORS.burnedLight;
        ctx.fillRect(px, py, TILE, TILE);
        // Ash texture
        if (hash2d(x * 53, y * 67) > 0.6) {
          ctx.fillStyle = 'rgba(120, 113, 108, 0.15)';
          ctx.fillRect(px + 2, py + 2, 3, 3);
        }
        return;
      }

      if (fs === BURNING || fs === IGNITING) {
        // Draw terrain underneath slightly
        drawBaseTerrain(x, y, px, py, 0.3);
        // Fire overlay
        if (fs === IGNITING) {
          const prog = igniteProgress[y][x];
          const alpha = 0.3 + prog * 0.5;
          ctx.fillStyle = `rgba(251, 146, 60, ${alpha})`;
          ctx.fillRect(px, py, TILE, TILE);
          // Glow
          if (prog > 0.5) {
            const glowSize = TILE * prog * 0.5;
            const grd = ctx.createRadialGradient(
              px + TILE / 2, py + TILE / 2, 0,
              px + TILE / 2, py + TILE / 2, TILE + glowSize
            );
            grd.addColorStop(0, `rgba(249, 115, 22, ${alpha * 0.4})`);
            grd.addColorStop(1, 'rgba(249, 115, 22, 0)');
            ctx.fillStyle = grd;
            ctx.fillRect(px - glowSize, py - glowSize, TILE + glowSize * 2, TILE + glowSize * 2);
          }
        } else {
          // Burning animation — flickering colors
          const flicker = Math.sin(time * 3 + x * 2.1 + y * 3.7);
          const flicker2 = Math.sin(time * 5 + x * 1.3 + y * 2.1);
          let fireColor: string;
          if (flicker > 0.3) fireColor = COLORS.fire1;
          else if (flicker > -0.3) fireColor = COLORS.fire3;
          else fireColor = COLORS.fire2;

          ctx.fillStyle = fireColor;
          ctx.fillRect(px, py, TILE, TILE);

          // Inner flame detail — offset by wind direction for sway
          const windSwayX = WIND_DX[windDir] * (windStrength === 'strong' ? 3 : windStrength === 'breezy' ? 2 : 0);
          const windSwayY = WIND_DY[windDir] * (windStrength === 'strong' ? 3 : windStrength === 'breezy' ? 2 : 0);
          const innerX = px + 3 + flicker2 * 2 + windSwayX;
          const innerY = py + 3 + flicker * 2 + windSwayY;
          ctx.fillStyle = COLORS.fire3;
          ctx.fillRect(innerX, innerY, TILE - 6, TILE - 6);

          // Bright center — also sways with wind
          ctx.fillStyle = `rgba(255, 255, 200, ${0.3 + flicker2 * 0.2})`;
          ctx.fillRect(px + 6 + windSwayX * 0.5, py + 6 + windSwayY * 0.5, TILE - 12, TILE - 12);

          // Glow around burning tile
          const grd = ctx.createRadialGradient(
            px + TILE / 2, py + TILE / 2, TILE * 0.3,
            px + TILE / 2, py + TILE / 2, TILE * 1.2
          );
          grd.addColorStop(0, `rgba(249, 115, 22, 0.25)`);
          grd.addColorStop(1, 'rgba(249, 115, 22, 0)');
          ctx.fillStyle = grd;
          ctx.fillRect(px - TILE * 0.3, py - TILE * 0.3, TILE * 1.6, TILE * 1.6);
        }
        return;
      }

      // Pre-ignition glow (neighboring fire warming it up)
      if (fs === UNBURNED && ignitionTimer[y][x] > 0 && igniteProgress[y][x] > 0) {
        drawBaseTerrain(x, y, px, py, 1.0);
        const prog = igniteProgress[y][x];
        ctx.fillStyle = `rgba(251, 146, 60, ${prog * 0.4})`;
        ctx.fillRect(px, py, TILE, TILE);
        return;
      }

      // Normal terrain
      drawBaseTerrain(x, y, px, py, 1.0);
    }

    function drawBaseTerrain(x: number, y: number, px: number, py: number, alpha: number) {
      const t = terrain[y][x];
      const time = frameCount * 0.03;
      ctx.globalAlpha = alpha;

      switch (t) {
        case GRASS: {
          // Subtle variation
          const v = hash2d(x * 13, y * 7);
          ctx.fillStyle = v > 0.5 ? COLORS.grass : COLORS.grassAlt;
          ctx.fillRect(px, py, TILE, TILE);
          // Grass texture dots
          if (v > 0.7) {
            ctx.fillStyle = 'rgba(74, 222, 128, 0.3)';
            ctx.fillRect(px + 3, py + 8, 2, 4);
            ctx.fillRect(px + 12, py + 5, 2, 5);
          }
          break;
        }
        case TREE: {
          // Ground
          ctx.fillStyle = COLORS.tree;
          ctx.fillRect(px, py, TILE, TILE);
          // Trunk
          ctx.fillStyle = COLORS.treeTrunk;
          ctx.fillRect(px + 8, py + 12, 4, 8);
          // Canopy triangle
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.moveTo(px + 10, py + 2);
          ctx.lineTo(px + 3, py + 13);
          ctx.lineTo(px + 17, py + 13);
          ctx.closePath();
          ctx.fill();
          // Highlight
          ctx.fillStyle = 'rgba(34, 197, 94, 0.4)';
          ctx.beginPath();
          ctx.moveTo(px + 10, py + 4);
          ctx.lineTo(px + 6, py + 10);
          ctx.lineTo(px + 12, py + 10);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case BUSH: {
          ctx.fillStyle = COLORS.bush;
          ctx.fillRect(px, py, TILE, TILE);
          // Bush shape (rounded rectangle)
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(px + 10, py + 12, 7, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(px + 10, py + 10, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case WATER: {
          ctx.fillStyle = COLORS.water;
          ctx.fillRect(px, py, TILE, TILE);
          // Animated wave
          const wavePhase = time + x * 0.5 + y * 0.3;
          const waveX = px + 4 + Math.sin(wavePhase) * 3;
          const waveY = py + 6 + Math.cos(wavePhase * 0.7) * 2;
          ctx.fillStyle = COLORS.waterLight;
          ctx.fillRect(waveX, waveY, 6, 2);
          const wave2X = px + 10 + Math.sin(wavePhase + 2) * 3;
          const wave2Y = py + 13 + Math.cos(wavePhase * 0.8 + 1) * 2;
          ctx.fillStyle = 'rgba(96, 165, 250, 0.6)';
          ctx.fillRect(wave2X, wave2Y, 5, 1);
          break;
        }
        case STONE: {
          const sv = hash2d(x * 23, y * 41);
          ctx.fillStyle = sv > 0.5 ? COLORS.stone : COLORS.stoneLight;
          ctx.fillRect(px, py, TILE, TILE);
          // Stone texture
          ctx.fillStyle = 'rgba(156, 163, 175, 0.3)';
          ctx.fillRect(px + 2, py + 3, 5, 4);
          ctx.fillRect(px + 10, py + 10, 6, 5);
          // Crack
          ctx.strokeStyle = 'rgba(75, 85, 99, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(px + 4, py + 12);
          ctx.lineTo(px + 14, py + 8);
          ctx.stroke();
          break;
        }
        case DIRT: {
          const dv = hash2d(x * 37, y * 53);
          ctx.fillStyle = dv > 0.5 ? COLORS.dirt : COLORS.dirtLight;
          ctx.fillRect(px, py, TILE, TILE);
          // Dirt specks
          ctx.fillStyle = 'rgba(120, 53, 15, 0.3)';
          if (dv > 0.3) ctx.fillRect(px + 5, py + 3, 2, 2);
          if (dv > 0.5) ctx.fillRect(px + 13, py + 11, 3, 2);
          if (dv > 0.7) ctx.fillRect(px + 8, py + 15, 2, 3);
          break;
        }
        case BUILDING: {
          ctx.fillStyle = COLORS.building;
          ctx.fillRect(px, py, TILE, TILE);
          // Darker outline
          ctx.strokeStyle = COLORS.buildingDark;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          // Window detail
          const wv = hash2d(x * 61, y * 79);
          if (wv > 0.5) {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.4)';
            ctx.fillRect(px + 5, py + 5, 4, 4);
            ctx.fillRect(px + 11, py + 5, 4, 4);
          }
          break;
        }
      }

      ctx.globalAlpha = 1.0;
    }

    // ── Draw Particles ────────────────────────────────────────────────────
    function drawParticles() {
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;

        if (p.type === 'steam') {
          ctx.globalAlpha = alpha * 0.6;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 + (1 - alpha) * 0.5), 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'smoke') {
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'ember') {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        } else {
          // Fire particle
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1.0;
    }

    // ── Draw Wind Indicator ───────────────────────────────────────────────
    function drawWindIndicator() {
      const centerX = W - 55;
      const centerY = H - 55;
      const radius = 30;

      // Background circle
      ctx.fillStyle = COLORS.hudBg;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Wind shift flash
      if (windShiftFlash > 0) {
        ctx.fillStyle = `rgba(249, 115, 22, ${windShiftFlash * 0.3})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Compass circle
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Direction labels
      ctx.fillStyle = COLORS.hudDim;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', centerX, centerY - radius - 3);
      ctx.fillText('S', centerX, centerY + radius + 5);
      ctx.fillText('E', centerX + radius + 5, centerY);
      ctx.fillText('W', centerX - radius - 5, centerY);

      // Wind arrow
      const dirAngle = {
        N: -Math.PI / 2,
        NE: -Math.PI / 4,
        E: 0,
        SE: Math.PI / 4,
        S: Math.PI / 2,
        SW: (3 * Math.PI) / 4,
        W: Math.PI,
        NW: -(3 * Math.PI) / 4,
      };

      const angle = dirAngle[windDir];
      const strengthLen = windStrength === 'strong' ? radius * 0.85 : windStrength === 'breezy' ? radius * 0.65 : radius * 0.4;

      // Animated arrow pulse
      const pulse = 1 + Math.sin(frameCount * 0.1) * 0.05;
      const len = strengthLen * pulse;

      const endX = centerX + Math.cos(angle) * len;
      const endY = centerY + Math.sin(angle) * len;

      // Arrow shaft
      ctx.strokeStyle = windStrength === 'strong' ? COLORS.fire1 : windStrength === 'breezy' ? COLORS.fire4 : COLORS.hudDim;
      ctx.lineWidth = windStrength === 'strong' ? 3 : 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Arrowhead
      const headLen = 8;
      const headAngle = Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(angle - headAngle),
        endY - headLen * Math.sin(angle - headAngle)
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLen * Math.cos(angle + headAngle),
        endY - headLen * Math.sin(angle + headAngle)
      );
      ctx.stroke();

      // Center dot
      ctx.fillStyle = COLORS.hud;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Strength label
      ctx.font = '9px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.textAlign = 'center';
      ctx.fillText(windStrength.toUpperCase(), centerX, centerY + radius + 16);

      // Wind direction label
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = COLORS.hud;
      ctx.fillText(windDir, centerX, centerY + radius + 27);

      // Wind shift countdown timer
      const timeUntilShift = Math.max(0, nextWindShiftTime - windShiftTimer);
      if (timeUntilShift < 999) {
        const countdownSec = Math.ceil(timeUntilShift);
        const urgency = timeUntilShift < 3;
        ctx.font = '10px monospace';
        ctx.fillStyle = urgency ? COLORS.fire1 : COLORS.hudDim;
        ctx.globalAlpha = urgency ? 0.6 + Math.sin(frameCount * 0.2) * 0.4 : 0.5;
        ctx.fillText(`~${countdownSec}s`, centerX, centerY - radius - 14);
        ctx.globalAlpha = 1.0;
      }
    }

    // ── Draw HUD ──────────────────────────────────────────────────────────
    function drawHUD() {
      const def = LEVELS[level];

      // Top bar background
      ctx.fillStyle = COLORS.hudBg;
      ctx.fillRect(0, 0, W, 40);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.lineTo(W, 40);
      ctx.stroke();

      // Level name
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = COLORS.primary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LV ${level + 1}: ${def.name}`, 10, 14);

      // Target range
      ctx.font = '11px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(`Target: ${def.targetMin}-${def.targetMax}%`, 10, 30);

      // Current burn percentage
      const pctColor = currentBurnPercent >= def.targetMin && currentBurnPercent <= def.targetMax
        ? COLORS.targetGreen
        : currentBurnPercent > def.targetMax
          ? COLORS.targetRed
          : COLORS.targetYellow;

      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = pctColor;
      ctx.textAlign = 'center';
      ctx.fillText(`${currentBurnPercent.toFixed(1)}%`, W / 2, 14);

      ctx.font = '10px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText('BURNED', W / 2, 30);

      // Progress bar
      const barX = W / 2 - 120;
      const barY = 34;
      const barW = 240;
      const barH = 4;

      // Bar background
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(barX, barY, barW, barH);

      // Target range highlight
      const rangeStartX = barX + (def.targetMin / 100) * barW;
      const rangeEndX = barX + (def.targetMax / 100) * barW;
      ctx.fillStyle = 'rgba(34, 197, 94, 0.25)';
      ctx.fillRect(rangeStartX, barY, rangeEndX - rangeStartX, barH);

      // Target range borders
      ctx.fillStyle = COLORS.targetGreen;
      ctx.fillRect(rangeStartX, barY - 1, 1, barH + 2);
      ctx.fillRect(rangeEndX, barY - 1, 1, barH + 2);

      // Current percentage marker
      const markerX = barX + Math.min(currentBurnPercent / 100, 1) * barW;
      ctx.fillStyle = pctColor;
      ctx.fillRect(markerX - 1, barY - 2, 3, barH + 4);

      // Filled bar
      ctx.fillStyle = pctColor;
      ctx.globalAlpha = 0.5;
      ctx.fillRect(barX, barY, Math.min(currentBurnPercent / 100, 1) * barW, barH);
      ctx.globalAlpha = 1.0;

      // Ignition points (match icons)
      const matchX = W - 140;
      ctx.font = '11px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.textAlign = 'right';
      ctx.fillText('MATCHES:', matchX - 5, 14);

      for (let i = 0; i < def.ignitionPoints; i++) {
        const mx = matchX + i * 18;
        const used = i >= ignitionPointsLeft;

        if (used) {
          // Used match - gray
          ctx.fillStyle = 'rgba(107, 114, 128, 0.4)';
          ctx.fillRect(mx + 2, 6, 3, 12);
        } else {
          // Unused match
          // Stick
          ctx.fillStyle = '#92400e';
          ctx.fillRect(mx + 3, 10, 2, 10);
          // Head
          ctx.fillStyle = COLORS.fire2;
          ctx.beginPath();
          ctx.arc(mx + 4, 8, 4, 0, Math.PI * 2);
          ctx.fill();
          // Glow
          ctx.fillStyle = `rgba(249, 115, 22, ${0.3 + Math.sin(frameCount * 0.1 + i) * 0.15})`;
          ctx.beginPath();
          ctx.arc(mx + 4, 8, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Score
      ctx.font = '11px monospace';
      ctx.fillStyle = COLORS.hud;
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${totalScore}`, W - 10, 30);

      // Wind indicator
      if (LEVELS[level].windEnabled) {
        drawWindIndicator();
      }

      // Wind shift warning
      if (windShiftWarning && windWarningTimer > 0) {
        const warningAlpha = 0.5 + Math.sin(frameCount * 0.3) * 0.5;
        ctx.globalAlpha = warningAlpha;
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = COLORS.fire1;
        ctx.textAlign = 'center';
        ctx.fillText('WIND SHIFT!', W / 2, 55);
        ctx.globalAlpha = 1.0;
      }

      // Pause indicator
      if (paused) {
        ctx.fillStyle = 'rgba(10, 10, 15, 0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 36px monospace';
        ctx.fillStyle = COLORS.hud;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', W / 2, H / 2 - 20);
        ctx.font = '14px monospace';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText('Press P to resume', W / 2, H / 2 + 20);
      }

      // Stop hint
      if (fireActive && state === 'playing') {
        ctx.font = '10px monospace';
        ctx.fillStyle = COLORS.hudDim;
        ctx.textAlign = 'left';
        ctx.fillText('[Enter] Extinguish & evaluate   [R] Restart   [P] Pause', 10, H - 8);
      } else if (state === 'playing' && burnedCount === 0) {
        ctx.font = '10px monospace';
        ctx.fillStyle = COLORS.hudDim;
        ctx.textAlign = 'left';
        ctx.fillText('Click to place ignition points   [R] Restart', 10, H - 8);
      }
    }

    // ── Draw Menu ─────────────────────────────────────────────────────────
    function drawMenu() {
      menuTime += 0.016;

      // Background
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      // Animated fire background tiles
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const n = valueNoise(x + menuTime * 2, y + menuTime * 0.5, 5);
          const n2 = valueNoise(x * 2 + menuTime * 3, y * 2 + menuTime, 3);
          if (n > 0.65) {
            const flicker = Math.sin(menuTime * 5 + x * 0.7 + y * 1.1);
            const alpha = (n - 0.65) * 2.5 * (0.2 + flicker * 0.1);
            ctx.fillStyle = n2 > 0.5
              ? `rgba(249, 115, 22, ${alpha})`
              : `rgba(239, 68, 68, ${alpha * 0.7})`;
            ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          } else if (n > 0.4) {
            const alpha = (n - 0.4) * 0.15;
            ctx.fillStyle = `rgba(74, 222, 128, ${alpha})`;
            ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          }
        }
      }

      // Darken overlay
      ctx.fillStyle = 'rgba(10, 10, 15, 0.55)';
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.font = 'bold 72px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Fire-colored gradient title
      const titleY = H / 2 - 80;
      const grad = ctx.createLinearGradient(W / 2 - 100, titleY - 30, W / 2 + 100, titleY + 30);
      grad.addColorStop(0, COLORS.fire3);
      grad.addColorStop(0.4, COLORS.fire1);
      grad.addColorStop(0.7, COLORS.fire2);
      grad.addColorStop(1, COLORS.fire3);
      ctx.fillStyle = grad;
      ctx.fillText('BURN', W / 2, titleY);

      // Title glow
      ctx.shadowColor = COLORS.fire1;
      ctx.shadowBlur = 20;
      ctx.fillText('BURN', W / 2, titleY);
      ctx.shadowBlur = 0;

      // Tagline
      ctx.font = '14px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText('Control the chaos. Hit the target.', W / 2, titleY + 50);

      // High score
      ctx.font = '13px monospace';
      ctx.fillStyle = COLORS.primary;
      ctx.fillText(`High Score: ${highScore}`, W / 2, titleY + 80);

      // Controls
      ctx.font = '11px monospace';
      ctx.fillStyle = COLORS.hudDim;
      const controlsY = titleY + 120;
      ctx.fillText('Click to place ignition points on the map', W / 2, controlsY);
      ctx.fillText('Enter/Space to extinguish & evaluate', W / 2, controlsY + 20);
      ctx.fillText('Burn EXACTLY the target percentage to win', W / 2, controlsY + 40);
      ctx.fillText('R to restart | P to pause', W / 2, controlsY + 60);

      // Start prompt
      const startAlpha = 0.5 + Math.sin(menuTime * 3) * 0.5;
      ctx.globalAlpha = startAlpha;
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = COLORS.primary;
      ctx.fillText('Press Enter or Click to Start', W / 2, H - 60);
      ctx.globalAlpha = 1.0;
    }

    // ── Draw Level Complete ───────────────────────────────────────────────
    function drawLevelComplete() {
      resultTimer += deltaTime;

      // Draw map underneath
      drawMap();
      drawParticles();

      // Overlay
      ctx.fillStyle = 'rgba(10, 10, 15, 0.7)';
      ctx.fillRect(0, 0, W, H);

      const def = LEVELS[level];
      const midTarget = (def.targetMin + def.targetMax) / 2;
      const rangeHalf = (def.targetMax - def.targetMin) / 2;
      const distFromCenter = Math.abs(currentBurnPercent - midTarget);
      const accuracyPct = Math.max(0, Math.round((1 - distFromCenter / rangeHalf) * 100));
      const isBullseye = distFromCenter <= (def.targetMax - def.targetMin) * 0.01 + 0.5; // within 1% of center

      // Title
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = COLORS.targetGreen;
      ctx.fillText('LEVEL COMPLETE', W / 2, H / 2 - 120);

      // Breakdown: Target range
      ctx.font = '13px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText('TARGET RANGE', W / 2, H / 2 - 82);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = COLORS.hud;
      ctx.fillText(`${def.targetMin}-${def.targetMax}%`, W / 2, H / 2 - 62);

      // Breakdown: Your result
      ctx.font = '13px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText('YOUR RESULT', W / 2, H / 2 - 38);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = COLORS.targetGreen;
      ctx.fillText(`${currentBurnPercent.toFixed(1)}%`, W / 2, H / 2 - 18);

      // Breakdown: Accuracy score
      ctx.font = '13px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText('ACCURACY', W / 2, H / 2 + 6);
      ctx.font = 'bold 18px monospace';
      ctx.fillStyle = accuracyPct >= 90 ? COLORS.fire3 : accuracyPct >= 60 ? COLORS.primary : COLORS.hud;
      ctx.fillText(`${accuracyPct}%`, W / 2, H / 2 + 26);

      // BULLSEYE or precision label
      if (isBullseye) {
        ctx.font = 'bold 24px monospace';
        ctx.fillStyle = COLORS.fire3;
        ctx.shadowColor = COLORS.fire3;
        ctx.shadowBlur = 15;
        ctx.fillText('BULLSEYE!', W / 2, H / 2 + 56);
        ctx.shadowBlur = 0;
      } else {
        let precisionLabel = '';
        if (distFromCenter < 2) precisionLabel = 'EXCELLENT!';
        else if (distFromCenter < 4) precisionLabel = 'GREAT!';
        else precisionLabel = 'GOOD';
        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = COLORS.primary;
        ctx.fillText(precisionLabel, W / 2, H / 2 + 56);
      }

      // Score
      ctx.font = '16px monospace';
      ctx.fillStyle = COLORS.hud;
      ctx.fillText(`+${score} points`, W / 2, H / 2 + 86);
      ctx.font = '13px monospace';
      ctx.fillStyle = COLORS.hudDim;
      ctx.fillText(`Total: ${totalScore}`, W / 2, H / 2 + 106);

      if (newHighScoreFlag) {
        const hsAlpha = 0.5 + Math.sin(frameCount * 0.15) * 0.5;
        ctx.globalAlpha = hsAlpha;
        ctx.font = 'bold 16px monospace';
        ctx.fillStyle = COLORS.fire3;
        ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 130);
        ctx.globalAlpha = 1.0;
      }

      // Continue prompt
      if (resultTimer > 1.0) {
        const alpha = 0.5 + Math.sin(frameCount * 0.1) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.font = '14px monospace';
        ctx.fillStyle = COLORS.hudDim;
        if (level + 1 < LEVELS.length) {
          ctx.fillText('Press Enter or Click to continue', W / 2, H / 2 + 160);
        } else {
          ctx.fillText('Press Enter or Click for final results', W / 2, H / 2 + 160);
        }
        ctx.globalAlpha = 1.0;
      }
    }

    // ── Draw Game Over ────────────────────────────────────────────────────
    function drawGameOver() {
      resultTimer += deltaTime;

      // Draw map underneath
      drawMap();
      drawParticles();

      // Overlay
      ctx.fillStyle = 'rgba(10, 10, 15, 0.75)';
      ctx.fillRect(0, 0, W, H);

      const def = LEVELS[level];
      const allComplete = level >= LEVELS.length; // won all levels

      if (allComplete) {
        // Victory screen
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.fire3;
        ctx.fillText('ALL LEVELS COMPLETE!', W / 2, H / 2 - 80);

        ctx.font = 'bold 24px monospace';
        ctx.fillStyle = COLORS.hud;
        ctx.fillText(`Final Score: ${totalScore}`, W / 2, H / 2 - 30);

        if (newHighScoreFlag) {
          const hAlpha = 0.5 + Math.sin(frameCount * 0.15) * 0.5;
          ctx.globalAlpha = hAlpha;
          ctx.font = 'bold 18px monospace';
          ctx.fillStyle = COLORS.fire3;
          ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 10);
          ctx.globalAlpha = 1.0;
        }
      } else {
        // Fail screen
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = COLORS.targetRed;
        ctx.fillText('BURN FAILED', W / 2, H / 2 - 110);

        // Breakdown: Target range
        ctx.font = '13px monospace';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText('TARGET RANGE', W / 2, H / 2 - 72);
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = COLORS.hud;
        ctx.fillText(`${def.targetMin}-${def.targetMax}%`, W / 2, H / 2 - 52);

        // Breakdown: Your result
        ctx.font = '13px monospace';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText('YOUR RESULT', W / 2, H / 2 - 28);
        ctx.font = 'bold 18px monospace';
        ctx.fillStyle = COLORS.targetRed;
        ctx.fillText(`${currentBurnPercent.toFixed(1)}%`, W / 2, H / 2 - 8);

        // Off by how much
        const offBy = currentBurnPercent < def.targetMin
          ? (def.targetMin - currentBurnPercent).toFixed(1)
          : (currentBurnPercent - def.targetMax).toFixed(1);
        const offDir = currentBurnPercent < def.targetMin ? 'under' : 'over';
        ctx.font = '14px monospace';
        ctx.fillStyle = COLORS.fire1;
        ctx.fillText(`${offBy}% ${offDir} target`, W / 2, H / 2 + 16);

        // Hint
        if (currentBurnPercent < def.targetMin) {
          ctx.font = '12px monospace';
          ctx.fillStyle = COLORS.hudDim;
          ctx.fillText('Place ignition points more strategically.', W / 2, H / 2 + 38);
        } else {
          ctx.font = '12px monospace';
          ctx.fillStyle = COLORS.hudDim;
          ctx.fillText('Use Enter to stop the fire earlier.', W / 2, H / 2 + 38);
        }

        ctx.font = '16px monospace';
        ctx.fillStyle = COLORS.hud;
        ctx.fillText(`Final Score: ${totalScore}`, W / 2, H / 2 + 64);

        if (newHighScoreFlag) {
          const hAlpha = 0.5 + Math.sin(frameCount * 0.15) * 0.5;
          ctx.globalAlpha = hAlpha;
          ctx.font = 'bold 16px monospace';
          ctx.fillStyle = COLORS.fire3;
          ctx.fillText('NEW HIGH SCORE!', W / 2, H / 2 + 90);
          ctx.globalAlpha = 1.0;
        }
      }

      // Restart prompt
      if (resultTimer > 1.5) {
        const alpha = 0.5 + Math.sin(frameCount * 0.1) * 0.5;
        ctx.globalAlpha = alpha;
        ctx.font = '14px monospace';
        ctx.fillStyle = COLORS.hudDim;
        ctx.fillText('Press Enter or Click to play again', W / 2, H / 2 + 120);
        ctx.globalAlpha = 1.0;
      }
    }

    // ── Draw Map ──────────────────────────────────────────────────────────
    function drawMap() {
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          drawTile(x, y);
        }
      }
    }

    // ── Draw ──────────────────────────────────────────────────────────────
    function draw() {
      // Clear
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, W, H);

      if (state === 'menu') {
        drawMenu();
        return;
      }

      if (state === 'levelComplete') {
        drawLevelComplete();
        return;
      }

      if (state === 'gameover') {
        drawGameOver();
        return;
      }

      // Playing / waiting states
      drawMap();
      drawParticles();

      // Draw click flash effects (invalid placement feedback)
      for (const flash of clickFlashes) {
        const alpha = flash.life / flash.maxLife;
        const radius = TILE * (1 + (1 - alpha) * 0.8);
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillStyle = COLORS.targetRed;
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, radius, 0, Math.PI * 2);
        ctx.fill();
        // Inner bright flash
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(flash.x, flash.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      drawHUD();

      // Waiting overlay
      if (state === 'waiting') {
        ctx.font = '14px monospace';
        ctx.fillStyle = COLORS.primary;
        ctx.textAlign = 'center';
        ctx.fillText('Fire died out... evaluating...', W / 2, H / 2);
      }
    }

    // ── Input ─────────────────────────────────────────────────────────────
    let cachedRect = canvas.getBoundingClientRect();

    function getCanvasPos(clientX: number, clientY: number): [number, number] {
      const scaleX = W / cachedRect.width;
      const scaleY = H / cachedRect.height;
      return [
        (clientX - cachedRect.left) * scaleX,
        (clientY - cachedRect.top) * scaleY,
      ];
    }

    function handleClick(clientX: number, clientY: number) {
      SoundEngine.ensureResumed();

      if (state === 'menu') {
        startLevel(0);
        reportGameStart('burn');
        SoundEngine.startAmbient('underground');
        SoundEngine.play('menuSelect');
        return;
      }

      if (state === 'levelComplete') {
        if (resultTimer < 1.0) return;
        if (level + 1 < LEVELS.length) {
          startLevel(level + 1);
          SoundEngine.play('menuSelect');
        } else {
          // All levels done
          reportGameEnd('burn', totalScore, true);
          if (totalScore > highScore) {
            highScore = totalScore;
            setHighScore('burn', totalScore);
          }
          state = 'gameover';
          resultTimer = 0;
        }
        return;
      }

      if (state === 'gameover') {
        if (resultTimer < 1.5) return;
        state = 'menu';
        totalScore = 0;
        level = 0;
        SoundEngine.stopAmbient();
        SoundEngine.play('menuBack');
        return;
      }

      if (state === 'playing' && !paused) {
        const [mx, my] = getCanvasPos(clientX, clientY);
        const col = Math.floor(mx / TILE);
        const row = Math.floor(my / TILE);

        if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
          if (igniteTile(col, row)) {
            // Success - handled in igniteTile
          } else {
            // Invalid click — spawn red flash on the tile
            clickFlashes.push({
              x: col * TILE + TILE / 2,
              y: row * TILE + TILE / 2,
              life: 0.35,
              maxLife: 0.35,
            });
            if (!isFlammable(terrain[row][col])) {
              // Clicked a firebreak
              SoundEngine.play('wrongGuess');
            } else if (fireState[row][col] !== UNBURNED) {
              // Already burning or burned
              SoundEngine.play('wrongGuess');
            } else if (ignitionPointsLeft <= 0) {
              // No matches left
              SoundEngine.play('wrongGuess');
            }
          }
        }
      }
    }

    function handleMouseDown(e: MouseEvent) {
      e.preventDefault();
      handleClick(e.clientX, e.clientY);
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleClick(e.touches[0].clientX, e.touches[0].clientY);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      SoundEngine.ensureResumed();

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();

        if (state === 'menu') {
          startLevel(0);
          reportGameStart('burn');
          SoundEngine.startAmbient('underground');
          SoundEngine.play('menuSelect');
          return;
        }

        if (state === 'playing' && !paused) {
          if (fireActive) {
            // Stop / extinguish all fire
            extinguishAll();
            SoundEngine.play('lockIn');
          }
          return;
        }

        if (state === 'levelComplete') {
          if (resultTimer < 1.0) return;
          if (level + 1 < LEVELS.length) {
            startLevel(level + 1);
            SoundEngine.play('menuSelect');
          } else {
            reportGameEnd('burn', totalScore, true);
            if (totalScore > highScore) {
              highScore = totalScore;
              setHighScore('burn', totalScore);
            }
            state = 'gameover';
            resultTimer = 0;
          }
          return;
        }

        if (state === 'gameover') {
          if (resultTimer < 1.5) return;
          state = 'menu';
          totalScore = 0;
          level = 0;
          SoundEngine.stopAmbient();
          SoundEngine.play('menuBack');
          return;
        }
      }

      if (e.key === 'r' || e.key === 'R') {
        if (state === 'playing') {
          if (fireSoundPlaying) {
            SoundEngine.stopLoop('beamFire');
            fireSoundPlaying = false;
          }
          startLevel(level);
          SoundEngine.play('menuBack');
        }
      }

      if (e.key === 'p' || e.key === 'P') {
        if (state === 'playing') {
          paused = !paused;
          SoundEngine.play('click');
        }
      }
    }

    function handleResize() {
      cachedRect = canvas!.getBoundingClientRect();
    }

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    // ── Game Loop ─────────────────────────────────────────────────────────
    let running = true;

    function gameLoop(timestamp: number) {
      if (!running) return;

      if (lastTime === 0) lastTime = timestamp;
      deltaTime = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      frameCount++;

      if (state === 'playing') {
        update(deltaTime);
      } else if (state === 'waiting') {
        updateWaiting(deltaTime);
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
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
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
