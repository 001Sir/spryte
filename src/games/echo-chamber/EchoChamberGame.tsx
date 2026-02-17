'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';

// ────────────────────────────────────────────────────────────────
//  ECHO CHAMBER  –  Navigate darkness with sound-wave pulses
// ────────────────────────────────────────────────────────────────

const W = 800;
const H = 600;

/* ── colour palette ─────────────────────────────────────── */
const COL = {
  bg: '#000000',
  player: '#eab308',
  playerGlow: 'rgba(234,179,8,0.15)',
  wave: '#eab308',
  wallFill: '#222222',
  wallEdge: '#eab308',
  enemy: '#ff3333',
  gem: '#ffd700',
  exit: '#33ff33',
  hudText: '#eab308',
  title: '#eab308',
  subtitle: '#ccaa00',
  dimText: '#888888',
};

/* ── tile grid constants ────────────────────────────────── */
const TILE = 32; // px per cell
const COLS = W / TILE; // 25
const GRID_ROWS = Math.floor(H / TILE); // 18

/* ── level data helper types ────────────────────────────── */
interface LevelData {
  walls: number[][]; // GRID_ROWS x COLS, 1 = wall
  enemies: { x: number; y: number }[];
  gems: { x: number; y: number }[];
  exit: { x: number; y: number };
  start: { x: number; y: number };
  pulses: number;
}

/* ── simple maze carver (recursive back-tracker on a coarser grid) ── */
function generateMaze(
  cols: number,
  rows: number,
  complexity: number,
): number[][] {
  // Start with all walls
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      grid[r][c] = 1;
    }
  }

  // Carve passages using recursive back-tracker on odd cells
  const visited = new Set<string>();
  const stack: [number, number][] = [];

  const startR = 1;
  const startC = 1;
  grid[startR][startC] = 0;
  visited.add(`${startR},${startC}`);
  stack.push([startR, startC]);

  const dirs = [
    [0, 2],
    [0, -2],
    [2, 0],
    [-2, 0],
  ];

  while (stack.length > 0) {
    const [cr, cc] = stack[stack.length - 1];
    // shuffle directions
    const shuffled = dirs
      .map((d) => ({ d, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => x.d);

    let found = false;
    for (const [dr, dc] of shuffled) {
      const nr = cr + dr;
      const nc = cc + dc;
      if (
        nr > 0 &&
        nr < rows - 1 &&
        nc > 0 &&
        nc < cols - 1 &&
        !visited.has(`${nr},${nc}`)
      ) {
        visited.add(`${nr},${nc}`);
        grid[cr + dr / 2][cc + dc / 2] = 0; // knock down wall between
        grid[nr][nc] = 0;
        stack.push([nr, nc]);
        found = true;
        break;
      }
    }
    if (!found) stack.pop();
  }

  // Add some extra openings for playability based on complexity (lower = more open)
  const extraOpenings = Math.max(0, 40 - complexity * 5);
  for (let i = 0; i < extraOpenings; i++) {
    const r = 1 + Math.floor(Math.random() * (rows - 2));
    const c = 1 + Math.floor(Math.random() * (cols - 2));
    if (grid[r][c] === 1) {
      // only remove if it won't break border
      if (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
        grid[r][c] = 0;
      }
    }
  }

  return grid;
}

/* ── place items in empty cells far from start ─────────── */
function findEmptyCells(
  grid: number[][],
  rows: number,
  cols: number,
): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (grid[r][c] === 0) cells.push({ r, c });
    }
  }
  return cells;
}

