'use client';

import { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

interface LevelConfig {
  gridSize: number;
  numColors: number;
  par: number;
  lockedCells: { x: number; y: number; unlockColor: number }[];
}

const CANVAS_W = 800;
const CANVAS_H = 600;

const PALETTE = [
  '#ef4444', // Red      0
  '#f97316', // Orange   1
  '#eab308', // Yellow   2
  '#22c55e', // Green    3
  '#3b82f6', // Blue     4
  '#a855f7', // Purple   5
];

const PALETTE_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple'];

const CYAN = '#06b6d4';
const BG_DARK = '#0a0a0f';

// ---------------------------------------------------------------------------
// Level Definitions (5+)
// ---------------------------------------------------------------------------

const LEVELS: LevelConfig[] = [
  {
    gridSize: 14,
    numColors: 4,
    par: 20,
    lockedCells: [],
  },
  {
    gridSize: 14,
    numColors: 5,
    par: 22,
    lockedCells: [
      { x: 7, y: 7, unlockColor: 0 },
      { x: 6, y: 6, unlockColor: 0 },
    ],
  },
  {
    gridSize: 14,
    numColors: 6,
    par: 25,
    lockedCells: [
      { x: 3, y: 3, unlockColor: 1 },
      { x: 10, y: 10, unlockColor: 2 },
      { x: 3, y: 10, unlockColor: 3 },
      { x: 10, y: 3, unlockColor: 4 },
    ],
  },
  {
    gridSize: 14,
    numColors: 6,
    par: 23,
    lockedCells: [
      { x: 5, y: 5, unlockColor: 0 },
      { x: 8, y: 5, unlockColor: 1 },
      { x: 5, y: 8, unlockColor: 2 },
      { x: 8, y: 8, unlockColor: 3 },
      { x: 7, y: 7, unlockColor: 4 },
      { x: 6, y: 6, unlockColor: 5 },
    ],
  },
  {
    gridSize: 14,
    numColors: 6,
    par: 22,
    lockedCells: [
      { x: 0, y: 13, unlockColor: 0 },
      { x: 13, y: 0, unlockColor: 1 },
      { x: 13, y: 13, unlockColor: 2 },
      { x: 7, y: 0, unlockColor: 3 },
      { x: 0, y: 7, unlockColor: 4 },
      { x: 7, y: 7, unlockColor: 5 },
      { x: 4, y: 4, unlockColor: 0 },
      { x: 9, y: 9, unlockColor: 1 },
    ],
  },
  {
    gridSize: 14,
    numColors: 6,
    par: 20,
    lockedCells: [
      { x: 1, y: 1, unlockColor: 5 },
      { x: 12, y: 1, unlockColor: 4 },
      { x: 1, y: 12, unlockColor: 3 },
      { x: 12, y: 12, unlockColor: 2 },
      { x: 6, y: 6, unlockColor: 1 },
      { x: 7, y: 7, unlockColor: 0 },
      { x: 6, y: 7, unlockColor: 0 },
      { x: 7, y: 6, unlockColor: 1 },
      { x: 3, y: 3, unlockColor: 2 },
      { x: 10, y: 10, unlockColor: 3 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChromaFloodGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- State machine -------------------------------------------------
    type GameState = 'menu' | 'playing' | 'gameover';
    let state: GameState = 'menu';
    let paused = false;

    // --- Game variables ------------------------------------------------
    let currentLevel = 0;
    let grid: number[][] = [];
    let owned: boolean[][] = [];
    let locked: boolean[][] = [];
    let unlockColor: (number | -1)[][] = [];
    let absorbedColors: Set<number> = new Set(); // colors fully absorbed
    let moves = 0;
    let par = 0;
    let stars = 0;
    let totalScore = 0;
    let won = false;

    // Animation state
    let flashCells: { x: number; y: number; t: number }[] = [];
    const FLASH_DURATION = 0.35; // seconds
    let winTimeoutId: ReturnType<typeof setTimeout> | null = null;

    // Menu animation
    let menuBlocks: {
      x: number;
      y: number;
      w: number;
      h: number;
      color: string;
      vx: number;
      vy: number;
    }[] = [];
    const initMenuBlocks = () => {
      menuBlocks = [];
      for (let i = 0; i < 40; i++) {
        menuBlocks.push({
          x: Math.random() * CANVAS_W,
          y: Math.random() * CANVAS_H,
          w: 20 + Math.random() * 40,
          h: 20 + Math.random() * 40,
          color: PALETTE[Math.floor(Math.random() * 6)],
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
        });
      }
    };
    initMenuBlocks();

    // Layout constants (computed on level start)
    let cellSize = 0;
    let gridOffsetX = 0;
    let gridOffsetY = 0;
    const PALETTE_Y = 540;
    const PALETTE_RADIUS = 22;
    const PALETTE_GAP = 18;

    // Hover tracking
    let hoveredPaletteIdx = -1;
    let _mouseX = 0;
    let _mouseY = 0;

    // --- Helpers -------------------------------------------------------

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return { r, g, b };
    };

    const _lerpColor = (a: string, b: string, t: number): string => {
      const ca = hexToRgb(a);
      const cb = hexToRgb(b);
      const r = Math.round(ca.r + (cb.r - ca.r) * t);
      const g = Math.round(ca.g + (cb.g - ca.g) * t);
      const bl = Math.round(ca.b + (cb.b - ca.b) * t);
      return `rgb(${r},${g},${bl})`;
    };

    const brighten = (hex: string, amount: number): string => {
      const c = hexToRgb(hex);
      const r = Math.min(255, c.r + Math.round(amount * 255));
      const g = Math.min(255, c.g + Math.round(amount * 255));
      const b = Math.min(255, c.b + Math.round(amount * 255));
      return `rgb(${r},${g},${b})`;
    };

    const paletteButtonX = (idx: number, numColors: number): number => {
      const totalW = numColors * PALETTE_RADIUS * 2 + (numColors - 1) * PALETTE_GAP;
      const startX = CANVAS_W / 2 - totalW / 2 + PALETTE_RADIUS;
      return startX + idx * (PALETTE_RADIUS * 2 + PALETTE_GAP);
    };

    // --- Level initialization ------------------------------------------

    const startLevel = (levelIdx: number) => {
      const cfg = LEVELS[levelIdx];
      const gs = cfg.gridSize;
      par = cfg.par;
      moves = 0;
      won = false;
      flashCells = [];
      absorbedColors = new Set();

      // Init grid
      grid = [];
      owned = [];
      locked = [];
      unlockColor = [];
      for (let y = 0; y < gs; y++) {
        grid[y] = [];
        owned[y] = [];
        locked[y] = [];
        unlockColor[y] = [];
        for (let x = 0; x < gs; x++) {
          grid[y][x] = Math.floor(Math.random() * cfg.numColors);
          owned[y][x] = false;
          locked[y][x] = false;
          unlockColor[y][x] = -1;
        }
      }

      // Place locked cells
      for (const lc of cfg.lockedCells) {
        if (lc.x < gs && lc.y < gs) {
          locked[lc.y][lc.x] = true;
          unlockColor[lc.y][lc.x] = lc.unlockColor;
          // Bug fix: ensure locked cell's color is NOT the same as its unlockColor.
          // Otherwise the locked cell itself (unowned) counts as an unabsorbed cell
          // of that color, making the unlock condition impossible to satisfy.
          if (grid[lc.y][lc.x] === lc.unlockColor) {
            let newColor = grid[lc.y][lc.x];
            while (newColor === lc.unlockColor) {
              newColor = Math.floor(Math.random() * cfg.numColors);
            }
            grid[lc.y][lc.x] = newColor;
          }
        }
      }

      // Own top-left cell
      owned[0][0] = true;

      // Expand initial territory: absorb all connected same-color cells from (0,0)
      const startColor = grid[0][0];
      const queue: [number, number][] = [[0, 0]];
      const visited = new Set<string>();
      visited.add('0,0');
      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        const dirs = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gs || ny >= gs) continue;
          const key = `${nx},${ny}`;
          if (visited.has(key)) continue;
          visited.add(key);
          if (grid[ny][nx] === startColor && !locked[ny][nx]) {
            owned[ny][nx] = true;
            queue.push([nx, ny]);
          }
        }
      }

      // Layout
      const hudHeight = 50;
      const paletteHeight = 70;
      const availH = CANVAS_H - hudHeight - paletteHeight - 20;
      const availW = CANVAS_W - 80;
      cellSize = Math.floor(Math.min(availW / gs, availH / gs));
      gridOffsetX = Math.floor((CANVAS_W - gs * cellSize) / 2);
      gridOffsetY = hudHeight + Math.floor((availH - gs * cellSize) / 2) + 10;

      state = 'playing';
    };

    // --- Flood fill ----------------------------------------------------

    const doFlood = (chosenColor: number) => {
      const cfg = LEVELS[currentLevel];
      const gs = cfg.gridSize;
      if (won) return;

      // Current territory color
      const currentColor = grid[0][0]; // territory always shares one color
      if (chosenColor === currentColor) return; // no-op

      moves++;

      // Set all owned cells to the new color
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          if (owned[y][x]) {
            grid[y][x] = chosenColor;
          }
        }
      }

      // Check if any color is now fully absorbed (no cells of that color remain outside territory)
      // We track this for unlock conditions
      const colorCounts = new Array(6).fill(0);
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          if (!owned[y][x]) {
            colorCounts[grid[y][x]]++;
          }
        }
      }
      for (let c = 0; c < 6; c++) {
        if (colorCounts[c] === 0) {
          absorbedColors.add(c);
        }
      }

      // Unlock locked cells whose condition is met
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          if (locked[y][x] && unlockColor[y][x] !== -1) {
            if (absorbedColors.has(unlockColor[y][x])) {
              locked[y][x] = false;
            }
          }
        }
      }

      // BFS from all owned cells to absorb adjacent cells of chosenColor
      const newCells: { x: number; y: number }[] = [];
      const queue: [number, number][] = [];
      const visited = new Set<string>();

      // Seed BFS with all owned cells
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          if (owned[y][x]) {
            queue.push([x, y]);
            visited.add(`${x},${y}`);
          }
        }
      }

      while (queue.length > 0) {
        const [cx, cy] = queue.shift()!;
        const dirs = [
          [0, 1],
          [0, -1],
          [1, 0],
          [-1, 0],
        ];
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= gs || ny >= gs) continue;
          const key = `${nx},${ny}`;
          if (visited.has(key)) continue;
          visited.add(key);
          if (locked[ny][nx]) continue;
          if (grid[ny][nx] === chosenColor) {
            owned[ny][nx] = true;
            grid[ny][nx] = chosenColor;
            newCells.push({ x: nx, y: ny });
            queue.push([nx, ny]);
          }
        }
      }

      // Add flash animation for newly absorbed cells
      for (const c of newCells) {
        flashCells.push({ x: c.x, y: c.y, t: FLASH_DURATION });
      }

      // Check win condition: all non-locked cells owned
      let allOwned = true;
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          if (!owned[y][x]) {
            allOwned = false;
            break;
          }
        }
        if (!allOwned) break;
      }

      if (allOwned) {
        won = true;
        if (moves <= par - 3) stars = 3;
        else if (moves <= par) stars = 2;
        else stars = 1;

        const movesSaved = Math.max(0, par - moves);
        totalScore += stars * 100 + movesSaved * 25;

        winTimeoutId = setTimeout(() => {
          state = 'gameover';
          winTimeoutId = null;
        }, 600);
      }
    };

    // --- Drawing -------------------------------------------------------

    let lastTime = 0;

    const drawMenu = (dt: number) => {
      // Background
      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Animated color blocks
      for (const b of menuBlocks) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -b.w) b.x = CANVAS_W;
        if (b.x > CANVAS_W) b.x = -b.w;
        if (b.y < -b.h) b.y = CANVAS_H;
        if (b.y > CANVAS_H) b.y = -b.h;

        ctx.globalAlpha = 0.15;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.roundRect(b.x, b.y, b.w, b.h, 6);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Title
      ctx.fillStyle = CYAN;
      ctx.font = 'bold 56px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chroma Flood', CANVAS_W / 2, 180);

      // Subtle glow
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 30;
      ctx.fillText('Chroma Flood', CANVAS_W / 2, 180);
      ctx.shadowBlur = 0;

      // Instructions
      ctx.fillStyle = '#a0a0b0';
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText('Flood the board with one color!', CANVAS_W / 2, 260);

      // Color swatches decoration
      const swatchY = 320;
      for (let i = 0; i < 6; i++) {
        const sx = CANVAS_W / 2 - 150 + i * 60;
        ctx.fillStyle = PALETTE[i];
        ctx.beginPath();
        ctx.roundRect(sx, swatchY, 40, 40, 8);
        ctx.fill();
      }

      // Start prompt
      const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#ffffff';
      ctx.font = '24px system-ui, sans-serif';
      ctx.fillText('Click to Start', CANVAS_W / 2, 430);
      ctx.globalAlpha = 1;

      // Level info
      if (totalScore > 0) {
        ctx.fillStyle = '#888';
        ctx.font = '16px system-ui, sans-serif';
        ctx.fillText(`Total Score: ${totalScore}`, CANVAS_W / 2, 490);
      }
    };

    const drawPlaying = (dt: number) => {
      const cfg = LEVELS[currentLevel];
      const gs = cfg.gridSize;

      // Background
      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Grid background (white)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(
        gridOffsetX - 2,
        gridOffsetY - 2,
        gs * cellSize + 4,
        gs * cellSize + 4
      );

      // Update flash timers
      for (let i = flashCells.length - 1; i >= 0; i--) {
        flashCells[i].t -= dt;
        if (flashCells[i].t <= 0) {
          flashCells.splice(i, 1);
        }
      }

      // Build flash lookup
      const flashMap = new Map<string, number>();
      for (const fc of flashCells) {
        flashMap.set(`${fc.x},${fc.y}`, fc.t / FLASH_DURATION);
      }

      // Draw cells
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          const px = gridOffsetX + x * cellSize;
          const py = gridOffsetY + y * cellSize;
          const colorIdx = grid[y][x];
          let color = PALETTE[colorIdx];

          // Flash effect
          const flashT = flashMap.get(`${x},${y}`);
          if (flashT !== undefined) {
            color = brighten(color, flashT * 0.5);
          }

          // Owned glow effect
          if (owned[y][x] && !flashT) {
            color = brighten(color, 0.05);
          }

          ctx.fillStyle = color;
          ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);

          // Locked cell pattern: diagonal lines
          if (locked[y][x]) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(px + 1, py + 1, cellSize - 2, cellSize - 2);
            ctx.clip();

            ctx.strokeStyle = 'rgba(0,0,0,0.4)';
            ctx.lineWidth = 1.5;
            const step = 6;
            for (let d = -cellSize; d < cellSize * 2; d += step) {
              ctx.beginPath();
              ctx.moveTo(px + d, py);
              ctx.lineTo(px + d + cellSize, py + cellSize);
              ctx.stroke();
            }

            // Lock icon in center
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            const lockSize = Math.min(cellSize * 0.4, 12);
            const lcx = px + cellSize / 2;
            const lcy = py + cellSize / 2;

            // Lock body
            ctx.beginPath();
            ctx.roundRect(
              lcx - lockSize / 2,
              lcy - lockSize / 4,
              lockSize,
              lockSize * 0.7,
              2
            );
            ctx.fill();

            // Lock shackle
            ctx.beginPath();
            ctx.arc(lcx, lcy - lockSize / 4, lockSize / 3, Math.PI, 0);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.stroke();

            ctx.restore();
          }

          // Owned territory subtle border glow
          if (owned[y][x]) {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
          }
        }
      }

      // HUD
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Level ${currentLevel + 1}`, 30, 25);

      ctx.textAlign = 'center';
      ctx.fillText(`Moves: ${moves}`, CANVAS_W / 2, 25);

      ctx.textAlign = 'right';
      ctx.fillStyle = moves <= par ? '#22c55e' : '#ef4444';
      ctx.fillText(`Par: ${par}`, CANVAS_W - 30, 25);

      // Count owned cells for progress
      let ownedCount = 0;
      const totalCells = gs * gs;
      for (let y = 0; y < gs; y++) {
        for (let x = 0; x < gs; x++) {
          if (owned[y][x]) ownedCount++;
        }
      }
      const progress = ownedCount / totalCells;

      // Progress bar
      const barW = 200;
      const barH = 6;
      const barX = CANVAS_W / 2 - barW / 2;
      const barY = 42;
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 3);
      ctx.fill();
      ctx.fillStyle = CYAN;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * progress, barH, 3);
      ctx.fill();

      // Color palette
      const numColors = cfg.numColors;
      const currentTerritoryColor = grid[0][0];

      for (let i = 0; i < numColors; i++) {
        const bx = paletteButtonX(i, numColors);
        const by = PALETTE_Y;
        const isCurrentColor = i === currentTerritoryColor;
        const isHovered = i === hoveredPaletteIdx;

        // Outer ring for hover
        if (isHovered && !isCurrentColor) {
          ctx.beginPath();
          ctx.arc(bx, by, PALETTE_RADIUS + 4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fill();
        }

        // Main circle
        ctx.beginPath();
        ctx.arc(bx, by, isHovered ? PALETTE_RADIUS + 2 : PALETTE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = isCurrentColor ? brighten(PALETTE[i], -0.3) : PALETTE[i];
        ctx.fill();

        // Border
        ctx.strokeStyle = isCurrentColor ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = isCurrentColor ? 3 : 1.5;
        ctx.stroke();

        // Dim current color
        if (isCurrentColor) {
          ctx.beginPath();
          ctx.arc(bx, by, PALETTE_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fill();

          // Checkmark
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(bx - 7, by);
          ctx.lineTo(bx - 2, by + 6);
          ctx.lineTo(bx + 8, by - 6);
          ctx.stroke();
        }
      }

      // Palette label
      ctx.fillStyle = '#666';
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Choose a color to flood', CANVAS_W / 2, PALETTE_Y + PALETTE_RADIUS + 20);

      // Unlock hint if there are locked cells
      const lockedCount = locked.flat().filter(Boolean).length;
      if (lockedCount > 0) {
        ctx.fillStyle = '#888';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';

        // Find the next locked cell unlock condition
        for (let y = 0; y < gs; y++) {
          for (let x = 0; x < gs; x++) {
            if (locked[y][x] && unlockColor[y][x] !== -1) {
              const uc = unlockColor[y][x];
              ctx.fillText(
                `Locked cells (${lockedCount}): absorb all ${PALETTE_NAMES[uc]} to unlock`,
                30,
                CANVAS_H - 10
              );
              return; // only show first hint
            }
          }
        }
      }
    };

    const drawGameOver = () => {
      ctx.fillStyle = BG_DARK;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Panel
      const panelW = 420;
      const panelH = 380;
      const panelX = (CANVAS_W - panelW) / 2;
      const panelY = (CANVAS_H - panelH) / 2;

      ctx.fillStyle = '#1a1a2e';
      ctx.beginPath();
      ctx.roundRect(panelX, panelY, panelW, panelH, 16);
      ctx.fill();
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Title
      ctx.fillStyle = CYAN;
      ctx.font = 'bold 32px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Level Complete!', CANVAS_W / 2, panelY + 50);

      // Stars
      const starY = panelY + 110;
      for (let i = 0; i < 3; i++) {
        const sx = CANVAS_W / 2 - 60 + i * 60;
        drawStar(ctx, sx, starY, i < stars ? '#eab308' : '#333', 20);
      }

      // Stats
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillStyle = '#ccc';
      ctx.fillText(`Moves: ${moves}  /  Par: ${par}`, CANVAS_W / 2, panelY + 170);

      const diff = moves - par;
      if (diff <= 0) {
        ctx.fillStyle = '#22c55e';
        ctx.fillText(
          diff === 0 ? 'Right on par!' : `${Math.abs(diff)} under par!`,
          CANVAS_W / 2,
          panelY + 205
        );
      } else {
        ctx.fillStyle = '#ef4444';
        ctx.fillText(`${diff} over par`, CANVAS_W / 2, panelY + 205);
      }

      ctx.fillStyle = '#aaa';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(`Total Score: ${totalScore}`, CANVAS_W / 2, panelY + 245);

      // Buttons
      const btnY = panelY + 305;
      const hasNextLevel = currentLevel < LEVELS.length - 1;

      if (hasNextLevel) {
        // Next Level button
        ctx.fillStyle = CYAN;
        ctx.beginPath();
        ctx.roundRect(CANVAS_W / 2 - 90, btnY - 20, 180, 44, 10);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText('Next Level', CANVAS_W / 2, btnY + 2);
      }

      // Play Again (below or in place of Next Level)
      const playAgainY = hasNextLevel ? btnY + 45 : btnY;
      ctx.fillStyle = '#666';
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(hasNextLevel ? 'or click here to Replay' : '', CANVAS_W / 2, playAgainY + 2);

      if (!hasNextLevel) {
        ctx.fillStyle = CYAN;
        ctx.beginPath();
        ctx.roundRect(CANVAS_W / 2 - 90, btnY - 20, 180, 44, 10);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText('Play Again', CANVAS_W / 2, btnY + 2);
      }
    };

    const drawStar = (
      c: CanvasRenderingContext2D,
      x: number,
      y: number,
      color: string,
      r: number
    ) => {
      c.fillStyle = color;
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        const outerX = x + r * Math.cos(angle);
        const outerY = y + r * Math.sin(angle);
        if (i === 0) c.moveTo(outerX, outerY);
        else c.lineTo(outerX, outerY);

        const innerAngle = angle + Math.PI / 5;
        const innerR = r * 0.4;
        c.lineTo(x + innerR * Math.cos(innerAngle), y + innerR * Math.sin(innerAngle));
      }
      c.closePath();
      c.fill();

      // Border
      c.strokeStyle = color === '#333' ? '#555' : '#d4a017';
      c.lineWidth = 1.5;
      c.stroke();
    };

    // --- Main loop -----------------------------------------------------

    const drawPausedOverlay = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 20);

      ctx.fillStyle = CYAN;
      ctx.globalAlpha = 0.8;
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText('Press P to resume', CANVAS_W / 2, CANVAS_H / 2 + 30);
      ctx.globalAlpha = 1;
    };

    const gameLoop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      // Clear
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      switch (state) {
        case 'menu':
          drawMenu(dt);
          break;
        case 'playing':
          drawPlaying(paused ? 0 : dt);
          if (paused) {
            drawPausedOverlay();
          }
          break;
        case 'gameover':
          drawGameOver();
          break;
      }

      rafId = requestAnimationFrame(gameLoop);
    };

    let rafId = requestAnimationFrame(gameLoop);

    // --- Input handling ------------------------------------------------

    const getCanvasCoords = (e: MouseEvent): { cx: number; cy: number } => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      return {
        cx: (e.clientX - rect.left) * scaleX,
        cy: (e.clientY - rect.top) * scaleY,
      };
    };

    const getTouchCanvasCoords = (touch: Touch): { cx: number; cy: number } => {
      const rect = canvas.getBoundingClientRect();
      const scaleX = CANVAS_W / rect.width;
      const scaleY = CANVAS_H / rect.height;
      return {
        cx: (touch.clientX - rect.left) * scaleX,
        cy: (touch.clientY - rect.top) * scaleY,
      };
    };

    const handleClick = (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);

      switch (state) {
        case 'menu':
          currentLevel = 0;
          totalScore = 0;
          startLevel(currentLevel);
          break;

        case 'playing': {
          if (paused) break;
          const cfg = LEVELS[currentLevel];
          const numColors = cfg.numColors;
          // Check palette clicks
          for (let i = 0; i < numColors; i++) {
            const bx = paletteButtonX(i, numColors);
            const by = PALETTE_Y;
            const dist = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2);
            if (dist <= PALETTE_RADIUS + 4) {
              doFlood(i);
              break;
            }
          }
          break;
        }

        case 'gameover': {
          const hasNextLevel = currentLevel < LEVELS.length - 1;
          const panelH = 380;
          const panelY = (CANVAS_H - panelH) / 2;
          const btnY = panelY + 305;

          if (hasNextLevel) {
            // Next Level button
            if (
              cx >= CANVAS_W / 2 - 90 &&
              cx <= CANVAS_W / 2 + 90 &&
              cy >= btnY - 20 &&
              cy <= btnY + 24
            ) {
              currentLevel++;
              startLevel(currentLevel);
            }
            // Replay text
            if (cy >= btnY + 30 && cy <= btnY + 60) {
              startLevel(currentLevel);
            }
          } else {
            // Play Again button
            if (
              cx >= CANVAS_W / 2 - 90 &&
              cx <= CANVAS_W / 2 + 90 &&
              cy >= btnY - 20 &&
              cy <= btnY + 24
            ) {
              currentLevel = 0;
              totalScore = 0;
              state = 'menu';
              initMenuBlocks();
            }
          }
          break;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const { cx, cy } = getCanvasCoords(e);
      _mouseX = cx;
      _mouseY = cy;

      if (state === 'playing') {
        const cfg = LEVELS[currentLevel];
        hoveredPaletteIdx = -1;
        for (let i = 0; i < cfg.numColors; i++) {
          const bx = paletteButtonX(i, cfg.numColors);
          const by = PALETTE_Y;
          const dist = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2);
          if (dist <= PALETTE_RADIUS + 4) {
            hoveredPaletteIdx = i;
            canvas.style.cursor = 'pointer';
            return;
          }
        }
        canvas.style.cursor = 'default';
      } else if (state === 'menu') {
        canvas.style.cursor = 'pointer';
      } else if (state === 'gameover') {
        const panelH = 380;
        const panelY = (CANVAS_H - panelH) / 2;
        const btnY = panelY + 305;
        if (
          cx >= CANVAS_W / 2 - 90 &&
          cx <= CANVAS_W / 2 + 90 &&
          cy >= btnY - 20 &&
          cy <= btnY + 24
        ) {
          canvas.style.cursor = 'pointer';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const { cx, cy } = getTouchCanvasCoords(e.touches[0]);

      switch (state) {
        case 'menu':
          currentLevel = 0;
          totalScore = 0;
          startLevel(currentLevel);
          break;

        case 'playing': {
          if (paused) break;
          const cfg = LEVELS[currentLevel];
          const numColors = cfg.numColors;
          // Check palette touches
          for (let i = 0; i < numColors; i++) {
            const bx = paletteButtonX(i, numColors);
            const by = PALETTE_Y;
            const dist = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2);
            if (dist <= PALETTE_RADIUS + 4) {
              doFlood(i);
              break;
            }
          }
          break;
        }

        case 'gameover': {
          const hasNextLevel = currentLevel < LEVELS.length - 1;
          const panelH = 380;
          const panelY = (CANVAS_H - panelH) / 2;
          const btnY = panelY + 305;

          if (hasNextLevel) {
            // Next Level button
            if (
              cx >= CANVAS_W / 2 - 90 &&
              cx <= CANVAS_W / 2 + 90 &&
              cy >= btnY - 20 &&
              cy <= btnY + 24
            ) {
              currentLevel++;
              startLevel(currentLevel);
            }
            // Replay text
            if (cy >= btnY + 30 && cy <= btnY + 60) {
              startLevel(currentLevel);
            }
          } else {
            // Play Again button
            if (
              cx >= CANVAS_W / 2 - 90 &&
              cx <= CANVAS_W / 2 + 90 &&
              cy >= btnY - 20 &&
              cy <= btnY + 24
            ) {
              currentLevel = 0;
              totalScore = 0;
              state = 'menu';
              initMenuBlocks();
            }
          }
          break;
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Pause toggle
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && state === 'playing') {
        paused = !paused;
        return;
      }

      // Number key color shortcuts (1-6) during playing state
      if (state === 'playing' && !paused && !won) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 6) {
          const colorIdx = num - 1;
          const cfg = LEVELS[currentLevel];
          if (colorIdx < cfg.numColors) {
            doFlood(colorIdx);
          }
        }
      }
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    // --- Cleanup -------------------------------------------------------

    return () => {
      cancelAnimationFrame(rafId);
      if (winTimeoutId !== null) {
        clearTimeout(winTimeoutId);
      }
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: CANVAS_W,
        height: 'auto',
        margin: '0 auto',
        borderRadius: 12,
        boxShadow: '0 0 40px rgba(6, 182, 212, 0.15)',
      }}
    />
  );
}
