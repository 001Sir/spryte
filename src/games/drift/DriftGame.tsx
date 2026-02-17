'use client';

import { useEffect, useRef } from 'react';

// ─── Constants ───────────────────────────────────────────────────────
const W = 800;
const H = 600;
const GHOST_R = 16;
const MAX_LAUNCH = 14;
const BOUNCE_AMP = 1.4;
const STICK_DAMPEN = 0.15;
const ORB_R = 10;
const EXIT_R = 22;
const TRAIL_MAX = 40;
const PARTICLE_MAX = 120;
const SHAKE_DECAY = 0.9;

// ─── Types ───────────────────────────────────────────────────────────
interface Vec { x: number; y: number }
interface Rect { x: number; y: number; w: number; h: number }
interface Spike { x: number; y: number; w: number; h: number; dir: 'up' | 'down' | 'left' | 'right' }
interface BouncePad { x: number; y: number; w: number; h: number; dir: 'up' | 'down' | 'left' | 'right' }
interface WindZone { x: number; y: number; w: number; h: number; fx: number; fy: number }
interface MovingPlatform { x: number; y: number; w: number; h: number; ax: number; ay: number; bx: number; by: number; speed: number; t: number }
interface GravityWell { x: number; y: number; strength: number }
interface StickyWall { x: number; y: number; w: number; h: number }
interface Portal { x1: number; y1: number; x2: number; y2: number; r: number }
interface Orb { x: number; y: number; collected: boolean }
interface Level {
  walls: Rect[];
  spikes: Spike[];
  bouncePads: BouncePad[];
  windZones: WindZone[];
  movingPlatforms: MovingPlatform[];
  gravityWells: GravityWell[];
  stickyWalls: StickyWall[];
  portals: Portal[];
  orbs: Orb[];
  startX: number;
  startY: number;
  exitX: number;
  exitY: number;
  par: number;
  name: string;
}
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface TrailDot { x: number; y: number; alpha: number }