function dist(
  a: { r: number; c: number },
  b: { r: number; c: number },
): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function buildLevel(levelNum: number): LevelData {
  const complexity = Math.min(levelNum, 8);
  const grid = generateMaze(COLS, GRID_ROWS, complexity);

  const empty = findEmptyCells(grid, GRID_ROWS, COLS);
  // sort by distance from top-left for consistent start/exit placement
  const startCell = { r: 1, c: 1 };
  grid[startCell.r][startCell.c] = 0; // ensure clear

  // exit: pick farthest empty cell from start
  empty.sort((a, b) => dist(b, startCell) - dist(a, startCell));
  const exitCell = empty[0];
  grid[exitCell.r][exitCell.c] = 0;

  // enemies: pick cells far from start, spread out
  const numEnemies = Math.min(2 + levelNum, 10);
  const enemies: { x: number; y: number }[] = [];
  const usedCells = new Set<string>();
  usedCells.add(`${startCell.r},${startCell.c}`);
  usedCells.add(`${exitCell.r},${exitCell.c}`);

  const enemyCandidates = empty.filter(
    (c) => dist(c, startCell) > 6 && !usedCells.has(`${c.r},${c.c}`),
  );
  for (let i = 0; i < numEnemies && enemyCandidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * enemyCandidates.length);
    const cell = enemyCandidates.splice(idx, 1)[0];
    enemies.push({ x: cell.c * TILE + TILE / 2, y: cell.r * TILE + TILE / 2 });
    usedCells.add(`${cell.r},${cell.c}`);
  }

  // gems: scatter some
  const numGems = 3 + Math.floor(levelNum * 1.5);
  const gems: { x: number; y: number }[] = [];
  const gemCandidates = empty.filter((c) => !usedCells.has(`${c.r},${c.c}`));
  for (let i = 0; i < numGems && gemCandidates.length > 0; i++) {
    const idx = Math.floor(Math.random() * gemCandidates.length);
    const cell = gemCandidates.splice(idx, 1)[0];
    gems.push({ x: cell.c * TILE + TILE / 2, y: cell.r * TILE + TILE / 2 });
    usedCells.add(`${cell.r},${cell.c}`);
  }

  const pulsesAllowed = Math.max(6, 12 - levelNum);

  return {
    walls: grid,
    enemies,
    gems,
    exit: {
      x: exitCell.c * TILE + TILE / 2,
      y: exitCell.r * TILE + TILE / 2,
    },
    start: {
      x: startCell.c * TILE + TILE / 2,
      y: startCell.r * TILE + TILE / 2,
    },
    pulses: pulsesAllowed,
  };
}

/* ════════════════════════════════════════════════════════════════
   COMPONENT
   ════════════════════════════════════════════════════════════════ */

