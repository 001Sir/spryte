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
const GROUND_Y = 480;
const GRAVITY = 1800;
const SCROLL_SPEED_BASE = 200;
const SCROLL_ACCEL = 1.5;
const MAX_SCROLL = 620;

type FormType = 'runner' | 'ball' | 'glider' | 'spike';
type GameState = 'menu' | 'playing' | 'gameover';

const FORM_COLORS: Record<FormType, { main: string; glow: string; trail: string }> = {
  runner: { main: '#f97316', glow: '#fb923c', trail: '#f9731640' },
  ball:   { main: '#ef4444', glow: '#f87171', trail: '#ef444440' },
  glider: { main: '#06b6d4', glow: '#22d3ee', trail: '#06b6d440' },
  spike:  { main: '#a855f7', glow: '#c084fc', trail: '#a855f740' },
};

const WHITE = '#ffffff';
const DIM = '#667788';
const GOLD = '#ffd700';
const RED = '#ff3366';
const CYAN = '#06b6d4';

// Combo tier thresholds & multipliers
function getComboMultiplier(c: number): number {
  if (c >= 10) return 5;
  if (c >= 7) return 4;
  if (c >= 5) return 3;
  if (c >= 3) return 2;
  return 1;
}
function getComboColor(c: number): string {
  if (c >= 10) return '#ff44ff';
  if (c >= 7) return GOLD;
  if (c >= 5) return '#22ff88';
  if (c >= 3) return CYAN;
  return WHITE;
}

type ObstacleType = 'wall' | 'pit' | 'low-barrier' | 'floating-platform' | 'breakable' | 'spike-floor' | 'high-wall' | 'tunnel';

// Which forms can handle each obstacle (for hint icons & sequencing)
const OBSTACLE_SOLUTIONS: Record<ObstacleType, FormType[]> = {
  'wall':              ['ball', 'glider'],
  'high-wall':         ['ball', 'glider'],
  'pit':               ['glider', 'runner'],   // runner can jump small pits
  'low-barrier':       ['ball', 'glider', 'spike', 'runner'], // runner can slide
  'breakable':         ['ball', 'spike'],
  'spike-floor':       ['glider'],
  'tunnel':            ['ball', 'spike'],
  'floating-platform': ['runner', 'ball', 'glider', 'spike'],
};

interface Obstacle {
  x: number;
  type: ObstacleType;
  w: number;
  h: number;
  y: number;
  broken: boolean;
  scored: boolean;
  hinted: boolean; // whether hint icon was shown
}

interface Collectible {
  x: number;
  y: number;
  collected: boolean;
  type: 'gem' | 'morph-charge';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity?: number; // per-particle gravity override
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface Upgrade {
  id: string;
  title: string;
  description: string;
  icon: string;
  apply: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MorphGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let destroyed = false;
    let animId = 0;

    // -------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------

    let state: GameState = 'menu';
    let paused = false;

    // Player
    let px = 150;
    let py = GROUND_Y;
    let vy = 0;
    let onGround = true;
    let form: FormType = 'runner';
    let morphTimer = 0;
    const MORPH_DURATION = 0.15;
    let canDoubleJump = false;
    let hasDoubleJumped = false;
    let isSliding = false;
    let slideTimer = 0;
    const SLIDE_DURATION = 0.6;

    // Ball
    let ballBounceCount = 0;
    let ballAngularVel = 0;
    let ballAngle = 0;

    // Glider
    let glideTime = 0;
    let glideHoldingUp = false;

    // Spike
    let spikeSmashing = false;
    let spikeGroundHitTimer = 0;
    let spikeAngle = 0;

    // Scroll
    let scrollSpeed = SCROLL_SPEED_BASE;
    let distanceTraveled = 0;

    // Score / combo
    let score = 0;
    let highScore = 0;
    let combo = 0;
    let comboTimer = 0;
    const COMBO_WINDOW = 2.5;
    let bestCombo = 0;

    // Lives
    let lives = 3;
    let maxLives = 3;
    let invulnTimer = 0;
    const INVULN_TIME = 1.5;

    // Obstacles & collectibles
    let obstacles: Obstacle[] = [];
    let collectibles: Collectible[] = [];
    let nextObstacleX = 600;
    const MIN_GAP = 200;
    const MAX_GAP = 380;

    // Effects
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];
    let shakeTimer = 0;
    let shakeX = 0;
    let shakeY = 0;

    // Upgrades
    let lastUpgradeDistance = 0;
    const UPGRADE_INTERVAL = 2000;
    let upgradeCount = 0;
    const MAX_UPGRADES = 1;

    // Upgrade stats
    let jumpPower = 600;
    let glideStrength = 1.0;
    let ballSmashPower = 1.0;
    let spikeWeight = 1.0;
    let comboWindowBonus = 0;
    let magnetRange = 0;
    let shieldCharges = 0;
    let doubleJumpUnlocked = false;

    // Animation
    let lastTime = 0;
    let gameTime = 0;
    let renderTime = 0;
    let menuTime = 0;

    // Parallax
    let bgOffset1 = 0;
    let bgOffset2 = 0;

    // Environment progression
    let environment = 0; // 0=city, 1=forest, 2=cave, 3=sky

    // Milestone tracking
    let lastMilestone = 0;
    const MILESTONE_INTERVAL = 1000;

    // Speed line particles (separate for performance)
    let speedLines: { x: number; y: number; len: number; alpha: number }[] = [];

    // Cached gradient (reuse per environment)
    let cachedEnv = -1;
    let cachedGrad: CanvasGradient | null = null;

    // Near-miss tracking
    let nearMissTimer = 0;
    let nearMissCount = 0;

    // Danger pulse (low health)
    let dangerPulse = 0;

    // Biome transition
    let lastEnvironment = 0;
    let biomeTransitionTimer = 0;
    const BIOME_NAMES = ['CITY', 'FOREST', 'CAVERNS', 'SKY REALM'];

    // Afterimage trail on morph
    let afterimages: { x: number; y: number; form: FormType; alpha: number; r: number }[] = [];

    // Stats tracking for game over
    let totalMorphs = 0;
    let obstaclesDestroyed = 0;
    let gemsCollected = 0;
    let nearMissTotal = 0;
    let perfectMorphs = 0;

    // Streak tracking (consecutive obstacles without damage)
    let obstacleStreak = 0;
    let bestStreak = 0;

    // -------------------------------------------------------------------
    // Form physics
    // -------------------------------------------------------------------

    function getFormRadius(): number {
      if (form === 'runner' && isSliding) return 10; // smaller hitbox when sliding
      switch (form) {
        case 'runner': return 18;
        case 'ball': return 16;
        case 'glider': return 15;
        case 'spike': return 20;
      }
    }

    function getFormGravity(): number {
      switch (form) {
        case 'runner': return GRAVITY;
        case 'ball': return GRAVITY * 0.9;
        case 'glider': return glideHoldingUp ? GRAVITY * 0.05 / glideStrength : GRAVITY * 0.18 / glideStrength;
        case 'spike': return GRAVITY * 2.5 * spikeWeight;
      }
    }

    function getFormJump(): number {
      switch (form) {
        case 'runner': return jumpPower;
        case 'ball': return jumpPower * 0.85;
        case 'glider': return jumpPower * 1.15;
        case 'spike': return 0;
      }
    }

    // -------------------------------------------------------------------
    // Obstacle generation (with solvability guarantee)
    // -------------------------------------------------------------------

    function generateObstacle(x: number): Obstacle {
      const difficulty = Math.min(distanceTraveled / 10000, 1);
      const rand = Math.random();
      let type: ObstacleType;

      if (rand < 0.14) type = 'pit';
      else if (rand < 0.27) type = 'wall';
      else if (rand < 0.38) type = 'low-barrier';
      else if (rand < 0.49) type = 'breakable';
      else if (rand < 0.60) type = 'spike-floor';
      else if (rand < 0.71) type = 'high-wall';
      else if (rand < 0.82 + difficulty * 0.05) type = 'tunnel';
      else type = 'floating-platform';

      let w: number, h: number, y: number;

      switch (type) {
        case 'wall':
          w = 28 + Math.random() * 20;
          h = 70 + Math.random() * 50;
          y = GROUND_Y - h;
          break;
        case 'pit':
          w = 70 + Math.random() * 50 + difficulty * 30;
          h = H - GROUND_Y + 50;
          y = GROUND_Y;
          break;
        case 'low-barrier':
          w = 50 + Math.random() * 40;
          h = 28 + Math.random() * 12;
          y = GROUND_Y - h;
          break;
        case 'floating-platform':
          w = 70 + Math.random() * 50;
          h = 14;
          y = GROUND_Y - 110 - Math.random() * 80;
          break;
        case 'breakable':
          w = 32 + Math.random() * 18;
          h = 65 + Math.random() * 45;
          y = GROUND_Y - h;
          break;
        case 'spike-floor':
          w = 70 + Math.random() * 60;
          h = 22;
          y = GROUND_Y - h;
          break;
        case 'high-wall':
          w = 22 + Math.random() * 15;
          h = 150 + Math.random() * 50;
          y = GROUND_Y - h;
          break;
        case 'tunnel':
          w = 110 + Math.random() * 60;
          h = 50;
          y = GROUND_Y - 50;
          break;
      }

      return { x, type, w, h, y, broken: false, scored: false, hinted: false };
    }

    function spawnCollectible(baseX: number) {
      const count = Math.floor(2 + Math.random() * 3);
      for (let i = 0; i < count; i++) {
        collectibles.push({
          x: baseX + rng(20, 250),
          y: GROUND_Y - rng(30, 180),
          collected: false,
          type: Math.random() < 0.88 ? 'gem' : 'morph-charge',
        });
      }
    }

    // -------------------------------------------------------------------
    // Particles
    // -------------------------------------------------------------------

