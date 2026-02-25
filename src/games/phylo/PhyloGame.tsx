'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd } from '@/lib/game-events';
import { TouchController, isTouchDevice } from '@/lib/touch-controls';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 800;
const H = 600;
const BG = '#0a0a1a';
const EMERALD = '#10b981';
const EMERALD_DIM = '#065f46';
const EMERALD_GLOW = '#34d399';
const EMERALD_DARK = '#047857';
const BRANCH_BASE = '#92400e';
const BRANCH_GREEN = '#166534';
const BRANCH_HEALTHY = '#22c55e';
const BRANCH_CRACKED = '#dc2626';
const HUD_TEXT = '#e5e7eb';
const HUD_DIM = '#9ca3af';

const STAGING_Y = 70;
const TREE_ROOT_X = W / 2;
const TREE_ROOT_Y = H - 60;

const MAX_MISTAKES = 3;
const PLACEMENT_TIME_BONUS_WINDOW = 20; // seconds

type GameState = 'menu' | 'playing' | 'gameover';

// ---------------------------------------------------------------------------
// Trait Types
// ---------------------------------------------------------------------------

type BodyType = 'blob' | 'segmented' | 'shell' | 'elongated';
type LocomotionType = 'legs' | 'wings' | 'fins' | 'none';
type CoveringType = 'fur' | 'scales' | 'feathers' | 'smooth';
type EyeType = 0 | 2 | 4 | 'many';
type AppendageType = 'claws' | 'tentacles' | 'hands' | 'none';
type PatternType = 'spots' | 'stripes' | 'solid' | 'gradient';

const BODY_OPTIONS: BodyType[] = ['blob', 'segmented', 'shell', 'elongated'];
const LOCOMOTION_OPTIONS: LocomotionType[] = ['legs', 'wings', 'fins', 'none'];
const COVERING_OPTIONS: CoveringType[] = ['fur', 'scales', 'feathers', 'smooth'];
const EYE_OPTIONS: EyeType[] = [0, 2, 4, 'many'];
const APPENDAGE_OPTIONS: AppendageType[] = ['claws', 'tentacles', 'hands', 'none'];
const PATTERN_OPTIONS: PatternType[] = ['spots', 'stripes', 'solid', 'gradient'];

interface Creature {
  body: BodyType;
  locomotion: LocomotionType;
  covering: CoveringType;
  eyes: EyeType;
  appendages: AppendageType;
  pattern: PatternType;
  hue: number; // 0-360
  name: string;
}

// ---------------------------------------------------------------------------
// Tree Types
// ---------------------------------------------------------------------------

interface TreeNode {
  x: number;
  y: number;
  creature: Creature | null;
  children: TreeNode[];
  parent: TreeNode | null;
  health: number; // 0-1, 1 = healthy, 0 = dead
  crackLevel: number; // 0-3
  growthProgress: number; // 0-1 for animation
  isEndpoint: boolean;
  depth: number;
  branchAngle: number; // angle from parent
}

// ---------------------------------------------------------------------------
// Particle & FloatingText
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
  type: 'leaf' | 'sparkle' | 'crack' | 'dna' | 'ember';
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

// ---------------------------------------------------------------------------
// Creature Names
// ---------------------------------------------------------------------------

const NAME_PREFIXES = [
  'Xeno', 'Pyro', 'Cryo', 'Aqua', 'Terra', 'Aero', 'Nyx', 'Sol',
  'Luna', 'Zygo', 'Proto', 'Neo', 'Mega', 'Micro', 'Ultra', 'Quasi',
  'Chromo', 'Phylo', 'Endo', 'Exo', 'Para', 'Meta', 'Hyper', 'Crypto',
];

