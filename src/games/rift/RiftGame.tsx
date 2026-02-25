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
const PLAYER_RADIUS = 10;
const TRAIL_BASE_DURATION = 5; // seconds
const TRAIL_BASE_WIDTH = 8;
const RIFT_BASE_WIDTH = 22; // collision detection width
const COMBO_WINDOW = 3; // seconds to maintain combo
const INVULN_TIME = 2; // seconds of invulnerability after hit
const WAVE_DELAY = 2.5; // seconds between waves
const WARP_BULLET_SPEED = 4.5;

// Colors
const CYAN = '#00f0ff';
const CYAN_GLOW = '#00a8cc';
const RED = '#ff3366';
const ORANGE = '#ff8800';
const MAGENTA = '#cc44ff';
const GREEN_T = '#44ff88';
const GOLD = '#ffd700';
const BG = '#08080f';
const GRID_DOT = '#1a1a2f';
const WHITE = '#ffffff';
const DIM = '#667788';

// Enemy config per type
const ENEMY_CONFIG = {
  drone:   { hp: 1, radius: 14, speed: 1.0, fireInterval: 2.0, color: RED,     bulletColor: '#ff4444', bulletRadius: 4, bulletSpeed: 2.8, points: 10 },
  sprayer: { hp: 2, radius: 16, speed: 0.4, fireInterval: 2.8, color: ORANGE,  bulletColor: '#ff7700', bulletRadius: 4, bulletSpeed: 2.4, points: 25 },
  orbiter: { hp: 1, radius: 12, speed: 1.6, fireInterval: 1.4, color: MAGENTA, bulletColor: '#dd44ff', bulletRadius: 3, bulletSpeed: 3.2, points: 30 },
  tank:    { hp: 4, radius: 22, speed: 0.35,fireInterval: 3.0, color: GREEN_T, bulletColor: '#44ff66', bulletRadius: 7, bulletSpeed: 2.0, points: 50 },
} as const;

type EnemyType = keyof typeof ENEMY_CONFIG;
type GameState = 'menu' | 'playing' | 'upgrading' | 'gameover';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

interface Enemy {
  x: number;
  y: number;
  type: EnemyType;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  fireTimer: number;
  fireInterval: number;
  color: string;
  angle: number;
  orbitCx: number;
  orbitCy: number;
  orbitR: number;
  flashTimer: number;
  charging: number; // 0 = not charging, 0→1 = charge progress
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  damage: number;
  canReWarp: boolean;
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

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  size: number;
}

interface WarpEffect {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  type: 'entry' | 'exit';
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dist(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RiftGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let destroyed = false;
    let animId = 0;

    // -------------------------------------------------------------------
    // Mutable game state
    // -------------------------------------------------------------------

    let state: GameState = 'menu';
    let paused = false;

    // Player
    let px = W / 2;
    let py = H / 2;
    let mouseX = W / 2;
    let mouseY = H / 2;
    let lives = 3;
    let maxLives = 3;
    let invulnTimer = 0;

    // Trail
    let trail: TrailPoint[] = [];
    let trailDuration = TRAIL_BASE_DURATION;
    let riftWidth = RIFT_BASE_WIDTH;

    // Entities
    let enemies: Enemy[] = [];
    let enemyBullets: Bullet[] = [];
    let warpedBullets: Bullet[] = [];

    // Effects
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];
    let warpEffects: WarpEffect[] = [];

    // Wave
    let wave = 0;
    let waveTimer = 0;
    let waveActive = false;
    let waveAnnouncTimer = 0;

    // Score
    let score = 0;
    let highScore = getHighScore('rift');
    let totalWarps = 0;
    let totalKills = 0;
    let bestCombo = 0;

    // Combo
    let combo = 0;
    let comboTimer = 0;

    // Upgrades
    let bulletDamage = 1;
    let chainWarp = false;
    let blastRadius = false;
    let echoShot = false;
    let warpSpeedMult = 1;
    let upgradeChoices: Upgrade[] = [];
    let hoveredUpgrade = -1;

    // Animation
    let lastTime = 0;
    let gameTime = 0;
    let menuTime = 0;
    let shakeX = 0;
    let shakeY = 0;
    let shakeTimer = 0;

    // Always-ticking render timer (for animations in all states)
    let renderTime = 0;

    // Demo trail for menu
    let demoAngle = 0;

    // -------------------------------------------------------------------
    // Trail functions
    // -------------------------------------------------------------------

    function addTrailPoint() {
      // Only add if moved enough distance from last point (reduces array size)
      if (trail.length > 0) {
        const last = trail[trail.length - 1];
        const dx = px - last.x;
        const dy = py - last.y;
        if (dx * dx + dy * dy < 9) return; // min 3px distance
      }
      trail.push({ x: px, y: py, time: gameTime });
    }

    function pruneTrail() {
      const cutoff = gameTime - trailDuration;
      while (trail.length > 0 && trail[0].time < cutoff) {
        trail.shift();
      }
    }

    function getTrailAlpha(point: TrailPoint): number {
      const age = gameTime - point.time;
      const ratio = age / trailDuration;
      return clamp(1 - ratio, 0, 1);
    }

    // -------------------------------------------------------------------
    // Spawn helpers
    // -------------------------------------------------------------------

