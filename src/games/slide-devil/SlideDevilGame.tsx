'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';

// ─── Constants ───────────────────────────────────────────────────────
const W = 800;
const H = 600;
const PLAYER_SIZE = 20;
const GRAVITY = 1800;
const GROUND_DRAG = 0.997;  // Per-frame multiplier — near-1.0 = near-zero friction
const AIR_DRAG = 0.99;
const MOVE_ACCEL = 600;
const JUMP_VEL = -520;
const WALL_JUMP_VX = 380;
const WALL_JUMP_VY = -460;
const COYOTE_TIME = 0.08;
const MAX_VX = 600;
const MAX_VY = 800;
const PARTICLE_MAX = 150;
const TRAIL_MAX = 30;

// ─── Types ───────────────────────────────────────────────────────────
interface Rect { x: number; y: number; w: number; h: number }
interface SpikeRect extends Rect { dir: 'up' | 'down' | 'left' | 'right' }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }
interface TrailDot { x: number; y: number; alpha: number }

type TriggerType = 'playerInZone' | 'playerOnPlatform' | 'playerNearExit' | 'timer' | 'playerPassX' | 'playerPassY' | 'deathCount';
type EffectType = 'removePlatform' | 'spawnSpikes' | 'flipGravity' | 'moveExit' | 'reverseControls' | 'crushWalls' | 'dropCeiling' | 'fakePlatformBounce' | 'fakeExit' | 'windBurst' | 'shakeScreen';

interface TrapTrigger {
  type: TriggerType;
  zone?: Rect;
  platformIndex?: number;
  threshold?: number;
  value?: number;
  direction?: 'left' | 'right';
}

interface TrapEffect {
  type: EffectType;
  platformIndex?: number;
  spikes?: SpikeRect[];
  exitX?: number;
  exitY?: number;
  duration?: number;
  crushSpeed?: number;
  crushWallIndices?: number[];
  ceilingIndex?: number;
  dropSpeed?: number;
  bounceVel?: number;
  windFx?: number;
  windFy?: number;
  intensity?: number;
}

interface Trap {
  trigger: TrapTrigger;
  effect: TrapEffect;
  fired: boolean;
  warningTimer: number;
  effectActive: boolean;
  effectTimer: number;
}

interface LevelConfig {
  name: string;
  platforms: Rect[];
  spikes: SpikeRect[];
  exitX: number;
  exitY: number;
  startX: number;
  startY: number;
  traps: Trap[];
  deathQuote: string;
}

// ─── Death Quotes ────────────────────────────────────────────────────
const DEATH_QUOTES = [
  '"The floor was never your friend."',
  '"Trust issues? You should have some."',
  '"That exit was a lie. Like your hopes."',
  '"Gravity says hello... from above."',
  '"Left is right. Right is wrong. Both are death."',
  '"The walls just wanted a hug."',
  '"That bounce pad had other plans."',
  '"The ceiling has commitment issues — it fell for you."',
  '"Mirror mirror on the wall, who slides worst of all?"',
  '"Bait: taken. Switch: flipped. You: dead."',
  '"Everything crumbles. Especially your confidence."',
  '"Gravity can\'t make up its mind. Neither can you."',
  '"The fun house isn\'t fun. For you."',
  '"Trust nothing. Especially this advice."',
  '"Final slide? More like final splat."',
];

// ─── Level Builder Helpers ───────────────────────────────────────────
function makeTrap(trigger: TrapTrigger, effect: TrapEffect): Trap {
  return { trigger, effect, fired: false, warningTimer: 0, effectActive: false, effectTimer: 0 };
}

function border(): Rect[] {
  return [
    { x: 0, y: 0, w: W, h: 14 },           // top
    { x: 0, y: H - 14, w: W, h: 14 },       // bottom
    { x: 0, y: 0, w: 14, h: H },             // left
    { x: W - 14, y: 0, w: 14, h: H },        // right
  ];
}

