'use client';

import { useRef, useEffect } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd, reportLevelComplete } from '@/lib/game-events';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Vec2 {
  x: number;
  y: number;
}

interface Well {
  x: number;
  y: number;
  strength: number; // positive = attractor, negative = repulsor
  pulsePhase: number;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  angle: number;
  rotSpeed: number;
  vertices: Vec2[];
}

interface Star {
  x: number;
  y: number;
  collected: boolean;
  twinklePhase: number;
}

interface Wall {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LevelConfig {
  debris: { x: number; y: number; vx: number; vy: number }[];
  goal: Vec2;
  stars: Vec2[];
  walls: Wall[];
  particleStart: Vec2;
  particleDrift: Vec2;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  trail: Vec2[];
}

interface BackgroundStar {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
}

type GameState = 'menu' | 'playing' | 'levelComplete' | 'gameover';

// ─── Constants ───────────────────────────────────────────────────────────────

const W = 800;
const H = 600;
const PURPLE = '#7c3aed';
const PURPLE_DARK = '#5b21b6';
const PURPLE_LIGHT = '#a78bfa';
const BG_COLOR = '#0a0a0f';
const MAX_WELLS = 10;
const MIN_GRAVITY_DIST = 30;
const MAX_FORCE = 3.5;
const TRAIL_LENGTH = 25;
const GOAL_RADIUS = 28;
const PARTICLE_RADIUS = 5;
const DEBRIS_RADIUS = 14;
const WELL_CLICK_RADIUS = 22;
const WELL_STRENGTH_MIN = 40;
const WELL_STRENGTH_MAX = 200;
const WELL_STRENGTH_DEFAULT = 100;
const WELL_STRENGTH_STEP = 15;
const G_CONSTANT = 8000;

// ─── Level Definitions ──────────────────────────────────────────────────────

const LEVELS: LevelConfig[] = [
  // Level 1 — Simple introduction
  {
    particleStart: { x: 60, y: 300 },
    particleDrift: { x: 0.3, y: 0 },
    goal: { x: 720, y: 300 },
    debris: [
      { x: 400, y: 280, vx: 0, vy: 0.3 },
      { x: 400, y: 320, vx: 0, vy: -0.3 },
      { x: 550, y: 300, vx: 0, vy: 0.4 },
    ],
    stars: [
      { x: 250, y: 200 },
      { x: 500, y: 400 },
    ],
    walls: [],
  },
  // Level 2 — Vertical obstacle wall
  {
    particleStart: { x: 60, y: 300 },
    particleDrift: { x: 0.35, y: 0 },
    goal: { x: 720, y: 150 },
    debris: [
      { x: 350, y: 150, vx: 0.2, vy: 0.5 },
      { x: 350, y: 350, vx: -0.2, vy: -0.5 },
      { x: 550, y: 250, vx: 0, vy: 0.6 },
      { x: 600, y: 100, vx: 0.3, vy: 0.2 },
    ],
    stars: [
      { x: 200, y: 450 },
      { x: 400, y: 100 },
      { x: 600, y: 400 },
    ],
    walls: [
      { x: 380, y: 0, w: 16, h: 220 },
      { x: 380, y: 320, w: 16, h: 280 },
    ],
  },
  // Level 3 — Maze-like with walls
  {
    particleStart: { x: 60, y: 500 },
    particleDrift: { x: 0.25, y: -0.1 },
    goal: { x: 720, y: 80 },
    debris: [
      { x: 300, y: 400, vx: 0.3, vy: -0.3 },
      { x: 500, y: 200, vx: -0.3, vy: 0.4 },
      { x: 200, y: 200, vx: 0.2, vy: 0.2 },
      { x: 650, y: 350, vx: -0.1, vy: -0.5 },
    ],
    stars: [
      { x: 150, y: 300 },
      { x: 400, y: 500 },
      { x: 600, y: 150 },
    ],
    walls: [
      { x: 200, y: 150, w: 16, h: 300 },
      { x: 400, y: 100, w: 16, h: 250 },
      { x: 400, y: 430, w: 16, h: 170 },
      { x: 580, y: 0, w: 16, h: 250 },
      { x: 580, y: 350, w: 16, h: 100 },
    ],
  },
  // Level 4 — Gauntlet run
  {
    particleStart: { x: 60, y: 300 },
    particleDrift: { x: 0.4, y: 0 },
    goal: { x: 740, y: 300 },
    debris: [
      { x: 200, y: 200, vx: 0, vy: 0.8 },
      { x: 350, y: 400, vx: 0, vy: -0.8 },
      { x: 500, y: 180, vx: 0, vy: 0.7 },
      { x: 650, y: 420, vx: 0, vy: -0.7 },
      { x: 500, y: 300, vx: 0.5, vy: 0 },
    ],
    stars: [
      { x: 150, y: 150 },
      { x: 300, y: 450 },
      { x: 450, y: 150 },
      { x: 600, y: 450 },
    ],
    walls: [
      { x: 0, y: 120, w: 760, h: 12 },
      { x: 40, y: 468, w: 760, h: 12 },
    ],
  },
  // Level 5 — The labyrinth
  {
    particleStart: { x: 60, y: 550 },
    particleDrift: { x: 0.2, y: -0.05 },
    goal: { x: 720, y: 50 },
    debris: [
      { x: 150, y: 350, vx: 0.4, vy: -0.2 },
      { x: 400, y: 150, vx: -0.3, vy: 0.5 },
      { x: 600, y: 400, vx: 0.2, vy: -0.6 },
      { x: 300, y: 500, vx: 0.5, vy: -0.1 },
      { x: 550, y: 250, vx: -0.4, vy: 0.3 },
    ],
    stars: [
      { x: 100, y: 200 },
      { x: 350, y: 350 },
      { x: 550, y: 100 },
      { x: 700, y: 450 },
    ],
    walls: [
      { x: 130, y: 0, w: 14, h: 420 },
      { x: 270, y: 180, w: 14, h: 420 },
      { x: 420, y: 0, w: 14, h: 350 },
      { x: 420, y: 430, w: 14, h: 170 },
      { x: 560, y: 200, w: 14, h: 400 },
      { x: 680, y: 0, w: 14, h: 350 },
    ],
  },
  // Level 6 — Open field swarm
  {
    particleStart: { x: 400, y: 560 },
    particleDrift: { x: 0, y: -0.3 },
    goal: { x: 400, y: 40 },
    debris: [
      { x: 200, y: 300, vx: 0.6, vy: 0 },
      { x: 600, y: 300, vx: -0.6, vy: 0 },
      { x: 400, y: 200, vx: 0, vy: 0.5 },
      { x: 300, y: 400, vx: 0.4, vy: -0.4 },
      { x: 500, y: 400, vx: -0.4, vy: -0.4 },
    ],
    stars: [
      { x: 150, y: 150 },
      { x: 650, y: 150 },
      { x: 400, y: 350 },
    ],
    walls: [],
  },
  // Level 7 — The funnel
  {
    particleStart: { x: 60, y: 300 },
    particleDrift: { x: 0.35, y: 0 },
    goal: { x: 740, y: 300 },
    debris: [
      { x: 350, y: 250, vx: 0.2, vy: 0.6 },
      { x: 350, y: 350, vx: 0.2, vy: -0.6 },
      { x: 500, y: 280, vx: -0.3, vy: 0.3 },
      { x: 500, y: 320, vx: -0.3, vy: -0.3 },
      { x: 650, y: 300, vx: 0, vy: 0.4 },
    ],
    stars: [
      { x: 200, y: 100 },
      { x: 200, y: 500 },
      { x: 600, y: 100 },
      { x: 600, y: 500 },
    ],
    walls: [
      { x: 250, y: 0, w: 14, h: 180 },
      { x: 250, y: 420, w: 14, h: 180 },
      { x: 450, y: 0, w: 14, h: 230 },
      { x: 450, y: 370, w: 14, h: 230 },
      { x: 620, y: 0, w: 14, h: 260 },
      { x: 620, y: 340, w: 14, h: 260 },
    ],
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function GravityWellGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    let highScore = getHighScore('gravity-well');
    let newHighScore = false;

    // ─── Game State ─────────────────────────────────────────────────────

    let state: GameState = 'menu';
    let paused = false;
    let animId = 0;
    let time = 0;
    let levelIndex = 0;
    let score = 0;
    let levelStartTime = 0;
    let levelScore = 0;

    // Objects
    let particle: Particle = { x: 0, y: 0, vx: 0, vy: 0, trail: [] };
    let wells: Well[] = [];
    let debris: Debris[] = [];
    let stars: Star[] = [];
    let walls: Wall[] = [];
    let goalPos: Vec2 = { x: 0, y: 0 };
    let particleDrift: Vec2 = { x: 0, y: 0 };

    // Mouse
    let mouseX = 0;
    let mouseY = 0;
    let hoveredWellIndex = -1;

    // Cached bounding rect (avoid layout thrashing on every mouse/touch event)
    let cachedRect = canvas.getBoundingClientRect();

    // Background stars (visual only)
    const bgStars: BackgroundStar[] = [];
    for (let i = 0; i < 120; i++) {
      bgStars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        size: Math.random() * 1.8 + 0.3,
        alpha: Math.random() * 0.6 + 0.2,
        speed: Math.random() * 0.15 + 0.02,
      });
    }

