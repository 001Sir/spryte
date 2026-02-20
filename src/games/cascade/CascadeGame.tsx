'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd } from '@/lib/game-events';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 800;
const H = 600;
const COLS = 8;
const ROWS = 12;
const CELL_SIZE = 40;
const GRID_X = (W - COLS * CELL_SIZE) / 2; // centered horizontally
const GRID_Y = H - ROWS * CELL_SIZE - 30; // 30px bottom margin
const AMBER = '#f59e0b';
const AMBER_DIM = '#b45309';
const AMBER_GLOW = '#fbbf24';
const BG = '#0a0a0f';
const BG_GRID = '#111118';
const GRID_LINE = '#1e1e2a';

// Number colors by digit (1-indexed, 0 unused)
const NUM_COLORS: Record<number, string> = {
  1: '#3b82f6', // blue
  2: '#22c55e', // green
  3: '#eab308', // yellow
  4: '#f97316', // orange
  5: '#ef4444', // red
  6: '#a855f7', // purple
  7: '#ec4899', // pink
  8: '#06b6d4', // cyan
  9: '#f1f5f9', // white
};

// Weighted random: favour middle numbers
const NUM_WEIGHTS: number[] = [
  /* 1 */ 6,
  /* 2 */ 9,
  /* 3 */ 12,
  /* 4 */ 16,
  /* 5 */ 18,
  /* 6 */ 16,
  /* 7 */ 12,
  /* 8 */ 9,
  /* 9 */ 6,
];
const TOTAL_WEIGHT = NUM_WEIGHTS.reduce((a, b) => a + b, 0);

type GameState = 'menu' | 'playing' | 'gameover';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
  size: number;
}

interface CascadeAnim {
  col: number;
  fromRow: number;
  toRow: number;
  value: number;
  progress: number; // 0..1
}

interface ExplosionCell {
  col: number;
  row: number;
  value: number;
  progress: number; // 0..1, used for flash/shrink anim
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function weightedRandomNum(): number {
  let r = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < 9; i++) {
    r -= NUM_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 5;
}

function cellCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: GRID_X + col * CELL_SIZE + CELL_SIZE / 2,
    y: GRID_Y + row * CELL_SIZE + CELL_SIZE / 2,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CascadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let destroyed = false;
    let animId = 0;

    // -----------------------------------------------------------------------
    // Game State (all mutable, inside useEffect)
    // -----------------------------------------------------------------------

    let state: GameState = 'menu';
    let paused = false;

    // Grid: 0 = empty, 1-9 = number
    const grid: number[][] = [];
    for (let c = 0; c < COLS; c++) {
      grid[c] = new Array(ROWS).fill(0);
    }

    // Current falling piece
    let curNum = 0;
    let curCol = Math.floor(COLS / 2);
    let nextNum = 0;
    let thenNum = 0; // 2-ahead preview

    // Drop / auto-fall timing
    let dropTimer = 0;
    let dropInterval = 1.0; // seconds per auto-drop step
    let baseDropInterval = 1.0;

    // Scoring
    let score = 0;
    let highScore = getHighScore('cascade');
    let totalCleared = 0;
    let currentChain = 0;
    let bestChain = 0;
    let piecesPlaced = 0;

