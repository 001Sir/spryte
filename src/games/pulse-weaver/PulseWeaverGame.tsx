'use client';

import { useRef, useEffect } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';

// ─── Constants ───────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const ROSE = '#f43f5e';
const BG = '#0a0a0f';
const PLAYER_SPEED = 3.5;
const BEAM_WIDTH = 2.5;
const BEAM_LENGTH = 900;
const BEAM_AMPLITUDE = 12;
const MIN_FREQ = 1;
const MAX_FREQ = 10;
const FREQ_SCROLL_SPEED = 0.4;
const FREQ_MATCH_TOLERANCE = 0.5;
const PERFECT_MATCH_TOLERANCE = 0.2;
const COMBO_TIMEOUT = 2000;
const CONTACT_DAMAGE = 15;
const CONTACT_COOLDOWN = 800;
const POWERUP_DURATION = 8000;
const POWERUP_DROP_CHANCE = 0.25;

// ─── Types ───────────────────────────────────────────────────────────────────
type GameState = 'menu' | 'playing' | 'gameover';
type PowerUpType = 'health' | 'multibeam' | 'scanner';

interface Vec2 {
  x: number;
  y: number;
}

interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sides: number; // 3=tri, 4=sq, 5=pent, 6=hex
  radius: number;
  health: number;
  maxHealth: number;
  frequency: number;
  color: string;
  flashTimer: number;
  dead: boolean;
  pulsePhase: number;
  angle: number;
  rotSpeed: number;
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
}

interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  life: number;
  pulsePhase: number;
}

interface Star {
  x: number;
  y: number;
  brightness: number;
  speed: number;
  size: number;
}