// ─── Level Definitions ───────────────────────────────────────────────
function makeLevels(): LevelConfig[] {
  return [
    // Level 1: Welcome to the Slide
    {
      name: 'Welcome to the Slide',
      platforms: [
        ...border(),
        { x: 100, y: 480, w: 200, h: 14 },
        { x: 350, y: 420, w: 150, h: 14 },
        { x: 550, y: 360, w: 200, h: 14 },
      ],
      spikes: [],
      startX: 150, startY: 450,
      exitX: 700, exitY: 330,
      traps: [],
      deathQuote: DEATH_QUOTES[0],
    },
    // Level 2: Trust Fall
    {
      name: 'Trust Fall',
      platforms: [
        ...border(),
        { x: 50, y: 480, w: 220, h: 14 },    // 4: start platform (generous run-up)
        { x: 320, y: 430, w: 170, h: 14 },    // 5: middle — crumbles on contact
        { x: 540, y: 370, w: 220, h: 14 },    // 6: end platform
        { x: 460, y: 280, w: 14, h: 80 },     // 7: vertical bar between P5 & P6 (obstacle)
        { x: 200, y: 340, w: 80, h: 14 },     // 8: small rescue ledge (hard to reach back)
      ],
      spikes: [
        { x: 14, y: H - 28, w: W - 28, h: 14, dir: 'up' },  // full floor spikes — no safe landing
      ],
      startX: 120, startY: 450,
      exitX: 690, exitY: 340,
      traps: [
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 5 },
          { type: 'removePlatform', platformIndex: 5 }
        ),
        // Troll: screen shake when you think you've made it
        makeTrap(
          { type: 'playerNearExit', threshold: 50 },
          { type: 'shakeScreen', intensity: 5 }
        ),
      ],
      deathQuote: DEATH_QUOTES[1],
    },
    // Level 3: The Bait
    {
      name: 'The Bait',
      platforms: [
        ...border(),
        { x: 50, y: 500, w: 700, h: 14 },     // 4: wide floor
        { x: 200, y: 440, w: 140, h: 14 },     // 5: step (60px gap)
        { x: 450, y: 380, w: 140, h: 14 },     // 6: step (60px gap)
      ],
      spikes: [],
      startX: 100, startY: 470,
      exitX: 700, exitY: 470,
      traps: [
        makeTrap(
          { type: 'playerNearExit', threshold: 80 },
          { type: 'moveExit', exitX: 100, exitY: 350 }
        ),
      ],
      deathQuote: DEATH_QUOTES[2],
    },
    // Level 4: Reversal
    {
      name: 'Reversal',
      platforms: [
        ...border(),
        { x: 50, y: 480, w: 200, h: 14 },     // 4: start
        { x: 300, y: 420, w: 200, h: 14 },     // 5 (60px gap — gravity flip handles upper plats)
        { x: 300, y: 200, w: 200, h: 14 },     // 6 (reached via gravity flip)
        { x: 550, y: 120, w: 200, h: 14 },     // 7 (reached via gravity flip)
      ],
      spikes: [],
      startX: 120, startY: 450,
      exitX: 680, exitY: 90,
      traps: [
        makeTrap(
          { type: 'playerPassX', value: 400 },
          { type: 'flipGravity' }
        ),
        makeTrap(
          { type: 'playerPassX', value: 400 },
          { type: 'reverseControls', duration: 3 }
        ),
      ],
      deathQuote: DEATH_QUOTES[3],
    },
    // Level 5: The Squeeze
    {
      name: 'The Squeeze',
      platforms: [
        ...border(),
        { x: 50, y: 480, w: 150, h: 14 },     // 4: start
        { x: 250, y: 420, w: 100, h: 14 },     // 5 (60px gap)
        { x: 470, y: 420, w: 100, h: 14 },     // 6 (same height)
        { x: 350, y: 350, w: 120, h: 14 },     // 7 (70px gap)
        { x: 200, y: 280, w: 120, h: 14 },     // 8 (70px gap)
        { x: 500, y: 210, w: 150, h: 14 },     // 9 (70px gap)
      ],
      spikes: [],
      startX: 100, startY: 450,
      exitX: 620, exitY: 180,
      traps: [
        makeTrap(
          { type: 'playerPassY', value: 430, direction: 'left' },
          { type: 'crushWalls', crushSpeed: 60, crushWallIndices: [2, 3] }
        ),
        makeTrap(
          { type: 'playerPassY', value: 350, direction: 'left' },
          { type: 'spawnSpikes', spikes: [
            { x: 250, y: H - 28, w: 300, h: 14, dir: 'up' },
          ]}
        ),
      ],
      deathQuote: DEATH_QUOTES[4],
    },
    // Level 6: Trampoline Trick
    {
      name: 'Trampoline Trick',
      platforms: [
        ...border(),
        { x: 50, y: 480, w: 200, h: 14 },
        { x: 320, y: 450, w: 160, h: 14 },   // 5: fake bouncer
        { x: 550, y: 350, w: 200, h: 14 },
      ],
      spikes: [],
      startX: 120, startY: 450,
      exitX: 680, exitY: 320,
      traps: [
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 5 },
          { type: 'fakePlatformBounce', platformIndex: 5, bounceVel: -800 }
        ),
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 5 },
          { type: 'spawnSpikes', spikes: [
            { x: 280, y: 14, w: 240, h: 14, dir: 'down' },
          ]}
        ),
      ],
      deathQuote: DEATH_QUOTES[6],
    },
    // Level 7: The Long Slide
    {
      name: 'The Long Slide',
      platforms: [
        ...border(),
        { x: 50, y: 500, w: 120, h: 14 },    // 4
        { x: 200, y: 440, w: 120, h: 14 },    // 5
        { x: 350, y: 380, w: 120, h: 14 },    // 6
        { x: 500, y: 320, w: 120, h: 14 },    // 7
        { x: 650, y: 260, w: 120, h: 14 },    // 8
      ],
      spikes: [
        { x: 14, y: H - 28, w: W - 28, h: 14, dir: 'up' },
      ],
      startX: 80, startY: 470,
      exitX: 720, exitY: 230,
      traps: [
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 5 },
          { type: 'removePlatform', platformIndex: 4 }
        ),
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 6 },
          { type: 'removePlatform', platformIndex: 5 }
        ),
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 7 },
          { type: 'removePlatform', platformIndex: 6 }
        ),
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 8 },
          { type: 'windBurst', windFx: -400, windFy: 0 }
        ),
      ],
      deathQuote: DEATH_QUOTES[5],
    },
    // Level 8: Ceiling Drop
    {
      name: 'Ceiling Drop',
      platforms: [
        ...border(),
        { x: 50, y: 500, w: 200, h: 14 },
        { x: 350, y: 450, w: 150, h: 14 },
        { x: 600, y: 400, w: 180, h: 14 },
      ],
      spikes: [],
      startX: 120, startY: 470,
      exitX: 720, exitY: 370,
      traps: [
        makeTrap(
          { type: 'playerPassX', value: 300 },
          { type: 'dropCeiling', ceilingIndex: 0, dropSpeed: 80 }
        ),
      ],
      deathQuote: DEATH_QUOTES[7],
    },
    // Level 9: Mirror Mirror
    {
      name: 'Mirror Mirror',
      platforms: [
        ...border(),
        { x: 50, y: 500, w: 180, h: 14 },     // 4 (60px gaps throughout)
        { x: 300, y: 440, w: 200, h: 14 },     // 5
        { x: 550, y: 380, w: 200, h: 14 },     // 6
        { x: 200, y: 320, w: 150, h: 14 },     // 7
        { x: 500, y: 260, w: 200, h: 14 },     // 8
      ],
      spikes: [
        { x: 14, y: H - 28, w: W - 28, h: 14, dir: 'up' },
      ],
      startX: 120, startY: 470,
      exitX: 650, exitY: 230,
      traps: [
        makeTrap(
          { type: 'timer', value: 0.5 },
          { type: 'reverseControls', duration: 999 }
        ),
      ],
      deathQuote: DEATH_QUOTES[8],
    },
    // Level 10: Bait & Switch
    {
      name: 'Bait & Switch',
      platforms: [
        ...border(),
        { x: 50, y: 480, w: 200, h: 14 },     // 4 (60px gaps)
        { x: 350, y: 420, w: 200, h: 14 },     // 5
        { x: 600, y: 360, w: 180, h: 14 },     // 6
        { x: 200, y: 300, w: 150, h: 14 },     // 7
      ],
      spikes: [],
      startX: 120, startY: 450,
      exitX: 700, exitY: 330,
      traps: [
        makeTrap(
          { type: 'playerNearExit', threshold: 60 },
          { type: 'fakeExit', exitX: 280, exitY: 270 }
        ),
      ],
      deathQuote: DEATH_QUOTES[9],
    },
    // Level 11: The Gauntlet
    {
      name: 'The Gauntlet',
      platforms: [
        ...border(),
        { x: 50, y: 500, w: 100, h: 14 },    // 4
        { x: 180, y: 450, w: 100, h: 14 },    // 5
        { x: 310, y: 400, w: 100, h: 14 },    // 6
        { x: 440, y: 350, w: 100, h: 14 },    // 7
        { x: 570, y: 300, w: 100, h: 14 },    // 8
        { x: 680, y: 250, w: 100, h: 14 },    // 9
      ],
      spikes: [
        { x: 14, y: H - 28, w: W - 28, h: 14, dir: 'up' },
      ],
      startX: 80, startY: 470,
      exitX: 740, exitY: 220,
      traps: [
        makeTrap({ type: 'playerOnPlatform', platformIndex: 6 }, { type: 'removePlatform', platformIndex: 4 }),
        makeTrap({ type: 'playerOnPlatform', platformIndex: 6 }, { type: 'removePlatform', platformIndex: 5 }),
        makeTrap({ type: 'playerOnPlatform', platformIndex: 7 }, { type: 'removePlatform', platformIndex: 6 }),
        makeTrap({ type: 'playerOnPlatform', platformIndex: 8 }, { type: 'removePlatform', platformIndex: 7 }),
        makeTrap({ type: 'playerOnPlatform', platformIndex: 9 }, { type: 'removePlatform', platformIndex: 8 }),
      ],
      deathQuote: DEATH_QUOTES[10],
    },
    // Level 12: Gravity Ping-Pong
    {
      name: 'Gravity Ping-Pong',
      platforms: [
        ...border(),
        { x: 100, y: 480, w: 200, h: 14 },
        { x: 100, y: 106, w: 200, h: 14 },
        { x: 400, y: 300, w: 150, h: 14 },
        { x: 600, y: 480, w: 180, h: 14 },
        { x: 600, y: 106, w: 180, h: 14 },
      ],
      spikes: [
        { x: 350, y: H - 28, w: 200, h: 14, dir: 'up' },
        { x: 350, y: 14, w: 200, h: 14, dir: 'down' },
      ],
      startX: 150, startY: 450,
      exitX: 700, exitY: 450,
      traps: [
        makeTrap({ type: 'timer', value: 3.0 }, { type: 'flipGravity' }),
        makeTrap({ type: 'timer', value: 6.0 }, { type: 'flipGravity' }),
        makeTrap({ type: 'timer', value: 9.0 }, { type: 'flipGravity' }),
        makeTrap({ type: 'timer', value: 12.0 }, { type: 'flipGravity' }),
      ],
      deathQuote: DEATH_QUOTES[11],
    },
    // Level 13: The Funhouse
    {
      name: 'The Funhouse',
      platforms: [
        ...border(),
        { x: 50, y: 480, w: 180, h: 14 },     // 4: start
        { x: 280, y: 420, w: 140, h: 14 },     // 5: bouncer (60px gap)
        { x: 500, y: 350, w: 140, h: 14 },     // 6 (70px gap — or reachable from bounce)
        { x: 300, y: 280, w: 140, h: 14 },     // 7 (70px gap from P6)
        { x: 600, y: 210, w: 160, h: 14 },     // 8 (70px gap from P7)
      ],
      spikes: [],
      startX: 120, startY: 450,
      exitX: 700, exitY: 180,
      traps: [
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 5 },
          { type: 'fakePlatformBounce', platformIndex: 5, bounceVel: -700 }
        ),
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 5 },
          { type: 'spawnSpikes', spikes: [{ x: 240, y: 14, w: 220, h: 14, dir: 'down' }] }
        ),
        makeTrap(
          { type: 'playerNearExit', threshold: 100 },
          { type: 'moveExit', exitX: 400, exitY: 240 }
        ),
        makeTrap(
          { type: 'playerPassX', value: 450 },
          { type: 'spawnSpikes', spikes: [{ x: 500, y: H - 28, w: 280, h: 14, dir: 'up' }] }
        ),
      ],
      deathQuote: DEATH_QUOTES[12],
    },
    // Level 14: Trust Nothing
    {
      name: 'Trust Nothing',
      platforms: [
        ...border(),
        { x: 50, y: 500, w: 150, h: 14 },     // 4: start
        { x: 240, y: 440, w: 120, h: 14 },     // 5: crumbles (60px gap)
        { x: 400, y: 380, w: 120, h: 14 },     // 6: bouncer (60px gap)
        { x: 560, y: 320, w: 120, h: 14 },     // 7: crumbles (60px gap)
        { x: 350, y: 260, w: 120, h: 14 },     // 8 (60px gap)
        { x: 600, y: 200, w: 160, h: 14 },     // 9 (60px gap)
      ],
      spikes: [
        { x: 14, y: H - 28, w: W - 28, h: 14, dir: 'up' },
      ],
      startX: 100, startY: 470,
      exitX: 700, exitY: 170,
      traps: [
        makeTrap({ type: 'playerOnPlatform', platformIndex: 5 }, { type: 'removePlatform', platformIndex: 5 }),
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 6 },
          { type: 'fakePlatformBounce', platformIndex: 6, bounceVel: -750 }
        ),
        makeTrap(
          { type: 'playerOnPlatform', platformIndex: 6 },
          { type: 'spawnSpikes', spikes: [{ x: 360, y: 14, w: 200, h: 14, dir: 'down' }] }
        ),
        makeTrap({ type: 'playerOnPlatform', platformIndex: 7 }, { type: 'removePlatform', platformIndex: 7 }),
        makeTrap({ type: 'playerPassX', value: 500 }, { type: 'reverseControls', duration: 2.5 }),
        makeTrap({ type: 'playerNearExit', threshold: 80 }, { type: 'moveExit', exitX: 200, exitY: 290 }),
      ],
      deathQuote: DEATH_QUOTES[13],
    },
    // Level 15: Final Slide
    {
      name: 'Final Slide',
      platforms: [
        ...border(),
        { x: 30, y: 500, w: 150, h: 14 },     // 4: start
        { x: 220, y: 440, w: 120, h: 14 },     // 5: crumbles (60px gap)
        { x: 380, y: 380, w: 120, h: 14 },     // 6: crumbles (60px gap)
        { x: 540, y: 320, w: 120, h: 14 },     // 7 (60px gap)
        { x: 400, y: 260, w: 120, h: 14 },     // 8 (60px gap — gravity flip assists)
        { x: 200, y: 200, w: 120, h: 14 },     // 9 (60px gap)
        { x: 600, y: 140, w: 170, h: 14 },     // 10 (60px gap)
      ],
      spikes: [
        { x: 14, y: H - 28, w: W - 28, h: 14, dir: 'up' },
      ],
      startX: 80, startY: 470,
      exitX: 700, exitY: 110,
      traps: [
        makeTrap({ type: 'playerOnPlatform', platformIndex: 5 }, { type: 'removePlatform', platformIndex: 5 }),
        makeTrap({ type: 'playerOnPlatform', platformIndex: 6 }, { type: 'removePlatform', platformIndex: 6 }),
        makeTrap({ type: 'playerPassX', value: 500 }, { type: 'flipGravity' }),
        makeTrap(
          { type: 'playerNearExit', threshold: 100 },
          { type: 'moveExit', exitX: 250, exitY: 130 }
        ),
        makeTrap(
          { type: 'playerNearExit', threshold: 80 },
          { type: 'moveExit', exitX: 650, exitY: 50 }
        ),
        makeTrap(
          { type: 'playerNearExit', threshold: 60 },
          { type: 'moveExit', exitX: 100, exitY: 80 }
        ),
        makeTrap({ type: 'timer', value: 8 }, { type: 'reverseControls', duration: 3 }),
        makeTrap({ type: 'timer', value: 15 }, { type: 'spawnSpikes', spikes: [
          { x: 14, y: 14, w: W - 28, h: 14, dir: 'down' },
        ]}),
      ],
      deathQuote: DEATH_QUOTES[14],
    },
  ];
}

