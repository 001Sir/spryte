'use client';

import { useRef, useEffect } from 'react';
import { SoundEngine } from '@/lib/sounds';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const COLS = 40;
const ROWS = 30;
const CELL = W / COLS; // 20px
const LIME = '#84cc16';
const LIME_DARK = '#65a30d';
const _LIME_DARKER = '#4d7c0f';

// ─── Cell types ───────────────────────────────────────────────────────────────
const EMPTY = 0;
const GRASS = 1;
const SOIL = 2;
const ROCK = 3;
const GEM = 4;
const WATER = 5;
const LAVA = 6;
const BEDROCK = 7;
const SURFACE = 8; // sky / air above ground

type _CellType = typeof EMPTY | typeof GRASS | typeof SOIL | typeof ROCK |
  typeof GEM | typeof SOIL | typeof WATER | typeof LAVA | typeof BEDROCK | typeof SURFACE;

// ─── Direction helpers ────────────────────────────────────────────────────────
const DIR = { UP: 0, DOWN: 1, LEFT: 2, RIGHT: 3 } as const;
type Dir = typeof DIR[keyof typeof DIR];
const DX = [0, 0, -1, 1];
const DY = [-1, 1, 0, 0];

// ─── Level definitions ───────────────────────────────────────────────────────
interface LevelDef {
  name: string;
  skyRows: number;       // rows of air above ground
  grassRows: number;
  soilRows: number;
  rockRows: number;
  gemCount: number;
  waterPockets: number;
  lavaPockets: number;
  treasureTarget: number;
}

const LEVELS: LevelDef[] = [
  { name: 'Shallow Grounds', skyRows: 4, grassRows: 2, soilRows: 14, rockRows: 8, gemCount: 8, waterPockets: 2, lavaPockets: 0, treasureTarget: 5 },
  { name: 'Deep Soil', skyRows: 3, grassRows: 2, soilRows: 12, rockRows: 11, gemCount: 12, waterPockets: 3, lavaPockets: 1, treasureTarget: 8 },
  { name: 'Rocky Depths', skyRows: 3, grassRows: 1, soilRows: 8, rockRows: 16, gemCount: 15, waterPockets: 4, lavaPockets: 2, treasureTarget: 12 },
  { name: 'Lava Fields', skyRows: 2, grassRows: 1, soilRows: 6, rockRows: 19, gemCount: 20, waterPockets: 3, lavaPockets: 5, treasureTarget: 16 },
  { name: 'The Core', skyRows: 2, grassRows: 1, soilRows: 4, rockRows: 21, gemCount: 25, waterPockets: 5, lavaPockets: 8, treasureTarget: 20 },
];