    function spawnEnemy(type: EnemyType) {
      const cfg = ENEMY_CONFIG[type];
      const side = Math.floor(Math.random() * 4);
      let x: number, y: number;
      const margin = 40;
      switch (side) {
        case 0: x = rng(margin, W - margin); y = -margin; break;
        case 1: x = W + margin; y = rng(margin, H - margin); break;
        case 2: x = rng(margin, W - margin); y = H + margin; break;
        default: x = -margin; y = rng(margin, H - margin); break;
      }
      enemies.push({
        x, y,
        type,
        hp: cfg.hp,
        maxHp: cfg.hp,
        radius: cfg.radius,
        speed: cfg.speed,
        fireTimer: rng(0.5, cfg.fireInterval),
        fireInterval: cfg.fireInterval * Math.max(0.45, 1 - wave * 0.03),
        color: cfg.color,
        angle: Math.random() * Math.PI * 2,
        orbitCx: rng(150, W - 150),
        orbitCy: rng(120, H - 120),
        orbitR: rng(70, 130),
        flashTimer: 0,
        charging: 0,
      });
    }

    function spawnWave() {
      wave++;
      waveActive = true;
      waveAnnouncTimer = 1.5;

      const drones = Math.min(3 + wave, 12);
      const sprayers = Math.max(0, Math.floor((wave - 3) * 0.7));
      const orbiters = Math.max(0, Math.floor((wave - 5) * 0.6));
      const tanks = Math.max(0, Math.floor((wave - 8) * 0.35));

      for (let i = 0; i < drones; i++) spawnEnemy('drone');
      for (let i = 0; i < sprayers; i++) spawnEnemy('sprayer');
      for (let i = 0; i < orbiters; i++) spawnEnemy('orbiter');
      for (let i = 0; i < tanks; i++) spawnEnemy('tank');

      SoundEngine.play('waveStart');
    }

    function enemyShoot(enemy: Enemy) {
      const cfg = ENEMY_CONFIG[enemy.type];
      const dx = px - enemy.x;
      const dy = py - enemy.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) return;
      const nx = dx / d;
      const ny = dy / d;
      const speed = cfg.bulletSpeed + wave * 0.04;

