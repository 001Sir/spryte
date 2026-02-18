'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const TEAL = '#14b8a6';
const BG = '#0a0a0a';
const TOTAL_ROUNDS = 30;
const INITIAL_TIMER = 5.0;
const MIN_TIMER = 2.5;
const TIMER_SHRINK = 0.05;
const ENTRANCE_DUR = 0.4;
const FEEDBACK_DUR = 0.8;
const EXIT_DUR = 0.3;

// ─── Shape definitions ───────────────────────────────────────────────────────
type ShapeForm = 'circle' | 'triangle' | 'square' | 'pentagon' | 'hexagon' | 'star5' | 'star4' | 'diamond' | 'cross' | 'crescent' | 'arrow' | 'heart';
type ShapePattern = 'solid' | 'dotted' | 'striped' | 'ring' | 'crosshatch';

const FORMS: ShapeForm[] = ['circle', 'triangle', 'square', 'pentagon', 'hexagon', 'star5', 'star4', 'diamond', 'cross', 'crescent', 'arrow', 'heart'];
const COLORS = ['#f87171', '#fbbf24', '#34d399', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#6ee7b7', '#64748b', '#ffffff'];
const PATTERNS: ShapePattern[] = ['solid', 'dotted', 'striped', 'ring', 'crosshatch'];
const SIZES = [40, 52, 64, 76];
const ROTATIONS = [0, 60, 120, 180, 240, 300];

interface Shape {
  form: ShapeForm;
  color: string;
  rotation: number;
  size: number;
  pattern: ShapePattern;
  hash: string;
}

type RoundType = 'new' | 'repeat' | 'decoy';
type GameState = 'menu' | 'playing' | 'gameover';
type PlayPhase = 'entrance' | 'viewing' | 'responding' | 'feedback' | 'exit';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; size: number;
}