// ─── Helper functions ────────────────────────────────────────────────────────
function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y);
  if (len === 0) return { x: 0, y: -1 };
  return { x: v.x / len, y: v.y / len };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function freqToColor(freq: number): string {
  const t = (freq - MIN_FREQ) / (MAX_FREQ - MIN_FREQ);
  if (t < 0.33) {
    const s = t / 0.33;
    const r = Math.floor(lerp(50, 50, s));
    const g = Math.floor(lerp(120, 230, s));
    const b = Math.floor(lerp(255, 50, s));
    return `rgb(${r},${g},${b})`;
  } else if (t < 0.66) {
    const s = (t - 0.33) / 0.33;
    const r = Math.floor(lerp(50, 255, s));
    const g = Math.floor(lerp(230, 230, s));
    const b = Math.floor(lerp(50, 20, s));
    return `rgb(${r},${g},${b})`;
  } else {
    const s = (t - 0.66) / 0.34;
    const r = Math.floor(lerp(255, 255, s));
    const g = Math.floor(lerp(230, 60, s));
    const b = Math.floor(lerp(20, 40, s));
    return `rgb(${r},${g},${b})`;
  }
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ─── Wave Definitions ────────────────────────────────────────────────────────
interface WaveDef {
  enemies: Array<{ sides: number; freq: number; count: number; speed?: number; health?: number }>;
}

function getWaveDefs(): WaveDef[] {
  return [
    // Wave 1: gentle intro - slow triangles, single frequency
    { enemies: [{ sides: 3, freq: 3, count: 3, speed: 0.4 }] },
    // Wave 2: two frequency groups
    { enemies: [{ sides: 3, freq: 3, count: 3, speed: 0.5 }, { sides: 3, freq: 6, count: 2, speed: 0.5 }] },
    // Wave 3: squares appear
    { enemies: [{ sides: 4, freq: 4, count: 3, speed: 0.5 }, { sides: 3, freq: 7, count: 3, speed: 0.6 }] },
    // Wave 4: more variety
    { enemies: [{ sides: 3, freq: 2, count: 3, speed: 0.6 }, { sides: 4, freq: 5, count: 3, speed: 0.5 }, { sides: 3, freq: 8, count: 2, speed: 0.7 }] },
    // Wave 5: pentagons
    { enemies: [{ sides: 5, freq: 5, count: 2, speed: 0.4, health: 80 }, { sides: 3, freq: 3, count: 4, speed: 0.7 }, { sides: 4, freq: 7, count: 3, speed: 0.6 }] },
    // Wave 6: spread of frequencies
    { enemies: [{ sides: 3, freq: 1, count: 2, speed: 0.8 }, { sides: 4, freq: 4, count: 3, speed: 0.6 }, { sides: 5, freq: 7, count: 2, speed: 0.5, health: 90 }, { sides: 3, freq: 9, count: 2, speed: 0.8 }] },
    // Wave 7: hexagons
    { enemies: [{ sides: 6, freq: 5, count: 2, speed: 0.35, health: 120 }, { sides: 4, freq: 3, count: 4, speed: 0.7 }, { sides: 5, freq: 8, count: 3, speed: 0.5, health: 80 }] },
    // Wave 8: heavy
    { enemies: [{ sides: 6, freq: 2, count: 2, speed: 0.4, health: 130 }, { sides: 6, freq: 8, count: 2, speed: 0.4, health: 130 }, { sides: 3, freq: 5, count: 5, speed: 0.9 }, { sides: 4, freq: 6, count: 3, speed: 0.7 }] },
    // Wave 9: swarm
    { enemies: [{ sides: 3, freq: 2, count: 5, speed: 1.0 }, { sides: 3, freq: 5, count: 5, speed: 1.0 }, { sides: 3, freq: 8, count: 5, speed: 1.0 }, { sides: 5, freq: 4, count: 2, speed: 0.6, health: 100 }] },
    // Wave 10: boss wave
    { enemies: [{ sides: 6, freq: 5, count: 3, speed: 0.3, health: 200 }, { sides: 5, freq: 3, count: 3, speed: 0.5, health: 100 }, { sides: 5, freq: 7, count: 3, speed: 0.5, health: 100 }, { sides: 4, freq: 9, count: 4, speed: 0.8 }] },
    // Wave 11+: procedurally scaled from wave 10 pattern
    { enemies: [{ sides: 6, freq: 3, count: 4, speed: 0.4, health: 220 }, { sides: 5, freq: 6, count: 4, speed: 0.6, health: 120 }, { sides: 4, freq: 1, count: 4, speed: 0.9 }, { sides: 3, freq: 9, count: 6, speed: 1.1 }] },
    { enemies: [{ sides: 6, freq: 2, count: 4, speed: 0.45, health: 250 }, { sides: 6, freq: 8, count: 4, speed: 0.45, health: 250 }, { sides: 5, freq: 5, count: 4, speed: 0.7, health: 140 }, { sides: 3, freq: 4, count: 6, speed: 1.2 }] },
  ];
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function PulseWeaverGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    // ── Game State ────────────────────────────────────────────────────────
    let state: GameState = 'menu';
    let animId = 0;
    let lastTime = 0;

    // Player
    let px = W / 2;
    let py = H - 80;
    let playerHealth = 100;
    let playerMaxHealth = 100;
    let playerAngle = 0;
    let lastContactTime = 0;

    // Beam
    let mouseX = W / 2;
    let mouseY = 0;
    let firing = false;
    let frequency = 5;
    let beamTime = 0;

    // Enemies
    let enemies: Enemy[] = [];
    let particles: Particle[] = [];
    let powerUps: PowerUp[] = [];

    // Stars
    const stars: Star[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        brightness: 0.2 + Math.random() * 0.6,
        speed: 0.05 + Math.random() * 0.15,
        size: 0.5 + Math.random() * 1.5,
      });
    }

    // Scoring / waves
    let score = 0;
    let wave = 0;
    let combo = 0;
    let maxCombo = 0;
    let lastComboTime = 0;
    let waveTimer = 0;
    const waveDelay = 3000;
    let waveActive = false;
    let waveCleared = false;
    let waveAnnounceTimer = 0;
    const waveDefs = getWaveDefs();

    // Power-up state
    let hasMultibeam = false;
    let multibeamTimer = 0;
    let hasScanner = false;
    let scannerTimer = 0;

    // Menu animation
    let menuTime = 0;

    // Game over stats
    let finalScore = 0;
    let finalWave = 0;
    let finalMaxCombo = 0;

    // Pause
    let paused = false;

    let highScore = getHighScore('pulse-weaver');
    let newHighScore = false;

    // Input
    const keys: Record<string, boolean> = {};
    let mouseDown = false;
    let touchActive = false;

    // ── Input Handlers ───────────────────────────────────────────────────
    function onKeyDown(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = true;
      // Toggle pause only during playing state
      if (state === 'playing' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        paused = !paused;
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keys[e.key.toLowerCase()] = false;
    }
    // Cache canvas rect to avoid layout thrashing on every mousemove
    let cachedRect = canvas!.getBoundingClientRect();
    const onResize = () => { cachedRect = canvas!.getBoundingClientRect(); };
    window.addEventListener('resize', onResize);

    function onMouseMove(e: MouseEvent) {
      const scaleX = W / cachedRect.width;
      const scaleY = H / cachedRect.height;
      mouseX = (e.clientX - cachedRect.left) * scaleX;
      mouseY = (e.clientY - cachedRect.top) * scaleY;
    }
    function onMouseDown(e: MouseEvent) {
      if (e.button !== 0) return;
      mouseDown = true;
      if (state === 'menu') {
        startGame();
      } else if (state === 'gameover') {
        startGame();
      }
    }
    function onMouseUp(e: MouseEvent) {
      if (e.button !== 0) return;
      mouseDown = false;
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      if (state === 'playing') {
        frequency = clamp(frequency - e.deltaY * 0.003 * FREQ_SCROLL_SPEED, MIN_FREQ, MAX_FREQ);
      }
    }
    function onContextMenu(e: Event) {
      e.preventDefault();
    }

    // ── Touch Handlers ───────────────────────────────────────────────────
    function getTouchCanvasPos(touch: Touch): { tx: number; ty: number } {
      const scaleX = W / cachedRect.width;
      const scaleY = H / cachedRect.height;
      return {
        tx: (touch.clientX - cachedRect.left) * scaleX,
        ty: (touch.clientY - cachedRect.top) * scaleY,
      };
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      if (!touch) return;
      const { tx, ty } = getTouchCanvasPos(touch);

      if (state === 'menu') {
        startGame();
        return;
      }
      if (state === 'gameover') {
        startGame();
        return;
      }

      // Playing state: touch = aim + fire + move toward touch
      touchActive = true;
      mouseX = tx;
      mouseY = ty;
      mouseDown = true;
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (!touchActive) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const { tx, ty } = getTouchCanvasPos(touch);
      mouseX = tx;
      mouseY = ty;
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      touchActive = false;
      mouseDown = false;
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onVisibilityChange = () => {
      if (document.hidden && state === 'playing' && !paused) {
        paused = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    // ── Start / Reset Game ───────────────────────────────────────────────
    function startGame() {
      state = 'playing';
      paused = false;
      px = W / 2;
      py = H - 80;
      playerHealth = 100;
      playerMaxHealth = 100;
      frequency = 5;
      firing = false;
      beamTime = 0;
      enemies = [];
      particles = [];
      powerUps = [];
      score = 0;
      newHighScore = false;
      wave = 0;
      combo = 0;
      maxCombo = 0;
      lastComboTime = 0;
      waveTimer = 0;
      waveActive = false;
      waveCleared = false;
      waveAnnounceTimer = 0;
      hasMultibeam = false;
      multibeamTimer = 0;
      hasScanner = false;
      scannerTimer = 0;
      lastContactTime = 0;
      spawnWave();
    }

    // ── Spawn Helpers ────────────────────────────────────────────────────
    function spawnWave() {
      wave++;
      waveAnnounceTimer = 2000;
      SoundEngine.play('waveStart');
      waveActive = true;
      waveCleared = false;

      const defIdx = Math.min(wave - 1, waveDefs.length - 1);
      const def = waveDefs[defIdx];
      const scaleFactor = wave > waveDefs.length ? 1 + (wave - waveDefs.length) * 0.15 : 1;

      for (const group of def.enemies) {
        for (let i = 0; i < group.count; i++) {
          const enemy = createEnemy(group.sides, group.freq, group.speed ?? 0.5, group.health, scaleFactor);
          enemies.push(enemy);
        }
      }
    }

    function createEnemy(sides: number, freq: number, speed: number, baseHealth?: number, scale = 1): Enemy {
      const edge = Math.floor(Math.random() * 4);
      let x: number, y: number;
      switch (edge) {
        case 0: x = Math.random() * W; y = -30; break;
        case 1: x = W + 30; y = Math.random() * H; break;
        case 2: x = Math.random() * W; y = H + 30; break;
        default: x = -30; y = Math.random() * H; break;
      }

      const defaultHealth = sides === 3 ? 40 : sides === 4 ? 60 : sides === 5 ? 80 : 120;
      const hp = Math.floor((baseHealth ?? defaultHealth) * scale);
      const radius = sides === 3 ? 16 : sides === 4 ? 18 : sides === 5 ? 22 : 26;

      const colors = ['#f43f5e', '#fb923c', '#a78bfa', '#34d399', '#38bdf8', '#e879f9'];
      const color = colors[Math.floor(Math.random() * colors.length)];

      // Aim vaguely toward center/player with some randomness
      const targetX = W / 2 + randomBetween(-150, 150);
      const targetY = H / 2 + randomBetween(-100, 100);
      const dir = normalize({ x: targetX - x, y: targetY - y });

      return {
        x, y,
        vx: dir.x * speed * scale,
        vy: dir.y * speed * scale,
        sides,
        radius,
        health: hp,
        maxHealth: hp,
        frequency: freq + randomBetween(-0.3, 0.3),
        color,
        flashTimer: 0,
        dead: false,
        pulsePhase: Math.random() * Math.PI * 2,
        angle: Math.random() * Math.PI * 2,
        rotSpeed: randomBetween(-0.02, 0.02),
      };
    }

    function spawnParticles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1 + Math.random() * 4;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 500 + Math.random() * 500,
          maxLife: 500 + Math.random() * 500,
          color,
          size: 1 + Math.random() * 3,
        });
      }
    }

    function spawnPowerUp(x: number, y: number) {
      const types: PowerUpType[] = ['health', 'multibeam', 'scanner'];
      powerUps.push({
        x, y,
        type: types[Math.floor(Math.random() * types.length)],
        life: 8000,
        pulsePhase: 0,
      });
    }

    // ── Update ───────────────────────────────────────────────────────────
    function update(dt: number) {
      if (state === 'menu') {
        menuTime += dt;
        return;
      }
      if (state === 'gameover') {
        menuTime += dt;
        // Still update particles for visual effect
        updateParticles(dt);
        return;
      }

      // Skip all updates when paused
      if (paused) return;

      // Playing state
      beamTime += dt;
      firing = mouseDown;
      if (firing) { SoundEngine.startLoop('beamFire'); } else { SoundEngine.stopLoop('beamFire'); }

      // Frequency hold: while firing, slowly increase frequency (alternative to scroll)
      // Removed to let scroll be primary control

      // Player movement
      let dx = 0, dy = 0;
      if (keys['w'] || keys['arrowup']) dy -= 1;
      if (keys['s'] || keys['arrowdown']) dy += 1;
      if (keys['a'] || keys['arrowleft']) dx -= 1;
      if (keys['d'] || keys['arrowright']) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
      }

      // Touch: player slowly moves toward touch point (when no keyboard input)
      if (touchActive && dx === 0 && dy === 0) {
        const toTouchX = mouseX - px;
        const toTouchY = mouseY - py;
        const touchDist = Math.hypot(toTouchX, toTouchY);
        // Move toward touch if farther than 60px away (keeps some distance)
        if (touchDist > 60) {
          dx = toTouchX / touchDist;
          dy = toTouchY / touchDist;
          // Move at 60% speed for touch so it feels controlled
          dx *= 0.6;
          dy *= 0.6;
        }
      }

      px = clamp(px + dx * PLAYER_SPEED * (dt / 16), 20, W - 20);
      py = clamp(py + dy * PLAYER_SPEED * (dt / 16), 20, H - 20);

      // Player aim angle
      playerAngle = Math.atan2(mouseY - py, mouseX - px);

      // Update enemies
      for (const e of enemies) {
        if (e.dead) continue;

        // Drift toward player
        const toPlayer = normalize({ x: px - e.x, y: py - e.y });
        e.vx = lerp(e.vx, toPlayer.x * Math.hypot(e.vx, e.vy) * 1.2, 0.01);
        e.vy = lerp(e.vy, toPlayer.y * Math.hypot(e.vx, e.vy) * 1.2, 0.01);

        e.x += e.vx * (dt / 16);
        e.y += e.vy * (dt / 16);
        e.angle += e.rotSpeed * (dt / 16);
        e.pulsePhase += dt * 0.001 * e.frequency * Math.PI * 2 * 0.3;
        if (e.flashTimer > 0) e.flashTimer -= dt;

        // Contact damage
        const d = dist({ x: e.x, y: e.y }, { x: px, y: py });
        if (d < e.radius + 14) {
          const now = performance.now();
          if (now - lastContactTime > CONTACT_COOLDOWN) {
            playerHealth -= CONTACT_DAMAGE;
            lastContactTime = now;
            spawnParticles(px, py, '#ff4444', 8);
            SoundEngine.play('playerDamage');
            if (playerHealth <= 0) {
              gameOver();
              return;
            }
          }
        }
      }

      // Beam hit detection
      if (firing) {
        const beamDir = normalize({ x: mouseX - px, y: mouseY - py });
        // beamDir is used for hit detection below

        const beamAngles = [0];
        if (hasMultibeam) {
          beamAngles.push(-0.15, 0.15);
        }

        for (const angleOffset of beamAngles) {
          const cos = Math.cos(angleOffset);
          const sin = Math.sin(angleOffset);
          const dirX = beamDir.x * cos - beamDir.y * sin;
          const dirY = beamDir.x * sin + beamDir.y * cos;
          const endX = px + dirX * BEAM_LENGTH;
          const endY = py + dirY * BEAM_LENGTH;

          for (const e of enemies) {
            if (e.dead) continue;
            const d = pointToSegmentDist(e.x, e.y, px, py, endX, endY);
            if (d < e.radius + 8) {
              const freqDiff = Math.abs(frequency - e.frequency);
              if (freqDiff < FREQ_MATCH_TOLERANCE) {
                const damageBase = 0.4 * (dt / 16);
                const matchQuality = 1 - freqDiff / FREQ_MATCH_TOLERANCE;
                const perfectBonus = freqDiff < PERFECT_MATCH_TOLERANCE ? 2 : 1;
                const damage = damageBase * (0.5 + matchQuality * 0.5) * perfectBonus;
                e.health -= damage;
                e.flashTimer = 100;
                SoundEngine.play('frequencyMatch');

                if (e.health <= 0) {
                  e.dead = true;
                  const points = e.sides * 10 * (1 + combo * 0.5);
                  score += Math.floor(points);
                  combo++;
                  lastComboTime = performance.now();
                  if (combo > maxCombo) maxCombo = combo;
                  SoundEngine.play('comboUp');
                  spawnParticles(e.x, e.y, e.color, 20 + e.sides * 3);
                  SoundEngine.play('enemyDeath');

                  if (Math.random() < POWERUP_DROP_CHANCE) {
                    spawnPowerUp(e.x, e.y);
                  }
                }
              }
            }
          }
        }
      }

      // Combo timeout
      if (combo > 0 && performance.now() - lastComboTime > COMBO_TIMEOUT) {
        combo = 0;
      }

      // Remove dead enemies
      enemies = enemies.filter(e => !e.dead);

      // Update particles
      updateParticles(dt);

      // Update power-ups
      for (const pu of powerUps) {
        pu.life -= dt;
        pu.pulsePhase += dt * 0.005;
      }
      powerUps = powerUps.filter(pu => pu.life > 0);

      // Collect power-ups
      for (let i = powerUps.length - 1; i >= 0; i--) {
        const pu = powerUps[i];
        if (dist({ x: pu.x, y: pu.y }, { x: px, y: py }) < 30) {
          switch (pu.type) {
            case 'health':
              playerHealth = Math.min(playerMaxHealth, playerHealth + 30);
              spawnParticles(pu.x, pu.y, '#34d399', 12);
              SoundEngine.play('heal');
              break;
            case 'multibeam':
              hasMultibeam = true;
              multibeamTimer = POWERUP_DURATION;
              spawnParticles(pu.x, pu.y, '#38bdf8', 12);
              SoundEngine.play('collectPowerup');
              break;
            case 'scanner':
              hasScanner = true;
              scannerTimer = POWERUP_DURATION;
              spawnParticles(pu.x, pu.y, '#e879f9', 12);
              SoundEngine.play('collectPowerup');
              break;
          }
          powerUps.splice(i, 1);
        }
      }

      // Power-up timers
      if (hasMultibeam) {
        multibeamTimer -= dt;
        if (multibeamTimer <= 0) hasMultibeam = false;
      }
      if (hasScanner) {
        scannerTimer -= dt;
        if (scannerTimer <= 0) hasScanner = false;
      }

      // Wave management
      if (waveAnnounceTimer > 0) {
        waveAnnounceTimer -= dt;
      }

      if (waveActive && enemies.length === 0 && !waveCleared) {
        waveCleared = true;
        waveTimer = waveDelay;
        SoundEngine.play('waveClear');
      }

      if (waveCleared) {
        waveTimer -= dt;
        if (waveTimer <= 0) {
          spawnWave();
        }
      }

      // Update stars
      for (const s of stars) {
        s.y += s.speed * (dt / 16);
        if (s.y > H) {
          s.y = 0;
          s.x = Math.random() * W;
        }
      }
    }

    function updateParticles(dt: number) {
      for (const p of particles) {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.vx *= 0.98;
        p.vy *= 0.98;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0);
    }

    function gameOver() {
      state = 'gameover';
      finalScore = score;
      finalWave = wave;
      finalMaxCombo = maxCombo;
      if (finalScore > highScore) { highScore = finalScore; newHighScore = true; setHighScore('pulse-weaver', finalScore); }
      menuTime = 0;
      spawnParticles(px, py, ROSE, 40);
      SoundEngine.play('gameOver');
      SoundEngine.stopAllLoops();
    }

    // ── Drawing ──────────────────────────────────────────────────────────
    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Stars
      for (const s of stars) {
        ctx.globalAlpha = s.brightness * (0.5 + 0.5 * Math.sin(menuTime * 0.001 + s.x));
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      if (state === 'menu') {
        drawMenu();
      } else if (state === 'playing') {
        drawGrid();
        drawPowerUps();
        drawEnemies();
        if (firing) drawBeam();
        drawPlayer();
        drawParticles();
        drawHUD();
        if (waveAnnounceTimer > 0) drawWaveAnnounce();

        // Draw pause overlay
        if (paused) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
          ctx.fillRect(0, 0, W, H);

          ctx.save();
          ctx.shadowColor = ROSE;
          ctx.shadowBlur = 20;
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 48px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('PAUSED', W / 2, H / 2 - 20);
          ctx.restore();

          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '18px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('Press P to resume', W / 2, H / 2 + 25);
        }
      } else if (state === 'gameover') {
        drawGrid();
        drawParticles();
        drawGameOver();
      }
    }

    function drawGrid() {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.06)';
      ctx.lineWidth = 1;
      const gridSpacing = 40;

      // Horizontal lines with slight perspective feel
      for (let y = 0; y < H; y += gridSpacing) {
        const alpha = 0.03 + (y / H) * 0.06;
        ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let x = 0; x < W; x += gridSpacing) {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.04)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
    }

    function drawMenu() {
      // Animated sine waves in background
      for (let w = 0; w < 5; w++) {
        const freq = 1 + w * 0.7;
        const amp = 30 + w * 10;
        const yBase = H * 0.3 + w * 50;
        const alpha = 0.15 - w * 0.02;
        ctx.strokeStyle = `rgba(244, 63, 94, ${alpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let x = 0; x < W; x += 2) {
          const y = yBase + Math.sin(x * 0.01 * freq + menuTime * 0.002 + w) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Title
      const titlePulse = 1 + Math.sin(menuTime * 0.003) * 0.05;
      ctx.save();
      ctx.translate(W / 2, H * 0.3);
      ctx.scale(titlePulse, titlePulse);

      ctx.shadowColor = ROSE;
      ctx.shadowBlur = 30;
      ctx.fillStyle = ROSE;
      ctx.font = 'bold 56px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PULSE WEAVER', 0, 0);
      ctx.shadowBlur = 0;
      ctx.restore();

      // Subtitle
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Tune your beam to destroy geometric enemies', W / 2, H * 0.3 + 50);

      // Instructions
      const instructions = [
        'WASD  -  Move ship',
        'Mouse  -  Aim beam',
        'Left Click (hold)  -  Fire beam',
        'Scroll Wheel  -  Adjust frequency',
        '',
        'Match your beam frequency to enemy resonance',
        'to deal damage. Closer match = more damage!',
      ];

      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = '14px monospace';
      for (let i = 0; i < instructions.length; i++) {
        ctx.fillText(instructions[i], W / 2, H * 0.5 + i * 24);
      }

      // Click/Tap to start
      const startAlpha = 0.5 + Math.sin(menuTime * 0.005) * 0.5;
      ctx.fillStyle = `rgba(244, 63, 94, ${startAlpha})`;
      ctx.font = 'bold 22px monospace';
      ctx.fillText('Click or Tap to Start', W / 2, H * 0.85);
    }

    function drawPlayer() {
      ctx.save();
      ctx.translate(px, py);

      // Glow
      ctx.shadowColor = ROSE;
      ctx.shadowBlur = 20;

      // Diamond shape
      const size = 14;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = 'rgba(244, 63, 94, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.7, 0);
      ctx.lineTo(0, size * 0.6);
      ctx.lineTo(-size * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Direction indicator
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(playerAngle) * 25, Math.sin(playerAngle) * 25);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    function drawBeam() {
      const beamDir = normalize({ x: mouseX - px, y: mouseY - py });
      // perpendicular computed per-beam in the loop below

      const angles = [0];
      if (hasMultibeam) angles.push(-0.15, 0.15);

      for (const angleOffset of angles) {
        const cos = Math.cos(angleOffset);
        const sin = Math.sin(angleOffset);
        const dirX = beamDir.x * cos - beamDir.y * sin;
        const dirY = beamDir.x * sin + beamDir.y * cos;
        const pX = -dirY;
        const pY = dirX;

        const beamColor = freqToColor(frequency);

        // Glow
        ctx.shadowColor = beamColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = beamColor;
        ctx.lineWidth = BEAM_WIDTH;
        ctx.globalAlpha = 0.7;

        ctx.beginPath();
        const steps = 120;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const dist = t * BEAM_LENGTH;
          const sinVal = Math.sin(dist * frequency * 0.05 + beamTime * 0.008 * frequency) * BEAM_AMPLITUDE * (1 - t * 0.3);
          const bx = px + dirX * dist + pX * sinVal;
          const by = py + dirY * dist + pY * sinVal;
          if (i === 0) ctx.moveTo(bx, by);
          else ctx.lineTo(bx, by);
        }
        ctx.stroke();

        // Brighter core
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = BEAM_WIDTH * 2.5;
        ctx.strokeStyle = beamColor;
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const dist = t * BEAM_LENGTH;
          const sinVal = Math.sin(dist * frequency * 0.05 + beamTime * 0.008 * frequency) * BEAM_AMPLITUDE * (1 - t * 0.3);
          const bx = px + dirX * dist + pX * sinVal;
          const by = py + dirY * dist + pY * sinVal;
          if (i === 0) ctx.moveTo(bx, by);
          else ctx.lineTo(bx, by);
        }
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    function drawEnemies() {
      for (const e of enemies) {
        if (e.dead) continue;

        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);

        // Flash effect
        const isFlashing = e.flashTimer > 0;
        const strokeColor = isFlashing ? '#ffffff' : e.color;
        const fillAlpha = isFlashing ? 0.4 : 0.1;

        // Glow
        ctx.shadowColor = e.color;
        ctx.shadowBlur = isFlashing ? 25 : 10;

        // Draw wireframe shape
        ctx.strokeStyle = strokeColor;
        ctx.fillStyle = `rgba(${hexToRgb(e.color)}, ${fillAlpha})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i <= e.sides; i++) {
          const angle = (i / e.sides) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * e.radius;
          const y = Math.sin(angle) * e.radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.restore();

        // Health bar
        if (e.health < e.maxHealth) {
          const barW = e.radius * 2;
          const barH = 3;
          const barX = e.x - barW / 2;
          const barY = e.y - e.radius - 10;
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.fillRect(barX, barY, barW, barH);
          ctx.fillStyle = e.color;
          ctx.fillRect(barX, barY, barW * (e.health / e.maxHealth), barH);
        }

        // Frequency indicator - pulsing ring
        const pulseScale = 1 + Math.sin(e.pulsePhase) * 0.3;
        const indicatorR = e.radius + 8;
        ctx.strokeStyle = `rgba(${hexToRgb(e.color)}, ${0.3 + Math.sin(e.pulsePhase) * 0.2})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(e.x, e.y, indicatorR * pulseScale, 0, Math.PI * 2);
        ctx.stroke();

        // Scanner: show exact frequency text
        if (hasScanner) {
          ctx.fillStyle = '#e879f9';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`f:${e.frequency.toFixed(1)}`, e.x, e.y + e.radius + 18);
        }
      }
    }

    function drawParticles() {
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 5;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    function drawPowerUps() {
      for (const pu of powerUps) {
        const pulse = 1 + Math.sin(pu.pulsePhase) * 0.2;
        const r = 10 * pulse;
        let color: string;
        let symbol: string;

        switch (pu.type) {
          case 'health':
            color = '#34d399';
            symbol = '+';
            break;
          case 'multibeam':
            color = '#38bdf8';
            symbol = '///';
            break;
          case 'scanner':
            color = '#e879f9';
            symbol = '?';
            break;
        }

        // Fading when about to expire
        const fadeAlpha = pu.life < 2000 ? pu.life / 2000 : 1;
        ctx.globalAlpha = fadeAlpha;

        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pu.x, pu.y, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, pu.x, pu.y);

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
    }

    function drawHUD() {
      // Health bar
      const hbX = 20;
      const hbY = 20;
      const hbW = 160;
      const hbH = 12;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(hbX, hbY, hbW, hbH);
      const healthPct = playerHealth / playerMaxHealth;
      const healthColor = healthPct > 0.5 ? '#34d399' : healthPct > 0.25 ? '#fb923c' : '#ef4444';
      ctx.fillStyle = healthColor;
      ctx.fillRect(hbX, hbY, hbW * healthPct, hbH);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hbX, hbY, hbW, hbH);

      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('HP', hbX, hbY - 4);

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`SCORE: ${score}`, W - 20, 30);

      // Wave
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '14px monospace';
      ctx.fillText(`WAVE ${wave}`, W - 20, 52);

      // Combo
      if (combo > 1) {
        ctx.fillStyle = ROSE;
        ctx.shadowColor = ROSE;
        ctx.shadowBlur = 10;
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`COMBO x${combo}`, W / 2, 30);
        ctx.shadowBlur = 0;
      }

      // Frequency indicator
      drawFrequencyHUD();

      // Power-up indicators
      let puY = 50;
      if (hasMultibeam) {
        ctx.fillStyle = '#38bdf8';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`MULTI-BEAM ${(multibeamTimer / 1000).toFixed(1)}s`, 20, puY);
        puY += 16;
      }
      if (hasScanner) {
        ctx.fillStyle = '#e879f9';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`SCANNER ${(scannerTimer / 1000).toFixed(1)}s`, 20, puY);
      }
    }

    function drawFrequencyHUD() {
      const fhX = W / 2 - 100;
      const fhY = H - 40;
      const fhW = 200;
      const fhH = 8;

      // Background bar
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(fhX, fhY, fhW, fhH);

      // Gradient fill
      const grad = ctx.createLinearGradient(fhX, 0, fhX + fhW, 0);
      grad.addColorStop(0, freqToColor(MIN_FREQ));
      grad.addColorStop(0.33, freqToColor(MIN_FREQ + (MAX_FREQ - MIN_FREQ) * 0.33));
      grad.addColorStop(0.66, freqToColor(MIN_FREQ + (MAX_FREQ - MIN_FREQ) * 0.66));
      grad.addColorStop(1, freqToColor(MAX_FREQ));
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(fhX, fhY, fhW, fhH);
      ctx.globalAlpha = 1;

      // Current frequency marker
      const markerX = fhX + ((frequency - MIN_FREQ) / (MAX_FREQ - MIN_FREQ)) * fhW;
      ctx.fillStyle = freqToColor(frequency);
      ctx.shadowColor = freqToColor(frequency);
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(markerX, fhY - 4);
      ctx.lineTo(markerX + 5, fhY - 10);
      ctx.lineTo(markerX - 5, fhY - 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(markerX - 1, fhY, 2, fhH);
      ctx.shadowBlur = 0;

      // Frequency text
      ctx.fillStyle = freqToColor(frequency);
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`FREQ: ${frequency.toFixed(1)}`, W / 2, fhY - 14);

      // Tiny sine wave preview
      ctx.strokeStyle = freqToColor(frequency);
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60;
        const sx = (W / 2 - 30) + t * 60;
        const sy = fhY + fhH + 14 + Math.sin(t * frequency * 2 + beamTime * 0.008 * frequency) * 5;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Border
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(fhX, fhY, fhW, fhH);
    }

    function drawWaveAnnounce() {
      const alpha = Math.min(1, waveAnnounceTimer / 500) * (waveAnnounceTimer > 1500 ? 1 : waveAnnounceTimer / 1500);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = ROSE;
      ctx.shadowColor = ROSE;
      ctx.shadowBlur = 20;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`WAVE ${wave}`, W / 2, H / 2 - 20);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    function drawGameOver() {
      // Darken
      ctx.fillStyle = 'rgba(10, 10, 15, 0.75)';
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.shadowColor = ROSE;
      ctx.shadowBlur = 30;
      ctx.fillStyle = ROSE;
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, H * 0.3);
      ctx.shadowBlur = 0;

      // Stats
      const stats = [
        `Score: ${finalScore}`,
        `Wave Reached: ${finalWave}`,
        `Max Combo: x${finalMaxCombo}`,
      ];
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '18px monospace';
      for (let i = 0; i < stats.length; i++) {
        ctx.fillText(stats[i], W / 2, H * 0.45 + i * 32);
      }

      // High score
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText(`Best: ${highScore}`, W / 2, H * 0.45 + stats.length * 32 + 10);
      if (newHighScore) {
        ctx.fillStyle = ROSE;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('New High Score!', W / 2, H * 0.45 + stats.length * 32 + 28);
      }

      // Restart
      const restartAlpha = 0.5 + Math.sin(menuTime * 0.005) * 0.5;
      ctx.fillStyle = `rgba(244, 63, 94, ${restartAlpha})`;
      ctx.font = 'bold 20px monospace';
      ctx.fillText('Click or Tap to Restart', W / 2, H * 0.75);
    }

    function hexToRgb(hex: string): string {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return '255,255,255';
      return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
    }

    // ── Game Loop ────────────────────────────────────────────────────────
    function loop(timestamp: number) {
      if (!lastTime) lastTime = timestamp;
      const dt = Math.min(timestamp - lastTime, 50); // cap delta time
      lastTime = timestamp;

      update(dt);
      draw();

      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);

    // ── Cleanup ──────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
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
        cursor: 'crosshair',
        background: BG,
      }}
    />
  );
}