    function spawnParticles(x: number, y: number, color: string, count: number, speed = 3, grav?: number) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rng(-0.3, 0.3);
        const spd = rng(speed * 0.3, speed);
        particles.push({
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: rng(0.3, 0.8),
          maxLife: 0.8,
          color,
          size: rng(2, 5),
          gravity: grav,
        });
      }
    }

    function spawnDust(x: number, y: number, count: number) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x: x + rng(-8, 8), y,
          vx: rng(-2, 2) - scrollSpeed * 0.005,
          vy: rng(-2, -0.3),
          life: rng(0.3, 0.6),
          maxLife: 0.6,
          color: '#8a7a6a',
          size: rng(2, 4),
          gravity: 20,
        });
      }
    }

    function spawnTrailParticle() {
      const colors = FORM_COLORS[form];
      const r = getFormRadius();
      particles.push({
        x: px + rng(-r * 0.5, r * 0.5),
        y: py + rng(-r * 0.3, r * 0.3),
        vx: rng(-0.5, 0.5) - scrollSpeed * 0.012,
        vy: rng(-1, 0.5),
        life: rng(0.15, 0.4),
        maxLife: 0.4,
        color: colors.trail,
        size: rng(2, 4),
      });
    }

    function spawnEnvParticle() {
      // Environment-specific ambient particles
      switch (environment) {
        case 1: // Forest — falling leaves
          particles.push({
            x: rng(0, W), y: -5,
            vx: rng(-0.5, 0.5) - scrollSpeed * 0.003,
            vy: rng(0.3, 1.2),
            life: rng(3, 6), maxLife: 6,
            color: '#4a7a3a',
            size: rng(2, 4),
            gravity: 5,
          });
          break;
        case 2: // Cave — dust motes
          particles.push({
            x: rng(0, W), y: rng(20, GROUND_Y - 20),
            vx: rng(-0.2, 0.2),
            vy: rng(-0.1, 0.1),
            life: rng(2, 5), maxLife: 5,
            color: '#6a5a4a40',
            size: rng(1, 3),
          });
          break;
        case 3: // Sky — stars twinkle
          particles.push({
            x: rng(0, W), y: rng(10, 120),
            vx: -scrollSpeed * 0.001,
            vy: 0,
            life: rng(1, 3), maxLife: 3,
            color: '#ffffff60',
            size: rng(1, 2),
          });
          break;
      }
    }

    function spawnFloatingText(x: number, y: number, text: string, color: string, size = 16) {
      floatingTexts.push({ x, y, text, color, size, life: 1.0, maxLife: 1.0 });
    }

    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vy += (p.gravity ?? 40) * dt;
        p.life -= dt;
        if (p.life <= 0) { particles[i] = particles[particles.length - 1]; particles.pop(); }
      }
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 40 * dt;
        ft.life -= dt;
        if (ft.life <= 0) { floatingTexts[i] = floatingTexts[floatingTexts.length - 1]; floatingTexts.pop(); }
      }
    }

    // -------------------------------------------------------------------
    // Speed lines
    // -------------------------------------------------------------------

    function updateSpeedLines(dt: number) {
      const speedFactor = (scrollSpeed - SCROLL_SPEED_BASE) / (MAX_SCROLL - SCROLL_SPEED_BASE);
      if (speedFactor < 0.2) { speedLines = []; return; }

      // Spawn new lines
      if (Math.random() < speedFactor * 0.8) {
        speedLines.push({
          x: W + 10,
          y: rng(20, GROUND_Y - 20),
          len: rng(30, 80) * speedFactor,
          alpha: rng(0.1, 0.3) * speedFactor,
        });
      }

      // Update
      for (let i = speedLines.length - 1; i >= 0; i--) {
        speedLines[i].x -= scrollSpeed * dt * 1.5;
        if (speedLines[i].x + speedLines[i].len < 0) {
          speedLines[i] = speedLines[speedLines.length - 1];
          speedLines.pop();
        }
      }
    }

    // -------------------------------------------------------------------
    // Morph
    // -------------------------------------------------------------------

    function morphTo(newForm: FormType) {
      if (newForm === form) return;
      if (state !== 'playing') return;

      form = newForm;
      morphTimer = MORPH_DURATION;

      // Form-specific transitions
      if (newForm === 'ball') {
        ballBounceCount = 0;
        ballAngularVel = 8;
      }
      if (newForm === 'glider') {
        glideTime = 0;
        if (vy > 0) vy *= 0.3;
      }
      if (newForm === 'spike') {
        spikeSmashing = !onGround;
        spikeAngle = 0;
        if (!onGround) vy = 100;
      }
      if (newForm === 'runner') {
        isSliding = false;
        slideTimer = 0;
        hasDoubleJumped = false;
      }

      spawnParticles(px, py, FORM_COLORS[newForm].main, 12, 3);
      SoundEngine.play('portalEnter');

      // Check for perfect morph (obstacle within 120px ahead)
      let perfectMorph = false;
      for (const obs of obstacles) {
        if (obs.broken || obs.scored) continue;
        const dist = obs.x - px;
        if (dist > 0 && dist < 120 && OBSTACLE_SOLUTIONS[obs.type].includes(newForm)) {
          perfectMorph = true;
          break;
        }
      }

      // Combo
      combo++;
      comboTimer = COMBO_WINDOW + comboWindowBonus;
      if (combo > bestCombo) bestCombo = combo;
      totalMorphs++;

      // Afterimage at old position
      afterimages.push({ x: px, y: py, form: newForm, alpha: 0.6, r: getFormRadius() });
      if (afterimages.length > 5) afterimages.shift();

      const mult = getComboMultiplier(combo);

      if (perfectMorph) {
        perfectMorphs++;
        const bonus = Math.round((40 + combo * 10) * mult);
        score += bonus;
        spawnFloatingText(px + 30, py - 50, `PERFECT! +${bonus}`, '#22ff88', 22);
        SoundEngine.play('bullseye');
        shakeTimer = 0.1 + Math.min(combo * 0.03, 0.2);
        spawnParticles(px, py, '#22ff88', 10, 4);
      } else if (combo >= 3) {
        if (combo >= 7) {
          SoundEngine.play('streakRise');
        } else {
          SoundEngine.play('comboUp');
        }
        const bonus = Math.round(combo * 15 * mult);
        score += bonus;
        const cc = getComboColor(combo);
        const sz = Math.min(14 + combo * 2, 30);
        spawnFloatingText(px, py - 40, `x${combo} MORPH! +${bonus}`, cc, sz);
        if (combo >= 5) {
          shakeTimer = 0.08 + Math.min(combo * 0.02, 0.15);
        }
      }
    }

    // -------------------------------------------------------------------
    // Collision
    // -------------------------------------------------------------------

    function checkCollisions() {
      const r = getFormRadius();
      const playerLeft = px - r;
      const playerRight = px + r;
      const playerTop = py - r;
      const playerBottom = py + r;

      for (const obs of obstacles) {
        if (obs.broken) continue;

        const obsRight = obs.x + obs.w;
        const obsBottom = obs.y + obs.h;

        // Score for passing obstacles (check before collision)
        if (!obs.scored && px - r > obsRight) {
          obs.scored = true;
          if (obs.type !== 'floating-platform') {
            const mult = getComboMultiplier(combo);
            score += 10 * mult;
            obstacleStreak++;
            if (obstacleStreak > bestStreak) bestStreak = obstacleStreak;

            // Near-miss bonus: passed very close vertically or horizontally
            const vertDist = Math.abs(py - (obs.y + obs.h / 2));
            const horzClearance = px - r - obsRight;
            if ((vertDist < r + 15 || horzClearance < 20) && obs.type !== 'pit') {
              nearMissCount++;
              nearMissTotal++;
              nearMissTimer = 0.6;
              const nmBonus = 25 * mult;
              score += nmBonus;
              spawnFloatingText(px + 40, py - 20, `CLOSE! +${nmBonus}`, '#ff88ff', 14);
              SoundEngine.play('nerveChain');
            }

            // Streak milestones
            if (obstacleStreak > 0 && obstacleStreak % 10 === 0) {
              const streakBonus = obstacleStreak * 5;
              score += streakBonus;
              spawnFloatingText(px, py - 60, `${obstacleStreak} STREAK! +${streakBonus}`, GOLD, 20);
              SoundEngine.play('streakRise');
            }
          }
          continue;
        }

        // Broad check
        if (playerRight < obs.x || playerLeft > obsRight) continue;
        if (playerBottom < obs.y || playerTop > obsBottom) continue;

        // Collision!
        switch (obs.type) {
          case 'pit':
            // Don't collide here — handled in ground logic
            break;

          case 'wall':
          case 'high-wall':
            if (form === 'ball') {
              obs.broken = true;
              obstaclesDestroyed++;
              const mult = getComboMultiplier(combo);
              const smashPts = Math.round(30 * ballSmashPower * mult);
              spawnParticles(obs.x + obs.w / 2, obs.y + obs.h / 2, '#aaa', 18, 5);
              // Debris chunks
              for (let d = 0; d < 6; d++) {
                particles.push({
                  x: obs.x + rng(0, obs.w), y: obs.y + rng(0, obs.h),
                  vx: rng(-4, 4), vy: rng(-6, -1),
                  life: rng(0.5, 1.2), maxLife: 1.2,
                  color: '#7a7a9a', size: rng(3, 7), gravity: 300,
                });
              }
              SoundEngine.play('wallHit');
              score += smashPts;
              spawnFloatingText(obs.x, obs.y, `+${smashPts} SMASH!`, FORM_COLORS.ball.main, mult > 1 ? 20 : 16);
              shakeTimer = 0.15 + Math.min(combo * 0.02, 0.1);
            } else if (form === 'glider') {
              if (playerBottom > obs.y + 8) hitPlayer();
              // Can fly over
            } else {
              hitPlayer();
            }
            break;

          case 'low-barrier':
            if (form === 'ball') {
              obs.broken = true;
              obstaclesDestroyed++;
              spawnParticles(obs.x + obs.w / 2, obs.y, '#aaa', 10, 3);
              SoundEngine.play('wallHit');
              score += Math.round(15 * ballSmashPower * getComboMultiplier(combo));
            } else if (form === 'spike' && spikeSmashing) {
              obs.broken = true;
              obstaclesDestroyed++;
              spawnParticles(obs.x + obs.w / 2, obs.y, FORM_COLORS.spike.main, 12, 4);
              SoundEngine.play('enemyDeath');
              score += Math.round(25 * getComboMultiplier(combo));
            } else if (form === 'runner' && isSliding) {
              // Runner slides under — no collision
            } else if (form === 'runner' && !isSliding) {
              // Runner can jump over if above it
              if (playerBottom > obs.y + 6) hitPlayer();
            } else if (form === 'glider') {
              // Glider flies over
              if (playerBottom > obs.y + 8) hitPlayer();
            }
            break;

          case 'breakable':
            if (form === 'ball') {
              obs.broken = true;
              obstaclesDestroyed++;
              const mult = getComboMultiplier(combo);
              const pts = Math.round(50 * ballSmashPower * mult);
              spawnParticles(obs.x + obs.w / 2, obs.y + obs.h / 2, FORM_COLORS.ball.glow, 20, 5);
              // Extra debris
              for (let d = 0; d < 8; d++) {
                particles.push({
                  x: obs.x + rng(0, obs.w), y: obs.y + rng(0, obs.h),
                  vx: rng(-5, 5), vy: rng(-8, -2),
                  life: rng(0.6, 1.4), maxLife: 1.4,
                  color: rng(0, 1) > 0.5 ? '#8a6a4a' : '#5a3a2a', size: rng(3, 8), gravity: 350,
                });
              }
              SoundEngine.play('enemyDeath');
              score += pts;
              spawnFloatingText(obs.x, obs.y, `+${pts} CRUSH!`, FORM_COLORS.ball.main, mult > 1 ? 22 : 18);
              shakeTimer = 0.2 + Math.min(combo * 0.03, 0.15);
            } else if (form === 'spike' && spikeSmashing) {
              obs.broken = true;
              obstaclesDestroyed++;
              const mult = getComboMultiplier(combo);
              const pts = Math.round(60 * mult);
              spawnParticles(obs.x + obs.w / 2, obs.y + obs.h / 2, FORM_COLORS.spike.glow, 20, 5);
              for (let d = 0; d < 8; d++) {
                particles.push({
                  x: obs.x + rng(0, obs.w), y: obs.y + rng(0, obs.h),
                  vx: rng(-5, 5), vy: rng(-8, -2),
                  life: rng(0.6, 1.4), maxLife: 1.4,
                  color: '#6a4a3a', size: rng(3, 8), gravity: 350,
                });
              }
              SoundEngine.play('enemyDeath');
              score += pts;
              spawnFloatingText(obs.x, obs.y, `+${pts} OBLITERATE!`, FORM_COLORS.spike.main, mult > 1 ? 24 : 20);
              shakeTimer = 0.25 + Math.min(combo * 0.03, 0.15);
            } else {
              hitPlayer();
            }
            break;

          case 'spike-floor':
            if (form === 'glider') {
              if (playerBottom > obs.y + 10) hitPlayer();
            } else if (form === 'ball') {
              vy = -400;
              py = obs.y - r;
              hitPlayer();
            } else {
              hitPlayer();
            }
            break;

          case 'tunnel':
            if (form === 'runner' && !isSliding) {
              hitPlayer();
            } else if (form === 'glider') {
              if (playerTop < obs.y) hitPlayer();
            }
            // Ball, spike, and sliding runner pass through
            break;

          case 'floating-platform':
            if (vy >= 0 && playerBottom >= obs.y && playerBottom <= obs.y + 20 && py - r < obs.y) {
              py = obs.y - r;
              vy = 0;
              onGround = true;
              hasDoubleJumped = false;
            }
            break;
        }
      }

      // Collectibles
      const r2 = getFormRadius();
      for (const c of collectibles) {
        if (c.collected) continue;
        const dx = px - c.x;
        const dy = py - c.y;
        const collectDist = magnetRange > 0 ? magnetRange + r2 : r2 + 12;
        if (dx * dx + dy * dy < collectDist * collectDist) {
          c.collected = true;
          if (c.type === 'gem') {
            gemsCollected++;
            const mult = getComboMultiplier(combo);
            const pts = 20 * Math.max(1, combo) * mult;
            score += pts;
            spawnFloatingText(c.x, c.y - 10, `+${pts}`, GOLD, mult > 1 ? 16 : 14);
            SoundEngine.play('collectGem');
            spawnParticles(c.x, c.y, GOLD, 6 + mult * 2, 2);
          } else {
            comboTimer += 1.5;
            spawnFloatingText(c.x, c.y - 10, '+MORPH', FORM_COLORS[form].main, 16);
            SoundEngine.play('collectPowerup');
            spawnParticles(c.x, c.y, FORM_COLORS[form].main, 8, 3);
          }
        }
      }

      // Magnet pull
      if (magnetRange > 0) {
        for (const c of collectibles) {
          if (c.collected) continue;
          const dx = px - c.x;
          const dy = py - c.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < magnetRange + 60 && d > 1) {
            const pull = 220 / d;
            c.x += dx * pull * 0.016;
            c.y += dy * pull * 0.016;
          }
        }
      }
    }

    // -------------------------------------------------------------------
    // Player damage
    // -------------------------------------------------------------------

    function hitPlayer() {
      if (invulnTimer > 0) return;
      if (shieldCharges > 0) {
        shieldCharges--;
        invulnTimer = 0.5;
        spawnParticles(px, py, '#66ffff', 14, 4);
        SoundEngine.play('bounce');
        spawnFloatingText(px, py - 30, 'SHIELD!', '#66ffff', 18);
        return;
      }
      lives--;
      invulnTimer = INVULN_TIME;
      combo = 0;
      comboTimer = 0;
      obstacleStreak = 0;
      SoundEngine.play('playerDamage');
      spawnParticles(px, py, RED, 20, 5);
      // Damage ring effect
      for (let a = 0; a < 12; a++) {
        const angle = (Math.PI * 2 * a) / 12;
        particles.push({
          x: px + Math.cos(angle) * 20, y: py + Math.sin(angle) * 20,
          vx: Math.cos(angle) * 3, vy: Math.sin(angle) * 3,
          life: 0.4, maxLife: 0.4, color: RED, size: 2, gravity: 0,
        });
      }

      if (lives <= 0) endGame();
    }

    // -------------------------------------------------------------------
    // Upgrades
    // -------------------------------------------------------------------

    function generateUpgrades() {
      const pool: Upgrade[] = [
        { id: 'jump-boost', title: 'Spring Legs', description: `Jump power +15%`, icon: '↑', apply: () => { jumpPower *= 1.15; } },
        { id: 'glide-power', title: 'Wind Rider', description: `Glider lift +25%`, icon: '~', apply: () => { glideStrength *= 1.25; } },
        { id: 'ball-power', title: 'Wrecking Ball', description: `Ball smash +30%`, icon: 'O', apply: () => { ballSmashPower *= 1.3; } },
        { id: 'spike-weight', title: 'Heavy Spike', description: `Spike falls +25% faster`, icon: 'V', apply: () => { spikeWeight *= 1.25; } },
        { id: 'combo-window', title: 'Flow State', description: `Combo window +0.6s`, icon: '>>', apply: () => { comboWindowBonus += 0.6; } },
        { id: 'magnet', title: 'Magnet', description: `Pull gems toward you`, icon: '@', apply: () => { magnetRange += 70; } },
        { id: 'extra-life', title: 'Extra Life', description: `+1 life`, icon: '+', apply: () => { lives++; maxLives++; } },
        { id: 'shield', title: 'Shield', description: `Block next hit`, icon: '()', apply: () => { shieldCharges++; } },
        { id: 'double-jump', title: 'Double Jump', description: `Runner can jump mid-air`, icon: '^^', apply: () => { doubleJumpUnlocked = true; } },
      ];

      // Remove acquired one-time upgrades
      const filtered = pool.filter(u => {
        if (u.id === 'double-jump' && doubleJumpUnlocked) return false;
        return true;
      });

      const shuffled = filtered.sort(() => Math.random() - 0.5);
      if (shuffled.length > 0) {
        const chosen = shuffled[0];
        chosen.apply();
        SoundEngine.play('collectPowerup');
        spawnFloatingText(px, py - 40, `${chosen.icon} ${chosen.title}`, GOLD, 18);
        spawnParticles(px, py, GOLD, 12, 4);
      }
    }

    // -------------------------------------------------------------------
    // Game lifecycle
    // -------------------------------------------------------------------

    function startGame() {
      state = 'playing';
      paused = false;
      px = 150; py = GROUND_Y - 20; vy = 0;
      onGround = true;
      form = 'runner';
      morphTimer = 0;
      canDoubleJump = false;
      hasDoubleJumped = false;
      isSliding = false;
      slideTimer = 0;
      scrollSpeed = SCROLL_SPEED_BASE;
      distanceTraveled = 0;
      score = 0; combo = 0; comboTimer = 0; bestCombo = 0;
      lives = 3; maxLives = 3; invulnTimer = 0;
      obstacles = []; collectibles = [];
      particles = []; floatingTexts = [];
      speedLines = [];
      nextObstacleX = 600;
      shakeTimer = 0;
      gameTime = 0;
      upgradeCount = 0; lastUpgradeDistance = 0; lastMilestone = 0;
      jumpPower = 600; glideStrength = 1.0; ballSmashPower = 1.0;
      spikeWeight = 1.0; comboWindowBonus = 0; magnetRange = 0;
      shieldCharges = 0; doubleJumpUnlocked = false;
      ballBounceCount = 0; ballAngularVel = 0; ballAngle = 0;
      glideTime = 0; glideHoldingUp = false;
      spikeSmashing = false; spikeGroundHitTimer = 0; spikeAngle = 0;
      environment = 0; lastEnvironment = 0; cachedEnv = -1;
      nearMissTimer = 0; nearMissCount = 0; dangerPulse = 0;
      biomeTransitionTimer = 0; afterimages = [];
      totalMorphs = 0; obstaclesDestroyed = 0; gemsCollected = 0;
      nearMissTotal = 0; perfectMorphs = 0;
      obstacleStreak = 0; bestStreak = 0;

      highScore = getHighScore('morph');
      reportGameStart('morph');
      SoundEngine.startAmbient('synth-combat');
    }

    function endGame() {
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        setHighScore('morph', score);
        SoundEngine.play('newHighScore');
      }
      SoundEngine.play('gameOver');
      SoundEngine.stopAmbient();
      reportGameEnd('morph', score, false, Math.floor(distanceTraveled / 100));
    }

    // -------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------

    function update(dt: number) {
      if (dt > 0.1) dt = 0.1;
      renderTime += dt;

      if (state === 'menu') { menuTime += dt; return; }
      if (state === 'gameover') { updateParticles(dt); return; }
      if (paused) { return; }

      gameTime += dt;

      // Scroll speed
      scrollSpeed = Math.min(SCROLL_SPEED_BASE + distanceTraveled * 0.007 + gameTime * SCROLL_ACCEL, MAX_SCROLL);
      distanceTraveled += scrollSpeed * dt;

      // Environment
      environment = Math.min(3, Math.floor(distanceTraveled / 5000));

      // Biome transition effect
      if (environment !== lastEnvironment) {
        lastEnvironment = environment;
        biomeTransitionTimer = 2.0;
        spawnParticles(W / 2, H / 2, FORM_COLORS[form].main, 30, 6);
        SoundEngine.play('waveStart');
        // Switch ambient music per biome
        const biomeAmbients = ['synth-combat', 'underground', 'dark-cave', 'cosmic-orbit'] as const;
        SoundEngine.stopAmbient();
        SoundEngine.startAmbient(biomeAmbients[environment]);
      }
      if (biomeTransitionTimer > 0) biomeTransitionTimer -= dt;

      // Danger pulse when low health
      if (lives === 1) {
        dangerPulse += dt * 4;
      } else {
        dangerPulse = 0;
      }

      // Near-miss timer
      if (nearMissTimer > 0) nearMissTimer -= dt;

      // Afterimage decay
      for (let i = afterimages.length - 1; i >= 0; i--) {
        afterimages[i].alpha -= dt * 2;
        if (afterimages[i].alpha <= 0) afterimages.splice(i, 1);
      }

      // Milestones
      const currentMilestone = Math.floor(distanceTraveled / MILESTONE_INTERVAL) * MILESTONE_INTERVAL;
      if (currentMilestone > lastMilestone && currentMilestone > 0) {
        lastMilestone = currentMilestone;
        const bonus = Math.floor(currentMilestone / 10);
        score += bonus;
        spawnFloatingText(W / 2, H / 2 - 60, `${currentMilestone}m! +${bonus}`, GOLD, 26);
        SoundEngine.play('levelComplete');
        spawnParticles(W / 2, H / 2, GOLD, 20, 5);
      }

      // Upgrade milestone (limited to MAX_UPGRADES per game)
      if (upgradeCount < MAX_UPGRADES && distanceTraveled - lastUpgradeDistance >= UPGRADE_INTERVAL) {
        lastUpgradeDistance = Math.floor(distanceTraveled / UPGRADE_INTERVAL) * UPGRADE_INTERVAL;
        generateUpgrades();
        upgradeCount++;
      }

      // Combo timer
      if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) { combo = 0; comboTimer = 0; }
      }

      if (invulnTimer > 0) invulnTimer -= dt;
      if (morphTimer > 0) morphTimer -= dt;

      // Screen shake (intensity scales with combo)
      if (shakeTimer > 0) {
        shakeTimer -= dt;
        const shakeIntensity = 1 + Math.min(combo * 0.15, 1.5);
        shakeX = rng(-4, 4) * (shakeTimer / 0.3) * shakeIntensity;
        shakeY = rng(-3, 3) * (shakeTimer / 0.3) * shakeIntensity;
      } else { shakeX = 0; shakeY = 0; }

      // Sliding timer
      if (isSliding) {
        slideTimer -= dt;
        if (slideTimer <= 0) { isSliding = false; slideTimer = 0; }
      }

      // ------- Player physics -------

      vy += getFormGravity() * dt;

      // Glider float
      if (form === 'glider' && !onGround) {
        glideTime += dt;
        vy += Math.sin(glideTime * 3) * 20 * dt;
        if (vy > 120) vy = 120; // terminal velocity for glider
      }

      py += vy * dt;

      // Ground collision
      const r = getFormRadius();
      if (py + r >= GROUND_Y) {
        // Check pit
        let overPit = false;
        for (const obs of obstacles) {
          if (obs.type === 'pit' && !obs.broken && px > obs.x + 5 && px < obs.x + obs.w - 5) {
            overPit = true;
            break;
          }
        }

        if (overPit) {
          if (py > H + 50) {
            hitPlayer();
            py = GROUND_Y - r - 60;
            vy = -350;
          }
        } else {
          const wasAirborne = !onGround;
          py = GROUND_Y - r;

          if (vy > 50) {
            if (form === 'ball') {
              vy = -vy * 0.6;
              ballBounceCount++;
              if (ballBounceCount >= 3) ballBounceCount = 0;
              SoundEngine.play('bounce');
              spawnDust(px, GROUND_Y, 4);
            } else if (form === 'spike' && spikeSmashing) {
              spikeSmashing = false;
              spikeGroundHitTimer = 0.35;
              vy = 0;
              shakeTimer = 0.25;
              spawnParticles(px, GROUND_Y, FORM_COLORS.spike.glow, 22, 6);
              spawnDust(px, GROUND_Y, 8);
              SoundEngine.play('wallHit');
              // Quake destroys nearby breakables
              for (const obs of obstacles) {
                if (obs.broken) continue;
                if ((obs.type === 'breakable' || obs.type === 'low-barrier') &&
                    Math.abs(obs.x + obs.w / 2 - px) < 90) {
                  obs.broken = true;
                  obstaclesDestroyed++;
                  const qMult = getComboMultiplier(combo);
                  const qPts = Math.round(40 * qMult);
                  spawnParticles(obs.x + obs.w / 2, obs.y + obs.h / 2, FORM_COLORS.spike.main, 10, 4);
                  score += qPts;
                  spawnFloatingText(obs.x, obs.y, `+${qPts} QUAKE!`, FORM_COLORS.spike.main);
                }
              }
            } else {
              vy = 0;
              if (wasAirborne) spawnDust(px, GROUND_Y, 3);
            }
          } else {
            vy = 0;
          }
          onGround = true;
          hasDoubleJumped = false;
        }
      } else {
        onGround = false;
      }

      // Ball rotation
      if (form === 'ball') {
        ballAngle += ballAngularVel * dt;
        if (onGround) ballAngularVel = scrollSpeed * 0.012;
      }

      // Spike drill rotation during smash
      if (form === 'spike' && spikeSmashing) {
        spikeAngle += dt * 15;
      }

      if (spikeGroundHitTimer > 0) spikeGroundHitTimer -= dt;

      // Running dust (more at high speed)
      const dustChance = 0.15 + (scrollSpeed - SCROLL_SPEED_BASE) / (MAX_SCROLL - SCROLL_SPEED_BASE) * 0.2;
      if (form === 'runner' && onGround && !isSliding && Math.random() < dustChance) {
        spawnDust(px - 5, GROUND_Y, 1);
      }
      // Ball roll sparks at high speed
      if (form === 'ball' && onGround && scrollSpeed > 350 && Math.random() < 0.2) {
        particles.push({
          x: px + rng(-8, 8), y: GROUND_Y - 2,
          vx: rng(-1, 1), vy: rng(-3, -1),
          life: 0.15, maxLife: 0.15,
          color: '#ffaa44', size: rng(1, 3), gravity: 0,
        });
      }
      // Glider wind particles
      if (form === 'glider' && !onGround && Math.random() < 0.25) {
        particles.push({
          x: px - getFormRadius() - rng(5, 15), y: py + rng(-6, 6),
          vx: -scrollSpeed * 0.02, vy: rng(-0.5, 0.5),
          life: 0.2, maxLife: 0.2,
          color: FORM_COLORS.glider.trail, size: rng(1, 2), gravity: 0,
        });
      }

      // Scroll obstacles
      for (const obs of obstacles) obs.x -= scrollSpeed * dt;
      for (const c of collectibles) if (!c.collected) c.x -= scrollSpeed * dt;

      // Remove off-screen
      obstacles = obstacles.filter(o => o.x + o.w > -50);
      collectibles = collectibles.filter(c => c.x > -50 || c.collected);

      // Generate new obstacles
      while (nextObstacleX < W + 500) {
        const obs = generateObstacle(nextObstacleX);
        obstacles.push(obs);
        spawnCollectible(nextObstacleX - 80);
        const gap = rng(MIN_GAP, MAX_GAP) - Math.min(distanceTraveled * 0.004, 70);
        nextObstacleX += obs.w + Math.max(gap, 120);
      }
      nextObstacleX -= scrollSpeed * dt;

      // Collisions
      checkCollisions();

      // Trail particles
      if (Math.random() < 0.35) spawnTrailParticle();

      // Environmental particles
      if (environment > 0 && Math.random() < 0.06) spawnEnvParticle();

      // Speed lines
      updateSpeedLines(dt);

      // Update particles
      updateParticles(dt);

      // Parallax
      bgOffset1 += scrollSpeed * 0.1 * dt;
      bgOffset2 += scrollSpeed * 0.3 * dt;

      // Distance score (with multiplier)
      score += scrollSpeed * dt * 0.05 * getComboMultiplier(combo);
    }

    // -------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------

    function draw() {
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Sky gradient (cached per environment)
      if (cachedEnv !== environment) {
        cachedEnv = environment;
        cachedGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
        const envColors = [
          ['#0a0a1a', '#141428'],
          ['#0a1a0a', '#1a2a1a'],
          ['#0a0808', '#1a1412'],
          ['#060818', '#0a0a2a'],
        ][environment];
        cachedGrad.addColorStop(0, envColors[0]);
        cachedGrad.addColorStop(1, envColors[1]);
      }
      ctx.fillStyle = cachedGrad!;
      ctx.fillRect(-10, -10, W + 20, GROUND_Y + 10);

      // Ground
      const groundColors = ['#1a1a2e', '#1a2a1a', '#2a1a14', '#0a0a2a'][environment];
      ctx.fillStyle = groundColors;
      ctx.fillRect(-10, GROUND_Y, W + 20, H - GROUND_Y + 10);

      // Ground texture hash marks
      ctx.strokeStyle = ['#2a2a4a', '#2a3a2a', '#3a2a1a', '#1a1a3a'][environment];
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 20) {
        const ox = ((gx + bgOffset2 * 2) % W + W) % W;
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.moveTo(ox, GROUND_Y);
        ctx.lineTo(ox, GROUND_Y + 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Ground line
      ctx.strokeStyle = ['#2a2a4a', '#2a4a2a', '#4a2a1a', '#1a1a4a'][environment];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.lineTo(W, GROUND_Y);
      ctx.stroke();

      // Parallax bg dots
      ctx.fillStyle = '#1a1a2f';
      ctx.globalAlpha = 0.25;
      for (let x = 0; x < W; x += 40) {
        for (let y = 40; y < GROUND_Y; y += 40) {
          const ox = ((x + bgOffset1) % 40 + 40) % 40;
          ctx.fillRect(ox + x - (ox > x ? 40 : 0), y, 2, 2);
        }
      }
      ctx.globalAlpha = 1;

      // Parallax midground
      drawParallaxMid();

      // Speed lines
      if (speedLines.length > 0) {
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 1;
        for (const sl of speedLines) {
          ctx.globalAlpha = sl.alpha;
          ctx.beginPath();
          ctx.moveTo(sl.x, sl.y);
          ctx.lineTo(sl.x + sl.len, sl.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // Obstacles
      for (const obs of obstacles) {
        if (obs.broken) continue;
        if (obs.x > W + 50 || obs.x + obs.w < -50) continue;
        drawObstacle(obs);
      }

      // Obstacle hint icons (upcoming)
      if (state === 'playing') drawObstacleHints();

      // Collectibles
      for (const c of collectibles) {
        if (c.collected || c.x < -20 || c.x > W + 20) continue;
        drawCollectible(c);
      }

      // Particles (with glow for large particles)
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        if (p.size > 4) {
          ctx.shadowColor = p.color;
          ctx.shadowBlur = p.size * 2;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;

      // Afterimages (morph ghosts)
      for (const ai of afterimages) {
        ctx.globalAlpha = ai.alpha * 0.4;
        ctx.fillStyle = FORM_COLORS[ai.form].main;
        ctx.beginPath();
        ctx.arc(ai.x, ai.y, ai.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Player
      if (state !== 'menu') drawPlayer();

      // Floating texts
      for (const ft of floatingTexts) {
        const alpha = ft.life / ft.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${ft.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;

      // Danger vignette (pulsing red border when 1 life)
      if (lives === 1 && state === 'playing') {
        const dAlpha = 0.08 + Math.sin(dangerPulse) * 0.06;
        ctx.save();
        const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
        vg.addColorStop(0, 'transparent');
        vg.addColorStop(1, `rgba(255,20,40,${dAlpha})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }

      // Biome transition banner
      if (biomeTransitionTimer > 0 && state === 'playing') {
        const btAlpha = Math.min(1, biomeTransitionTimer);
        ctx.globalAlpha = btAlpha * 0.9;
        ctx.fillStyle = '#00000080';
        ctx.fillRect(0, H / 2 - 30, W, 60);
        ctx.fillStyle = FORM_COLORS[form].main;
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = FORM_COLORS[form].glow;
        ctx.shadowBlur = 20;
        ctx.fillText(BIOME_NAMES[environment], W / 2, H / 2 + 8);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      // Near-miss flash
      if (nearMissTimer > 0) {
        ctx.globalAlpha = nearMissTimer * 0.1;
        ctx.fillStyle = '#ff88ff';
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }

      // HUD
      if (state === 'playing') drawHUD();

      // Pause overlay
      if (paused && state === 'playing') drawPauseScreen();

      // Menu
      if (state === 'menu') drawMenu();

      // Game over
      if (state === 'gameover') drawGameOver();

      ctx.restore();
    }

    function drawParallaxMid() {
      // Far background layer (very slow parallax)
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 6; i++) {
        const farX = ((i * 180 - bgOffset1 * 0.3) % (W + 300) + W + 300) % (W + 300) - 150;
        const fh = 80 + (i * 53 % 100);
        if (environment === 0) {
          ctx.fillStyle = '#1a1a3a';
          ctx.fillRect(farX, GROUND_Y - fh, 60 + (i * 17 % 30), fh);
        } else if (environment === 3) {
          // Distant clouds
          ctx.fillStyle = '#1a1a4a';
          ctx.beginPath();
          ctx.arc(farX + 30, 100 + (i * 41 % 80), 35 + (i * 13 % 20), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Mid background layer
      ctx.globalAlpha = 0.14;
      for (let i = 0; i < 10; i++) {
        const baseX = ((i * 110 - bgOffset2) % (W + 250) + W + 250) % (W + 250) - 125;
        const h = 50 + (i * 37 % 90);

        if (environment === 0) {
          // City buildings with lit/unlit windows
          ctx.fillStyle = '#2a2a4a';
          const bw = 40 + (i * 13 % 35);
          ctx.fillRect(baseX, GROUND_Y - h, bw, h);
          // Roof antenna
          if (i % 3 === 0) {
            ctx.fillRect(baseX + bw / 2 - 1, GROUND_Y - h - 12, 2, 12);
            ctx.fillStyle = '#ff333360';
            ctx.beginPath();
            ctx.arc(baseX + bw / 2, GROUND_Y - h - 12, 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2a2a4a';
          }
          // Windows (some lit yellow)
          for (let wy = GROUND_Y - h + 8; wy < GROUND_Y - 8; wy += 14) {
            for (let wx = baseX + 5; wx < baseX + bw - 5; wx += 10) {
              const lit = ((wx * 7 + wy * 13 + i * 31) % 5) === 0;
              ctx.fillStyle = lit ? '#ffd70030' : '#3a3a5a';
              ctx.fillRect(wx, wy, 5, 6);
            }
          }
        } else if (environment === 1) {
          // Forest: layered trees with varying greens
          const trunkW = 6 + (i % 3) * 2;
          ctx.fillStyle = '#2a1a0a';
          ctx.fillRect(baseX + 15 - trunkW / 2, GROUND_Y - h * 0.35, trunkW, h * 0.35);
          // Foliage layers
          const greens = ['#1a3a1a', '#1a4a1a', '#0a3a0a'];
          for (let layer = 0; layer < 3; layer++) {
            ctx.fillStyle = greens[layer];
            const ly = GROUND_Y - h + layer * (h * 0.15);
            const lw = h * (0.4 - layer * 0.06);
            ctx.beginPath();
            ctx.moveTo(baseX + 15, ly);
            ctx.lineTo(baseX + 15 - lw, ly + h * 0.25);
            ctx.lineTo(baseX + 15 + lw, ly + h * 0.25);
            ctx.closePath();
            ctx.fill();
          }
        } else if (environment === 2) {
          // Cave: stalactites from ceiling + stalagmites from floor
          ctx.fillStyle = '#2a1a14';
          ctx.beginPath();
          ctx.moveTo(baseX, 0);
          ctx.lineTo(baseX + 12, h * 0.6);
          ctx.lineTo(baseX + 24, 0);
          ctx.fill();
          // Stalagmites from floor
          if (i % 2 === 0) {
            ctx.fillStyle = '#2a1a14';
            const sh = h * 0.35;
            ctx.beginPath();
            ctx.moveTo(baseX + 50, GROUND_Y);
            ctx.lineTo(baseX + 58, GROUND_Y - sh);
            ctx.lineTo(baseX + 66, GROUND_Y);
            ctx.fill();
          }
          // Glowing crystals
          if (i % 3 === 0) {
            ctx.fillStyle = '#06b6d420';
            ctx.beginPath();
            ctx.moveTo(baseX + 35, GROUND_Y - 15);
            ctx.lineTo(baseX + 38, GROUND_Y - 35);
            ctx.lineTo(baseX + 41, GROUND_Y - 15);
            ctx.fill();
          }
        } else {
          // Sky: floating islands + clouds
          ctx.fillStyle = '#1a1a3a';
          ctx.beginPath();
          ctx.arc(baseX + 20, 60 + (i * 23 % 50), 20 + (i * 7 % 15), 0, Math.PI * 2);
          ctx.arc(baseX + 40, 55 + (i * 23 % 50), 25 + (i * 11 % 10), 0, Math.PI * 2);
          ctx.fill();
          // Floating islands
          if (i % 3 === 0) {
            const iy = GROUND_Y - 120 - (i * 31 % 80);
            ctx.fillStyle = '#1a2a1a';
            ctx.beginPath();
            ctx.ellipse(baseX + 30, iy, 25, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            // Tiny tree on island
            ctx.fillStyle = '#1a3a1a';
            ctx.fillRect(baseX + 28, iy - 15, 4, 12);
            ctx.beginPath();
            ctx.arc(baseX + 30, iy - 18, 7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawObstacle(obs: Obstacle) {
      ctx.save();
      switch (obs.type) {
        case 'wall':
        case 'high-wall':
          ctx.fillStyle = '#3a3a5a';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#5a5a7a';
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#4a4a6a';
          for (let row = 0; row < obs.h; row += 12) {
            ctx.beginPath();
            ctx.moveTo(obs.x, obs.y + row);
            ctx.lineTo(obs.x + obs.w, obs.y + row);
            ctx.stroke();
          }
          break;

        case 'pit':
          ctx.fillStyle = '#050510';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.fillStyle = RED;
          ctx.globalAlpha = 0.5 + Math.sin(renderTime * 4) * 0.2;
          ctx.fillRect(obs.x, obs.y, 4, 18);
          ctx.fillRect(obs.x + obs.w - 4, obs.y, 4, 18);
          // Danger hash marks
          for (let hx = obs.x + 8; hx < obs.x + obs.w - 8; hx += 16) {
            ctx.fillRect(hx, obs.y, 2, 6);
          }
          ctx.globalAlpha = 1;
          break;

        case 'low-barrier':
          ctx.fillStyle = '#4a4a2a';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#6a6a3a';
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
          // Cross-hatch
          ctx.globalAlpha = 0.3;
          for (let hx = 0; hx < obs.w; hx += 8) {
            ctx.beginPath();
            ctx.moveTo(obs.x + hx, obs.y);
            ctx.lineTo(obs.x + hx + obs.h, obs.y + obs.h);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;

        case 'floating-platform':
          ctx.fillStyle = '#2a4a4a';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#3a6a6a';
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 8;
          ctx.fillStyle = '#06b6d430';
          ctx.fillRect(obs.x + 2, obs.y + obs.h, obs.w - 4, 3);
          ctx.shadowBlur = 0;
          break;

        case 'breakable':
          ctx.fillStyle = '#5a3a2a';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          ctx.strokeStyle = '#8a6a4a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.w * 0.3, obs.y);
          ctx.lineTo(obs.x + obs.w * 0.5, obs.y + obs.h * 0.4);
          ctx.lineTo(obs.x + obs.w * 0.7, obs.y + obs.h);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(obs.x, obs.y + obs.h * 0.6);
          ctx.lineTo(obs.x + obs.w * 0.4, obs.y + obs.h * 0.5);
          ctx.stroke();
          // Glow indicating breakability
          ctx.fillStyle = '#ff880020';
          ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
          break;

        case 'spike-floor': {
          ctx.fillStyle = '#aa2244';
          const sw = 10;
          for (let sx = obs.x; sx < obs.x + obs.w; sx += sw) {
            ctx.beginPath();
            ctx.moveTo(sx, obs.y + obs.h);
            ctx.lineTo(sx + sw / 2, obs.y);
            ctx.lineTo(sx + sw, obs.y + obs.h);
            ctx.fill();
          }
          // Danger glow
          ctx.fillStyle = '#ff224420';
          ctx.fillRect(obs.x, obs.y - 5, obs.w, obs.h + 5);
          break;
        }

        case 'tunnel':
          ctx.fillStyle = '#3a3a5a';
          ctx.fillRect(obs.x, obs.y - 35, obs.w, 35);
          ctx.fillRect(obs.x, obs.y + obs.h, obs.w, 35);
          ctx.strokeStyle = '#5a5a7a';
          ctx.lineWidth = 1;
          ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
          // Directional arrows inside tunnel
          ctx.fillStyle = '#06b6d420';
          ctx.font = '14px monospace';
          ctx.textAlign = 'center';
          for (let ax = obs.x + 25; ax < obs.x + obs.w; ax += 40) {
            ctx.fillText('>', ax, obs.y + obs.h / 2 + 5);
          }
          break;
      }
      ctx.restore();
    }

    function drawObstacleHints() {
      // Show form hint icons for upcoming obstacles
      for (const obs of obstacles) {
        if (obs.broken || obs.scored || obs.hinted) continue;
        if (obs.type === 'floating-platform') continue;
        const dist = obs.x - px;
        if (dist < 50 || dist > 250) continue;

        obs.hinted = true;
        const solutions = OBSTACLE_SOLUTIONS[obs.type];
        if (solutions.includes(form)) continue; // already in right form

        // Show hint icon above obstacle
        const hintY = Math.min(obs.y - 20, GROUND_Y - 100);
        const hintX = obs.x + obs.w / 2;
        const bestForm = solutions[0];
        const hintColor = FORM_COLORS[bestForm].main;

        ctx.globalAlpha = 0.6 + Math.sin(renderTime * 5) * 0.2;
        ctx.fillStyle = hintColor;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';

        const formKey: Record<FormType, string> = { runner: 'W', ball: 'A', glider: 'S', spike: 'D' };
        ctx.fillText(formKey[bestForm], hintX, hintY);

        // Small form shape indicator
        ctx.beginPath();
        switch (bestForm) {
          case 'runner': ctx.arc(hintX, hintY - 14, 5, 0, Math.PI * 2); break;
          case 'ball': ctx.arc(hintX, hintY - 14, 5, 0, Math.PI * 2); break;
          case 'glider':
            ctx.moveTo(hintX + 6, hintY - 14);
            ctx.lineTo(hintX - 6, hintY - 18);
            ctx.lineTo(hintX - 3, hintY - 14);
            ctx.lineTo(hintX - 6, hintY - 10);
            ctx.closePath();
            break;
          case 'spike':
            ctx.moveTo(hintX, hintY - 8);
            ctx.lineTo(hintX - 5, hintY - 18);
            ctx.lineTo(hintX + 5, hintY - 18);
            ctx.closePath();
            break;
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    function drawCollectible(c: Collectible) {
      const bob = Math.sin(renderTime * 3 + c.x * 0.01) * 4;
      const cy = c.y + bob;

      if (c.type === 'gem') {
        ctx.fillStyle = GOLD;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(c.x, cy - 8);
        ctx.lineTo(c.x + 6, cy);
        ctx.lineTo(c.x, cy + 8);
        ctx.lineTo(c.x - 6, cy);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        const a = renderTime * 2;
        ctx.save();
        ctx.translate(c.x, cy);
        ctx.rotate(a);
        ctx.fillStyle = FORM_COLORS[form].main;
        ctx.shadowColor = FORM_COLORS[form].glow;
        ctx.shadowBlur = 10;
        ctx.fillRect(-6, -6, 12, 12);
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    function drawPlayer() {
      const r = getFormRadius();
      const colors = FORM_COLORS[form];

      // Invuln flash
      if (invulnTimer > 0 && Math.sin(invulnTimer * 20) > 0) ctx.globalAlpha = 0.4;

      // Morph ring
      if (morphTimer > 0) {
        const progress = 1 - morphTimer / MORPH_DURATION;
        ctx.globalAlpha *= (0.5 + progress * 0.5);
        ctx.strokeStyle = colors.glow;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, r + 15 * (1 - progress), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = colors.main;
      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = 12;

      switch (form) {
        case 'runner':
          if (isSliding) {
            // Sliding pose — flat oval
            ctx.beginPath();
            ctx.ellipse(px, py + 5, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            // Slide sparks
            if (Math.random() < 0.3) {
              spawnDust(px + r, GROUND_Y, 1);
            }
          } else {
            // Body
            ctx.beginPath();
            ctx.arc(px, py - r * 0.3, r * 0.65, 0, Math.PI * 2);
            ctx.fill();
            // Head
            ctx.beginPath();
            ctx.arc(px + 2, py - r * 1.05, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
            // Arms
            ctx.strokeStyle = colors.main;
            ctx.lineWidth = 2.5;
            const armPhase = renderTime * (scrollSpeed * 0.03);
            ctx.beginPath();
            ctx.moveTo(px, py - r * 0.2);
            ctx.lineTo(px + Math.sin(armPhase + Math.PI) * 7, py + r * 0.1);
            ctx.stroke();
            // Legs (speed-matched)
            ctx.lineWidth = 3;
            const legPhase = renderTime * (scrollSpeed * 0.035);
            ctx.beginPath();
            ctx.moveTo(px, py + r * 0.1);
            ctx.lineTo(px + Math.sin(legPhase) * 9, py + r * 0.65);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px, py + r * 0.1);
            ctx.lineTo(px + Math.sin(legPhase + Math.PI) * 9, py + r * 0.65);
            ctx.stroke();
          }
          // Double-jump indicator
          if (doubleJumpUnlocked && !onGround && !hasDoubleJumped) {
            ctx.strokeStyle = colors.glow;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(px, py, r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
          }
          break;

        case 'ball':
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
          // Cross lines for rotation
          ctx.strokeStyle = colors.glow;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(ballAngle) * r * 0.8, py + Math.sin(ballAngle) * r * 0.8);
          ctx.lineTo(px - Math.cos(ballAngle) * r * 0.8, py - Math.sin(ballAngle) * r * 0.8);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(px + Math.cos(ballAngle + Math.PI / 2) * r * 0.5, py + Math.sin(ballAngle + Math.PI / 2) * r * 0.5);
          ctx.lineTo(px - Math.cos(ballAngle + Math.PI / 2) * r * 0.5, py - Math.sin(ballAngle + Math.PI / 2) * r * 0.5);
          ctx.stroke();
          if (ballBounceCount > 0) {
            ctx.strokeStyle = colors.glow;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, r + 4 + ballBounceCount * 3, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          break;

        case 'glider': {
          // Wing with tilt based on vy
          const tilt = clamp(vy * 0.002, -0.3, 0.3);
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(tilt);
          ctx.beginPath();
          ctx.moveTo(r, 0);
          ctx.lineTo(-r, -r * 0.75);
          ctx.lineTo(-r * 0.3, 0);
          ctx.lineTo(-r, r * 0.75);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          // Wind trail
          ctx.strokeStyle = colors.trail;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.35;
          for (let i = 0; i < 3; i++) {
            const ly = py - 6 + i * 6;
            const waveOff = Math.sin(renderTime * 4 + i) * 3;
            ctx.beginPath();
            ctx.moveTo(px - r - 3 - i * 6, ly + waveOff);
            ctx.lineTo(px - r - 18 - i * 8, ly + waveOff);
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          // Lift indicator
          if (glideHoldingUp && !onGround) {
            ctx.strokeStyle = colors.glow;
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(px - 4, py - r - 6);
            ctx.lineTo(px, py - r - 12);
            ctx.lineTo(px + 4, py - r - 6);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          break;
        }

        case 'spike':
          // Rotating drill
          ctx.save();
          ctx.translate(px, py);
          if (spikeSmashing) ctx.rotate(spikeAngle);
          ctx.beginPath();
          ctx.moveTo(0, r * 1.2);
          ctx.lineTo(-r, -r * 0.5);
          ctx.lineTo(-r * 0.3, -r * 0.8);
          ctx.lineTo(r * 0.3, -r * 0.8);
          ctx.lineTo(r, -r * 0.5);
          ctx.closePath();
          ctx.fill();
          // Drill grooves
          if (spikeSmashing) {
            ctx.strokeStyle = colors.glow;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(-r * 0.6, -r * 0.2);
            ctx.lineTo(0, r * 0.8);
            ctx.lineTo(r * 0.6, -r * 0.2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          ctx.restore();
          // Impact ring
          if (spikeGroundHitTimer > 0) {
            const impactAlpha = spikeGroundHitTimer / 0.35;
            ctx.strokeStyle = colors.glow;
            ctx.lineWidth = 3;
            ctx.globalAlpha = impactAlpha * 0.6;
            const impactR = (1 - impactAlpha) * 70;
            ctx.beginPath();
            ctx.arc(px, GROUND_Y, impactR, Math.PI, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
          break;
      }

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    function drawHUD() {
      // Score with glow when multiplier active
      const mult = getComboMultiplier(combo);
      if (mult > 1) {
        ctx.shadowColor = getComboColor(combo);
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.floor(score)}`, 20, 35);
      ctx.shadowBlur = 0;

      ctx.fillStyle = DIM;
      ctx.font = '11px monospace';
      ctx.fillText(`HI: ${Math.floor(highScore)}`, 20, 52);

      // Distance & speed
      ctx.textAlign = 'right';
      ctx.fillStyle = DIM;
      ctx.font = '12px monospace';
      ctx.fillText(`${Math.floor(distanceTraveled)}m`, W - 20, 35);
      const speedPct = ((scrollSpeed - SCROLL_SPEED_BASE) / (MAX_SCROLL - SCROLL_SPEED_BASE) * 100);
      if (speedPct > 5) {
        ctx.fillStyle = speedPct > 60 ? RED : speedPct > 30 ? GOLD : DIM;
        ctx.fillText(`${speedPct.toFixed(0)}% speed`, W - 20, 52);
      }

      // Lives
      ctx.textAlign = 'left';
      for (let i = 0; i < maxLives; i++) {
        ctx.fillStyle = i < lives ? RED : '#333';
        ctx.beginPath();
        const hx = 20 + i * 22;
        const hy = 65;
        ctx.moveTo(hx, hy + 3);
        ctx.bezierCurveTo(hx, hy, hx - 5, hy - 4, hx - 8, hy);
        ctx.bezierCurveTo(hx - 12, hy + 5, hx, hy + 12, hx, hy + 14);
        ctx.bezierCurveTo(hx, hy + 12, hx + 12, hy + 5, hx + 8, hy);
        ctx.bezierCurveTo(hx + 5, hy - 4, hx, hy, hx, hy + 3);
        ctx.fill();
      }

      // Shield
      if (shieldCharges > 0) {
        ctx.fillStyle = '#66ffff';
        ctx.font = '11px monospace';
        ctx.fillText(`Shield x${shieldCharges}`, 20 + maxLives * 22 + 10, 75);
      }

      // Combo display
      if (combo > 0 && comboTimer > 0) {
        const comboAlpha = Math.min(1, comboTimer);
        ctx.globalAlpha = comboAlpha;
        const cc = getComboColor(combo);
        const mult = getComboMultiplier(combo);
        ctx.fillStyle = cc;
        const comboSize = Math.min(14 + combo * 2, 32);
        ctx.font = `bold ${comboSize}px monospace`;
        ctx.textAlign = 'center';
        if (combo >= 5) {
          ctx.shadowColor = cc;
          ctx.shadowBlur = 15;
        }
        ctx.fillText(`MORPH x${combo}`, W / 2, 35);
        ctx.shadowBlur = 0;

        // Multiplier badge
        if (mult > 1) {
          ctx.fillStyle = cc;
          ctx.font = 'bold 11px monospace';
          ctx.fillText(`${mult}x SCORE`, W / 2, 50);
        }

        // Combo timer bar
        const barW = 140;
        const barX = W / 2 - barW / 2;
        ctx.fillStyle = '#222';
        ctx.fillRect(barX, 56, barW, 4);
        ctx.fillStyle = cc;
        const barProg = comboTimer / (COMBO_WINDOW + comboWindowBonus);
        ctx.fillRect(barX, 56, barW * barProg, 4);
        // Bar glow when high combo
        if (combo >= 5) {
          ctx.shadowColor = cc;
          ctx.shadowBlur = 8;
          ctx.fillRect(barX, 56, barW * barProg, 4);
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
      }

      // Form indicator (right side) with glow
      ctx.textAlign = 'right';
      ctx.fillStyle = FORM_COLORS[form].main;
      ctx.shadowColor = FORM_COLORS[form].glow;
      ctx.shadowBlur = 8;
      ctx.font = 'bold 13px monospace';
      const formLabels: Record<FormType, string> = { runner: 'RUNNER', ball: 'BALL', glider: 'GLIDER', spike: 'SPIKE' };
      ctx.fillText(formLabels[form], W - 20, 75);
      ctx.shadowBlur = 0;

      // Obstacle streak
      if (obstacleStreak >= 3) {
        ctx.fillStyle = obstacleStreak >= 10 ? GOLD : DIM;
        ctx.font = '10px monospace';
        ctx.fillText(`streak: ${obstacleStreak}`, W - 20, 88);
      }

      // Bottom form bar with icons
      const forms: FormType[] = ['runner', 'ball', 'glider', 'spike'];
      const keys = ['W', 'A', 'S', 'D'];
      for (let i = 0; i < 4; i++) {
        const fx = W / 2 - 130 + i * 88;
        const fy = H - 18;
        const isActive = forms[i] === form;
        const fc = FORM_COLORS[forms[i]];

        // Background pill
        ctx.globalAlpha = isActive ? 0.8 : 0.25;
        ctx.fillStyle = isActive ? fc.main + '30' : '#ffffff10';
        ctx.beginPath();
        ctx.roundRect(fx - 32, fy - 12, 64, 22, 6);
        ctx.fill();

        // Border for active
        if (isActive) {
          ctx.strokeStyle = fc.main;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(fx - 32, fy - 12, 64, 22, 6);
          ctx.stroke();
        }

        ctx.globalAlpha = isActive ? 1 : 0.5;
        ctx.fillStyle = isActive ? fc.main : DIM;
        ctx.font = `${isActive ? 'bold ' : ''}10px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`[${keys[i]}] ${formLabels[forms[i]]}`, fx, fy + 3);
      }
      ctx.globalAlpha = 1;
    }

    function drawPauseScreen() {
      ctx.fillStyle = '#000000aa';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', W / 2, H / 2 - 20);
      ctx.fillStyle = DIM;
      ctx.font = '14px monospace';
      ctx.fillText('Press P or ESC to resume', W / 2, H / 2 + 20);
    }

    function drawMenu() {
      // Title
      const pulse = 1 + Math.sin(menuTime * 2) * 0.03;
      ctx.save();
      ctx.translate(W / 2, H * 0.28);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 56px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 25;
      ctx.fillText('MORPH', 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.fillStyle = DIM;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Shape-Shift. Smash. Survive.', W / 2, H * 0.28 + 38);

      // Demo forms — show actual shapes
      const demoForms: FormType[] = ['runner', 'ball', 'glider', 'spike'];
      const demoLabels = ['RUN', 'SMASH', 'FLY', 'DRILL'];
      const demoKeys = ['W', 'A', 'S', 'D'];
      const activeDemo = Math.floor(menuTime * 0.7) % 4;

      for (let i = 0; i < 4; i++) {
        const fx = W / 2 - 150 + i * 100;
        const fy = H * 0.5;
        const isActive = i === activeDemo;
        const fc = FORM_COLORS[demoForms[i]];

        ctx.globalAlpha = isActive ? 1 : 0.35;
        ctx.fillStyle = fc.main;
        ctx.shadowColor = isActive ? fc.glow : 'transparent';
        ctx.shadowBlur = isActive ? 15 : 0;

        const sz = isActive ? 16 : 11;
        switch (demoForms[i]) {
          case 'runner':
            ctx.beginPath();
            ctx.arc(fx, fy - sz * 0.3, sz * 0.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(fx, fy - sz * 1.0, sz * 0.32, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'ball':
            ctx.beginPath();
            ctx.arc(fx, fy, sz, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'glider':
            ctx.beginPath();
            ctx.moveTo(fx + sz, fy);
            ctx.lineTo(fx - sz, fy - sz * 0.7);
            ctx.lineTo(fx - sz * 0.3, fy);
            ctx.lineTo(fx - sz, fy + sz * 0.7);
            ctx.closePath();
            ctx.fill();
            break;
          case 'spike':
            ctx.beginPath();
            ctx.moveTo(fx, fy + sz * 1.1);
            ctx.lineTo(fx - sz * 0.8, fy - sz * 0.4);
            ctx.lineTo(fx, fy - sz * 0.7);
            ctx.lineTo(fx + sz * 0.8, fy - sz * 0.4);
            ctx.closePath();
            ctx.fill();
            break;
        }
        ctx.shadowBlur = 0;

        ctx.fillStyle = isActive ? fc.main : DIM;
        ctx.font = isActive ? 'bold 12px monospace' : '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(demoLabels[i], fx, fy + (isActive ? 32 : 26));
        ctx.fillStyle = DIM;
        ctx.font = '10px monospace';
        ctx.fillText(`[${demoKeys[i]}]`, fx, fy + (isActive ? 46 : 38));
      }
      ctx.globalAlpha = 1;

      // Controls
      ctx.fillStyle = DIM;
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE = Jump   DOWN = Slide (Runner)   P = Pause', W / 2, H * 0.72);
      ctx.fillText('Hold SPACE as Glider for lift | Mouse: L-click Jump, R-click Morph, Scroll cycle', W / 2, H * 0.72 + 16);

      // Start
      ctx.fillStyle = WHITE;
      ctx.globalAlpha = 0.6 + Math.sin(menuTime * 3) * 0.4;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('Click or ENTER to start', W / 2, H * 0.86);
      ctx.globalAlpha = 1;

      if (highScore > 0) {
        ctx.fillStyle = GOLD;
        ctx.font = '12px monospace';
        ctx.fillText(`Best: ${Math.floor(highScore)}`, W / 2, H * 0.93);
      }
    }

    function drawGameOver() {
      ctx.fillStyle = '#000000dd';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = RED;
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = RED;
      ctx.shadowBlur = 20;
      ctx.fillText('GAME OVER', W / 2, H * 0.18);
      ctx.shadowBlur = 0;

      if (score >= highScore && score > 0) {
        ctx.fillStyle = GOLD;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 15;
        ctx.font = 'bold 18px monospace';
        ctx.fillText('NEW HIGH SCORE!', W / 2, H * 0.25);
        ctx.shadowBlur = 0;
      }

      // Two-column stats
      const leftStats = [
        { label: 'Score', value: Math.floor(score).toString(), color: WHITE },
        { label: 'Distance', value: `${Math.floor(distanceTraveled)}m`, color: DIM },
        { label: 'Best Combo', value: `x${bestCombo}`, color: getComboColor(bestCombo) },
        { label: 'High Score', value: Math.floor(highScore).toString(), color: score >= highScore ? GOLD : DIM },
      ];
      const rightStats = [
        { label: 'Morphs', value: totalMorphs.toString(), color: FORM_COLORS.runner.main },
        { label: 'Destroyed', value: obstaclesDestroyed.toString(), color: FORM_COLORS.ball.main },
        { label: 'Gems', value: gemsCollected.toString(), color: GOLD },
        { label: 'Near Misses', value: nearMissTotal.toString(), color: '#ff88ff' },
      ];

      const colLeftX = W / 2 - 140;
      const colRightX = W / 2 + 60;
      let sy = H * 0.34;

      for (let i = 0; i < leftStats.length; i++) {
        const ls = leftStats[i];
        const rs = rightStats[i];

        // Left column
        ctx.fillStyle = DIM;
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(ls.label, colLeftX, sy);
        ctx.fillStyle = ls.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(ls.value, colLeftX + 10, sy);

        // Right column
        ctx.fillStyle = DIM;
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(rs.label, colRightX, sy);
        ctx.fillStyle = rs.color;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(rs.value, colRightX + 10, sy);

        sy += 26;
      }

      // Best streak & perfect morphs
      sy += 8;
      ctx.textAlign = 'center';
      if (bestStreak >= 5) {
        ctx.fillStyle = GOLD;
        ctx.font = '12px monospace';
        ctx.fillText(`Best Streak: ${bestStreak} obstacles`, W / 2, sy);
        sy += 20;
      }
      if (perfectMorphs > 0) {
        ctx.fillStyle = '#22ff88';
        ctx.font = '12px monospace';
        ctx.fillText(`Perfect Morphs: ${perfectMorphs}`, W / 2, sy);
        sy += 20;
      }

      // Biome reached
      ctx.fillStyle = DIM;
      ctx.font = '11px monospace';
      ctx.fillText(`Furthest Biome: ${BIOME_NAMES[environment]}`, W / 2, sy + 5);

      // Retry
      ctx.fillStyle = WHITE;
      ctx.globalAlpha = 0.6 + Math.sin(renderTime * 3) * 0.4;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Click or ENTER to retry', W / 2, H * 0.85);
      ctx.globalAlpha = 1;
    }

    // -------------------------------------------------------------------
    // Game loop
    // -------------------------------------------------------------------

    function loop(timestamp: number) {
      if (destroyed) return;
      if (lastTime === 0) lastTime = timestamp;
      const dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      update(dt);
      draw();
      animId = requestAnimationFrame(loop);
    }

    // -------------------------------------------------------------------
    // Input
    // -------------------------------------------------------------------

    let keysDown = new Set<string>();

    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      keysDown.add(e.key.toLowerCase());

      if (state === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); return; }
      }
      if (state === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startGame(); return; }
      }
      if (state !== 'playing') return;

      e.preventDefault();

      // Morph keys
      if (e.key === 'w' || e.key === 'W' || e.key === '1') morphTo('runner');
      if (e.key === 'a' || e.key === 'A' || e.key === '2') morphTo('ball');
      if (e.key === 's' || e.key === 'S' || e.key === '3') morphTo('glider');
      if (e.key === 'd' || e.key === 'D' || e.key === '4') morphTo('spike');

      // Jump
      if (e.key === ' ' || e.key === 'ArrowUp') {
        if (form === 'glider') {
          glideHoldingUp = true;
        }
        if (onGround && form !== 'spike') {
          vy = -getFormJump();
          onGround = false;
          hasDoubleJumped = false;
          SoundEngine.play('launch');
          spawnDust(px, GROUND_Y, 4);
        } else if (!onGround && form === 'runner' && doubleJumpUnlocked && !hasDoubleJumped) {
          vy = -getFormJump() * 0.8;
          hasDoubleJumped = true;
          SoundEngine.play('launch');
          spawnParticles(px, py + getFormRadius(), FORM_COLORS.runner.trail, 6, 2);
        }
      }

      // Slide (runner only)
      if ((e.key === 'ArrowDown' || e.key === 'Control') && form === 'runner' && onGround && !isSliding) {
        isSliding = true;
        slideTimer = SLIDE_DURATION;
        SoundEngine.play('dig');
      }

      // Pause
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        paused = !paused;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      keysDown.delete(e.key.toLowerCase());
      if (e.key === ' ' || e.key === 'ArrowUp') {
        glideHoldingUp = false;
      }
    }

    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;

      if (state === 'menu') { startGame(); return; }
      if (state === 'gameover') { startGame(); return; }

      // Mouse gameplay: left half = jump/glide, right half = cycle morph
      if (state === 'playing' && !paused) {
        const rect = canvas!.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        if (mx < 0.5) {
          // Jump / glider lift (same as touch left half)
          if (form === 'glider') {
            glideHoldingUp = true;
          }
          if (onGround && form !== 'spike') {
            vy = -getFormJump();
            onGround = false;
            hasDoubleJumped = false;
            SoundEngine.play('launch');
            spawnDust(px, GROUND_Y, 4);
          } else if (!onGround && form === 'runner' && doubleJumpUnlocked && !hasDoubleJumped) {
            vy = -getFormJump() * 0.8;
            hasDoubleJumped = true;
            SoundEngine.play('launch');
            spawnParticles(px, py + getFormRadius(), FORM_COLORS.runner.trail, 6, 2);
          }
        } else {
          // Cycle morph (same as touch right half)
          const forms: FormType[] = ['runner', 'ball', 'glider', 'spike'];
          const idx = forms.indexOf(form);
          morphTo(forms[(idx + 1) % 4]);
        }
      }
    }

    function onMouseUp(e: MouseEvent) {
      if (e.button !== 0) return;
      // Release glider lift on mouse up (mirrors keyup behavior)
      glideHoldingUp = false;
    }

    function onWheel(e: WheelEvent) {
      if (state !== 'playing' || paused) return;
      e.preventDefault();
      const forms: FormType[] = ['runner', 'ball', 'glider', 'spike'];
      const idx = forms.indexOf(form);
      if (e.deltaY > 0) {
        morphTo(forms[(idx + 1) % 4]);
      } else {
        morphTo(forms[(idx + 3) % 4]);
      }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (state === 'menu') { startGame(); return; }
      if (state === 'gameover') { startGame(); return; }

      if (state === 'playing' && !paused) {
        const rect = canvas!.getBoundingClientRect();
        const tx = (e.touches[0].clientX - rect.left) / rect.width;
        if (tx < 0.5) {
          if (onGround && form !== 'spike') {
            vy = -getFormJump();
            onGround = false;
            SoundEngine.play('launch');
          }
        } else {
          const forms: FormType[] = ['runner', 'ball', 'glider', 'spike'];
          const idx = forms.indexOf(form);
          morphTo(forms[(idx + 1) % 4]);
        }
      }
    }

    // -------------------------------------------------------------------
    // Bind & start
    // -------------------------------------------------------------------

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });

    highScore = getHighScore('morph');
    lastTime = 0;
    animId = requestAnimationFrame(loop);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('touchstart', onTouchStart);
      SoundEngine.stopAmbient();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ display: 'block', width: '100%', maxWidth: W, aspectRatio: `${W}/${H}` }}
    />
  );
}