// ─── Levels ──────────────────────────────────────────────────────────
function makeLevels(): Level[] {
  const border = (inset: number = 0): Rect[] => [
    { x: inset, y: inset, w: W - 2 * inset, h: 14 },
    { x: inset, y: H - 14 - inset, w: W - 2 * inset, h: 14 },
    { x: inset, y: inset, w: 14, h: H - 2 * inset },
    { x: W - 14 - inset, y: inset, w: 14, h: H - 2 * inset },
  ];

  return [
    // 1: Tutorial
    {
      name: 'Tutorial',
      walls: [...border()],
      spikes: [], bouncePads: [], windZones: [], movingPlatforms: [],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [],
      startX: 100, startY: H / 2,
      exitX: W - 60, exitY: H / 2,
      par: 1,
    },
    // 2: First Orbs
    {
      name: 'First Orbs',
      walls: [...border(), { x: 350, y: 14, w: 14, h: 250 }],
      spikes: [], bouncePads: [], windZones: [], movingPlatforms: [],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [{ x: 300, y: 150, collected: false }, { x: 500, y: 400, collected: false }],
      startX: 100, startY: 500,
      exitX: W - 60, exitY: 100,
      par: 1,
    },
    // 3: L-Shaped Room
    {
      name: 'L-Shaped Room',
      walls: [
        ...border(),
        { x: 300, y: 14, w: 14, h: 350 },
        { x: 300, y: 364, w: 300, h: 14 },
      ],
      spikes: [], bouncePads: [], windZones: [], movingPlatforms: [],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [{ x: 550, y: 200, collected: false }],
      startX: 100, startY: 300,
      exitX: 700, exitY: 500,
      par: 2,
    },
    // 4: Spike Floor
    {
      name: 'Spike Floor',
      walls: [
        ...border(),
        { x: 200, y: 200, w: 120, h: 14 },
        { x: 500, y: 300, w: 120, h: 14 },
      ],
      spikes: [
        { x: 14, y: H - 42, w: W - 28, h: 14, dir: 'up' },
      ],
      bouncePads: [], windZones: [], movingPlatforms: [],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [{ x: 260, y: 150, collected: false }],
      startX: 60, startY: 100,
      exitX: W - 60, exitY: 250,
      par: 2,
    },
    // 5: Bounce Chain
    {
      name: 'Bounce Chain',
      walls: [...border()],
      spikes: [
        { x: 14, y: H - 42, w: W - 28, h: 14, dir: 'up' },
      ],
      bouncePads: [
        { x: 200, y: 450, w: 80, h: 14, dir: 'up' },
        { x: 400, y: 350, w: 80, h: 14, dir: 'up' },
        { x: 600, y: 250, w: 80, h: 14, dir: 'up' },
      ],
      windZones: [], movingPlatforms: [],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [{ x: 240, y: 380, collected: false }, { x: 440, y: 280, collected: false }],
      startX: 60, startY: 100,
      exitX: W - 60, exitY: 100,
      par: 1,
    },
    // 6: Wind Tunnel
    {
      name: 'Wind Tunnel',
      walls: [
        ...border(),
        { x: 350, y: 14, w: 14, h: 200 },
        { x: 350, y: 350, w: 14, h: 250 },
      ],
      spikes: [],
      bouncePads: [],
      windZones: [
        { x: 300, y: 200, w: 120, h: 150, fx: 0, fy: -5 },
      ],
      movingPlatforms: [],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [{ x: 360, y: 270, collected: false }],
      startX: 100, startY: 300,
      exitX: 700, exitY: 300,
      par: 2,
    },
    // 7: Moving Platforms
    {
      name: 'Moving Platforms',
      walls: [
        ...border(),
        { x: 14, y: 250, w: 200, h: 14 },
        { x: 580, y: 350, w: 206, h: 14 },
      ],
      spikes: [
        { x: 14, y: H - 42, w: W - 28, h: 14, dir: 'up' },
      ],
      bouncePads: [],
      windZones: [],
      movingPlatforms: [
        { x: 300, y: 250, w: 100, h: 14, ax: 300, ay: 200, bx: 300, by: 400, speed: 80, t: 0 },
        { x: 480, y: 300, w: 80, h: 14, ax: 420, ay: 300, bx: 560, by: 300, speed: 100, t: 0 },
      ],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [{ x: 350, y: 180, collected: false }],
      startX: 100, startY: 200,
      exitX: 700, exitY: 300,
      par: 3,
    },
    // 8: Orb Gauntlet
    {
      name: 'Orb Gauntlet',
      walls: [
        ...border(),
        { x: 200, y: 14, w: 14, h: 200 },
        { x: 400, y: 200, w: 14, h: 400 },
        { x: 600, y: 14, w: 14, h: 350 },
      ],
      spikes: [
        { x: 200, y: 200, w: 200, h: 14, dir: 'down' },
      ],
      bouncePads: [],
      windZones: [],
      movingPlatforms: [],
      gravityWells: [], stickyWalls: [], portals: [],
      orbs: [
        { x: 100, y: 150, collected: false },
        { x: 300, y: 100, collected: false },
        { x: 300, y: 400, collected: false },
        { x: 500, y: 300, collected: false },
        { x: 700, y: 200, collected: false },
      ],
      startX: 60, startY: 500,
      exitX: 700, exitY: 500,
      par: 4,
    },
    // 9: Gravity Well
    {
      name: 'Gravity Well',
      walls: [...border()],
      spikes: [
        { x: 350, y: 260, w: 100, h: 14, dir: 'up' },
        { x: 350, y: 326, w: 100, h: 14, dir: 'down' },
      ],
      bouncePads: [],
      windZones: [],
      movingPlatforms: [],
      gravityWells: [{ x: 400, y: 300, strength: 4000 }],
      stickyWalls: [], portals: [],
      orbs: [{ x: 400, y: 150, collected: false }, { x: 400, y: 450, collected: false }],
      startX: 60, startY: 300,
      exitX: W - 60, exitY: 300,
      par: 2,
    },
    // 10: Final Gauntlet
    {
      name: 'Final Gauntlet',
      walls: [
        ...border(),
        { x: 200, y: 14, w: 14, h: 180 },
        { x: 200, y: 300, w: 14, h: 120 },
        { x: 500, y: 180, w: 14, h: 200 },
        { x: 500, y: 480, w: 14, h: 120 },
      ],
      spikes: [
        { x: 14, y: H - 42, w: 186, h: 14, dir: 'up' },
        { x: 214, y: H - 42, w: 286, h: 14, dir: 'up' },
      ],
      bouncePads: [
        { x: 300, y: 460, w: 80, h: 14, dir: 'up' },
      ],
      windZones: [
        { x: 520, y: 200, w: 120, h: 150, fx: 3, fy: -3 },
      ],
      movingPlatforms: [
        { x: 350, y: 200, w: 80, h: 14, ax: 300, ay: 200, bx: 450, by: 200, speed: 70, t: 0 },
      ],
      gravityWells: [{ x: 650, y: 400, strength: 2500 }],
      stickyWalls: [],
      portals: [{ x1: 150, y1: 450, x2: 600, y2: 100, r: 18 }],
      orbs: [
        { x: 100, y: 150, collected: false },
        { x: 350, y: 100, collected: false },
        { x: 650, y: 250, collected: false },
      ],
      startX: 60, startY: 100,
      exitX: W - 60, exitY: 500,
      par: 5,
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────
export default function DriftGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ── State ──
    type GState = 'menu' | 'playing' | 'levelComplete' | 'gameover';
    let state: GState = 'menu';
    let levels = makeLevels();
    let currentLevel = 0;
    let totalScore = 0;
    let levelScore = 0;
    let launches = 0;
    let stars = 0;

    // Ghost
    let gx = 0, gy = 0, gvx = 0, gvy = 0;
    let onSurface = true;
    let _surfaceNormal: Vec = { x: 0, y: -1 };

    // Squash/stretch
    let scaleX = 1, scaleY = 1;

    // Idle bob
    let bobTime = 0;
    let blinkTimer = 0;
    let isBlinking = false;

    // Aiming
    let isAiming = false;
    let aimStartX = 0, aimStartY = 0;
    let aimX = 0, aimY = 0;
    let _mouseX = 0, _mouseY = 0;
    let hoveringGhost = false;

    // Keyboard state
    const keysDown: Record<string, boolean> = {};
    let kbAiming = false;
    let kbCharging = false;
    let kbChargePower = 0;
    let kbDirX = 0;
    let kbDirY = 0;

    // Trail & particles
    let trail: TrailDot[] = [];
    let particles: Particle[] = [];

    // Shake
    let shakeX = 0, shakeY = 0;
    let shakeIntensity = 0;

    // Stars
    const starField: { x: number; y: number; s: number; b: number; sp: number }[] = [];
    for (let i = 0; i < 80; i++) {
      starField.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5, b: Math.random(), sp: Math.random() * 2 + 1 });
    }

    // Wind particles
    const windParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];

    // Timing
    let lastTime = 0;
    let rafId = 0;
    let menuTime = 0;

    // Menu hover
    let menuHover = false;
    const _levelSelectHover = -1;

    // Level complete button hover
    let nextBtnHover = false;

    // ── Helpers ──
    const dist = (ax: number, ay: number, bx: number, by: number) =>
      Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);

    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const _rectContains = (r: Rect, px: number, py: number) =>
      px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;

    const circleRect = (cx: number, cy: number, cr: number, rx: number, ry: number, rw: number, rh: number): { hit: boolean; nx: number; ny: number; pen: number } => {
      const nearX = clamp(cx, rx, rx + rw);
      const nearY = clamp(cy, ry, ry + rh);
      const dx = cx - nearX;
      const dy = cy - nearY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < cr && d > 0) {
        return { hit: true, nx: dx / d, ny: dy / d, pen: cr - d };
      }
      if (d === 0) {
        const overlapL = (cx + cr) - rx;
        const overlapR = (rx + rw) - (cx - cr);
        const overlapT = (cy + cr) - ry;
        const overlapB = (ry + rh) - (cy - cr);
        const minO = Math.min(overlapL, overlapR, overlapT, overlapB);
        if (minO === overlapL) return { hit: true, nx: -1, ny: 0, pen: overlapL };
        if (minO === overlapR) return { hit: true, nx: 1, ny: 0, pen: overlapR };
        if (minO === overlapT) return { hit: true, nx: 0, ny: -1, pen: overlapT };
        return { hit: true, nx: 0, ny: 1, pen: overlapB };
      }
      return { hit: false, nx: 0, ny: 0, pen: 0 };
    };

    const spawnParticles = (x: number, y: number, count: number, color: string, speed: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * speed + speed * 0.3;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, maxLife: 1, color, size: Math.random() * 3 + 1 });
      }
      if (particles.length > PARTICLE_MAX) particles.splice(0, particles.length - PARTICLE_MAX);
    };

    // ── Init Level ──
    const initLevel = (idx: number) => {
      levels = makeLevels();
      const lv = levels[idx];
      gx = lv.startX;
      gy = lv.startY;
      gvx = 0;
      gvy = 0;
      onSurface = true;
      _surfaceNormal = { x: 0, y: -1 };
      scaleX = 1;
      scaleY = 1;
      isAiming = false;
      launches = 0;
      levelScore = 0;
      trail = [];
      particles = [];
      shakeIntensity = 0;
      bobTime = 0;
      blinkTimer = 3;
    };

    // ── Get mouse pos ──
    const getMousePos = (e: MouseEvent | Touch): Vec => {
      const rect = canvas.getBoundingClientRect();
      return { x: (e.clientX - rect.left) * (W / rect.width), y: (e.clientY - rect.top) * (H / rect.height) };
    };

    // ── Drawing helpers ──
    const drawGhost = (x: number, y: number, velX: number, velY: number, dt: number) => {
      ctx.save();
      ctx.translate(x, y);

      // squash/stretch
      scaleX = lerp(scaleX, 1, 4 * dt);
      scaleY = lerp(scaleY, 1, 4 * dt);
      ctx.scale(scaleX, scaleY);

      const speed = Math.sqrt(velX * velX + velY * velY);
      const moveAngle = Math.atan2(velY, velX);

      // Bob when on surface
      let bobOff = 0;
      if (onSurface) {
        bobTime += dt;
        bobOff = Math.sin(bobTime * 2.5) * 3;
      }
      ctx.translate(0, bobOff);

      // Cloak direction (billows opposite to velocity)
      const cloakAngle = speed > 0.5 ? moveAngle + Math.PI : 0;
      const cloakSpread = clamp(speed / MAX_LAUNCH, 0, 1) * 8;

      // ─ Cloak (bell shape) ─
      const grad = ctx.createLinearGradient(-GHOST_R, -GHOST_R * 0.5, GHOST_R, GHOST_R * 1.5);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(1, '#51e2ff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-GHOST_R, -GHOST_R * 0.3);
      // Bell curve down
      const hemWave = (Date.now() / 200);
      const bl = GHOST_R * 1.6;
      ctx.quadraticCurveTo(-GHOST_R * 1.2, bl * 0.5, -GHOST_R + cloakSpread * Math.cos(cloakAngle), bl + Math.sin(hemWave) * 3);
      ctx.quadraticCurveTo(-GHOST_R * 0.4, bl + 6 + Math.sin(hemWave + 1) * 2, 0, bl + Math.sin(hemWave + 2) * 3);
      ctx.quadraticCurveTo(GHOST_R * 0.4, bl + 6 + Math.sin(hemWave + 3) * 2, GHOST_R - cloakSpread * Math.cos(cloakAngle), bl + Math.sin(hemWave + 4) * 3);
      ctx.quadraticCurveTo(GHOST_R * 1.2, bl * 0.5, GHOST_R, -GHOST_R * 0.3);
      ctx.closePath();
      ctx.fill();

      // ─ Head (circle) ─
      const headGrad = ctx.createRadialGradient(0, -GHOST_R * 0.3, 0, 0, -GHOST_R * 0.3, GHOST_R);
      headGrad.addColorStop(0, '#1a1a3e');
      headGrad.addColorStop(1, '#000000');
      ctx.fillStyle = headGrad;
      ctx.beginPath();
      ctx.arc(0, -GHOST_R * 0.3, GHOST_R, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.shadowColor = '#51e2ff';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = 'rgba(81,226,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ─ Eyes ─
      // Track velocity or aim direction
      let lookX = 0, lookY = 0;
      if (isAiming) {
        const dx = aimX - x;
        const dy = aimY - y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        lookX = (dx / d) * 3;
        lookY = (dy / d) * 3;
      } else if (speed > 0.5) {
        lookX = (velX / speed) * 3;
        lookY = (velY / speed) * 3;
      }

      // Blink
      blinkTimer -= dt;
      if (blinkTimer <= 0) {
        isBlinking = !isBlinking;
        blinkTimer = isBlinking ? 0.15 : Math.random() * 4 + 2;
      }
      const eyeScaleY = isBlinking ? 0.1 : 1;

      // Left eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.save();
      ctx.translate(-6, -GHOST_R * 0.4);
      ctx.scale(1, eyeScaleY);
      ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(lookX * 0.5, lookY * 0.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.save();
      ctx.translate(6, -GHOST_R * 0.4);
      ctx.scale(1, eyeScaleY);
      ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(lookX * 0.5, lookY * 0.5, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.restore();
    };

    const drawAimIndicator = () => {
      if (!isAiming) return;
      const dx = aimStartX - aimX;
      const dy = aimStartY - aimY;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 5) return;

      const power = Math.min(d / 150, 1);
      const launchDx = dx / d;
      const launchDy = dy / d;

      // Dotted line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = `rgba(81,226,255,${0.4 + power * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      const lineLen = 60 + power * 100;
      ctx.lineTo(gx + launchDx * lineLen, gy + launchDy * lineLen);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const tipX = gx + launchDx * lineLen;
      const tipY = gy + launchDy * lineLen;
      const aSize = 8 + power * 4;
      const perpX = -launchDy;
      const perpY = launchDx;
      ctx.fillStyle = `rgba(81,226,255,${0.6 + power * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - launchDx * aSize + perpX * aSize * 0.4, tipY - launchDy * aSize + perpY * aSize * 0.4);
      ctx.lineTo(tipX - launchDx * aSize - perpX * aSize * 0.4, tipY - launchDy * aSize - perpY * aSize * 0.4);
      ctx.closePath();
      ctx.fill();

      // Power bar
      const barW = 50;
      const barH = 6;
      const barX = gx - barW / 2;
      const barY = gy + GHOST_R * 2.5;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = `rgb(${81 + 174 * power},${226 - 100 * power},255)`;
      ctx.fillRect(barX, barY, barW * power, barH);
      ctx.strokeStyle = 'rgba(81,226,255,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
    };

    const drawKeyboardAim = () => {
      if (!kbAiming && !kbCharging) return;
      if (!onSurface) return;
      if (isAiming) return; // mouse aim takes priority

      const power = kbCharging ? kbChargePower : 0.2;
      const lineLen = 60 + power * 100;

      // Dotted line
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = `rgba(81,226,255,${0.4 + power * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + kbDirX * lineLen, gy + kbDirY * lineLen);
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrowhead
      const tipX = gx + kbDirX * lineLen;
      const tipY = gy + kbDirY * lineLen;
      const aSize = 8 + power * 4;
      const perpX = -kbDirY;
      const perpY = kbDirX;
      ctx.fillStyle = `rgba(81,226,255,${0.6 + power * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - kbDirX * aSize + perpX * aSize * 0.4, tipY - kbDirY * aSize + perpY * aSize * 0.4);
      ctx.lineTo(tipX - kbDirX * aSize - perpX * aSize * 0.4, tipY - kbDirY * aSize - perpY * aSize * 0.4);
      ctx.closePath();
      ctx.fill();

      // Power bar (only when charging)
      if (kbCharging) {
        const barW = 50;
        const barH = 6;
        const barX = gx - barW / 2;
        const barY = gy + GHOST_R * 2.5;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = `rgb(${Math.round(81 + 174 * power)},${Math.round(226 - 100 * power)},255)`;
        ctx.fillRect(barX, barY, barW * power, barH);
        ctx.strokeStyle = 'rgba(81,226,255,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
      }
    };

    const drawWall = (r: Rect) => {
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgba(81,226,255,0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    };

    const drawSpike = (s: Spike) => {
      const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(1, '#f97316');
      ctx.fillStyle = grad;
      const count = Math.floor(s.w / 16);
      const tw = s.w / count;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        if (s.dir === 'up') {
          ctx.moveTo(s.x + i * tw, s.y + s.h);
          ctx.lineTo(s.x + i * tw + tw / 2, s.y);
          ctx.lineTo(s.x + (i + 1) * tw, s.y + s.h);
        } else if (s.dir === 'down') {
          ctx.moveTo(s.x + i * tw, s.y);
          ctx.lineTo(s.x + i * tw + tw / 2, s.y + s.h);
          ctx.lineTo(s.x + (i + 1) * tw, s.y);
        } else if (s.dir === 'left') {
          ctx.moveTo(s.x + s.w, s.y + i * tw);
          ctx.lineTo(s.x, s.y + i * tw + tw / 2);
          ctx.lineTo(s.x + s.w, s.y + (i + 1) * tw);
        } else {
          ctx.moveTo(s.x, s.y + i * tw);
          ctx.lineTo(s.x + s.w, s.y + i * tw + tw / 2);
          ctx.lineTo(s.x, s.y + (i + 1) * tw);
        }
        ctx.closePath();
        ctx.fill();
      }
    };

    const drawBouncePad = (b: BouncePad) => {
      ctx.fillStyle = '#51e2ff';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      // Spring lines
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        if (b.dir === 'up' || b.dir === 'down') {
          const lx = cx + i * 15;
          ctx.moveTo(lx, b.y);
          ctx.lineTo(lx, b.y - 8);
        } else {
          const ly = cy + i * 15;
          ctx.moveTo(b.x, ly);
          ctx.lineTo(b.x - 8, ly);
        }
        ctx.stroke();
      }
    };

    const drawWindZone = (wz: WindZone, dt: number) => {
      ctx.fillStyle = 'rgba(81,226,255,0.05)';
      ctx.fillRect(wz.x, wz.y, wz.w, wz.h);
      ctx.strokeStyle = 'rgba(81,226,255,0.15)';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(wz.x, wz.y, wz.w, wz.h);
      ctx.setLineDash([]);

      // Spawn wind particles
      if (Math.random() < dt * 10) {
        windParticles.push({
          x: wz.x + Math.random() * wz.w,
          y: wz.y + Math.random() * wz.h,
          vx: wz.fx * 15,
          vy: wz.fy * 15,
          life: 1,
        });
      }
    };

    const drawMovingPlatform = (mp: MovingPlatform) => {
      ctx.fillStyle = '#2a2a4e';
      ctx.fillRect(mp.x, mp.y, mp.w, mp.h);
      ctx.strokeStyle = 'rgba(81,226,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(mp.x, mp.y, mp.w, mp.h);
    };

    const drawGravityWell = (gw: GravityWell) => {
      const t = Date.now() / 1000;
      // Outer dashed circle
      ctx.strokeStyle = 'rgba(81,226,255,0.3)';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(gw.x, gw.y, 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gw.x, gw.y, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Swirl
      ctx.strokeStyle = 'rgba(81,226,255,0.5)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + (i * Math.PI * 2) / 3;
        const r1 = 10;
        const r2 = 50;
        ctx.beginPath();
        for (let s = 0; s <= 1; s += 0.05) {
          const r = r1 + (r2 - r1) * s;
          const angle = a + s * Math.PI * 1.5;
          ctx.lineTo(gw.x + Math.cos(angle) * r, gw.y + Math.sin(angle) * r);
        }
        ctx.stroke();
      }

      // Center glow
      const cGrad = ctx.createRadialGradient(gw.x, gw.y, 0, gw.x, gw.y, 20);
      cGrad.addColorStop(0, 'rgba(81,226,255,0.3)');
      cGrad.addColorStop(1, 'rgba(81,226,255,0)');
      ctx.fillStyle = cGrad;
      ctx.beginPath();
      ctx.arc(gw.x, gw.y, 20, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawPortal = (p: Portal) => {
      const t = Date.now() / 500;
      [{ x: p.x1, y: p.y1 }, { x: p.x2, y: p.y2 }].forEach((pos, idx) => {
        ctx.strokeStyle = idx === 0 ? 'rgba(81,226,255,0.8)' : 'rgba(81,150,255,0.8)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, p.r - i * 3, t + i * 0.5, t + i * 0.5 + Math.PI * 1.5);
          ctx.stroke();
        }
        const pGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, p.r);
        pGrad.addColorStop(0, 'rgba(81,226,255,0.15)');
        pGrad.addColorStop(1, 'rgba(81,226,255,0)');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const drawOrb = (o: Orb) => {
      if (o.collected) return;
      const t = Date.now() / 400;
      const pulse = 1 + Math.sin(t) * 0.15;
      const glow = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, ORB_R * pulse * 2);
      glow.addColorStop(0, 'rgba(81,226,255,0.3)');
      glow.addColorStop(1, 'rgba(81,226,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(o.x, o.y, ORB_R * pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#51e2ff';
      ctx.shadowColor = '#51e2ff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(o.x, o.y, ORB_R * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const drawExit = (ex: number, ey: number) => {
      const t = Date.now() / 600;
      // Rotating arcs
      ctx.strokeStyle = 'rgba(81,226,255,0.9)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const a = t + (i * Math.PI) / 2;
        ctx.arc(ex, ey, EXIT_R, a, a + Math.PI * 0.35);
        ctx.stroke();
      }
      // Glow
      const eGrad = ctx.createRadialGradient(ex, ey, 0, ex, ey, EXIT_R * 1.5);
      eGrad.addColorStop(0, 'rgba(81,226,255,0.25)');
      eGrad.addColorStop(1, 'rgba(81,226,255,0)');
      ctx.fillStyle = eGrad;
      ctx.beginPath();
      ctx.arc(ex, ey, EXIT_R * 1.5, 0, Math.PI * 2);
      ctx.fill();
    };

    // ── Collision ──
    const handleCollisions = (lv: Level, _dt: number) => {
      const _speed = Math.sqrt(gvx * gvx + gvy * gvy);

      // Walls
      const allWalls: Rect[] = [...lv.walls];
      lv.movingPlatforms.forEach(mp => allWalls.push({ x: mp.x, y: mp.y, w: mp.w, h: mp.h }));
      lv.stickyWalls.forEach(sw => allWalls.push(sw));

      for (const w of allWalls) {
        const col = circleRect(gx, gy, GHOST_R, w.x, w.y, w.w, w.h);
        if (col.hit) {
          gx += col.nx * col.pen;
          gy += col.ny * col.pen;

          const dot = gvx * col.nx + gvy * col.ny;
          if (dot < 0) {
            gvx -= 2 * dot * col.nx;
            gvy -= 2 * dot * col.ny;

            // Stick
            const impactSpeed = Math.abs(dot);
            if (impactSpeed > 0.5) {
              shakeIntensity = Math.min(impactSpeed * 0.5, 8);
              spawnParticles(gx, gy, Math.floor(impactSpeed * 2), '#51e2ff', impactSpeed * 0.5);
              // squash in impact direction
              if (Math.abs(col.nx) > Math.abs(col.ny)) {
                scaleX = 0.7;
                scaleY = 1.3;
              } else {
                scaleX = 1.3;
                scaleY = 0.7;
              }
            }

            // Check if sticky
            const isStickyWall = lv.stickyWalls.some(sw => sw.x === w.x && sw.y === w.y && sw.w === w.w && sw.h === w.h);
            if (isStickyWall) {
              gvx *= STICK_DAMPEN;
              gvy *= STICK_DAMPEN;
            }

            gvx = gvx * 0.0;
            gvy = gvy * 0.0;
            onSurface = true;
            _surfaceNormal = { x: col.nx, y: col.ny };
          }
        }
      }

      // Spikes
      for (const s of lv.spikes) {
        const col = circleRect(gx, gy, GHOST_R * 0.7, s.x, s.y, s.w, s.h);
        if (col.hit) {
          // Death
          spawnParticles(gx, gy, 30, '#ef4444', 5);
          spawnParticles(gx, gy, 20, '#f97316', 4);
          shakeIntensity = 12;
          state = 'gameover';
          return;
        }
      }

      // Bounce pads
      for (const b of lv.bouncePads) {
        const col = circleRect(gx, gy, GHOST_R, b.x, b.y, b.w, b.h);
        if (col.hit) {
          gx += col.nx * col.pen;
          gy += col.ny * col.pen;
          const dot = gvx * col.nx + gvy * col.ny;
          if (dot < 0) {
            gvx -= 2 * dot * col.nx;
            gvy -= 2 * dot * col.ny;
            gvx *= BOUNCE_AMP;
            gvy *= BOUNCE_AMP;
            spawnParticles(gx, gy, 10, '#51e2ff', 3);
            scaleX = Math.abs(col.nx) > 0.5 ? 0.6 : 1.4;
            scaleY = Math.abs(col.ny) > 0.5 ? 0.6 : 1.4;
          }
          onSurface = false;
        }
      }

      // Portals
      for (const p of lv.portals) {
        if (dist(gx, gy, p.x1, p.y1) < p.r + GHOST_R) {
          gx = p.x2 + (gx - p.x1);
          gy = p.y2 + (gy - p.y1);
          spawnParticles(p.x1, p.y1, 8, '#51e2ff', 3);
          spawnParticles(p.x2, p.y2, 8, '#5196ff', 3);
          break;
        }
        if (dist(gx, gy, p.x2, p.y2) < p.r + GHOST_R) {
          gx = p.x1 + (gx - p.x2);
          gy = p.y1 + (gy - p.y2);
          spawnParticles(p.x2, p.y2, 8, '#5196ff', 3);
          spawnParticles(p.x1, p.y1, 8, '#51e2ff', 3);
          break;
        }
      }

      // Orbs
      for (const o of lv.orbs) {
        if (!o.collected && dist(gx, gy, o.x, o.y) < GHOST_R + ORB_R) {
          o.collected = true;
          levelScore += 200;
          spawnParticles(o.x, o.y, 12, '#51e2ff', 4);
        }
      }

      // Exit
      if (dist(gx, gy, lv.exitX, lv.exitY) < GHOST_R + EXIT_R) {
        // Level complete
        stars = launches <= lv.par ? 3 : launches <= lv.par + 2 ? 2 : 1;
        levelScore += 1000 + stars * 500;
        totalScore += levelScore;
        state = 'levelComplete';
        spawnParticles(lv.exitX, lv.exitY, 25, '#51e2ff', 5);
      }
    };

    // ── Update ──
    const update = (dt: number) => {
      if (state !== 'playing') return;
      const lv = levels[currentLevel];

      // Gravity wells
      if (!onSurface) {
        for (const gw of lv.gravityWells) {
          const dx = gw.x - gx;
          const dy = gw.y - gy;
          const d2 = dx * dx + dy * dy;
          const d = Math.sqrt(d2);
          if (d > 5) {
            const force = gw.strength / d2;
            gvx += (dx / d) * force * dt;
            gvy += (dy / d) * force * dt;
          }
        }

        // Wind
        for (const wz of lv.windZones) {
          if (gx > wz.x && gx < wz.x + wz.w && gy > wz.y && gy < wz.y + wz.h) {
            gvx += wz.fx * dt;
            gvy += wz.fy * dt;
          }
        }
      }

      // Moving platforms
      for (const mp of lv.movingPlatforms) {
        mp.t += dt * mp.speed / dist(mp.ax, mp.ay, mp.bx, mp.by);
        const ping = Math.abs(((mp.t % 2) + 2) % 2 - 1);
        mp.x = lerp(mp.ax, mp.bx, ping);
        mp.y = lerp(mp.ay, mp.by, ping);
      }

      // Move ghost
      if (!onSurface) {
        gx += gvx * dt * 60;
        gy += gvy * dt * 60;

        // Trail
        trail.push({ x: gx, y: gy, alpha: 1 });
        if (trail.length > TRAIL_MAX) trail.shift();
      }

      // Update trail
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].alpha -= dt * 2;
        if (trail[i].alpha <= 0) trail.splice(i, 1);
      }

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vx *= 0.97;
        p.vy *= 0.97;
        p.life -= dt * 1.5;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Wind particles
      for (let i = windParticles.length - 1; i >= 0; i--) {
        const wp = windParticles[i];
        wp.x += wp.vx * dt * 60;
        wp.y += wp.vy * dt * 60;
        wp.life -= dt * 1.5;
        if (wp.life <= 0) windParticles.splice(i, 1);
      }
      if (windParticles.length > 60) windParticles.splice(0, windParticles.length - 60);

      // Keyboard aim direction
      if (onSurface && !isAiming) {
        let kdx = 0, kdy = 0;
        if (keysDown['ArrowLeft'] || keysDown['a']) kdx -= 1;
        if (keysDown['ArrowRight'] || keysDown['d']) kdx += 1;
        if (keysDown['ArrowUp'] || keysDown['w']) kdy -= 1;
        if (keysDown['ArrowDown'] || keysDown['s']) kdy += 1;

        if (kdx !== 0 || kdy !== 0) {
          const len = Math.sqrt(kdx * kdx + kdy * kdy);
          kbDirX = kdx / len;
          kbDirY = kdy / len;
          kbAiming = true;
        }

        if (kbCharging) {
          kbChargePower = Math.min(kbChargePower + dt * 1.2, 1);
        }
      }

      // Shake decay
      shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
      shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
      shakeIntensity *= SHAKE_DECAY;
      if (shakeIntensity < 0.1) shakeIntensity = 0;

      // Collisions
      handleCollisions(lv, dt);
    };

    // ── Draw ──
    const drawBg = () => {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      const t = Date.now() / 1000;
      for (const s of starField) {
        const alpha = 0.3 + Math.sin(t * s.sp + s.b * 10) * 0.3;
        ctx.fillStyle = `rgba(81,226,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawHUD = (lv: Level) => {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, 36);
      ctx.fillStyle = '#51e2ff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Level ${currentLevel + 1}: ${lv.name}`, 12, 24);
      ctx.textAlign = 'center';
      ctx.fillText(`Launches: ${launches} / Par: ${lv.par}`, W / 2, 24);
      ctx.textAlign = 'right';
      ctx.fillText(`Score: ${totalScore + levelScore}`, W - 12, 24);
      ctx.textAlign = 'left';
    };

    const drawMenu = (dt: number) => {
      menuTime += dt;
      drawBg();

      // Title
      ctx.fillStyle = '#51e2ff';
      ctx.font = 'bold 60px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#51e2ff';
      ctx.shadowBlur = 20;
      ctx.fillText('DRIFT', W / 2, 180);
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(81,226,255,0.6)';
      ctx.font = '16px monospace';
      ctx.fillText('A Zero-Friction Momentum Puzzle', W / 2, 220);

      // Floating ghost preview
      const previewY = 300 + Math.sin(menuTime * 1.5) * 10;
      drawGhost(W / 2, previewY, Math.sin(menuTime * 0.8) * 2, 0, dt);

      // Play button
      const btnX = W / 2 - 80;
      const btnY = 400;
      const btnW = 160;
      const btnH = 48;
      const hovering = menuHover;
      ctx.fillStyle = hovering ? 'rgba(81,226,255,0.25)' : 'rgba(81,226,255,0.1)';
      ctx.strokeStyle = '#51e2ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#51e2ff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('PLAY', W / 2, btnY + 31);

      ctx.fillStyle = 'rgba(81,226,255,0.4)';
      ctx.font = '13px monospace';
      ctx.fillText('Mouse: Click & drag to aim, release to launch', W / 2, 472);
      ctx.fillText('Keyboard: Arrow Keys / WASD + Space to charge & launch', W / 2, 494);
      ctx.textAlign = 'left';
    };

    const drawLevelComplete = () => {
      drawBg();
      const lv = levels[currentLevel];

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#51e2ff';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Level Complete!', W / 2, 160);

      // Stars
      const starStr = '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars);
      ctx.font = '40px monospace';
      ctx.fillStyle = '#51e2ff';
      ctx.fillText(starStr, W / 2, 220);

      ctx.font = '18px monospace';
      ctx.fillStyle = 'rgba(81,226,255,0.8)';
      ctx.fillText(`Launches: ${launches}  |  Par: ${lv.par}`, W / 2, 270);
      ctx.fillText(`Level Score: ${levelScore}`, W / 2, 300);
      ctx.fillText(`Total Score: ${totalScore}`, W / 2, 330);

      // Next / Finish button
      const isLast = currentLevel >= levels.length - 1;
      const label = isLast ? 'FINISH' : 'NEXT LEVEL';
      const btnX = W / 2 - 90;
      const btnY = 380;
      const btnW = 180;
      const btnH = 48;
      ctx.fillStyle = nextBtnHover ? 'rgba(81,226,255,0.25)' : 'rgba(81,226,255,0.1)';
      ctx.strokeStyle = '#51e2ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#51e2ff';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(label, W / 2, btnY + 31);
      ctx.textAlign = 'left';
    };

    const drawGameOver = () => {
      drawBg();
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 40px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DESTROYED', W / 2, 240);

      ctx.fillStyle = 'rgba(255,150,100,0.7)';
      ctx.font = '18px monospace';
      ctx.fillText('Click to retry', W / 2, 300);

      // Draw remaining particles
      for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    };

    const drawPlaying = (dt: number) => {
      drawBg();
      ctx.save();
      ctx.translate(shakeX, shakeY);

      const lv = levels[currentLevel];

      // Draw level elements
      lv.walls.forEach(drawWall);
      lv.spikes.forEach(drawSpike);
      lv.bouncePads.forEach(drawBouncePad);
      lv.windZones.forEach(wz => drawWindZone(wz, dt));
      lv.movingPlatforms.forEach(drawMovingPlatform);
      lv.gravityWells.forEach(drawGravityWell);
      lv.portals.forEach(drawPortal);
      lv.orbs.forEach(drawOrb);

      // Sticky walls overlay
      lv.stickyWalls.forEach(sw => {
        ctx.fillStyle = 'rgba(100,20,140,0.3)';
        ctx.fillRect(sw.x, sw.y, sw.w, sw.h);
        ctx.strokeStyle = 'rgba(160,40,200,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sw.x, sw.y, sw.w, sw.h);
      });

      // Exit
      drawExit(lv.exitX, lv.exitY);

      // Wind particles
      for (const wp of windParticles) {
        ctx.globalAlpha = wp.life * 0.4;
        ctx.fillStyle = '#51e2ff';
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Trail
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        ctx.globalAlpha = t.alpha * 0.5;
        ctx.fillStyle = '#51e2ff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, 3 * t.alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Particles
      for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ghost
      drawGhost(gx, gy, gvx, gvy, dt);

      // Aim indicator
      drawAimIndicator();
      drawKeyboardAim();

      // HUD
      drawHUD(lv);

      ctx.restore();
    };

    // ── Game Loop ──
    const gameLoop = (timestamp: number) => {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      switch (state) {
        case 'menu':
          drawMenu(dt);
          break;
        case 'playing':
          update(dt);
          if (state === 'playing') drawPlaying(dt);
          else if (state === 'gameover') drawGameOver();
          else if (state === 'levelComplete') drawLevelComplete();
          break;
        case 'levelComplete':
          drawLevelComplete();
          // Keep updating particles
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.life -= dt * 1.5;
            if (p.life <= 0) particles.splice(i, 1);
          }
          break;
        case 'gameover':
          drawGameOver();
          for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt * 60;
            p.y += p.vy * dt * 60;
            p.vy += 3 * dt;
            p.life -= dt * 1.5;
            if (p.life <= 0) particles.splice(i, 1);
          }
          break;
      }

      rafId = requestAnimationFrame(gameLoop);
    };

    // ── Input ──
    const handleMouseDown = (e: MouseEvent) => {
      const pos = getMousePos(e);
      _mouseX = pos.x;
      _mouseY = pos.y;

      if (state === 'menu') {
        // Check play button
        if (pos.x >= W / 2 - 80 && pos.x <= W / 2 + 80 && pos.y >= 400 && pos.y <= 448) {
          state = 'playing';
          currentLevel = 0;
          totalScore = 0;
          initLevel(0);
        }
        return;
      }

      if (state === 'gameover') {
        state = 'playing';
        initLevel(currentLevel);
        return;
      }

      if (state === 'levelComplete') {
        // Check next button
        if (pos.x >= W / 2 - 90 && pos.x <= W / 2 + 90 && pos.y >= 380 && pos.y <= 428) {
          if (currentLevel >= levels.length - 1) {
            state = 'menu';
            totalScore = 0;
          } else {
            currentLevel++;
            state = 'playing';
            initLevel(currentLevel);
          }
        }
        return;
      }

      if (state === 'playing' && onSurface) {
        const d = dist(pos.x, pos.y, gx, gy);
        if (d < GHOST_R * 3) {
          isAiming = true;
          aimStartX = pos.x;
          aimStartY = pos.y;
          aimX = pos.x;
          aimY = pos.y;
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pos = getMousePos(e);
      _mouseX = pos.x;
      _mouseY = pos.y;

      if (state === 'menu') {
        menuHover = pos.x >= W / 2 - 80 && pos.x <= W / 2 + 80 && pos.y >= 400 && pos.y <= 448;
      }

      if (state === 'levelComplete') {
        nextBtnHover = pos.x >= W / 2 - 90 && pos.x <= W / 2 + 90 && pos.y >= 380 && pos.y <= 428;
      }

      if (state === 'playing') {
        hoveringGhost = onSurface && dist(pos.x, pos.y, gx, gy) < GHOST_R * 3;
        if (isAiming) {
          aimX = pos.x;
          aimY = pos.y;
        }
        canvas.style.cursor = isAiming ? 'grabbing' : hoveringGhost ? 'grab' : 'default';
      }
    };

    const handleMouseUp = () => {
      if (state === 'playing' && isAiming) {
        const dx = aimStartX - aimX;
        const dy = aimStartY - aimY;
        const d = Math.sqrt(dx * dx + dy * dy);

        if (d > 10) {
          const power = Math.min(d / 150, 1);
          const speed = power * MAX_LAUNCH;
          gvx = (dx / d) * speed;
          gvy = (dy / d) * speed;
          onSurface = false;
          launches++;

          // Launch stretch
          if (Math.abs(gvx) > Math.abs(gvy)) {
            scaleX = 1.3;
            scaleY = 0.7;
          } else {
            scaleX = 0.7;
            scaleY = 1.3;
          }

          spawnParticles(gx, gy, 6, '#51e2ff', 2);
        }
        isAiming = false;
        canvas.style.cursor = 'default';
      }
    };

    // Touch support
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      handleMouseUp();
    };

    // Keyboard support
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      keysDown[key] = true;

      // Prevent page scroll on arrow keys / space when canvas is focused
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
        e.preventDefault();
      }

      if (state === 'menu') {
        if (key === ' ' || key === 'Enter') {
          state = 'playing';
          currentLevel = 0;
          totalScore = 0;
          initLevel(0);
        }
        return;
      }

      if (state === 'gameover') {
        if (key === ' ' || key === 'Enter') {
          state = 'playing';
          initLevel(currentLevel);
        }
        return;
      }

      if (state === 'levelComplete') {
        if (key === ' ' || key === 'Enter') {
          if (currentLevel >= levels.length - 1) {
            state = 'menu';
            totalScore = 0;
          } else {
            currentLevel++;
            state = 'playing';
            initLevel(currentLevel);
          }
        }
        return;
      }

      if (state === 'playing') {
        // R to restart level
        if (key === 'r' || key === 'R') {
          initLevel(currentLevel);
          state = 'playing';
          return;
        }

        // Space starts charging when aiming with keyboard
        if (key === ' ' && onSurface && kbAiming && !kbCharging) {
          kbCharging = true;
          kbChargePower = 0;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key;
      keysDown[key] = false;

      // Launch on space release while charging
      if (state === 'playing' && key === ' ' && kbCharging) {
        const power = Math.max(kbChargePower, 0.15);
        const speed = power * MAX_LAUNCH;
        gvx = kbDirX * speed;
        gvy = kbDirY * speed;
        onSurface = false;
        launches++;

        // Launch stretch
        if (Math.abs(gvx) > Math.abs(gvy)) {
          scaleX = 1.3;
          scaleY = 0.7;
        } else {
          scaleX = 0.7;
          scaleY = 1.3;
        }

        spawnParticles(gx, gy, 6, '#51e2ff', 2);
        kbCharging = false;
        kbAiming = false;
        kbChargePower = 0;
      }

      // Stop aiming if no direction keys held
      const hasDir = keysDown['ArrowLeft'] || keysDown['ArrowRight'] ||
        keysDown['ArrowUp'] || keysDown['ArrowDown'] ||
        keysDown['a'] || keysDown['d'] || keysDown['w'] || keysDown['s'];
      if (!hasDir && !kbCharging) {
        kbAiming = false;
      }
    };

    // ── Attach events ──
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Start
    rafId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: W,
        height: 'auto',
        imageRendering: 'pixelated',
      }}
    />
  );
}