export default function EchoChamberGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = W;
    canvas.height = H;

    /* ── state machine ──────────────────────────────────── */
    type GameState = 'menu' | 'playing' | 'gameover';
    let state: GameState = 'menu';
    let paused = false;
    let animId = 0;
    let lastTime = 0;

    let highScore = getHighScore('echo-chamber');
    let newHighScore = false;

    /* ── menu animation state ───────────────────────────── */
    const menuRings: { radius: number; alpha: number }[] = [];
    let menuTimer = 0;

    /* ── game state (reset per level / game) ────────────── */
    let level = 1;
    let score = 0;
    let totalGemsCollected = 0;
    // current level data
    let lvl: LevelData;
    let px: number, py: number; // player position (centre)
    const pSpeed = 140; // px/sec
    const pRadius = 6;

    // reveal map: brightness 0..1 per tile
    let revealMap: number[][];

    // active waves
    interface Wave {
      cx: number;
      cy: number;
      radius: number;
      maxRadius: number;
      speed: number;
      alpha: number;
    }
    let waves: Wave[] = [];

    // enemies runtime
    interface Enemy {
      x: number;
      y: number;
      frozen: boolean;
      frozenTimer: number;
      speed: number;
      alive: boolean;
    }
    let enemies: Enemy[] = [];

    // gems runtime
    interface Gem {
      x: number;
      y: number;
      collected: boolean;
      sparklePhase: number;
    }
    let gems: Gem[] = [];

    // exit
    let exitX: number, exitY: number;
    let exitPulse = 0;

    // pulses remaining
    let pulsesLeft = 0;

    // keys
    const keys: Record<string, boolean> = {};

    // gameover data
    let goMessage = '';
    let goScore = 0;
    let goLevel = 0;

    /* ── initialise a level ─────────────────────────────── */
    function initLevel(num: number) {
      lvl = buildLevel(num);
      px = lvl.start.x;
      py = lvl.start.y;
      pulsesLeft = lvl.pulses;
      waves = [];

      // reveal map
      revealMap = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        revealMap[r] = new Array(COLS).fill(0);
      }

      // enemies
      enemies = lvl.enemies.map((e) => ({
        x: e.x,
        y: e.y,
        frozen: false,
        frozenTimer: 0,
        speed: 40 + num * 8,
        alive: true,
      }));

      // gems
      gems = lvl.gems.map((g) => ({
        x: g.x,
        y: g.y,
        collected: false,
        sparklePhase: Math.random() * Math.PI * 2,
      }));

      exitX = lvl.exit.x;
      exitY = lvl.exit.y;
    }

    /* ── input handlers ─────────────────────────────────── */
    function onKeyDown(e: KeyboardEvent) {
      // Pause toggle
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && state === 'playing') {
        paused = !paused;
        return;
      }
      keys[e.key] = true;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(
          e.key,
        )
      ) {
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys[e.key] = false;
    }

    function onClick() {
      if (state === 'menu') {
        state = 'playing';
        SoundEngine.play('menuSelect');
        level = 1;
        score = 0;
        newHighScore = false;
        totalGemsCollected = 0;
        initLevel(level);
        return;
      }
      if (state === 'gameover') {
        state = 'menu';
        return;
      }
      if (state === 'playing' && !paused) {
        // send pulse
        if (pulsesLeft > 0) {
          pulsesLeft--;
          waves.push({
            cx: px,
            cy: py,
            radius: 0,
            maxRadius: 500,
            speed: 240,
            alpha: 1,
          });
          SoundEngine.play('pulse');
        }
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

      if (state === 'menu') {
        state = 'playing';
        level = 1;
        score = 0;
        newHighScore = false;
        totalGemsCollected = 0;
        initLevel(level);
        return;
      }
      if (state === 'gameover') {
        state = 'menu';
        return;
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (state !== 'playing' || paused) return;
      if (e.touches.length === 0) return;
      const pos = getTouchCanvasPos(e.touches[0]);
      const dx = pos.x - touchStartX;
      const dy = pos.y - touchStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 10) {
        // Dead zone - stop movement
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
        keys['ArrowUp'] = false;
        keys['ArrowDown'] = false;
        return;
      }

      touchIsMoving = true;

      // Calculate angle and map to cardinal + diagonal directions
      const angle = Math.atan2(dy, dx);

      // Determine horizontal and vertical components using thresholds
      // Horizontal: active if |cos(angle)| > cos(67.5deg) ≈ 0.38
      // Vertical:   active if |sin(angle)| > sin(67.5deg) ≈ 0.38
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const threshold = 0.38;

      keys['ArrowLeft'] = cosA < -threshold;
      keys['ArrowRight'] = cosA > threshold;
      keys['ArrowUp'] = sinA < -threshold;
      keys['ArrowDown'] = sinA > threshold;
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const elapsed = Date.now() - touchStartTime;

      // Stop all touch-driven movement
      keys['ArrowLeft'] = false;
      keys['ArrowRight'] = false;
      keys['ArrowUp'] = false;
      keys['ArrowDown'] = false;

      // Quick tap = send pulse (same as click)
      if (state === 'playing' && !paused && elapsed < 200 && !touchIsMoving) {
        if (pulsesLeft > 0) {
          pulsesLeft--;
          waves.push({
            cx: px,
            cy: py,
            radius: 0,
            maxRadius: 500,
            speed: 240,
            alpha: 1,
          });
          SoundEngine.play('pulse');
        }
      }
    }

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    canvas.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onVisibilityChange = () => {
      if (document.hidden && state === 'playing' && !paused) {
        paused = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    /* ── collision helpers ───────────────────────────────── */
    function wallAt(wx: number, wy: number): boolean {
      const c = Math.floor(wx / TILE);
      const r = Math.floor(wy / TILE);
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= COLS) return true;
      return lvl.walls[r][c] === 1;
    }

    function canMove(nx: number, ny: number, radius: number): boolean {
      // check four corners of bounding box
      return (
        !wallAt(nx - radius, ny - radius) &&
        !wallAt(nx + radius, ny - radius) &&
        !wallAt(nx - radius, ny + radius) &&
        !wallAt(nx + radius, ny + radius)
      );
    }

    /* ── brightness helpers ─────────────────────────────── */
    function getBrightness(wx: number, wy: number): number {
      const c = Math.floor(wx / TILE);
      const r = Math.floor(wy / TILE);
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= COLS) return 0;
      return revealMap[r][c];
    }

    function revealTile(wx: number, wy: number, brightness: number) {
      const c = Math.floor(wx / TILE);
      const r = Math.floor(wy / TILE);
      if (r >= 0 && r < GRID_ROWS && c >= 0 && c < COLS) {
        revealMap[r][c] = Math.min(1, Math.max(revealMap[r][c], brightness));
      }
    }

    /* ── enemy simple pathfinding (move toward player if in darkness) ── */
    function moveEnemy(en: Enemy, dt: number) {
      const br = getBrightness(en.x, en.y);
      if (br > 0.3) {
        en.frozen = true;
        en.frozenTimer = 0.8; // stay frozen 0.8s after light fades
        SoundEngine.play('enemyFreeze');
        return;
      }
      if (en.frozenTimer > 0) {
        en.frozenTimer -= dt;
        en.frozen = true;
        return;
      }
      en.frozen = false;

      // move toward player
      const dx = px - en.x;
      const dy = py - en.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) return;
      const mx = (dx / d) * en.speed * dt;
      const my = (dy / d) * en.speed * dt;

      // try full move, then axes individually
      const er = 5;
      if (canMove(en.x + mx, en.y + my, er)) {
        en.x += mx;
        en.y += my;
      } else if (canMove(en.x + mx, en.y, er)) {
        en.x += mx;
      } else if (canMove(en.x, en.y + my, er)) {
        en.y += my;
      }
    }

    /* ── update playing state ───────────────────────────── */
    function updatePlaying(dt: number) {
      // clamp dt to avoid tunneling on tab refocus
      if (dt > 0.1) dt = 0.1;

      // ── player movement ──
      let dx = 0,
        dy = 0;
      if (keys['ArrowLeft'] || keys['a']) dx -= 1;
      if (keys['ArrowRight'] || keys['d']) dx += 1;
      if (keys['ArrowUp'] || keys['w']) dy -= 1;
      if (keys['ArrowDown'] || keys['s']) dy += 1;
      if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
      }
      const nmx = px + dx * pSpeed * dt;
      const nmy = py + dy * pSpeed * dt;
      // try full, then each axis
      if (canMove(nmx, nmy, pRadius)) {
        px = nmx;
        py = nmy;
      } else if (canMove(nmx, py, pRadius)) {
        px = nmx;
      } else if (canMove(px, nmy, pRadius)) {
        py = nmy;
      }

      // ── waves update ──
      for (let i = waves.length - 1; i >= 0; i--) {
        const w = waves[i];
        w.radius += w.speed * dt;
        w.alpha = Math.max(0, 1 - w.radius / w.maxRadius);

        // reveal tiles that the wave front passes over
        // sample points along the ring
        const numSamples = Math.max(20, Math.floor(w.radius * 0.5));
        for (let s = 0; s < numSamples; s++) {
          const angle = (s / numSamples) * Math.PI * 2;
          const sx = w.cx + Math.cos(angle) * w.radius;
          const sy = w.cy + Math.sin(angle) * w.radius;

          // wave is blocked by walls (doesn't pass through them, but reveals them)
          const blocked = wallAt(sx, sy);
          revealTile(sx, sy, w.alpha * 0.9 + 0.1);

          if (!blocked) {
            // also reveal a little ahead of the wave for smoother reveal
            const sx2 = w.cx + Math.cos(angle) * (w.radius + TILE * 0.5);
            const sy2 = w.cy + Math.sin(angle) * (w.radius + TILE * 0.5);
            revealTile(sx2, sy2, w.alpha * 0.3);
          }
        }

        if (w.radius >= w.maxRadius) {
          waves.splice(i, 1);
        }
      }

      // ── decay reveal map ──
      const decayRate = 0.6; // per second
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (revealMap[r][c] > 0) {
            revealMap[r][c] = Math.max(0, revealMap[r][c] - decayRate * dt);
          }
        }
      }

      // ── permanent glow around player ──
      const glowR = 1.2; // tiles
      const pr = Math.floor(py / TILE);
      const pc = Math.floor(px / TILE);
      for (
        let r = Math.max(0, pr - 2);
        r <= Math.min(GRID_ROWS - 1, pr + 2);
        r++
      ) {
        for (
          let c = Math.max(0, pc - 2);
          c <= Math.min(COLS - 1, pc + 2);
          c++
        ) {
          const tcx = c * TILE + TILE / 2;
          const tcy = r * TILE + TILE / 2;
          const d = Math.sqrt((tcx - px) ** 2 + (tcy - py) ** 2) / TILE;
          if (d < glowR) {
            const brightness = Math.max(0.15, 0.7 * (1 - d / glowR));
            revealMap[r][c] = Math.max(revealMap[r][c], brightness);
          }
        }
      }

      // ── enemies ──
      for (const en of enemies) {
        if (!en.alive) continue;
        moveEnemy(en, dt);

        // check collision with player
        const edx = en.x - px;
        const edy = en.y - py;
        if (Math.sqrt(edx * edx + edy * edy) < pRadius + 8) {
          // game over
          state = 'gameover';
          goMessage = 'Caught in the dark!';
          goScore = score;
          goLevel = level;
          if (score > highScore) { highScore = score; newHighScore = true; setHighScore('echo-chamber', score); }
          SoundEngine.play('gameOver');
          return;
        }
      }

      // ── gems ──
      for (const g of gems) {
        if (g.collected) continue;
        g.sparklePhase += dt * 3;
        const gdx = g.x - px;
        const gdy = g.y - py;
        if (Math.sqrt(gdx * gdx + gdy * gdy) < pRadius + 10) {
          g.collected = true;
          score += 100;
          totalGemsCollected++;
          SoundEngine.play('collectGem');
        }
      }

      // ── exit ──
      exitPulse += dt * 2;
      const exDx = exitX - px;
      const exDy = exitY - py;
      if (Math.sqrt(exDx * exDx + exDy * exDy) < pRadius + 12) {
        // level complete
        const pulseBonus = pulsesLeft * 50;
        score += 200 + pulseBonus;
        SoundEngine.play('levelComplete');
        level++;
        if (level > 10) {
          // win
          state = 'gameover';
          goMessage = 'You escaped all 10 levels!';
          goScore = score;
          goLevel = level - 1;
          if (score > highScore) { highScore = score; newHighScore = true; setHighScore('echo-chamber', score); }
          return;
        }
        initLevel(level);
      }
    }

    /* ── drawing helpers ────────────────────────────────── */
    function drawMenu(t: number) {
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, W, H);

      // animated rings
      menuTimer += 0.016;
      if (menuTimer > 1.2) {
        menuTimer = 0;
        menuRings.push({ radius: 0, alpha: 1 });
      }
      for (let i = menuRings.length - 1; i >= 0; i--) {
        const ring = menuRings[i];
        ring.radius += 1.5;
        ring.alpha = Math.max(0, 1 - ring.radius / 320);
        ctx.beginPath();
        ctx.arc(W / 2, H / 2 - 30, ring.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(234,179,8,${ring.alpha * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        if (ring.alpha <= 0) menuRings.splice(i, 1);
      }

      // title
      ctx.textAlign = 'center';
      ctx.fillStyle = COL.title;
      ctx.font = 'bold 52px monospace';
      ctx.fillText('ECHO CHAMBER', W / 2, H / 2 - 50);

      // subtitle
      ctx.fillStyle = COL.subtitle;
      ctx.font = '18px monospace';
      ctx.fillText('Navigate the darkness with sound', W / 2, H / 2);

      // instructions
      ctx.fillStyle = COL.dimText;
      ctx.font = '14px monospace';
      const instructions = [
        'Arrow Keys / WASD  -  Move',
        'Mouse Click  -  Send sound pulse',
        'Find gems, avoid enemies, reach the exit',
        'Enemies FREEZE when illuminated, but hunt in darkness',
      ];
      instructions.forEach((line, i) => {
        ctx.fillText(line, W / 2, H / 2 + 50 + i * 24);
      });

      // blink "click to start"
      const blink = Math.sin(t * 3) * 0.4 + 0.6;
      ctx.fillStyle = `rgba(234,179,8,${blink})`;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('Click to Start', W / 2, H / 2 + 180);
    }

    function drawPlaying() {
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, W, H);

      // ── draw revealed tiles ──
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const b = revealMap[r][c];
          if (b <= 0.01) continue;
          const x = c * TILE;
          const y = r * TILE;
          if (lvl.walls[r][c] === 1) {
            // wall
            const grey = Math.floor(34 * b);
            ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
            ctx.fillRect(x, y, TILE, TILE);
            // yellow edge tint
            ctx.strokeStyle = `rgba(234,179,8,${b * 0.5})`;
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
          } else {
            // floor — very subtle reveal
            const floorBright = Math.floor(12 * b);
            ctx.fillStyle = `rgb(${floorBright},${floorBright},${Math.floor(floorBright * 1.1)})`;
            ctx.fillRect(x, y, TILE, TILE);
          }
        }
      }

      // ── draw exit (if revealed) ──
      {
        const eb = getBrightness(exitX, exitY);
        if (eb > 0.05) {
          const pulse = Math.sin(exitPulse) * 0.3 + 0.7;
          const eAlpha = eb * pulse;
          ctx.fillStyle = `rgba(51,255,51,${eAlpha})`;
          ctx.beginPath();
          ctx.roundRect(exitX - 10, exitY - 12, 20, 24, 4);
          ctx.fill();
          // glow
          const grad = ctx.createRadialGradient(
            exitX,
            exitY,
            0,
            exitX,
            exitY,
            24,
          );
          grad.addColorStop(0, `rgba(51,255,51,${eAlpha * 0.4})`);
          grad.addColorStop(1, 'rgba(51,255,51,0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(exitX, exitY, 24, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // ── draw gems ──
      for (const g of gems) {
        if (g.collected) continue;
        const gb = getBrightness(g.x, g.y);
        if (gb < 0.05) continue;
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = `rgba(255,215,0,${gb})`;
        ctx.fillRect(-6, -6, 12, 12);
        // sparkle
        const sp = Math.sin(g.sparklePhase) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,255,200,${gb * sp * 0.8})`;
        ctx.fillRect(-3, -3, 6, 6);
        ctx.restore();
        // sparkle rays
        if (gb > 0.3) {
          const rayAlpha = gb * sp * 0.4;
          ctx.strokeStyle = `rgba(255,215,0,${rayAlpha})`;
          ctx.lineWidth = 1;
          for (let a = 0; a < 4; a++) {
            const angle = (a * Math.PI) / 2 + g.sparklePhase * 0.5;
            ctx.beginPath();
            ctx.moveTo(
              g.x + Math.cos(angle) * 8,
              g.y + Math.sin(angle) * 8,
            );
            ctx.lineTo(
              g.x + Math.cos(angle) * 14,
              g.y + Math.sin(angle) * 14,
            );
            ctx.stroke();
          }
        }
      }

      // ── draw enemies ──
      for (const en of enemies) {
        if (!en.alive) continue;
        const eb = getBrightness(en.x, en.y);
        if (eb < 0.05) continue;
        ctx.save();
        ctx.translate(en.x, en.y);
        // face player
        const angle = Math.atan2(py - en.y, px - en.x);
        ctx.rotate(angle - Math.PI / 2);
        ctx.fillStyle = en.frozen
          ? `rgba(255,51,51,${eb * 0.5})`
          : `rgba(255,51,51,${eb})`;
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(-8, 8);
        ctx.lineTo(8, 8);
        ctx.closePath();
        ctx.fill();
        // eyes when frozen
        if (en.frozen && eb > 0.3) {
          ctx.fillStyle = `rgba(255,255,255,${eb})`;
          ctx.beginPath();
          ctx.arc(-3, -2, 2, 0, Math.PI * 2);
          ctx.arc(3, -2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // ── draw wave rings ──
      for (const w of waves) {
        ctx.beginPath();
        ctx.arc(w.cx, w.cy, w.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(234,179,8,${w.alpha * 0.7})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        // inner faint ring
        if (w.radius > 10) {
          ctx.beginPath();
          ctx.arc(w.cx, w.cy, w.radius - 6, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(234,179,8,${w.alpha * 0.2})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // ── draw player ──
      // ambient glow
      const pgGrad = ctx.createRadialGradient(px, py, 0, px, py, 30);
      pgGrad.addColorStop(0, 'rgba(234,179,8,0.18)');
      pgGrad.addColorStop(1, 'rgba(234,179,8,0)');
      ctx.fillStyle = pgGrad;
      ctx.beginPath();
      ctx.arc(px, py, 30, 0, Math.PI * 2);
      ctx.fill();

      // player dot
      ctx.fillStyle = COL.player;
      ctx.beginPath();
      ctx.arc(px, py, pRadius, 0, Math.PI * 2);
      ctx.fill();
      // bright centre
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();

      // ── HUD ──
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, W, 28);

      ctx.fillStyle = COL.hudText;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Level: ${level}`, 12, 18);
      ctx.fillText(`Score: ${score}`, 140, 18);

      // pulses
      ctx.textAlign = 'right';
      ctx.fillText(`Pulses: `, W - 14 * pulsesLeft - 10, 18);
      for (let i = 0; i < pulsesLeft; i++) {
        ctx.beginPath();
        ctx.arc(W - 20 - i * 14, 14, 4, 0, Math.PI * 2);
        ctx.strokeStyle = COL.wave;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // gems collected indicator
      ctx.textAlign = 'center';
      const gcText = `Gems: ${gems.filter((g) => g.collected).length}/${gems.length}`;
      ctx.fillStyle = COL.gem;
      ctx.fillText(gcText, W / 2 + 80, 18);
    }

    function drawGameOver(_t: number) {
      ctx.fillStyle = COL.bg;
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.fillStyle = COL.enemy;
      ctx.font = 'bold 44px monospace';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 80);

      ctx.fillStyle = COL.title;
      ctx.font = '22px monospace';
      ctx.fillText(goMessage, W / 2, H / 2 - 30);

      ctx.fillStyle = '#ffffff';
      ctx.font = '18px monospace';
      ctx.fillText(`Level Reached: ${goLevel}`, W / 2, H / 2 + 20);
      ctx.fillText(`Final Score: ${goScore}`, W / 2, H / 2 + 50);
      ctx.fillText(`Gems Collected: ${totalGemsCollected}`, W / 2, H / 2 + 80);

      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText(`Best: ${highScore}`, W / 2, H / 2 + 105);
      if (newHighScore) {
        ctx.fillStyle = COL.title;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('New High Score!', W / 2, H / 2 + 122);
      }

      const blink = Math.sin(_t * 3) * 0.4 + 0.6;
      ctx.fillStyle = `rgba(234,179,8,${blink})`;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('Click to Return to Menu', W / 2, H / 2 + 140);
    }

    function drawPausedOverlay() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', W / 2, H / 2 - 20);

      ctx.fillStyle = COL.title;
      ctx.globalAlpha = 0.8;
      ctx.font = '18px monospace';
      ctx.fillText('Press P to resume', W / 2, H / 2 + 30);
      ctx.globalAlpha = 1;
    }

    /* ── main loop ──────────────────────────────────────── */
    function loop(timestamp: number) {
      const dt = lastTime ? (timestamp - lastTime) / 1000 : 0.016;
      lastTime = timestamp;

      switch (state) {
        case 'menu':
          drawMenu(timestamp / 1000);
          break;
        case 'playing':
          if (!paused) {
            updatePlaying(dt);
          }
          if (state === 'playing') {
            drawPlaying();
            if (paused) {
              drawPausedOverlay();
            }
          } else if (state === 'gameover') {
            drawGameOver(timestamp / 1000);
          }
          break;
        case 'gameover':
          drawGameOver(timestamp / 1000);
          break;
      }

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);

    /* ── cleanup ─────────────────────────────────────────── */
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  );
}