// ─── Component ───────────────────────────────────────────────────────
export default function SlideDevilGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // DPR scaling
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // ── State ──
    type GState = 'menu' | 'playing' | 'dead' | 'levelComplete' | 'victory';
    let state: GState = 'menu';
    let levels = makeLevels();
    let currentLevel = 0;
    let totalDeaths = 0;
    let levelDeaths = 0;
    let levelTime = 0;
    let totalScore = 0;
    let paused = false;

    let highScore = getHighScore('slide-devil');
    let newHighScore = false;

    // Player physics
    let px = 0, py = 0, pvx = 0, pvy = 0;
    let gravityDir = 1; // 1 = down, -1 = up
    let onGround = false;
    let onWallLeft = false;
    let onWallRight = false;
    let coyoteTimer = 0;
    let jumpPressed = false;
    let controlsReversed = false;
    let reverseTimer = 0;

    // Player visual
    let scaleX = 1, scaleY = 1;
    let eyeTrackX = 0, eyeTrackY = 0;
    let wasOnGround = false;
    let gravityFlipVisual = 0; // rotation tween for gravity flip feedback

    // Particles & trail
    let particles: Particle[] = [];
    let trail: TrailDot[] = [];

    // Shake
    let shakeX = 0, shakeY = 0, shakeIntensity = 0;

    // Trap state
    let removedPlatforms: Set<number> = new Set();
    let platformFadeTimers: Map<number, number> = new Map();
    let spawnedSpikes: SpikeRect[] = [];
    let exitX = 0, exitY = 0;
    let exitMoving = false;
    let exitTargetX = 0, exitTargetY = 0;
    let crushWallsActive = false;
    let crushSpeed = 0;
    let crushWallIndices: number[] = [];
    let ceilingDropActive = false;
    let ceilingDropIndex = 0;
    let ceilingDropSpeed = 0;
    let fakeExitActive = false;
    let fakeExitX = 0, fakeExitY = 0;
    let warningFlash = 0;
    let levelTimer = 0;

    // Starfield
    const starField: { x: number; y: number; s: number; b: number; sp: number }[] = [];
    for (let i = 0; i < 60; i++) {
      starField.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 1.5 + 0.5, b: Math.random(), sp: Math.random() * 2 + 1 });
    }

    // Cached rect
    let cachedRect = canvas.getBoundingClientRect();

    // Timing
    let lastTime = 0;
    let rafId = 0;
    let menuTime = 0;

    // Keys
    const keysDown: Record<string, boolean> = {};

    // Menu/button hover
    let menuHover = false;
    let nextBtnHover = false;
    let retryBtnHover = false;

    // ── Helpers ──
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const spawnParticles = (x: number, y: number, count: number, color: string, speed: number) => {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = Math.random() * speed + speed * 0.3;
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, maxLife: 1, color, size: Math.random() * 3 + 1 });
      }
      if (particles.length > PARTICLE_MAX) particles.splice(0, particles.length - PARTICLE_MAX);
    };

    // AABB collision
    const aabbOverlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean => {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    };

    // Get active platforms for current level
    const getActivePlatforms = (): { rect: Rect; index: number }[] => {
      const lv = levels[currentLevel];
      const result: { rect: Rect; index: number }[] = [];
      for (let i = 0; i < lv.platforms.length; i++) {
        if (!removedPlatforms.has(i)) {
          result.push({ rect: lv.platforms[i], index: i });
        }
      }
      return result;
    };

    // ── Init Level ──
    const initLevel = (idx: number) => {
      levels = makeLevels();
      const lv = levels[idx];
      px = lv.startX;
      py = lv.startY;
      pvx = 0;
      pvy = 0;
      gravityDir = 1;
      onGround = false;
      onWallLeft = false;
      onWallRight = false;
      coyoteTimer = 0;
      jumpPressed = false;
      controlsReversed = false;
      reverseTimer = 0;
      scaleX = 1;
      scaleY = 1;
      wasOnGround = false;
      gravityFlipVisual = 0;
      removedPlatforms = new Set();
      platformFadeTimers = new Map();
      spawnedSpikes = [];
      exitX = lv.exitX;
      exitY = lv.exitY;
      exitMoving = false;
      crushWallsActive = false;
      ceilingDropActive = false;
      fakeExitActive = false;
      warningFlash = 0;
      levelTimer = 0;
      levelDeaths = 0;
      levelTime = 0;
      trail = [];
      particles = [];
      shakeIntensity = 0;
      paused = false;
    };

    // Death quote state
    let currentDeathQuote = '';

    // ── Die ──
    const die = () => {
      spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, 25, '#ef4444', 5);
      spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, 15, '#f97316', 4);
      shakeIntensity = 10;
      SoundEngine.play('spikeHit');
      SoundEngine.play('gameOver');
      levelDeaths++;
      totalDeaths++;
      // Pick random death quote
      currentDeathQuote = DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)];
      state = 'dead';
      SoundEngine.stopAmbient();
    };

    // ── Trap System ──
    const checkTraps = (lv: LevelConfig, dt: number) => {
      levelTimer += dt;

      for (const trap of lv.traps) {
        if (trap.fired) continue;

        let triggered = false;
        const t = trap.trigger;
        const pcx = px + PLAYER_SIZE / 2;
        const pcy = py + PLAYER_SIZE / 2;

        switch (t.type) {
          case 'playerInZone':
            if (t.zone) triggered = aabbOverlap(px, py, PLAYER_SIZE, PLAYER_SIZE, t.zone.x, t.zone.y, t.zone.w, t.zone.h);
            break;
          case 'playerOnPlatform': {
            if (t.platformIndex !== undefined && !removedPlatforms.has(t.platformIndex)) {
              const plat = lv.platforms[t.platformIndex];
              if (plat) {
                const onTop = gravityDir === 1
                  ? (py + PLAYER_SIZE >= plat.y - 2 && py + PLAYER_SIZE <= plat.y + 6 && px + PLAYER_SIZE > plat.x && px < plat.x + plat.w)
                  : (py <= plat.y + plat.h + 2 && py >= plat.y + plat.h - 6 && px + PLAYER_SIZE > plat.x && px < plat.x + plat.w);
                triggered = onTop && onGround;
              }
            }
            break;
          }
          case 'playerNearExit':
            triggered = Math.sqrt((pcx - exitX) ** 2 + (pcy - exitY) ** 2) < (t.threshold || 80);
            break;
          case 'timer':
            triggered = levelTimer >= (t.value || 0);
            break;
          case 'playerPassX':
            triggered = pcx > (t.value || 0);
            break;
          case 'playerPassY':
            triggered = t.direction === 'left' ? pcy < (t.value || 0) : pcy > (t.value || 0);
            break;
          case 'deathCount':
            triggered = totalDeaths >= (t.value || 0);
            break;
        }

        if (triggered) {
          trap.fired = true;
          trap.warningTimer = 0.15;
          warningFlash = 0.15;
          SoundEngine.play('trollActivate');
          applyEffect(trap, lv);
        }
      }

      // Update warning flash
      if (warningFlash > 0) warningFlash -= dt;

      // Update platform fade timers
      const fadeEntries = Array.from(platformFadeTimers.entries());
      for (const [idx, timer] of fadeEntries) {
        platformFadeTimers.set(idx, timer - dt);
        if (timer - dt <= 0) {
          removedPlatforms.add(idx);
          platformFadeTimers.delete(idx);
        }
      }

      // Reverse controls timer
      if (controlsReversed && reverseTimer > 0) {
        reverseTimer -= dt;
        if (reverseTimer <= 0) {
          controlsReversed = false;
        }
      }

      // Exit movement
      if (exitMoving) {
        exitX = lerp(exitX, exitTargetX, 5 * dt);
        exitY = lerp(exitY, exitTargetY, 5 * dt);
        if (Math.abs(exitX - exitTargetX) < 1 && Math.abs(exitY - exitTargetY) < 1) {
          exitX = exitTargetX;
          exitY = exitTargetY;
          exitMoving = false;
        }
      }

      // Crush walls
      if (crushWallsActive) {
        for (const idx of crushWallIndices) {
          const plat = lv.platforms[idx];
          if (plat) {
            // Left wall moves right, right wall moves left
            if (plat.x < W / 2) {
              plat.x += crushSpeed * dt;
            } else {
              plat.x -= crushSpeed * dt;
            }
          }
        }
      }

      // Ceiling drop
      if (ceilingDropActive) {
        const plat = lv.platforms[ceilingDropIndex];
        if (plat) {
          plat.y += ceilingDropSpeed * dt;
        }
      }
    };

    const applyEffect = (trap: Trap, lv: LevelConfig) => {
      const e = trap.effect;
      switch (e.type) {
        case 'removePlatform':
          if (e.platformIndex !== undefined) {
            platformFadeTimers.set(e.platformIndex, 0.3);
            shakeIntensity = 4;
            SoundEngine.play('floorCrumble');
          }
          break;
        case 'spawnSpikes':
          if (e.spikes) {
            spawnedSpikes.push(...e.spikes);
            shakeIntensity = 5;
          }
          break;
        case 'flipGravity':
          gravityDir *= -1;
          gravityFlipVisual = Math.PI; // Start rotation animation
          shakeIntensity = 6;
          SoundEngine.play('gravityFlip');
          break;
        case 'moveExit':
          exitTargetX = e.exitX ?? exitX;
          exitTargetY = e.exitY ?? exitY;
          exitMoving = true;
          break;
        case 'reverseControls':
          controlsReversed = true;
          reverseTimer = e.duration ?? 3;
          break;
        case 'crushWalls':
          crushWallsActive = true;
          crushSpeed = e.crushSpeed ?? 60;
          crushWallIndices = e.crushWallIndices ?? [];
          break;
        case 'dropCeiling':
          ceilingDropActive = true;
          ceilingDropIndex = e.ceilingIndex ?? 0;
          ceilingDropSpeed = e.dropSpeed ?? 80;
          break;
        case 'fakePlatformBounce':
          if (e.platformIndex !== undefined) {
            pvy = (e.bounceVel ?? -800) * gravityDir;
            onGround = false;
            coyoteTimer = 0;
            SoundEngine.play('bounce');
            scaleY = 1.4;
            scaleX = 0.6;
          }
          break;
        case 'fakeExit':
          fakeExitActive = true;
          fakeExitX = exitX;
          fakeExitY = exitY;
          exitX = e.exitX ?? 100;
          exitY = e.exitY ?? 100;
          spawnedSpikes.push({ x: fakeExitX - 20, y: fakeExitY - 20, w: 40, h: 40, dir: 'up' });
          shakeIntensity = 8;
          break;
        case 'windBurst':
          pvx += e.windFx || 0;
          pvy += e.windFy || 0;
          shakeIntensity = 6;
          spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, 10, '#88ccff', 4);
          break;
        case 'shakeScreen':
          shakeIntensity = e.intensity || 10;
          break;
      }
    };

    // ── Physics Update ──
    const updatePhysics = (dt: number) => {
      const lv = levels[currentLevel];

      // Input
      let moveDir = 0;
      const left = keysDown['ArrowLeft'] || keysDown['a'] || keysDown['A'];
      const right = keysDown['ArrowRight'] || keysDown['d'] || keysDown['D'];
      if (left) moveDir -= 1;
      if (right) moveDir += 1;
      if (controlsReversed) moveDir *= -1;

      // Horizontal acceleration
      pvx += moveDir * MOVE_ACCEL * dt;

      // Near-zero friction — multiplier close to 1.0 means player barely slows down
      const steps = dt * 60; // Normalize to ~60fps
      if (onGround) {
        pvx *= Math.pow(GROUND_DRAG, steps);
      } else {
        pvx *= Math.pow(AIR_DRAG, steps);
      }

      // Gravity
      pvy += GRAVITY * gravityDir * dt;

      // Clamp velocity
      pvx = clamp(pvx, -MAX_VX, MAX_VX);
      pvy = clamp(pvy, -MAX_VY, MAX_VY);

      // Move player
      px += pvx * dt;
      py += pvy * dt;

      // Collision detection
      onGround = false;
      onWallLeft = false;
      onWallRight = false;

      const activePlatforms = getActivePlatforms();

      for (const { rect: plat } of activePlatforms) {
        if (!aabbOverlap(px, py, PLAYER_SIZE, PLAYER_SIZE, plat.x, plat.y, plat.w, plat.h)) continue;

        // Calculate overlap on each side
        const overlapLeft = (px + PLAYER_SIZE) - plat.x;
        const overlapRight = (plat.x + plat.w) - px;
        const overlapTop = (py + PLAYER_SIZE) - plat.y;
        const overlapBottom = (plat.y + plat.h) - py;

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop && pvy > 0 && gravityDir === 1) {
          // Land on top
          py = plat.y - PLAYER_SIZE;
          pvy = 0;
          onGround = true;
          coyoteTimer = COYOTE_TIME;
        } else if (minOverlap === overlapBottom && pvy < 0 && gravityDir === -1) {
          // Land on bottom (reversed gravity)
          py = plat.y + plat.h;
          pvy = 0;
          onGround = true;
          coyoteTimer = COYOTE_TIME;
        } else if (minOverlap === overlapBottom && pvy < 0 && gravityDir === 1) {
          // Hit ceiling
          py = plat.y + plat.h;
          pvy = 0;
        } else if (minOverlap === overlapTop && pvy > 0 && gravityDir === -1) {
          // Hit ceiling (reversed gravity)
          py = plat.y - PLAYER_SIZE;
          pvy = 0;
        } else if (minOverlap === overlapLeft) {
          // Hit left side of platform
          px = plat.x - PLAYER_SIZE;
          pvx = 0;
          onWallRight = true;
        } else if (minOverlap === overlapRight) {
          // Hit right side of platform
          px = plat.x + plat.w;
          pvx = 0;
          onWallLeft = true;
        }
      }

      // Landing impact detection
      if (onGround && !wasOnGround) {
        const impactSpeed = Math.abs(pvy);
        if (impactSpeed > 100) {
          SoundEngine.play('wallHit');
          scaleX = 1.3;
          scaleY = 0.7;
          shakeIntensity = Math.min(impactSpeed * 0.01, 4);
          spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE, 3 + Math.floor(impactSpeed / 100), '#ffffff', 2);
        }
      }
      wasOnGround = onGround;

      // Sliding sparks on ground at speed
      if (onGround && Math.abs(pvx) > 100 && Math.random() < Math.abs(pvx) / 400 * dt * 60) {
        const sparkX = px + (pvx > 0 ? 0 : PLAYER_SIZE);
        const sparkY = gravityDir === 1 ? py + PLAYER_SIZE : py;
        spawnParticles(sparkX, sparkY, 1, '#fbbf24', 1.5);
      }

      // Crush death — check if player is squeezed too tight
      let minX = 0, maxX = W, minY = 0, maxY = H;
      for (const { rect: plat } of activePlatforms) {
        if (aabbOverlap(px - 1, py, PLAYER_SIZE + 2, PLAYER_SIZE, plat.x, plat.y, plat.w, plat.h)) {
          // Horizontal squeeze
          if (plat.x + plat.w / 2 < px + PLAYER_SIZE / 2) minX = Math.max(minX, plat.x + plat.w);
          else maxX = Math.min(maxX, plat.x);
        }
        if (aabbOverlap(px, py - 1, PLAYER_SIZE, PLAYER_SIZE + 2, plat.x, plat.y, plat.w, plat.h)) {
          // Vertical squeeze
          if (plat.y + plat.h / 2 < py + PLAYER_SIZE / 2) minY = Math.max(minY, plat.y + plat.h);
          else maxY = Math.min(maxY, plat.y);
        }
      }
      if (maxX - minX < PLAYER_SIZE - 2 || maxY - minY < PLAYER_SIZE - 2) {
        die();
        return;
      }

      // Coyote time
      if (!onGround) {
        coyoteTimer -= dt;
      }

      // Jump
      const jumpKey = keysDown['ArrowUp'] || keysDown['w'] || keysDown['W'] || keysDown[' '];
      if (jumpKey && !jumpPressed) {
        jumpPressed = true;
        if (coyoteTimer > 0) {
          // Normal jump
          pvy = JUMP_VEL * gravityDir;
          onGround = false;
          coyoteTimer = 0;
          scaleX = 0.7;
          scaleY = 1.3;
          SoundEngine.play('launch');
          spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE, 5, '#ffffff', 2);
        } else if (onWallLeft) {
          // Wall jump off left wall
          pvx = WALL_JUMP_VX;
          pvy = WALL_JUMP_VY * gravityDir;
          onWallLeft = false;
          scaleX = 1.3;
          scaleY = 0.7;
          SoundEngine.play('launch');
          spawnParticles(px, py + PLAYER_SIZE / 2, 5, '#ffffff', 2);
        } else if (onWallRight) {
          // Wall jump off right wall
          pvx = -WALL_JUMP_VX;
          pvy = WALL_JUMP_VY * gravityDir;
          onWallRight = false;
          scaleX = 1.3;
          scaleY = 0.7;
          SoundEngine.play('launch');
          spawnParticles(px + PLAYER_SIZE, py + PLAYER_SIZE / 2, 5, '#ffffff', 2);
        }
      }
      if (!jumpKey) jumpPressed = false;

      // Check spike collision (level spikes + spawned spikes)
      const allSpikes = [...lv.spikes, ...spawnedSpikes];
      for (const spike of allSpikes) {
        if (aabbOverlap(px + 2, py + 2, PLAYER_SIZE - 4, PLAYER_SIZE - 4, spike.x, spike.y, spike.w, spike.h)) {
          die();
          return;
        }
      }

      // Check exit
      const pcx = px + PLAYER_SIZE / 2;
      const pcy = py + PLAYER_SIZE / 2;
      const distToExit = Math.sqrt((pcx - exitX) ** 2 + (pcy - exitY) ** 2);
      if (distToExit < PLAYER_SIZE + 12) {
        // Level complete!
        const stars = levelDeaths === 0 ? 3 : levelDeaths <= 2 ? 2 : levelDeaths <= 5 ? 1 : 0;
        const timeBonus = Math.max(0, 1000 - Math.floor(levelTime * 10));
        const deathPenalty = levelDeaths * 300;
        const levelScore = Math.max(0, 3000 + timeBonus - deathPenalty);
        totalScore += levelScore;
        if (totalScore > highScore) {
          highScore = totalScore;
          newHighScore = true;
          setHighScore('slide-devil', totalScore);
        }
        state = 'levelComplete';
        spawnParticles(exitX, exitY, 20, '#22c55e', 5);
        spawnParticles(exitX, exitY, 15, '#ffffff', 3);
        SoundEngine.play('levelComplete');
      }

      // Out of bounds death
      if (px < -50 || px > W + 50 || py < -50 || py > H + 50) {
        die();
        return;
      }

      // Trail
      trail.push({ x: pcx, y: pcy, alpha: 1 });
      if (trail.length > TRAIL_MAX) trail.shift();

      // Traps
      checkTraps(lv, dt);
      levelTime += dt;
    };

    // ── Drawing ──
    const drawBg = () => {
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, W, H);
      const t = Date.now() / 1000;
      for (const s of starField) {
        const alpha = 0.2 + Math.sin(t * s.sp + s.b * 10) * 0.2;
        ctx.fillStyle = `rgba(220,38,38,${alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawPlatform = (r: Rect, index: number) => {
      if (removedPlatforms.has(index)) return;

      let alpha = 1;
      if (platformFadeTimers.has(index)) {
        alpha = platformFadeTimers.get(index)! / 0.3;
        // Crumble particles
        if (Math.random() < 0.3) {
          spawnParticles(r.x + Math.random() * r.w, r.y + Math.random() * r.h, 1, '#dc2626', 1);
        }
      }

      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.globalAlpha = 1;
    };

    const drawSpike = (s: SpikeRect) => {
      const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
      grad.addColorStop(0, '#ef4444');
      grad.addColorStop(1, '#f97316');
      ctx.fillStyle = grad;
      const count = Math.max(1, Math.floor(s.w / 16));
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
          const th = s.h / Math.max(1, Math.floor(s.h / 16));
          for (let j = 0; j < Math.floor(s.h / 16); j++) {
            ctx.moveTo(s.x + s.w, s.y + j * th);
            ctx.lineTo(s.x, s.y + j * th + th / 2);
            ctx.lineTo(s.x + s.w, s.y + (j + 1) * th);
          }
        } else {
          const th = s.h / Math.max(1, Math.floor(s.h / 16));
          for (let j = 0; j < Math.floor(s.h / 16); j++) {
            ctx.moveTo(s.x, s.y + j * th);
            ctx.lineTo(s.x + s.w, s.y + j * th + th / 2);
            ctx.lineTo(s.x, s.y + (j + 1) * th);
          }
        }
        ctx.closePath();
        ctx.fill();
      }
    };

    const drawExit = (ex: number, ey: number) => {
      const t = Date.now() / 600;
      const pulse = 1 + Math.sin(t * 2) * 0.1;

      // Door frame
      const doorW = 24 * pulse;
      const doorH = 32 * pulse;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 15;
      ctx.strokeRect(ex - doorW / 2, ey - doorH / 2, doorW, doorH);
      ctx.shadowBlur = 0;

      // Inner glow
      const glow = ctx.createRadialGradient(ex, ey, 0, ex, ey, doorW);
      glow.addColorStop(0, 'rgba(34,197,94,0.3)');
      glow.addColorStop(1, 'rgba(34,197,94,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ex, ey, doorW, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawFakeExit = (ex: number, ey: number) => {
      // Draw fake exit with spikes inside
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.strokeRect(ex - 12, ey - 16, 24, 32);
      ctx.globalAlpha = 1;
    };

    const drawPlayer = (dt: number) => {
      const cx = px + PLAYER_SIZE / 2;
      const cy = py + PLAYER_SIZE / 2;
      const speed = Math.sqrt(pvx * pvx + pvy * pvy);

      ctx.save();
      ctx.translate(cx, cy);

      // Gravity flip rotation tween
      if (gravityFlipVisual > 0.01) {
        gravityFlipVisual = lerp(gravityFlipVisual, 0, 8 * dt);
        ctx.rotate(gravityFlipVisual);
      }

      // Slight velocity-based tilt
      const tilt = clamp(pvx * 0.0003, -0.15, 0.15);
      ctx.rotate(tilt);

      // Squash/stretch lerp
      scaleX = lerp(scaleX, 1, 6 * dt);
      scaleY = lerp(scaleY, 1, 6 * dt);
      ctx.scale(scaleX, scaleY);

      // Flip upside down when gravity reversed
      if (gravityDir === -1) ctx.scale(1, -1);

      const hs = PLAYER_SIZE / 2;

      // Red glow
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 12;

      // Body (white square)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-hs, -hs, PLAYER_SIZE, PLAYER_SIZE);
      ctx.shadowBlur = 0;

      // Devil horns
      ctx.fillStyle = '#dc2626';
      // Left horn
      ctx.beginPath();
      ctx.moveTo(-hs + 2, -hs);
      ctx.lineTo(-hs + 5, -hs - 8);
      ctx.lineTo(-hs + 8, -hs);
      ctx.closePath();
      ctx.fill();
      // Right horn
      ctx.beginPath();
      ctx.moveTo(hs - 8, -hs);
      ctx.lineTo(hs - 5, -hs - 8);
      ctx.lineTo(hs - 2, -hs);
      ctx.closePath();
      ctx.fill();

      // Eyes (tracking movement direction)
      const targetEyeX = speed > 10 ? (pvx / speed) * 2 : 0;
      const targetEyeY = speed > 10 ? (pvy / speed) * 2 * gravityDir : 0;
      eyeTrackX = lerp(eyeTrackX, targetEyeX, 8 * dt);
      eyeTrackY = lerp(eyeTrackY, targetEyeY, 8 * dt);

      // Left eye
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-4 + eyeTrackX, -2 + eyeTrackY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Right eye
      ctx.beginPath();
      ctx.arc(4 + eyeTrackX, -2 + eyeTrackY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Red pupil dots
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(-4 + eyeTrackX, -2 + eyeTrackY, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4 + eyeTrackX, -2 + eyeTrackY, 1, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Wall-slide indicator (draw outside player transform)
      if ((onWallLeft || onWallRight) && !onGround) {
        const wallX = onWallLeft ? px - 3 : px + PLAYER_SIZE + 3;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        // Small wall-grip lines
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(wallX - 1, py + 3 + i * 6, 2, 4);
        }
        // Wall-slide particles
        if (Math.random() < 0.3) {
          spawnParticles(wallX, py + PLAYER_SIZE / 2, 1, '#ffffff', 0.5);
        }
      }
    };

    const drawHUD = (lv: LevelConfig) => {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, 36);

      ctx.font = 'bold 14px monospace';
      ctx.fillStyle = '#dc2626';
      ctx.textAlign = 'left';
      ctx.fillText(`${currentLevel + 1}/${levels.length}: ${lv.name}`, 12, 24);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Deaths: ${levelDeaths}  |  Total: ${totalDeaths}`, W / 2, 24);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#dc2626';
      ctx.fillText(`Score: ${totalScore}`, W - 12, 24);

      // Reversed controls indicator
      if (controlsReversed) {
        ctx.fillStyle = 'rgba(220,38,38,0.8)';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CONTROLS REVERSED', W / 2, 55);
      }

      // Gravity flipped indicator
      if (gravityDir === -1) {
        ctx.fillStyle = 'rgba(139,92,246,0.8)';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('GRAVITY FLIPPED', W / 2, controlsReversed ? 70 : 55);
      }

      ctx.textAlign = 'left';
    };

    // ── Draw Screens ──
    const drawMenu = (dt: number) => {
      menuTime += dt;
      drawBg();

      // Title
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 56px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 25;
      ctx.fillText('SLIDE DEVIL', W / 2, 170);
      ctx.shadowBlur = 0;

      // Subtitle
      ctx.fillStyle = 'rgba(220,38,38,0.6)';
      ctx.font = '14px monospace';
      ctx.fillText('Level Devil meets Drift — Troll Platformer with Zero Friction', W / 2, 210);

      // Animated player preview
      const prevX = W / 2 - 10;
      const prevY = 280 + Math.sin(menuTime * 2) * 8;
      ctx.save();
      ctx.translate(prevX + 10, prevY + 10);
      // Body
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 12;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.shadowBlur = 0;
      // Horns
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-8, -10);
      ctx.lineTo(-5, -18);
      ctx.lineTo(-2, -10);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2, -10);
      ctx.lineTo(5, -18);
      ctx.lineTo(8, -10);
      ctx.closePath();
      ctx.fill();
      // Eyes
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(-4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(-4, -2, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(4, -2, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Play button
      const btnX = W / 2 - 80;
      const btnY = 380;
      const btnW = 160;
      const btnH = 48;
      ctx.fillStyle = menuHover ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.1)';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('PLAY', W / 2, btnY + 31);

      // Controls hint
      ctx.fillStyle = 'rgba(220,38,38,0.4)';
      ctx.font = '12px monospace';
      ctx.fillText('Arrow Keys / WASD to move, Up / Space to jump, R to restart', W / 2, 460);
      ctx.fillText('Watch out for traps... nothing is safe.', W / 2, 480);

      // High score
      if (highScore > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '13px monospace';
        ctx.fillText(`Best Score: ${highScore}`, W / 2, 520);
      }

      ctx.textAlign = 'left';
    };

    const drawDead = (dt: number) => {
      drawBg();
      const lv = levels[currentLevel];

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Draw level behind overlay
      lv.platforms.forEach((p, i) => drawPlatform(p, i));
      [...lv.spikes, ...spawnedSpikes].forEach(drawSpike);
      drawExit(exitX, exitY);

      ctx.restore();

      // Overlay
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(0, 0, W, H);

      // Death text
      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 44px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOU DIED', W / 2, 200);

      // Death quote (randomized per death)
      ctx.fillStyle = 'rgba(255,150,100,0.8)';
      ctx.font = 'italic 15px monospace';
      ctx.fillText(currentDeathQuote, W / 2, 250);

      // Stats
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '18px monospace';
      ctx.fillText(`Deaths this level: ${levelDeaths}  |  Total: ${totalDeaths}`, W / 2, 310);

      // Retry button
      const btnX = W / 2 - 80;
      const btnY = 360;
      const btnW = 160;
      const btnH = 48;
      ctx.fillStyle = retryBtnHover ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.1)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('RETRY', W / 2, btnY + 31);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '13px monospace';
      ctx.fillText('Press R, Space or Click to retry', W / 2, 440);

      ctx.textAlign = 'left';

      // Keep particles updating
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 3 * dt;
        p.life -= dt * 1.5;
        if (p.life <= 0) particles.splice(i, 1);
      }
      // Draw particles
      for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawLevelComplete = () => {
      drawBg();

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 15;
      ctx.fillText('Level Complete!', W / 2, 150);
      ctx.shadowBlur = 0;

      // Stars
      const stars = levelDeaths === 0 ? 3 : levelDeaths <= 2 ? 2 : levelDeaths <= 5 ? 1 : 0;
      const starStr = '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars);
      ctx.font = '40px monospace';
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(starStr, W / 2, 210);

      // Stats
      ctx.font = '18px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`Deaths: ${levelDeaths}  |  Time: ${levelTime.toFixed(1)}s`, W / 2, 260);

      const timeBonus = Math.max(0, 1000 - Math.floor(levelTime * 10));
      const deathPenalty = levelDeaths * 300;
      const levelScore = Math.max(0, 3000 + timeBonus - deathPenalty);
      ctx.fillText(`Score: ${levelScore}  (+${timeBonus} time bonus)`, W / 2, 290);
      ctx.fillText(`Total Score: ${totalScore}`, W / 2, 320);

      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText(`Best: ${highScore}`, W / 2, 350);
      if (newHighScore) {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('New High Score!', W / 2, 370);
      }

      // Next/Finish button
      const isLast = currentLevel >= levels.length - 1;
      const label = isLast ? 'FINISH' : 'NEXT LEVEL';
      const btnX = W / 2 - 90;
      const btnY = 390;
      const btnW = 180;
      const btnH = 48;
      ctx.fillStyle = nextBtnHover ? 'rgba(34,197,94,0.3)' : 'rgba(34,197,94,0.1)';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 20px monospace';
      ctx.fillText(label, W / 2, btnY + 31);

      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '13px monospace';
      ctx.fillText('Press Space or Enter to continue', W / 2, 470);

      ctx.textAlign = 'left';
    };

    const drawVictory = (dt: number) => {
      menuTime += dt;
      drawBg();

      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 44px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.fillText('YOU SURVIVED!', W / 2, 120);
      ctx.shadowBlur = 0;

      // Subtitle
      ctx.fillStyle = 'rgba(220,38,38,0.8)';
      ctx.font = '16px monospace';
      ctx.fillText('All 15 levels conquered. The Devil is impressed.', W / 2, 160);

      // Stats
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '20px monospace';
      ctx.fillText(`Final Score: ${totalScore}`, W / 2, 220);
      ctx.fillText(`Total Deaths: ${totalDeaths}`, W / 2, 255);

      // Rating
      let rating = 'Slippery Legend';
      if (totalDeaths > 50) rating = 'Eternal Slider';
      else if (totalDeaths > 30) rating = 'Determined Drifter';
      else if (totalDeaths > 15) rating = 'Quick Learner';
      else if (totalDeaths > 5) rating = 'Natural Talent';
      else if (totalDeaths === 0) rating = 'Impossible! Are you cheating?';

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`Rating: ${rating}`, W / 2, 300);

      // High score
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText(`Best: ${highScore}`, W / 2, 335);
      if (newHighScore) {
        ctx.fillStyle = '#22c55e';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('New High Score!', W / 2, 355);
      }

      // Animated devil character celebration
      const celebY = 410 + Math.sin(menuTime * 3) * 5;
      ctx.save();
      ctx.translate(W / 2, celebY);
      const celebScale = 1.5;
      ctx.scale(celebScale, celebScale);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#dc2626';
      ctx.shadowBlur = 15;
      ctx.fillRect(-10, -10, 20, 20);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.moveTo(-8, -10); ctx.lineTo(-5, -18); ctx.lineTo(-2, -10); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(2, -10); ctx.lineTo(5, -18); ctx.lineTo(8, -10); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-4, -2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.beginPath(); ctx.arc(-4, -2, 1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(4, -2, 1, 0, Math.PI * 2); ctx.fill();
      // Smile
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 2, 4, 0.1, Math.PI - 0.1); ctx.stroke();
      ctx.restore();

      // Play again button
      const btnX = W / 2 - 90;
      const btnY = 480;
      const btnW = 180;
      const btnH = 48;
      ctx.fillStyle = menuHover ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.1)';
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 18px monospace';
      ctx.fillText('PLAY AGAIN', W / 2, btnY + 30);

      ctx.textAlign = 'left';

      // Victory particles
      if (Math.random() < dt * 5) {
        spawnParticles(Math.random() * W, Math.random() * H * 0.3, 2, Math.random() > 0.5 ? '#fbbf24' : '#dc2626', 2);
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += 1 * dt;
        p.life -= dt * 0.8;
        if (p.life <= 0) particles.splice(i, 1);
      }
      for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const drawPlaying = (dt: number) => {
      drawBg();

      ctx.save();
      ctx.translate(shakeX, shakeY);

      const lv = levels[currentLevel];

      // Draw platforms
      lv.platforms.forEach((p, i) => drawPlatform(p, i));

      // Draw spikes
      [...lv.spikes, ...spawnedSpikes].forEach(drawSpike);

      // Draw exit
      drawExit(exitX, exitY);
      if (fakeExitActive) drawFakeExit(fakeExitX, fakeExitY);

      // Trail (speed-dependent intensity)
      const playerSpeed = Math.sqrt(pvx * pvx + pvy * pvy);
      const trailIntensity = clamp(playerSpeed / 300, 0.1, 1);
      for (let i = 0; i < trail.length; i++) {
        const t = trail[i];
        ctx.globalAlpha = t.alpha * 0.4 * trailIntensity;
        ctx.fillStyle = playerSpeed > 400 ? '#fbbf24' : '#ffffff';
        ctx.beginPath();
        ctx.arc(t.x, t.y, (2 + trailIntensity) * t.alpha, 0, Math.PI * 2);
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

      // Player
      drawPlayer(dt);

      // Warning flash overlay
      if (warningFlash > 0) {
        ctx.fillStyle = `rgba(220,38,38,${warningFlash * 2})`;
        ctx.fillRect(0, 0, W, H);
      }

      // HUD
      drawHUD(lv);

      ctx.restore();
    };

    // ── Update ──
    const update = (dt: number) => {
      if (state !== 'playing') return;
      if (paused) return;

      updatePhysics(dt);

      // Update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt * 1.5;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Update trail
      for (let i = trail.length - 1; i >= 0; i--) {
        trail[i].alpha -= dt * 3;
        if (trail[i].alpha <= 0) trail.splice(i, 1);
      }

      // Squash/stretch
      scaleX = lerp(scaleX, 1, 6 * dt);
      scaleY = lerp(scaleY, 1, 6 * dt);

      // Shake decay
      shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
      shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
      shakeIntensity *= 0.9;
      if (shakeIntensity < 0.1) shakeIntensity = 0;
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
          if (state === 'playing') {
            drawPlaying(dt);
            if (paused) {
              ctx.fillStyle = 'rgba(0,0,0,0.5)';
              ctx.fillRect(0, 0, W, H);
              ctx.fillStyle = '#ffffff';
              ctx.font = 'bold 48px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.shadowColor = '#dc2626';
              ctx.shadowBlur = 20;
              ctx.fillText('PAUSED', W / 2, H / 2 - 20);
              ctx.shadowBlur = 0;
              ctx.fillStyle = '#9ca3af';
              ctx.font = '16px sans-serif';
              ctx.fillText('Press P to resume', W / 2, H / 2 + 25);
              ctx.textBaseline = 'alphabetic';
              ctx.textAlign = 'left';
            }
          } else if (state === 'dead') drawDead(dt);
          else if (state === 'levelComplete') drawLevelComplete();
          break;
        case 'dead':
          drawDead(dt);
          break;
        case 'levelComplete':
          drawLevelComplete();
          break;
        case 'victory':
          drawVictory(dt);
          break;
      }

      rafId = requestAnimationFrame(gameLoop);
    };

    // ── Input ──
    const getMousePos = (e: MouseEvent | Touch) => ({
      x: (e.clientX - cachedRect.left) * (W / cachedRect.width),
      y: (e.clientY - cachedRect.top) * (H / cachedRect.height),
    });

    const handleMouseDown = (e: MouseEvent) => {
      const pos = getMousePos(e);

      if (state === 'menu') {
        if (pos.x >= W / 2 - 80 && pos.x <= W / 2 + 80 && pos.y >= 380 && pos.y <= 428) {
          state = 'playing';
          SoundEngine.startAmbient('slide-chaos');
          SoundEngine.play('menuSelect');
          currentLevel = 0;
          totalScore = 0;
          totalDeaths = 0;
          newHighScore = false;
          initLevel(0);
        }
        return;
      }

      if (state === 'dead') {
        if (pos.x >= W / 2 - 80 && pos.x <= W / 2 + 80 && pos.y >= 360 && pos.y <= 408) {
          retryLevel();
        }
        return;
      }

      if (state === 'levelComplete') {
        if (pos.x >= W / 2 - 90 && pos.x <= W / 2 + 90 && pos.y >= 390 && pos.y <= 438) {
          advanceLevel();
        }
        return;
      }

      if (state === 'victory') {
        if (pos.x >= W / 2 - 90 && pos.x <= W / 2 + 90 && pos.y >= 480 && pos.y <= 528) {
          state = 'menu';
          totalScore = 0;
          totalDeaths = 0;
          newHighScore = false;
          SoundEngine.play('menuSelect');
        }
        return;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pos = getMousePos(e);
      if (state === 'menu') {
        menuHover = pos.x >= W / 2 - 80 && pos.x <= W / 2 + 80 && pos.y >= 380 && pos.y <= 428;
      }
      if (state === 'dead') {
        retryBtnHover = pos.x >= W / 2 - 80 && pos.x <= W / 2 + 80 && pos.y >= 360 && pos.y <= 408;
      }
      if (state === 'levelComplete') {
        nextBtnHover = pos.x >= W / 2 - 90 && pos.x <= W / 2 + 90 && pos.y >= 390 && pos.y <= 438;
      }
      if (state === 'victory') {
        menuHover = pos.x >= W / 2 - 90 && pos.x <= W / 2 + 90 && pos.y >= 480 && pos.y <= 528;
      }
    };

    const retryLevel = () => {
      const savedDeaths = levelDeaths;
      initLevel(currentLevel);
      levelDeaths = savedDeaths;
      state = 'playing';
      SoundEngine.startAmbient('slide-chaos');
      SoundEngine.play('menuSelect');
    };

    const advanceLevel = () => {
      if (currentLevel >= levels.length - 1) {
        state = 'victory';
        SoundEngine.stopAmbient();
        SoundEngine.play('victoryFanfare');
        if (newHighScore) setTimeout(() => SoundEngine.play('newHighScore'), 500);
      } else {
        currentLevel++;
        state = 'playing';
        SoundEngine.startAmbient('slide-chaos');
        initLevel(currentLevel);
      }
      SoundEngine.play('menuSelect');
    };

    // Touch support
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleMouseDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as MouseEvent);
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (e.touches.length > 0) {
        handleMouseMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as MouseEvent);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      keysDown[key] = true;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
        e.preventDefault();
      }

      if (state === 'menu') {
        if (key === ' ' || key === 'Enter') {
          state = 'playing';
          SoundEngine.startAmbient('slide-chaos');
          SoundEngine.play('menuSelect');
          currentLevel = 0;
          totalScore = 0;
          totalDeaths = 0;
          newHighScore = false;
          initLevel(0);
        }
        return;
      }

      if (state === 'dead') {
        if (key === 'r' || key === 'R' || key === ' ' || key === 'Enter') {
          retryLevel();
        }
        return;
      }

      if (state === 'levelComplete') {
        if (key === ' ' || key === 'Enter') {
          advanceLevel();
        }
        return;
      }

      if (state === 'victory') {
        if (key === ' ' || key === 'Enter') {
          state = 'menu';
          totalScore = 0;
          totalDeaths = 0;
          newHighScore = false;
          SoundEngine.play('menuSelect');
        }
        return;
      }

      if (state === 'playing') {
        if (key === 'p' || key === 'P' || key === 'Escape') {
          paused = !paused;
          return;
        }
        if (paused) return;

        if (key === 'r' || key === 'R') {
          retryLevel();
          return;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysDown[e.key] = false;
    };

    // ── Attach Events ──
    const onResize = () => { cachedRect = canvas.getBoundingClientRect(); };
    window.addEventListener('resize', onResize);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const onVisibilityChange = () => {
      if (document.hidden && state === 'playing' && !paused) {
        paused = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Start
    rafId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(rafId);
      SoundEngine.stopAmbient();
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('visibilitychange', onVisibilityChange);
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
      }}
    />
  );
}
