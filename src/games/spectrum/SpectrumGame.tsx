'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';

// ─── Constants ────────────────────────────────────────────────────────────────
const W = 800;
const H = 600;
const ORANGE = '#f97316';
const ORANGE_DIM = '#c2410c';
const TOTAL_ROUNDS = 15;
const MAX_BASE_SCORE = 1000;
const CHAIN_THRESHOLD = 0.15; // within 15% of range = accurate
const HIGH_CONF_MIN = 3; // 3x+ = high confidence

// ─── Question bank ────────────────────────────────────────────────────────────
interface Question {
  text: string;
  answer: number;
  min: number;
  max: number;
  unit: string;
  category: string;
}

const QUESTIONS: Question[] = [
  // Geography
  { text: 'What % of Earth\'s surface is covered by water?', answer: 71, min: 0, max: 100, unit: '%', category: 'Geography' },
  { text: 'How many countries are in Africa?', answer: 54, min: 10, max: 100, unit: '', category: 'Geography' },
  { text: 'What is the depth of the Mariana Trench in meters?', answer: 10994, min: 5000, max: 15000, unit: 'm', category: 'Geography' },
  { text: 'What % of Earth\'s land is desert?', answer: 33, min: 0, max: 100, unit: '%', category: 'Geography' },
  { text: 'How long is the Nile River in kilometers?', answer: 6650, min: 3000, max: 10000, unit: 'km', category: 'Geography' },
  { text: 'How many time zones does Russia span?', answer: 11, min: 1, max: 20, unit: '', category: 'Geography' },
  { text: 'What % of the world\'s population lives in Asia?', answer: 60, min: 20, max: 90, unit: '%', category: 'Geography' },
  { text: 'How tall is Mount Everest in meters?', answer: 8849, min: 5000, max: 12000, unit: 'm', category: 'Geography' },

  // Science
  { text: 'What is the speed of light in thousands of km/s?', answer: 300, min: 100, max: 500, unit: 'k km/s', category: 'Science' },
  { text: 'What is the boiling point of water in Fahrenheit?', answer: 212, min: 100, max: 400, unit: '\u00b0F', category: 'Science' },
  { text: 'How many elements are on the periodic table?', answer: 118, min: 50, max: 200, unit: '', category: 'Science' },
  { text: 'What % of the atmosphere is nitrogen?', answer: 78, min: 20, max: 100, unit: '%', category: 'Science' },
  { text: 'At what temperature (C) does gold melt?', answer: 1064, min: 500, max: 2000, unit: '\u00b0C', category: 'Science' },
  { text: 'How many bones does a shark have?', answer: 0, min: 0, max: 300, unit: '', category: 'Science' },
  { text: 'What is the pH of pure water?', answer: 7, min: 0, max: 14, unit: '', category: 'Science' },
  { text: 'How many teeth does an adult human have?', answer: 32, min: 10, max: 60, unit: '', category: 'Science' },

  // Space
  { text: 'How many moons does Jupiter have?', answer: 95, min: 10, max: 150, unit: '', category: 'Space' },
  { text: 'How old is the Sun in billions of years?', answer: 4.6, min: 1, max: 10, unit: 'B yrs', category: 'Space' },
  { text: 'How many minutes does sunlight take to reach Earth?', answer: 8, min: 1, max: 30, unit: 'min', category: 'Space' },
  { text: 'What is the surface temperature of the Sun in \u00b0C?', answer: 5500, min: 1000, max: 10000, unit: '\u00b0C', category: 'Space' },
  { text: 'How many planets in our solar system?', answer: 8, min: 1, max: 15, unit: '', category: 'Space' },
  { text: 'How far is the Moon from Earth in thousands of km?', answer: 384, min: 100, max: 800, unit: 'k km', category: 'Space' },
  { text: 'What % of the universe is dark energy?', answer: 68, min: 10, max: 100, unit: '%', category: 'Space' },
  { text: 'How many Earth days is a year on Mars?', answer: 687, min: 200, max: 1200, unit: 'days', category: 'Space' },

  // History
  { text: 'In what year did World War II end?', answer: 1945, min: 1900, max: 2000, unit: '', category: 'History' },
  { text: 'How many years did the Roman Empire last?', answer: 503, min: 100, max: 1000, unit: 'yrs', category: 'History' },
  { text: 'In what year was the first iPhone released?', answer: 2007, min: 1990, max: 2020, unit: '', category: 'History' },
  { text: 'How old were the Egyptian pyramids when Cleopatra was born? (years)', answer: 2500, min: 500, max: 5000, unit: 'yrs', category: 'History' },
  { text: 'In what year did humans first walk on the Moon?', answer: 1969, min: 1950, max: 2000, unit: '', category: 'History' },
  { text: 'How many years ago was the printing press invented?', answer: 581, min: 200, max: 1000, unit: 'yrs', category: 'History' },
  { text: 'In what year did the Titanic sink?', answer: 1912, min: 1850, max: 1950, unit: '', category: 'History' },
  { text: 'How many people signed the US Declaration of Independence?', answer: 56, min: 10, max: 200, unit: '', category: 'History' },

  // Pop Culture
  { text: 'How many episodes of The Simpsons have aired (approx)?', answer: 770, min: 200, max: 1200, unit: '', category: 'Pop Culture' },
  { text: 'How many Marvel Cinematic Universe films (through 2024)?', answer: 34, min: 10, max: 60, unit: '', category: 'Pop Culture' },
  { text: 'In what year was Minecraft first released?', answer: 2011, min: 2000, max: 2020, unit: '', category: 'Pop Culture' },
  { text: 'How many Harry Potter books are there?', answer: 7, min: 1, max: 15, unit: '', category: 'Pop Culture' },
  { text: 'How many No. 1 hits did The Beatles have in the US?', answer: 20, min: 5, max: 50, unit: '', category: 'Pop Culture' },
  { text: 'What year was YouTube founded?', answer: 2005, min: 1995, max: 2015, unit: '', category: 'Pop Culture' },
  { text: 'How many Oscar nominations does Meryl Streep have?', answer: 21, min: 5, max: 40, unit: '', category: 'Pop Culture' },
  { text: 'How many copies has Minecraft sold (millions)?', answer: 300, min: 50, max: 500, unit: 'M', category: 'Pop Culture' },

  // Human Body
  { text: 'How many liters of blood are in the average adult body?', answer: 5, min: 1, max: 15, unit: 'L', category: 'Human Body' },
  { text: 'How many bones are in the human body?', answer: 206, min: 100, max: 400, unit: '', category: 'Human Body' },
  { text: 'What % of the human body is water?', answer: 60, min: 20, max: 90, unit: '%', category: 'Human Body' },
  { text: 'How many times does the heart beat per day (thousands)?', answer: 100, min: 30, max: 200, unit: 'k', category: 'Human Body' },
  { text: 'How many taste buds does the average person have?', answer: 10000, min: 2000, max: 20000, unit: '', category: 'Human Body' },
  { text: 'How long is the small intestine in meters?', answer: 6, min: 1, max: 15, unit: 'm', category: 'Human Body' },
  { text: 'How many muscles are in the human body?', answer: 600, min: 200, max: 1000, unit: '', category: 'Human Body' },
  { text: 'Average body temperature in Fahrenheit?', answer: 98.6, min: 90, max: 110, unit: '\u00b0F', category: 'Human Body' },

  // Food
  { text: 'How many calories are in a Big Mac?', answer: 550, min: 200, max: 1000, unit: 'cal', category: 'Food' },
  { text: 'What % of a watermelon is water?', answer: 92, min: 50, max: 100, unit: '%', category: 'Food' },
  { text: 'How many grapes does it take to make a bottle of wine?', answer: 600, min: 100, max: 1500, unit: '', category: 'Food' },
  { text: 'How many cocoa beans to make 1 pound of chocolate?', answer: 400, min: 50, max: 1000, unit: '', category: 'Food' },
  { text: 'What temperature (F) should you cook a chicken to?', answer: 165, min: 100, max: 300, unit: '\u00b0F', category: 'Food' },
  { text: 'How many different varieties of cheese exist worldwide?', answer: 1800, min: 500, max: 5000, unit: '', category: 'Food' },
  { text: 'How many kernels are on an average ear of corn?', answer: 800, min: 200, max: 1500, unit: '', category: 'Food' },
  { text: 'What % of the world\'s food is produced by small farms?', answer: 35, min: 5, max: 80, unit: '%', category: 'Food' },

  // Technology
  { text: 'In what year was the World Wide Web invented?', answer: 1989, min: 1970, max: 2000, unit: '', category: 'Technology' },
  { text: 'How many transistors (billions) in Apple\'s M2 chip?', answer: 20, min: 1, max: 50, unit: 'B', category: 'Technology' },
  { text: 'How many people use the internet worldwide (billions)?', answer: 5.3, min: 1, max: 8, unit: 'B', category: 'Technology' },
  { text: 'How many emails are sent globally per day (billions)?', answer: 330, min: 50, max: 500, unit: 'B', category: 'Technology' },
  { text: 'What year was Bitcoin created?', answer: 2009, min: 2000, max: 2020, unit: '', category: 'Technology' },
  { text: 'How much data (zettabytes) does the world create per year?', answer: 120, min: 10, max: 300, unit: 'ZB', category: 'Technology' },
  { text: 'How many apps are on the Apple App Store (millions)?', answer: 1.8, min: 0.5, max: 5, unit: 'M', category: 'Technology' },
  { text: 'What % of the world\'s electricity is from renewables?', answer: 30, min: 5, max: 80, unit: '%', category: 'Technology' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SpectrumGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    // Scale canvas for high-DPI displays to prevent pixelation
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // ── Game state ──────────────────────────────────────────────────────────
    type GameState = 'menu' | 'playing' | 'betting' | 'reveal' | 'roundEnd' | 'gameover';
    let state: GameState = 'menu';

    let questions: Question[] = [];
    let round = 0;
    let totalScore = 0;
    let highScore = getHighScore('spectrum');
    let newHighScore = false;

    // Current round state
    let currentQ: Question = QUESTIONS[0];
    let estimate = 0.5; // 0-1 normalized position on the number line
    let confidence = 1;  // 1-5
    let dragging = false;
    let estimateLocked = false;

    // Scoring
    let roundBaseScore = 0;
    let roundMultipliedScore = 0;
    let chainLength = 0;
    let chainBonus = 0;
    let chainBroken = false;
    let bestChain = 0;
    let roundAccuracy = 0; // 0-1

    // Animations
    let revealProgress = 0;  // 0-1
    let revealPhase: 'slide' | 'score' | 'done' = 'slide';
    let shakeTime = 0;
    let shakeIntensity = 0;
    let menuPulse = 0;

    // Particles
    interface Particle {
      x: number; y: number; vx: number; vy: number;
      life: number; maxLife: number; color: string; size: number;
    }
    let particles: Particle[] = [];

    // Score display
    let displayScore = 0;
    let scorePopups: { text: string; x: number; y: number; life: number; color: string }[] = [];

    // Hover states
    let hoveredConfidence = 0;
    let hoverStartBtn = false;
    let hoverPlayAgain = false;
    let hoverContinue = false;
    let hoverLockIn = false;

    // Per-round tracking for game over stats
    let perfectCount = 0;
    let totalAccuracy = 0;

    // Background ambient particles
    interface AmbientParticle {
      x: number; y: number; vx: number; vy: number;
      size: number; color: string; alpha: number; phase: number;
    }
    const ambientParticles: AmbientParticle[] = [];
    function initAmbientParticles() {
      ambientParticles.length = 0;
      const colors = ['#f9731620', '#22c55e15', '#eab30815', '#ef444415', '#84cc1615'];
      for (let i = 0; i < 25; i++) {
        ambientParticles.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 8,
          size: 2 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          alpha: 0.1 + Math.random() * 0.25,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }
    initAmbientParticles();


    // ── Layout constants ────────────────────────────────────────────────────
    const NL_X = 100;       // number line left
    const NL_RIGHT = 700;   // number line right
    const NL_W = NL_RIGHT - NL_X;
    const NL_Y = 310;       // number line Y position
    const MARKER_R = 14;

    const CONF_Y = 420;     // confidence buttons Y
    const CONF_BTN_W = 80;
    const CONF_BTN_H = 50;
    const CONF_GAP = 16;
    const CONF_TOTAL_W = 5 * CONF_BTN_W + 4 * CONF_GAP;
    const CONF_START_X = (W - CONF_TOTAL_W) / 2;

    const CONF_COLORS = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
    const CONF_LABELS = ['1x Safe', '2x Mild', '3x Bold', '4x Nerve', '5x MAX'];

    // ── Utility: number line value <-> pixel ────────────────────────────────
    function valueToX(val: number, q: Question): number {
      return NL_X + ((val - q.min) / (q.max - q.min)) * NL_W;
    }
    function xToNorm(x: number): number {
      return clamp((x - NL_X) / NL_W, 0, 1);
    }
    function normToValue(norm: number, q: Question): number {
      return q.min + norm * (q.max - q.min);
    }

    // ── Start game ──────────────────────────────────────────────────────────
    function startGame() {
      questions = shuffle(QUESTIONS).slice(0, TOTAL_ROUNDS);
      round = 0;
      totalScore = 0;
      displayScore = 0;
      chainLength = 0;
      bestChain = 0;
      perfectCount = 0;
      totalAccuracy = 0;
      newHighScore = false;
      scorePopups = [];
      particles = [];
      initAmbientParticles();
      startRound();
    }

    function startRound() {
      currentQ = questions[round];
      estimate = 0.5;
      confidence = 1;
      estimateLocked = false;
      dragging = false;
      chainBroken = false;
      roundBaseScore = 0;
      roundMultipliedScore = 0;
      chainBonus = 0;
      roundAccuracy = 0;
      revealProgress = 0;
      revealPhase = 'slide';
      hoveredConfidence = 0;
      hoverContinue = false;
      hoverLockIn = false;
      revealScoreDisplay = 0;
      revealScoreTarget = 0;
      state = 'playing';
      SoundEngine.play('waveStart');
    }

    // ── Scoring ─────────────────────────────────────────────────────────────
    function calculateScore() {
      const range = currentQ.max - currentQ.min;
      const estimatedValue = normToValue(estimate, currentQ);
      const distance = Math.abs(estimatedValue - currentQ.answer);
      roundAccuracy = 1 - clamp(distance / range, 0, 1);
      // Quadratic curve: very close = high points, far = very low
      roundBaseScore = Math.round(MAX_BASE_SCORE * roundAccuracy * roundAccuracy);

      const isAccurate = (distance / range) <= CHAIN_THRESHOLD;
      const isHighConf = confidence >= HIGH_CONF_MIN;

      roundMultipliedScore = roundBaseScore * confidence;

      // Chain logic
      if (isHighConf) {
        if (isAccurate) {
          chainLength++;
          if (chainLength > bestChain) bestChain = chainLength;
          chainBonus = Math.round(100 * Math.pow(chainLength, 1.5));
          roundMultipliedScore += chainBonus;
          chainBroken = false;
        } else {
          // Chain break!
          chainBroken = true;
          chainLength = 0;
          chainBonus = 0;
          roundMultipliedScore = Math.round(roundBaseScore * confidence * 0.5);
        }
      }
      // Safe play (1x-2x) doesn't affect chain

      // Track stats
      totalAccuracy += roundAccuracy;
      if (roundAccuracy >= 0.98) perfectCount++;
      revealScoreTarget = roundMultipliedScore;

      totalScore += roundMultipliedScore;

      if (totalScore > highScore) {
        highScore = totalScore;
        newHighScore = true;
        setHighScore('spectrum', highScore);
      }
    }

    // ── Spawn particles ─────────────────────────────────────────────────────
    function spawnParticles(x: number, y: number, count: number, color: string, spread = 3) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.5 + Math.random() * spread) * 60;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.5 + Math.random() * 0.8,
          maxLife: 0.5 + Math.random() * 0.8,
          color,
          size: 2 + Math.random() * 4,
        });
      }
    }

    // ── Draw helpers ────────────────────────────────────────────────────────
    function drawRoundedRect(x: number, y: number, w: number, h: number, r: number) {
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

    function drawGlow(x: number, y: number, r: number, color: string, alpha: number) {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color + Math.round(alpha * 255).toString(16).padStart(2, '0'));
      grad.addColorStop(1, color + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Draw Menu ───────────────────────────────────────────────────────────
    function drawMenu(dt: number) {
      menuPulse += dt * 2;

      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0a0a0a');
      bgGrad.addColorStop(1, '#1a0a00');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Decorative spectrum bar
      const specGrad = ctx.createLinearGradient(100, 0, 700, 0);
      specGrad.addColorStop(0, '#22c55e');
      specGrad.addColorStop(0.25, '#84cc16');
      specGrad.addColorStop(0.5, '#eab308');
      specGrad.addColorStop(0.75, '#f97316');
      specGrad.addColorStop(1, '#ef4444');
      ctx.fillStyle = specGrad;
      ctx.fillRect(100, 200, 600, 4);

      // Animated glow dot on the spectrum
      const dotX = 100 + (Math.sin(menuPulse) * 0.5 + 0.5) * 600;
      drawGlow(dotX, 202, 30, ORANGE, 0.6);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(dotX, 202, 5, 0, Math.PI * 2);
      ctx.fill();

      // Title
      ctx.textAlign = 'center';
      ctx.fillStyle = ORANGE;
      ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
      ctx.fillText('SPECTRUM', W / 2, 160);

      // Subtitle
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '18px system-ui, -apple-system, sans-serif';
      ctx.fillText('Estimation + Confidence Quiz', W / 2, 250);

      // How to play
      ctx.fillStyle = '#737373';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      const lines = [
        'Place your estimate on the number line',
        'Bet your confidence from 1x (safe) to 5x (nerve)',
        'Build chain combos with bold, accurate guesses',
      ];
      lines.forEach((l, i) => {
        ctx.fillText(l, W / 2, 300 + i * 24);
      });

      // Start button
      const btnW = 200, btnH = 56, btnX = W / 2 - btnW / 2, btnY = 400;
      const pulse = Math.sin(menuPulse * 2) * 0.15 + 0.85;
      if (hoverStartBtn) {
        drawGlow(W / 2, btnY + btnH / 2, 60, ORANGE, 0.3);
      }
      ctx.globalAlpha = pulse;
      drawRoundedRect(btnX, btnY, btnW, btnH, 12);
      ctx.fillStyle = hoverStartBtn ? '#fb923c' : ORANGE;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#000';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('START GAME', W / 2, btnY + 35);

      // High score
      if (highScore > 0) {
        ctx.fillStyle = '#737373';
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.fillText(`High Score: ${highScore.toLocaleString()}`, W / 2, 500);
      }

      // Controls hint
      ctx.fillStyle = '#525252';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText('Drag marker \u2022 Arrow keys to nudge \u2022 1-5 for confidence \u2022 Enter to confirm', W / 2, 560);
    }

    // ── Draw HUD ────────────────────────────────────────────────────────────
    function drawHUD() {
      // Round counter
      ctx.textAlign = 'left';
      ctx.fillStyle = '#737373';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Round ${round + 1} / ${TOTAL_ROUNDS}`, 20, 30);

      // Category badge
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      const catText = currentQ.category;
      const catMetrics = ctx.measureText(catText);
      ctx.fillStyle = ORANGE + '33';
      drawRoundedRect(20, 38, catMetrics.width + 16, 24, 6);
      ctx.fill();
      ctx.fillStyle = ORANGE;
      ctx.fillText(catText, 28, 55);

      // Score
      ctx.textAlign = 'right';
      ctx.fillStyle = '#e5e5e5';
      ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
      ctx.fillText(Math.round(displayScore).toLocaleString(), W - 20, 30);

      ctx.fillStyle = '#737373';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      ctx.fillText('SCORE', W - 20, 48);

      // Round progress dots
      const dotStartX = W / 2 - (TOTAL_ROUNDS * 14) / 2;
      for (let i = 0; i < TOTAL_ROUNDS; i++) {
        const dx = dotStartX + i * 14;
        ctx.beginPath();
        ctx.arc(dx + 4, 26, 4, 0, Math.PI * 2);
        if (i < round) {
          ctx.fillStyle = ORANGE;
        } else if (i === round) {
          ctx.fillStyle = '#f5f5f5';
        } else {
          ctx.fillStyle = '#333';
        }
        ctx.fill();
      }

      // Chain indicator
      if (chainLength > 0) {
        const chainText = `CHAIN x${chainLength}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        ctx.fillText(chainText, W - 20, 72);

        // Fire glow effect
        drawGlow(W - 40, 66, 20, '#ef4444', 0.3 + Math.sin(Date.now() / 200) * 0.15);
      }
    }

    // ── Draw Number Line ────────────────────────────────────────────────────
    function drawNumberLine(showAnswer: boolean, animT: number) {
      // Track background
      ctx.fillStyle = '#262626';
      drawRoundedRect(NL_X - 10, NL_Y - 6, NL_W + 20, 12, 6);
      ctx.fill();

      // Gradient fill on the track
      const trackGrad = ctx.createLinearGradient(NL_X, 0, NL_RIGHT, 0);
      trackGrad.addColorStop(0, '#22c55e33');
      trackGrad.addColorStop(0.5, '#eab30833');
      trackGrad.addColorStop(1, '#ef444433');
      ctx.fillStyle = trackGrad;
      drawRoundedRect(NL_X - 10, NL_Y - 6, NL_W + 20, 12, 6);
      ctx.fill();

      // Tick marks
      const range = currentQ.max - currentQ.min;
      const step = calculateTickStep(range);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#525252';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      for (let v = currentQ.min; v <= currentQ.max; v += step) {
        const x = valueToX(v, currentQ);
        ctx.fillRect(x - 0.5, NL_Y - 10, 1, 20);
        ctx.fillText(formatNumber(v), x, NL_Y + 28);
      }

      // Min/Max labels
      ctx.fillStyle = '#737373';
      ctx.textAlign = 'left';
      ctx.fillText(`${formatNumber(currentQ.min)}${currentQ.unit}`, NL_X - 10, NL_Y + 45);
      ctx.textAlign = 'right';
      ctx.fillText(`${formatNumber(currentQ.max)}${currentQ.unit}`, NL_RIGHT + 10, NL_Y + 45);

      // Answer marker (revealed)
      if (showAnswer) {
        const ansX = valueToX(currentQ.answer, currentQ);
        const revealX = lerp(NL_X, ansX, clamp(animT * 2, 0, 1));

        // Green glow
        drawGlow(revealX, NL_Y, 30, '#22c55e', 0.5);

        // Green line
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(revealX, NL_Y - 20);
        ctx.lineTo(revealX, NL_Y + 20);
        ctx.stroke();

        // Answer label
        if (animT > 0.5) {
          const labelAlpha = clamp((animT - 0.5) * 4, 0, 1);
          ctx.globalAlpha = labelAlpha;
          ctx.textAlign = 'center';
          ctx.fillStyle = '#22c55e';
          ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
          ctx.fillText(`${formatNumber(currentQ.answer)}${currentQ.unit}`, ansX, NL_Y - 30);
          ctx.globalAlpha = 1;
        }
      }

      // Chain accuracy zone (shown during betting phase)
      if (state === 'betting' && confidence >= HIGH_CONF_MIN) {
        const range = currentQ.max - currentQ.min;
        const zonePixels = (CHAIN_THRESHOLD * range / range) * NL_W;
        const estX = NL_X + estimate * NL_W;
        const zoneLeft = Math.max(NL_X, estX - zonePixels);
        const zoneRight = Math.min(NL_RIGHT, estX + zonePixels);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = CONF_COLORS[confidence - 1];
        ctx.fillRect(zoneLeft, NL_Y - 18, zoneRight - zoneLeft, 36);
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = CONF_COLORS[confidence - 1];
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(zoneLeft, NL_Y - 18, zoneRight - zoneLeft, 36);
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Player estimate marker
      const estX = NL_X + estimate * NL_W;
      if (!showAnswer || animT < 1) {
        // Glow
        drawGlow(estX, NL_Y, 25, ORANGE, dragging ? 0.6 : 0.3);
      }

      // Marker circle
      ctx.beginPath();
      ctx.arc(estX, NL_Y, MARKER_R, 0, Math.PI * 2);
      ctx.fillStyle = estimateLocked ? ORANGE_DIM : (dragging ? '#fb923c' : ORANGE);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Floating value tooltip above marker
      const estValue = normToValue(estimate, currentQ);
      const displayVal = formatNumber(Math.round(estValue * 10) / 10);
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
      const tooltipW = ctx.measureText(displayVal + (currentQ.unit ? currentQ.unit : '')).width + 16;
      const tooltipH = 26;
      const tooltipX = estX - tooltipW / 2;
      const tooltipY = NL_Y - MARKER_R - tooltipH - 8;

      // Tooltip background
      drawRoundedRect(tooltipX, tooltipY, tooltipW, tooltipH, 6);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
      ctx.strokeStyle = estimateLocked ? ORANGE_DIM : ORANGE;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Tooltip arrow
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.moveTo(estX - 5, tooltipY + tooltipH);
      ctx.lineTo(estX, tooltipY + tooltipH + 5);
      ctx.lineTo(estX + 5, tooltipY + tooltipH);
      ctx.fill();

      // Tooltip text
      ctx.fillStyle = estimateLocked ? ORANGE_DIM : '#f5f5f5';
      ctx.fillText(displayVal + (currentQ.unit ? currentQ.unit : ''), estX, tooltipY + 18);

      // If showing answer, draw distance line between estimate and answer
      if (showAnswer && animT > 0.6) {
        const ansX = valueToX(currentQ.answer, currentQ);
        const lineAlpha = clamp((animT - 0.6) * 3, 0, 1);
        ctx.globalAlpha = lineAlpha * 0.5;
        ctx.strokeStyle = chainBroken ? '#ef4444' : '#eab308';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(estX, NL_Y);
        ctx.lineTo(ansX, NL_Y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    function calculateTickStep(range: number): number {
      const targetTicks = 8;
      const rough = range / targetTicks;
      const mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const residual = rough / mag;
      if (residual <= 1.5) return mag;
      if (residual <= 3.5) return 2 * mag;
      if (residual <= 7.5) return 5 * mag;
      return 10 * mag;
    }

    // ── Draw Question ───────────────────────────────────────────────────────
    function drawQuestion() {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#f5f5f5';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';

      // Word wrap
      const maxWidth = 650;
      const words = currentQ.text.split(' ');
      let line = '';
      const lines: string[] = [];
      for (const word of words) {
        const test = line + (line ? ' ' : '') + word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      lines.push(line);

      const lineHeight = 30;
      const startY = 110 - ((lines.length - 1) * lineHeight) / 2;
      lines.forEach((l, i) => {
        ctx.fillText(l, W / 2, startY + i * lineHeight);
      });
    }

    // ── Draw Confidence Buttons ─────────────────────────────────────────────
    function drawConfidenceButtons() {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#737373';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.fillText('Bet your confidence:', W / 2, CONF_Y - 16);

      for (let i = 0; i < 5; i++) {
        const x = CONF_START_X + i * (CONF_BTN_W + CONF_GAP);
        const selected = confidence === i + 1;
        const hovered = hoveredConfidence === i + 1;

        // Button background
        drawRoundedRect(x, CONF_Y, CONF_BTN_W, CONF_BTN_H, 10);
        if (selected) {
          ctx.fillStyle = CONF_COLORS[i];
          ctx.fill();
          // Glow
          drawGlow(x + CONF_BTN_W / 2, CONF_Y + CONF_BTN_H / 2, 40, CONF_COLORS[i], 0.3);
        } else {
          ctx.fillStyle = hovered ? '#333' : '#1a1a1a';
          ctx.fill();
          ctx.strokeStyle = hovered ? CONF_COLORS[i] : '#333';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // Label
        ctx.fillStyle = selected ? '#000' : (hovered ? '#e5e5e5' : '#a3a3a3');
        ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${i + 1}x`, x + CONF_BTN_W / 2, CONF_Y + 24);

        ctx.font = '10px system-ui, -apple-system, sans-serif';
        ctx.fillStyle = selected ? '#00000099' : '#525252';
        ctx.fillText(CONF_LABELS[i].split(' ')[1], x + CONF_BTN_W / 2, CONF_Y + 42);
      }
    }

    // ── Draw Lock In / Confirm Button ───────────────────────────────────────
    function drawLockInButton() {
      if (state !== 'betting') return;
      const btnW = 180, btnH = 44;
      const btnX = W / 2 - btnW / 2, btnY = 520;
      drawRoundedRect(btnX, btnY, btnW, btnH, 10);
      ctx.fillStyle = hoverLockIn ? '#fb923c' : ORANGE;
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
      ctx.fillText('LOCK IN', W / 2, btnY + 28);

      // Keyboard hint
      ctx.fillStyle = '#525252';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText('Press Enter', W / 2, btnY + btnH + 16);
    }

    // ── Draw Reveal ─────────────────────────────────────────────────────────
    function drawReveal(dt: number) {
      revealProgress += dt * 0.8;

      if (revealPhase === 'slide' && revealProgress > 1.2) {
        revealPhase = 'score';
        // Spawn particles at answer location
        const ansX = valueToX(currentQ.answer, currentQ);
        if (chainBroken) {
          spawnParticles(ansX, NL_Y, 30, '#ef4444', 4);
          shakeIntensity = 8;
          shakeTime = 0.4;
          SoundEngine.play('playerDamage');
        } else if (chainLength > 0 && confidence >= HIGH_CONF_MIN) {
          spawnParticles(ansX, NL_Y, 20, ORANGE, 3);
          spawnParticles(ansX, NL_Y, 10, '#eab308', 2);
          SoundEngine.play('comboUp');
        } else {
          spawnParticles(ansX, NL_Y, 12, '#22c55e', 2);
          SoundEngine.play('collectGem');
        }
      }

      if (revealPhase === 'score' && revealProgress > 2.5) {
        revealPhase = 'done';
      }

      // Draw the scene
      drawQuestion();
      drawNumberLine(true, clamp(revealProgress, 0, 1));

      // Score breakdown
      if (revealPhase === 'score' || revealPhase === 'done') {
        const fadeIn = clamp((revealProgress - 1.2) * 3, 0, 1);
        ctx.globalAlpha = fadeIn;

        // Accuracy feedback text
        ctx.textAlign = 'center';
        let feedbackText = '';
        let feedbackColor = '';
        if (roundAccuracy >= 0.98) { feedbackText = 'PERFECT!'; feedbackColor = '#22c55e'; }
        else if (roundAccuracy >= 0.90) { feedbackText = 'Spot On!'; feedbackColor = '#22c55e'; }
        else if (roundAccuracy >= 0.80) { feedbackText = 'Very Close!'; feedbackColor = '#84cc16'; }
        else if (roundAccuracy >= 0.65) { feedbackText = 'Close!'; feedbackColor = '#eab308'; }
        else if (roundAccuracy >= 0.45) { feedbackText = 'Not Bad'; feedbackColor = '#f97316'; }
        else { feedbackText = 'Way Off!'; feedbackColor = '#ef4444'; }

        ctx.fillStyle = feedbackColor;
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.fillText(feedbackText, W / 2, 390);

        const centerY = CONF_Y + 20;

        // Base score
        ctx.fillStyle = '#a3a3a3';
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.fillText(`Base: ${roundBaseScore}`, W / 2 - 120, centerY);

        // Multiplier
        ctx.fillStyle = CONF_COLORS[confidence - 1];
        ctx.fillText(`x${confidence} = ${roundBaseScore * confidence}`, W / 2, centerY);

        // Chain bonus or penalty
        if (chainBroken) {
          ctx.fillStyle = '#ef4444';
          ctx.fillText('CHAIN BROKEN! -50%', W / 2 + 130, centerY);
        } else if (chainBonus > 0) {
          ctx.fillStyle = '#eab308';
          ctx.fillText(`Chain +${chainBonus}`, W / 2 + 130, centerY);
        }

        // Total round score (animated counter)
        ctx.fillStyle = '#f5f5f5';
        ctx.font = 'bold 28px system-ui, -apple-system, sans-serif';
        ctx.fillText(`+${Math.round(revealScoreDisplay).toLocaleString()}`, W / 2, centerY + 40);

        ctx.globalAlpha = 1;
      }

      // Continue button
      if (revealPhase === 'done') {
        const btnW = 180, btnH = 44;
        const btnX = W / 2 - btnW / 2, btnY = 530;
        drawRoundedRect(btnX, btnY, btnW, btnH, 10);
        ctx.fillStyle = hoverContinue ? '#444' : '#333';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.fillStyle = '#e5e5e5';
        ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
        ctx.fillText(round + 1 >= TOTAL_ROUNDS ? 'SEE RESULTS' : 'CONTINUE', W / 2, btnY + 28);

        ctx.fillStyle = '#525252';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.fillText('Press Enter', W / 2, btnY + btnH + 16);
      }
    }

    // ── Draw Game Over ──────────────────────────────────────────────────────
    function drawGameOver() {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0, '#0a0a0a');
      bgGrad.addColorStop(1, '#1a0a00');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';

      // Title
      ctx.fillStyle = ORANGE;
      ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
      ctx.fillText('GAME OVER', W / 2, 120);

      // Final score
      ctx.fillStyle = '#f5f5f5';
      ctx.font = 'bold 60px system-ui, -apple-system, sans-serif';
      ctx.fillText(totalScore.toLocaleString(), W / 2, 210);

      ctx.fillStyle = '#737373';
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.fillText('FINAL SCORE', W / 2, 240);

      // New high score indicator
      if (newHighScore) {
        ctx.fillStyle = '#eab308';
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.fillText('NEW HIGH SCORE!', W / 2, 290);
        spawnParticles(W / 2, 280, 1, '#eab308', 2);
      } else if (highScore > 0) {
        ctx.fillStyle = '#525252';
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.fillText(`High Score: ${highScore.toLocaleString()}`, W / 2, 290);
      }

      // Accuracy grade
      const avgAcc = totalAccuracy / TOTAL_ROUNDS;
      let grade = 'F';
      let gradeColor = '#ef4444';
      if (avgAcc >= 0.95) { grade = 'S'; gradeColor = '#eab308'; }
      else if (avgAcc >= 0.85) { grade = 'A'; gradeColor = '#22c55e'; }
      else if (avgAcc >= 0.70) { grade = 'B'; gradeColor = '#84cc16'; }
      else if (avgAcc >= 0.55) { grade = 'C'; gradeColor = '#eab308'; }
      else if (avgAcc >= 0.40) { grade = 'D'; gradeColor = '#f97316'; }

      ctx.fillStyle = gradeColor;
      ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
      ctx.fillText(grade, W / 2, 340);
      ctx.fillStyle = '#525252';
      ctx.font = '11px system-ui, -apple-system, sans-serif';
      ctx.fillText('ACCURACY GRADE', W / 2, 356);

      // Stats row
      const statsY = 385;
      ctx.font = '13px system-ui, -apple-system, sans-serif';
      const stats = [
        { label: `Avg: ${Math.round(totalScore / TOTAL_ROUNDS)}`, color: '#a3a3a3' },
        { label: `${perfectCount} Perfect${perfectCount !== 1 ? 's' : ''}`, color: '#22c55e' },
        { label: bestChain > 0 ? `Chain x${bestChain}` : 'No chains', color: bestChain > 0 ? '#ef4444' : '#525252' },
      ];
      const statsSpacing = 130;
      const statsStartX = W / 2 - ((stats.length - 1) * statsSpacing) / 2;
      stats.forEach((s, i) => {
        ctx.fillStyle = s.color;
        ctx.fillText(s.label, statsStartX + i * statsSpacing, statsY);
      });

      // Play again button
      const btnW = 200, btnH = 56, btnX = W / 2 - btnW / 2, btnY = 420;
      drawRoundedRect(btnX, btnY, btnW, btnH, 12);
      ctx.fillStyle = hoverPlayAgain ? '#fb923c' : ORANGE;
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('PLAY AGAIN', W / 2, btnY + 36);

      // Decorative spectrum bar
      const specGrad = ctx.createLinearGradient(100, 0, 700, 0);
      specGrad.addColorStop(0, '#22c55e');
      specGrad.addColorStop(0.25, '#84cc16');
      specGrad.addColorStop(0.5, '#eab308');
      specGrad.addColorStop(0.75, '#f97316');
      specGrad.addColorStop(1, '#ef4444');
      ctx.fillStyle = specGrad;
      ctx.fillRect(100, 520, 600, 3);
    }

    // ── Update particles ────────────────────────────────────────────────────
    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt; // gravity
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }
    }

    function drawParticles() {
      for (const p of particles) {
        const alpha = clamp(p.life / p.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // ── Draw score popups ───────────────────────────────────────────────────
    function updateScorePopups(dt: number) {
      for (let i = scorePopups.length - 1; i >= 0; i--) {
        const p = scorePopups[i];
        p.y -= 40 * dt;
        p.life -= dt;
        if (p.life <= 0) scorePopups.splice(i, 1);
      }
    }

    function drawScorePopups() {
      ctx.textAlign = 'center';
      for (const p of scorePopups) {
        const alpha = clamp(p.life / 1.5, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
    }

    // ── Main game loop ──────────────────────────────────────────────────────
    let lastTime = 0;
    let rafId: number;

    function gameLoop(timestamp: number) {
      const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
      lastTime = timestamp;

      // Screen shake offset
      let shakeX = 0, shakeY = 0;
      if (shakeTime > 0) {
        shakeTime -= dt;
        shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
        shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
        shakeIntensity *= 0.93;
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      // Background
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Ambient background particles (during gameplay states)
      if (state !== 'menu' && state !== 'gameover') {
        const now = Date.now() / 1000;
        for (const ap of ambientParticles) {
          ap.x += ap.vx * dt;
          ap.y += ap.vy * dt;
          if (ap.x < -10) ap.x = W + 10;
          if (ap.x > W + 10) ap.x = -10;
          if (ap.y < -10) ap.y = H + 10;
          if (ap.y > H + 10) ap.y = -10;
          const pulse = 0.5 + 0.5 * Math.sin(now * 1.5 + ap.phase);
          ctx.globalAlpha = ap.alpha * pulse;
          ctx.fillStyle = ap.color;
          ctx.beginPath();
          ctx.arc(ap.x, ap.y, ap.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // Confidence escalation overlay (subtle tint during betting)
      if (state === 'betting' && confidence >= 3) {
        const intensity = (confidence - 2) / 3; // 0.33 at 3x, 0.67 at 4x, 1.0 at 5x
        ctx.globalAlpha = intensity * 0.04;
        ctx.fillStyle = CONF_COLORS[confidence - 1];
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;

        // Subtle edge vignette at high confidence
        if (confidence >= 4) {
          const vGrad = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
          vGrad.addColorStop(0, 'transparent');
          vGrad.addColorStop(1, CONF_COLORS[confidence - 1] + '12');
          ctx.fillStyle = vGrad;
          ctx.fillRect(0, 0, W, H);
        }
      }

      // Smooth score display
      displayScore = lerp(displayScore, totalScore, Math.min(dt * 6, 1));

      // Animated reveal score counter
      if (state === 'reveal') {
        revealScoreDisplay = lerp(revealScoreDisplay, revealScoreTarget, Math.min(dt * 4, 1));
      }

      switch (state) {
        case 'menu':
          drawMenu(dt);
          break;

        case 'playing':
        case 'betting': {
          drawHUD();
          drawQuestion();
          drawNumberLine(false, 0);

          if (state === 'playing' && !estimateLocked) {
            // Lock In Estimate button
            const liBtnW = 200, liBtnH = 46;
            const liBtnX = W / 2 - liBtnW / 2, liBtnY = 420;
            drawRoundedRect(liBtnX, liBtnY, liBtnW, liBtnH, 10);
            ctx.fillStyle = hoverLockIn ? '#fb923c' : ORANGE;
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000';
            ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
            ctx.fillText('LOCK IN ESTIMATE', W / 2, liBtnY + 29);

            // Instruction text
            ctx.fillStyle = '#525252';
            ctx.font = '12px system-ui, -apple-system, sans-serif';
            ctx.fillText('Drag marker or use Arrow Keys \u2022 Enter to lock in', W / 2, liBtnY + liBtnH + 20);
          }

          if (state === 'playing' && estimateLocked) {
            // Transition to betting
            state = 'betting';
            SoundEngine.play('click');
          }

          if (state === 'betting') {
            drawConfidenceButtons();
            drawLockInButton();
          }
          break;
        }

        case 'reveal':
          drawHUD();
          drawReveal(dt);
          break;

        case 'gameover':
          drawGameOver();
          break;
      }

      // Particles & popups (always drawn)
      updateParticles(dt);
      drawParticles();
      updateScorePopups(dt);
      drawScorePopups();

      ctx.restore();

      rafId = requestAnimationFrame(gameLoop);
    }

    rafId = requestAnimationFrame(gameLoop);

    // ── Input: cached bounding rect ─────────────────────────────────────────
    let cachedRect = canvas.getBoundingClientRect();
    const updateRect = () => { cachedRect = canvas.getBoundingClientRect(); };
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect);

    function getCanvasCoords(e: MouseEvent | Touch): { cx: number; cy: number } {
      const scaleX = W / cachedRect.width;
      const scaleY = H / cachedRect.height;
      return {
        cx: (e.clientX - cachedRect.left) * scaleX,
        cy: (e.clientY - cachedRect.top) * scaleY,
      };
    }

    function isInRect(cx: number, cy: number, rx: number, ry: number, rw: number, rh: number) {
      return cx >= rx && cx <= rx + rw && cy >= ry && cy <= ry + rh;
    }

    // ── Mouse: click ────────────────────────────────────────────────────────
    function handleClick(e: MouseEvent) {
      const { cx, cy } = getCanvasCoords(e);
      handleInteraction(cx, cy);
    }

    function handleInteraction(cx: number, cy: number) {
      if (state === 'menu') {
        const btnW = 200, btnH = 56, btnX = W / 2 - btnW / 2, btnY = 400;
        if (isInRect(cx, cy, btnX, btnY, btnW, btnH)) {
          SoundEngine.play('menuSelect');
          startGame();
        }
        return;
      }

      if (state === 'playing' && !estimateLocked) {
        // Check if clicking the Lock In Estimate button
        const liBtnW = 200, liBtnH = 46;
        const liBtnX = W / 2 - liBtnW / 2, liBtnY = 420;
        if (isInRect(cx, cy, liBtnX, liBtnY, liBtnW, liBtnH)) {
          estimateLocked = true;
          SoundEngine.play('click');
          return;
        }
        // Clicking on the number line updates position
        if (cy > NL_Y - 30 && cy < NL_Y + 30 && cx >= NL_X && cx <= NL_RIGHT) {
          estimate = xToNorm(cx);
        }
        return;
      }

      if (state === 'betting') {
        // Check confidence buttons
        for (let i = 0; i < 5; i++) {
          const x = CONF_START_X + i * (CONF_BTN_W + CONF_GAP);
          if (isInRect(cx, cy, x, CONF_Y, CONF_BTN_W, CONF_BTN_H)) {
            confidence = i + 1;
            SoundEngine.play('click');
            return;
          }
        }

        // Lock in button
        const btnW = 180, btnH = 44;
        const btnX = W / 2 - btnW / 2, btnY = 520;
        if (isInRect(cx, cy, btnX, btnY, btnW, btnH)) {
          confirmBet();
          return;
        }
        return;
      }

      if (state === 'reveal' && revealPhase === 'done') {
        advance();
        return;
      }

      if (state === 'gameover') {
        const btnW = 200, btnH = 56, btnX = W / 2 - btnW / 2, btnY = 420;
        if (isInRect(cx, cy, btnX, btnY, btnW, btnH)) {
          SoundEngine.play('menuSelect');
          startGame();
        }
        return;
      }
    }

    function confirmBet() {
      calculateScore();
      revealProgress = 0;
      revealPhase = 'slide';
      state = 'reveal';
      SoundEngine.play('launch');
    }

    function advance() {
      round++;
      if (round >= TOTAL_ROUNDS) {
        state = 'gameover';
        SoundEngine.play('gameOver');
      } else {
        startRound();
      }
    }

    // ── Mouse: move ─────────────────────────────────────────────────────────
    function handleMouseMove(e: MouseEvent) {
      const { cx, cy } = getCanvasCoords(e);

      // Update hover states
      if (state === 'menu') {
        const btnW = 200, btnH = 56, btnX = W / 2 - btnW / 2, btnY = 400;
        hoverStartBtn = isInRect(cx, cy, btnX, btnY, btnW, btnH);
      }

      if (state === 'gameover') {
        const btnW = 200, btnH = 56, btnX = W / 2 - btnW / 2, btnY = 420;
        hoverPlayAgain = isInRect(cx, cy, btnX, btnY, btnW, btnH);
      }

      if (state === 'playing' && !estimateLocked) {
        const liBtnW = 200, liBtnH = 46;
        const liBtnX = W / 2 - liBtnW / 2, liBtnY = 420;
        hoverLockIn = isInRect(cx, cy, liBtnX, liBtnY, liBtnW, liBtnH);
      }

      if (state === 'betting') {
        hoveredConfidence = 0;
        for (let i = 0; i < 5; i++) {
          const x = CONF_START_X + i * (CONF_BTN_W + CONF_GAP);
          if (isInRect(cx, cy, x, CONF_Y, CONF_BTN_W, CONF_BTN_H)) {
            hoveredConfidence = i + 1;
          }
        }
        const btnW = 180, btnH = 44;
        const btnX = W / 2 - btnW / 2, btnY = 520;
        hoverLockIn = isInRect(cx, cy, btnX, btnY, btnW, btnH);
      }

      if (state === 'reveal') {
        const btnW = 180, btnH = 44;
        const btnX = W / 2 - btnW / 2, btnY = 530;
        hoverContinue = isInRect(cx, cy, btnX, btnY, btnW, btnH);
      }

      // Dragging the marker
      if (dragging && (state === 'playing') && !estimateLocked) {
        estimate = xToNorm(cx);
      }

      // Cursor styling
      const isPointer = hoverStartBtn || hoverPlayAgain || hoverContinue || hoverLockIn || hoveredConfidence > 0;
      const isGrab = !estimateLocked && state === 'playing' && cy > NL_Y - 30 && cy < NL_Y + 30 && cx >= NL_X - 20 && cx <= NL_RIGHT + 20;
      canvas.style.cursor = dragging ? 'grabbing' : isPointer ? 'pointer' : isGrab ? 'grab' : 'default';
    }

    function handleMouseDown(e: MouseEvent) {
      const { cx, cy } = getCanvasCoords(e);
      if (state === 'playing' && !estimateLocked) {
        if (cy > NL_Y - 30 && cy < NL_Y + 30 && cx >= NL_X - 20 && cx <= NL_RIGHT + 20) {
          dragging = true;
          estimate = xToNorm(cx);
        }
      }
    }

    function handleMouseUp() {
      if (dragging) {
        dragging = false;
      }
    }

    // ── Touch ───────────────────────────────────────────────────────────────
    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      const touch = e.touches[0];
      const { cx, cy } = getCanvasCoords(touch);

      if (state === 'playing' && !estimateLocked) {
        if (cy > NL_Y - 40 && cy < NL_Y + 40 && cx >= NL_X - 20 && cx <= NL_RIGHT + 20) {
          dragging = true;
          estimate = xToNorm(cx);
          return;
        }
      }

      handleInteraction(cx, cy);
    }

    function handleTouchMove(e: TouchEvent) {
      e.preventDefault();
      if (dragging && state === 'playing' && !estimateLocked) {
        const touch = e.touches[0];
        const { cx } = getCanvasCoords(touch);
        estimate = xToNorm(cx);
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const wasDragging = dragging;
      if (dragging) {
        dragging = false;
      }
      // Only fire interaction on tap (not drag release)
      if (e.changedTouches.length > 0 && !wasDragging) {
        const touch = e.changedTouches[0];
        const { cx, cy } = getCanvasCoords(touch);
        handleInteraction(cx, cy);
      }
    }

    // ── Keyboard ────────────────────────────────────────────────────────────
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (state === 'menu') {
        if (e.key === 'Enter' || e.key === ' ') {
          SoundEngine.play('menuSelect');
          startGame();
        }
        return;
      }

      if (state === 'playing' && !estimateLocked) {
        const nudge = e.shiftKey ? 0.01 : 0.005;
        if (e.key === 'ArrowLeft' || e.key === 'a') {
          estimate = clamp(estimate - nudge, 0, 1);
        } else if (e.key === 'ArrowRight' || e.key === 'd') {
          estimate = clamp(estimate + nudge, 0, 1);
        } else if (e.key === 'Enter' || e.key === ' ') {
          estimateLocked = true;
          SoundEngine.play('click');
        }
        return;
      }

      if (state === 'betting') {
        if (e.key >= '1' && e.key <= '5') {
          confidence = parseInt(e.key);
          SoundEngine.play('click');
        } else if (e.key === 'Enter') {
          confirmBet();
        }
        return;
      }

      if (state === 'reveal' && revealPhase === 'done') {
        if (e.key === 'Enter' || e.key === ' ') {
          advance();
        }
        return;
      }

      if (state === 'gameover') {
        if (e.key === 'Enter' || e.key === ' ') {
          SoundEngine.play('menuSelect');
          startGame();
        }
        return;
      }
    }

    // ── Attach listeners ────────────────────────────────────────────────────
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect);
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