interface ScorePopup {
  x: number; y: number;
  text: string; color: string;
  life: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function randPick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function easeOutBack(t: number) { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
function easeInBack(t: number) { const c1 = 1.70158; const c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; }

function makeHash(s: Shape): string {
  return `${s.form}-${s.color}-${s.rotation}-${s.size}-${s.pattern}`;
}

function generateShape(): Shape {
  const s: Shape = {
    form: randPick(FORMS),
    color: randPick(COLORS),
    rotation: randPick(ROTATIONS),
    size: randPick(SIZES),
    pattern: randPick(PATTERNS),
    hash: '',
  };
  s.hash = makeHash(s);
  return s;
}

function generateDecoy(source: Shape): Shape {
  const props: (keyof Pick<Shape, 'form' | 'color' | 'rotation' | 'size' | 'pattern'>)[] = ['form', 'color', 'rotation', 'size', 'pattern'];
  const prop = randPick(props);
  const decoy = { ...source };
  switch (prop) {
    case 'form': { let f; do { f = randPick(FORMS); } while (f === source.form); decoy.form = f; break; }
    case 'color': { let c; do { c = randPick(COLORS); } while (c === source.color); decoy.color = c; break; }
    case 'rotation': { let r; do { r = randPick(ROTATIONS); } while (r === source.rotation); decoy.rotation = r; break; }
    case 'size': { let sz; do { sz = randPick(SIZES); } while (sz === source.size); decoy.size = sz; break; }
    case 'pattern': { let p; do { p = randPick(PATTERNS); } while (p === source.pattern); decoy.pattern = p; break; }
  }
  decoy.hash = makeHash(decoy);
  return decoy;
}

// ─── Shape drawing ────────────────────────────────────────────────────────────
function drawShapeForm(ctx: CanvasRenderingContext2D, form: ShapeForm, size: number) {
  const r = size / 2;
  ctx.beginPath();
  switch (form) {
    case 'circle':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case 'triangle':
      for (let i = 0; i < 3; i++) {
        const a = (i * 2 * Math.PI) / 3 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      break;
    case 'square':
      ctx.rect(-r, -r, size, size);
      break;
    case 'pentagon':
      for (let i = 0; i < 5; i++) {
        const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (i * 2 * Math.PI) / 6 - Math.PI / 2;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      break;
    case 'star5': {
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.45;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      break;
    }
    case 'star4': {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.4;
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      break;
    }
    case 'diamond':
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.6, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.6, 0);
      ctx.closePath();
      break;
    case 'cross': {
      const t = r * 0.3;
      ctx.moveTo(-t, -r); ctx.lineTo(t, -r); ctx.lineTo(t, -t);
      ctx.lineTo(r, -t); ctx.lineTo(r, t); ctx.lineTo(t, t);
      ctx.lineTo(t, r); ctx.lineTo(-t, r); ctx.lineTo(-t, t);
      ctx.lineTo(-r, t); ctx.lineTo(-r, -t); ctx.lineTo(-t, -t);
      ctx.closePath();
      break;
    }
    case 'crescent': {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(r * 0.5 + r * 0.75, 0);
      ctx.arc(r * 0.5, 0, r * 0.75, 0, Math.PI * 2, true);
      break;
    }
    case 'arrow': {
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.7, r * 0.2);
      ctx.lineTo(r * 0.25, r * 0.2);
      ctx.lineTo(r * 0.25, r);
      ctx.lineTo(-r * 0.25, r);
      ctx.lineTo(-r * 0.25, r * 0.2);
      ctx.lineTo(-r * 0.7, r * 0.2);
      ctx.closePath();
      break;
    }
    case 'heart': {
      ctx.moveTo(0, r * 0.3);
      ctx.bezierCurveTo(-r, -r * 0.3, -r, -r, 0, -r * 0.5);
      ctx.bezierCurveTo(r, -r, r, -r * 0.3, 0, r * 0.3);
      ctx.closePath();
      break;
    }
  }
}

function applyPattern(ctx: CanvasRenderingContext2D, pattern: ShapePattern, color: string, size: number) {
  const r = size / 2;
  switch (pattern) {
    case 'solid':
      ctx.fillStyle = color;
      ctx.fill();
      break;
    case 'dotted':
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      for (let x = -r; x <= r; x += 8) {
        for (let y = -r; y <= r; y += 8) {
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'striped':
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      for (let y = -r; y <= r; y += 8) {
        ctx.fillRect(-r - 5, y, size + 10, 3);
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
    case 'ring':
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(4, size * 0.12);
      ctx.stroke();
      break;
    case 'crosshatch':
      ctx.fillStyle = color;
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = -r * 2; i <= r * 2; i += 8) {
        ctx.save();
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(i, -r * 2, 2, r * 4);
        ctx.restore();
        ctx.save();
        ctx.rotate(-Math.PI / 4);
        ctx.fillRect(i, -r * 2, 2, r * 4);
        ctx.restore();
      }
      ctx.globalCompositeOperation = 'source-over';
      break;
  }
}

function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, scale: number = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((shape.rotation * Math.PI) / 180);
  ctx.scale(scale, scale);
  drawShapeForm(ctx, shape.form, shape.size);
  applyPattern(ctx, shape.pattern, shape.color, shape.size);
  if (shape.pattern !== 'ring') {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1.5;
    drawShapeForm(ctx, shape.form, shape.size);
    ctx.stroke();
  }
  ctx.restore();
}

// ─── Main Game Component ──────────────────────────────────────────────────────
export default function DejaVuGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // ─── Game state ───────────────────────────────────────────────────
    let state: GameState = 'menu';
    let playPhase: PlayPhase = 'entrance';
    let phaseTimer = 0;

    let round = 0;
    let score = 0;
    let lives = 3;
    let streak = 0;
    let bestStreak = 0;
    let highScore = getHighScore('deja-vu');

    let seenShapes: Shape[] = [];
    let currentShape: Shape | null = null;
    let currentRoundType: RoundType = 'new';
    let roundTimer = 0;
    let roundTimerMax = INITIAL_TIMER;

    let lastAnswer: 'correct' | 'wrong' | 'timeout' | null = null;
    let lastPoints = 0;
    let lastAnswerDetail = '';

    let totalCorrect = 0;
    let decoysIdentified = 0;
    let responseTimes: number[] = [];

    // Menu animation
    let menuTime = 0;
    const menuShapes: Shape[] = [];
    for (let i = 0; i < 8; i++) menuShapes.push(generateShape());

    // Particles and popups
    let particles: Particle[] = [];
    let scorePopups: ScorePopup[] = [];
    let shakeAmount = 0;
    let shakeTimer = 0;

    // Animation state
    let displayScore = 0;
    let gameOverTime = 0;
    let lifeLostFlash = 0;

    // Button hover states
    let hoverNew = false;
    let hoverSeen = false;
    let hoverStart = false;
    let hoverPlayAgain = false;

    // Touch/mouse tracking
    let mouseX = 0;
    let mouseY = 0;

    // Button rects (computed in draw)
    const btnNewRect = { x: 0, y: 0, w: 0, h: 0 };
    const btnSeenRect = { x: 0, y: 0, w: 0, h: 0 };
    const btnStartRect = { x: 0, y: 0, w: 0, h: 0 };
    const btnPlayAgainRect = { x: 0, y: 0, w: 0, h: 0 };

    function inRect(mx: number, my: number, r: { x: number; y: number; w: number; h: number }) {
      return mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h;
    }

    // ─── Round planning ───────────────────────────────────────────────
    let roundPlan: RoundType[] = [];

    function planRounds() {
      roundPlan = [];
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        if (i < 3) {
          roundPlan.push('new');
        } else {
          const progress = i / TOTAL_ROUNDS;
          const repeatChance = 0.2 + progress * 0.35;
          const decoyChance = 0.05 + progress * 0.2;
          const roll = Math.random();
          if (roll < decoyChance) {
            roundPlan.push('decoy');
          } else if (roll < decoyChance + repeatChance) {
            roundPlan.push('repeat');
          } else {
            roundPlan.push('new');
          }
        }
      }
    }

    function getShapeForRound(roundIdx: number): { shape: Shape; type: RoundType } {
      let type = roundPlan[roundIdx] || 'new';
      // If we need a repeat/decoy but have no seen shapes, force new
      if ((type === 'repeat' || type === 'decoy') && seenShapes.length === 0) {
        type = 'new';
      }

      if (type === 'new') {
        let shape: Shape;
        let attempts = 0;
        do {
          shape = generateShape();
          attempts++;
        } while (seenShapes.some(s => s.hash === shape.hash) && attempts < 50);
        return { shape, type: 'new' };
      } else if (type === 'repeat') {
        const shape = randPick(seenShapes);
        return { shape: { ...shape }, type: 'repeat' };
      } else {
        // decoy
        const source = randPick(seenShapes);
        let decoy: Shape;
        let attempts = 0;
        do {
          decoy = generateDecoy(source);
          attempts++;
        } while (seenShapes.some(s => s.hash === decoy.hash) && attempts < 50);
        return { shape: decoy, type: 'decoy' };
      }
    }

    // ─── Start game ───────────────────────────────────────────────────
    function startGame() {
      state = 'playing';
      round = 0;
      score = 0;
      lives = 3;
      streak = 0;
      bestStreak = 0;
      totalCorrect = 0;
      decoysIdentified = 0;
      responseTimes = [];
      seenShapes = [];
      particles = [];
      scorePopups = [];
      shakeAmount = 0;
      displayScore = 0;
      gameOverTime = 0;
      lifeLostFlash = 0;
      planRounds();
      nextRound();
      SoundEngine.play('menuSelect');
    }

    function nextRound() {
      if (round >= TOTAL_ROUNDS || lives <= 0) {
        endGame();
        return;
      }
      const { shape, type } = getShapeForRound(round);
      currentShape = shape;
      currentRoundType = type;
      roundTimerMax = Math.max(MIN_TIMER, INITIAL_TIMER - round * TIMER_SHRINK);
      roundTimer = roundTimerMax;
      lastAnswer = null;
      playPhase = 'entrance';
      phaseTimer = 0;
      SoundEngine.play('waveStart');
    }

    // ─── Answer logic ─────────────────────────────────────────────────
    function submitAnswer(answeredNew: boolean) {
      if (state !== 'playing' || playPhase !== 'responding') return;

      const responseTime = roundTimerMax - roundTimer;
      responseTimes.push(responseTime);

      const isActuallyNew = currentRoundType === 'new' || currentRoundType === 'decoy';
      const correct = answeredNew === isActuallyNew;

      if (correct) {
        totalCorrect++;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        const streakMult = Math.min(2.0, 1.0 + streak * 0.1);

        let base: number;
        if (currentRoundType === 'decoy' && answeredNew) {
          base = 200;
          decoysIdentified++;
          lastAnswerDetail = 'DECOY CAUGHT!';
          SoundEngine.play('collectPowerup');
        } else if (currentRoundType === 'repeat' && !answeredNew) {
          base = 150;
          lastAnswerDetail = 'SEEN BEFORE!';
          SoundEngine.play('collectGem');
        } else {
          base = 100;
          lastAnswerDetail = 'CORRECT!';
          SoundEngine.play('collectGem');
        }

        const timeRatio = clamp(roundTimer / roundTimerMax, 0, 1);
        const speedBonus = Math.round(100 * timeRatio * timeRatio);
        const pts = Math.round((base + speedBonus) * streakMult);
        score += pts;
        lastPoints = pts;
        lastAnswer = 'correct';

        // Streak milestone sounds
        if (streak === 5 || streak === 10) SoundEngine.play('comboUp');

        // Particles
        spawnParticles(W / 2, H / 2 - 40, TEAL, 15);
      } else {
        lives--;
        streak = 0;
        lastPoints = 0;
        lastAnswer = 'wrong';
        lastAnswerDetail = isActuallyNew ? 'IT WAS NEW' : 'YOU SAW IT';
        SoundEngine.play('playerDamage');
        shakeAmount = 8;
        shakeTimer = 0.3;
        lifeLostFlash = 0.5;
        spawnParticles(W / 2, H / 2 - 40, '#ef4444', 12);
      }

      // Add to seen pool if it was a genuinely new shape (includes decoys)
      if ((currentRoundType === 'new' || currentRoundType === 'decoy') && currentShape) {
        seenShapes.push(currentShape);
      }

      playPhase = 'feedback';
      phaseTimer = 0;
    }

    function handleTimeout() {
      responseTimes.push(roundTimerMax);
      lives--;
      streak = 0;
      lastPoints = 0;
      lastAnswer = 'timeout';
      lastAnswerDetail = 'TIME UP!';
      SoundEngine.play('spikeHit');
      shakeAmount = 6;
      shakeTimer = 0.3;
      lifeLostFlash = 0.5;

      if ((currentRoundType === 'new' || currentRoundType === 'decoy') && currentShape) {
        seenShapes.push(currentShape);
      }

      playPhase = 'feedback';
      phaseTimer = 0;
    }

    function endGame() {
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        setHighScore('deja-vu', score);
      }
      SoundEngine.play('gameOver');
    }

