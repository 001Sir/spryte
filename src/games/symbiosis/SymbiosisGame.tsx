'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_W = 800;
const CANVAS_H = 600;

const BG = '#0a0a0f';
const FUCHSIA = '#d946ef';
const MAGENTA = '#f0abfc';
const _CYAN = '#06d6a0';
const RESOURCE_CYAN = '#22d3ee';

const HOST_RADIUS = 24;
const HOST_MAX_HP = 100;
const HOST_SPEED = 2.2;
const HOST_CONTACT_DAMAGE = 15;

const PARASITE_RADIUS = 10;
const PARASITE_MAX_HP = 50;
const PARASITE_LERP = 0.08;
const PARASITE_DETACH_DRAIN = 2; // HP per second

const TETHER_MAX_LENGTH = 220;
const TETHER_DAMAGE = 25;
const TETHER_DAMAGE_COOLDOWN = 400; // ms between tether hits on same enemy
const TETHER_KILL_MULTIPLIER = 3;

const RESOURCE_RADIUS = 6;
const RESOURCE_HEAL = 8;
const RESOURCE_SCORE = 50;
const RESOURCE_LIFETIME = 10000; // ms

const WAVE_PAUSE = 3000; // ms between waves

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GameState = 'Menu' | 'Playing' | 'GameOver';

interface Vec2 {
  x: number;
  y: number;
}

interface Host {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  invulnTimer: number;
}

interface Parasite {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  radius: number;
  linked: boolean;
  trail: Vec2[];
  invulnTimer: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  type: 'small' | 'medium' | 'large';
  color: string;
  colorDark: string;
  wobblePhase: number;
  wobbleSpeed: number;
  lastTetherHit: number;
  scoreValue: number;
}

interface Resource {
  x: number;
  y: number;
  spawnTime: number;
  sparklePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

interface TetherParticle {
  t: number; // 0..1 position along tether
  speed: number;
}

interface WaveConfig {
  small: number;
  medium: number;
  large: number;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist({ x: px, y: py }, { x: ax, y: ay });
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return dist({ x: px, y: py }, { x: projX, y: projY });
}

/** Sample a point on a quadratic bezier: P = (1-t)^2 * A + 2(1-t)t * C + t^2 * B */
function quadBezier(ax: number, ay: number, cx: number, cy: number, bx: number, by: number, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * ax + 2 * u * t * cx + t * t * bx,
    y: u * u * ay + 2 * u * t * cy + t * t * by,
  };
}

/**
 * Approximate minimum distance from point (px,py) to a quadratic bezier curve
 * by subdividing the curve into `segments` straight-line segments and checking
 * distance to each one.
 */
function pointToBezierDist(
  px: number, py: number,
  ax: number, ay: number,
  cx: number, cy: number,
  bx: number, by: number,
  segments = 10,
): number {
  let minDist = Infinity;
  let prevPt = quadBezier(ax, ay, cx, cy, bx, by, 0);
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const pt = quadBezier(ax, ay, cx, cy, bx, by, t);
    const d = pointToSegmentDist(px, py, prevPt.x, prevPt.y, pt.x, pt.y);
    if (d < minDist) minDist = d;
    prevPt = pt;
  }
  return minDist;
}

function randRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function spawnEdgePosition(): Vec2 {
  const side = Math.floor(Math.random() * 4);
  const margin = 40;
  switch (side) {
    case 0: return { x: randRange(0, CANVAS_W), y: -margin };
    case 1: return { x: CANVAS_W + margin, y: randRange(0, CANVAS_H) };
    case 2: return { x: randRange(0, CANVAS_W), y: CANVAS_H + margin };
    default: return { x: -margin, y: randRange(0, CANVAS_H) };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SymbiosisGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // -- Input state --
    const keys: Record<string, boolean> = {};
    let mouseX = CANVAS_W / 2;
    let mouseY = CANVAS_H / 2;
    let mouseClicked = false;
    let touchActive = false;
    let lastTapTime = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === ' ') e.preventDefault();
      // Toggle pause only during Playing state
      if (state === 'Playing' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        paused = !paused;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = false;
    };
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
      mouseY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    };
    const onMouseDown = () => {
      mouseClicked = true;
    };

    // -- Touch handlers --
    function getTouchCanvasPos(touch: Touch): { tx: number; ty: number } {
      const rect = canvas!.getBoundingClientRect();
      return {
        tx: ((touch.clientX - rect.left) / rect.width) * CANVAS_W,
        ty: ((touch.clientY - rect.top) / rect.height) * CANVAS_H,
      };
    }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.changedTouches[0];
      if (!touch) return;
      const { tx, ty } = getTouchCanvasPos(touch);

      if (state === 'Menu' || state === 'GameOver') {
        mouseClicked = true;
        return;
      }

      // Double-tap detection for tether toggle (Playing state)
      const now = performance.now();
      if (now - lastTapTime < 300) {
        // Double-tap: toggle tether
        if (state === 'Playing') {
          parasite.linked = !parasite.linked;
          if (!parasite.linked) SoundEngine.play('tetherUnlink');
          if (parasite.linked) {
            spawnParticles(parasite.x, parasite.y, FUCHSIA, 6);
            SoundEngine.play('tetherLink');
          }
        }
        lastTapTime = 0; // reset so triple-tap doesn't re-toggle
      } else {
        lastTapTime = now;
      }

      touchActive = true;
      mouseX = tx;
      mouseY = ty;
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchActive) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const { tx, ty } = getTouchCanvasPos(touch);
      mouseX = tx;
      mouseY = ty;
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchActive = false;
    };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // -- Game state --
    let state: GameState = 'Menu';
    let host: Host;
    let parasite: Parasite;
    let enemies: Enemy[] = [];
    let resources: Resource[] = [];
    let particles: Particle[] = [];
    let tetherParticles: TetherParticle[] = [];

    let score = 0;
    let wave = 0;
    let waveEnemiesRemaining = 0;
    let waveSpawnQueue: Enemy[] = [];
    let waveSpawnTimer = 0;
    let wavePauseTimer = 0;
    let waveActive = false;
    let tetherKills = 0;
    let totalKills = 0;
    let maxWaveReached = 0;

    let lastTime = 0;
    let animTime = 0;
    let running = true;

    // pause
    let paused = false;

    // space key debounce
    let spaceWasDown = false;

    function initGame() {
      paused = false;
      host = {
        x: CANVAS_W / 2 - 60,
        y: CANVAS_H / 2,
        hp: HOST_MAX_HP,
        maxHp: HOST_MAX_HP,
        radius: HOST_RADIUS,
        invulnTimer: 0,
      };
      parasite = {
        x: CANVAS_W / 2 + 60,
        y: CANVAS_H / 2,
        hp: PARASITE_MAX_HP,
        maxHp: PARASITE_MAX_HP,
        radius: PARASITE_RADIUS,
        linked: true,
        trail: [],
        invulnTimer: 0,
      };
      enemies = [];
      resources = [];
      particles = [];
      tetherParticles = [];
      score = 0;
      wave = 0;
      waveEnemiesRemaining = 0;
      waveSpawnQueue = [];
      waveSpawnTimer = 0;
      wavePauseTimer = 0;
      waveActive = false;
      tetherKills = 0;
      totalKills = 0;
      maxWaveReached = 0;
      spaceWasDown = false;
      startNextWave();
    }

    function getWaveConfig(w: number): WaveConfig {
      if (w === 1) return { small: 5, medium: 0, large: 0 };
      if (w === 2) return { small: 6, medium: 1, large: 0 };
      if (w === 3) return { small: 5, medium: 3, large: 0 };
      if (w === 4) return { small: 6, medium: 3, large: 1 };
      if (w === 5) return { small: 8, medium: 4, large: 1 };
      // endless scaling
      const s = Math.min(5 + w, 25);
      const m = Math.min(2 + Math.floor(w * 0.8), 12);
      const l = Math.min(Math.floor((w - 3) * 0.6), 6);
      return { small: s, medium: m, large: Math.max(0, l) };
    }

    function createEnemy(type: 'small' | 'medium' | 'large'): Enemy {
      const pos = spawnEdgePosition();
      const base = {
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        wobblePhase: Math.random() * Math.PI * 2,
        wobbleSpeed: randRange(2, 5),
        lastTetherHit: 0,
      };
      switch (type) {
        case 'small':
          return {
            ...base,
            hp: 20,
            maxHp: 20,
            radius: 10,
            speed: 2.0 + wave * 0.05,
            damage: 5,
            type: 'small',
            color: '#4ade80',
            colorDark: '#166534',
            scoreValue: 100,
          };
        case 'medium':
          return {
            ...base,
            hp: 50,
            maxHp: 50,
            radius: 18,
            speed: 1.4 + wave * 0.03,
            damage: 10,
            type: 'medium',
            color: '#facc15',
            colorDark: '#854d0e',
            scoreValue: 200,
          };
        case 'large':
          return {
            ...base,
            hp: 120,
            maxHp: 120,
            radius: 28,
            speed: 0.7 + wave * 0.02,
            damage: 20,
            type: 'large',
            color: '#f87171',
            colorDark: '#991b1b',
            scoreValue: 400,
          };
      }
    }

    function startNextWave() {
      wave++;
      maxWaveReached = wave;
      const config = getWaveConfig(wave);
      waveSpawnQueue = [];
      for (let i = 0; i < config.small; i++) waveSpawnQueue.push(createEnemy('small'));
      for (let i = 0; i < config.medium; i++) waveSpawnQueue.push(createEnemy('medium'));
      for (let i = 0; i < config.large; i++) waveSpawnQueue.push(createEnemy('large'));
      // shuffle
      for (let i = waveSpawnQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [waveSpawnQueue[i], waveSpawnQueue[j]] = [waveSpawnQueue[j], waveSpawnQueue[i]];
      }
      waveEnemiesRemaining = waveSpawnQueue.length;
      waveSpawnTimer = 0;
      waveActive = true;
      SoundEngine.play('waveStart');
      // wave survival bonus
      if (wave > 1) {
        score += (wave - 1) * 150;
      }
    }

    function spawnParticles(x: number, y: number, color: string, count: number, speedMult = 1) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = randRange(1, 4) * speedMult;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: randRange(0.3, 0.8),
          maxLife: randRange(0.3, 0.8),
          color,
          radius: randRange(2, 5),
        });
      }
    }

    function killEnemy(enemy: Enemy, byTether: boolean) {
      const multiplier = byTether ? TETHER_KILL_MULTIPLIER : 1;
      score += enemy.scoreValue * multiplier;
      totalKills++;
      if (byTether) tetherKills++;

      // spawn particles
      spawnParticles(enemy.x, enemy.y, enemy.color, 12, 1.5);

      // drop resource
      if (Math.random() < 0.6) {
        resources.push({
          x: enemy.x + randRange(-10, 10),
          y: enemy.y + randRange(-10, 10),
          spawnTime: animTime * 1000,
          sparklePhase: Math.random() * Math.PI * 2,
        });
      }
    }

    // -- UPDATE --
    function update(dt: number) {
      // Skip all updates when paused
      if (paused) return;

      const now = animTime * 1000;

      // Toggle tether with space
      if (keys[' '] && !spaceWasDown) {
        parasite.linked = !parasite.linked;
        if (!parasite.linked) SoundEngine.play('tetherUnlink');
        if (parasite.linked) {
          // snap back effect
          spawnParticles(parasite.x, parasite.y, FUCHSIA, 6);
          SoundEngine.play('tetherLink');
        }
      }
      spaceWasDown = !!keys[' '];

      // --- Move Host ---
      let hdx = 0, hdy = 0;
      if (keys['w'] || keys['arrowup']) hdy -= 1;
      if (keys['s'] || keys['arrowdown']) hdy += 1;
      if (keys['a'] || keys['arrowleft']) hdx -= 1;
      if (keys['d'] || keys['arrowright']) hdx += 1;
      if (hdx !== 0 || hdy !== 0) {
        const mag = Math.sqrt(hdx * hdx + hdy * hdy);
        hdx /= mag;
        hdy /= mag;
      }

      // Touch: host auto-follows toward parasite when tethered and no keyboard input
      if (touchActive && hdx === 0 && hdy === 0 && parasite.linked) {
        const toParX = parasite.x - host.x;
        const toParY = parasite.y - host.y;
        const toParDist = Math.sqrt(toParX * toParX + toParY * toParY);
        // Start following when beyond 50% of tether length
        if (toParDist > TETHER_MAX_LENGTH * 0.5) {
          const followStrength = clamp((toParDist - TETHER_MAX_LENGTH * 0.5) / (TETHER_MAX_LENGTH * 0.5), 0, 1);
          hdx = (toParX / toParDist) * followStrength;
          hdy = (toParY / toParDist) * followStrength;
        }
      }

      host.x += hdx * HOST_SPEED * dt * 60;
      host.y += hdy * HOST_SPEED * dt * 60;
      host.x = clamp(host.x, host.radius, CANVAS_W - host.radius);
      host.y = clamp(host.y, host.radius, CANVAS_H - host.radius);
      host.invulnTimer = Math.max(0, host.invulnTimer - dt);

      // --- Move Parasite ---
      const targetX = mouseX;
      const targetY = mouseY;
      const lerpFactor = 1 - Math.pow(1 - PARASITE_LERP, dt * 60);
      parasite.x = lerp(parasite.x, targetX, lerpFactor);
      parasite.y = lerp(parasite.y, targetY, lerpFactor);

      // Tether constraint
      if (parasite.linked) {
        const d = dist(host, parasite);
        if (d > TETHER_MAX_LENGTH) {
          const angle = Math.atan2(parasite.y - host.y, parasite.x - host.x);
          parasite.x = host.x + Math.cos(angle) * TETHER_MAX_LENGTH;
          parasite.y = host.y + Math.sin(angle) * TETHER_MAX_LENGTH;
        }
        // spring force: slight pull toward host if beyond 80% length
        if (d > TETHER_MAX_LENGTH * 0.8) {
          const pull = (d - TETHER_MAX_LENGTH * 0.8) / (TETHER_MAX_LENGTH * 0.2) * 0.3;
          const angle = Math.atan2(host.y - parasite.y, host.x - parasite.x);
          parasite.x += Math.cos(angle) * pull * dt * 60;
          parasite.y += Math.sin(angle) * pull * dt * 60;
        }
      } else {
        // Detached: drain health
        parasite.hp -= PARASITE_DETACH_DRAIN * dt;
        if (parasite.hp <= 0) {
          parasite.hp = 0;
          // Force relink if parasite would die
          parasite.linked = true;
          parasite.hp = 1;
          spawnParticles(parasite.x, parasite.y, MAGENTA, 8);
        }
      }

      parasite.x = clamp(parasite.x, parasite.radius, CANVAS_W - parasite.radius);
      parasite.y = clamp(parasite.y, parasite.radius, CANVAS_H - parasite.radius);
      parasite.invulnTimer = Math.max(0, parasite.invulnTimer - dt);

      // Trail
      parasite.trail.unshift({ x: parasite.x, y: parasite.y });
      if (parasite.trail.length > 12) parasite.trail.pop();

      // --- Tether particles ---
      if (parasite.linked) {
        if (tetherParticles.length < 5 && Math.random() < 0.1) {
          tetherParticles.push({ t: 0, speed: randRange(0.3, 0.8) });
        }
        for (let i = tetherParticles.length - 1; i >= 0; i--) {
          tetherParticles[i].t += tetherParticles[i].speed * dt;
          if (tetherParticles[i].t > 1) tetherParticles.splice(i, 1);
        }
      } else {
        tetherParticles.length = 0;
      }

      // --- Spawn enemies ---
      if (waveActive && waveSpawnQueue.length > 0) {
        waveSpawnTimer += dt;
        const spawnInterval = Math.max(0.3, 1.2 - wave * 0.05);
        if (waveSpawnTimer >= spawnInterval) {
          waveSpawnTimer = 0;
          const e = waveSpawnQueue.pop()!;
          // Re-randomize spawn position
          const pos = spawnEdgePosition();
          e.x = pos.x;
          e.y = pos.y;
          enemies.push(e);
        }
      }

      // --- Update enemies ---
      for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.wobblePhase += e.wobbleSpeed * dt;

        // AI: Chase host (or nearest)
        let targetEX = host.x;
        let targetEY = host.y;

        // Small enemies: boid-like flocking + chase
        if (e.type === 'small') {
          // average position of nearby small enemies for cohesion
          let avgX = 0, avgY = 0, count = 0;
          for (const other of enemies) {
            if (other !== e && other.type === 'small') {
              const d = dist(e, other);
              if (d < 100) {
                avgX += other.x;
                avgY += other.y;
                count++;
              }
            }
          }
          if (count > 0) {
            avgX /= count;
            avgY /= count;
            // blend between flock center and host
            targetEX = targetEX * 0.7 + avgX * 0.3;
            targetEY = targetEY * 0.7 + avgY * 0.3;
          }

          // separation: push away from very close enemies
          for (const other of enemies) {
            if (other !== e) {
              const d = dist(e, other);
              if (d < e.radius + other.radius + 5 && d > 0) {
                const pushAngle = Math.atan2(e.y - other.y, e.x - other.x);
                e.x += Math.cos(pushAngle) * 0.5;
                e.y += Math.sin(pushAngle) * 0.5;
              }
            }
          }
        }

        // Medium enemies: chase host directly
        // Large enemies: chase host directly but slow

        const angle = Math.atan2(targetEY - e.y, targetEX - e.x);
        e.vx = Math.cos(angle) * e.speed;
        e.vy = Math.sin(angle) * e.speed;
        e.x += e.vx * dt * 60;
        e.y += e.vy * dt * 60;

        // --- Tether collision (bezier curve approximation) ---
        if (parasite.linked) {
          // Compute the bezier control point the same way as drawTether
          const tetherD = dist(host, parasite);
          const tetherTension = clamp(tetherD / TETHER_MAX_LENGTH, 0, 1);
          const tetherMidX = (host.x + parasite.x) / 2;
          const tetherMidY = (host.y + parasite.y) / 2;
          const tetherPerpX = -(parasite.y - host.y);
          const tetherPerpY = parasite.x - host.x;
          const tetherPerpLen = Math.sqrt(tetherPerpX * tetherPerpX + tetherPerpY * tetherPerpY) || 1;
          const tetherBow = (1 - tetherTension) * 30 * Math.sin(animTime * 2);
          const tetherCpX = tetherMidX + (tetherPerpX / tetherPerpLen) * tetherBow;
          const tetherCpY = tetherMidY + (tetherPerpY / tetherPerpLen) * tetherBow;

          const tetherDist = pointToBezierDist(
            e.x, e.y,
            host.x, host.y,
            tetherCpX, tetherCpY,
            parasite.x, parasite.y,
            10,
          );
          if (tetherDist < e.radius + 4 && now - e.lastTetherHit > TETHER_DAMAGE_COOLDOWN) {
            e.hp -= TETHER_DAMAGE;
            e.lastTetherHit = now;
            spawnParticles(e.x, e.y, FUCHSIA, 4);
            SoundEngine.play('enemyHit');
            if (e.hp <= 0) {
              killEnemy(e, true);
              SoundEngine.play('tetherKill');
              enemies.splice(i, 1);
              waveEnemiesRemaining--;
              continue;
            }
          }
        }

        // --- Contact damage to Host ---
        const dHost = dist(e, host);
        if (dHost < e.radius + host.radius) {
          if (host.invulnTimer <= 0) {
            host.hp -= e.damage;
            host.invulnTimer = 0.3;
            spawnParticles(host.x, host.y, '#ff6666', 4);
            SoundEngine.play('playerDamage');
          }
          // Host deals contact damage back
          e.hp -= HOST_CONTACT_DAMAGE * dt * 2;
          // Push enemy away
          const pushAngle = Math.atan2(e.y - host.y, e.x - host.x);
          e.x += Math.cos(pushAngle) * 3;
          e.y += Math.sin(pushAngle) * 3;

          if (e.hp <= 0) {
            killEnemy(e, false);
            SoundEngine.play('enemyDeath');
            enemies.splice(i, 1);
            waveEnemiesRemaining--;
            continue;
          }
        }

        // --- Contact damage to Parasite ---
        const dPar = dist(e, parasite);
        if (dPar < e.radius + parasite.radius) {
          if (parasite.invulnTimer <= 0) {
            parasite.hp -= e.damage * 0.8;
            parasite.invulnTimer = 0.25;
            spawnParticles(parasite.x, parasite.y, MAGENTA, 3);
            SoundEngine.play('playerDamage');
          }
          // Push enemy away
          const pushAngle = Math.atan2(e.y - parasite.y, e.x - parasite.x);
          e.x += Math.cos(pushAngle) * 2;
          e.y += Math.sin(pushAngle) * 2;
        }
      }

      // Check host death
      if (host.hp <= 0) {
        host.hp = 0;
        state = 'GameOver';
        spawnParticles(host.x, host.y, FUCHSIA, 30, 2);
        SoundEngine.play('gameOver');
        return;
      }

      // --- Resources ---
      for (let i = resources.length - 1; i >= 0; i--) {
        const r = resources[i];
        r.sparklePhase += dt * 4;
        // Lifetime
        if (now - r.spawnTime > RESOURCE_LIFETIME) {
          resources.splice(i, 1);
          continue;
        }
        // Parasite collection
        const d = dist(parasite, r);
        if (d < parasite.radius + RESOURCE_RADIUS + 8) {
          parasite.hp = Math.min(parasite.maxHp, parasite.hp + RESOURCE_HEAL);
          host.hp = Math.min(host.maxHp, host.hp + 3); // small host heal too
          score += RESOURCE_SCORE;
          spawnParticles(r.x, r.y, RESOURCE_CYAN, 6);
          SoundEngine.play('collectResource');
          resources.splice(i, 1);
        }
      }

      // --- Particles ---
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt * 60;
        p.y += p.vy * dt * 60;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // --- Wave management ---
      if (waveActive && waveEnemiesRemaining <= 0 && waveSpawnQueue.length === 0) {
        waveActive = false;
        wavePauseTimer = WAVE_PAUSE / 1000;
        SoundEngine.play('waveClear');
      }
      if (!waveActive && wavePauseTimer > 0) {
        wavePauseTimer -= dt;
        if (wavePauseTimer <= 0) {
          startNextWave();
        }
      }
    }

    // -- DRAW --
    function drawHexGrid(ctx: CanvasRenderingContext2D) {
      ctx.strokeStyle = 'rgba(217, 70, 239, 0.04)';
      ctx.lineWidth = 1;
      const size = 30;
      const h = size * Math.sqrt(3);
      for (let row = -1; row < CANVAS_H / h + 1; row++) {
        for (let col = -1; col < CANVAS_W / (size * 1.5) + 1; col++) {
          const cx = col * size * 1.5;
          const cy = row * h + (col % 2 === 0 ? 0 : h / 2);
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i + Math.PI / 6;
            const px = cx + size * Math.cos(angle);
            const py = cy + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.stroke();
        }
      }
    }

    function drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, hp: number, maxHp: number, color: string) {
      const ratio = clamp(hp / maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - w / 2, y, w, h);
      ctx.fillStyle = ratio > 0.3 ? color : '#ef4444';
      ctx.fillRect(x - w / 2, y, w * ratio, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - w / 2, y, w, h);
    }

    function drawTether(ctx: CanvasRenderingContext2D) {
      if (!parasite.linked) return;

      const d = dist(host, parasite);
      const tension = clamp(d / TETHER_MAX_LENGTH, 0, 1);

      // Tether curve (bow effect)
      const midX = (host.x + parasite.x) / 2;
      const midY = (host.y + parasite.y) / 2;
      const perpX = -(parasite.y - host.y);
      const perpY = parasite.x - host.x;
      const perpLen = Math.sqrt(perpX * perpX + perpY * perpY) || 1;
      const bowAmount = (1 - tension) * 30 * Math.sin(animTime * 2);
      const cpX = midX + (perpX / perpLen) * bowAmount;
      const cpY = midY + (perpY / perpLen) * bowAmount;

      // Glow
      ctx.save();
      ctx.shadowColor = tension > 0.85 ? '#ff4444' : FUCHSIA;
      ctx.shadowBlur = 10 + tension * 10;

      // Main tether line
      ctx.strokeStyle = tension > 0.85 ? `rgba(255, 80, 80, ${0.6 + tension * 0.4})` : `rgba(217, 70, 239, ${0.5 + tension * 0.3})`;
      ctx.lineWidth = 2 + (1 - tension) * 2;
      ctx.beginPath();
      ctx.moveTo(host.x, host.y);
      ctx.quadraticCurveTo(cpX, cpY, parasite.x, parasite.y);
      ctx.stroke();
      ctx.restore();

      // Energy particles along tether
      for (const tp of tetherParticles) {
        const t = tp.t;
        // Quadratic bezier position
        const px = (1 - t) * (1 - t) * host.x + 2 * (1 - t) * t * cpX + t * t * parasite.x;
        const py = (1 - t) * (1 - t) * host.y + 2 * (1 - t) * t * cpY + t * t * parasite.y;
        ctx.beginPath();
        ctx.fillStyle = `rgba(240, 171, 252, ${0.8 - t * 0.5})`;
        ctx.arc(px, py, 2 + Math.sin(animTime * 8 + t * 5) * 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawHost(ctx: CanvasRenderingContext2D) {
      const pulseOuter = 1 + Math.sin(animTime * 3) * 0.08;
      const flash = host.invulnTimer > 0 && Math.sin(animTime * 30) > 0;

      // Outer membrane (pulsing)
      ctx.beginPath();
      ctx.arc(host.x, host.y, host.radius * pulseOuter + 5, 0, Math.PI * 2);
      ctx.strokeStyle = flash ? '#ffffff' : `rgba(217, 70, 239, ${0.3 + Math.sin(animTime * 3) * 0.1})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Main body
      ctx.beginPath();
      ctx.arc(host.x, host.y, host.radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(host.x - 5, host.y - 5, 2, host.x, host.y, host.radius);
      grad.addColorStop(0, flash ? '#ffffff' : '#f0abfc');
      grad.addColorStop(0.5, flash ? '#ffaaff' : FUCHSIA);
      grad.addColorStop(1, flash ? '#ff66ff' : '#a21caf');
      ctx.fillStyle = grad;
      ctx.fill();

      // Inner nucleus
      ctx.beginPath();
      ctx.arc(host.x - 3, host.y - 3, host.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();

      // Health bar
      drawHealthBar(ctx, host.x, host.y - host.radius - 14, 50, 5, host.hp, host.maxHp, FUCHSIA);
    }

    function drawParasite(ctx: CanvasRenderingContext2D) {
      const flash = parasite.invulnTimer > 0 && Math.sin(animTime * 30) > 0;

      // Trail (tentacle-like)
      for (let i = 0; i < parasite.trail.length; i++) {
        const t = parasite.trail[i];
        const alpha = (1 - i / parasite.trail.length) * 0.4;
        const r = parasite.radius * (1 - i / parasite.trail.length) * 0.7;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240, 171, 252, ${alpha})`;
        ctx.fill();
      }

      // Main body
      ctx.beginPath();
      ctx.arc(parasite.x, parasite.y, parasite.radius, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(parasite.x - 2, parasite.y - 2, 1, parasite.x, parasite.y, parasite.radius);
      grad.addColorStop(0, flash ? '#ffffff' : '#fce7f3');
      grad.addColorStop(0.5, flash ? '#ffccff' : MAGENTA);
      grad.addColorStop(1, flash ? '#ff88ff' : '#c026d3');
      ctx.fillStyle = grad;
      ctx.fill();

      // Glow
      ctx.save();
      ctx.shadowColor = parasite.linked ? MAGENTA : '#ff4444';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(parasite.x, parasite.y, parasite.radius + 1, 0, Math.PI * 2);
      ctx.strokeStyle = parasite.linked ? `rgba(240, 171, 252, 0.6)` : `rgba(255, 100, 100, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      // Health bar
      drawHealthBar(ctx, parasite.x, parasite.y - parasite.radius - 12, 30, 4, parasite.hp, parasite.maxHp, MAGENTA);
    }

    function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
      // Wobbly organic shape
      ctx.beginPath();
      const segments = 24;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const wobble = 1 + Math.sin(angle * 3 + e.wobblePhase) * 0.12 + Math.sin(angle * 5 + e.wobblePhase * 1.3) * 0.06;
        const r = e.radius * wobble;
        const px = e.x + Math.cos(angle) * r;
        const py = e.y + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const grad = ctx.createRadialGradient(e.x - 2, e.y - 2, 1, e.x, e.y, e.radius);
      grad.addColorStop(0, e.color);
      grad.addColorStop(0.7, e.color);
      grad.addColorStop(1, e.colorDark);
      ctx.fillStyle = grad;
      ctx.fill();

      // Dark center
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = e.colorDark;
      ctx.fill();

      // HP bar (only if damaged)
      if (e.hp < e.maxHp) {
        drawHealthBar(ctx, e.x, e.y - e.radius - 8, e.radius * 2, 3, e.hp, e.maxHp, e.color);
      }
    }

    function drawResource(ctx: CanvasRenderingContext2D, r: Resource) {
      const sparkle = Math.sin(r.sparklePhase) * 0.3 + 0.7;
      const remainingRatio = 1 - (animTime * 1000 - r.spawnTime) / RESOURCE_LIFETIME;

      ctx.save();
      ctx.globalAlpha = Math.min(1, remainingRatio * 3) * sparkle;
      ctx.shadowColor = RESOURCE_CYAN;
      ctx.shadowBlur = 10;

      ctx.beginPath();
      ctx.arc(r.x, r.y, RESOURCE_RADIUS, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(r.x, r.y, 0, r.x, r.y, RESOURCE_RADIUS);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, RESOURCE_CYAN);
      grad.addColorStop(1, 'rgba(34, 211, 238, 0.3)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Sparkle cross
      ctx.strokeStyle = `rgba(255,255,255,${sparkle * 0.6})`;
      ctx.lineWidth = 1;
      const sz = RESOURCE_RADIUS + 3 + Math.sin(r.sparklePhase * 2) * 2;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y - sz);
      ctx.lineTo(r.x, r.y + sz);
      ctx.moveTo(r.x - sz, r.y);
      ctx.lineTo(r.x + sz, r.y);
      ctx.stroke();

      ctx.restore();
    }

    function drawParticles(ctx: CanvasRenderingContext2D) {
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawHUD(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${score}`, 15, 28);
      ctx.fillText(`Wave: ${wave}`, 15, 50);

      // Tether status
      ctx.fillStyle = parasite.linked ? FUCHSIA : '#ff6666';
      ctx.fillText(`Tether: ${parasite.linked ? 'LINKED' : 'UNLINKED'}`, 15, 72);

      // Host HP
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'right';
      ctx.fillText(`Host HP: ${Math.ceil(host.hp)}/${host.maxHp}`, CANVAS_W - 15, 28);
      ctx.fillStyle = MAGENTA;
      ctx.fillText(`Parasite HP: ${Math.ceil(parasite.hp)}/${parasite.maxHp}`, CANVAS_W - 15, 50);

      // Wave announcement
      if (!waveActive && wavePauseTimer > 0) {
        ctx.textAlign = 'center';
        ctx.fillStyle = FUCHSIA;
        ctx.font = 'bold 28px monospace';
        ctx.fillText(`Wave ${wave + 1} incoming...`, CANVAS_W / 2, CANVAS_H / 2 - 100);
        ctx.font = '16px monospace';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(`${Math.ceil(wavePauseTimer)}s`, CANVAS_W / 2, CANVAS_H / 2 - 70);
      }

      // Wave indicator at top center
      if (waveActive) {
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '12px monospace';
        ctx.fillText(`Enemies remaining: ${waveEnemiesRemaining}`, CANVAS_W / 2, 20);
      }
    }

    function drawMenu(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawHexGrid(ctx);

      // Animated cell-like circles
      const cellCount = 8;
      for (let i = 0; i < cellCount; i++) {
        const cx = CANVAS_W / 2 + Math.cos(animTime * 0.3 + i * 0.8) * 200;
        const cy = CANVAS_H / 2 + Math.sin(animTime * 0.4 + i * 0.8) * 150;
        const r = 30 + Math.sin(animTime + i) * 10;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(217, 70, 239, ${0.08 + Math.sin(animTime + i * 0.5) * 0.04})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        // inner
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(217, 70, 239, 0.03)`;
        ctx.fill();
      }

      // Tether illustration (two circles connected)
      const hostDemoX = CANVAS_W / 2 - 70;
      const parDemoX = CANVAS_W / 2 + 70 + Math.sin(animTime * 1.5) * 20;
      const demoY = CANVAS_H / 2 - 40;

      // Tether line
      ctx.strokeStyle = `rgba(217, 70, 239, 0.4)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hostDemoX, demoY);
      const cpDX = (hostDemoX + parDemoX) / 2;
      const cpDY = demoY + Math.sin(animTime * 2) * 15;
      ctx.quadraticCurveTo(cpDX, cpDY, parDemoX, demoY);
      ctx.stroke();

      // Host demo
      ctx.beginPath();
      ctx.arc(hostDemoX, demoY, 20, 0, Math.PI * 2);
      ctx.fillStyle = FUCHSIA;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hostDemoX, demoY, 24 + Math.sin(animTime * 3) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(217, 70, 239, 0.4)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Parasite demo
      ctx.beginPath();
      ctx.arc(parDemoX, demoY, 8, 0, Math.PI * 2);
      ctx.fillStyle = MAGENTA;
      ctx.fill();

      // Title
      ctx.textAlign = 'center';
      ctx.fillStyle = FUCHSIA;
      ctx.font = 'bold 52px monospace';
      ctx.shadowColor = FUCHSIA;
      ctx.shadowBlur = 20;
      ctx.fillText('SYMBIOSIS', CANVAS_W / 2, CANVAS_H / 2 + 50);
      ctx.shadowBlur = 0;

      // Instructions
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '15px monospace';
      ctx.fillText('Control two linked organisms to survive', CANVAS_W / 2, CANVAS_H / 2 + 85);

      ctx.font = '13px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText('WASD = Move Host  |  Mouse = Move Parasite  |  Space = Link/Unlink', CANVAS_W / 2, CANVAS_H / 2 + 115);
      ctx.fillText('Tether damages enemies on contact (3x score!)  |  Collect cyan orbs to heal', CANVAS_W / 2, CANVAS_H / 2 + 137);

      // Click to start
      const pulse = 0.5 + Math.sin(animTime * 3) * 0.3;
      ctx.fillStyle = `rgba(217, 70, 239, ${pulse + 0.3})`;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('Click or Tap to Start', CANVAS_W / 2, CANVAS_H / 2 + 180);
    }

    function drawGameOver(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      ctx.textAlign = 'center';

      ctx.fillStyle = '#ff6666';
      ctx.font = 'bold 48px monospace';
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 15;
      ctx.fillText('GAME OVER', CANVAS_W / 2, CANVAS_H / 2 - 100);
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`Final Score: ${score}`, CANVAS_W / 2, CANVAS_H / 2 - 40);

      ctx.font = '18px monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`Wave Reached: ${maxWaveReached}`, CANVAS_W / 2, CANVAS_H / 2);
      ctx.fillText(`Total Kills: ${totalKills}`, CANVAS_W / 2, CANVAS_H / 2 + 30);

      ctx.fillStyle = FUCHSIA;
      ctx.fillText(`Tether Kills: ${tetherKills} (3x bonus!)`, CANVAS_W / 2, CANVAS_H / 2 + 60);

      const pulse = 0.5 + Math.sin(animTime * 3) * 0.3;
      ctx.fillStyle = `rgba(217, 70, 239, ${pulse + 0.3})`;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('Click or Tap to Restart', CANVAS_W / 2, CANVAS_H / 2 + 120);
    }

    function drawPlaying(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      drawHexGrid(ctx);

      // Resources
      for (const r of resources) drawResource(ctx, r);

      // Tether
      drawTether(ctx);

      // Enemies
      for (const e of enemies) drawEnemy(ctx, e);

      // Host
      drawHost(ctx);

      // Parasite
      drawParasite(ctx);

      // Particles
      drawParticles(ctx);

      // HUD
      drawHUD(ctx);
    }

    // -- MAIN LOOP --
    function loop(timestamp: number) {
      if (!running) return;

      const rawDt = lastTime === 0 ? 1 / 60 : (timestamp - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05); // cap delta
      lastTime = timestamp;
      animTime += dt;

      // Handle clicks
      if (mouseClicked) {
        mouseClicked = false;
        if (state === 'Menu') {
          state = 'Playing';
          initGame();
        } else if (state === 'GameOver') {
          state = 'Menu';
        }
      }

      // Clear
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

      if (state === 'Menu') {
        drawMenu(ctx);
      } else if (state === 'Playing') {
        update(dt);
        drawPlaying(ctx);
        // update() may have changed state to GameOver
        if ((state as GameState) === 'GameOver') {
          drawGameOver(ctx);
        }

        // Draw pause overlay
        if (paused) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

          ctx.save();
          ctx.shadowColor = FUCHSIA;
          ctx.shadowBlur = 20;
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 20);
          ctx.restore();

          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '18px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Press P to resume', CANVAS_W / 2, CANVAS_H / 2 + 25);
        }
      } else if (state === 'GameOver') {
        drawPlaying(ctx);
        drawGameOver(ctx);
      }

      requestAnimationFrame(loop);
    }

    requestAnimationFrame(loop);

    return () => {
      running = false;
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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
        maxWidth: `${CANVAS_W}px`,
        height: 'auto',
        aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
        background: '#0a0a0f',
        cursor: 'none',
      }}
    />
  );
}