    // Menu particles
    const menuParticles: { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number }[] = [];
    for (let i = 0; i < 50; i++) {
      menuParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        life: Math.random() * 200,
        maxLife: 200 + Math.random() * 200,
        size: Math.random() * 3 + 1,
      });
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    function dist(a: Vec2, b: Vec2): number {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }

    function generateIrregularShape(radius: number, numVertices: number): Vec2[] {
      const verts: Vec2[] = [];
      for (let i = 0; i < numVertices; i++) {
        const angle = (i / numVertices) * Math.PI * 2;
        const r = radius * (0.6 + Math.random() * 0.8);
        verts.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
      return verts;
    }

    function rectContains(r: Wall, px: number, py: number, pr: number): boolean {
      return (
        px + pr > r.x &&
        px - pr < r.x + r.w &&
        py + pr > r.y &&
        py - pr < r.y + r.h
      );
    }

    function resolveWallCollision(
      px: number, py: number, vx: number, vy: number, radius: number, wall: Wall
    ): { x: number; y: number; vx: number; vy: number } | null {
      if (!rectContains(wall, px, py, radius)) return null;

      // Find shortest overlap direction
      const overlapLeft = (px + radius) - wall.x;
      const overlapRight = (wall.x + wall.w) - (px - radius);
      const overlapTop = (py + radius) - wall.y;
      const overlapBottom = (wall.y + wall.h) - (py - radius);

      const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

      let nx = px, ny = py, nvx = vx, nvy = vy;
      const bounce = 0.5;

      if (minOverlap === overlapLeft) {
        nx = wall.x - radius;
        nvx = -Math.abs(vx) * bounce;
      } else if (minOverlap === overlapRight) {
        nx = wall.x + wall.w + radius;
        nvx = Math.abs(vx) * bounce;
      } else if (minOverlap === overlapTop) {
        ny = wall.y - radius;
        nvy = -Math.abs(vy) * bounce;
      } else {
        ny = wall.y + wall.h + radius;
        nvy = Math.abs(vy) * bounce;
      }

      return { x: nx, y: ny, vx: nvx, vy: nvy };
    }

    // ─── Level Setup ─────────────────────────────────────────────────────

    function loadLevel(idx: number) {
      const lvl = LEVELS[idx % LEVELS.length];
      particle = {
        x: lvl.particleStart.x,
        y: lvl.particleStart.y,
        vx: lvl.particleDrift.x,
        vy: lvl.particleDrift.y,
        trail: [],
      };
      particleDrift = { ...lvl.particleDrift };
      goalPos = { ...lvl.goal };
      wells = [];
      levelStartTime = time;

      debris = lvl.debris.map((d) => ({
        x: d.x,
        y: d.y,
        vx: d.vx,
        vy: d.vy,
        radius: DEBRIS_RADIUS,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        vertices: generateIrregularShape(DEBRIS_RADIUS, 7),
      }));

      stars = lvl.stars.map((s) => ({
        x: s.x,
        y: s.y,
        collected: false,
        twinklePhase: Math.random() * Math.PI * 2,
      }));

      walls = lvl.walls.map((w) => ({ ...w }));
    }

    // ─── Physics Update ──────────────────────────────────────────────────

    function applyGravity(
      obj: { x: number; y: number; vx: number; vy: number },
      dt: number
    ) {
      for (const well of wells) {
        const dx = well.x - obj.x;
        const dy = well.y - obj.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < MIN_GRAVITY_DIST) d = MIN_GRAVITY_DIST;

        const forceMag = (G_CONSTANT * (well.strength / WELL_STRENGTH_DEFAULT)) / (d * d);
        const clampedForce = Math.min(forceMag, MAX_FORCE);

        const nx = dx / d;
        const ny = dy / d;

        // Positive strength = attractor; negative = repulsor
        const sign = well.strength > 0 ? 1 : -1;
        obj.vx += nx * clampedForce * sign * dt;
        obj.vy += ny * clampedForce * sign * dt;
      }
    }

    function updateParticle(dt: number) {
      // Apply a gentle base drift force to keep it moving
      particle.vx += particleDrift.x * 0.01 * dt;
      particle.vy += particleDrift.y * 0.01 * dt;

      applyGravity(particle, dt);

      // Damping to prevent insane speeds
      const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
      if (speed > 6) {
        particle.vx = (particle.vx / speed) * 6;
        particle.vy = (particle.vy / speed) * 6;
      }

      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;

      // Wall collisions
      for (const wall of walls) {
        const result = resolveWallCollision(
          particle.x, particle.y, particle.vx, particle.vy, PARTICLE_RADIUS, wall
        );
        if (result) {
          particle.x = result.x;
          particle.y = result.y;
          particle.vx = result.vx;
          particle.vy = result.vy;
        }
      }

      // Boundary bounce
      if (particle.x < PARTICLE_RADIUS) {
        particle.x = PARTICLE_RADIUS;
        particle.vx = Math.abs(particle.vx) * 0.5;
      }
      if (particle.x > W - PARTICLE_RADIUS) {
        particle.x = W - PARTICLE_RADIUS;
        particle.vx = -Math.abs(particle.vx) * 0.5;
      }
      if (particle.y < PARTICLE_RADIUS) {
        particle.y = PARTICLE_RADIUS;
        particle.vy = Math.abs(particle.vy) * 0.5;
      }
      if (particle.y > H - PARTICLE_RADIUS) {
        particle.y = H - PARTICLE_RADIUS;
        particle.vy = -Math.abs(particle.vy) * 0.5;
      }

      // Trail
      particle.trail.push({ x: particle.x, y: particle.y });
      if (particle.trail.length > TRAIL_LENGTH) {
        particle.trail.shift();
      }
    }

    function updateDebris(dt: number) {
      for (const d of debris) {
        applyGravity(d, dt);

        // Damping
        const speed = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
        if (speed > 5) {
          d.vx = (d.vx / speed) * 5;
          d.vy = (d.vy / speed) * 5;
        }

        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.angle += d.rotSpeed * dt;

        // Wall collisions
        for (const wall of walls) {
          const result = resolveWallCollision(d.x, d.y, d.vx, d.vy, d.radius, wall);
          if (result) {
            d.x = result.x;
            d.y = result.y;
            d.vx = result.vx;
            d.vy = result.vy;
          }
        }

        // Boundary bounce
        if (d.x < d.radius) { d.x = d.radius; d.vx = Math.abs(d.vx) * 0.7; }
        if (d.x > W - d.radius) { d.x = W - d.radius; d.vx = -Math.abs(d.vx) * 0.7; }
        if (d.y < d.radius) { d.y = d.radius; d.vy = Math.abs(d.vy) * 0.7; }
        if (d.y > H - d.radius) { d.y = H - d.radius; d.vy = -Math.abs(d.vy) * 0.7; }
      }
    }

    function checkCollisions(): 'debris' | 'goal' | null {
      // Debris collision
      for (const d of debris) {
        if (dist(particle, d) < PARTICLE_RADIUS + d.radius) {
          return 'debris';
        }
      }
      // Goal collision
      if (dist(particle, goalPos) < PARTICLE_RADIUS + GOAL_RADIUS) {
        return 'goal';
      }
      // Star collection
      for (const s of stars) {
        if (!s.collected && dist(particle, s) < PARTICLE_RADIUS + 14) {
          s.collected = true;
          SoundEngine.play('collectStar');
        }
      }
      return null;
    }

    // ─── Drawing Helpers ─────────────────────────────────────────────────

    function drawBackground() {
      ctx!.fillStyle = BG_COLOR;
      ctx!.fillRect(0, 0, W, H);

      // Twinkling background stars
      for (const s of bgStars) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * 0.002 * s.speed * 20 + s.x);
        ctx!.globalAlpha = s.alpha * twinkle;
        ctx!.fillStyle = '#ffffff';
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function drawWalls() {
      for (const wall of walls) {
        const gradient = ctx!.createLinearGradient(wall.x, wall.y, wall.x + wall.w, wall.y + wall.h);
        gradient.addColorStop(0, '#2d1f5e');
        gradient.addColorStop(0.5, '#3b2d7a');
        gradient.addColorStop(1, '#2d1f5e');
        ctx!.fillStyle = gradient;
        ctx!.fillRect(wall.x, wall.y, wall.w, wall.h);

        // Glow border
        ctx!.strokeStyle = PURPLE;
        ctx!.lineWidth = 1;
        ctx!.globalAlpha = 0.5 + 0.2 * Math.sin(time * 0.003);
        ctx!.strokeRect(wall.x - 1, wall.y - 1, wall.w + 2, wall.h + 2);
        ctx!.globalAlpha = 1;
      }
    }

    function drawGoal() {
      const pulse = 0.7 + 0.3 * Math.sin(time * 0.004);
      const r = GOAL_RADIUS * (0.9 + 0.1 * Math.sin(time * 0.005));

      // Outer glow
      const grd = ctx!.createRadialGradient(goalPos.x, goalPos.y, r * 0.3, goalPos.x, goalPos.y, r * 2);
      grd.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
      grd.addColorStop(1, 'rgba(255, 215, 0, 0)');
      ctx!.fillStyle = grd;
      ctx!.beginPath();
      ctx!.arc(goalPos.x, goalPos.y, r * 2, 0, Math.PI * 2);
      ctx!.fill();

      // Ring
      ctx!.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx!.lineWidth = 3;
      ctx!.beginPath();
      ctx!.arc(goalPos.x, goalPos.y, r, 0, Math.PI * 2);
      ctx!.stroke();

      // Inner ring
      ctx!.strokeStyle = `rgba(255, 245, 150, ${pulse * 0.7})`;
      ctx!.lineWidth = 1.5;
      ctx!.beginPath();
      ctx!.arc(goalPos.x, goalPos.y, r * 0.6, 0, Math.PI * 2);
      ctx!.stroke();

      // Center dot
      ctx!.fillStyle = `rgba(255, 230, 100, ${pulse})`;
      ctx!.beginPath();
      ctx!.arc(goalPos.x, goalPos.y, 3, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawWells() {
      for (let i = 0; i < wells.length; i++) {
        const w = wells[i];
        const isHovered = i === hoveredWellIndex;
        const isAttractor = w.strength > 0;
        const baseColor = isAttractor ? PURPLE : '#3b82f6';
        const strengthRatio = Math.abs(w.strength) / WELL_STRENGTH_MAX;
        const maxRadius = 20 + strengthRatio * 40;

        w.pulsePhase += 0.04;

        // Concentric rings
        for (let ring = 3; ring >= 0; ring--) {
          const phase = (w.pulsePhase + ring * 0.8) % (Math.PI * 2);
          const ringProgress = (Math.sin(phase) + 1) / 2;
          const r = maxRadius * (0.3 + ringProgress * 0.7) * ((ring + 1) / 4);
          const alpha = 0.15 + 0.15 * (1 - ringProgress);

          ctx!.strokeStyle = baseColor;
          ctx!.globalAlpha = alpha * (isHovered ? 1.5 : 1);
          ctx!.lineWidth = isHovered ? 2 : 1.2;
          ctx!.beginPath();
          ctx!.arc(w.x, w.y, r, 0, Math.PI * 2);
          ctx!.stroke();
        }

        // Center glow
        const glowGrd = ctx!.createRadialGradient(w.x, w.y, 0, w.x, w.y, 12);
        glowGrd.addColorStop(0, isAttractor ? 'rgba(124, 58, 237, 0.8)' : 'rgba(59, 130, 246, 0.8)');
        glowGrd.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx!.globalAlpha = 1;
        ctx!.fillStyle = glowGrd;
        ctx!.beginPath();
        ctx!.arc(w.x, w.y, 12, 0, Math.PI * 2);
        ctx!.fill();

        // Center dot
        ctx!.fillStyle = isAttractor ? PURPLE_LIGHT : '#93c5fd';
        ctx!.beginPath();
        ctx!.arc(w.x, w.y, 3.5, 0, Math.PI * 2);
        ctx!.fill();

        // Icon: + for attractor, - for repulsor
        ctx!.fillStyle = '#ffffff';
        ctx!.font = 'bold 12px monospace';
        ctx!.textAlign = 'center';
        ctx!.textBaseline = 'middle';
        ctx!.fillText(isAttractor ? '+' : '-', w.x, w.y);

        // Hovered highlight
        if (isHovered) {
          ctx!.strokeStyle = '#ffffff';
          ctx!.globalAlpha = 0.4;
          ctx!.lineWidth = 1;
          ctx!.setLineDash([4, 4]);
          ctx!.beginPath();
          ctx!.arc(w.x, w.y, WELL_CLICK_RADIUS, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.setLineDash([]);
          ctx!.globalAlpha = 1;

          // Show strength label
          ctx!.fillStyle = '#ffffff';
          ctx!.globalAlpha = 0.8;
          ctx!.font = '10px monospace';
          ctx!.fillText(
            `${isAttractor ? 'ATT' : 'REP'} ${Math.round(Math.abs(w.strength))}`,
            w.x,
            w.y - maxRadius - 10
          );
          ctx!.globalAlpha = 1;
        }
      }
    }

    function drawParticle() {
      // Trail
      if (particle.trail.length > 1) {
        for (let i = 1; i < particle.trail.length; i++) {
          const alpha = i / particle.trail.length;
          const width = 1 + (i / particle.trail.length) * 3;
          ctx!.strokeStyle = `rgba(200, 200, 255, ${alpha * 0.6})`;
          ctx!.lineWidth = width;
          ctx!.beginPath();
          ctx!.moveTo(particle.trail[i - 1].x, particle.trail[i - 1].y);
          ctx!.lineTo(particle.trail[i].x, particle.trail[i].y);
          ctx!.stroke();
        }
      }

      // Glow
      const glowGrd = ctx!.createRadialGradient(
        particle.x, particle.y, 0,
        particle.x, particle.y, PARTICLE_RADIUS * 4
      );
      glowGrd.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      glowGrd.addColorStop(0.3, 'rgba(200, 200, 255, 0.2)');
      glowGrd.addColorStop(1, 'rgba(200, 200, 255, 0)');
      ctx!.fillStyle = glowGrd;
      ctx!.beginPath();
      ctx!.arc(particle.x, particle.y, PARTICLE_RADIUS * 4, 0, Math.PI * 2);
      ctx!.fill();

      // Core
      ctx!.fillStyle = '#ffffff';
      ctx!.beginPath();
      ctx!.arc(particle.x, particle.y, PARTICLE_RADIUS, 0, Math.PI * 2);
      ctx!.fill();

      // Inner bright spot
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx!.beginPath();
      ctx!.arc(particle.x - 1, particle.y - 1, PARTICLE_RADIUS * 0.4, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawDebris() {
      for (const d of debris) {
        ctx!.save();
        ctx!.translate(d.x, d.y);
        ctx!.rotate(d.angle);

        // Glow
        const glowGrd = ctx!.createRadialGradient(0, 0, d.radius * 0.3, 0, 0, d.radius * 1.5);
        glowGrd.addColorStop(0, 'rgba(255, 60, 60, 0.3)');
        glowGrd.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx!.fillStyle = glowGrd;
        ctx!.beginPath();
        ctx!.arc(0, 0, d.radius * 1.5, 0, Math.PI * 2);
        ctx!.fill();

        // Irregular shape
        ctx!.fillStyle = '#c0392b';
        ctx!.strokeStyle = '#e74c3c';
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.moveTo(d.vertices[0].x, d.vertices[0].y);
        for (let i = 1; i < d.vertices.length; i++) {
          ctx!.lineTo(d.vertices[i].x, d.vertices[i].y);
        }
        ctx!.closePath();
        ctx!.fill();
        ctx!.stroke();

        // Inner highlights
        ctx!.fillStyle = 'rgba(231, 76, 60, 0.6)';
        ctx!.beginPath();
        ctx!.arc(-2, -2, d.radius * 0.3, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.restore();
      }
    }

    function drawStars() {
      for (const s of stars) {
        if (s.collected) continue;
        s.twinklePhase += 0.05;
        const twinkle = 0.6 + 0.4 * Math.sin(s.twinklePhase);

        // Outer glow
        const glowGrd = ctx!.createRadialGradient(s.x, s.y, 0, s.x, s.y, 18);
        glowGrd.addColorStop(0, `rgba(255, 255, 100, ${0.3 * twinkle})`);
        glowGrd.addColorStop(1, 'rgba(255, 255, 0, 0)');
        ctx!.fillStyle = glowGrd;
        ctx!.beginPath();
        ctx!.arc(s.x, s.y, 18, 0, Math.PI * 2);
        ctx!.fill();

        // Star shape
        ctx!.fillStyle = `rgba(255, 255, 80, ${twinkle})`;
        ctx!.beginPath();
        for (let i = 0; i < 5; i++) {
          const outerAngle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const innerAngle = outerAngle + Math.PI / 5;
          const outerR = 8;
          const innerR = 3.5;
          if (i === 0) {
            ctx!.moveTo(s.x + Math.cos(outerAngle) * outerR, s.y + Math.sin(outerAngle) * outerR);
          } else {
            ctx!.lineTo(s.x + Math.cos(outerAngle) * outerR, s.y + Math.sin(outerAngle) * outerR);
          }
          ctx!.lineTo(s.x + Math.cos(innerAngle) * innerR, s.y + Math.sin(innerAngle) * innerR);
        }
        ctx!.closePath();
        ctx!.fill();

        // Sparkle cross
        ctx!.strokeStyle = `rgba(255, 255, 200, ${twinkle * 0.5})`;
        ctx!.lineWidth = 1;
        const sparkleSize = 12 * twinkle;
        ctx!.beginPath();
        ctx!.moveTo(s.x - sparkleSize, s.y);
        ctx!.lineTo(s.x + sparkleSize, s.y);
        ctx!.moveTo(s.x, s.y - sparkleSize);
        ctx!.lineTo(s.x, s.y + sparkleSize);
        ctx!.stroke();
      }
    }

    function drawHUD() {
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx!.fillRect(0, 0, W, 36);

      ctx!.font = '14px monospace';
      ctx!.textBaseline = 'middle';

      // Level
      ctx!.fillStyle = PURPLE_LIGHT;
      ctx!.textAlign = 'left';
      ctx!.fillText(`LEVEL ${levelIndex + 1} / ${LEVELS.length}`, 12, 18);

      // Score
      ctx!.fillStyle = '#ffd700';
      ctx!.textAlign = 'center';
      ctx!.fillText(`SCORE: ${score}`, W / 2, 18);

      // Wells remaining
      const wellsRemaining = MAX_WELLS - wells.length;
      ctx!.fillStyle = wellsRemaining > 3 ? PURPLE_LIGHT : wellsRemaining > 0 ? '#fbbf24' : '#ef4444';
      ctx!.textAlign = 'right';
      ctx!.fillText(`WELLS: ${wellsRemaining} / ${MAX_WELLS}`, W - 12, 18);

      // Instructions bar at bottom
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx!.fillRect(0, H - 24, W, 24);
      ctx!.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx!.font = '11px monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText(isTouchDevice
        ? 'TAP: Attractor | DOUBLE-TAP: Repulsor | TAP Well: Remove'
        : 'LEFT-CLICK: Place Attractor | RIGHT-CLICK: Place Repulsor | SCROLL: Adjust Strength | CLICK Well: Remove', W / 2, H - 10);
    }

    // ─── Screen Renderers ────────────────────────────────────────────────

    function drawMenuScreen() {
      drawBackground();

      // Animated menu particles
      for (const p of menuParticles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life += 1;

        if (p.life > p.maxLife || p.x < 0 || p.x > W || p.y < 0 || p.y > H) {
          p.x = Math.random() * W;
          p.y = Math.random() * H;
          p.vx = (Math.random() - 0.5) * 0.8;
          p.vy = (Math.random() - 0.5) * 0.8;
          p.life = 0;
        }

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.6;
        ctx!.fillStyle = `rgba(124, 58, 237, ${alpha})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Central gravity effect
      const centerPulse = 0.5 + 0.5 * Math.sin(time * 0.002);
      for (let ring = 4; ring >= 0; ring--) {
        const r = 80 + ring * 30 + centerPulse * 15;
        ctx!.strokeStyle = PURPLE;
        ctx!.globalAlpha = 0.08 + 0.04 * (4 - ring);
        ctx!.lineWidth = 1.5;
        ctx!.beginPath();
        ctx!.arc(W / 2, 240, r, 0, Math.PI * 2);
        ctx!.stroke();
      }
      ctx!.globalAlpha = 1;

      // Title
      ctx!.fillStyle = '#ffffff';
      ctx!.font = 'bold 56px monospace';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';

      // Title shadow
      ctx!.fillStyle = PURPLE_DARK;
      ctx!.fillText('GRAVITY WELL', W / 2 + 3, 243);

      ctx!.fillStyle = '#ffffff';
      ctx!.fillText('GRAVITY WELL', W / 2, 240);

      // Subtitle glow
      ctx!.fillStyle = PURPLE_LIGHT;
      ctx!.font = '16px monospace';
      ctx!.fillText('A cosmic puzzle of attraction and repulsion', W / 2, 290);

      // Instructions
      const instructions = isTouchDevice ? [
        'Guide the particle to the golden goal',
        'Tap to place attractors, Double-tap for repulsors',
        'Avoid red debris — wells affect them too!',
        'Collect stars for bonus points',
      ] : [
        'Guide the particle to the golden goal',
        'Left-click to place attractors, Right-click for repulsors',
        'Scroll to adjust well strength',
        'Avoid red debris — wells affect them too!',
        'Collect stars for bonus points',
      ];

      ctx!.font = '13px monospace';
      for (let i = 0; i < instructions.length; i++) {
        ctx!.fillStyle = `rgba(167, 139, 250, ${0.6 + 0.1 * Math.sin(time * 0.003 + i)})`;
        ctx!.fillText(instructions[i], W / 2, 370 + i * 24);
      }

      // Click to start
      const startAlpha = 0.5 + 0.5 * Math.sin(time * 0.005);
      ctx!.fillStyle = `rgba(255, 255, 255, ${startAlpha})`;
      ctx!.font = 'bold 20px monospace';
      ctx!.fillText(isTouchDevice ? '[ TAP TO START ]' : '[ CLICK TO START ]', W / 2, 530);
    }

    function drawLevelCompleteScreen() {
      drawBackground();
      drawWalls();
      drawGoal();
      drawWells();
      drawStars();
      drawDebris();
      drawParticle();

      // Overlay
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx!.fillRect(0, 0, W, H);

      // Success message
      const pulse = 0.8 + 0.2 * Math.sin(time * 0.005);
      ctx!.fillStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx!.font = 'bold 44px monospace';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText('LEVEL COMPLETE!', W / 2, 200);

      // Score breakdown
      ctx!.font = '18px monospace';
      ctx!.fillStyle = '#ffffff';

      const starsCollected = stars.filter((s) => s.collected).length;
      const timeBonus = Math.max(0, 500 - Math.floor((time - levelStartTime) / 60));
      const wellMultiplier = Math.max(1, 4 - wells.length);

      ctx!.fillText(`Stars Collected: ${starsCollected} x 200 = ${starsCollected * 200}`, W / 2, 280);
      ctx!.fillText(`Time Bonus: ${timeBonus}`, W / 2, 310);
      ctx!.fillText(`Well Efficiency: x${wellMultiplier} (${wells.length} wells used)`, W / 2, 340);

      ctx!.fillStyle = '#ffd700';
      ctx!.font = 'bold 24px monospace';
      ctx!.fillText(`Level Score: ${levelScore}`, W / 2, 390);
      ctx!.fillText(`Total Score: ${score}`, W / 2, 425);

      ctx!.fillStyle = '#aaaaaa';
      ctx!.font = '16px monospace';
      ctx!.fillText(`Best: ${highScore}`, W / 2, 458);
      if (newHighScore) {
        ctx!.fillStyle = PURPLE_LIGHT;
        ctx!.font = 'bold 16px monospace';
        ctx!.fillText('New High Score!', W / 2, 478);
      }

      const nextAlpha = 0.5 + 0.5 * Math.sin(time * 0.005);
      ctx!.fillStyle = `rgba(167, 139, 250, ${nextAlpha})`;
      ctx!.font = 'bold 18px monospace';
      if (levelIndex + 1 < LEVELS.length) {
        ctx!.fillText(isTouchDevice ? '[ TAP FOR NEXT LEVEL ]' : '[ CLICK FOR NEXT LEVEL ]', W / 2, 500);
      } else {
        ctx!.fillText(isTouchDevice ? '[ ALL LEVELS COMPLETE — TAP TO PLAY AGAIN ]' : '[ ALL LEVELS COMPLETE — CLICK TO PLAY AGAIN ]', W / 2, 500);
      }
    }

    function drawGameOverScreen() {
      drawBackground();
      drawWalls();
      drawGoal();
      drawWells();
      drawStars();
      drawDebris();
      drawParticle();

      // Overlay
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx!.fillRect(0, 0, W, H);

      // Explosion effect at particle position
      const expPhase = ((time % 120) / 120);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + time * 0.01;
        const r = expPhase * 60;
        ctx!.fillStyle = `rgba(255, 80, 60, ${0.6 * (1 - expPhase)})`;
        ctx!.beginPath();
        ctx!.arc(
          particle.x + Math.cos(angle) * r,
          particle.y + Math.sin(angle) * r,
          4 * (1 - expPhase),
          0,
          Math.PI * 2
        );
        ctx!.fill();
      }

      ctx!.fillStyle = '#ef4444';
      ctx!.font = 'bold 48px monospace';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText('GAME OVER', W / 2, 230);

      ctx!.fillStyle = '#ffffff';
      ctx!.font = '20px monospace';
      ctx!.fillText(`Final Score: ${score}`, W / 2, 300);
      ctx!.fillText(`Reached Level: ${levelIndex + 1}`, W / 2, 335);

      ctx!.fillStyle = '#aaaaaa';
      ctx!.font = '18px monospace';
      ctx!.fillText(`Best: ${highScore}`, W / 2, 370);
      if (newHighScore) {
        ctx!.fillStyle = PURPLE_LIGHT;
        ctx!.font = 'bold 18px monospace';
        ctx!.fillText('New High Score!', W / 2, 395);
      }

      const restartAlpha = 0.5 + 0.5 * Math.sin(time * 0.005);
      ctx!.fillStyle = `rgba(255, 255, 255, ${restartAlpha})`;
      ctx!.font = 'bold 20px monospace';
      ctx!.fillText(isTouchDevice ? '[ TAP TO RESTART ]' : '[ CLICK TO RESTART ]', W / 2, 450);
    }

    function drawPlayingScreen() {
      drawBackground();
      drawWalls();
      drawGoal();
      drawStars();
      drawWells();
      drawDebris();
      drawParticle();
      drawHUD();

      // Well placement preview when not hovering a well
      if (hoveredWellIndex === -1 && state === 'playing') {
        // Check if mouse is in HUD area
        if (mouseY > 36 && mouseY < H - 24) {
          ctx!.strokeStyle = 'rgba(124, 58, 237, 0.25)';
          ctx!.lineWidth = 1;
          ctx!.setLineDash([3, 5]);
          ctx!.beginPath();
          ctx!.arc(mouseX, mouseY, 18, 0, Math.PI * 2);
          ctx!.stroke();
          ctx!.setLineDash([]);

          // Small crosshair
          ctx!.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx!.lineWidth = 1;
          ctx!.beginPath();
          ctx!.moveTo(mouseX - 8, mouseY);
          ctx!.lineTo(mouseX + 8, mouseY);
          ctx!.moveTo(mouseX, mouseY - 8);
          ctx!.lineTo(mouseX, mouseY + 8);
          ctx!.stroke();
        }
      }
    }

    // ─── Main Game Loop ──────────────────────────────────────────────────

    function drawPausedOverlay() {
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx!.fillRect(0, 0, W, H);

      ctx!.fillStyle = '#ffffff';
      ctx!.font = 'bold 48px monospace';
      ctx!.textAlign = 'center';
      ctx!.textBaseline = 'middle';
      ctx!.fillText('PAUSED', W / 2, H / 2 - 20);

      ctx!.fillStyle = 'rgba(167, 139, 250, 0.8)';
      ctx!.font = '18px monospace';
      ctx!.fillText('Press P to resume', W / 2, H / 2 + 30);
    }

    function gameLoop() {
      time++;
      const dt = 1;

      if (state === 'menu') {
        drawMenuScreen();
      } else if (state === 'playing') {
        if (!paused) {
          updateParticle(dt);
          updateDebris(dt);

          const collision = checkCollisions();
          if (collision === 'debris') {
            if (score > highScore) { highScore = score; newHighScore = true; setHighScore('gravity-well', score); }
            state = 'gameover';
            reportGameEnd('gravity-well', score, true, levelIndex + 1);
            SoundEngine.stopAmbient();
            SoundEngine.play('gameOver');
          } else if (collision === 'goal') {
            // Calculate level score
            const starsCollected = stars.filter((s) => s.collected).length;
            const timeBonus = Math.max(0, 500 - Math.floor((time - levelStartTime) / 60));
            const wellMultiplier = Math.max(1, 4 - wells.length);
            levelScore = (1000 + starsCollected * 200 + timeBonus) * wellMultiplier;
            score += levelScore;
            state = 'levelComplete';
            reportLevelComplete('gravity-well', levelIndex + 1, score);
            SoundEngine.play('levelComplete');
          }

          // Update hovered well
          hoveredWellIndex = -1;
          for (let i = 0; i < wells.length; i++) {
            if (dist({ x: mouseX, y: mouseY }, wells[i]) < WELL_CLICK_RADIUS) {
              hoveredWellIndex = i;
              break;
            }
          }
        }

        drawPlayingScreen();
        if (paused) {
          drawPausedOverlay();
        }
      } else if (state === 'levelComplete') {
        drawLevelCompleteScreen();
      } else if (state === 'gameover') {
        drawGameOverScreen();
      }

      animId = requestAnimationFrame(gameLoop);
    }

    // ─── Input Handling ──────────────────────────────────────────────────

    function getCanvasCoords(e: MouseEvent): Vec2 {
      return {
        x: ((e.clientX - cachedRect.left) / cachedRect.width) * W,
        y: ((e.clientY - cachedRect.top) / cachedRect.height) * H,
      };
    }

    function getTouchCanvasCoords(touch: Touch): Vec2 {
      return {
        x: ((touch.clientX - cachedRect.left) / cachedRect.width) * W,
        y: ((touch.clientY - cachedRect.top) / cachedRect.height) * H,
      };
    }

    // Double-tap detection state for repulsor placement
    let lastTapTime = 0;
    let lastTapX = 0;
    let lastTapY = 0;

    function handleMouseMove(e: MouseEvent) {
      const coords = getCanvasCoords(e);
      mouseX = coords.x;
      mouseY = coords.y;
    }

    function handleClick(e: MouseEvent) {
      e.preventDefault();
      const coords = getCanvasCoords(e);

      if (state === 'menu') {
        state = 'playing';
        reportGameStart('gravity-well');
        SoundEngine.startAmbient('space-gravity');
        score = 0;
        newHighScore = false;
        levelIndex = 0;
        loadLevel(0);
        SoundEngine.play('menuSelect');
        return;
      }

      if (state === 'gameover') {
        state = 'playing';
        reportGameStart('gravity-well');
        SoundEngine.startAmbient('space-gravity');
        score = 0;
        newHighScore = false;
        levelIndex = 0;
        loadLevel(0);
        return;
      }

      if (state === 'levelComplete') {
        levelIndex++;
        if (levelIndex >= LEVELS.length) {
          if (score > highScore) { highScore = score; newHighScore = true; setHighScore('gravity-well', score); }
          levelIndex = 0;
          score = 0;
          newHighScore = false;
        }
        state = 'playing';
        loadLevel(levelIndex);
        return;
      }

      if (state === 'playing') {
        // Check if clicking on existing well to remove it
        for (let i = 0; i < wells.length; i++) {
          if (dist(coords, wells[i]) < WELL_CLICK_RADIUS) {
            wells.splice(i, 1);
            SoundEngine.play('wellRemove');
            hoveredWellIndex = -1;
            return;
          }
        }

        // Don't place wells in HUD areas
        if (coords.y < 36 || coords.y > H - 24) return;

        // Don't place if max wells reached
        if (wells.length >= MAX_WELLS) return;

        // Don't place wells on walls
        for (const wall of walls) {
          if (rectContains(wall, coords.x, coords.y, 10)) return;
        }

        // Place attractor (left click)
        wells.push({
          x: coords.x,
          y: coords.y,
          strength: WELL_STRENGTH_DEFAULT,
          pulsePhase: 0,
        });
        SoundEngine.play('wellPlace');
      }
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();

      if (state !== 'playing') return;

      const coords = getCanvasCoords(e);

      // Check if clicking on existing well to remove it
      for (let i = 0; i < wells.length; i++) {
        if (dist(coords, wells[i]) < WELL_CLICK_RADIUS) {
          wells.splice(i, 1);
          SoundEngine.play('wellRemove');
          hoveredWellIndex = -1;
          return;
        }
      }

      // Don't place wells in HUD areas
      if (coords.y < 36 || coords.y > H - 24) return;

      // Don't place if max wells reached
      if (wells.length >= MAX_WELLS) return;

      // Don't place wells on walls
      for (const wall of walls) {
        if (rectContains(wall, coords.x, coords.y, 10)) return;
      }

      // Place repulsor (right click)
      wells.push({
        x: coords.x,
        y: coords.y,
        strength: -WELL_STRENGTH_DEFAULT,
        pulsePhase: 0,
      });
      SoundEngine.play('wellPlace');
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (state !== 'playing') return;

      // Only adjust hovered well
      if (hoveredWellIndex === -1) return;
      const w = wells[hoveredWellIndex];
      const isAttractor = w.strength > 0;
      const currentAbs = Math.abs(w.strength);
      const direction = e.deltaY < 0 ? 1 : -1;
      let newAbs = currentAbs + direction * WELL_STRENGTH_STEP;
      newAbs = Math.max(WELL_STRENGTH_MIN, Math.min(WELL_STRENGTH_MAX, newAbs));
      w.strength = isAttractor ? newAbs : -newAbs;
      SoundEngine.play('wellAdjust');
    }

    // ─── Touch Handling ──────────────────────────────────────────────────

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const coords = getTouchCanvasCoords(e.touches[0]);

      // Update crosshair position
      mouseX = coords.x;
      mouseY = coords.y;

      if (state === 'menu') {
        state = 'playing';
        reportGameStart('gravity-well');
        SoundEngine.startAmbient('space-gravity');
        score = 0;
        newHighScore = false;
        levelIndex = 0;
        loadLevel(0);
        return;
      }

      if (state === 'gameover') {
        state = 'playing';
        reportGameStart('gravity-well');
        SoundEngine.startAmbient('space-gravity');
        score = 0;
        newHighScore = false;
        levelIndex = 0;
        loadLevel(0);
        return;
      }

      if (state === 'levelComplete') {
        levelIndex++;
        if (levelIndex >= LEVELS.length) {
          if (score > highScore) { highScore = score; newHighScore = true; setHighScore('gravity-well', score); }
          levelIndex = 0;
          score = 0;
          newHighScore = false;
        }
        state = 'playing';
        loadLevel(levelIndex);
        return;
      }

      if (state === 'playing') {
        // Check if tapping on existing well to remove it
        for (let i = 0; i < wells.length; i++) {
          if (dist(coords, wells[i]) < WELL_CLICK_RADIUS) {
            wells.splice(i, 1);
            SoundEngine.play('wellRemove');
            hoveredWellIndex = -1;
            return;
          }
        }

        // Don't place wells in HUD areas
        if (coords.y < 36 || coords.y > H - 24) return;

        // Don't place if max wells reached
        if (wells.length >= MAX_WELLS) return;

        // Don't place wells on walls
        for (const wall of walls) {
          if (rectContains(wall, coords.x, coords.y, 10)) return;
        }

        // Double-tap detection for repulsor
        const now = Date.now();
        const tapDist = Math.sqrt(
          (coords.x - lastTapX) ** 2 + (coords.y - lastTapY) ** 2
        );
        const isDoubleTap = now - lastTapTime < 300 && tapDist < 30;

        lastTapTime = now;
        lastTapX = coords.x;
        lastTapY = coords.y;

        if (isDoubleTap) {
          // Remove the attractor that was just placed by the first tap
          if (wells.length > 0) {
            const lastWell = wells[wells.length - 1];
            const lastWellDist = Math.sqrt(
              (lastWell.x - coords.x) ** 2 + (lastWell.y - coords.y) ** 2
            );
            if (lastWellDist < 30 && lastWell.strength > 0) {
              wells.pop();
            }
          }
          // Place repulsor
          wells.push({
            x: coords.x,
            y: coords.y,
            strength: -WELL_STRENGTH_DEFAULT,
            pulsePhase: 0,
          });
          SoundEngine.play('wellPlace');
          // Reset to prevent triple-tap
          lastTapTime = 0;
        } else {
          // Single tap: place attractor
          wells.push({
            x: coords.x,
            y: coords.y,
            strength: WELL_STRENGTH_DEFAULT,
            pulsePhase: 0,
          });
          SoundEngine.play('wellPlace');
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const coords = getTouchCanvasCoords(e.touches[0]);
      mouseX = coords.x;
      mouseY = coords.y;
    }

    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault();
    }

    // ─── Setup & Cleanup ─────────────────────────────────────────────────

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && state === 'playing') {
        paused = !paused;
      }
    }

    const onResize = () => { cachedRect = canvas.getBoundingClientRect(); };
    window.addEventListener('resize', onResize);

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    const onVisibilityChange = () => {
      if (document.hidden && state === 'playing' && !paused) {
        paused = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      SoundEngine.stopAmbient();
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
        imageRendering: 'auto',
        cursor: 'crosshair',
      }}
    />
  );
}
