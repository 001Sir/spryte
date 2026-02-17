'use client';

import { useRef, useEffect } from 'react';
import { SoundEngine } from '@/lib/sounds';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Vec2 {
  x: number;
  y: number;
}

interface Planet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  color: string;
  glowColor: string;
  name: string;
  trail: Vec2[];
  stabilityHistory: number[];
  stability: number;
  alive: boolean;
  minDist: number;
  maxDist: number;
  distSamples: number[];
}

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  life: number;
  maxLife: number;
  vertices: Vec2[];
}

interface SolarFlare {
  angle: number;
  life: number;
  maxLife: number;
  strength: number;
}

interface Star {
  x: number;
  y: number;
  brightness: number;
  twinkleSpeed: number;
  twinkleOffset: number;
  size: number;
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

type GameState = 'menu' | 'playing' | 'gameover';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const W = 800;
const H = 600;
const CX = W / 2;
const CY = H / 2;
const G = 8000; // Gravitational constant (tuned for gameplay)
const SUN_MASS = 500;
const SUN_RADIUS = 30;
const DT = 1 / 60;
const TRAIL_LENGTH = 120;
const PREDICT_STEPS = 150;
const SKY_BLUE = '#0ea5e9';
const BG_COLOR = '#0a0a0f';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function createIrregularShape(radius: number, vertices: number): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i < vertices; i++) {
    const angle = (i / vertices) * Math.PI * 2;
    const r = radius * (0.6 + Math.random() * 0.8);
    points.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
  }
  return points;
}

// Circular orbit speed at distance r from sun
function circularOrbitSpeed(r: number): number {
  return Math.sqrt((G * SUN_MASS) / r);
}