      if (enemy.type === 'sprayer') {
        const baseAngle = Math.atan2(ny, nx);
        for (let i = -1; i <= 1; i++) {
          const a = baseAngle + i * 0.28;
          enemyBullets.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
            radius: cfg.bulletRadius, color: cfg.bulletColor,
            damage: 1, canReWarp: false,
          });
        }
      } else {
        enemyBullets.push({
          x: enemy.x, y: enemy.y,
          vx: nx * speed, vy: ny * speed,
          radius: cfg.bulletRadius, color: cfg.bulletColor,
          damage: enemy.type === 'tank' ? 2 : 1, canReWarp: false,
        });
      }
    }

    function spawnParticles(x: number, y: number, color: string, count: number, speed = 3) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + rng(-0.3, 0.3);
        const spd = rng(speed * 0.3, speed);
        particles.push({
          x, y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life: rng(0.3, 0.7),
          maxLife: 0.7,
          color,
          size: rng(2, 5),
        });
      }
    }

    function spawnFloatingText(x: number, y: number, text: string, color: string, size = 16) {
      floatingTexts.push({
        x, y, text, color, size,
        life: 1.2, maxLife: 1.2,
      });
    }

    function spawnWarpPortal(x: number, y: number, type: 'entry' | 'exit') {
      warpEffects.push({ x, y, life: 0.5, maxLife: 0.5, type });
      spawnParticles(x, y, CYAN, 8, 2);
    }

    // -------------------------------------------------------------------
    // Warp mechanic
    // -------------------------------------------------------------------

    function tryWarpBullet(bullet: Bullet, idx: number): boolean {
      if (trail.length < 20) return false;

      // Check every 3rd trail point for performance
      for (let i = 0; i < trail.length; i += 3) {
        const tp = trail[i];
        const alpha = getTrailAlpha(tp);
        if (alpha < 0.15) continue;

        const d = dist(bullet.x, bullet.y, tp.x, tp.y);
        if (d < riftWidth * alpha) {
          // Pick exit point at least 30% of trail length away
          const minOffset = Math.floor(trail.length * 0.3);
          const maxOffset = trail.length - minOffset;
          if (maxOffset <= 0) return false;
          const exitIdx = (i + minOffset + Math.floor(Math.random() * maxOffset)) % trail.length;
          const exit = trail[exitIdx];

          // Find nearest enemy from exit point
          let nearestE: Enemy | null = null;
          let nearestD = Infinity;
          for (const e of enemies) {
            const ed = dist(exit.x, exit.y, e.x, e.y);
            if (ed < nearestD) { nearestD = ed; nearestE = e; }
          }

          const warpSpeed = WARP_BULLET_SPEED * warpSpeedMult;
          let vx: number, vy: number;
          if (nearestE) {
            const ex = nearestE.x - exit.x;
            const ey = nearestE.y - exit.y;
            const ed = Math.sqrt(ex * ex + ey * ey);
            vx = (ex / ed) * warpSpeed;
            vy = (ey / ed) * warpSpeed;
          } else {
            const angle = Math.random() * Math.PI * 2;
            vx = Math.cos(angle) * warpSpeed;
            vy = Math.sin(angle) * warpSpeed;
          }

          warpedBullets.push({
            x: exit.x, y: exit.y,
            vx, vy,
            radius: 5, color: CYAN,
            damage: bulletDamage,
            canReWarp: chainWarp,
          });

          // Echo shot: chance to duplicate
          if (echoShot && Math.random() < 0.3 && enemies.length > 1) {
            const angle2 = Math.atan2(vy, vx) + rng(-0.5, 0.5);
            warpedBullets.push({
              x: exit.x, y: exit.y,
              vx: Math.cos(angle2) * warpSpeed,
              vy: Math.sin(angle2) * warpSpeed,
              radius: 4, color: '#66ffff',
              damage: bulletDamage,
              canReWarp: chainWarp,
            });
          }

          // Spawn portal effects
          spawnWarpPortal(bullet.x, bullet.y, 'entry');
          spawnWarpPortal(exit.x, exit.y, 'exit');

          SoundEngine.play('portalEnter');
          totalWarps++;

          // Remove original bullet
          enemyBullets.splice(idx, 1);
          return true;
        }
      }
      return false;
    }

    // -------------------------------------------------------------------
    // Damage & kill
    // -------------------------------------------------------------------

    function damageEnemy(enemy: Enemy, damage: number) {
      enemy.hp -= damage;
      enemy.flashTimer = 0.15;
      SoundEngine.play('enemyHit');

      if (enemy.hp <= 0) {
        killEnemy(enemy);
      }
    }

    function killEnemy(enemy: Enemy) {
      const cfg = ENEMY_CONFIG[enemy.type];

      // Mark dead immediately to prevent double-kills
      enemy.hp = -999;

      // Particles
      spawnParticles(enemy.x, enemy.y, enemy.color, 18, 4);

      // Combo
      combo++;
      comboTimer = COMBO_WINDOW;
      if (combo > bestCombo) bestCombo = combo;
      if (combo >= 3) SoundEngine.play('comboUp');

      // Score
      const multiplier = Math.max(1, combo);
      const points = cfg.points * multiplier;
      score += points;
      totalKills++;

      spawnFloatingText(
        enemy.x, enemy.y - 20,
        combo > 1 ? `+${points} x${combo}` : `+${points}`,
        combo >= 5 ? GOLD : combo >= 3 ? CYAN : WHITE,
        combo >= 5 ? 22 : combo >= 3 ? 18 : 14,
      );

      // Screen shake
      shakeTimer = 0.2 + Math.min(combo * 0.05, 0.3);

      SoundEngine.play('enemyDeath');

      // Blast radius upgrade: damage nearby enemies (deferred kills to avoid array corruption)
      if (blastRadius) {
        const toKill: Enemy[] = [];
        for (const other of enemies) {
          if (other.hp <= 0) continue;
          const d = dist(enemy.x, enemy.y, other.x, other.y);
          if (d < 60) {
            other.hp -= 1;
            other.flashTimer = 0.15;
            SoundEngine.play('enemyHit');
            if (other.hp <= 0) toKill.push(other);
          }
        }
        for (const e of toKill) killEnemy(e);
      }
    }

    function removeDeadEnemies() {
      for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].hp <= 0) enemies.splice(i, 1);
      }
    }

    function hitPlayer() {
      if (invulnTimer > 0) return;
      lives--;
      invulnTimer = INVULN_TIME;
      shakeTimer = 0.4;
      SoundEngine.play('playerDamage');
      spawnParticles(px, py, '#ff0000', 12, 3);

      if (lives <= 0) {
        endGame();
      }
    }

    // -------------------------------------------------------------------
    // Wave management
    // -------------------------------------------------------------------

    function checkWaveClear() {
      if (!waveActive) return;
      if (enemies.length === 0) {
        waveActive = false;
        waveTimer = WAVE_DELAY;

        // Clear all remaining bullets
        enemyBullets.length = 0;

        const waveBonus = wave * 50;
        score += waveBonus;
        spawnFloatingText(W / 2, H / 2 - 40, `WAVE ${wave} CLEARED! +${waveBonus}`, GOLD, 24);
        SoundEngine.play('waveClear');

        // Upgrade every 5 waves
        if (wave % 5 === 0) {
          waveTimer = 999; // don't auto-start; wait for upgrade selection
          generateUpgrades();
        }
      }
    }

    // -------------------------------------------------------------------
    // Upgrade system
    // -------------------------------------------------------------------

    function generateUpgrades() {
      const pool: Upgrade[] = [
        {
          id: 'trail-extend',
          title: 'Longer Trail',
          description: `Trail lasts +2s (${trailDuration.toFixed(0)}s → ${(trailDuration + 2).toFixed(0)}s)`,
          icon: '~',
          apply: () => { trailDuration += 2; },
        },
        {
          id: 'wider-rift',
          title: 'Wider Rift',
          description: `Rift field +8px (${riftWidth.toFixed(0)} → ${riftWidth + 8})`,
          icon: '{ }',
          apply: () => { riftWidth += 8; },
        },
        {
          id: 'bullet-amp',
          title: 'Bullet Amp',
          description: `Warped bullet damage +1 (${bulletDamage} → ${bulletDamage + 1})`,
          icon: '^',
          apply: () => { bulletDamage += 1; },
        },
        {
          id: 'chain-warp',
          title: 'Chain Warp',
          description: 'Warped bullets can re-enter the rift',
          icon: '>>',
          apply: () => { chainWarp = true; },
        },
        {
          id: 'blast-radius',
          title: 'Blast Radius',
          description: 'Enemy deaths damage nearby enemies',
          icon: '*',
          apply: () => { blastRadius = true; },
        },
        {
          id: 'echo-shot',
          title: 'Echo Shot',
          description: '30% chance to duplicate warped bullets',
          icon: '||',
          apply: () => { echoShot = true; },
        },
        {
          id: 'extra-life',
          title: 'Extra Life',
          description: `+1 life (${lives} → ${lives + 1})`,
          icon: '+',
          apply: () => { lives++; maxLives++; },
        },
        {
          id: 'swift-bullets',
          title: 'Swift Rifts',
          description: `Warped bullets +25% faster (${(warpSpeedMult * 100).toFixed(0)}% → ${(warpSpeedMult * 125).toFixed(0)}%)`,
          icon: '>>>',
          apply: () => { warpSpeedMult *= 1.25; },
        },
      ];

      // Remove already-acquired one-time upgrades
      const filtered = pool.filter(u => {
        if (u.id === 'chain-warp' && chainWarp) return false;
        if (u.id === 'blast-radius' && blastRadius) return false;
        if (u.id === 'echo-shot' && echoShot) return false;
        return true;
      });

      // Pick 3 random
      const shuffled = filtered.sort(() => Math.random() - 0.5);
      upgradeChoices = shuffled.slice(0, 3);
      state = 'upgrading';
      hoveredUpgrade = -1;
    }

    function selectUpgrade(index: number) {
      if (index < 0 || index >= upgradeChoices.length) return;
      upgradeChoices[index].apply();
      SoundEngine.play('collectPowerup');
      upgradeChoices = [];
      state = 'playing';
      waveTimer = 1.5;
    }

    // -------------------------------------------------------------------
    // Game lifecycle
    // -------------------------------------------------------------------

    function startGame() {
      state = 'playing';
      paused = false;
      px = W / 2;
      py = H / 2;
      mouseX = W / 2;
      mouseY = H / 2;
      lives = 3;
      maxLives = 3;
      invulnTimer = 0;
      trail = [];
      enemies = [];
      enemyBullets = [];
      warpedBullets = [];
      particles = [];
      floatingTexts = [];
      warpEffects = [];
      wave = 0;
      waveTimer = 1.0;
      waveActive = false;
      waveAnnouncTimer = 0;
      score = 0;
      totalWarps = 0;
      totalKills = 0;
      bestCombo = 0;
      combo = 0;
      comboTimer = 0;
      bulletDamage = 1;
      chainWarp = false;
      blastRadius = false;
      echoShot = false;
      warpSpeedMult = 1;
      upgradeChoices = [];
      gameTime = 0;
      shakeTimer = 0;

      highScore = getHighScore('rift');
      reportGameStart('rift');
      SoundEngine.startAmbient('synth-combat');
    }

    function endGame() {
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        setHighScore('rift', score);
        SoundEngine.play('newHighScore');
      }
      SoundEngine.play('gameOver');
      SoundEngine.stopAmbient();
      reportGameEnd('rift', score, false, wave);
    }

    // -------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------

    function update(dt: number) {
      renderTime += dt;

      if (state === 'menu') {
        menuTime += dt;
        demoAngle += dt * 0.8;
        return;
      }

      if (state === 'gameover') {
        // Just update particles
        updateParticles(dt);
        return;
      }

      if (state === 'upgrading') {
        updateParticles(dt);
        return;
      }

      if (paused) return;

      gameTime += dt;

      // Player movement
      const lerpFactor = 1 - Math.pow(0.00001, dt);
      px = lerp(px, mouseX, lerpFactor);
      py = lerp(py, mouseY, lerpFactor);
      px = clamp(px, PLAYER_RADIUS, W - PLAYER_RADIUS);
      py = clamp(py, PLAYER_RADIUS, H - PLAYER_RADIUS);

      // Invulnerability
      if (invulnTimer > 0) invulnTimer -= dt;

      // Trail
      addTrailPoint();
      pruneTrail();

      // Wave timing
      if (!waveActive && waveTimer > 0) {
        waveTimer -= dt;
        if (waveTimer <= 0) {
          spawnWave();
        }
      }
      if (waveAnnouncTimer > 0) waveAnnouncTimer -= dt;

      // Update enemies
      const CHARGE_DURATION = 0.35;
      for (const enemy of enemies) {
        updateEnemy(enemy, dt);

        // Fire with charge-up indicator
        enemy.fireTimer -= dt;
        if (enemy.fireTimer <= CHARGE_DURATION && enemy.fireTimer > 0) {
          enemy.charging = 1 - (enemy.fireTimer / CHARGE_DURATION);
        } else if (enemy.fireTimer <= 0) {
          enemy.fireTimer = enemy.fireInterval;
          enemy.charging = 0;
          const d = dist(px, py, enemy.x, enemy.y);
          if (d < 600) {
            enemyShoot(enemy);
          }
        } else {
          enemy.charging = 0;
        }

        // Flash decay
        if (enemy.flashTimer > 0) enemy.flashTimer -= dt;
      }

      // Update enemy bullets
      for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        b.x += b.vx * dt * 60;
        b.y += b.vy * dt * 60;

        // Off screen
        if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50) {
          enemyBullets.splice(i, 1);
          continue;
        }

        // Check warp
        if (tryWarpBullet(b, i)) continue;

        // Check player collision
        if (dist(b.x, b.y, px, py) < b.radius + PLAYER_RADIUS) {
          enemyBullets.splice(i, 1);
          hitPlayer();
        }
      }

      // Update warped bullets
      for (let i = warpedBullets.length - 1; i >= 0; i--) {
        const b = warpedBullets[i];
        b.x += b.vx * dt * 60;
        b.y += b.vy * dt * 60;

        // Off screen
        if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50) {
          warpedBullets.splice(i, 1);
          continue;
        }

        // Chain warp: warped bullets can re-enter trail
        if (chainWarp && b.canReWarp && trail.length > 20) {
          for (let j = 0; j < trail.length; j += 5) {
            const tp = trail[j];
            if (dist(b.x, b.y, tp.x, tp.y) < riftWidth * 0.5) {
              // Re-warp: pick new exit and target
              const exitIdx = (j + Math.floor(trail.length * 0.4)) % trail.length;
              const exit = trail[exitIdx];
              let nearestE: Enemy | null = null;
              let nearestD = Infinity;
              for (const e of enemies) {
                const ed = dist(exit.x, exit.y, e.x, e.y);
                if (ed < nearestD) { nearestD = ed; nearestE = e; }
              }
              if (nearestE) {
                const ex = nearestE.x - exit.x;
                const ey = nearestE.y - exit.y;
                const ed = Math.sqrt(ex * ex + ey * ey);
                b.x = exit.x;
                b.y = exit.y;
                b.vx = (ex / ed) * WARP_BULLET_SPEED;
                b.vy = (ey / ed) * WARP_BULLET_SPEED;
                b.canReWarp = false; // only one re-warp
                spawnWarpPortal(exit.x, exit.y, 'exit');
                SoundEngine.play('portalEnter');
                totalWarps++;
              }
              break;
            }
          }
        }

        // Check enemy collision
        let hitSomething = false;
        for (const enemy of enemies) {
          if (enemy.hp <= 0) continue;
          if (dist(b.x, b.y, enemy.x, enemy.y) < b.radius + enemy.radius) {
            damageEnemy(enemy, b.damage);
            hitSomething = true;
            break;
          }
        }
        if (hitSomething) {
          warpedBullets.splice(i, 1);
        }
      }

      // Combo decay
      if (comboTimer > 0) {
        comboTimer -= dt;
        if (comboTimer <= 0) {
          combo = 0;
        }
      }

      // Screen shake decay
      if (shakeTimer > 0) {
        shakeTimer -= dt;
        const intensity = shakeTimer * 8;
        shakeX = rng(-intensity, intensity);
        shakeY = rng(-intensity, intensity);
      } else {
        shakeX = 0;
        shakeY = 0;
      }

      // Enemy contact damage
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        if (dist(px, py, enemy.x, enemy.y) < PLAYER_RADIUS + enemy.radius * 0.6) {
          hitPlayer();
          break;
        }
      }

      // Remove dead enemies (deferred from killEnemy)
      removeDeadEnemies();

      // Update effects
      updateParticles(dt);
      updateFloatingTexts(dt);
      updateWarpEffects(dt);

      // Check wave clear
      checkWaveClear();
    }

    function updateEnemy(enemy: Enemy, dt: number) {
      switch (enemy.type) {
        case 'drone': {
          const dx = px - enemy.x;
          const dy = py - enemy.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 180) {
            enemy.x += (dx / d) * enemy.speed * 60 * dt;
            enemy.y += (dy / d) * enemy.speed * 60 * dt;
          }
          break;
        }
        case 'sprayer': {
          const cx = W / 2 + Math.sin(gameTime * 0.3 + enemy.angle) * 100;
          const cy = H / 2 + Math.cos(gameTime * 0.2 + enemy.angle) * 80;
          const dx = cx - enemy.x;
          const dy = cy - enemy.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 30) {
            enemy.x += (dx / d) * enemy.speed * 60 * dt;
            enemy.y += (dy / d) * enemy.speed * 60 * dt;
          }
          break;
        }
        case 'orbiter': {
          enemy.angle += enemy.speed * dt;
          enemy.x = enemy.orbitCx + Math.cos(enemy.angle) * enemy.orbitR;
          enemy.y = enemy.orbitCy + Math.sin(enemy.angle) * enemy.orbitR;
          break;
        }
        case 'tank': {
          const dx = px - enemy.x;
          const dy = py - enemy.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 160) {
            enemy.x += (dx / d) * enemy.speed * 60 * dt;
            enemy.y += (dy / d) * enemy.speed * 60 * dt;
          }
          break;
        }
      }

      // Clamp to screen area (with padding)
      enemy.x = clamp(enemy.x, -30, W + 30);
      enemy.y = clamp(enemy.y, -30, H + 30);
    }

    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    function updateFloatingTexts(dt: number) {
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const t = floatingTexts[i];
        t.y -= 30 * dt;
        t.life -= dt;
        if (t.life <= 0) floatingTexts.splice(i, 1);
      }
    }

    function updateWarpEffects(dt: number) {
      for (let i = warpEffects.length - 1; i >= 0; i--) {
        warpEffects[i].life -= dt;
        if (warpEffects[i].life <= 0) warpEffects.splice(i, 1);
      }
    }

    // -------------------------------------------------------------------
    // Render
    // -------------------------------------------------------------------

    function render() {
      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Background
      ctx.fillStyle = BG;
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Grid dots
      ctx.fillStyle = GRID_DOT;
      for (let x = 20; x < W; x += 40) {
        for (let y = 20; y < H; y += 40) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (state === 'menu') {
        renderMenu();
        ctx.restore();
        return;
      }

      // Trail
      renderTrail();

      // Warp effects
      for (const w of warpEffects) {
        const progress = 1 - w.life / w.maxLife;
        const radius = w.type === 'entry' ? progress * 30 : (1 - progress) * 30;
        const alpha = w.type === 'entry' ? 1 - progress : progress * 0.8;
        ctx.beginPath();
        ctx.arc(w.x, w.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.7})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Inner glow
        ctx.beginPath();
        ctx.arc(w.x, w.y, radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${alpha * 0.3})`;
        ctx.fill();
      }

      // Off-screen enemy indicators
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        if (enemy.x >= 0 && enemy.x <= W && enemy.y >= 0 && enemy.y <= H) continue;
        const angle = Math.atan2(enemy.y - H / 2, enemy.x - W / 2);
        const edgeX = clamp(enemy.x, 14, W - 14);
        const edgeY = clamp(enemy.y, 14, H - 14);
        ctx.save();
        ctx.translate(edgeX, edgeY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-4, -5);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fillStyle = `${enemy.color}99`;
        ctx.fill();
        ctx.restore();
      }

      // Enemies
      for (const enemy of enemies) {
        if (enemy.hp <= 0) continue;
        renderEnemy(enemy);
      }

      // Enemy bullets
      for (const b of enemyBullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        // Glow
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = `${b.color}33`;
        ctx.fill();
      }

      // Warped bullets
      for (const b of warpedBullets) {
        // Glow trail
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.15)';
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fillStyle = b.color;
        ctx.fill();
        // Bright center
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
      }

      // Player
      renderPlayer();

      // Particles
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Floating texts
      for (const t of floatingTexts) {
        const alpha = t.life / t.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = t.color;
        ctx.font = `bold ${t.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.globalAlpha = 1;

      // HUD
      renderHUD();

      // Wave announcement
      if (waveAnnouncTimer > 0 && state === 'playing') {
        const alpha = Math.min(waveAnnouncTimer / 0.5, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`WAVE ${wave}`, W / 2, H / 2 - 20);
        ctx.font = '14px monospace';
        ctx.fillStyle = DIM;
        ctx.fillText(`${enemies.length} enemies`, W / 2, H / 2 + 15);
        ctx.globalAlpha = 1;
      }

      // Pause overlay
      if (paused) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAUSED', W / 2, H / 2 - 10);
        ctx.font = '14px monospace';
        ctx.fillStyle = DIM;
        ctx.fillText('Press P to resume', W / 2, H / 2 + 25);
      }

      // Upgrade screen
      if (state === 'upgrading') {
        renderUpgradeScreen();
      }

      // Game over screen
      if (state === 'gameover') {
        renderGameOver();
      }

      ctx.restore();
    }

    function renderTrail() {
      if (trail.length < 2) return;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw trail segments with per-segment fading alpha
      // Distance threshold keeps point count low enough for per-segment rendering
      for (let i = 1; i < trail.length; i++) {
        const p0 = trail[i - 1];
        const p1 = trail[i];
        const alpha = (getTrailAlpha(p0) + getTrailAlpha(p1)) / 2;
        if (alpha < 0.05) continue;

        // Outer glow
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.12})`;
        ctx.lineWidth = TRAIL_BASE_WIDTH + 14;
        ctx.stroke();

        // Mid layer
        ctx.strokeStyle = `rgba(0, 200, 240, ${alpha * 0.35})`;
        ctx.lineWidth = TRAIL_BASE_WIDTH + 4;
        ctx.stroke();

        // Core
        ctx.strokeStyle = `rgba(150, 255, 255, ${alpha * 0.7})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Trail sparkle particles (subtle energy shimmer)
      for (let i = 0; i < trail.length; i += 8) {
        const tp = trail[i];
        const alpha = getTrailAlpha(tp);
        if (alpha < 0.2) continue;
        const sparkle = Math.sin(gameTime * 8 + i * 0.7) * 0.5 + 0.5;
        if (sparkle > 0.65) {
          ctx.beginPath();
          ctx.arc(tp.x + Math.sin(i) * 3, tp.y + Math.cos(i) * 3, 1.5 * sparkle, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(200, 255, 255, ${alpha * sparkle * 0.6})`;
          ctx.fill();
        }
      }

      // Rift width indicators (subtle edge glow when rift is upgraded)
      if (riftWidth > RIFT_BASE_WIDTH) {
        for (let i = 0; i < trail.length; i += 20) {
          const tp = trail[i];
          const alpha = getTrailAlpha(tp) * 0.08;
          if (alpha < 0.02) continue;
          ctx.beginPath();
          ctx.arc(tp.x, tp.y, riftWidth, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0, 240, 255, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    function renderPlayer() {
      // Invulnerability flash
      if (invulnTimer > 0 && Math.floor(invulnTimer * 10) % 2 === 0) return;

      const pulse = 1 + Math.sin(gameTime * 4) * 0.1;

      // Outer glow
      const grad = ctx.createRadialGradient(px, py, 0, px, py, PLAYER_RADIUS * 3 * pulse);
      grad.addColorStop(0, 'rgba(0, 240, 255, 0.3)');
      grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, PLAYER_RADIUS * 3 * pulse, 0, Math.PI * 2);
      ctx.fill();

      // Main body
      ctx.beginPath();
      ctx.arc(px, py, PLAYER_RADIUS * pulse, 0, Math.PI * 2);
      ctx.fillStyle = CYAN;
      ctx.fill();

      // Inner bright core
      ctx.beginPath();
      ctx.arc(px, py, PLAYER_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    function renderEnemy(enemy: Enemy) {
      const flashAlpha = enemy.flashTimer > 0 ? 0.8 : 0;
      const pulse = 1 + Math.sin(gameTime * 3 + enemy.angle) * 0.05;

      // Glow
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `${enemy.color}22`;
      ctx.fill();

      // Body
      ctx.beginPath();
      if (enemy.type === 'drone') {
        // Diamond shape
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(gameTime * 2 + enemy.angle);
        const r = enemy.radius * pulse;
        ctx.moveTo(0, -r);
        ctx.lineTo(r * 0.7, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r * 0.7, 0);
        ctx.closePath();
        ctx.restore();
      } else if (enemy.type === 'sprayer') {
        // Hexagon
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(gameTime * 0.5);
        const r = enemy.radius * pulse;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.restore();
      } else if (enemy.type === 'orbiter') {
        // Triangle
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(gameTime * 3);
        const r = enemy.radius * pulse;
        for (let i = 0; i < 3; i++) {
          const a = (Math.PI * 2 * i) / 3 - Math.PI / 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.restore();
      } else {
        // Tank: square
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        ctx.rotate(gameTime * 0.3);
        const r = enemy.radius * pulse;
        ctx.rect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }
      ctx.fillStyle = enemy.color;
      ctx.fill();

      // Flash overlay
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fill();
      }

      // HP bar for multi-hp enemies
      if (enemy.maxHp > 1) {
        const barW = enemy.radius * 2;
        const barH = 3;
        const barX = enemy.x - barW / 2;
        const barY = enemy.y - enemy.radius - 8;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = enemy.color;
        ctx.fillRect(barX, barY, barW * (enemy.hp / enemy.maxHp), barH);
      }

      // Charging indicator (pulsing ring before firing)
      if (enemy.charging > 0) {
        const chargeR = enemy.radius + 6 + enemy.charging * 4;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, chargeR, 0, Math.PI * 2 * enemy.charging);
        ctx.strokeStyle = `rgba(255, 255, 100, ${0.3 + enemy.charging * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    function renderHUD() {
      // Score
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${score}`, 16, 32);

      // High score
      ctx.fillStyle = DIM;
      ctx.font = '11px monospace';
      ctx.fillText(`BEST ${highScore}`, 16, 48);

      // Wave
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`WAVE ${wave}`, W - 16, 28);

      // Enemies remaining
      if (waveActive) {
        ctx.fillStyle = DIM;
        ctx.font = '11px monospace';
        ctx.fillText(`${enemies.length} remaining`, W - 16, 44);
      }

      // Lives (hearts)
      ctx.textAlign = 'left';
      ctx.font = '16px monospace';
      for (let i = 0; i < maxLives; i++) {
        ctx.fillStyle = i < lives ? '#ff4466' : '#333344';
        ctx.fillText('\u2665', 16 + i * 22, H - 16);
      }

      // Combo
      if (combo >= 2) {
        const scale = Math.min(1 + combo * 0.1, 2);
        ctx.fillStyle = combo >= 5 ? GOLD : CYAN;
        ctx.font = `bold ${Math.floor(16 * scale)}px monospace`;
        ctx.textAlign = 'center';
        const comboAlpha = Math.min(comboTimer / 0.5, 1);
        ctx.globalAlpha = comboAlpha;
        ctx.fillText(`x${combo} COMBO`, W / 2, H - 20);
        ctx.globalAlpha = 1;
      }

      // Warps counter
      ctx.fillStyle = CYAN_GLOW;
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`WARPS: ${totalWarps}`, W - 16, H - 16);
    }

    function renderMenu() {
      // Animated demo trail (figure-8 pattern)
      const demoTrail: { x: number; y: number }[] = [];
      for (let i = 0; i < 120; i++) {
        const t = demoAngle - i * 0.05;
        const dx = Math.sin(t) * 180;
        const dy = Math.sin(t * 2) * 80;
        demoTrail.push({ x: W / 2 + dx, y: H / 2 + 30 + dy });
      }
      // Draw demo trail
      ctx.lineCap = 'round';
      for (let i = 1; i < demoTrail.length; i++) {
        const alpha = 1 - i / demoTrail.length;
        ctx.beginPath();
        ctx.moveTo(demoTrail[i - 1].x, demoTrail[i - 1].y);
        ctx.lineTo(demoTrail[i].x, demoTrail[i].y);
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.25})`;
        ctx.lineWidth = 12;
        ctx.stroke();
        ctx.strokeStyle = `rgba(0, 240, 255, ${alpha * 0.5})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = `rgba(200, 255, 255, ${alpha * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // Demo orb
      if (demoTrail.length > 0) {
        const head = demoTrail[0];
        const grad = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 25);
        grad.addColorStop(0, 'rgba(0, 240, 255, 0.4)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 25, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = CYAN;
        ctx.fill();
      }

      // Simulated enemy bullets hitting trail and warping
      const t = menuTime;
      for (let i = 0; i < 3; i++) {
        const phase = t * 1.2 + i * 2.1;
        const mod = phase % 4;
        if (mod < 2) {
          // Bullet approaching trail
          const bx = W / 2 + 250 - mod * 120;
          const by = H / 2 + 30 + Math.sin(phase) * 40;
          ctx.beginPath();
          ctx.arc(bx, by, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ff4444';
          ctx.fill();
        } else {
          // Warped bullet leaving trail
          const bx = W / 2 - 200 + (mod - 2) * 120;
          const by = H / 2 + 30 + Math.cos(phase * 1.5) * 50;
          ctx.beginPath();
          ctx.arc(bx, by, 5, 0, Math.PI * 2);
          ctx.fillStyle = CYAN;
          ctx.fill();
        }
      }

      // Title
      ctx.fillStyle = CYAN;
      ctx.font = 'bold 72px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Title glow
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 30;
      ctx.fillText('RIFT', W / 2, 110);
      ctx.shadowBlur = 0;

      // Subtitle
      ctx.fillStyle = DIM;
      ctx.font = '16px monospace';
      ctx.fillText('Redirect. Reflect. Survive.', W / 2, 155);

      // Explanation
      ctx.fillStyle = '#99aabb';
      ctx.font = '13px monospace';
      const lines = [
        'Your movement leaves a dimensional rift.',
        'Enemy bullets that touch your trail warp through it',
        'and redirect toward enemies.',
        '',
        'Your trail is your ONLY weapon.',
      ];
      lines.forEach((line, i) => {
        ctx.fillText(line, W / 2, 210 + i * 22);
      });

      // Controls
      ctx.fillStyle = DIM;
      ctx.font = '12px monospace';
      ctx.fillText('Mouse = Move  |  P = Pause  |  M = Mute', W / 2, H - 70);

      // Start prompt
      const pulse = 0.5 + Math.sin(menuTime * 3) * 0.5;
      ctx.fillStyle = `rgba(0, 240, 255, ${0.4 + pulse * 0.6})`;
      ctx.font = 'bold 18px monospace';
      ctx.fillText('Click to Start', W / 2, H - 35);

      ctx.textBaseline = 'alphabetic';
    }

    function renderUpgradeScreen() {
      // Dim background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.fillStyle = GOLD;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CHOOSE UPGRADE', W / 2, 100);

      ctx.fillStyle = DIM;
      ctx.font = '13px monospace';
      ctx.fillText(`Wave ${wave} complete`, W / 2, 130);

      // Cards
      const cardW = 200;
      const cardH = 160;
      const gap = 30;
      const totalW = upgradeChoices.length * cardW + (upgradeChoices.length - 1) * gap;
      const startX = (W - totalW) / 2;
      const cardY = 180;

      for (let i = 0; i < upgradeChoices.length; i++) {
        const u = upgradeChoices[i];
        const cx = startX + i * (cardW + gap);
        const hovered = hoveredUpgrade === i;

        // Card background
        ctx.fillStyle = hovered ? '#1a1a2f' : '#111122';
        ctx.strokeStyle = hovered ? CYAN : '#334455';
        ctx.lineWidth = hovered ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(cx, cardY, cardW, cardH, 8);
        ctx.fill();
        ctx.stroke();

        // Hover glow
        if (hovered) {
          ctx.shadowColor = CYAN;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = CYAN;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        // Icon
        ctx.fillStyle = CYAN;
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(u.icon, cx + cardW / 2, cardY + 40);

        // Title
        ctx.fillStyle = WHITE;
        ctx.font = 'bold 14px monospace';
        ctx.fillText(u.title, cx + cardW / 2, cardY + 70);

        // Description (word wrap)
        ctx.fillStyle = DIM;
        ctx.font = '11px monospace';
        const words = u.description.split(' ');
        let line = '';
        let lineY = cardY + 95;
        for (const word of words) {
          const test = line + (line ? ' ' : '') + word;
          if (ctx.measureText(test).width > cardW - 24) {
            ctx.fillText(line, cx + cardW / 2, lineY);
            line = word;
            lineY += 15;
          } else {
            line = test;
          }
        }
        ctx.fillText(line, cx + cardW / 2, lineY);

        // Keyboard shortcut hint
        ctx.fillStyle = hovered ? CYAN : '#445566';
        ctx.font = '10px monospace';
        ctx.fillText(`[${i + 1}]`, cx + cardW / 2, cardY + cardH - 10);
      }
    }

    function renderGameOver() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';

      // Title
      ctx.fillStyle = RED;
      ctx.font = 'bold 42px monospace';
      ctx.shadowColor = RED;
      ctx.shadowBlur = 20;
      ctx.fillText('GAME OVER', W / 2, 140);
      ctx.shadowBlur = 0;

      // Score
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 28px monospace';
      ctx.fillText(`${score}`, W / 2, 210);
      ctx.fillStyle = DIM;
      ctx.font = '13px monospace';
      if (score >= highScore && score > 0) {
        ctx.fillStyle = GOLD;
        ctx.fillText('NEW HIGH SCORE!', W / 2, 235);
      } else {
        ctx.fillText(`Best: ${highScore}`, W / 2, 235);
      }

      // Stats
      ctx.fillStyle = '#99aabb';
      ctx.font = '14px monospace';
      const stats = [
        `Waves: ${wave}`,
        `Kills: ${totalKills}`,
        `Warps: ${totalWarps}`,
        `Best Combo: x${bestCombo}`,
      ];
      stats.forEach((s, i) => {
        ctx.fillText(s, W / 2, 290 + i * 26);
      });

      // Retry prompt
      const pulse = 0.5 + Math.sin(renderTime * 3) * 0.5;
      ctx.fillStyle = `rgba(0, 240, 255, ${0.4 + pulse * 0.6})`;
      ctx.font = 'bold 16px monospace';
      ctx.fillText('Click to play again', W / 2, H - 60);
    }

    // -------------------------------------------------------------------
    // Game loop
    // -------------------------------------------------------------------

    function loop(timestamp: number) {
      if (destroyed) return;

      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      update(dt);
      render();

      animId = requestAnimationFrame(loop);
    }

    // -------------------------------------------------------------------
    // Input handling
    // -------------------------------------------------------------------

    function getCanvasPos(e: MouseEvent | Touch): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function onMouseMove(e: MouseEvent) {
      const pos = getCanvasPos(e);
      mouseX = pos.x;
      mouseY = pos.y;
      // Upgrade hover detection
      if (state === 'upgrading') {
        const cardW = 200;
        const cardH = 160;
        const gap = 30;
        const totalW = upgradeChoices.length * cardW + (upgradeChoices.length - 1) * gap;
        const startX = (W - totalW) / 2;
        const cardY = 180;

        hoveredUpgrade = -1;
        for (let i = 0; i < upgradeChoices.length; i++) {
          const cx = startX + i * (cardW + gap);
          if (pos.x >= cx && pos.x <= cx + cardW && pos.y >= cardY && pos.y <= cardY + cardH) {
            hoveredUpgrade = i;
            break;
          }
        }
      }
    }

    function onClick(e: MouseEvent) {
      const pos = getCanvasPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      if (state === 'menu') {
        startGame();
        return;
      }

      if (state === 'gameover') {
        startGame();
        return;
      }

      if (state === 'upgrading' && hoveredUpgrade >= 0) {
        selectUpgrade(hoveredUpgrade);
        return;
      }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = getCanvasPos(e.touches[0]);
        mouseX = pos.x;
        mouseY = pos.y;

        if (state === 'menu') { startGame(); return; }
        if (state === 'gameover') { startGame(); return; }
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = getCanvasPos(e.touches[0]);
        mouseX = pos.x;
        mouseY = pos.y;
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (state === 'playing') {
          paused = !paused;
        }
      }

      // Upgrade selection via number keys
      if (state === 'upgrading') {
        const num = parseInt(e.key);
        if (num >= 1 && num <= upgradeChoices.length) {
          selectUpgrade(num - 1);
        }
      }
    }

    // Attach event listeners
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onClick);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    // Start loop
    lastTime = performance.now();
    animId = requestAnimationFrame(loop);

    // Cleanup
    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('click', onClick);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
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