    // ─── Particles ────────────────────────────────────────────────────
    function spawnParticles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 180;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.6 + Math.random() * 0.4,
          maxLife: 0.6 + Math.random() * 0.4,
          color,
          size: 2 + Math.random() * 4,
        });
      }
    }

    function spawnScorePopup(x: number, y: number, text: string, color: string) {
      scorePopups.push({ x, y, text, color, life: 1.2 });
    }

    // ─── Update ───────────────────────────────────────────────────────
    function update(dt: number) {
      menuTime += dt;

      // Animated score counter
      displayScore = lerp(displayScore, score, Math.min(1, dt * 8));
      if (Math.abs(displayScore - score) < 1) displayScore = score;

      // Game over reveal timer
      if (state === 'gameover') gameOverTime += dt;

      // Life lost flash decay
      if (lifeLostFlash > 0) lifeLostFlash -= dt;

      // Particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 200 * dt; // gravity
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // Score popups
      for (let i = scorePopups.length - 1; i >= 0; i--) {
        const p = scorePopups[i];
        p.y -= 40 * dt;
        p.life -= dt;
        if (p.life <= 0) scorePopups.splice(i, 1);
      }

      // Shake
      if (shakeTimer > 0) {
        shakeTimer -= dt;
        if (shakeTimer <= 0) shakeAmount = 0;
      }

      if (state !== 'playing') return;

      phaseTimer += dt;

      switch (playPhase) {
        case 'entrance':
          if (phaseTimer >= ENTRANCE_DUR) {
            playPhase = 'viewing';
            phaseTimer = 0;
          }
          break;
        case 'viewing':
          // Brief moment to see the shape before timer starts
          if (phaseTimer >= 0.15) {
            playPhase = 'responding';
            phaseTimer = 0;
          }
          break;
        case 'responding':
          roundTimer -= dt;
          if (roundTimer <= 0) {
            roundTimer = 0;
            handleTimeout();
          }
          break;
        case 'feedback':
          if (phaseTimer >= FEEDBACK_DUR) {
            playPhase = 'exit';
            phaseTimer = 0;
          }
          break;
        case 'exit':
          if (phaseTimer >= EXIT_DUR) {
            round++;
            if (lives <= 0) {
              endGame();
            } else {
              nextRound();
            }
          }
          break;
      }
    }

    // ─── Draw helpers ─────────────────────────────────────────────────
    function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

    function drawButton(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, h: number, color: string, hover: boolean, rect: { x: number; y: number; w: number; h: number }) {
      rect.x = x; rect.y = y; rect.w = w; rect.h = h;
      ctx.save();
      if (hover) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
      }
      drawRoundedRect(ctx, x, y, w, h, 12);
      ctx.fillStyle = hover ? color : `${color}cc`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = `bold 20px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x + w / 2, y + h / 2);
      ctx.restore();
    }

    // ─── Draw ─────────────────────────────────────────────────────────
    function draw() {
      ctx.save();

      // Screen shake
      if (shakeAmount > 0) {
        const sx = (Math.random() - 0.5) * shakeAmount * 2;
        const sy = (Math.random() - 0.5) * shakeAmount * 2;
        ctx.translate(sx, sy);
      }

      // Background
      ctx.fillStyle = BG;
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Subtle background pattern
      ctx.globalAlpha = 0.03;
      for (let x = 0; x < W; x += 40) {
        for (let y = 0; y < H; y += 40) {
          ctx.fillStyle = (x + y) % 80 === 0 ? '#fff' : '#000';
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.globalAlpha = 1;

      if (state === 'menu') drawMenu();
      else if (state === 'playing') drawPlaying();
      else if (state === 'gameover') drawGameOver();

      // Particles
      for (const p of particles) {
        ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Score popups
      for (const p of scorePopups) {
        const alpha = clamp(p.life / 1.2, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;

      ctx.restore();
    }

    // ─── Menu screen ──────────────────────────────────────────────────
    function drawMenu() {
      // Animated shapes in background with individual bob
      for (let i = 0; i < menuShapes.length; i++) {
        const s = menuShapes[i];
        const angle = menuTime * 0.3 + (i * Math.PI * 2) / menuShapes.length;
        const bob = Math.sin(menuTime * 1.2 + i * 1.7) * 8;
        const x = W / 2 + Math.cos(angle) * 200;
        const y = H / 2 + Math.sin(angle) * 120 + bob;
        const pulse = 0.12 + 0.05 * Math.sin(menuTime * 0.8 + i * 2.1);
        ctx.globalAlpha = pulse;
        drawShape(ctx, s, x, y, 0.8);
        ctx.globalAlpha = 1;
      }

      // Title with glow
      ctx.save();
      ctx.shadowColor = TEAL;
      ctx.shadowBlur = 30;
      ctx.fillStyle = TEAL;
      ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Déjà Vu', W / 2, H / 2 - 100);
      ctx.restore();

      // Subtitle
      ctx.fillStyle = '#888';
      ctx.font = '18px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Have you seen this shape before?', W / 2, H / 2 - 55);

      // High score
      if (highScore > 0) {
        ctx.fillStyle = '#666';
        ctx.font = '15px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Best: ${highScore.toLocaleString()}`, W / 2, H / 2 - 25);
      }

      // Pulsing start button
      const btnPulse = Math.sin(menuTime * 2) * 0.15 + 0.85;
      const bw = 200, bh = 56;
      const bx = W / 2 - bw / 2, by = H / 2 + 20;
      ctx.save();
      ctx.globalAlpha = hoverStart ? 1 : btnPulse;
      drawButton(ctx, 'START', bx, by, bw, bh, TEAL, hoverStart, btnStartRect);
      ctx.restore();

      // Controls hint
      ctx.fillStyle = '#555';
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('N / ← = New    S / → = Seen    Enter = Start', W / 2, H / 2 + 110);
      ctx.fillText('30 rounds · 3 lives · Spot the decoys', W / 2, H / 2 + 135);
    }

    // ─── Playing screen ───────────────────────────────────────────────
    function drawPlaying() {
      if (!currentShape) return;

      // HUD - top bar
      // Round counter
      ctx.fillStyle = '#666';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Round ${round + 1}/${TOTAL_ROUNDS}`, 20, 30);

      // Lives with flash on loss
      for (let i = 0; i < 3; i++) {
        const lx = W / 2 - 30 + i * 25;
        const ly = 20;
        const isLostHeart = i === lives && lifeLostFlash > 0;
        if (isLostHeart) {
          const flash = Math.sin(lifeLostFlash * 20) * 0.5 + 0.5;
          ctx.fillStyle = `rgba(239, 68, 68, ${flash})`;
          ctx.font = `${18 + flash * 4}px system-ui, -apple-system, sans-serif`;
        } else {
          ctx.fillStyle = i < lives ? '#ef4444' : '#333';
          ctx.font = '18px system-ui, -apple-system, sans-serif';
        }
        ctx.textAlign = 'center';
        ctx.fillText('\u2665', lx, ly + 10);
      }

      // Animated score counter
      ctx.fillStyle = '#ccc';
      ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(displayScore).toLocaleString(), W - 20, 30);

      // Streak
      if (streak >= 2) {
        ctx.fillStyle = TEAL;
        ctx.font = 'bold 13px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'right';
        const mult = Math.min(2.0, 1.0 + streak * 0.1).toFixed(1);
        ctx.fillText(`🔥 x${streak} (${mult}x)`, W - 20, 50);
      }

      // Shape display area
      const shapeY = H / 2 - 50;

      // Radial gradient backdrop
      const grad = ctx.createRadialGradient(W / 2, shapeY, 0, W / 2, shapeY, 120);
      grad.addColorStop(0, 'rgba(20, 184, 166, 0.08)');
      grad.addColorStop(1, 'rgba(20, 184, 166, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, shapeY - 150, W, 300);

      // Breathing ring
      const ringPulse = 0.08 + 0.04 * Math.sin(menuTime * 1.5);
      ctx.strokeStyle = `rgba(20, 184, 166, ${ringPulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(W / 2, shapeY, 90 + Math.sin(menuTime * 1.5) * 3, 0, Math.PI * 2);
      ctx.stroke();

      // Shape with entrance/exit/breathing animation
      let shapeScale = 1;
      let shapeAlpha = 1;

      if (playPhase === 'entrance') {
        const t = clamp(phaseTimer / ENTRANCE_DUR, 0, 1);
        shapeScale = easeOutBack(t);
        shapeAlpha = t;
      } else if (playPhase === 'exit') {
        const t = clamp(phaseTimer / EXIT_DUR, 0, 1);
        shapeScale = 1 - easeInBack(t);
        shapeAlpha = 1 - t;
      } else if (playPhase === 'feedback') {
        if (lastAnswer === 'wrong' || lastAnswer === 'timeout') {
          shapeAlpha = 0.5;
        } else {
          // Gentle pulse on correct
          shapeScale = 1 + Math.sin(phaseTimer * 8) * 0.03;
        }
      } else if (playPhase === 'responding' || playPhase === 'viewing') {
        // Subtle breathing while waiting for answer
        shapeScale = 1 + Math.sin(menuTime * 2) * 0.015;
      }

      ctx.globalAlpha = shapeAlpha;
      drawShape(ctx, currentShape, W / 2, shapeY, shapeScale * 1.5);
      ctx.globalAlpha = 1;

      // Timer bar (below shape)
      if (playPhase === 'responding' || playPhase === 'viewing') {
        const barW = 300;
        const barH = 6;
        const barX = W / 2 - barW / 2;
        const barY = shapeY + 100;
        const ratio = clamp(roundTimer / roundTimerMax, 0, 1);

        // Bar background
        drawRoundedRect(ctx, barX, barY, barW, barH, 3);
        ctx.fillStyle = '#222';
        ctx.fill();

        // Bar fill with urgency glow
        const timerColor = ratio > 0.5 ? TEAL : ratio > 0.25 ? '#eab308' : '#ef4444';
        ctx.save();
        if (ratio <= 0.25) {
          const urgencyPulse = 0.5 + 0.5 * Math.sin(menuTime * 10);
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 8 + urgencyPulse * 8;
        }
        if (barW * ratio > 1) {
          drawRoundedRect(ctx, barX, barY, barW * ratio, barH, 3);
          ctx.fillStyle = timerColor;
          ctx.fill();
        }
        ctx.restore();

        // Timer text
        const timerTextColor = ratio <= 0.25 ? '#ef4444' : '#888';
        ctx.fillStyle = timerTextColor;
        ctx.font = `${ratio <= 0.25 ? 'bold ' : ''}12px system-ui, -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${roundTimer.toFixed(1)}s`, W / 2, barY + 22);
      }

      // Feedback overlay
      if (playPhase === 'feedback') {
        ctx.textAlign = 'center';
        if (lastAnswer === 'correct') {
          ctx.fillStyle = TEAL;
          ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
          ctx.fillText(lastAnswerDetail, W / 2, shapeY + 110);
          if (lastPoints > 0) {
            ctx.fillStyle = '#aaa';
            ctx.font = '18px system-ui, -apple-system, sans-serif';
            ctx.fillText(`+${lastPoints}`, W / 2, shapeY + 140);
          }
        } else {
          ctx.fillStyle = '#ef4444';
          ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
          ctx.fillText(lastAnswerDetail, W / 2, shapeY + 110);
          ctx.fillStyle = '#888';
          ctx.font = '16px system-ui, -apple-system, sans-serif';
          ctx.fillText('-1 ♥', W / 2, shapeY + 140);
        }
      }

      // Response buttons (only during responding phase)
      if (playPhase === 'responding') {
        const bw = 140, bh = 56;
        const gap = 40;
        const totalW = bw * 2 + gap;
        const bx = W / 2 - totalW / 2;
        const by = H - 90;

        drawButton(ctx, 'NEW (N)', bx, by, bw, bh, '#3b82f6', hoverNew, btnNewRect);
        drawButton(ctx, 'SEEN (S)', bx + bw + gap, by, bw, bh, '#f59e0b', hoverSeen, btnSeenRect);

        // Keyboard hint
        ctx.fillStyle = '#444';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('← or N', bx + bw / 2, by + bh + 16);
        ctx.fillText('→ or S', bx + bw + gap + bw / 2, by + bh + 16);
      }
    }

    // ─── Game over screen ─────────────────────────────────────────────
    function drawGameOver() {
      // Floating background shapes
      for (let i = 0; i < menuShapes.length; i++) {
        const s = menuShapes[i];
        const angle = menuTime * 0.15 + (i * Math.PI * 2) / menuShapes.length;
        const x = W / 2 + Math.cos(angle) * 280;
        const y = H / 2 + Math.sin(angle) * 180;
        ctx.globalAlpha = 0.06;
        drawShape(ctx, s, x, y, 0.6);
        ctx.globalAlpha = 1;
      }

      // Fade-in title (phase 1: 0-0.3s)
      const titleAlpha = clamp(gameOverTime / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = titleAlpha;
      ctx.shadowColor = TEAL;
      ctx.shadowBlur = 20;
      ctx.fillStyle = TEAL;
      ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', W / 2, 90);
      ctx.restore();

      // Fade-in score (phase 2: 0.2-0.6s)
      const scoreAlpha = clamp((gameOverTime - 0.2) / 0.4, 0, 1);
      ctx.globalAlpha = scoreAlpha;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(score.toLocaleString(), W / 2, 160);

      if (score >= highScore && score > 0) {
        const pulse = 0.7 + 0.3 * Math.sin(menuTime * 3);
        ctx.globalAlpha = scoreAlpha * pulse;
        ctx.save();
        ctx.shadowColor = TEAL;
        ctx.shadowBlur = 15;
        ctx.fillStyle = TEAL;
        ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        ctx.fillText('NEW HIGH SCORE!', W / 2, 195);
        ctx.restore();
      } else if (highScore > 0) {
        ctx.fillStyle = '#666';
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Best: ${highScore.toLocaleString()}`, W / 2, 195);
      }
      ctx.globalAlpha = 1;

      // Stats with staggered reveal (phase 3: 0.5-1.2s)
      const statsY = 235;
      const stats = [
        { label: 'Rounds', value: `${round}/${TOTAL_ROUNDS}` },
        { label: 'Accuracy', value: `${responseTimes.length > 0 ? Math.round((totalCorrect / responseTimes.length) * 100) : 0}%` },
        { label: 'Best Streak', value: `${bestStreak}` },
        { label: 'Decoys Caught', value: `${decoysIdentified}` },
        { label: 'Avg Response', value: `${responseTimes.length > 0 ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2) : 0}s` },
      ];

      const statW = 130;
      const totalStatsW = stats.length * statW;
      const startX = W / 2 - totalStatsW / 2;

      for (let i = 0; i < stats.length; i++) {
        const statDelay = 0.5 + i * 0.12;
        const statAlpha = clamp((gameOverTime - statDelay) / 0.3, 0, 1);
        const slideUp = (1 - statAlpha) * 15;
        ctx.globalAlpha = statAlpha;

        const sx = startX + i * statW + statW / 2;

        // Stat box background
        drawRoundedRect(ctx, sx - 55, statsY + slideUp, 110, 70, 8);
        ctx.fillStyle = '#151515';
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = TEAL;
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(stats[i].value, sx, statsY + 30 + slideUp);

        ctx.fillStyle = '#666';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.fillText(stats[i].label, sx, statsY + 52 + slideUp);
      }
      ctx.globalAlpha = 1;

      // Play again button (phase 4: 1.2s+)
      const btnAlpha = clamp((gameOverTime - 1.2) / 0.3, 0, 1);
      const bw = 200, bh = 56;
      const bx = W / 2 - bw / 2, by = statsY + 100;
      ctx.globalAlpha = btnAlpha;
      drawButton(ctx, 'PLAY AGAIN', bx, by, bw, bh, TEAL, hoverPlayAgain, btnPlayAgainRect);

      ctx.fillStyle = '#555';
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press Enter or Space to play again', W / 2, by + bh + 25);
      ctx.globalAlpha = 1;
    }

    // ─── Input handlers ───────────────────────────────────────────────
    function getCanvasPos(e: MouseEvent | Touch): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function handleMouseMove(e: MouseEvent) {
      const pos = getCanvasPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      const prevNew = hoverNew;
      const prevSeen = hoverSeen;
      const prevStart = hoverStart;
      const prevPlayAgain = hoverPlayAgain;

      hoverNew = state === 'playing' && playPhase === 'responding' && inRect(mouseX, mouseY, btnNewRect);
      hoverSeen = state === 'playing' && playPhase === 'responding' && inRect(mouseX, mouseY, btnSeenRect);
      hoverStart = state === 'menu' && inRect(mouseX, mouseY, btnStartRect);
      hoverPlayAgain = state === 'gameover' && inRect(mouseX, mouseY, btnPlayAgainRect);

      if ((hoverNew && !prevNew) || (hoverSeen && !prevSeen) || (hoverStart && !prevStart) || (hoverPlayAgain && !prevPlayAgain)) {
        SoundEngine.play('click');
      }

      canvas!.style.cursor = (hoverNew || hoverSeen || hoverStart || hoverPlayAgain) ? 'pointer' : 'default';
    }

    function handleMouseDown(e: MouseEvent) {
      const pos = getCanvasPos(e);
      mouseX = pos.x;
      mouseY = pos.y;

      if (state === 'menu' && inRect(mouseX, mouseY, btnStartRect)) {
        startGame();
        return;
      }

      if (state === 'gameover' && inRect(mouseX, mouseY, btnPlayAgainRect)) {
        startGame();
        return;
      }

      if (state === 'playing' && playPhase === 'responding') {
        if (inRect(mouseX, mouseY, btnNewRect)) {
          submitAnswer(true);
          if (lastAnswer === 'correct') spawnScorePopup(W / 2, H / 2 - 60, `+${lastPoints}`, TEAL);
        } else if (inRect(mouseX, mouseY, btnSeenRect)) {
          submitAnswer(false);
          if (lastAnswer === 'correct') spawnScorePopup(W / 2, H / 2 - 60, `+${lastPoints}`, TEAL);
        }
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      // Prevent scrolling
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (state === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') {
          startGame();
        }
        return;
      }

      if (state === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          startGame();
        }
        return;
      }

      if (state === 'playing' && playPhase === 'responding') {
        if (e.key === 'n' || e.key === 'N' || e.key === 'ArrowLeft') {
          submitAnswer(true);
          if (lastAnswer === 'correct') spawnScorePopup(W / 2, H / 2 - 60, `+${lastPoints}`, TEAL);
        } else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowRight') {
          submitAnswer(false);
          if (lastAnswer === 'correct') spawnScorePopup(W / 2, H / 2 - 60, `+${lastPoints}`, TEAL);
        }
      }
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length === 0) return;
      const pos = getCanvasPos(e.touches[0]);
      mouseX = pos.x;
      mouseY = pos.y;

      if (state === 'menu' && inRect(mouseX, mouseY, btnStartRect)) {
        startGame();
        return;
      }

      if (state === 'gameover' && inRect(mouseX, mouseY, btnPlayAgainRect)) {
        startGame();
        return;
      }

      if (state === 'playing' && playPhase === 'responding') {
        if (inRect(mouseX, mouseY, btnNewRect)) {
          submitAnswer(true);
          if (lastAnswer === 'correct') spawnScorePopup(W / 2, H / 2 - 60, `+${lastPoints}`, TEAL);
        } else if (inRect(mouseX, mouseY, btnSeenRect)) {
          submitAnswer(false);
          if (lastAnswer === 'correct') spawnScorePopup(W / 2, H / 2 - 60, `+${lastPoints}`, TEAL);
        }
      }
    }

    // ─── Animation loop ───────────────────────────────────────────────
    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      update(dt);
      draw();
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);

    // ─── Event listeners ──────────────────────────────────────────────
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('keydown', handleKeyDown);
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
      }}
    />
  );
}