// Planet templates
const PLANET_TEMPLATES = [
  { color: '#3b82f6', glowColor: '#60a5fa', name: 'Terra', radius: 10, mass: 1 },
  { color: '#ef4444', glowColor: '#f87171', name: 'Ignis', radius: 8, mass: 0.8 },
  { color: '#f97316', glowColor: '#fb923c', name: 'Gigas', radius: 14, mass: 2 },
  { color: '#6366f1', glowColor: '#818cf8', name: 'Glacius', radius: 11, mass: 1.2 },
  { color: '#10b981', glowColor: '#34d399', name: 'Verdis', radius: 9, mass: 0.9 },
  { color: '#ec4899', glowColor: '#f472b6', name: 'Rosea', radius: 7, mass: 0.7 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrbitKeeperGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // -----------------------------------------------------------------------
    // Game State Variables (all inside useEffect closure)
    // -----------------------------------------------------------------------

    let state: GameState = 'menu';
    let animId = 0;
    let lastTime = 0;
    let paused = false;

    // ── High Score helpers ──
    function getHighScore(gameSlug: string): number {
      try {
        const val = localStorage.getItem(`spryte-highscore-${gameSlug}`);
        return val ? parseInt(val, 10) || 0 : 0;
      } catch { return 0; }
    }
    function setHighScoreVal(gameSlug: string, s: number) {
      try {
        localStorage.setItem(`spryte-highscore-${gameSlug}`, String(s));
      } catch { /* ignore */ }
    }
    let highScore = getHighScore('orbit-keeper');
    let newHighScore = false;

    // Playing state
    let planets: Planet[] = [];
    let asteroids: Asteroid[] = [];
    let solarFlares: SolarFlare[] = [];
    let particles: Particle[] = [];
    let level = 1;
    let score = 0;
    let levelTimer = 0; // seconds remaining
    let totalOrbitsStabilized = 0;
    let interventions = 0;
    let perturbationTimer = 0;
    let eventMessage = '';
    let eventMessageTimer = 0;
    let gameWon = false;
    let scoreAccumTimer = 0;

    // Drag state
    let dragPlanet: Planet | null = null;
    let mousePos: Vec2 = { x: 0, y: 0 };
    let isDragging = false;

    // Stars (static background)
    const stars: Star[] = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        brightness: 0.3 + Math.random() * 0.7,
        twinkleSpeed: 0.5 + Math.random() * 2,
        twinkleOffset: Math.random() * Math.PI * 2,
        size: 0.5 + Math.random() * 1.5,
      });
    }

    // Menu animation planets
    const menuDots: { angle: number; speed: number; dist: number; radius: number; color: string }[] = [];
    for (let i = 0; i < 8; i++) {
      menuDots.push({
        angle: (i / 8) * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        dist: 80 + i * 25,
        radius: 3 + Math.random() * 4,
        color: SKY_BLUE,
      });
    }

    // -----------------------------------------------------------------------
    // Level Setup
    // -----------------------------------------------------------------------

    function initLevel(lvl: number) {
      level = lvl;
      planets = [];
      asteroids = [];
      solarFlares = [];
      particles = [];
      paused = false;
      dragPlanet = null;
      isDragging = false;
      perturbationTimer = 5 + Math.random() * 5;
      eventMessage = '';
      eventMessageTimer = 0;

      const numPlanets = Math.min(2 + Math.floor((lvl - 1) / 1), 5);
      levelTimer = 45 + lvl * 10; // 55, 65, 75, ... seconds

      const baseDistances = [100, 150, 200, 250, 300];

      for (let i = 0; i < numPlanets; i++) {
        const template = PLANET_TEMPLATES[i % PLANET_TEMPLATES.length];
        const orbitDist = baseDistances[i] + randomRange(-10, 10);
        const angle = randomRange(0, Math.PI * 2);
        const speed = circularOrbitSpeed(orbitDist);

        // Tangential velocity for circular orbit
        const vx = -Math.sin(angle) * speed;
        const vy = Math.cos(angle) * speed;

        // Add slight imperfection so the player has something to do
        const imperfection = 1 + randomRange(-0.03 * lvl, 0.03 * lvl);

        const planet: Planet = {
          x: CX + Math.cos(angle) * orbitDist,
          y: CY + Math.sin(angle) * orbitDist,
          vx: vx * imperfection,
          vy: vy * imperfection,
          radius: template.radius,
          mass: template.mass,
          color: template.color,
          glowColor: template.glowColor,
          name: template.name,
          trail: [],
          stabilityHistory: [],
          stability: 0.8,
          alive: true,
          minDist: orbitDist,
          maxDist: orbitDist,
          distSamples: [],
        };
        planets.push(planet);
      }
    }

    // -----------------------------------------------------------------------
    // Physics
    // -----------------------------------------------------------------------

    function gravitationalAccel(px: number, py: number, sx: number, sy: number, mass: number): Vec2 {
      const dx = sx - px;
      const dy = sy - py;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < 5) return { x: 0, y: 0 };
      const force = (G * mass) / (r * r);
      return { x: (dx / r) * force, y: (dy / r) * force };
    }

    function updatePlanetPhysics(p: Planet, dt: number) {
      if (!p.alive) return;

      // Velocity Verlet integration
      // Step 1: Calculate acceleration at current position
      let ax = 0;
      let ay = 0;

      // Gravity from sun
      const sunAccel = gravitationalAccel(p.x, p.y, CX, CY, SUN_MASS);
      ax += sunAccel.x;
      ay += sunAccel.y;

      // Gravity from asteroids (small influence)
      for (const ast of asteroids) {
        const astAccel = gravitationalAccel(p.x, p.y, ast.x, ast.y, ast.mass * 30);
        ax += astAccel.x;
        ay += astAccel.y;
      }

      // Step 2: Update position using current velocity and acceleration
      const newX = p.x + p.vx * dt + 0.5 * ax * dt * dt;
      const newY = p.y + p.vy * dt + 0.5 * ay * dt * dt;

      // Step 3: Calculate new acceleration at new position
      let ax2 = 0;
      let ay2 = 0;
      const sunAccel2 = gravitationalAccel(newX, newY, CX, CY, SUN_MASS);
      ax2 += sunAccel2.x;
      ay2 += sunAccel2.y;

      for (const ast of asteroids) {
        const astAccel2 = gravitationalAccel(newX, newY, ast.x, ast.y, ast.mass * 30);
        ax2 += astAccel2.x;
        ay2 += astAccel2.y;
      }

      // Step 4: Update velocity using average of old and new acceleration
      p.vx += 0.5 * (ax + ax2) * dt;
      p.vy += 0.5 * (ay + ay2) * dt;

      p.x = newX;
      p.y = newY;

      // Trail
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > TRAIL_LENGTH) p.trail.shift();

      // Orbit stability measurement
      const d = dist(p.x, p.y, CX, CY);
      p.distSamples.push(d);
      if (p.distSamples.length > 180) p.distSamples.shift();

      if (p.distSamples.length > 30) {
        const minD = Math.min(...p.distSamples);
        const maxD = Math.max(...p.distSamples);
        p.minDist = minD;
        p.maxDist = maxD;

        // Eccentricity approximation
        const eccentricity = (maxD - minD) / (maxD + minD);
        // Lower eccentricity = more stable (circular)
        const stabilityTarget = Math.max(0, 1 - eccentricity * 5);
        p.stability = lerp(p.stability, stabilityTarget, 0.02);
      }

      // Check death conditions
      if (d < SUN_RADIUS + p.radius) {
        p.alive = false;
        spawnExplosion(p.x, p.y, p.color, 30);
        SoundEngine.play('planetCrash');
        showEvent(`${p.name} crashed into the sun!`);
      } else if (p.x < -100 || p.x > W + 100 || p.y < -100 || p.y > H + 100) {
        p.alive = false;
        showEvent(`${p.name} escaped the system!`);
        SoundEngine.play('planetEscape');
      }
    }

    function updateAsteroid(ast: Asteroid, dt: number) {
      // Simple Euler for asteroids (they're transient)
      const sunAccel = gravitationalAccel(ast.x, ast.y, CX, CY, SUN_MASS * 0.3);
      ast.vx += sunAccel.x * dt;
      ast.vy += sunAccel.y * dt;
      ast.x += ast.vx * dt;
      ast.y += ast.vy * dt;
      ast.life -= dt;
    }

    function applyFlare(flare: SolarFlare, dt: number) {
      const progress = 1 - flare.life / flare.maxLife;
      if (progress < 0.2 || progress > 0.5) return; // Active only during burst phase

      for (const p of planets) {
        if (!p.alive) continue;
        const dx = p.x - CX;
        const dy = p.y - CY;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r < 10) continue;

        // Check angle match (flare has a cone)
        const planetAngle = Math.atan2(dy, dx);
        let angleDiff = Math.abs(planetAngle - flare.angle);
        if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

        if (angleDiff < Math.PI / 3) {
          const pushStrength = (flare.strength * 50) / (r * 0.5);
          p.vx += (dx / r) * pushStrength * dt;
          p.vy += (dy / r) * pushStrength * dt;
        }
      }
    }

    // -----------------------------------------------------------------------
    // Events
    // -----------------------------------------------------------------------

    function showEvent(msg: string) {
      eventMessage = msg;
      eventMessageTimer = 3;
    }

    function spawnAsteroid() {
      const side = Math.floor(Math.random() * 4);
      let x: number, y: number, vx: number, vy: number;

      switch (side) {
        case 0: // top
          x = randomRange(100, W - 100);
          y = -20;
          vx = randomRange(-30, 30);
          vy = randomRange(30, 80);
          break;
        case 1: // right
          x = W + 20;
          y = randomRange(100, H - 100);
          vx = randomRange(-80, -30);
          vy = randomRange(-30, 30);
          break;
        case 2: // bottom
          x = randomRange(100, W - 100);
          y = H + 20;
          vx = randomRange(-30, 30);
          vy = randomRange(-80, -30);
          break;
        default: // left
          x = -20;
          y = randomRange(100, H - 100);
          vx = randomRange(30, 80);
          vy = randomRange(-30, 30);
          break;
      }

      asteroids.push({
        x,
        y,
        vx,
        vy,
        radius: randomRange(4, 8),
        mass: randomRange(0.5, 1.5),
        life: 10,
        maxLife: 10,
        vertices: createIrregularShape(randomRange(4, 8), 7),
      });
      showEvent('Rogue asteroid incoming!');
      SoundEngine.play('asteroidSpawn');
    }

    function spawnSolarFlare() {
      const angle = randomRange(0, Math.PI * 2);
      solarFlares.push({
        angle,
        life: 2.5,
        maxLife: 2.5,
        strength: randomRange(1, 2 + level * 0.3),
      });
      showEvent('Solar flare eruption!');
      SoundEngine.play('solarFlare');
      // Spawn visual particles
      for (let i = 0; i < 20; i++) {
        const a = angle + randomRange(-0.4, 0.4);
        const speed = randomRange(80, 200);
        particles.push({
          x: CX + Math.cos(angle) * SUN_RADIUS,
          y: CY + Math.sin(angle) * SUN_RADIUS,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed,
          life: 1.5,
          maxLife: 1.5,
          color: Math.random() > 0.5 ? '#fbbf24' : '#f97316',
          radius: randomRange(2, 5),
        });
      }
    }

    function spawnNewPlanet() {
      if (planets.filter((p) => p.alive).length >= 5) return;
      const templateIdx = planets.length % PLANET_TEMPLATES.length;
      const template = PLANET_TEMPLATES[templateIdx];
      const orbitDist = randomRange(120, 260);
      const angle = randomRange(0, Math.PI * 2);
      const speed = circularOrbitSpeed(orbitDist);

      // Intentionally off-circular to make it a challenge
      const vAngle = angle + Math.PI / 2 + randomRange(-0.3, 0.3);
      const vMag = speed * randomRange(0.7, 1.3);

      const planet: Planet = {
        x: CX + Math.cos(angle) * orbitDist,
        y: CY + Math.sin(angle) * orbitDist,
        vx: Math.cos(vAngle) * vMag,
        vy: Math.sin(vAngle) * vMag,
        radius: template.radius,
        mass: template.mass,
        color: template.color,
        glowColor: template.glowColor,
        name: template.name,
        trail: [],
        stabilityHistory: [],
        stability: 0.3,
        alive: true,
        minDist: orbitDist,
        maxDist: orbitDist,
        distSamples: [],
      };
      planets.push(planet);
      showEvent(`New planet ${template.name} appeared! Stabilize it!`);
      SoundEngine.play('eventWarning');
    }

    function triggerPerturbation() {
      const roll = Math.random();
      if (roll < 0.4) {
        spawnAsteroid();
      } else if (roll < 0.75) {
        spawnSolarFlare();
      } else {
        spawnNewPlanet();
      }
    }

    function spawnExplosion(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = randomRange(0, Math.PI * 2);
        const speed = randomRange(30, 150);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: randomRange(0.5, 1.5),
          maxLife: 1.5,
          color,
          radius: randomRange(1, 4),
        });
      }
    }

    // -----------------------------------------------------------------------
    // Predicted path
    // -----------------------------------------------------------------------

    function predictPath(planet: Planet, newVx: number, newVy: number): Vec2[] {
      const points: Vec2[] = [];
      let px = planet.x;
      let py = planet.y;
      let pvx = newVx;
      let pvy = newVy;
      const simDt = DT * 2;

      for (let i = 0; i < PREDICT_STEPS; i++) {
        const acc = gravitationalAccel(px, py, CX, CY, SUN_MASS);
        pvx += acc.x * simDt;
        pvy += acc.y * simDt;
        px += pvx * simDt;
        py += pvy * simDt;
        points.push({ x: px, y: py });

        // Stop if hits sun or goes off screen
        const d = dist(px, py, CX, CY);
        if (d < SUN_RADIUS || px < -50 || px > W + 50 || py < -50 || py > H + 50) break;
      }
      return points;
    }

    // -----------------------------------------------------------------------
    // Drawing
    // -----------------------------------------------------------------------

    function drawStars(time: number) {
      for (const star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(time * star.twinkleSpeed + star.twinkleOffset);
        const alpha = star.brightness * twinkle;
        ctx!.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx!.beginPath();
        ctx!.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawSun(time: number) {
      const c = ctx!;
      const pulse = 1 + 0.05 * Math.sin(time * 2);

      // Outer corona glow
      const coronaGrad = c.createRadialGradient(CX, CY, SUN_RADIUS * 0.5, CX, CY, SUN_RADIUS * 3 * pulse);
      coronaGrad.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
      coronaGrad.addColorStop(0.4, 'rgba(249, 115, 22, 0.15)');
      coronaGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      c.fillStyle = coronaGrad;
      c.beginPath();
      c.arc(CX, CY, SUN_RADIUS * 3 * pulse, 0, Math.PI * 2);
      c.fill();

      // Inner glow
      const innerGrad = c.createRadialGradient(CX, CY, 0, CX, CY, SUN_RADIUS * 1.5);
      innerGrad.addColorStop(0, '#fff7ed');
      innerGrad.addColorStop(0.3, '#fbbf24');
      innerGrad.addColorStop(0.7, '#f97316');
      innerGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      c.fillStyle = innerGrad;
      c.beginPath();
      c.arc(CX, CY, SUN_RADIUS * 1.5, 0, Math.PI * 2);
      c.fill();

      // Sun body
      const bodyGrad = c.createRadialGradient(CX - 5, CY - 5, 2, CX, CY, SUN_RADIUS);
      bodyGrad.addColorStop(0, '#fef3c7');
      bodyGrad.addColorStop(0.5, '#fbbf24');
      bodyGrad.addColorStop(1, '#f59e0b');
      c.fillStyle = bodyGrad;
      c.beginPath();
      c.arc(CX, CY, SUN_RADIUS, 0, Math.PI * 2);
      c.fill();
    }

    function drawPlanet(p: Planet) {
      if (!p.alive) return;
      const c = ctx!;

      // Trail
      if (p.trail.length > 1) {
        for (let i = 1; i < p.trail.length; i++) {
          const alpha = (i / p.trail.length) * 0.4;
          c.strokeStyle = `rgba(${hexToRgb(p.color)}, ${alpha})`;
          c.lineWidth = 1;
          c.setLineDash([3, 4]);
          c.beginPath();
          c.moveTo(p.trail[i - 1].x, p.trail[i - 1].y);
          c.lineTo(p.trail[i].x, p.trail[i].y);
          c.stroke();
        }
        c.setLineDash([]);
      }

      // Stability ring
      const stabColor =
        p.stability > 0.7 ? '#22c55e' : p.stability > 0.4 ? '#eab308' : '#ef4444';
      c.strokeStyle = stabColor;
      c.lineWidth = 2;
      c.globalAlpha = 0.7;
      c.beginPath();
      c.arc(p.x, p.y, p.radius + 5, 0, Math.PI * 2 * p.stability);
      c.stroke();
      c.globalAlpha = 1;

      // Planet glow
      const glowGrad = c.createRadialGradient(p.x, p.y, p.radius * 0.5, p.x, p.y, p.radius * 2.5);
      glowGrad.addColorStop(0, `rgba(${hexToRgb(p.glowColor)}, 0.3)`);
      glowGrad.addColorStop(1, `rgba(${hexToRgb(p.glowColor)}, 0)`);
      c.fillStyle = glowGrad;
      c.beginPath();
      c.arc(p.x, p.y, p.radius * 2.5, 0, Math.PI * 2);
      c.fill();

      // Planet body
      const bodyGrad = c.createRadialGradient(
        p.x - p.radius * 0.3,
        p.y - p.radius * 0.3,
        p.radius * 0.1,
        p.x,
        p.y,
        p.radius
      );
      bodyGrad.addColorStop(0, lightenColor(p.color, 40));
      bodyGrad.addColorStop(1, p.color);
      c.fillStyle = bodyGrad;
      c.beginPath();
      c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      c.fill();
    }

    function drawAsteroid(ast: Asteroid) {
      const c = ctx!;
      const alpha = Math.min(1, ast.life / 2);
      c.globalAlpha = alpha;
      c.fillStyle = '#6b7280';
      c.strokeStyle = '#9ca3af';
      c.lineWidth = 1;

      c.beginPath();
      if (ast.vertices.length > 0) {
        c.moveTo(ast.x + ast.vertices[0].x, ast.y + ast.vertices[0].y);
        for (let i = 1; i < ast.vertices.length; i++) {
          c.lineTo(ast.x + ast.vertices[i].x, ast.y + ast.vertices[i].y);
        }
        c.closePath();
      }
      c.fill();
      c.stroke();
      c.globalAlpha = 1;
    }

    function drawSolarFlare(flare: SolarFlare) {
      const c = ctx!;
      const progress = 1 - flare.life / flare.maxLife;
      const burstPhase = progress < 0.5 ? progress * 2 : 2 - progress * 2;

      if (burstPhase <= 0) return;

      const length = SUN_RADIUS * 2 + burstPhase * 120 * flare.strength;
      const width = 15 + burstPhase * 25;

      c.save();
      c.translate(CX, CY);
      c.rotate(flare.angle);

      const grad = c.createLinearGradient(SUN_RADIUS, 0, length, 0);
      grad.addColorStop(0, `rgba(251, 191, 36, ${burstPhase * 0.8})`);
      grad.addColorStop(0.5, `rgba(249, 115, 22, ${burstPhase * 0.5})`);
      grad.addColorStop(1, `rgba(249, 115, 22, 0)`);

      c.fillStyle = grad;
      c.beginPath();
      c.moveTo(SUN_RADIUS, 0);
      c.lineTo(length, -width * 0.3);
      c.lineTo(length * 1.1, 0);
      c.lineTo(length, width * 0.3);
      c.closePath();
      c.fill();

      c.restore();
    }

    function drawVelocityArrow(planet: Planet, mx: number, my: number) {
      const c = ctx!;
      const dx = mx - planet.x;
      const dy = my - planet.y;
      const scale = 0.8;

      // Arrow line
      c.strokeStyle = SKY_BLUE;
      c.lineWidth = 2.5;
      c.setLineDash([]);
      c.beginPath();
      c.moveTo(planet.x, planet.y);
      c.lineTo(planet.x + dx * scale, planet.y + dy * scale);
      c.stroke();

      // Arrowhead
      const headLen = 12;
      const endX = planet.x + dx * scale;
      const endY = planet.y + dy * scale;
      const arrowAngle = Math.atan2(dy, dx);

      c.fillStyle = SKY_BLUE;
      c.beginPath();
      c.moveTo(endX, endY);
      c.lineTo(
        endX - headLen * Math.cos(arrowAngle - 0.4),
        endY - headLen * Math.sin(arrowAngle - 0.4)
      );
      c.lineTo(
        endX - headLen * Math.cos(arrowAngle + 0.4),
        endY - headLen * Math.sin(arrowAngle + 0.4)
      );
      c.closePath();
      c.fill();
    }

    function drawPredictedPath(points: Vec2[]) {
      const c = ctx!;
      if (points.length < 2) return;

      for (let i = 1; i < points.length; i++) {
        const alpha = (1 - i / points.length) * 0.6;
        c.strokeStyle = `rgba(14, 165, 233, ${alpha})`;
        c.lineWidth = 1.5;
        c.setLineDash([4, 6]);
        c.beginPath();
        c.moveTo(points[i - 1].x, points[i - 1].y);
        c.lineTo(points[i].x, points[i].y);
        c.stroke();
      }
      c.setLineDash([]);
    }

    function drawParticles() {
      const c = ctx!;
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        c.globalAlpha = alpha;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }

    function drawHUD() {
      const c = ctx!;

      // Top bar background
      c.fillStyle = 'rgba(0, 0, 0, 0.5)';
      c.fillRect(0, 0, W, 44);
      c.strokeStyle = 'rgba(14, 165, 233, 0.3)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, 44);
      c.lineTo(W, 44);
      c.stroke();

      c.font = 'bold 14px monospace';

      // Level
      c.fillStyle = SKY_BLUE;
      c.textAlign = 'left';
      c.fillText(`LEVEL ${level}`, 15, 28);

      // Time
      const minutes = Math.floor(levelTimer / 60);
      const seconds = Math.floor(levelTimer % 60);
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      c.fillStyle = levelTimer < 10 ? '#ef4444' : '#e2e8f0';
      c.textAlign = 'center';
      c.fillText(`TIME ${timeStr}`, W / 2, 28);

      // Score
      c.fillStyle = '#fbbf24';
      c.textAlign = 'right';
      c.fillText(`SCORE ${score}`, W - 150, 28);

      // Planets alive
      const alive = planets.filter((p) => p.alive).length;
      c.fillStyle = alive > 0 ? '#22c55e' : '#ef4444';
      c.fillText(`PLANETS ${alive}`, W - 15, 28);

      // Paused indicator
      if (paused) {
        c.fillStyle = 'rgba(0, 0, 0, 0.6)';
        c.fillRect(0, H / 2 - 40, W, 80);

        c.font = 'bold 28px monospace';
        c.fillStyle = SKY_BLUE;
        c.textAlign = 'center';
        c.fillText('PAUSED', W / 2, H / 2 + 2);

        c.font = '14px monospace';
        c.fillStyle = '#94a3b8';
        c.fillText('Click and drag planets to adjust orbits', W / 2, H / 2 + 28);
      }

      // Event message
      if (eventMessageTimer > 0) {
        const alpha = Math.min(1, eventMessageTimer);
        c.font = 'bold 16px monospace';
        c.fillStyle = `rgba(251, 191, 36, ${alpha})`;
        c.textAlign = 'center';
        c.fillText(eventMessage, W / 2, 75);
      }

      // Planet stability info (bottom)
      const alivePlanets = planets.filter((p) => p.alive);
      const barWidth = 80;
      const barHeight = 6;
      const startX = W / 2 - (alivePlanets.length * (barWidth + 20)) / 2;

      for (let i = 0; i < alivePlanets.length; i++) {
        const p = alivePlanets[i];
        const bx = startX + i * (barWidth + 20);
        const by = H - 30;

        // Planet name
        c.font = '10px monospace';
        c.fillStyle = p.color;
        c.textAlign = 'left';
        c.fillText(p.name, bx, by - 4);

        // Bar background
        c.fillStyle = 'rgba(255, 255, 255, 0.1)';
        c.fillRect(bx, by, barWidth, barHeight);

        // Stability fill
        const stabColor =
          p.stability > 0.7 ? '#22c55e' : p.stability > 0.4 ? '#eab308' : '#ef4444';
        c.fillStyle = stabColor;
        c.fillRect(bx, by, barWidth * clamp(p.stability, 0, 1), barHeight);
      }
    }

    // -----------------------------------------------------------------------
    // Menu & Game Over Screens
    // -----------------------------------------------------------------------

    function drawMenu(time: number) {
      const c = ctx!;

      // Background
      c.fillStyle = BG_COLOR;
      c.fillRect(0, 0, W, H);
      drawStars(time);

      // Central faux-sun glow
      const grad = c.createRadialGradient(CX, CY - 30, 10, CX, CY - 30, 120);
      grad.addColorStop(0, 'rgba(14, 165, 233, 0.2)');
      grad.addColorStop(1, 'rgba(14, 165, 233, 0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(CX, CY - 30, 120, 0, Math.PI * 2);
      c.fill();

      // Orbiting dots
      for (const dot of menuDots) {
        dot.angle += dot.speed * DT;
        const dx = CX + Math.cos(dot.angle) * dot.dist;
        const dy = CY - 30 + Math.sin(dot.angle) * dot.dist * 0.5;

        c.fillStyle = SKY_BLUE;
        c.globalAlpha = 0.6 + 0.4 * Math.sin(dot.angle);
        c.beginPath();
        c.arc(dx, dy, dot.radius, 0, Math.PI * 2);
        c.fill();

        // Faint trail
        for (let t = 1; t <= 5; t++) {
          const ta = dot.angle - t * 0.15;
          const tx = CX + Math.cos(ta) * dot.dist;
          const ty = CY - 30 + Math.sin(ta) * dot.dist * 0.5;
          c.globalAlpha = (0.3 - t * 0.05) * (0.6 + 0.4 * Math.sin(dot.angle));
          c.beginPath();
          c.arc(tx, ty, dot.radius * 0.6, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.globalAlpha = 1;

      // Title
      c.font = 'bold 48px monospace';
      c.fillStyle = SKY_BLUE;
      c.textAlign = 'center';
      c.fillText('ORBIT KEEPER', CX, CY - 100);

      // Subtitle line
      c.font = '16px monospace';
      c.fillStyle = '#64748b';
      c.fillText('Maintain orbital harmony in a chaotic solar system', CX, CY - 65);

      // Instructions box
      const instructions = [
        'Click & drag planets to adjust their velocity',
        'Keep all planets in stable circular orbits',
        'Survive perturbations: asteroids, solar flares',
        'Fewer interventions = higher score',
        'Press SPACE to pause and plan',
      ];

      c.font = '13px monospace';
      const boxY = CY + 40;
      for (let i = 0; i < instructions.length; i++) {
        c.fillStyle = '#94a3b8';
        c.fillText(instructions[i], CX, boxY + i * 24);
      }

      // Click to start (pulsing)
      const pulse = 0.6 + 0.4 * Math.sin(time * 3);
      c.font = 'bold 20px monospace';
      c.fillStyle = `rgba(14, 165, 233, ${pulse})`;
      c.fillText('Click to Start', CX, CY + 210);
    }

    function drawGameOver(time: number) {
      const c = ctx!;

      // Dim background
      c.fillStyle = 'rgba(10, 10, 15, 0.85)';
      c.fillRect(0, 0, W, H);
      drawStars(time);

      // Title
      c.font = 'bold 42px monospace';
      c.fillStyle = gameWon ? '#22c55e' : '#ef4444';
      c.textAlign = 'center';
      c.fillText(gameWon ? 'SYSTEM MASTERED!' : 'SYSTEM LOST', CX, CY - 110);

      // Stats
      c.font = '16px monospace';
      const stats = [
        { label: 'Final Score', value: score.toString(), color: '#fbbf24' },
        { label: 'Level Reached', value: level.toString(), color: SKY_BLUE },
        { label: 'Orbits Stabilized', value: totalOrbitsStabilized.toString(), color: '#22c55e' },
        { label: 'Interventions Made', value: interventions.toString(), color: '#94a3b8' },
      ];

      for (let i = 0; i < stats.length; i++) {
        const sy = CY - 40 + i * 40;

        c.fillStyle = '#64748b';
        c.textAlign = 'right';
        c.fillText(stats[i].label, CX - 15, sy);

        c.fillStyle = stats[i].color;
        c.textAlign = 'left';
        c.font = 'bold 16px monospace';
        c.fillText(stats[i].value, CX + 15, sy);
        c.font = '16px monospace';
      }

      // High score
      c.fillStyle = '#888';
      c.font = '14px monospace';
      c.textAlign = 'center';
      c.fillText(`Best: ${highScore}`, CX, CY + 100);
      if (newHighScore) {
        c.fillStyle = SKY_BLUE;
        c.font = 'bold 14px monospace';
        c.fillText('New High Score!', CX, CY + 118);
      }

      // Restart prompt
      const pulse = 0.6 + 0.4 * Math.sin(time * 3);
      c.font = 'bold 20px monospace';
      c.fillStyle = `rgba(14, 165, 233, ${pulse})`;
      c.textAlign = 'center';
      c.fillText('Click to Restart', CX, CY + 140);
    }

    // -----------------------------------------------------------------------
    // Color Utilities
    // -----------------------------------------------------------------------

    function hexToRgb(hex: string): string {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return '255, 255, 255';
      return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }

    function lightenColor(hex: string, amount: number): string {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      if (!result) return hex;
      const r = Math.min(255, parseInt(result[1], 16) + amount);
      const g = Math.min(255, parseInt(result[2], 16) + amount);
      const b = Math.min(255, parseInt(result[3], 16) + amount);
      return `rgb(${r}, ${g}, ${b})`;
    }

    // -----------------------------------------------------------------------
    // Main Update & Render
    // -----------------------------------------------------------------------

    function update(dt: number) {
      if (state !== 'playing' || paused) return;

      // Update planets
      for (const p of planets) {
        if (p.alive) {
          updatePlanetPhysics(p, dt);
        }
      }

      // Update asteroids
      for (const ast of asteroids) {
        updateAsteroid(ast, dt);
      }
      asteroids = asteroids.filter((a) => a.life > 0 && a.x > -100 && a.x < W + 100 && a.y > -100 && a.y < H + 100);

      // Update solar flares
      for (const flare of solarFlares) {
        flare.life -= dt;
        applyFlare(flare, dt);
      }
      solarFlares = solarFlares.filter((f) => f.life > 0);

      // Update particles
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
      }
      particles = particles.filter((p) => p.life > 0);

      // Event message timer
      if (eventMessageTimer > 0) {
        eventMessageTimer -= dt;
      }

      // Level timer
      levelTimer -= dt;

      // Score: bonus for stable orbits each second
      const alivePlanets = planets.filter((p) => p.alive);
      scoreAccumTimer += dt;
      if (scoreAccumTimer >= 1) {
        scoreAccumTimer -= 1;
        for (const p of alivePlanets) {
          if (p.stability > 0.7) {
            score += Math.floor(p.stability * 2);
          }
        }
      }

      // Perturbation timer
      perturbationTimer -= dt;
      if (perturbationTimer <= 0) {
        triggerPerturbation();
        // Decrease interval with level (more chaos at higher levels)
        perturbationTimer = Math.max(3, 8 - level * 0.8) + Math.random() * 4;
      }

      // Check game over
      if (alivePlanets.length === 0) {
        gameWon = false;
        if (score > highScore) { highScore = score; newHighScore = true; setHighScoreVal('orbit-keeper', score); }
        state = 'gameover';
        SoundEngine.play('gameOver');
        return;
      }

      // Check level complete
      if (levelTimer <= 0) {
        // Count stabilized orbits
        for (const p of alivePlanets) {
          if (p.stability > 0.6) {
            totalOrbitsStabilized++;
          }
        }

        // Bonus score for surviving planets
        score += alivePlanets.length * 500;
        // Bonus for low interventions
        score += Math.max(0, 1000 - interventions * 50);

        if (level >= 8) {
          // Game won!
          gameWon = true;
          if (score > highScore) { highScore = score; newHighScore = true; setHighScoreVal('orbit-keeper', score); }
          state = 'gameover';
          SoundEngine.play('levelComplete');
          return;
        }

        // Next level
        initLevel(level + 1);
        showEvent(`Level ${level} - More chaos ahead!`);
        SoundEngine.play('levelComplete');
      }
    }

    function render(time: number) {
      const c = ctx!;

      if (state === 'menu') {
        drawMenu(time);
        return;
      }

      if (state === 'gameover') {
        drawGameOver(time);
        return;
      }

      // --- Playing ---
      // Background
      c.fillStyle = BG_COLOR;
      c.fillRect(0, 0, W, H);
      drawStars(time);

      // Solar flares (behind sun)
      for (const flare of solarFlares) {
        drawSolarFlare(flare);
      }

      // Sun
      drawSun(time);

      // Predicted path (when dragging)
      if (isDragging && dragPlanet && dragPlanet.alive) {
        const dx = mousePos.x - dragPlanet.x;
        const dy = mousePos.y - dragPlanet.y;
        const velScale = 0.8;
        const newVx = dx * velScale;
        const newVy = dy * velScale;
        const predicted = predictPath(dragPlanet, newVx, newVy);
        drawPredictedPath(predicted);
      }

      // Asteroids
      for (const ast of asteroids) {
        drawAsteroid(ast);
      }

      // Planets
      for (const p of planets) {
        drawPlanet(p);
      }

      // Velocity arrow (when dragging)
      if (isDragging && dragPlanet && dragPlanet.alive) {
        drawVelocityArrow(dragPlanet, mousePos.x, mousePos.y);
      }

      // Particles
      drawParticles();

      // HUD
      drawHUD();
    }

    // -----------------------------------------------------------------------
    // Main Loop
    // -----------------------------------------------------------------------

    function gameLoop(timestamp: number) {
      const time = timestamp / 1000;
      const dt = Math.min(lastTime === 0 ? DT : (timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      update(dt);
      render(time);

      animId = requestAnimationFrame(gameLoop);
    }

    // -----------------------------------------------------------------------
    // Input Handlers
    // -----------------------------------------------------------------------

    function getCanvasPos(e: MouseEvent | TouchEvent): Vec2 {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;

      let clientX: number, clientY: number;
      if ('touches' in e) {
        clientX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX ?? 0;
        clientY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY ?? 0;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY,
      };
    }

    function onMouseDown(e: MouseEvent) {
      e.preventDefault();
      const pos = getCanvasPos(e);

      if (state === 'menu') {
        state = 'playing';
        score = 0;
        newHighScore = false;
        totalOrbitsStabilized = 0;
        interventions = 0;
        gameWon = false;
        scoreAccumTimer = 0;
        initLevel(1);
        SoundEngine.play('menuSelect');
        return;
      }

      if (state === 'gameover') {
        state = 'menu';
        return;
      }

      if (state === 'playing') {
        // Check if clicked on a planet
        for (const p of planets) {
          if (!p.alive) continue;
          const d = dist(pos.x, pos.y, p.x, p.y);
          if (d < p.radius + 15) {
            dragPlanet = p;
            mousePos = { x: pos.x, y: pos.y };
            isDragging = true;
            return;
          }
        }
      }
    }

    function onMouseMove(e: MouseEvent) {
      e.preventDefault();
      if (isDragging) {
        mousePos = getCanvasPos(e);
      }
    }

    function onMouseUp(e: MouseEvent) {
      e.preventDefault();
      if (isDragging && dragPlanet && dragPlanet.alive) {
        const pos = getCanvasPos(e);
        const dx = pos.x - dragPlanet.x;
        const dy = pos.y - dragPlanet.y;

        // Only apply if significant drag distance
        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          const velScale = 0.8;
          dragPlanet.vx = dx * velScale;
          dragPlanet.vy = dy * velScale;
          interventions++;

          // Clear stability history so it re-evaluates
          dragPlanet.distSamples = [];
          dragPlanet.stability = 0.5;
        }
      }
      isDragging = false;
      dragPlanet = null;
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const pos = getCanvasPos(e);

      if (state === 'menu') {
        state = 'playing';
        score = 0;
        newHighScore = false;
        totalOrbitsStabilized = 0;
        interventions = 0;
        gameWon = false;
        scoreAccumTimer = 0;
        initLevel(1);
        return;
      }

      if (state === 'gameover') {
        state = 'menu';
        return;
      }

      if (state === 'playing') {
        for (const p of planets) {
          if (!p.alive) continue;
          const d = dist(pos.x, pos.y, p.x, p.y);
          if (d < p.radius + 20) {
            dragPlanet = p;
            mousePos = { x: pos.x, y: pos.y };
            isDragging = true;
            return;
          }
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (isDragging) {
        mousePos = getCanvasPos(e);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      if (isDragging && dragPlanet && dragPlanet.alive) {
        const pos = getCanvasPos(e);
        const dx = pos.x - dragPlanet.x;
        const dy = pos.y - dragPlanet.y;

        if (Math.sqrt(dx * dx + dy * dy) > 5) {
          const velScale = 0.8;
          dragPlanet.vx = dx * velScale;
          dragPlanet.vy = dy * velScale;
          interventions++;
          dragPlanet.distSamples = [];
          dragPlanet.stability = 0.5;
        }
      }
      isDragging = false;
      dragPlanet = null;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && state === 'playing') {
        e.preventDefault();
        paused = !paused;
      }
    }

    // -----------------------------------------------------------------------
    // Attach events & start
    // -----------------------------------------------------------------------

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    // Prevent context menu on right click
    const onContextMenu = (e: Event) => e.preventDefault();
    canvas.addEventListener('contextmenu', onContextMenu);

    const onVisibilityChange = () => {
      if (document.hidden && state === 'playing' && !paused) {
        paused = true;
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    animId = requestAnimationFrame(gameLoop);

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
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
        aspectRatio: `${W} / ${H}`,
        display: 'block',
        cursor: 'crosshair',
      }}
    />
  );
}