    // Animations
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];
    let cascadeAnims: CascadeAnim[] = [];
    let explosionAnims: ExplosionCell[] = [];

    // Chain display
    let chainDisplayTimer = 0; // how long to show "CHAIN xN"
    let chainDisplayLevel = 0;

    // Screen shake
    let shakeAmount = 0;
    let shakeTimer = 0;

    // Phase management for matching/cascading
    let phase: 'idle' | 'exploding' | 'cascading' | 'settling' = 'idle';
    let phaseTimer = 0;

    // Matched cells to be removed (set during exploding phase)
    let matchedCells: { col: number; row: number }[] = [];

    // Time tracking
    let lastTime = 0;
    let gameTime = 0;

    // Menu animation
    let menuTime = 0;

    // Visual preview column highlight
    let hoverCol = -1;

    // Danger warning throttle
    let lastDangerSoundTime = 0;

    // -----------------------------------------------------------------------
    // Utility: grid operations
    // -----------------------------------------------------------------------

    function clearGrid() {
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          grid[c][r] = 0;
        }
      }
    }

    function getTopRow(col: number): number {
      // Returns the row index of the first filled cell in this column,
      // or ROWS if column is empty
      for (let r = 0; r < ROWS; r++) {
        if (grid[col][r] !== 0) return r;
      }
      return ROWS;
    }

    function isColumnFull(col: number): boolean {
      return grid[col][0] !== 0;
    }

    // -----------------------------------------------------------------------
    // Number generation
    // -----------------------------------------------------------------------

    function generateNum(): number {
      return weightedRandomNum();
    }

    function spawnPiece() {
      curNum = nextNum || generateNum();
      nextNum = thenNum || generateNum();
      thenNum = generateNum();
      curCol = Math.floor(COLS / 2);
      dropTimer = 0;
    }

    // -----------------------------------------------------------------------
    // Matching logic
    // -----------------------------------------------------------------------

    function findMatches(): { col: number; row: number }[] {
      const matched = new Set<string>();

      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (grid[c][r] === 0) continue;

          // Check right neighbor
          if (c + 1 < COLS && grid[c + 1][r] !== 0) {
            if (grid[c][r] + grid[c + 1][r] === 10) {
              matched.add(`${c},${r}`);
              matched.add(`${c + 1},${r}`);
            }
          }

          // Check bottom neighbor
          if (r + 1 < ROWS && grid[c][r + 1] !== 0) {
            if (grid[c][r] + grid[c][r + 1] === 10) {
              matched.add(`${c},${r}`);
              matched.add(`${c},${r + 1}`);
            }
          }
        }
      }

      return Array.from(matched).map((s) => {
        const [col, row] = s.split(',').map(Number);
        return { col, row };
      });
    }

    // -----------------------------------------------------------------------
    // Cascade: after clearing, drop numbers down
    // -----------------------------------------------------------------------

    function applyCascade(): boolean {
      let anyCascaded = false;
      cascadeAnims = [];

      for (let c = 0; c < COLS; c++) {
        // Compact downward
        let writeRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
          if (grid[c][r] !== 0) {
            if (writeRow !== r) {
              // This cell needs to move down
              cascadeAnims.push({
                col: c,
                fromRow: r,
                toRow: writeRow,
                value: grid[c][r],
                progress: 0,
              });
              grid[c][writeRow] = grid[c][r];
              grid[c][r] = 0;
              anyCascaded = true;
            }
            writeRow--;
          }
        }
      }

      return anyCascaded;
    }

    // -----------------------------------------------------------------------
    // Check for full row clears
    // -----------------------------------------------------------------------

    function checkRowClears(): number {
      let rowsCleared = 0;
      for (let r = 0; r < ROWS; r++) {
        let full = true;
        for (let c = 0; c < COLS; c++) {
          if (grid[c][r] === 0) {
            full = false;
            break;
          }
        }
        if (full) {
          // Clear this row
          for (let c = 0; c < COLS; c++) {
            const center = cellCenter(c, r);
            spawnExplosionParticles(center.x, center.y, NUM_COLORS[grid[c][r]] || AMBER, 6);
            grid[c][r] = 0;
          }
          rowsCleared++;
        }
      }
      return rowsCleared;
    }

    // -----------------------------------------------------------------------
    // Drop piece into column
    // -----------------------------------------------------------------------

    function dropPiece(col: number) {
      if (phase !== 'idle') return;
      if (col < 0 || col >= COLS) return;

      const landRow = getTopRow(col) - 1;
      if (landRow < 0) {
        // Column is full — game over
        triggerGameOver();
        return;
      }

      grid[col][landRow] = curNum;
      piecesPlaced++;
      SoundEngine.play('cascadeLand');

      // Small particle burst at landing
      const center = cellCenter(col, landRow);
      spawnExplosionParticles(center.x, center.y, NUM_COLORS[curNum] || AMBER, 4);

      // Start match checking
      currentChain = 0;
      startMatchPhase();
    }

    function startMatchPhase() {
      // First check for row clears
      const rowsCleared = checkRowClears();
      if (rowsCleared > 0) {
        score += rowsCleared * 100 * Math.pow(2, currentChain);
        SoundEngine.play('levelComplete');
        addFloatingText(W / 2, H / 2, `ROW CLEAR +${rowsCleared * 100}`, '#06b6d4', 32);
      }

      // Then check for sum-to-10 matches
      const matches = findMatches();
      if (matches.length > 0) {
        matchedCells = matches;
        phase = 'exploding';
        phaseTimer = 0;

        // Set up explosion animations
        explosionAnims = matches.map((m) => ({
          col: m.col,
          row: m.row,
          value: grid[m.col][m.row],
          progress: 0,
        }));

        currentChain++;
        if (currentChain > bestChain) bestChain = currentChain;

        // Score
        const chainMultiplier = Math.pow(2, currentChain - 1);
        const points = matches.length * 10 * chainMultiplier;
        score += points;
        totalCleared += matches.length;

        // Sound — use dedicated cascade sounds
        if (currentChain >= 3) {
          SoundEngine.play('cascadeChain');
          SoundEngine.play('streakRise');
        } else if (currentChain >= 2) {
          SoundEngine.play('cascadeChain');
        } else {
          SoundEngine.play('cascadeMatch');
        }

        // Chain display — show "MATCH!" for chain 1, "CHAIN xN!" for chain >= 2
        chainDisplayLevel = currentChain;
        chainDisplayTimer = currentChain >= 2 ? 2.0 : 1.2;
        if (currentChain >= 2) {
          addFloatingText(
            W / 2,
            GRID_Y - 30,
            `CHAIN x${Math.pow(2, currentChain - 1)}!`,
            currentChain >= 4 ? '#ef4444' : currentChain >= 3 ? '#f97316' : AMBER,
            currentChain >= 4 ? 40 : currentChain >= 3 ? 34 : 28
          );
        }

        // Floating score — vary color and size by chain level
        const avgX = matches.reduce((s, m) => s + cellCenter(m.col, m.row).x, 0) / matches.length;
        const avgY = matches.reduce((s, m) => s + cellCenter(m.col, m.row).y, 0) / matches.length;
        const scoreColor =
          currentChain >= 4 ? '#ef4444' :
          currentChain >= 3 ? '#fb923c' :
          currentChain >= 2 ? '#f97316' :
          AMBER_GLOW;
        const scoreSize =
          currentChain >= 4 ? 34 :
          currentChain >= 3 ? 28 :
          currentChain >= 2 ? 24 :
          20;
        addFloatingText(avgX, avgY, `+${points}`, scoreColor, scoreSize);

        // Screen shake — small for single match, big for chains
        shakeAmount = currentChain >= 2 ? Math.min(currentChain * 3, 15) : 2;
        shakeTimer = currentChain >= 2 ? 0.3 : 0.15;
      } else if (rowsCleared > 0) {
        // Rows cleared but no matches — cascade then re-check
        phase = 'cascading';
        phaseTimer = 0;
        applyCascade();
      } else {
        // No matches, no row clears — finish turn
        finishTurn();
      }
    }

    function finishTurn() {
      phase = 'idle';

      // Update drop speed based on pieces placed
      const speedFactor = Math.min(piecesPlaced / 150, 1);
      baseDropInterval = lerp(1.0, 0.25, speedFactor);
      dropInterval = baseDropInterval;

      // Check game over — can we still place?
      let allFull = true;
      for (let c = 0; c < COLS; c++) {
        if (!isColumnFull(c)) {
          allFull = false;
          break;
        }
      }
      if (allFull) {
        triggerGameOver();
        return;
      }

      spawnPiece();
    }

    // -----------------------------------------------------------------------
    // Game over
    // -----------------------------------------------------------------------

    function triggerGameOver() {
      state = 'gameover';
      SoundEngine.play('gameOver');
      reportGameEnd('cascade', score, false);

      if (score > highScore) {
        highScore = score;
        setHighScore('cascade', score);
        SoundEngine.play('newHighScore');
        addFloatingText(W / 2, H / 2 - 60, 'NEW HIGH SCORE!', '#fbbf24', 36);
      }

      SoundEngine.stopAmbient();
    }

    // -----------------------------------------------------------------------
    // Particles & visual effects
    // -----------------------------------------------------------------------

    function spawnExplosionParticles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 60 + Math.random() * 120;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.6 + Math.random() * 0.4,
          maxLife: 0.6 + Math.random() * 0.4,
          color,
          size: 2 + Math.random() * 4,
        });
      }
    }

    function addFloatingText(
      x: number,
      y: number,
      text: string,
      color: string,
      size: number
    ) {
      floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1.5,
        maxLife: 1.5,
        vy: -40,
        size,
      });
    }

    // -----------------------------------------------------------------------
    // Start game
    // -----------------------------------------------------------------------

    function startGame() {
      clearGrid();
      score = 0;
      totalCleared = 0;
      currentChain = 0;
      bestChain = 0;
      piecesPlaced = 0;
      particles = [];
      floatingTexts = [];
      cascadeAnims = [];
      explosionAnims = [];
      phase = 'idle';
      dropTimer = 0;
      baseDropInterval = 1.0;
      dropInterval = 1.0;
      chainDisplayTimer = 0;
      shakeAmount = 0;
      shakeTimer = 0;
      paused = false;
      gameTime = 0;
      highScore = getHighScore('cascade');

      nextNum = generateNum();
      thenNum = generateNum();
      spawnPiece();

      state = 'playing';
      reportGameStart('cascade');
      SoundEngine.startAmbient('colorful-puzzle');
    }

    // -----------------------------------------------------------------------
    // Input
    // -----------------------------------------------------------------------

    function handleKeyDown(e: KeyboardEvent) {
      if (state === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          SoundEngine.play('click');
          startGame();
        }
        return;
      }

      if (state === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          SoundEngine.play('click');
          state = 'menu';
        }
        return;
      }

      // Playing state
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        e.preventDefault();
        paused = !paused;
        SoundEngine.play('click');
        return;
      }

      if (paused) return;
      if (phase !== 'idle') return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          if (curCol > 0) curCol--;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          if (curCol < COLS - 1) curCol++;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
        case ' ':
          e.preventDefault();
          dropPiece(curCol);
          break;
      }
    }

    function getColFromX(clientX: number): number {
      if (!canvas) return 0;
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const canvasX = (clientX - rect.left) * scaleX;
      const col = Math.floor((canvasX - GRID_X) / CELL_SIZE);
      return Math.max(0, Math.min(COLS - 1, col));
    }

    function handleMouseMove(e: MouseEvent) {
      if (state !== 'playing' || paused || phase !== 'idle') {
        hoverCol = -1;
        return;
      }
      hoverCol = getColFromX(e.clientX);
      curCol = hoverCol;
    }

    function handleClick(e: MouseEvent) {
      if (state === 'menu') {
        SoundEngine.play('click');
        startGame();
        return;
      }
      if (state === 'gameover') {
        SoundEngine.play('click');
        state = 'menu';
        return;
      }
      if (state === 'playing' && !paused && phase === 'idle') {
        const col = getColFromX(e.clientX);
        curCol = col;
        dropPiece(col);
      }
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const touch = e.touches[0];
      if (state === 'menu') {
        SoundEngine.play('click');
        startGame();
        return;
      }
      if (state === 'gameover') {
        SoundEngine.play('click');
        state = 'menu';
        return;
      }
      if (state === 'playing' && !paused && phase === 'idle') {
        const col = getColFromX(touch.clientX);
        curCol = col;
        dropPiece(col);
      }
    }

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    // -----------------------------------------------------------------------
    // Update
    // -----------------------------------------------------------------------

    function update(dt: number) {
      if (state !== 'playing' || paused) return;

      gameTime += dt;

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt; // gravity
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

      // Chain display timer
      if (chainDisplayTimer > 0) {
        chainDisplayTimer -= dt;
      }

      // Screen shake
      if (shakeTimer > 0) {
        shakeTimer -= dt;
        if (shakeTimer <= 0) {
          shakeAmount = 0;
        }
      }

      // Phase management
      if (phase === 'exploding') {
        phaseTimer += dt;

        // Animate explosions
        for (const ea of explosionAnims) {
          ea.progress = Math.min(phaseTimer / 0.35, 1);
        }

        if (phaseTimer >= 0.4) {
          // Remove matched cells from grid
          for (const mc of matchedCells) {
            const center = cellCenter(mc.col, mc.row);
            spawnExplosionParticles(
              center.x,
              center.y,
              NUM_COLORS[grid[mc.col][mc.row]] || AMBER,
              8
            );
            grid[mc.col][mc.row] = 0;
          }
          matchedCells = [];
          explosionAnims = [];

          // Start cascade
          phase = 'cascading';
          phaseTimer = 0;
          applyCascade();
        }
      } else if (phase === 'cascading') {
        phaseTimer += dt;

        // Animate cascades
        let allDone = true;
        for (const ca of cascadeAnims) {
          ca.progress = Math.min(phaseTimer / 0.25, 1);
          if (ca.progress < 1) allDone = false;
        }

        if (allDone || cascadeAnims.length === 0) {
          cascadeAnims = [];
          phase = 'settling';
          phaseTimer = 0;
        }
      } else if (phase === 'settling') {
        phaseTimer += dt;
        if (phaseTimer >= 0.05) {
          // Re-check for matches
          startMatchPhase();
        }
      } else if (phase === 'idle') {
        // Check for danger columns (nearly full) and play warning sound
        let hasDanger = false;
        for (let c = 0; c < COLS; c++) {
          if (getTopRow(c) <= 2) {
            hasDanger = true;
            break;
          }
        }
        if (hasDanger && gameTime - lastDangerSoundTime >= 2.0) {
          lastDangerSoundTime = gameTime;
          SoundEngine.play('tickWarning');
        }

        // Auto-drop timer — adds Tetris-style time pressure
        dropTimer += dt;
        if (dropTimer >= dropInterval) {
          dropTimer = 0;
          dropPiece(curCol);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Draw
    // -----------------------------------------------------------------------

    function drawRoundedRect(
      x: number,
      y: number,
      w: number,
      h: number,
      r: number
    ) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
    }

    function drawNumber(
      num: number,
      cx: number,
      cy: number,
      size: number,
      alpha: number = 1,
      glowing: boolean = false
    ) {
      const color = NUM_COLORS[num] || '#ffffff';

      if (glowing) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(String(num), cx, cy);
        // Double draw for stronger glow
        ctx.fillText(String(num), cx, cy);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.fillText(String(num), cx, cy);
        ctx.restore();
      }
    }

    function drawCell(col: number, row: number, value: number, alpha: number = 1) {
      const x = GRID_X + col * CELL_SIZE;
      const y = GRID_Y + row * CELL_SIZE;
      const padding = 2;

      ctx.save();
      ctx.globalAlpha = alpha;

      // Cell background
      const color = NUM_COLORS[value] || '#ffffff';
      ctx.fillStyle = color + '18'; // very subtle tint
      drawRoundedRect(x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, 4);
      ctx.fill();

      // Cell border
      ctx.strokeStyle = color + '40';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // Number
      drawNumber(value, x + CELL_SIZE / 2, y + CELL_SIZE / 2, 22, alpha);
    }

    function drawGrid() {
      // Grid background
      ctx.fillStyle = BG_GRID;
      drawRoundedRect(GRID_X - 2, GRID_Y - 2, COLS * CELL_SIZE + 4, ROWS * CELL_SIZE + 4, 6);
      ctx.fill();

      // Grid lines
      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 0.5;
      for (let c = 0; c <= COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(GRID_X + c * CELL_SIZE, GRID_Y);
        ctx.lineTo(GRID_X + c * CELL_SIZE, GRID_Y + ROWS * CELL_SIZE);
        ctx.stroke();
      }
      for (let r = 0; r <= ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(GRID_X, GRID_Y + r * CELL_SIZE);
        ctx.lineTo(GRID_X + COLS * CELL_SIZE, GRID_Y + r * CELL_SIZE);
        ctx.stroke();
      }

      // Highlight column under cursor
      if (phase === 'idle' && hoverCol >= 0 && hoverCol < COLS) {
        ctx.fillStyle = AMBER + '0a';
        ctx.fillRect(
          GRID_X + hoverCol * CELL_SIZE,
          GRID_Y,
          CELL_SIZE,
          ROWS * CELL_SIZE
        );
      }

      // Draw cells — skip ones currently in cascade anim
      const cascadingSet = new Set<string>();
      for (const ca of cascadeAnims) {
        cascadingSet.add(`${ca.col},${ca.toRow}`);
      }

      // Also mark exploding cells
      const explodingSet = new Set<string>();
      for (const ea of explosionAnims) {
        explodingSet.add(`${ea.col},${ea.row}`);
      }

      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (grid[c][r] === 0) continue;
          const key = `${c},${r}`;

          if (explodingSet.has(key)) {
            // Draw with explosion animation
            const ea = explosionAnims.find((e) => e.col === c && e.row === r)!;
            const p = ea.progress;

            // Flash white then shrink and fade
            const x = GRID_X + c * CELL_SIZE;
            const y = GRID_Y + r * CELL_SIZE;
            const padding = 2;

            ctx.save();
            if (p < 0.3) {
              // White flash
              const flashAlpha = 1 - p / 0.3;
              ctx.globalAlpha = flashAlpha;
              ctx.fillStyle = '#ffffff';
              drawRoundedRect(
                x + padding,
                y + padding,
                CELL_SIZE - padding * 2,
                CELL_SIZE - padding * 2,
                4
              );
              ctx.fill();
            }

            // Shrink and fade
            const scale = 1 - easeOutQuad(p);
            const alpha = 1 - p;
            ctx.globalAlpha = alpha;
            ctx.translate(x + CELL_SIZE / 2, y + CELL_SIZE / 2);
            ctx.scale(scale, scale);
            ctx.translate(-(x + CELL_SIZE / 2), -(y + CELL_SIZE / 2));

            const color = NUM_COLORS[ea.value] || '#ffffff';
            ctx.fillStyle = color + '30';
            drawRoundedRect(
              x + padding,
              y + padding,
              CELL_SIZE - padding * 2,
              CELL_SIZE - padding * 2,
              4
            );
            ctx.fill();

            drawNumber(ea.value, x + CELL_SIZE / 2, y + CELL_SIZE / 2, 22, alpha);
            ctx.restore();
            continue;
          }

          if (cascadingSet.has(key)) continue; // drawn separately

          drawCell(c, r, grid[c][r]);
        }
      }

      // Draw cascading pieces
      for (const ca of cascadeAnims) {
        const fromY = GRID_Y + ca.fromRow * CELL_SIZE;
        const toY = GRID_Y + ca.toRow * CELL_SIZE;
        const curY = lerp(fromY, toY, easeOutBounce(ca.progress));
        const x = GRID_X + ca.col * CELL_SIZE;
        const padding = 2;

        const color = NUM_COLORS[ca.value] || '#ffffff';
        ctx.fillStyle = color + '18';
        drawRoundedRect(
          x + padding,
          curY + padding,
          CELL_SIZE - padding * 2,
          CELL_SIZE - padding * 2,
          4
        );
        ctx.fill();
        ctx.strokeStyle = color + '40';
        ctx.lineWidth = 1;
        ctx.stroke();

        drawNumber(ca.value, x + CELL_SIZE / 2, curY + CELL_SIZE / 2, 22);
      }
    }

    function drawFallingPiece() {
      if (phase !== 'idle' || !curNum) return;

      // Draw ghost / preview in column
      const landRow = getTopRow(curCol) - 1;
      if (landRow < 0) return;

      // Ghost piece
      const ghostX = GRID_X + curCol * CELL_SIZE;
      const ghostY = GRID_Y + landRow * CELL_SIZE;
      const padding = 2;

      ctx.save();
      ctx.globalAlpha = 0.2;
      const color = NUM_COLORS[curNum] || '#ffffff';
      ctx.fillStyle = color + '30';
      drawRoundedRect(
        ghostX + padding,
        ghostY + padding,
        CELL_SIZE - padding * 2,
        CELL_SIZE - padding * 2,
        4
      );
      ctx.fill();
      ctx.strokeStyle = color + '60';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      drawNumber(curNum, ghostX + CELL_SIZE / 2, ghostY + CELL_SIZE / 2, 22, 0.3);

      // Drop line from top to landing
      ctx.save();
      ctx.strokeStyle = color + '15';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(ghostX + CELL_SIZE / 2, GRID_Y);
      ctx.lineTo(ghostX + CELL_SIZE / 2, ghostY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // Current piece above the grid
      const pieceY = GRID_Y - CELL_SIZE - 8;
      const pieceX = GRID_X + curCol * CELL_SIZE;

      // Glowing background
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = color + '25';
      drawRoundedRect(
        pieceX + padding,
        pieceY + padding,
        CELL_SIZE - padding * 2,
        CELL_SIZE - padding * 2,
        6
      );
      ctx.fill();
      ctx.strokeStyle = color + '80';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // Pulsing glow
      const pulse = 0.7 + 0.3 * Math.sin(gameTime * 4);
      drawNumber(curNum, pieceX + CELL_SIZE / 2, pieceY + CELL_SIZE / 2, 24, pulse, true);
    }

    function drawNextPiece() {
      if (!nextNum) return;

      // "NEXT" label position — right side of grid
      const boxX = GRID_X + COLS * CELL_SIZE + 20;
      const boxY = GRID_Y;

      ctx.save();
      ctx.fillStyle = '#888';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('NEXT', boxX + 25, boxY);

      // Box
      ctx.fillStyle = BG_GRID;
      drawRoundedRect(boxX, boxY, 50, 50, 6);
      ctx.fill();
      ctx.strokeStyle = GRID_LINE;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      drawNumber(nextNum, boxX + 25, boxY + 25, 22);

      // "THEN" — 2-ahead preview, smaller box below
      if (thenNum) {
        const thenBoxY = boxY + 60;

        ctx.save();
        ctx.fillStyle = '#666';
        ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('THEN', boxX + 25, thenBoxY);

        // Smaller box
        ctx.fillStyle = BG_GRID;
        drawRoundedRect(boxX + 7, thenBoxY, 36, 36, 5);
        ctx.fill();
        ctx.strokeStyle = GRID_LINE;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();

        drawNumber(thenNum, boxX + 25, thenBoxY + 18, 16, 0.7);
      }
    }

    function drawScorePanel() {
      // Left panel
      const px = 10;
      const py = GRID_Y;

      ctx.save();
      ctx.fillStyle = '#888';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      ctx.fillText('SCORE', px, py);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(score.toLocaleString(), px, py + 16);

      ctx.fillStyle = '#666';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('HIGH SCORE', px, py + 56);
      ctx.fillStyle = highScore > 0 ? '#aaa' : '#555';
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(highScore.toLocaleString(), px, py + 72);

      ctx.fillStyle = '#666';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('CLEARED', px, py + 106);
      ctx.fillStyle = '#aaa';
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(String(totalCleared), px, py + 122);

      ctx.fillStyle = '#666';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('BEST CHAIN', px, py + 156);
      ctx.fillStyle = bestChain >= 3 ? AMBER : '#aaa';
      ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(bestChain > 0 ? `x${Math.pow(2, bestChain - 1)}` : '-', px, py + 172);

      ctx.restore();
    }

    function drawSpeedIndicator() {
      // Speed bar on the right panel
      const boxX = GRID_X + COLS * CELL_SIZE + 20;
      const boxY = GRID_Y + 70;

      ctx.save();
      ctx.fillStyle = '#888';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('SPEED', boxX + 25, boxY);

      // Speed bar background
      const barW = 40;
      const barH = 100;
      const barX = boxX + 5;
      const barY = boxY + 18;
      ctx.fillStyle = '#1a1a24';
      drawRoundedRect(barX, barY, barW, barH, 4);
      ctx.fill();

      // Speed fill
      const speedPct = Math.min((1.0 - baseDropInterval + 0.25) / 0.75, 1);
      const fillH = barH * speedPct;
      const gradient = ctx.createLinearGradient(barX, barY + barH - fillH, barX, barY + barH);
      gradient.addColorStop(0, speedPct > 0.7 ? '#ef4444' : speedPct > 0.4 ? AMBER : '#22c55e');
      gradient.addColorStop(1, speedPct > 0.7 ? '#b91c1c' : speedPct > 0.4 ? AMBER_DIM : '#15803d');
      ctx.fillStyle = gradient;
      drawRoundedRect(barX + 2, barY + barH - fillH + 2, barW - 4, fillH - 4, 3);
      ctx.fill();

      ctx.restore();
    }

    function drawBestChainMeter() {
      // Show "BEST CHAIN: x{N}" on the right panel below speed indicator
      const boxX = GRID_X + COLS * CELL_SIZE + 20;
      const boxY = GRID_Y + 200;

      ctx.save();
      ctx.fillStyle = '#888';
      ctx.font = 'bold 12px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('BEST CHAIN', boxX + 25, boxY);

      const chainText = bestChain > 0 ? `x${Math.pow(2, bestChain - 1)}` : '-';
      ctx.fillStyle = bestChain >= 3 ? AMBER_GLOW : bestChain >= 2 ? AMBER : '#aaa';
      ctx.font = `bold ${bestChain >= 3 ? 22 : 18}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(chainText, boxX + 25, boxY + 16);

      // Also show current chain if active
      if (currentChain >= 1 && (phase === 'exploding' || phase === 'cascading' || phase === 'settling')) {
        ctx.fillStyle = '#666';
        ctx.font = 'bold 10px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('NOW', boxX + 25, boxY + 42);
        const nowColor = currentChain >= 3 ? '#ef4444' : currentChain >= 2 ? '#f97316' : AMBER;
        ctx.fillStyle = nowColor;
        ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
        ctx.fillText(`x${Math.pow(2, currentChain - 1)}`, boxX + 25, boxY + 56);
      }

      ctx.restore();
    }

    function drawParticles() {
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    function drawFloatingTexts() {
      for (const ft of floatingTexts) {
        const alpha = ft.life / ft.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${ft.size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = ft.color;
        ctx.shadowBlur = 10;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    function drawChainDisplay() {
      if (chainDisplayTimer <= 0) return;

      const alpha = Math.min(chainDisplayTimer / 0.5, 1);
      const scale = 1 + (1 - alpha) * 0.3;

      ctx.save();
      ctx.globalAlpha = alpha * 0.9;
      ctx.translate(W / 2, GRID_Y / 2);
      ctx.scale(scale, scale);

      // Chain 1 shows a small "MATCH!", chain 2+ shows "CHAIN xN!"
      const text = chainDisplayLevel <= 1
        ? 'MATCH!'
        : `CHAIN x${Math.pow(2, chainDisplayLevel - 1)}!`;
      const fontSize = chainDisplayLevel <= 1 ? 32 : 48;
      const color =
        chainDisplayLevel >= 5
          ? '#ef4444'
          : chainDisplayLevel >= 4
          ? '#f97316'
          : chainDisplayLevel >= 3
          ? AMBER
          : '#fbbf24';

      ctx.font = `bold ${fontSize}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = color;
      ctx.shadowBlur = chainDisplayLevel <= 1 ? 15 : 30;
      ctx.fillStyle = color;
      ctx.fillText(text, 0, 0);
      if (chainDisplayLevel >= 2) ctx.fillText(text, 0, 0); // double for stronger glow on chains
      ctx.restore();
    }

    function drawPauseOverlay() {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = AMBER;
      ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', W / 2, H / 2 - 20);

      ctx.fillStyle = '#888';
      ctx.font = '18px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Press P or Escape to resume', W / 2, H / 2 + 30);
      ctx.restore();
    }

    // -----------------------------------------------------------------------
    // Draw: Menu
    // -----------------------------------------------------------------------

    function drawMenuBackground() {
      // Animated falling numbers in the background
      const time = menuTime;
      ctx.save();
      for (let i = 0; i < 30; i++) {
        const x = ((i * 127 + 50) % W);
        const speed = 30 + (i * 17) % 40;
        const y = ((time * speed + i * 200) % (H + 100)) - 50;
        const num = (i % 9) + 1;
        const alpha = 0.08 + 0.04 * Math.sin(time + i);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = NUM_COLORS[num] || '#fff';
        ctx.font = `bold 28px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(num), x, y);
      }
      ctx.restore();
    }

    function drawMenu() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      drawMenuBackground();

      // Title
      const titlePulse = 1 + 0.03 * Math.sin(menuTime * 2);
      ctx.save();
      ctx.translate(W / 2, 160);
      ctx.scale(titlePulse, titlePulse);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 30;
      ctx.fillText('CASCADE', 0, 0);
      ctx.restore();

      // Subtitle
      ctx.save();
      ctx.fillStyle = '#aaa';
      ctx.font = '18px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Match adjacent numbers that sum to 10', W / 2, 220);
      ctx.restore();

      // Instructions
      const instructions = [
        'Arrow keys / A-D to move, Down / S / Space to drop',
        'Click or tap a column to drop instantly',
        'Adjacent numbers summing to 10 explode!',
        'Chain reactions multiply your score',
      ];

      ctx.save();
      ctx.fillStyle = '#777';
      ctx.font = '15px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < instructions.length; i++) {
        ctx.fillText(instructions[i], W / 2, 280 + i * 24);
      }
      ctx.restore();

      // Example: show 4 + 6 = 10
      const exX = W / 2 - 50;
      const exY = 400;
      ctx.save();
      ctx.globalAlpha = 0.8;
      drawNumber(4, exX, exY, 28);
      ctx.fillStyle = '#555';
      ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', exX + 35, exY);
      drawNumber(6, exX + 70, exY, 28);
      ctx.fillStyle = '#555';
      ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('=', exX + 105, exY);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('10', exX + 145, exY);

      // Explosion symbol
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('BOOM!', exX + 210, exY);
      ctx.restore();

      // Start prompt
      const promptAlpha = 0.5 + 0.5 * Math.sin(menuTime * 3);
      ctx.save();
      ctx.globalAlpha = promptAlpha;
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 22px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click or Press Enter to Start', W / 2, 480);
      ctx.restore();

      // High score
      if (highScore > 0) {
        ctx.save();
        ctx.fillStyle = '#666';
        ctx.font = '16px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`High Score: ${highScore.toLocaleString()}`, W / 2, 530);
        ctx.restore();
      }
    }

    // -----------------------------------------------------------------------
    // Draw: Game Over
    // -----------------------------------------------------------------------

    function drawGameOver() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Dim grid in background
      ctx.save();
      ctx.globalAlpha = 0.3;
      drawGrid();
      ctx.restore();

      // Overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, W, H);

      // Game Over title
      ctx.save();
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 56px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 20;
      ctx.fillText('GAME OVER', W / 2, 140);
      ctx.restore();

      // Stats
      const statsY = 220;
      const lineHeight = 42;

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Score
      ctx.fillStyle = '#888';
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('SCORE', W / 2, statsY);
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(score.toLocaleString(), W / 2, statsY + 32);

      // Numbers cleared
      ctx.fillStyle = '#888';
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('NUMBERS CLEARED', W / 2, statsY + lineHeight * 2);
      ctx.fillStyle = '#ccc';
      ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(String(totalCleared), W / 2, statsY + lineHeight * 2 + 24);

      // Best chain
      ctx.fillStyle = '#888';
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('BEST CHAIN', W / 2, statsY + lineHeight * 4);
      ctx.fillStyle = bestChain >= 3 ? AMBER : '#ccc';
      ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(
        bestChain > 0 ? `x${Math.pow(2, bestChain - 1)} (${bestChain} deep)` : 'None',
        W / 2,
        statsY + lineHeight * 4 + 24
      );

      // High score
      ctx.fillStyle = '#888';
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('HIGH SCORE', W / 2, statsY + lineHeight * 6);
      ctx.fillStyle = score >= highScore ? AMBER_GLOW : '#aaa';
      ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(highScore.toLocaleString(), W / 2, statsY + lineHeight * 6 + 24);

      if (score >= highScore && score > 0) {
        ctx.fillStyle = AMBER_GLOW;
        ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('NEW RECORD!', W / 2, statsY + lineHeight * 6 + 52);
      }

      ctx.restore();

      // Restart prompt
      const promptAlpha = 0.5 + 0.5 * Math.sin(gameTime * 3);
      ctx.save();
      ctx.globalAlpha = promptAlpha;
      ctx.fillStyle = AMBER;
      ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Click or Press Enter to Continue', W / 2, H - 60);
      ctx.restore();
    }

    // -----------------------------------------------------------------------
    // Draw: Playing
    // -----------------------------------------------------------------------

    function drawPlaying() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Apply screen shake
      if (shakeTimer > 0 && shakeAmount > 0) {
        const sx = (Math.random() - 0.5) * shakeAmount * 2;
        const sy = (Math.random() - 0.5) * shakeAmount * 2;
        ctx.save();
        ctx.translate(sx, sy);
      }

      // Draw danger zone indicators (top rows getting filled)
      drawDangerIndicators();

      drawGrid();
      drawFallingPiece();
      drawParticles();
      drawFloatingTexts();
      drawChainDisplay();
      drawNextPiece();
      drawScorePanel();
      drawSpeedIndicator();
      drawBestChainMeter();
      drawMatchHints();

      // Title bar
      ctx.save();
      ctx.fillStyle = AMBER + '80';
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('CASCADE', W / 2, 8);
      ctx.restore();

      // Controls hint at bottom
      ctx.save();
      ctx.fillStyle = '#444';
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('Arrow Keys / Click to drop  |  P to pause', W / 2, H - 6);
      ctx.restore();

      if (shakeTimer > 0 && shakeAmount > 0) {
        ctx.restore();
      }

      if (paused) {
        drawPauseOverlay();
      }
    }

    function drawDangerIndicators() {
      // Show red tint at top of columns that are getting full, with a pulsing overlay
      const dangerPulse = 0.5 + 0.5 * Math.sin(gameTime * 5);
      for (let c = 0; c < COLS; c++) {
        const topRow = getTopRow(c);
        if (topRow <= 2) {
          const danger = (3 - topRow) / 3;
          const x = GRID_X + c * CELL_SIZE;

          // Base gradient danger zone
          const gradient = ctx.createLinearGradient(x, GRID_Y, x, GRID_Y + CELL_SIZE * 3);
          gradient.addColorStop(0, `rgba(239, 68, 68, ${danger * 0.3})`);
          gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = gradient;
          ctx.fillRect(x, GRID_Y, CELL_SIZE, CELL_SIZE * 3);

          // Pulsing red overlay on the entire column
          ctx.save();
          ctx.globalAlpha = danger * 0.08 * dangerPulse;
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x, GRID_Y, CELL_SIZE, ROWS * CELL_SIZE);
          ctx.restore();
        }
      }
    }

    function drawMatchHints() {
      // Subtly highlight pairs that would match if the current piece were placed
      if (phase !== 'idle' || !curNum) return;

      const landRow = getTopRow(curCol) - 1;
      if (landRow < 0) return;

      // Check what would match if curNum were placed at (curCol, landRow)
      const neighbors = [
        { c: curCol - 1, r: landRow },
        { c: curCol + 1, r: landRow },
        { c: curCol, r: landRow - 1 },
        { c: curCol, r: landRow + 1 },
      ];

      for (const n of neighbors) {
        if (n.c < 0 || n.c >= COLS || n.r < 0 || n.r >= ROWS) continue;
        if (grid[n.c][n.r] === 0) continue;
        if (grid[n.c][n.r] + curNum === 10) {
          // Highlight this cell
          const x = GRID_X + n.c * CELL_SIZE;
          const y = GRID_Y + n.r * CELL_SIZE;
          const pulse = 0.15 + 0.1 * Math.sin(gameTime * 6);
          ctx.save();
          ctx.globalAlpha = pulse;
          ctx.fillStyle = AMBER_GLOW;
          drawRoundedRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2, 4);
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // -----------------------------------------------------------------------
    // Main render
    // -----------------------------------------------------------------------

    function draw() {
      switch (state) {
        case 'menu':
          drawMenu();
          break;
        case 'playing':
          drawPlaying();
          break;
        case 'gameover':
          drawGameOver();
          break;
      }
    }

    // -----------------------------------------------------------------------
    // Game loop
    // -----------------------------------------------------------------------

    function loop(timestamp: number) {
      if (destroyed) return;

      const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
      lastTime = timestamp;

      if (state === 'menu') {
        menuTime += dt;
      }

      if (state === 'gameover') {
        gameTime += dt;
        // Still update particles and floating texts
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 200 * dt;
          p.life -= dt;
          if (p.life <= 0) particles.splice(i, 1);
        }
        for (let i = floatingTexts.length - 1; i >= 0; i--) {
          const ft = floatingTexts[i];
          ft.y += ft.vy * dt;
          ft.life -= dt;
          if (ft.life <= 0) floatingTexts.splice(i, 1);
        }
      }

      update(dt);
      draw();

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);

    // -----------------------------------------------------------------------
    // Cleanup
    // -----------------------------------------------------------------------

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('keydown', handleKeyDown);
      SoundEngine.stopAmbient();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        width: '100%',
        maxWidth: W,
        display: 'block',
        margin: '0 auto',
      }}
    />
  );
}