const NAME_SUFFIXES = [
  'pod', 'worm', 'beast', 'moth', 'slug', 'fin', 'claw', 'wing',
  'shell', 'blob', 'spine', 'fang', 'tusk', 'horn', 'tail', 'mite',
  'saurus', 'derma', 'morph', 'phyte', 'zoon', 'cyte', 'derm', 'plex',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function hslToRgb(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function randItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function generateCreatureName(): string {
  return randItem(NAME_PREFIXES) + randItem(NAME_SUFFIXES);
}

// ---------------------------------------------------------------------------
// Creature Generation
// ---------------------------------------------------------------------------

function generateRandomCreature(): Creature {
  return {
    body: randItem(BODY_OPTIONS),
    locomotion: randItem(LOCOMOTION_OPTIONS),
    covering: randItem(COVERING_OPTIONS),
    eyes: randItem(EYE_OPTIONS),
    appendages: randItem(APPENDAGE_OPTIONS),
    pattern: randItem(PATTERN_OPTIONS),
    hue: Math.floor(Math.random() * 360),
    name: generateCreatureName(),
  };
}

function generateSimilarCreature(base: Creature, sharedTraits: number): Creature {
  const traitKeys: (keyof Omit<Creature, 'hue' | 'name'>)[] = [
    'body', 'locomotion', 'covering', 'eyes', 'appendages', 'pattern',
  ];

  // Pick which traits to keep
  const shuffled = [...traitKeys].sort(() => Math.random() - 0.5);
  const keepTraits = shuffled.slice(0, sharedTraits);

  const creature: Creature = generateRandomCreature();

  for (const key of keepTraits) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (creature as any)[key] = (base as any)[key];
  }

  // Keep hue similar if many shared traits
  if (sharedTraits >= 4) {
    creature.hue = base.hue + randRange(-30, 30);
    if (creature.hue < 0) creature.hue += 360;
    if (creature.hue > 360) creature.hue -= 360;
  }

  creature.name = generateCreatureName();
  return creature;
}

function countSharedTraits(a: Creature, b: Creature): number {
  let count = 0;
  if (a.body === b.body) count++;
  if (a.locomotion === b.locomotion) count++;
  if (a.covering === b.covering) count++;
  if (a.eyes === b.eyes) count++;
  if (a.appendages === b.appendages) count++;
  if (a.pattern === b.pattern) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Creature Drawing
// ---------------------------------------------------------------------------

function drawCreature(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  creature: Creature,
  time: number,
  highlighted: boolean = false,
) {
  ctx.save();

  const s = size;
  const halfS = s / 2;
  const bodyColor = hslToRgb(creature.hue, 65, 55);
  const bodyLight = hslToRgb(creature.hue, 70, 70);
  const bodyDark = hslToRgb(creature.hue, 60, 35);

  // Gentle bob animation
  const bobY = Math.sin(time * 2) * 2;
  const drawY = y + bobY;

  // Glow if highlighted
  if (highlighted) {
    ctx.shadowColor = EMERALD_GLOW;
    ctx.shadowBlur = 15;
  }

  // ── Body Shape ──────────────────────────────────────────
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = bodyDark;
  ctx.lineWidth = 1.5;

  if (creature.body === 'blob') {
    // Rounded amorphous shape
    ctx.beginPath();
    const wobble1 = Math.sin(time * 3) * s * 0.03;
    const wobble2 = Math.cos(time * 2.5) * s * 0.03;
    ctx.ellipse(x + wobble1, drawY + wobble2, halfS * 0.8, halfS * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (creature.body === 'segmented') {
    // 3-4 connected circles
    const segCount = 3;
    const segSize = halfS * 0.38;
    for (let i = segCount - 1; i >= 0; i--) {
      const sx = x + (i - 1) * segSize * 1.2;
      const sy = drawY + Math.sin(time * 3 + i * 0.8) * 2;
      const ss = segSize * (1 - i * 0.1);
      ctx.beginPath();
      ctx.arc(sx, sy, ss, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  } else if (creature.body === 'shell') {
    // Circular body with spiral shell on top
    ctx.beginPath();
    ctx.arc(x, drawY + halfS * 0.15, halfS * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw spiral shell
    ctx.strokeStyle = bodyLight;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const spiralCx = x;
    const spiralCy = drawY - halfS * 0.15;
    for (let a = 0; a < Math.PI * 4; a += 0.1) {
      const r = halfS * 0.1 + a * halfS * 0.06;
      const sx = spiralCx + Math.cos(a) * r * 0.5;
      const sy = spiralCy + Math.sin(a) * r * 0.4;
      if (a === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Shell dome
    ctx.fillStyle = bodyLight;
    ctx.beginPath();
    ctx.ellipse(x, drawY - halfS * 0.15, halfS * 0.5, halfS * 0.4, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = bodyDark;
    ctx.stroke();
  } else if (creature.body === 'elongated') {
    // Long oval body
    ctx.beginPath();
    ctx.ellipse(x, drawY, halfS * 1.0, halfS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Slight taper at back
    ctx.beginPath();
    ctx.moveTo(x + halfS * 0.8, drawY);
    ctx.lineTo(x + halfS * 1.15, drawY - halfS * 0.1);
    ctx.lineTo(x + halfS * 1.15, drawY + halfS * 0.1);
    ctx.closePath();
    ctx.fill();
  }

  // ── Covering / Surface ──────────────────────────────────
  const bodyExtentX = creature.body === 'elongated' ? halfS * 1.0 : halfS * 0.75;
  const bodyExtentY = creature.body === 'elongated' ? halfS * 0.35 : halfS * 0.6;

  if (creature.covering === 'fur') {
    // Small hair lines on edges
    ctx.strokeStyle = bodyLight;
    ctx.lineWidth = 0.8;
    for (let a = 0; a < Math.PI * 2; a += 0.35) {
      const fx = x + Math.cos(a) * bodyExtentX;
      const fy = drawY + Math.sin(a) * bodyExtentY;
      const hairLen = s * 0.06;
      const hairWave = Math.sin(time * 4 + a * 3) * 0.3;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(
        fx + Math.cos(a + hairWave) * hairLen,
        fy + Math.sin(a + hairWave) * hairLen,
      );
      ctx.stroke();
    }
  } else if (creature.covering === 'scales') {
    // Diamond pattern overlay
    ctx.fillStyle = bodyDark;
    ctx.globalAlpha = 0.3;
    const scaleSize = s * 0.06;
    for (let sx = -3; sx <= 3; sx++) {
      for (let sy = -2; sy <= 2; sy++) {
        const dx = sx * scaleSize * 1.5 + (sy % 2 === 0 ? 0 : scaleSize * 0.75);
        const dy = sy * scaleSize * 1.2;
        if (Math.abs(dx) < bodyExtentX * 0.7 && Math.abs(dy) < bodyExtentY * 0.7) {
          ctx.beginPath();
          ctx.moveTo(x + dx, drawY + dy - scaleSize * 0.5);
          ctx.lineTo(x + dx + scaleSize * 0.4, drawY + dy);
          ctx.lineTo(x + dx, drawY + dy + scaleSize * 0.5);
          ctx.lineTo(x + dx - scaleSize * 0.4, drawY + dy);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  } else if (creature.covering === 'feathers') {
    // V-shaped marks
    ctx.strokeStyle = bodyLight;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 6; i++) {
      const fx = x + randRange(-bodyExtentX * 0.5, bodyExtentX * 0.5);
      const fy = drawY + randRange(-bodyExtentY * 0.4, bodyExtentY * 0.4);
      const fSize = s * 0.05;
      // Use deterministic positions based on index
      const ax = x + Math.cos(i * 1.1) * bodyExtentX * 0.4;
      const ay = drawY + Math.sin(i * 1.7) * bodyExtentY * 0.35;
      ctx.beginPath();
      ctx.moveTo(ax - fSize, ay - fSize * 0.5);
      ctx.lineTo(ax, ay + fSize * 0.3);
      ctx.lineTo(ax + fSize, ay - fSize * 0.5);
      ctx.stroke();
      void fx; void fy; // suppress unused
    }
    ctx.globalAlpha = 1;
  }
  // smooth: just clean surface, maybe a slight highlight
  if (creature.covering === 'smooth') {
    ctx.fillStyle = bodyLight;
    ctx.globalAlpha = 0.15;
    ctx.beginPath();
    ctx.ellipse(x - bodyExtentX * 0.2, drawY - bodyExtentY * 0.2, bodyExtentX * 0.3, bodyExtentY * 0.3, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ── Pattern ─────────────────────────────────────────────
  if (creature.pattern === 'spots') {
    ctx.fillStyle = bodyDark;
    ctx.globalAlpha = 0.35;
    const spotPositions = [
      [-0.2, -0.15], [0.15, 0.1], [-0.1, 0.2], [0.25, -0.1], [0, 0.05],
      [-0.3, 0.05], [0.1, -0.25],
    ];
    for (const [spx, spy] of spotPositions) {
      const spotX = x + spx * bodyExtentX;
      const spotY = drawY + spy * bodyExtentY;
      ctx.beginPath();
      ctx.arc(spotX, spotY, s * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  } else if (creature.pattern === 'stripes') {
    ctx.strokeStyle = bodyDark;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.3;
    for (let i = -2; i <= 2; i++) {
      const stripeX = x + i * bodyExtentX * 0.3;
      ctx.beginPath();
      ctx.moveTo(stripeX, drawY - bodyExtentY * 0.5);
      ctx.lineTo(stripeX, drawY + bodyExtentY * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  } else if (creature.pattern === 'gradient') {
    const grad = ctx.createRadialGradient(x, drawY, 0, x, drawY, bodyExtentX);
    grad.addColorStop(0, bodyLight);
    grad.addColorStop(1, bodyDark);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.ellipse(x, drawY, bodyExtentX * 0.8, bodyExtentY * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // solid: nothing extra

  // ── Eyes ─────────────────────────────────────────────────
  const eyeSize = s * 0.06;
  const eyeY = drawY - bodyExtentY * 0.15;
  const eyeXBase = x - bodyExtentX * 0.25;

  const drawEye = (ex: number, ey: number) => {
    // White
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex, ey, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(ex + eyeSize * 0.2, ey, eyeSize * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // Shine
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex + eyeSize * 0.3, ey - eyeSize * 0.3, eyeSize * 0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  if (creature.eyes === 2) {
    drawEye(eyeXBase, eyeY);
    drawEye(eyeXBase + bodyExtentX * 0.5, eyeY);
  } else if (creature.eyes === 4) {
    drawEye(eyeXBase - bodyExtentX * 0.1, eyeY - eyeSize);
    drawEye(eyeXBase + bodyExtentX * 0.4, eyeY - eyeSize);
    drawEye(eyeXBase, eyeY + eyeSize);
    drawEye(eyeXBase + bodyExtentX * 0.5, eyeY + eyeSize);
  } else if (creature.eyes === 'many') {
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI - Math.PI * 0.5;
      const r = bodyExtentX * 0.35;
      drawEye(x + Math.cos(angle) * r, drawY + Math.sin(angle) * r * 0.6 - bodyExtentY * 0.1);
    }
  }
  // 0 eyes: no eyes drawn (creepy)

  // ── Locomotion ──────────────────────────────────────────
  const bodyBottom = drawY + bodyExtentY * 0.6;

  if (creature.locomotion === 'legs') {
    ctx.strokeStyle = bodyDark;
    ctx.lineWidth = 2;
    const legCount = creature.body === 'segmented' ? 6 : creature.body === 'blob' ? 2 : 4;
    const legSpacing = bodyExtentX * 1.4 / (legCount - 1);
    for (let i = 0; i < legCount; i++) {
      const legX = x - bodyExtentX * 0.7 + i * legSpacing;
      const legWalk = Math.sin(time * 6 + i * Math.PI) * 3;
      ctx.beginPath();
      ctx.moveTo(legX, bodyBottom - 2);
      ctx.lineTo(legX + legWalk, bodyBottom + s * 0.15);
      ctx.lineTo(legX + legWalk + 3, bodyBottom + s * 0.15);
      ctx.stroke();
    }
  } else if (creature.locomotion === 'wings') {
    ctx.fillStyle = bodyLight;
    ctx.globalAlpha = 0.6;
    const wingFlap = Math.sin(time * 5) * 0.3;

    // Left wing
    ctx.save();
    ctx.translate(x - bodyExtentX * 0.5, drawY - bodyExtentY * 0.2);
    ctx.rotate(-0.5 + wingFlap);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-s * 0.4, -s * 0.2, -s * 0.5, 0);
    ctx.quadraticCurveTo(-s * 0.3, s * 0.1, 0, 0);
    ctx.fill();
    ctx.restore();

    // Right wing
    ctx.save();
    ctx.translate(x + bodyExtentX * 0.5, drawY - bodyExtentY * 0.2);
    ctx.rotate(0.5 - wingFlap);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 0.4, -s * 0.2, s * 0.5, 0);
    ctx.quadraticCurveTo(s * 0.3, s * 0.1, 0, 0);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = 1;
  } else if (creature.locomotion === 'fins') {
    ctx.fillStyle = bodyLight;
    ctx.globalAlpha = 0.5;
    const finWave = Math.sin(time * 4) * 0.2;

    // Left fin
    ctx.save();
    ctx.translate(x - bodyExtentX * 0.6, drawY);
    ctx.rotate(-0.3 + finWave);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.06, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Right fin
    ctx.save();
    ctx.translate(x + bodyExtentX * 0.6, drawY);
    ctx.rotate(0.3 - finWave);
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.06, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.globalAlpha = 1;
  }
  // none: no locomotion appendages

  // ── Appendages ──────────────────────────────────────────
  if (creature.appendages === 'claws') {
    ctx.strokeStyle = bodyDark;
    ctx.lineWidth = 2;
    const clawX = x - bodyExtentX * 0.6;
    for (let i = 0; i < 2; i++) {
      const cx = clawX + i * bodyExtentX * 1.2;
      const cy = drawY + bodyExtentY * 0.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (i === 0 ? -s * 0.1 : s * 0.1), cy + s * 0.05);
      ctx.lineTo(cx + (i === 0 ? -s * 0.15 : s * 0.15), cy - s * 0.02);
      ctx.stroke();
    }
  } else if (creature.appendages === 'tentacles') {
    ctx.strokeStyle = bodyColor;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const tx = x - bodyExtentX * 0.3 + i * bodyExtentX * 0.2;
      const ty = bodyBottom;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      const wave = Math.sin(time * 3 + i * 1.5) * s * 0.08;
      ctx.quadraticCurveTo(
        tx + wave, ty + s * 0.1,
        tx + wave * 1.5, ty + s * 0.2,
      );
      ctx.stroke();
    }
  } else if (creature.appendages === 'hands') {
    ctx.fillStyle = bodyLight;
    const handSize = s * 0.05;
    // Left hand
    ctx.beginPath();
    ctx.arc(x - bodyExtentX * 0.7, drawY + bodyExtentY * 0.1, handSize, 0, Math.PI * 2);
    ctx.fill();
    // Little fingers
    for (let f = 0; f < 3; f++) {
      const angle = -Math.PI * 0.5 + (f - 1) * 0.4;
      ctx.beginPath();
      ctx.arc(
        x - bodyExtentX * 0.7 + Math.cos(angle) * handSize * 1.3,
        drawY + bodyExtentY * 0.1 + Math.sin(angle) * handSize * 1.3,
        handSize * 0.35, 0, Math.PI * 2,
      );
      ctx.fill();
    }
    // Right hand
    ctx.beginPath();
    ctx.arc(x + bodyExtentX * 0.7, drawY + bodyExtentY * 0.1, handSize, 0, Math.PI * 2);
    ctx.fill();
    for (let f = 0; f < 3; f++) {
      const angle = -Math.PI * 0.5 + (f - 1) * 0.4;
      ctx.beginPath();
      ctx.arc(
        x + bodyExtentX * 0.7 + Math.cos(angle) * handSize * 1.3,
        drawY + bodyExtentY * 0.1 + Math.sin(angle) * handSize * 1.3,
        handSize * 0.35, 0, Math.PI * 2,
      );
      ctx.fill();
    }
  }
  // none: no appendages

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Creature Thumbnail (for tree nodes)
// ---------------------------------------------------------------------------

function drawCreatureThumbnail(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  creature: Creature,
  time: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
  ctx.clip();
  drawCreature(ctx, x, y, size, creature, time, false);
  ctx.restore();

  // Circle border
  ctx.strokeStyle = hslToRgb(creature.hue, 60, 50);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.55, 0, Math.PI * 2);
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PhyloGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    // DPI-aware setup
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    let destroyed = false;
    let animId = 0;

    // -------------------------------------------------------------------
    // Touch controller
    // -------------------------------------------------------------------

    const touch = isTouchDevice();
    const touchCtrl = touch ? new TouchController(canvas) : null;

    // -------------------------------------------------------------------
    // Game State Variables
    // -------------------------------------------------------------------

    let state: GameState = 'menu';
    let lastTime = 0;
    let gameTime = 0;
    let menuTime = 0;
    let paused = false;

    let highScore = getHighScore('phylo');
    let newHighScoreFlag = false;

    // Core game
    let score = 0;
    let round = 0;
    let mistakes = 0;
    let streak = 0;
    let bestStreak = 0;
    let speciesPlaced = 0;
    let placementTimer = 0; // seconds since creature appeared
    let difficultyMultiplier = 1.0;

    // Tree
    let treeRoot: TreeNode | null = null;
    let allNodes: TreeNode[] = [];
    let endpoints: TreeNode[] = [];

    // Current creature to place
    let currentCreature: Creature | null = null;
    let creatureAnim = 0; // animation timer for staging area

    // Convergent evolution warning
    let curveball = false;
    let curveballTimer = 0;
    let roundsSinceCurveball = 0;

    // Mouse state
    let mouseX = 0;
    let mouseY = 0;
    let hoveredEndpoint: TreeNode | null = null;

    // Particles & effects
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];

    // Screen shake
    let shakeAmount = 0;
    let shakeTimer = 0;

    // Tree collapse animation for game over
    let collapseTimer = 0;
    let collapseStarted = false;

    // Growth animation
    let growingBranch: TreeNode | null = null;
    let growthTimer = 0;
    let growthDuration = 0.5;

    // Menu background tree
    let menuTree: TreeNode | null = null;
    let menuCreatures: Creature[] = [];

    // -------------------------------------------------------------------
    // Tree Building
    // -------------------------------------------------------------------

    function createNode(
      x: number,
      y: number,
      parent: TreeNode | null,
      creature: Creature | null,
      depth: number,
      angle: number,
    ): TreeNode {
      const node: TreeNode = {
        x,
        y,
        creature,
        children: [],
        parent,
        health: 1.0,
        crackLevel: 0,
        growthProgress: 1.0,
        isEndpoint: true,
        depth,
        branchAngle: angle,
      };
      if (parent) {
        parent.children.push(node);
        parent.isEndpoint = false;
      }
      return node;
    }

    function getAllNodes(root: TreeNode): TreeNode[] {
      const nodes: TreeNode[] = [root];
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop()!;
        for (const child of node.children) {
          nodes.push(child);
          stack.push(child);
        }
      }
      return nodes;
    }

    function getEndpoints(nodes: TreeNode[]): TreeNode[] {
      return nodes.filter((n) => n.isEndpoint && n.creature !== null);
    }

    function buildInitialTree(): TreeNode {
      // Root at bottom center
      const root = createNode(TREE_ROOT_X, TREE_ROOT_Y, null, generateRandomCreature(), 0, 0);

      // Generate 2-3 initial branches
      const branchCount = 2 + Math.floor(Math.random() * 2);
      const angleSpread = Math.PI * 0.6;
      const startAngle = -Math.PI / 2 - angleSpread / 2;
      const branchLength = 80;

      for (let i = 0; i < branchCount; i++) {
        const angle = startAngle + (i / (branchCount - 1)) * angleSpread;
        const bx = root.x + Math.cos(angle) * branchLength;
        const by = root.y + Math.sin(angle) * branchLength;

        // Generate creature similar to root
        const creature = generateSimilarCreature(root.creature!, 3 + Math.floor(Math.random() * 2));
        createNode(bx, by, root, creature, 1, angle);
      }

      return root;
    }

    function buildMenuTree(): TreeNode {
      const root = createNode(W / 2, H - 80, null, generateRandomCreature(), 0, 0);
      menuCreatures = [root.creature!];

      function addBranch(parent: TreeNode, depth: number) {
        if (depth > 4) return;
        const count = depth < 2 ? 3 : 2;
        const angleSpread = Math.PI * (0.5 - depth * 0.05);
        const branchLen = 70 - depth * 10;

        for (let i = 0; i < count; i++) {
          const baseAngle = parent.parent
            ? parent.branchAngle
            : -Math.PI / 2;
          const offset = (i - (count - 1) / 2) * (angleSpread / count);
          const angle = baseAngle + offset + randRange(-0.15, 0.15);
          const bx = parent.x + Math.cos(angle) * branchLen;
          const by = parent.y + Math.sin(angle) * branchLen;

          // Keep within bounds
          if (bx < 50 || bx > W - 50 || by < 50) continue;

          const creature = generateSimilarCreature(parent.creature!, 2 + Math.floor(Math.random() * 3));
          const node = createNode(bx, by, parent, creature, depth, angle);
          menuCreatures.push(creature);

          if (Math.random() > 0.4) {
            addBranch(node, depth + 1);
          }
        }
      }

      addBranch(root, 1);
      return root;
    }

    // -------------------------------------------------------------------
    // Find best placement match
    // -------------------------------------------------------------------

    function getBranchNeighborCreature(endpoint: TreeNode): Creature | null {
      // Walk up to find the nearest ancestor with a creature
      let node: TreeNode | null = endpoint;
      while (node) {
        if (node.creature) return node.creature;
        node = node.parent;
      }
      return null;
    }

    function evaluatePlacement(endpoint: TreeNode, creature: Creature): number {
      const neighbor = getBranchNeighborCreature(endpoint);
      if (!neighbor) return 0;
      return countSharedTraits(creature, neighbor);
    }

    function findBestEndpoint(creature: Creature): { node: TreeNode; score: number } | null {
      let best: TreeNode | null = null;
      let bestScore = -1;

      for (const ep of endpoints) {
        const s = evaluatePlacement(ep, creature);
        if (s > bestScore) {
          bestScore = s;
          best = ep;
        }
      }

      return best ? { node: best, score: bestScore } : null;
    }

    // -------------------------------------------------------------------
    // Add new branch after placement
    // -------------------------------------------------------------------

    function addNewBranches(parentNode: TreeNode) {
      // Add 1-2 new endpoint branches growing from this node
      const newBranchCount = 1 + (Math.random() > 0.5 ? 1 : 0);
      const branchLength = Math.max(40, 75 - parentNode.depth * 8);

      for (let i = 0; i < newBranchCount; i++) {
        const baseAngle = parentNode.parent
          ? parentNode.branchAngle
          : -Math.PI / 2;
        const spread = Math.PI * 0.4;
        const offset = (i - (newBranchCount - 1) / 2) * spread;
        let angle = baseAngle + offset + randRange(-0.25, 0.25);

        // Keep branches going upward mostly
        if (angle > -0.1) angle = -0.1 - Math.random() * 0.5;
        if (angle < -Math.PI + 0.1) angle = -Math.PI + 0.1 + Math.random() * 0.5;

        const nx = parentNode.x + Math.cos(angle) * branchLength;
        const ny = parentNode.y + Math.sin(angle) * branchLength;

        // Clamp to screen
        const clampedX = Math.max(40, Math.min(W - 40, nx));
        const clampedY = Math.max(60, Math.min(H - 80, ny));

        const newNode = createNode(
          clampedX, clampedY, parentNode, null,
          parentNode.depth + 1, angle,
        );
        newNode.growthProgress = 0;
        newNode.isEndpoint = true;

        // Animate growth
        growingBranch = newNode;
        growthTimer = 0;
      }

      // Refresh node lists
      allNodes = getAllNodes(treeRoot!);
      endpoints = getEndpoints(allNodes);
    }

    // -------------------------------------------------------------------
    // Spawn next creature
    // -------------------------------------------------------------------

    function spawnNextCreature() {
      roundsSinceCurveball++;
      round++;

      // Update difficulty
      if (round <= 5) {
        difficultyMultiplier = 1.0;
      } else if (round <= 10) {
        difficultyMultiplier = 1.2;
      } else if (round <= 15) {
        difficultyMultiplier = 1.5;
      } else {
        difficultyMultiplier = 2.0;
      }

      // Check for curveball
      curveball = false;
      if (round > 3 && roundsSinceCurveball >= 4 && Math.random() < 0.35) {
        curveball = true;
        curveballTimer = 1.5;
        roundsSinceCurveball = 0;
      }

      // Generate a creature that has a valid placement
      if (endpoints.length === 0) {
        // Need to add new endpoints
        for (const node of allNodes) {
          if (node.children.length < 2) {
            addNewBranches(node);
            break;
          }
        }
        endpoints = getEndpoints(allNodes);
      }

      // Determine desired shared traits based on difficulty
      let targetShared: number;
      if (round <= 5) {
        targetShared = 3 + Math.floor(Math.random() * 2); // 3-4
      } else if (round <= 10) {
        targetShared = 2 + Math.floor(Math.random() * 3); // 2-4
      } else if (round <= 15) {
        targetShared = 2 + Math.floor(Math.random() * 2); // 2-3
      } else {
        targetShared = 1 + Math.floor(Math.random() * 3); // 1-3
      }

      // Pick a random endpoint to be the "correct" placement
      const correctEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
      const neighborCreature = getBranchNeighborCreature(correctEndpoint);

      if (neighborCreature) {
        if (curveball) {
          // Generate a creature that looks like it belongs on one branch
          // but actually matches better with the correct one
          const decoyEndpoint = endpoints.find((ep) => ep !== correctEndpoint);
          if (decoyEndpoint) {
            const decoyNeighbor = getBranchNeighborCreature(decoyEndpoint);
            if (decoyNeighbor) {
              // Share visual traits (covering, pattern) with decoy
              // but share structural traits (body, locomotion, eyes, appendages) with correct
              currentCreature = generateSimilarCreature(neighborCreature, targetShared + 1);
              // Override visual traits to look like decoy
              currentCreature.covering = decoyNeighbor.covering;
              currentCreature.pattern = decoyNeighbor.pattern;
              currentCreature.hue = decoyNeighbor.hue + randRange(-20, 20);
            } else {
              currentCreature = generateSimilarCreature(neighborCreature, targetShared);
            }
          } else {
            currentCreature = generateSimilarCreature(neighborCreature, targetShared);
          }
        } else {
          currentCreature = generateSimilarCreature(neighborCreature, targetShared);
        }
      } else {
        currentCreature = generateRandomCreature();
      }

      placementTimer = 0;
      creatureAnim = 0;
    }

    // -------------------------------------------------------------------
    // Place creature on tree
    // -------------------------------------------------------------------

    function placeCreature(endpoint: TreeNode) {
      if (!currentCreature) return;

      const sharedTraits = evaluatePlacement(endpoint, currentCreature);
      let quality: 'perfect' | 'good' | 'okay' | 'wrong';
      let points = 0;

      if (sharedTraits >= 4) {
        quality = 'perfect';
        points = 150;
      } else if (sharedTraits === 3) {
        quality = 'good';
        points = 100;
      } else if (sharedTraits === 2) {
        quality = 'okay';
        points = 50;
      } else {
        quality = 'wrong';
        points = 0;
      }

      // Speed bonus
      const speedBonus = Math.max(0, Math.floor((PLACEMENT_TIME_BONUS_WINDOW - placementTimer) * 3));
      if (quality !== 'wrong') {
        points += speedBonus;
      }

      // Streak
      if (quality === 'perfect' || quality === 'good') {
        streak++;
        if (streak > bestStreak) bestStreak = streak;
      } else {
        streak = 0;
      }

      // Streak multiplier: 1x, 1.5x, 2x, 2.5x, 3x
      const streakMultiplier = Math.min(3, 1 + (streak - 1) * 0.5);
      if (quality !== 'wrong' && streak > 1) {
        points = Math.floor(points * streakMultiplier);
      }

      // Difficulty multiplier
      points = Math.floor(points * difficultyMultiplier);

      score += points;
      speciesPlaced++;

      // Place creature on node
      endpoint.creature = currentCreature;

      // Visual & sound feedback
      if (quality === 'perfect') {
        endpoint.health = 1.0;
        SoundEngine.play('collectGem');
        spawnPlacementParticles(endpoint.x, endpoint.y, EMERALD_GLOW, 20, 'sparkle');
        spawnPlacementParticles(endpoint.x, endpoint.y, '#fbbf24', 10, 'sparkle');
        addFloatingText(endpoint.x, endpoint.y - 30, `PERFECT! +${points}`, '#fbbf24', 22);
        if (streak > 1) {
          addFloatingText(endpoint.x, endpoint.y - 55, `${streakMultiplier}x STREAK!`, EMERALD_GLOW, 16);
        }
      } else if (quality === 'good') {
        endpoint.health = 0.9;
        SoundEngine.play('collectStar');
        spawnPlacementParticles(endpoint.x, endpoint.y, EMERALD, 12, 'leaf');
        addFloatingText(endpoint.x, endpoint.y - 30, `GOOD +${points}`, EMERALD, 20);
        if (streak > 1) {
          addFloatingText(endpoint.x, endpoint.y - 55, `${streakMultiplier}x STREAK!`, EMERALD_GLOW, 14);
        }
      } else if (quality === 'okay') {
        endpoint.health = 0.6;
        SoundEngine.play('wallHit');
        addFloatingText(endpoint.x, endpoint.y - 30, `OKAY +${points}`, '#fbbf24', 18);
      } else {
        // Wrong placement
        mistakes++;
        endpoint.health = 0.3;
        endpoint.crackLevel = Math.min(3, endpoint.crackLevel + 1);
        SoundEngine.play('playerDamage');
        spawnPlacementParticles(endpoint.x, endpoint.y, '#ef4444', 15, 'crack');
        addFloatingText(endpoint.x, endpoint.y - 30, 'WRONG!', '#ef4444', 22);
        shakeAmount = 8;
        shakeTimer = 0.3;

        // Crack parent branches too
        let node: TreeNode | null = endpoint.parent;
        while (node) {
          node.health = Math.max(0.3, node.health - 0.15);
          node.crackLevel = Math.min(3, node.crackLevel + 1);
          node = node.parent;
        }

        if (mistakes >= MAX_MISTAKES) {
          triggerGameOver();
          return;
        }
      }

      // Add new branches growing from this placement
      addNewBranches(endpoint);

      // Level complete sound every 5 rounds
      if (round % 5 === 0 && round > 0) {
        SoundEngine.play('levelComplete');
        addFloatingText(W / 2, H / 2 - 50, `EPOCH ${Math.floor(round / 5) + 1}`, EMERALD_GLOW, 28);
      }

      // Spawn next creature
      spawnNextCreature();
    }

    // -------------------------------------------------------------------
    // Game Over
    // -------------------------------------------------------------------

    function triggerGameOver() {
      state = 'gameover';
      collapseTimer = 0;
      collapseStarted = true;
      SoundEngine.play('gameOver');
      reportGameEnd('phylo', score, false);

      if (score > highScore) {
        highScore = score;
        setHighScore('phylo', score);
        newHighScoreFlag = true;
        SoundEngine.play('newHighScore');
      }

      // Spawn collapse particles from all nodes
      for (const node of allNodes) {
        spawnPlacementParticles(node.x, node.y, '#ef4444', 5, 'ember');
        spawnPlacementParticles(node.x, node.y, BRANCH_BASE, 3, 'crack');
      }

      SoundEngine.stopAmbient();
    }

    // -------------------------------------------------------------------
    // Start Game
    // -------------------------------------------------------------------

    function startGame() {
      score = 0;
      round = 0;
      mistakes = 0;
      streak = 0;
      bestStreak = 0;
      speciesPlaced = 0;
      placementTimer = 0;
      difficultyMultiplier = 1.0;
      particles = [];
      floatingTexts = [];
      shakeAmount = 0;
      shakeTimer = 0;
      collapseTimer = 0;
      collapseStarted = false;
      newHighScoreFlag = false;
      growingBranch = null;
      growthTimer = 0;
      curveball = false;
      curveballTimer = 0;
      roundsSinceCurveball = 0;
      gameTime = 0;
      paused = false;
      highScore = getHighScore('phylo');

      // Build tree
      treeRoot = buildInitialTree();
      allNodes = getAllNodes(treeRoot);
      endpoints = getEndpoints(allNodes);

      state = 'playing';
      reportGameStart('phylo');
      SoundEngine.startAmbient('organic');

      // Spawn first creature
      spawnNextCreature();
    }

    // -------------------------------------------------------------------
    // Particles & Effects
    // -------------------------------------------------------------------

    function spawnPlacementParticles(
      x: number,
      y: number,
      color: string,
      count: number,
      type: Particle['type'],
    ) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = 40 + Math.random() * 100;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          life: 0.6 + Math.random() * 0.6,
          maxLife: 0.6 + Math.random() * 0.6,
          color,
          size: type === 'leaf' ? 3 + Math.random() * 4 : 1.5 + Math.random() * 3,
          type,
        });
      }
    }

    function addFloatingText(
      x: number,
      y: number,
      text: string,
      color: string,
      size: number,
    ) {
      floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1.8,
        maxLife: 1.8,
        vy: -35,
        size,
      });
    }

    function spawnBackgroundParticle() {
      // Occasional DNA helix or leaf particle in background
      if (Math.random() < 0.02) {
        const type = Math.random() > 0.5 ? 'dna' : 'leaf';
        particles.push({
          x: Math.random() * W,
          y: H + 10,
          vx: randRange(-10, 10),
          vy: randRange(-40, -20),
          life: 4 + Math.random() * 3,
          maxLife: 4 + Math.random() * 3,
          color: type === 'dna' ? EMERALD_DIM : '#166534',
          size: 2 + Math.random() * 3,
          type,
        });
      }
    }

    // -------------------------------------------------------------------
    // Input Handling
    // -------------------------------------------------------------------

    function getCanvasPos(clientX: number, clientY: number): { x: number; y: number } {
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function findEndpointNearMouse(): TreeNode | null {
      const hoverRadius = 30;
      let closest: TreeNode | null = null;
      let closestDist = hoverRadius;

      for (const ep of endpoints) {
        const d = dist(mouseX, mouseY, ep.x, ep.y);
        if (d < closestDist) {
          closestDist = d;
          closest = ep;
        }
      }

      return closest;
    }

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
    }

    function handleMouseMove(e: MouseEvent) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      mouseX = pos.x;
      mouseY = pos.y;

      if (state === 'playing' && !paused) {
        hoveredEndpoint = findEndpointNearMouse();
      }
    }

    function handleClick(e: MouseEvent) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      mouseX = pos.x;
      mouseY = pos.y;

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

      if (state === 'playing' && !paused) {
        const ep = findEndpointNearMouse();
        if (ep && currentCreature) {
          SoundEngine.play('place');
          placeCreature(ep);
        }
      }
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const pos = getCanvasPos(t.clientX, t.clientY);
      mouseX = pos.x;
      mouseY = pos.y;

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

      if (state === 'playing' && !paused) {
        hoveredEndpoint = findEndpointNearMouse();
        if (hoveredEndpoint && currentCreature) {
          SoundEngine.play('place');
          placeCreature(hoveredEndpoint);
        }
      }
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const t = e.touches[0];
      const pos = getCanvasPos(t.clientX, t.clientY);
      mouseX = pos.x;
      mouseY = pos.y;

      if (state === 'playing' && !paused) {
        hoveredEndpoint = findEndpointNearMouse();
      }
    }

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    // -------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------

    function update(dt: number) {
      // Always update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.type === 'leaf') {
          p.vx += Math.sin(gameTime * 2 + p.x * 0.01) * 20 * dt;
          p.vy -= 10 * dt; // float up
        } else if (p.type === 'sparkle') {
          p.vy -= 15 * dt;
        } else if (p.type === 'dna') {
          p.x += Math.sin(gameTime * 3 + p.y * 0.02) * 15 * dt;
        } else if (p.type === 'ember') {
          p.vy += 80 * dt; // gravity
        } else {
          p.vy += 120 * dt; // gravity for crack
        }

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

      // Screen shake
      if (shakeTimer > 0) {
        shakeTimer -= dt;
        if (shakeTimer <= 0) {
          shakeAmount = 0;
        }
      }

      if (state !== 'playing' || paused) return;

      gameTime += dt;
      placementTimer += dt;
      creatureAnim += dt;

      // Curveball indicator timer
      if (curveballTimer > 0) {
        curveballTimer -= dt;
      }

      // Growth animation
      if (growingBranch) {
        growthTimer += dt;
        const progress = Math.min(1, growthTimer / growthDuration);
        growingBranch.growthProgress = easeOutBack(progress);
        if (progress >= 1) {
          growingBranch.growthProgress = 1;
          growingBranch = null;
        }
      }

      // Background particles
      spawnBackgroundParticle();

      // Update hover
      hoveredEndpoint = findEndpointNearMouse();
    }

    // -------------------------------------------------------------------
    // Drawing: Background
    // -------------------------------------------------------------------

    function drawBackground() {
      // Dark background
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Subtle DNA / leaf pattern
      ctx.globalAlpha = 0.03;
      ctx.strokeStyle = EMERALD;
      ctx.lineWidth = 1;
      const patternOffset = (gameTime || menuTime) * 5;
      for (let i = 0; i < 8; i++) {
        const px = (i * 120 + patternOffset) % (W + 200) - 100;
        // DNA helix
        ctx.beginPath();
        for (let y = 0; y < H; y += 3) {
          const wave = Math.sin(y * 0.02 + i) * 30;
          ctx.lineTo(px + wave, y);
        }
        ctx.stroke();
        ctx.beginPath();
        for (let y = 0; y < H; y += 3) {
          const wave = Math.sin(y * 0.02 + i + Math.PI) * 30;
          ctx.lineTo(px + wave, y);
        }
        ctx.stroke();

        // Rungs
        for (let y = 0; y < H; y += 20) {
          const w1 = Math.sin(y * 0.02 + i) * 30;
          const w2 = Math.sin(y * 0.02 + i + Math.PI) * 30;
          ctx.beginPath();
          ctx.moveTo(px + w1, y);
          ctx.lineTo(px + w2, y);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // -------------------------------------------------------------------
    // Drawing: Tree
    // -------------------------------------------------------------------

    function drawBranch(parent: TreeNode, child: TreeNode) {
      // Calculate branch color based on health
      const health = child.health;
      const r = Math.floor(lerp(220, 34, health)); // red to green
      const g = Math.floor(lerp(50, 139, health));
      const b = Math.floor(lerp(50, 34, health));
      const branchColor = `rgb(${r}, ${g}, ${b})`;

      // Branch thickness based on depth and health
      const thickness = Math.max(2, (6 - child.depth) * health + 1);

      // Growth animation
      const progress = child.growthProgress;
      const endX = lerp(parent.x, child.x, progress);
      const endY = lerp(parent.y, child.y, progress);

      // Draw branch
      ctx.strokeStyle = branchColor;
      ctx.lineWidth = thickness;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(parent.x, parent.y);

      // Slightly curved branch
      const midX = (parent.x + endX) / 2 + (child.branchAngle > -Math.PI / 2 ? 5 : -5);
      const midY = (parent.y + endY) / 2;
      ctx.quadraticCurveTo(midX, midY, endX, endY);
      ctx.stroke();

      // Draw cracks
      if (child.crackLevel > 0) {
        ctx.strokeStyle = 'rgba(220, 38, 38, 0.6)';
        ctx.lineWidth = 1;
        const bx = (parent.x + endX) / 2;
        const by = (parent.y + endY) / 2;

        for (let c = 0; c < child.crackLevel; c++) {
          const crackAngle = (c / child.crackLevel) * Math.PI + Math.random() * 0.5;
          const crackLen = 5 + c * 3;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(
            bx + Math.cos(crackAngle) * crackLen,
            by + Math.sin(crackAngle) * crackLen,
          );
          ctx.stroke();

          // Sub-cracks
          if (child.crackLevel >= 2) {
            ctx.beginPath();
            ctx.moveTo(
              bx + Math.cos(crackAngle) * crackLen * 0.6,
              by + Math.sin(crackAngle) * crackLen * 0.6,
            );
            ctx.lineTo(
              bx + Math.cos(crackAngle + 0.5) * crackLen * 0.8,
              by + Math.sin(crackAngle + 0.5) * crackLen * 0.8,
            );
            ctx.stroke();
          }
        }
      }
    }

    function drawTreeNode(node: TreeNode, time: number) {
      // Draw branches to children first
      for (const child of node.children) {
        drawBranch(node, child);
      }

      // Draw creature thumbnail at node
      if (node.creature) {
        drawCreatureThumbnail(ctx, node.x, node.y, 28, node.creature, time);
      }

      // Draw endpoint indicator (glowing circle) for endpoints without creatures
      if (node.isEndpoint && !node.creature && node.growthProgress >= 0.9) {
        const isHovered = hoveredEndpoint === node;
        const pulse = Math.sin(time * 4) * 0.3 + 0.7;

        ctx.save();
        if (isHovered) {
          ctx.shadowColor = EMERALD_GLOW;
          ctx.shadowBlur = 20;
          ctx.fillStyle = EMERALD_GLOW;
          ctx.globalAlpha = 0.8;
        } else {
          ctx.fillStyle = EMERALD;
          ctx.globalAlpha = 0.3 + pulse * 0.3;
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, isHovered ? 14 : 10, 0, Math.PI * 2);
        ctx.fill();

        // Inner dot
        ctx.globalAlpha = isHovered ? 1 : 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        // Show trait match preview on hover
        if (isHovered && currentCreature) {
          const shared = evaluatePlacement(node, currentCreature);
          let color = '#ef4444';
          let label = 'WRONG';
          if (shared >= 4) { color = '#fbbf24'; label = 'PERFECT'; }
          else if (shared === 3) { color = EMERALD; label = 'GOOD'; }
          else if (shared === 2) { color = '#f97316'; label = 'OKAY'; }

          ctx.save();
          ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.9;
          ctx.fillText(`${shared}/6 ${label}`, node.x, node.y - 20);
          ctx.restore();
        }
      }

      // Recurse children
      for (const child of node.children) {
        drawTreeNode(child, time);
      }
    }

    function drawTree(root: TreeNode, time: number) {
      drawTreeNode(root, time);
    }

    // -------------------------------------------------------------------
    // Drawing: Particles
    // -------------------------------------------------------------------

    function drawParticles() {
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;

        if (p.type === 'leaf') {
          ctx.fillStyle = p.color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(gameTime * 2 + p.x);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === 'sparkle') {
          ctx.fillStyle = p.color;
          const sparkSize = p.size * (0.5 + Math.sin(gameTime * 10 + p.x) * 0.5);
          ctx.beginPath();
          // 4-pointed star
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = i % 2 === 0 ? sparkSize : sparkSize * 0.3;
            const sx = p.x + Math.cos(angle) * r;
            const sy = p.y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.closePath();
          ctx.fill();
        } else if (p.type === 'crack') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.05, p.y + p.vy * 0.05);
          ctx.stroke();
        } else if (p.type === 'dna') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'ember') {
          const emberAlpha = alpha * 0.8;
          ctx.globalAlpha = emberAlpha;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          // Glow
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    // -------------------------------------------------------------------
    // Drawing: Floating Texts
    // -------------------------------------------------------------------

    function drawFloatingTexts() {
      for (const ft of floatingTexts) {
        const alpha = ft.life / ft.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = `bold ${ft.size}px "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillText(ft.text, ft.x + 1, ft.y + 1);

        // Text
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
      }
    }

    // -------------------------------------------------------------------
    // Drawing: HUD
    // -------------------------------------------------------------------

    function drawHUD() {
      ctx.save();

      // Top bar background
      ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
      ctx.fillRect(0, 0, W, 40);
      ctx.strokeStyle = EMERALD_DIM;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.lineTo(W, 40);
      ctx.stroke();

      // Score
      ctx.font = 'bold 16px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(`Score: ${score}`, 15, 20);

      // High score
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = HUD_DIM;
      ctx.fillText(`Best: ${highScore}`, 15, 35);

      // Round
      ctx.font = 'bold 14px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = EMERALD;
      ctx.fillText(`Round ${round}`, W / 2, 15);

      // Epoch
      const epoch = Math.floor(round / 5) + 1;
      ctx.font = '11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = HUD_DIM;
      ctx.fillText(`Epoch ${epoch}`, W / 2, 32);

      // Streak
      if (streak > 1) {
        ctx.font = 'bold 13px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = EMERALD_GLOW;
        const streakMult = Math.min(3, 1 + (streak - 1) * 0.5);
        ctx.fillText(`Streak: ${streak} (${streakMult}x)`, W - 120, 15);
      }

      // Mistakes (hearts)
      ctx.textAlign = 'right';
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      const heartsX = W - 15;
      for (let i = 0; i < MAX_MISTAKES; i++) {
        const hx = heartsX - i * 25;
        if (i < MAX_MISTAKES - mistakes) {
          // Full heart
          ctx.fillStyle = '#ef4444';
          drawHeart(ctx, hx, 20, 9);
        } else {
          // Empty heart
          ctx.strokeStyle = '#4b5563';
          ctx.lineWidth = 1.5;
          drawHeartOutline(ctx, hx, 20, 9);
        }
      }

      // Difficulty indicator
      if (difficultyMultiplier > 1) {
        ctx.font = '10px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#f97316';
        ctx.fillText(`${difficultyMultiplier}x difficulty`, W - 15, 35);
      }

      ctx.restore();
    }

    function drawHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.3);
      ctx.bezierCurveTo(x, y - size * 0.3, x - size, y - size * 0.3, x - size, y + size * 0.1);
      ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size, x, y + size * 1.1);
      ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.6, x + size, y + size * 0.1);
      ctx.bezierCurveTo(x + size, y - size * 0.3, x, y - size * 0.3, x, y + size * 0.3);
      ctx.fill();
      ctx.restore();
    }

    function drawHeartOutline(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.3);
      ctx.bezierCurveTo(x, y - size * 0.3, x - size, y - size * 0.3, x - size, y + size * 0.1);
      ctx.bezierCurveTo(x - size, y + size * 0.6, x, y + size, x, y + size * 1.1);
      ctx.bezierCurveTo(x, y + size, x + size, y + size * 0.6, x + size, y + size * 0.1);
      ctx.bezierCurveTo(x + size, y - size * 0.3, x, y - size * 0.3, x, y + size * 0.3);
      ctx.stroke();
      ctx.restore();
    }

    // -------------------------------------------------------------------
    // Drawing: Staging Area (current creature)
    // -------------------------------------------------------------------

    function drawStagingArea(time: number) {
      if (!currentCreature) return;

      // Staging background
      ctx.save();
      ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
      const stageW = 200;
      const stageH = 100;
      const stageX = W / 2 - stageW / 2;
      const stageY = 42;
      roundedRect(ctx, stageX, stageY, stageW, stageH, 10);
      ctx.fill();

      ctx.strokeStyle = EMERALD_DIM;
      ctx.lineWidth = 1;
      roundedRect(ctx, stageX, stageY, stageW, stageH, 10);
      ctx.stroke();

      // Draw creature (large)
      const creatureX = W / 2 - 30;
      const creatureY = stageY + stageH / 2 + 5;
      drawCreature(ctx, creatureX, creatureY, 55, currentCreature, time, true);

      // Name
      ctx.font = 'bold 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText(currentCreature.name, W / 2 + 5, stageY + 20);

      // Trait icons (small text list)
      ctx.font = '9px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = HUD_DIM;
      const traits = [
        currentCreature.body,
        currentCreature.locomotion,
        currentCreature.covering,
        `${currentCreature.eyes} eyes`,
        currentCreature.appendages,
        currentCreature.pattern,
      ];
      for (let i = 0; i < traits.length; i++) {
        ctx.fillText(traits[i], W / 2 + 5, stageY + 35 + i * 11);
      }

      // Curveball warning
      if (curveball && curveballTimer > 0) {
        const flashAlpha = Math.sin(curveballTimer * 8) * 0.5 + 0.5;
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('!', stageX + stageW - 15, stageY + 20);
        ctx.restore();
      }

      ctx.restore();
    }

    function roundedRect(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      w: number,
      h: number,
      r: number,
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

    // -------------------------------------------------------------------
    // Drawing: Trait Comparison (on hover)
    // -------------------------------------------------------------------

    function drawTraitComparison() {
      if (!hoveredEndpoint || !currentCreature || state !== 'playing') return;

      const neighbor = getBranchNeighborCreature(hoveredEndpoint);
      if (!neighbor) return;

      // Draw comparison panel
      const panelW = 160;
      const panelH = 110;
      const panelX = Math.min(W - panelW - 10, Math.max(10, hoveredEndpoint.x - panelW / 2));
      const panelY = Math.min(H - panelH - 10, Math.max(145, hoveredEndpoint.y + 25));

      ctx.save();
      ctx.fillStyle = 'rgba(10, 10, 26, 0.9)';
      roundedRect(ctx, panelX, panelY, panelW, panelH, 8);
      ctx.fill();
      ctx.strokeStyle = EMERALD_DIM;
      ctx.lineWidth = 1;
      roundedRect(ctx, panelX, panelY, panelW, panelH, 8);
      ctx.stroke();

      ctx.font = '10px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'left';

      const traitNames = ['Body', 'Move', 'Cover', 'Eyes', 'Append', 'Pattern'];
      const creatureTraits = [
        currentCreature.body, currentCreature.locomotion,
        currentCreature.covering, String(currentCreature.eyes),
        currentCreature.appendages, currentCreature.pattern,
      ];
      const neighborTraits = [
        neighbor.body, neighbor.locomotion,
        neighbor.covering, String(neighbor.eyes),
        neighbor.appendages, neighbor.pattern,
      ];

      ctx.fillStyle = HUD_DIM;
      ctx.font = 'bold 9px "Segoe UI", system-ui, sans-serif';
      ctx.fillText('Trait Comparison', panelX + 8, panelY + 14);

      for (let i = 0; i < 6; i++) {
        const ty = panelY + 28 + i * 13;
        const matches = creatureTraits[i] === neighborTraits[i];

        ctx.font = '9px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = HUD_DIM;
        ctx.fillText(traitNames[i] + ':', panelX + 8, ty);

        ctx.fillStyle = matches ? EMERALD : '#ef4444';
        ctx.fillText(matches ? 'MATCH' : 'DIFF', panelX + 55, ty);

        ctx.fillStyle = HUD_DIM;
        ctx.fillText(creatureTraits[i], panelX + 95, ty);
      }

      ctx.restore();
    }

    // -------------------------------------------------------------------
    // Drawing: Menu Screen
    // -------------------------------------------------------------------

    function drawMenu() {
      drawBackground();

      // Build menu tree if not built
      if (!menuTree) {
        menuTree = buildMenuTree();
      }

      // Draw menu tree (no hover effects)
      const savedHover = hoveredEndpoint;
      hoveredEndpoint = null;
      drawTree(menuTree, menuTime);
      hoveredEndpoint = savedHover;

      // Draw some menu creatures floating around
      for (let i = 0; i < Math.min(5, menuCreatures.length); i++) {
        const mx = 100 + i * 150;
        const my = 350 + Math.sin(menuTime * 1.5 + i * 1.2) * 20;
        ctx.globalAlpha = 0.3;
        drawCreature(ctx, mx, my, 30, menuCreatures[i], menuTime, false);
        ctx.globalAlpha = 1;
      }

      // Title
      ctx.save();
      ctx.font = 'bold 72px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Glow
      ctx.shadowColor = EMERALD_GLOW;
      ctx.shadowBlur = 30;
      ctx.fillStyle = EMERALD;
      ctx.fillText('PHYLO', W / 2, 140);
      ctx.fillText('PHYLO', W / 2, 140); // Double for stronger glow

      // Subtitle
      ctx.shadowBlur = 0;
      ctx.font = '20px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = HUD_DIM;
      ctx.fillText('Evolution Tree Builder', W / 2, 185);

      // Instructions
      const pulse = Math.sin(menuTime * 3) * 0.3 + 0.7;
      ctx.globalAlpha = pulse;
      ctx.font = '16px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = EMERALD;
      ctx.fillText('Press ENTER or Click to Start', W / 2, 240);
      ctx.globalAlpha = 1;

      // High score
      if (highScore > 0) {
        ctx.font = '14px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = HUD_DIM;
        ctx.fillText(`High Score: ${highScore}`, W / 2, 275);
      }

      // Controls hint
      ctx.font = '12px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = 'rgba(156, 163, 175, 0.6)';
      ctx.fillText('Hover over branch endpoints and click to place creatures', W / 2, H - 30);

      ctx.restore();
    }

    // -------------------------------------------------------------------
    // Drawing: Playing Screen
    // -------------------------------------------------------------------

    function drawPlaying() {
      drawBackground();

      // Apply screen shake
      if (shakeAmount > 0) {
        const sx = (Math.random() - 0.5) * shakeAmount * 2;
        const sy = (Math.random() - 0.5) * shakeAmount * 2;
        ctx.save();
        ctx.translate(sx, sy);
      }

      // Draw tree
      if (treeRoot) {
        drawTree(treeRoot, gameTime);
      }

      // Draw particles
      drawParticles();
      drawFloatingTexts();

      // Draw trait comparison panel
      drawTraitComparison();

      if (shakeAmount > 0) {
        ctx.restore();
      }

      // Draw staging area (on top, not affected by shake)
      drawStagingArea(gameTime);

      // Draw HUD
      drawHUD();

      // Draw touch controller
      if (touchCtrl) {
        touchCtrl.draw(ctx, W, H);
      }

      // Pause overlay
      if (paused) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.font = 'bold 48px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = HUD_TEXT;
        ctx.fillText('PAUSED', W / 2, H / 2 - 20);
        ctx.font = '16px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = HUD_DIM;
        ctx.fillText('Press P or ESC to resume', W / 2, H / 2 + 25);
        ctx.restore();
      }
    }

    // -------------------------------------------------------------------
    // Drawing: Game Over Screen
    // -------------------------------------------------------------------

    function drawGameOver() {
      drawBackground();

      // Tree collapse animation
      if (treeRoot && collapseStarted) {
        ctx.save();
        const collapseProgress = Math.min(1, collapseTimer / 2);

        // Tree falls apart
        ctx.globalAlpha = 1 - collapseProgress * 0.7;

        // Shake and rotate slightly
        const cx = W / 2;
        const cy = H / 2;
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(collapseTimer * 5) * collapseProgress * 0.05);
        ctx.scale(1 - collapseProgress * 0.3, 1 + collapseProgress * 0.1);
        ctx.translate(-cx, -cy);

        drawTree(treeRoot, gameTime);
        ctx.restore();
      }

      // Draw particles (collapse particles)
      drawParticles();
      drawFloatingTexts();

      // Overlay
      const overlayAlpha = Math.min(0.7, collapseTimer * 0.5);
      ctx.fillStyle = `rgba(10, 10, 15, ${overlayAlpha})`;
      ctx.fillRect(0, 0, W, H);

      // Title text
      if (collapseTimer > 1) {
        const textAlpha = Math.min(1, (collapseTimer - 1) * 2);
        ctx.save();
        ctx.globalAlpha = textAlpha;

        // EXTINCTION text
        ctx.font = 'bold 56px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#ef4444';
        ctx.fillText('EXTINCTION', W / 2, 160);

        ctx.shadowBlur = 0;

        // Stats
        ctx.font = '18px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = HUD_TEXT;
        ctx.fillText(`Species Placed: ${speciesPlaced}`, W / 2, 240);

        ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = EMERALD;
        ctx.fillText(`Score: ${score}`, W / 2, 290);

        if (newHighScoreFlag) {
          ctx.font = 'bold 20px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 15;
          const nhPulse = Math.sin(gameTime * 4) * 0.3 + 0.7;
          ctx.globalAlpha = textAlpha * nhPulse;
          ctx.fillText('NEW HIGH SCORE!', W / 2, 325);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = textAlpha;
        } else {
          ctx.font = '14px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = HUD_DIM;
          ctx.fillText(`High Score: ${highScore}`, W / 2, 325);
        }

        // Best streak
        ctx.font = '14px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = HUD_DIM;
        ctx.fillText(`Best Streak: ${bestStreak}`, W / 2, 360);
        ctx.fillText(`Rounds Survived: ${round}`, W / 2, 385);

        // Restart prompt
        if (collapseTimer > 2.5) {
          const restartAlpha = Math.min(1, (collapseTimer - 2.5) * 2);
          const pulse = Math.sin(gameTime * 3) * 0.3 + 0.7;
          ctx.globalAlpha = restartAlpha * pulse;
          ctx.font = '16px "Segoe UI", system-ui, sans-serif';
          ctx.fillStyle = EMERALD;
          ctx.fillText('Press ENTER to Play Again', W / 2, 440);
        }

        ctx.restore();
      }
    }

    // -------------------------------------------------------------------
    // Main Draw
    // -------------------------------------------------------------------

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

    // -------------------------------------------------------------------
    // Game Loop
    // -------------------------------------------------------------------

    function loop(timestamp: number) {
      if (destroyed) return;

      const dt = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.1) : 0.016;
      lastTime = timestamp;

      if (state === 'menu') {
        menuTime += dt;
      }

      if (state === 'gameover') {
        gameTime += dt;
        collapseTimer += dt;

        // Update particles in gameover
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 100 * dt;
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

    // -------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
      if (touchCtrl) touchCtrl.destroy();
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