// ─── Particle ─────────────────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TerravoreGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Game state ──────────────────────────────────────────────────────────
    type GameState = 'Menu' | 'Playing' | 'GameOver' | 'LevelComplete';
    let state: GameState = 'Menu';

    // grid
    let grid: number[][] = [];
    let rockHealth: number[][] = []; // for rock cells that need 2 hits

    // creature
    let cx = 0, cy = 0;       // grid position
    let px = 0, py = 0;       // pixel position (for smooth animation)
    let tx = 0, ty = 0;       // target pixel position
    let facing: Dir = DIR.DOWN;
    let health = 100;
    const maxHealth = 100;
    let score = 0;
    let totalScore = 0;
    let gemsCollected = 0;
    let gemsTarget = 0;
    let deepestRow = 0;
    let blocksEaten = 0;
    let creatureSize = 1.0;
    let level = 0;
    let levelTransitionTimer = 0;
    let moveAnimProgress = 1; // 1 = arrived
    let moveCooldown = 0;

    // pause
    let paused = false;

    // dig animation
    let digging = false;
    let digTimer = 0;
    const DIG_DURATION = 8;

    // particles
    let particles: Particle[] = [];

    // water / lava flow timers
    let waterFlowTimer = 0;
    let lavaFlowTimer = 0;
    const WATER_FLOW_RATE = 3; // frames between water updates
    const LAVA_FLOW_RATE = 8;

    // gravity timer
    let gravityTimer = 0;
    const GRAVITY_RATE = 4;

    // damage cooldown
    let damageCooldown = 0;

    // animation counters
    let frameCount = 0;
    let wobble = 0;

    // menu terrain art animation
    let menuTime = 0;

    // keys
    const keys: Record<string, boolean> = {};

    // ── Helpers ─────────────────────────────────────────────────────────────
    function inBounds(gx: number, gy: number) {
      return gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS;
    }

    function isSolid(type: number) {
      return type === GRASS || type === SOIL || type === ROCK || type === GEM || type === BEDROCK;
    }

    function isDiggable(type: number) {
      return type === GRASS || type === SOIL || type === ROCK || type === GEM;
    }

    function rand(min: number, max: number) {
      return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randFloat(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    // ── Level Generation ────────────────────────────────────────────────────
    function generateLevel(lvl: number) {
      const def = LEVELS[lvl];
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
      rockHealth = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

      // Fill layers
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          if (y < def.skyRows) {
            grid[y][x] = SURFACE;
          } else if (y < def.skyRows + def.grassRows) {
            grid[y][x] = GRASS;
          } else if (y < def.skyRows + def.grassRows + def.soilRows) {
            grid[y][x] = SOIL;
          } else if (y < def.skyRows + def.grassRows + def.soilRows + def.rockRows) {
            grid[y][x] = ROCK;
            rockHealth[y][x] = 2;
          } else {
            grid[y][x] = BEDROCK;
          }
        }
      }

      // Place gems in soil and rock
      let gemsPlaced = 0;
      let attempts = 0;
      while (gemsPlaced < def.gemCount && attempts < 1000) {
        const gx = rand(1, COLS - 2);
        const gy = rand(def.skyRows + def.grassRows + 2, ROWS - 2);
        if (grid[gy][gx] === SOIL || grid[gy][gx] === ROCK) {
          grid[gy][gx] = GEM;
          gemsPlaced++;
        }
        attempts++;
      }

      // Place water pockets (clusters of 2-4 cells)
      for (let i = 0; i < def.waterPockets; i++) {
        const wx = rand(2, COLS - 3);
        const wy = rand(def.skyRows + def.grassRows + 3, ROWS - 4);
        const size = rand(2, 4);
        for (let j = 0; j < size; j++) {
          const ox = rand(-1, 1);
          const oy = rand(-1, 1);
          if (inBounds(wx + ox, wy + oy) && (grid[wy + oy][wx + ox] === SOIL || grid[wy + oy][wx + ox] === ROCK)) {
            grid[wy + oy][wx + ox] = WATER;
          }
        }
      }

      // Place lava pockets (deep, clusters of 2-5 cells)
      const lavaStartRow = def.skyRows + def.grassRows + def.soilRows + Math.floor(def.rockRows * 0.4);
      for (let i = 0; i < def.lavaPockets; i++) {
        const lx = rand(2, COLS - 3);
        const ly = rand(lavaStartRow, ROWS - 3);
        const size = rand(2, 5);
        for (let j = 0; j < size; j++) {
          const ox = rand(-1, 1);
          const oy = rand(-1, 1);
          if (inBounds(lx + ox, ly + oy) && grid[ly + oy][lx + ox] === ROCK) {
            grid[ly + oy][lx + ox] = LAVA;
          }
        }
      }

      // Create a starting tunnel (clear a spot at top for creature)
      const startX = Math.floor(COLS / 2);
      const startY = def.skyRows; // first grass row
      grid[startY][startX] = EMPTY;

      // Set creature position
      cx = startX;
      cy = startY;
      px = cx * CELL;
      py = cy * CELL;
      tx = px;
      ty = py;
      facing = DIR.DOWN;
      moveAnimProgress = 1;

      health = maxHealth;
      score = 0;
      gemsCollected = 0;
      gemsTarget = def.treasureTarget;
      blocksEaten = 0;
      creatureSize = 1.0;
      deepestRow = 0;
      digging = false;
      digTimer = 0;
      particles = [];
      waterFlowTimer = 0;
      lavaFlowTimer = 0;
      gravityTimer = 0;
      damageCooldown = 0;
      moveCooldown = 0;
    }

    function startGame() {
      level = 0;
      score = 0;
      totalScore = 0;
      paused = false;
      generateLevel(0);
      state = 'Playing';
      SoundEngine.play('menuSelect');
    }

    // ── Spawn particles ─────────────────────────────────────────────────────
    function spawnDigParticles(gx: number, gy: number, cellType: number) {
      let color = '#8B4513';
      if (cellType === GRASS) color = '#4ade80';
      else if (cellType === ROCK) color = '#888';
      else if (cellType === GEM) color = '#fbbf24';

      for (let i = 0; i < 8; i++) {
        particles.push({
          x: gx * CELL + CELL / 2 + randFloat(-5, 5),
          y: gy * CELL + CELL / 2 + randFloat(-5, 5),
          vx: randFloat(-2, 2),
          vy: randFloat(-3, 0.5),
          life: rand(15, 30),
          maxLife: 30,
          color,
          size: randFloat(2, 5),
        });
      }
    }

    function spawnGemParticles(gx: number, gy: number) {
      const colors = ['#fbbf24', '#f59e0b', '#fde68a', '#ffffff'];
      for (let i = 0; i < 15; i++) {
        particles.push({
          x: gx * CELL + CELL / 2,
          y: gy * CELL + CELL / 2,
          vx: randFloat(-3, 3),
          vy: randFloat(-4, 1),
          life: rand(20, 40),
          maxLife: 40,
          color: colors[rand(0, colors.length - 1)],
          size: randFloat(2, 4),
        });
      }
    }

    function spawnDamageParticles() {
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: px + CELL / 2,
          y: py + CELL / 2,
          vx: randFloat(-2, 2),
          vy: randFloat(-2, 2),
          life: rand(10, 20),
          maxLife: 20,
          color: '#ef4444',
          size: randFloat(3, 6),
        });
      }
    }

    // ── Digging ─────────────────────────────────────────────────────────────
    function tryDig() {
      if (digging) return;
      const dx = DX[facing];
      const dy = DY[facing];
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) return;
      const cell = grid[ny][nx];
      if (!isDiggable(cell)) return;

      if (cell === ROCK && rockHealth[ny][nx] > 1) {
        // First hit on rock
        rockHealth[ny][nx]--;
        digging = true;
        digTimer = DIG_DURATION;
        spawnDigParticles(nx, ny, cell);
        SoundEngine.play('dig');
        return;
      }

      // Dig the cell
      digging = true;
      digTimer = DIG_DURATION;
      const wasGem = cell === GEM;
      grid[ny][nx] = EMPTY;
      spawnDigParticles(nx, ny, cell);
      SoundEngine.play('dig');
      blocksEaten++;
      creatureSize = 1.0 + Math.min(blocksEaten * 0.001, 0.3);

      if (wasGem) {
        gemsCollected++;
        const depthBonus = Math.max(1, ny - (LEVELS[level].skyRows));
        const gemScore = 100 + depthBonus * 10;
        score += gemScore;
        spawnGemParticles(nx, ny);
        SoundEngine.play('collectGem');
      } else {
        score += 5;
      }
    }

    // ── Movement ────────────────────────────────────────────────────────────
    function tryMove(dir: Dir) {
      if (moveAnimProgress < 1 || moveCooldown > 0 || digging) return;
      facing = dir;
      const nx = cx + DX[dir];
      const ny = cy + DY[dir];
      if (!inBounds(nx, ny)) return;
      const cell = grid[ny][nx];
      if (isSolid(cell)) return; // can't walk into solid

      // Hazard cells - can walk into them but take damage
      cx = nx;
      cy = ny;
      tx = cx * CELL;
      ty = cy * CELL;
      moveAnimProgress = 0;
      moveCooldown = 6;

      // Track depth
      const depth = cy - LEVELS[level].skyRows;
      if (depth > deepestRow) deepestRow = depth;
    }

    // ── Physics: gravity ────────────────────────────────────────────────────
    function findNearestEmptyCell(fromY: number, fromX: number): { ny: number; nx: number } | null {
      // BFS to find the nearest EMPTY cell from (fromY, fromX)
      const visited = new Set<string>();
      const queue: { qy: number; qx: number }[] = [{ qy: fromY, qx: fromX }];
      visited.add(`${fromY},${fromX}`);
      while (queue.length > 0) {
        const { qy, qx } = queue.shift()!;
        if (inBounds(qx, qy) && grid[qy][qx] === EMPTY) {
          return { ny: qy, nx: qx };
        }
        for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const adjY = qy + dy;
          const adjX = qx + dx;
          const key = `${adjY},${adjX}`;
          if (inBounds(adjX, adjY) && !visited.has(key)) {
            visited.add(key);
            queue.push({ qy: adjY, qx: adjX });
          }
        }
      }
      return null;
    }

    function updateGravity() {
      // Bottom-to-top: if soil/rock above empty, it falls
      for (let y = ROWS - 2; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
          const cell = grid[y][x];
          if ((cell === SOIL || cell === ROCK) && y + 1 < ROWS && grid[y + 1][x] === EMPTY) {
            grid[y + 1][x] = cell;
            grid[y][x] = EMPTY;
            if (cell === ROCK) {
              rockHealth[y + 1][x] = rockHealth[y][x];
              rockHealth[y][x] = 0;
            }
            // Check if falling onto creature
            if (y + 1 === cy && x === cx) {
              if (damageCooldown <= 0) {
                health -= 15;
                damageCooldown = 30;
                spawnDamageParticles();
              }
            }
          }
        }
      }

      // After gravity: if the creature is now inside a solid cell, teleport to nearest empty cell
      if (inBounds(cx, cy) && isSolid(grid[cy][cx])) {
        const nearest = findNearestEmptyCell(cy, cx);
        if (nearest) {
          cx = nearest.nx;
          cy = nearest.ny;
          px = cx * CELL;
          py = cy * CELL;
          tx = px;
          ty = py;
          moveAnimProgress = 1;
        }
      }
    }

    // ── Physics: water flow ─────────────────────────────────────────────────
    function updateWaterFlow() {
      // Water flows down, then to sides
      const newGrid = grid.map(row => [...row]);
      for (let y = ROWS - 2; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
          if (grid[y][x] !== WATER) continue;
          // Flow down
          if (y + 1 < ROWS && grid[y + 1][x] === EMPTY && newGrid[y + 1][x] === EMPTY) {
            newGrid[y + 1][x] = WATER;
            newGrid[y][x] = EMPTY;
          }
          // Flow to sides (if can't go down)
          else if (y + 1 < ROWS && grid[y + 1][x] !== EMPTY) {
            const side = Math.random() < 0.5 ? -1 : 1;
            for (const s of [side, -side]) {
              const sx = x + s;
              if (inBounds(sx, y) && grid[y][sx] === EMPTY && newGrid[y][sx] === EMPTY) {
                newGrid[y][sx] = WATER;
                newGrid[y][x] = EMPTY;
                break;
              }
            }
          }
        }
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          grid[y][x] = newGrid[y][x];
        }
      }
    }

    // ── Physics: lava flow ──────────────────────────────────────────────────
    function updateLavaFlow() {
      const newGrid = grid.map(row => [...row]);
      for (let y = ROWS - 2; y >= 0; y--) {
        for (let x = 0; x < COLS; x++) {
          if (grid[y][x] !== LAVA) continue;
          // Flow down
          if (y + 1 < ROWS && grid[y + 1][x] === EMPTY && newGrid[y + 1][x] === EMPTY) {
            newGrid[y + 1][x] = LAVA;
            newGrid[y][x] = EMPTY;
          }
          // Flow to sides slowly
          else if (y + 1 < ROWS && grid[y + 1][x] !== EMPTY && Math.random() < 0.3) {
            const side = Math.random() < 0.5 ? -1 : 1;
            const sx = x + side;
            if (inBounds(sx, y) && grid[y][sx] === EMPTY && newGrid[y][sx] === EMPTY) {
              newGrid[y][sx] = LAVA;
              newGrid[y][x] = EMPTY;
            }
          }
        }
      }
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          grid[y][x] = newGrid[y][x];
        }
      }
    }

    // ── Hazard collision ────────────────────────────────────────────────────
    function checkHazards() {
      if (!inBounds(cx, cy)) return;
      const cell = grid[cy][cx];
      if (cell === WATER) {
        if (damageCooldown <= 0) {
          health -= 2;
          damageCooldown = 10;
          spawnDamageParticles();
          SoundEngine.play('waterDamage');
        }
      } else if (cell === LAVA) {
        health = 0;
        spawnDamageParticles();
        SoundEngine.play('lavaDeath');
      }
    }

    // ── Check level complete ────────────────────────────────────────────────
    function checkLevelComplete() {
      if (gemsCollected >= gemsTarget && cy <= LEVELS[level].skyRows) {
        // Reached surface with enough treasure
        totalScore += score;
        if (level < LEVELS.length - 1) {
          level++;
          state = 'LevelComplete';
          SoundEngine.play('levelComplete');
          levelTransitionTimer = 120;
        } else {
          // Won all levels!
          totalScore += health * 50; // bonus for remaining health
          state = 'GameOver';
        }
      }
    }

    // ── Input ───────────────────────────────────────────────────────────────
    function onKeyDown(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = true;
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
        e.preventDefault();
      }
      // Toggle pause only during Playing state
      if (state === 'Playing' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        paused = !paused;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = false;
    }
    function onClick() {
      if (state === 'Menu') {
        startGame();
      } else if (state === 'GameOver') {
        state = 'Menu';
      }
    }

    /* ── touch handling (virtual joystick) ───────────────── */
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let touchIsMoving = false;

    function getTouchCanvasPos(touch: Touch): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      return {
        x: (touch.clientX - rect.left) * (W / rect.width),
        y: (touch.clientY - rect.top) * (H / rect.height),
      };
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const pos = getTouchCanvasPos(e.touches[0]);
      touchStartX = pos.x;
      touchStartY = pos.y;
      touchStartTime = Date.now();
      touchIsMoving = false;

      if (state === 'Menu') {
        startGame();
        return;
      }
      if (state === 'GameOver') {
        state = 'Menu';
        return;
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (state !== 'Playing' || paused) return;
      if (e.touches.length === 0) return;
      const pos = getTouchCanvasPos(e.touches[0]);
      const dx = pos.x - touchStartX;
      const dy = pos.y - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 10) {
        // Dead zone - stop movement
        keys['arrowleft'] = false;
        keys['arrowright'] = false;
        keys['arrowup'] = false;
        keys['arrowdown'] = false;
        return;
      }

      touchIsMoving = true;

      // Calculate angle and map to cardinal + diagonal directions
      const angle = Math.atan2(dy, dx);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const threshold = 0.38;

      keys['arrowleft'] = cosA < -threshold;
      keys['arrowright'] = cosA > threshold;
      keys['arrowup'] = sinA < -threshold;
      keys['arrowdown'] = sinA > threshold;
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const elapsed = Date.now() - touchStartTime;

      // Stop all touch-driven movement
      keys['arrowleft'] = false;
      keys['arrowright'] = false;
      keys['arrowup'] = false;
      keys['arrowdown'] = false;

      // Quick tap = dig (same as spacebar)
      if (state === 'Playing' && !paused && elapsed < 200 && !touchIsMoving) {
        // Trigger dig by briefly setting spacebar key then calling tryDig
        tryDig();
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── Update ──────────────────────────────────────────────────────────────
    function update() {
      frameCount++;
      wobble = Math.sin(frameCount * 0.15) * 2;

      if (state === 'Menu') {
        menuTime++;
        return;
      }

      if (state === 'LevelComplete') {
        levelTransitionTimer--;
        if (levelTransitionTimer <= 0) {
          generateLevel(level);
          state = 'Playing';
        }
        return;
      }

      if (state !== 'Playing') return;

      // Skip all updates when paused
      if (paused) return;

      // Movement cooldown
      if (moveCooldown > 0) moveCooldown--;
      if (damageCooldown > 0) damageCooldown--;

      // Dig timer
      if (digging) {
        digTimer--;
        if (digTimer <= 0) digging = false;
      }

      // Smooth movement
      if (moveAnimProgress < 1) {
        moveAnimProgress = Math.min(1, moveAnimProgress + 0.15);
        px = px + (tx - px) * 0.3;
        py = py + (ty - py) * 0.3;
        if (moveAnimProgress >= 1) {
          px = tx;
          py = ty;
        }
      }

      // Input handling
      if (!digging) {
        if (keys['arrowup'] || keys['w']) tryMove(DIR.UP);
        else if (keys['arrowdown'] || keys['s']) tryMove(DIR.DOWN);
        else if (keys['arrowleft'] || keys['a']) tryMove(DIR.LEFT);
        else if (keys['arrowright'] || keys['d']) tryMove(DIR.RIGHT);

        if (keys[' ']) tryDig();
      }

      // Physics
      gravityTimer++;
      if (gravityTimer >= GRAVITY_RATE) {
        gravityTimer = 0;
        updateGravity();
      }

      waterFlowTimer++;
      if (waterFlowTimer >= WATER_FLOW_RATE) {
        waterFlowTimer = 0;
        updateWaterFlow();
      }

      lavaFlowTimer++;
      if (lavaFlowTimer >= LAVA_FLOW_RATE) {
        lavaFlowTimer = 0;
        updateLavaFlow();
      }

      // Hazards
      checkHazards();

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Check death
      if (health <= 0) {
        totalScore += score;
        state = 'GameOver';
        SoundEngine.play('gameOver');
      }

      // Check level complete
      checkLevelComplete();
    }

    // ── Drawing helpers ─────────────────────────────────────────────────────
    function drawCell(x: number, y: number, cellType: number) {
      const px0 = x * CELL;
      const py0 = y * CELL;

      switch (cellType) {
        case SURFACE: {
          // Sky gradient
          const skyGrad = ctx.createLinearGradient(0, 0, 0, LEVELS[level]?.skyRows * CELL || 80);
          skyGrad.addColorStop(0, '#1a1a2e');
          skyGrad.addColorStop(1, '#16213e');
          ctx.fillStyle = skyGrad;
          ctx.fillRect(px0, py0, CELL, CELL);
          break;
        }
        case EMPTY: {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(px0, py0, CELL, CELL);
          // Subtle background texture
          ctx.fillStyle = '#222';
          if ((x + y) % 3 === 0) {
            ctx.fillRect(px0 + 4, py0 + 4, 2, 2);
          }
          break;
        }
        case GRASS: {
          ctx.fillStyle = '#3d6b1e';
          ctx.fillRect(px0, py0, CELL, CELL);
          // Grass blades on top
          ctx.fillStyle = '#4ade80';
          for (let i = 0; i < 4; i++) {
            const bx = px0 + 2 + i * 5;
            const bh = 4 + Math.sin(frameCount * 0.05 + i + x) * 2;
            ctx.fillRect(bx, py0, 2, bh);
          }
          // Darker bottom
          ctx.fillStyle = '#2d5a15';
          ctx.fillRect(px0, py0 + CELL - 4, CELL, 4);
          break;
        }
        case SOIL: {
          ctx.fillStyle = '#8B4513';
          ctx.fillRect(px0, py0, CELL, CELL);
          // Texture dots
          ctx.fillStyle = '#a0522d';
          const seed = x * 73 + y * 137;
          for (let i = 0; i < 3; i++) {
            const dotX = px0 + ((seed + i * 47) % 16) + 2;
            const dotY = py0 + ((seed + i * 31) % 16) + 2;
            ctx.fillRect(dotX, dotY, 2, 2);
          }
          ctx.fillStyle = '#6b3410';
          ctx.fillRect(px0 + ((seed + 11) % 14) + 2, py0 + ((seed + 23) % 14) + 2, 3, 2);
          break;
        }
        case ROCK: {
          const hp = rockHealth[y][x];
          ctx.fillStyle = hp >= 2 ? '#666' : '#555';
          ctx.fillRect(px0, py0, CELL, CELL);
          // Crack patterns
          ctx.strokeStyle = '#555';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const seed2 = x * 53 + y * 97;
          ctx.moveTo(px0 + (seed2 % 10) + 3, py0 + 2);
          ctx.lineTo(px0 + (seed2 % 12) + 6, py0 + CELL - 2);
          ctx.stroke();
          if (hp < 2) {
            // Show damage cracks
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px0 + 3, py0 + 5);
            ctx.lineTo(px0 + CELL / 2, py0 + CELL / 2);
            ctx.lineTo(px0 + CELL - 3, py0 + CELL - 5);
            ctx.stroke();
            ctx.strokeStyle = '#3a3a3a';
            ctx.beginPath();
            ctx.moveTo(px0 + CELL - 4, py0 + 3);
            ctx.lineTo(px0 + CELL / 2, py0 + CELL / 2);
            ctx.stroke();
          }
          // Edge highlights
          ctx.fillStyle = '#777';
          ctx.fillRect(px0, py0, CELL, 1);
          ctx.fillStyle = '#555';
          ctx.fillRect(px0, py0 + CELL - 1, CELL, 1);
          break;
        }
        case GEM: {
          // Rock background
          ctx.fillStyle = '#666';
          ctx.fillRect(px0, py0, CELL, CELL);
          // Gem
          const gemColors = ['#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#10b981'];
          const gemColor = gemColors[(x * 7 + y * 13) % gemColors.length];
          const sparkle = Math.sin(frameCount * 0.1 + x * 3 + y * 5) * 0.3 + 0.7;
          ctx.fillStyle = gemColor;
          ctx.globalAlpha = sparkle;
          // Diamond shape
          ctx.beginPath();
          ctx.moveTo(px0 + CELL / 2, py0 + 3);
          ctx.lineTo(px0 + CELL - 3, py0 + CELL / 2);
          ctx.lineTo(px0 + CELL / 2, py0 + CELL - 3);
          ctx.lineTo(px0 + 3, py0 + CELL / 2);
          ctx.closePath();
          ctx.fill();
          // Sparkle highlight
          ctx.fillStyle = '#fff';
          ctx.globalAlpha = sparkle * 0.7;
          ctx.fillRect(px0 + CELL / 2 - 1, py0 + 5, 3, 3);
          ctx.globalAlpha = 1;
          break;
        }
        case WATER: {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(px0, py0, CELL, CELL);
          ctx.fillStyle = '#3b82f6';
          ctx.globalAlpha = 0.6;
          ctx.fillRect(px0, py0, CELL, CELL);
          // Ripple animation
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#93c5fd';
          const rippleY = py0 + Math.sin(frameCount * 0.08 + x * 2) * 3 + CELL / 2;
          ctx.fillRect(px0 + 2, rippleY, CELL - 4, 2);
          ctx.globalAlpha = 0.2;
          const rippleY2 = py0 + Math.sin(frameCount * 0.08 + x * 2 + 2) * 3 + CELL / 3;
          ctx.fillRect(px0 + 4, rippleY2, CELL - 8, 1);
          ctx.globalAlpha = 1;
          break;
        }
        case LAVA: {
          ctx.fillStyle = '#1a1a1a';
          ctx.fillRect(px0, py0, CELL, CELL);
          // Glow effect
          ctx.fillStyle = '#ef4444';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(px0, py0, CELL, CELL);
          // Bubbles
          ctx.fillStyle = '#fbbf24';
          ctx.globalAlpha = 0.6 + Math.sin(frameCount * 0.12 + x * 5 + y * 3) * 0.3;
          const bx1 = px0 + 4 + Math.sin(frameCount * 0.05 + x) * 3;
          const by1 = py0 + 4 + Math.sin(frameCount * 0.07 + y) * 3;
          ctx.beginPath();
          ctx.arc(bx1, by1, 3, 0, Math.PI * 2);
          ctx.fill();
          const bx2 = px0 + CELL - 6 + Math.sin(frameCount * 0.06 + x + 3) * 2;
          const by2 = py0 + CELL - 6 + Math.sin(frameCount * 0.09 + y + 2) * 2;
          ctx.beginPath();
          ctx.arc(bx2, by2, 2, 0, Math.PI * 2);
          ctx.fill();
          // Surface glow
          ctx.fillStyle = '#f97316';
          ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.1 + x + y) * 0.2;
          ctx.fillRect(px0 + 2, py0 + 2, CELL - 4, CELL - 4);
          ctx.globalAlpha = 1;
          break;
        }
        case BEDROCK: {
          ctx.fillStyle = '#333';
          ctx.fillRect(px0, py0, CELL, CELL);
          ctx.fillStyle = '#2a2a2a';
          ctx.fillRect(px0 + 2, py0 + 2, 6, 4);
          ctx.fillRect(px0 + 10, py0 + 8, 5, 5);
          ctx.fillRect(px0 + 3, py0 + 12, 7, 4);
          break;
        }
      }
    }

    function drawCreature() {
      const sz = CELL * creatureSize;
      const offsetX = (CELL - sz) / 2;
      const offsetY = (CELL - sz) / 2;
      const drawX = px + offsetX;
      const drawY = py + offsetY + wobble;

      // Body
      ctx.fillStyle = LIME;
      ctx.beginPath();
      ctx.ellipse(drawX + sz / 2, drawY + sz / 2, sz / 2, sz / 2.2, 0, 0, Math.PI * 2);
      ctx.fill();

      // Darker belly
      ctx.fillStyle = LIME_DARK;
      ctx.beginPath();
      ctx.ellipse(drawX + sz / 2, drawY + sz / 2 + 2, sz / 2.5, sz / 3, 0, 0, Math.PI);
      ctx.fill();

      // Eyes
      const eyeOffsetX = facing === DIR.LEFT ? -2 : facing === DIR.RIGHT ? 2 : 0;
      const eyeOffsetY = facing === DIR.UP ? -2 : facing === DIR.DOWN ? 2 : 0;

      // Left eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(drawX + sz * 0.35 + eyeOffsetX, drawY + sz * 0.35 + eyeOffsetY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(drawX + sz * 0.35 + eyeOffsetX * 1.5, drawY + sz * 0.35 + eyeOffsetY * 1.5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Right eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(drawX + sz * 0.65 + eyeOffsetX, drawY + sz * 0.35 + eyeOffsetY, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(drawX + sz * 0.65 + eyeOffsetX * 1.5, drawY + sz * 0.35 + eyeOffsetY * 1.5, 2, 0, Math.PI * 2);
      ctx.fill();

      // Mouth (small, opens when digging)
      if (digging) {
        ctx.fillStyle = '#4d7c0f';
        ctx.beginPath();
        ctx.arc(drawX + sz / 2 + DX[facing] * 3, drawY + sz / 2 + DY[facing] * 3 + 2, 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#4d7c0f';
        ctx.beginPath();
        ctx.arc(drawX + sz / 2, drawY + sz * 0.6, 2.5, 0, Math.PI);
        ctx.fill();
      }

      // Dig indicator (facing direction)
      if (keys[' '] && digging) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.4 + Math.sin(frameCount * 0.3) * 0.3;
        const indX = (cx + DX[facing]) * CELL;
        const indY = (cy + DY[facing]) * CELL;
        ctx.fillRect(indX, indY, CELL, CELL);
        ctx.globalAlpha = 1;
      }
    }

    function drawParticles() {
      for (const p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
    }

    function drawHUD() {
      const def = LEVELS[level];

      // Semi-transparent HUD background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, 32);

      // Health bar
      ctx.fillStyle = '#333';
      ctx.fillRect(8, 8, 104, 16);
      const healthPct = Math.max(0, health / maxHealth);
      const healthColor = healthPct > 0.5 ? LIME : healthPct > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillStyle = healthColor;
      ctx.fillRect(10, 10, 100 * healthPct, 12);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;
      ctx.strokeRect(8, 8, 104, 16);

      // Health text
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`HP ${Math.ceil(health)}`, 60, 20);

      // Score
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`Score: ${score}`, 125, 20);

      // Gems
      ctx.fillStyle = gemsCollected >= gemsTarget ? LIME : '#f59e0b';
      ctx.fillText(`Gems: ${gemsCollected}/${gemsTarget}`, 260, 20);

      // Level
      ctx.fillStyle = '#93c5fd';
      ctx.fillText(`Lv ${level + 1}: ${def.name}`, 420, 20);

      // Depth
      const depth = Math.max(0, cy - def.skyRows);
      ctx.fillStyle = '#a78bfa';
      ctx.textAlign = 'right';
      ctx.fillText(`Depth: ${depth}m`, W - 10, 20);

      // If enough gems, show hint
      if (gemsCollected >= gemsTarget) {
        ctx.fillStyle = LIME;
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px monospace';
        const blink = Math.sin(frameCount * 0.1) > 0;
        if (blink) {
          ctx.fillText('Return to surface to complete level!', W / 2, H - 10);
        }
      }
    }

    // ── Draw Menu ───────────────────────────────────────────────────────────
    function drawMenu() {
      // Background - terrain cross section art
      ctx.fillStyle = '#0f0f1a';
      ctx.fillRect(0, 0, W, H);

      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 200);
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(1, '#1e293b');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, W, 200);

      // Stars
      for (let i = 0; i < 30; i++) {
        const sx = (i * 127 + menuTime * 0.02) % W;
        const sy = (i * 83) % 180;
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.3 + Math.sin(menuTime * 0.03 + i) * 0.3;
        ctx.fillRect(sx, sy, 2, 2);
      }
      ctx.globalAlpha = 1;

      // Terrain layers
      // Grass
      ctx.fillStyle = '#3d6b1e';
      ctx.fillRect(0, 200, W, 40);
      ctx.fillStyle = '#4ade80';
      for (let i = 0; i < W; i += 8) {
        const h = 6 + Math.sin(menuTime * 0.02 + i * 0.3) * 3;
        ctx.fillRect(i, 196, 3, h);
      }

      // Soil
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(0, 240, W, 120);
      ctx.fillStyle = '#a0522d';
      for (let i = 0; i < 60; i++) {
        ctx.fillRect((i * 37) % W, 240 + (i * 23) % 120, 3, 2);
      }

      // Rock
      ctx.fillStyle = '#555';
      ctx.fillRect(0, 360, W, 140);
      ctx.fillStyle = '#666';
      for (let i = 0; i < 40; i++) {
        ctx.fillRect((i * 47) % W, 360 + (i * 29) % 140, 4, 3);
      }

      // Lava at bottom
      ctx.fillStyle = '#ef4444';
      ctx.globalAlpha = 0.8;
      ctx.fillRect(0, 500, W, 100);
      ctx.fillStyle = '#f97316';
      ctx.globalAlpha = 0.5 + Math.sin(menuTime * 0.04) * 0.2;
      ctx.fillRect(0, 500, W, 100);
      ctx.globalAlpha = 1;

      // Lava bubbles
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = '#fbbf24';
        ctx.globalAlpha = 0.5 + Math.sin(menuTime * 0.06 + i * 2) * 0.3;
        ctx.beginPath();
        const bx = (i * 107) % W;
        const by = 510 + Math.sin(menuTime * 0.04 + i) * 15;
        ctx.arc(bx, by, 4 + Math.sin(menuTime * 0.05 + i) * 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Gems in terrain
      const gemColors = ['#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];
      for (let i = 0; i < 12; i++) {
        const gx = (i * 71 + 30) % (W - 40) + 20;
        const gy = 270 + (i * 43) % 200;
        const gc = gemColors[i % gemColors.length];
        const sparkle = 0.6 + Math.sin(menuTime * 0.08 + i * 3) * 0.4;
        ctx.fillStyle = gc;
        ctx.globalAlpha = sparkle;
        ctx.beginPath();
        ctx.moveTo(gx, gy - 6);
        ctx.lineTo(gx + 6, gy);
        ctx.lineTo(gx, gy + 6);
        ctx.lineTo(gx - 6, gy);
        ctx.closePath();
        ctx.fill();
        // Sparkle
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = sparkle * 0.6;
        ctx.fillRect(gx - 1, gy - 4, 2, 2);
      }
      ctx.globalAlpha = 1;

      // Animated creature on menu
      const creatureX = W / 2 + Math.sin(menuTime * 0.025) * 80;
      const creatureY = 300 + Math.sin(menuTime * 0.03) * 20;
      // Tunnel behind creature
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.ellipse(creatureX, creatureY, 14, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Creature
      ctx.fillStyle = LIME;
      ctx.beginPath();
      ctx.ellipse(creatureX, creatureY, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = LIME_DARK;
      ctx.beginPath();
      ctx.ellipse(creatureX, creatureY + 2, 8, 5, 0, 0, Math.PI);
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(creatureX - 4, creatureY - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(creatureX + 4, creatureY - 3, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(creatureX - 3, creatureY - 3, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(creatureX + 5, creatureY - 3, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Title
      ctx.save();
      ctx.shadowColor = LIME;
      ctx.shadowBlur = 20;
      ctx.fillStyle = LIME;
      ctx.font = 'bold 64px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('TERRAVORE', W / 2, 80);
      ctx.restore();

      // Subtitle
      ctx.fillStyle = LIME_DARK;
      ctx.font = '18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Devour the earth. Claim its treasures.', W / 2, 120);

      // Instructions
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px monospace';
      const instructions = [
        'Arrow Keys / WASD  -  Move',
        'Space  -  Dig in facing direction',
        '',
        'Collect gems buried in the earth',
        'Avoid water floods and lava flows',
        'Return to surface once target is met',
      ];
      instructions.forEach((line, i) => {
        ctx.fillText(line, W / 2, 155 + i * 20);
      });

      // Click to start
      ctx.fillStyle = LIME;
      ctx.globalAlpha = 0.6 + Math.sin(menuTime * 0.06) * 0.4;
      ctx.font = 'bold 22px monospace';
      ctx.fillText('[ Click to Start ]', W / 2, H - 50);
      ctx.globalAlpha = 1;
    }

    // ── Draw GameOver ───────────────────────────────────────────────────────
    function drawGameOver() {
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, W, H);

      const isWin = level >= LEVELS.length - 1 && gemsCollected >= gemsTarget && health > 0;

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (isWin) {
        ctx.save();
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 48px monospace';
        ctx.fillText('VICTORY!', W / 2, 120);
        ctx.restore();

        ctx.fillStyle = LIME;
        ctx.font = '20px monospace';
        ctx.fillText('You conquered all depths!', W / 2, 170);
      } else {
        ctx.save();
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 25;
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 48px monospace';
        ctx.fillText('GAME OVER', W / 2, 120);
        ctx.restore();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px monospace';
        const deathMsg = health <= 0 ? (grid[cy]?.[cx] === LAVA ? 'Consumed by lava!' : 'You perished in the depths.') : 'The earth claimed you.';
        ctx.fillText(deathMsg, W / 2, 170);
      }

      // Stats
      ctx.font = '16px monospace';
      const stats = [
        { label: 'Total Score', value: `${totalScore}`, color: '#fbbf24' },
        { label: 'Gems Collected', value: `${gemsCollected}`, color: '#a78bfa' },
        { label: 'Level Reached', value: `${level + 1} - ${LEVELS[Math.min(level, LEVELS.length - 1)].name}`, color: '#93c5fd' },
        { label: 'Deepest Depth', value: `${deepestRow}m`, color: '#f472b6' },
        { label: 'Blocks Eaten', value: `${blocksEaten}`, color: LIME },
      ];

      stats.forEach((s, i) => {
        const y = 230 + i * 40;
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'right';
        ctx.fillText(s.label + ':', W / 2 - 10, y);
        ctx.fillStyle = s.color;
        ctx.textAlign = 'left';
        ctx.fillText(s.value, W / 2 + 10, y);
      });

      // Click to restart
      ctx.fillStyle = LIME;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.6 + Math.sin(frameCount * 0.06) * 0.4;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('[ Click to Restart ]', W / 2, H - 60);
      ctx.globalAlpha = 1;
    }

    // ── Draw Level Complete ─────────────────────────────────────────────────
    function drawLevelComplete() {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.shadowColor = LIME;
      ctx.shadowBlur = 20;
      ctx.fillStyle = LIME;
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LEVEL COMPLETE!', W / 2, H / 2 - 60);
      ctx.restore();

      ctx.fillStyle = '#fbbf24';
      ctx.font = '22px monospace';
      ctx.fillText(`${LEVELS[level - 1]?.name ?? 'Level'} cleared!`, W / 2, H / 2 - 10);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px monospace';
      ctx.fillText(`Score: ${score}`, W / 2, H / 2 + 30);
      ctx.fillText(`Gems: ${gemsCollected}`, W / 2, H / 2 + 55);

      ctx.fillStyle = LIME;
      ctx.font = '18px monospace';
      ctx.fillText(`Next: ${LEVELS[level].name}`, W / 2, H / 2 + 100);

      // Progress bar
      const barW = 200;
      const barH = 8;
      const progress = 1 - levelTransitionTimer / 120;
      ctx.fillStyle = '#333';
      ctx.fillRect(W / 2 - barW / 2, H / 2 + 130, barW, barH);
      ctx.fillStyle = LIME;
      ctx.fillRect(W / 2 - barW / 2, H / 2 + 130, barW * progress, barH);
    }

    // ── Main draw ───────────────────────────────────────────────────────────
    function draw() {
      ctx.clearRect(0, 0, W, H);

      if (state === 'Menu') {
        drawMenu();
        return;
      }

      if (state === 'GameOver') {
        // Draw terrain behind overlay
        drawPlayfield();
        drawGameOver();
        return;
      }

      if (state === 'LevelComplete') {
        drawPlayfield();
        drawLevelComplete();
        return;
      }

      drawPlayfield();

      // Draw pause overlay when paused
      if (paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, W, H);

        ctx.save();
        ctx.shadowColor = LIME;
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', W / 2, H / 2 - 20);
        ctx.restore();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Press P to resume', W / 2, H / 2 + 25);
      }
    }

    function drawPlayfield() {
      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, W, H);

      // Calculate camera offset to follow creature
      let camY = 0;
      // Vertical scrolling when grid is taller than view
      const viewH = H;
      const gridPixelH = ROWS * CELL;
      if (gridPixelH > viewH) {
        camY = Math.max(0, Math.min(py - viewH / 2, gridPixelH - viewH));
      }

      ctx.save();
      ctx.translate(0, -camY);

      // Draw grid
      const startRow = Math.max(0, Math.floor(camY / CELL));
      const endRow = Math.min(ROWS, Math.ceil((camY + viewH) / CELL) + 1);

      for (let y = startRow; y < endRow; y++) {
        for (let x = 0; x < COLS; x++) {
          drawCell(x, y, grid[y][x]);
        }
      }

      // Grid lines (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(x * CELL, startRow * CELL);
        ctx.lineTo(x * CELL, endRow * CELL);
        ctx.stroke();
      }
      for (let y = startRow; y <= endRow; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * CELL);
        ctx.lineTo(W, y * CELL);
        ctx.stroke();
      }

      // Draw particles
      drawParticles();

      // Draw creature
      drawCreature();

      // Exit indicator when gems target met
      if (gemsCollected >= gemsTarget) {
        const def = LEVELS[level];
        // Draw arrow pointing to surface
        const exitX = Math.floor(COLS / 2) * CELL + CELL / 2;
        const exitY = (def.skyRows - 1) * CELL + CELL / 2;
        ctx.fillStyle = LIME;
        ctx.globalAlpha = 0.5 + Math.sin(frameCount * 0.1) * 0.3;
        ctx.beginPath();
        ctx.moveTo(exitX, exitY - 8);
        ctx.lineTo(exitX - 8, exitY + 4);
        ctx.lineTo(exitX + 8, exitY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      // Draw HUD on top (not affected by camera)
      drawHUD();
    }

    // ── Game loop ───────────────────────────────────────────────────────────
    let animId = 0;
    function loop() {
      update();
      draw();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
        background: '#000',
        imageRendering: 'pixelated',
      }}
      tabIndex={0}
    />
  );
}
