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
const GAME_SLUG = 'dendrite';

const BG = '#0a0a1a';
const PURPLE = '#a855f7';
const PURPLE_GLOW = '#c084fc';
const PURPLE_DIM = '#7c3aed';
const PURPLE_DARK = '#4c1d95';
const GREEN = '#22c55e';
const GREEN_GLOW = '#4ade80';
const GOLD = '#ffd700';
const GOLD_GLOW = '#ffe066';
const RED = '#ef4444';
const WHITE = '#ffffff';
const DIM = '#667788';
const CYAN = '#22d3ee';

const NODE_RADIUS = 28;
const NODE_LABEL_SIZE = 11;
const CONNECTION_WIDTH = 3;
const SIGNAL_RADIUS = 6;
const SIGNAL_SPEED = 200; // pixels per second

type GameState = 'menu' | 'playing' | 'gameover';

// ---------------------------------------------------------------------------
// Concept Pools
// ---------------------------------------------------------------------------

interface CategoryDef {
  name: string;
  color: string;
  colorDim: string;
  words: string[];
}

const CATEGORIES: CategoryDef[] = [
  {
    name: 'Animals',
    color: '#f97316',
    colorDim: '#9a3412',
    words: ['whale', 'dolphin', 'shark', 'eagle', 'penguin', 'bat', 'snake', 'frog', 'spider', 'ant'],
  },
  {
    name: 'Ocean',
    color: '#06b6d4',
    colorDim: '#155e75',
    words: ['coral', 'tide', 'reef', 'kelp', 'plankton', 'abyss', 'trench', 'current', 'wave', 'shell'],
  },
  {
    name: 'Sky',
    color: '#3b82f6',
    colorDim: '#1e3a5f',
    words: ['cloud', 'star', 'moon', 'sun', 'aurora', 'comet', 'wind', 'storm', 'lightning', 'rainbow'],
  },
  {
    name: 'Plants',
    color: '#22c55e',
    colorDim: '#14532d',
    words: ['oak', 'fern', 'moss', 'cactus', 'vine', 'petal', 'root', 'seed', 'pollen', 'bloom'],
  },
  {
    name: 'Body',
    color: '#ef4444',
    colorDim: '#7f1d1d',
    words: ['heart', 'lung', 'brain', 'bone', 'muscle', 'nerve', 'vein', 'cell', 'skin', 'eye'],
  },
  {
    name: 'Music',
    color: '#d946ef',
    colorDim: '#701a75',
    words: ['rhythm', 'melody', 'chord', 'bass', 'drum', 'note', 'tempo', 'pitch', 'harmony', 'beat'],
  },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConceptNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  word: string;
  category: string;
  color: string;
  colorDim: string;
  isStart: boolean;
  isTarget: boolean;
  hovered: boolean;
  pulsePhase: number;
  radius: number;
}

interface Connection {
  fromIdx: number;
  toIdx: number;
  pulseOffset: number;
}

interface SignalState {
  active: boolean;
  path: number[]; // node indices along path
  pathIdx: number; // current segment index
  progress: number; // 0-1 along current segment
  x: number;
  y: number;
  trail: { x: number; y: number; life: number }[];
  success: boolean | null; // null = still traveling
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
  gravity?: number;
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

interface BgNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  connections: number[];
  pulsePhase: number;
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

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pointToSegmentDistSq(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = px - ax;
    const ey = py - ay;
    return ex * ex + ey * ey;
  }
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = clamp(t, 0, 1);
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  const ex = px - projX;
  const ey = py - projY;
  return ex * ex + ey * ey;
}

// BFS shortest path
function bfsPath(
  startIdx: number,
  targetIdx: number,
  adjacency: Map<number, number[]>,
): number[] | null {
  const visited = new Set<number>();
  const queue: number[][] = [[startIdx]];
  visited.add(startIdx);

  while (queue.length > 0) {
    const path = queue.shift()!;
    const current = path[path.length - 1];

    if (current === targetIdx) return path;

    const neighbors = adjacency.get(current) || [];
    for (const n of neighbors) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push([...path, n]);
      }
    }
  }

  return null;
}

// Build adjacency map from connections
function buildAdjacency(connections: Connection[]): Map<number, number[]> {
  const adj = new Map<number, number[]>();
  for (const c of connections) {
    if (!adj.has(c.fromIdx)) adj.set(c.fromIdx, []);
    if (!adj.has(c.toIdx)) adj.set(c.toIdx, []);
    adj.get(c.fromIdx)!.push(c.toIdx);
    adj.get(c.toIdx)!.push(c.fromIdx);
  }
  return adj;
}

// Compute optimal (minimum) number of edges needed between start and target
// assuming nodes in the same category can form a "bridge"
function computeOptimalPath(
  nodes: ConceptNode[],
  startIdx: number,
  targetIdx: number,
): number {
  // Build hypothetical graph: connect any two nodes that share a category
  const n = nodes.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (nodes[i].category === nodes[j].category) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }
  // Also connect nodes that are in related categories (start's cat to target's cat)
  // For simplicity, also connect any pair within 1 category hop
  // BFS from start to target
  const visited = new Set<number>();
  const queue: [number, number][] = [[startIdx, 0]];
  visited.add(startIdx);
  while (queue.length > 0) {
    const [curr, dist] = queue.shift()!;
    if (curr === targetIdx) return Math.max(1, dist);
    for (const neighbor of adj[curr]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, dist + 1]);
      }
    }
  }
  // If no path exists through same-category links,
  // the optimal is a direct connection (if possible) = 1
  return 1;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DendriteGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let destroyed = false;
    let animId = 0;

    // Scale for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Virtual touch controls
    const touch = new TouchController(canvas);
    const isTouch = isTouchDevice();

    // -------------------------------------------------------------------
    // Input state
    // -------------------------------------------------------------------

    let mouseX = W / 2;
    let mouseY = H / 2;
    let mouseDown = false;
    let rightClicked = false;
    let spacePressed = false;

    // Dragging state
    let dragging = false;
    let dragFromIdx = -1;

    // -------------------------------------------------------------------
    // Game state
    // -------------------------------------------------------------------

    let state: GameState = 'menu';
    let paused = false;
    let isNewHighScore = false;

    // Round state
    let round = 0;
    let score = 0;
    let highScore = 0;
    let lives = 3;
    let streak = 0;
    let bestStreak = 0;
    let roundTime = 0;
    let roundTimeLimit = 60;
    let roundStartTime = 0;

    // Nodes & connections
    let nodes: ConceptNode[] = [];
    let connections: Connection[] = [];
    let startIdx = -1;
    let targetIdx = -1;

    // Signal
    let signal: SignalState = {
      active: false,
      path: [],
      pathIdx: 0,
      progress: 0,
      x: 0,
      y: 0,
      trail: [],
      success: null,
    };

    // Firing state
    let signalFired = false;
    let roundComplete = false;
    let roundCompleteTimer = 0;
    const ROUND_COMPLETE_DELAY = 1.5;

    // Effects
    let particles: Particle[] = [];
    let floatingTexts: FloatingText[] = [];
    let shakeTimer = 0;
    let shakeIntensity = 0;

    // Animation timers
    let lastTime = 0;
    let gameTime = 0;
    let menuTime = 0;

    // Menu background
    let bgNodes: BgNode[] = [];

    // -------------------------------------------------------------------
    // Background neural network for menu
    // -------------------------------------------------------------------

    function initBgNodes() {
      bgNodes = [];
      const count = 30;
      for (let i = 0; i < count; i++) {
        bgNodes.push({
          x: rng(50, W - 50),
          y: rng(50, H - 50),
          vx: rng(-15, 15),
          vy: rng(-15, 15),
          connections: [],
          pulsePhase: rng(0, Math.PI * 2),
        });
      }
      // Connect nearby nodes
      for (let i = 0; i < count; i++) {
        for (let j = i + 1; j < count; j++) {
          const d = dist(bgNodes[i].x, bgNodes[i].y, bgNodes[j].x, bgNodes[j].y);
          if (d < 180 && bgNodes[i].connections.length < 4) {
            bgNodes[i].connections.push(j);
          }
        }
      }
    }

    function updateBgNodes(dt: number) {
      for (const node of bgNodes) {
        node.x += node.vx * dt;
        node.y += node.vy * dt;
        node.pulsePhase += dt * 1.5;

        if (node.x < 20 || node.x > W - 20) node.vx *= -1;
        if (node.y < 20 || node.y > H - 20) node.vy *= -1;
        node.x = clamp(node.x, 20, W - 20);
        node.y = clamp(node.y, 20, H - 20);
      }
    }

    function drawBgNodes(ctx: CanvasRenderingContext2D) {
      // Connections
      ctx.lineWidth = 1;
      for (let i = 0; i < bgNodes.length; i++) {
        const node = bgNodes[i];
        for (const j of node.connections) {
          const other = bgNodes[j];
          const d = dist(node.x, node.y, other.x, other.y);
          const alpha = Math.max(0, 1 - d / 200) * 0.15;
          ctx.strokeStyle = `rgba(168, 85, 247, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }

      // Nodes
      for (const node of bgNodes) {
        const pulse = 0.3 + 0.2 * Math.sin(node.pulsePhase);
        ctx.fillStyle = `rgba(168, 85, 247, ${pulse})`;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // -------------------------------------------------------------------
    // Particle system
    // -------------------------------------------------------------------

    function spawnParticles(
      x: number, y: number, color: string, count: number,
      speed = 120, life = 0.6, size = 3, gravity = 0,
    ) {
      for (let i = 0; i < count; i++) {
        const angle = rng(0, Math.PI * 2);
        const spd = rng(speed * 0.3, speed);
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          life,
          maxLife: life,
          color,
          size: rng(size * 0.5, size),
          gravity,
        });
      }
    }

    function spawnFloatingText(x: number, y: number, text: string, color: string, size = 20) {
      floatingTexts.push({
        x,
        y,
        text,
        color,
        life: 1.2,
        maxLife: 1.2,
        size,
      });
    }

    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.gravity) p.vy += p.gravity * dt;
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
        }
      }
    }

    function updateFloatingTexts(dt: number) {
      for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 40 * dt;
        ft.life -= dt;
        if (ft.life <= 0) {
          floatingTexts.splice(i, 1);
        }
      }
    }

    function drawParticles(ctx: CanvasRenderingContext2D) {
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

    function drawFloatingTexts(ctx: CanvasRenderingContext2D) {
      for (const ft of floatingTexts) {
        const alpha = clamp(ft.life / ft.maxLife, 0, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ft.color;
        ctx.font = `bold ${ft.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.globalAlpha = 1;
    }

    // -------------------------------------------------------------------
    // Round generation
    // -------------------------------------------------------------------

    function getRoundConfig(r: number): { nodeCount: number; catCount: number; decoys: number; timeLimit: number } {
      if (r <= 3) return { nodeCount: 8, catCount: 2, decoys: 0, timeLimit: 60 };
      if (r <= 6) return { nodeCount: 10, catCount: 2, decoys: 2, timeLimit: 45 };
      if (r <= 9) return { nodeCount: 12, catCount: 3, decoys: 2, timeLimit: 35 };
      return { nodeCount: 12, catCount: 3, decoys: 3, timeLimit: 30 };
    }

    function generateRound() {
      const config = getRoundConfig(round);
      roundTimeLimit = config.timeLimit;
      roundTime = 0;
      roundStartTime = gameTime;
      signalFired = false;
      roundComplete = false;
      roundCompleteTimer = 0;
      connections = [];
      signal = {
        active: false,
        path: [],
        pathIdx: 0,
        progress: 0,
        x: 0,
        y: 0,
        trail: [],
        success: null,
      };

      // Pick categories
      const shuffledCats = shuffle(CATEGORIES);
      const mainCats = shuffledCats.slice(0, config.catCount);
      const decoyCats = shuffledCats.slice(config.catCount, config.catCount + 2);

      // Build word pool
      const wordPool: { word: string; cat: CategoryDef }[] = [];

      // Add words from main categories
      const wordsPerCat = Math.floor((config.nodeCount - config.decoys) / config.catCount);
      for (const cat of mainCats) {
        const shuffled = shuffle(cat.words);
        for (let i = 0; i < wordsPerCat && i < shuffled.length; i++) {
          wordPool.push({ word: shuffled[i], cat });
        }
      }

      // Fill remaining main slots
      while (wordPool.length < config.nodeCount - config.decoys) {
        const cat = mainCats[Math.floor(Math.random() * mainCats.length)];
        const used = new Set(wordPool.filter(w => w.cat.name === cat.name).map(w => w.word));
        const remaining = cat.words.filter(w => !used.has(w));
        if (remaining.length > 0) {
          wordPool.push({ word: remaining[Math.floor(Math.random() * remaining.length)], cat });
        }
      }

      // Add decoy nodes
      for (let i = 0; i < config.decoys; i++) {
        const cat = decoyCats[i % decoyCats.length];
        const shuffled = shuffle(cat.words);
        wordPool.push({ word: shuffled[0], cat });
      }

      // Shuffle and create nodes
      const shuffledPool = shuffle(wordPool).slice(0, config.nodeCount);
      nodes = [];

      // Generate positions with physics-based spreading
      const positions: { x: number; y: number }[] = [];
      const margin = 60;
      const minDist = 90;

      for (let i = 0; i < shuffledPool.length; i++) {
        let bestX = 0, bestY = 0;
        let bestMinD = 0;

        // Try multiple random positions and pick the one with best minimum distance
        for (let attempt = 0; attempt < 50; attempt++) {
          const x = rng(margin, W - margin);
          const y = rng(margin + 50, H - margin - 30);
          let minD = Infinity;

          for (const p of positions) {
            const d = dist(x, y, p.x, p.y);
            if (d < minD) minD = d;
          }

          if (positions.length === 0) minD = 999;

          if (minD > bestMinD) {
            bestMinD = minD;
            bestX = x;
            bestY = y;
          }

          if (minD >= minDist) break;
        }

        positions.push({ x: bestX, y: bestY });
      }

      // Physics relaxation to spread nodes further
      for (let iter = 0; iter < 60; iter++) {
        for (let i = 0; i < positions.length; i++) {
          let fx = 0, fy = 0;
          for (let j = 0; j < positions.length; j++) {
            if (i === j) continue;
            const dx = positions[i].x - positions[j].x;
            const dy = positions[i].y - positions[j].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist && d > 0) {
              const force = (minDist - d) / d * 0.3;
              fx += dx * force;
              fy += dy * force;
            }
          }
          positions[i].x = clamp(positions[i].x + fx, margin, W - margin);
          positions[i].y = clamp(positions[i].y + fy, margin + 50, H - margin - 30);
        }
      }

      for (let i = 0; i < shuffledPool.length; i++) {
        const wp = shuffledPool[i];
        nodes.push({
          x: positions[i].x,
          y: positions[i].y,
          vx: 0,
          vy: 0,
          word: wp.word,
          category: wp.cat.name,
          color: wp.cat.color,
          colorDim: wp.cat.colorDim,
          isStart: false,
          isTarget: false,
          hovered: false,
          pulsePhase: rng(0, Math.PI * 2),
          radius: NODE_RADIUS,
        });
      }

      // Pick start and target from different categories to make it interesting
      const catGroups = new Map<string, number[]>();
      for (let i = 0; i < nodes.length; i++) {
        const cat = nodes[i].category;
        if (!catGroups.has(cat)) catGroups.set(cat, []);
        catGroups.get(cat)!.push(i);
      }

      const catNames = Array.from(catGroups.keys());
      if (catNames.length >= 2) {
        // Pick from two different main categories
        const cat1Indices = catGroups.get(catNames[0])!;
        const cat2Indices = catGroups.get(catNames[1])!;
        startIdx = cat1Indices[Math.floor(Math.random() * cat1Indices.length)];
        targetIdx = cat2Indices[Math.floor(Math.random() * cat2Indices.length)];
      } else {
        // Same category, just pick two distant nodes
        startIdx = 0;
        targetIdx = nodes.length - 1;
      }

      nodes[startIdx].isStart = true;
      nodes[targetIdx].isTarget = true;
    }

    // -------------------------------------------------------------------
    // Game actions
    // -------------------------------------------------------------------

    function startGame() {
      state = 'playing';
      round = 1;
      score = 0;
      lives = 3;
      streak = 0;
      bestStreak = 0;
      gameTime = 0;
      particles = [];
      floatingTexts = [];
      shakeTimer = 0;

      reportGameStart(GAME_SLUG);
      SoundEngine.startAmbient('quiz-ambient');
      SoundEngine.play('click');

      generateRound();
    }

    function fireSignal() {
      if (signalFired || signal.active || roundComplete) return;

      signalFired = true;
      SoundEngine.play('nerveChain');

      // Find path using BFS
      const adjacency = buildAdjacency(connections);
      const path = bfsPath(startIdx, targetIdx, adjacency);

      if (path) {
        signal = {
          active: true,
          path,
          pathIdx: 0,
          progress: 0,
          x: nodes[path[0]].x,
          y: nodes[path[0]].y,
          trail: [],
          success: null,
        };
      } else {
        // No path found - fail immediately
        signalFailed();
      }
    }

    function signalReachedTarget() {
      signal.active = false;
      signal.success = true;
      roundComplete = true;
      roundCompleteTimer = 0;

      SoundEngine.play('collectGem');
      SoundEngine.play('levelComplete');

      // Calculate score
      const pathLen = signal.path.length - 1; // number of connections traversed
      const optimalPath = computeOptimalPath(nodes, startIdx, targetIdx);
      const efficiency = Math.min(1, optimalPath / Math.max(1, pathLen));
      const efficiencyBonus = Math.round(efficiency * 100);

      const timeTaken = roundTime;
      const timeBonus = Math.max(0, Math.round((roundTimeLimit * 0.6 - timeTaken) * 5));

      streak++;
      if (streak > bestStreak) bestStreak = streak;

      const streakMultiplier = Math.min(3, 1 + (streak - 1) * 0.5);

      const baseScore = 100;
      const roundScore = Math.round((baseScore + efficiencyBonus + timeBonus) * streakMultiplier);

      score += roundScore;

      // Floating text effects
      const tx = nodes[targetIdx].x;
      const ty = nodes[targetIdx].y;
      spawnFloatingText(tx, ty - 30, `+${roundScore}`, GOLD, 24);
      if (efficiency >= 0.9) {
        spawnFloatingText(tx, ty - 60, 'OPTIMAL!', CYAN, 18);
      }
      if (streak >= 3) {
        spawnFloatingText(tx, ty - 85, `${streakMultiplier}x STREAK!`, PURPLE_GLOW, 16);
      }

      // Particles at target
      spawnParticles(tx, ty, GOLD, 25, 150, 0.8, 4);
      spawnParticles(tx, ty, PURPLE_GLOW, 15, 100, 0.6, 3);

      // Check high score
      if (score > highScore) {
        highScore = score;
        setHighScore(GAME_SLUG, highScore);
        isNewHighScore = true;
        SoundEngine.play('newHighScore');
        spawnFloatingText(W / 2, H / 2 - 60, 'NEW HIGH SCORE!', GOLD, 22);
      }
    }

    function signalFailed() {
      signal.active = false;
      signal.success = false;
      roundComplete = true;
      roundCompleteTimer = 0;

      SoundEngine.play('playerDamage');

      lives--;
      streak = 0;
      score = Math.max(0, score - 50);

      // Spawn failure particles at the signal's last position or start
      const fx = signal.path.length > 0 ? signal.x : nodes[startIdx].x;
      const fy = signal.path.length > 0 ? signal.y : nodes[startIdx].y;
      spawnParticles(fx, fy, RED, 20, 100, 0.5, 3);
      spawnFloatingText(fx, fy - 30, 'NO PATH!', RED, 22);

      if (lives <= 0) {
        endGame();
      }
    }

    function timeExpired() {
      SoundEngine.play('playerDamage');

      lives--;
      streak = 0;
      roundComplete = true;
      roundCompleteTimer = 0;
      signalFired = true; // prevent firing

      spawnParticles(W / 2, H / 2, RED, 15, 80, 0.5, 3);
      spawnFloatingText(W / 2, H / 2, 'TIME UP!', RED, 26);

      if (lives <= 0) {
        endGame();
      }
    }

    function endGame() {
      state = 'gameover';
      SoundEngine.play('gameOver');
      SoundEngine.stopAmbient();

      if (score > highScore) {
        highScore = score;
        setHighScore(GAME_SLUG, highScore);
        isNewHighScore = true;
      }

      reportGameEnd(GAME_SLUG, score, false, round);
    }

    function nextRound() {
      round++;
      generateRound();
    }

    // -------------------------------------------------------------------
    // Connection management
    // -------------------------------------------------------------------

    function addConnection(fromIdx: number, toIdx: number) {
      if (fromIdx === toIdx) return;
      // Check if connection already exists
      for (const c of connections) {
        if ((c.fromIdx === fromIdx && c.toIdx === toIdx) ||
            (c.fromIdx === toIdx && c.toIdx === fromIdx)) {
          return;
        }
      }
      connections.push({
        fromIdx,
        toIdx,
        pulseOffset: rng(0, Math.PI * 2),
      });
      SoundEngine.play('tetherLink');

      // Particle effect along connection
      const from = nodes[fromIdx];
      const to = nodes[toIdx];
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      spawnParticles(midX, midY, PURPLE_GLOW, 8, 60, 0.4, 2);
    }

    function removeConnectionAt(mx: number, my: number): boolean {
      const threshold = 15;
      let bestIdx = -1;
      let bestDist = Infinity;

      for (let i = 0; i < connections.length; i++) {
        const c = connections[i];
        const from = nodes[c.fromIdx];
        const to = nodes[c.toIdx];
        const dSq = pointToSegmentDistSq(mx, my, from.x, from.y, to.x, to.y);
        const d = Math.sqrt(dSq);
        if (d < threshold && d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }

      if (bestIdx >= 0) {
        const c = connections[bestIdx];
        const from = nodes[c.fromIdx];
        const to = nodes[c.toIdx];
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        connections.splice(bestIdx, 1);
        SoundEngine.play('tetherUnlink');
        spawnParticles(midX, midY, '#ff6666', 6, 50, 0.3, 2);
        return true;
      }
      return false;
    }

    function getNodeAt(mx: number, my: number): number {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (dist(mx, my, n.x, n.y) <= n.radius + 5) {
          return i;
        }
      }
      return -1;
    }

    // -------------------------------------------------------------------
    // Signal update
    // -------------------------------------------------------------------

    function updateSignal(dt: number) {
      if (!signal.active) return;

      const path = signal.path;
      if (signal.pathIdx >= path.length - 1) {
        // Signal reached end of path
        if (path[path.length - 1] === targetIdx) {
          signalReachedTarget();
        } else {
          signalFailed();
        }
        return;
      }

      const fromNode = nodes[path[signal.pathIdx]];
      const toNode = nodes[path[signal.pathIdx + 1]];
      const segDist = dist(fromNode.x, fromNode.y, toNode.x, toNode.y);
      const travelPerSec = SIGNAL_SPEED / Math.max(1, segDist);

      signal.progress += travelPerSec * dt;

      if (signal.progress >= 1) {
        signal.progress = 0;
        signal.pathIdx++;

        // Burst particles at each node the signal passes through
        if (signal.pathIdx < path.length) {
          const n = nodes[path[signal.pathIdx]];
          spawnParticles(n.x, n.y, PURPLE_GLOW, 8, 60, 0.3, 2);
        }
      }

      // Interpolate position
      if (signal.pathIdx < path.length - 1) {
        const fn = nodes[path[signal.pathIdx]];
        const tn = nodes[path[signal.pathIdx + 1]];
        signal.x = fn.x + (tn.x - fn.x) * signal.progress;
        signal.y = fn.y + (tn.y - fn.y) * signal.progress;
      } else if (signal.pathIdx < path.length) {
        const n = nodes[path[signal.pathIdx]];
        signal.x = n.x;
        signal.y = n.y;
      }

      // Trail
      signal.trail.push({ x: signal.x, y: signal.y, life: 0.5 });

      // Update trail
      for (let i = signal.trail.length - 1; i >= 0; i--) {
        signal.trail[i].life -= dt;
        if (signal.trail[i].life <= 0) {
          signal.trail.splice(i, 1);
        }
      }
    }

    // -------------------------------------------------------------------
    // Update
    // -------------------------------------------------------------------

    function update(dt: number) {
      if (state !== 'playing') return;
      if (paused) return;

      gameTime += dt;
      roundTime += dt;

      // Check time limit
      if (!signalFired && !roundComplete && roundTime >= roundTimeLimit) {
        timeExpired();
        return;
      }

      // Update node hover states
      for (let i = 0; i < nodes.length; i++) {
        nodes[i].hovered = false;
        nodes[i].pulsePhase += dt * 2;
      }
      const hoveredIdx = getNodeAt(mouseX, mouseY);
      if (hoveredIdx >= 0) {
        nodes[hoveredIdx].hovered = true;
      }

      // Update signal
      updateSignal(dt);

      // Update round complete timer
      if (roundComplete) {
        roundCompleteTimer += dt;
        if (roundCompleteTimer >= ROUND_COMPLETE_DELAY) {
          if (lives > 0) {
            nextRound();
          }
        }
      }

      // Screen shake
      if (shakeTimer > 0) {
        shakeTimer -= dt;
        if (shakeTimer <= 0) {
          shakeTimer = 0;
        }
      }

      // Update effects
      updateParticles(dt);
      updateFloatingTexts(dt);
    }

    // -------------------------------------------------------------------
    // Drawing
    // -------------------------------------------------------------------

    function drawBackground(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Subtle grid pattern
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }

    function drawConnections(ctx: CanvasRenderingContext2D) {
      for (const c of connections) {
        const from = nodes[c.fromIdx];
        const to = nodes[c.toIdx];

        // Glow
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
        ctx.lineWidth = CONNECTION_WIDTH + 6;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Main line
        const pulse = 0.6 + 0.4 * Math.sin(gameTime * 3 + c.pulseOffset);
        ctx.strokeStyle = `rgba(168, 85, 247, ${pulse})`;
        ctx.lineWidth = CONNECTION_WIDTH;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();

        // Animated dots along connection
        const d = dist(from.x, from.y, to.x, to.y);
        const dotCount = Math.max(2, Math.floor(d / 40));
        for (let i = 0; i < dotCount; i++) {
          const t = ((gameTime * 0.8 + c.pulseOffset + i / dotCount) % 1);
          const dx = from.x + (to.x - from.x) * t;
          const dy = from.y + (to.y - from.y) * t;
          const dotAlpha = 0.3 + 0.3 * Math.sin(t * Math.PI);
          ctx.fillStyle = `rgba(192, 132, 252, ${dotAlpha})`;
          ctx.beginPath();
          ctx.arc(dx, dy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawDragPreview(ctx: CanvasRenderingContext2D) {
      if (!dragging || dragFromIdx < 0) return;

      const from = nodes[dragFromIdx];
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(mouseX, mouseY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight the hovered target node
      const targetNode = getNodeAt(mouseX, mouseY);
      if (targetNode >= 0 && targetNode !== dragFromIdx) {
        const tn = nodes[targetNode];
        ctx.strokeStyle = PURPLE_GLOW;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tn.x, tn.y, tn.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    function drawNodes(ctx: CanvasRenderingContext2D) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const pulse = Math.sin(n.pulsePhase) * 0.15;

        // Glow for special nodes
        if (n.isStart) {
          ctx.shadowColor = GREEN_GLOW;
          ctx.shadowBlur = 20 + pulse * 10;
          ctx.fillStyle = 'rgba(34, 197, 94, 0.15)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (n.isTarget) {
          ctx.shadowColor = GOLD_GLOW;
          ctx.shadowBlur = 20 + pulse * 10;
          ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Hover glow
        if (n.hovered && !signalFired) {
          ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 8, 0, Math.PI * 2);
          ctx.fill();
        }

        // Node body
        const bodyAlpha = n.hovered ? 0.95 : 0.85;
        ctx.fillStyle = n.isStart ? GREEN : n.isTarget ? GOLD : n.colorDim;
        ctx.globalAlpha = bodyAlpha;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Node border
        const borderColor = n.isStart ? GREEN : n.isTarget ? GOLD : n.color;
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = n.hovered ? 3 : 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.stroke();

        // Category indicator - small colored ring
        if (!n.isStart && !n.isTarget) {
          ctx.strokeStyle = n.color;
          ctx.lineWidth = 2;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Label
        ctx.fillStyle = WHITE;
        ctx.font = `bold ${NODE_LABEL_SIZE}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(n.word, n.x, n.y);

        // Category label below node (small)
        ctx.fillStyle = n.color;
        ctx.globalAlpha = 0.6;
        ctx.font = `9px monospace`;
        ctx.fillText(n.category, n.x, n.y + n.radius + 12);
        ctx.globalAlpha = 1;

        // Start/Target labels
        if (n.isStart) {
          ctx.fillStyle = GREEN;
          ctx.font = 'bold 10px monospace';
          ctx.fillText('START', n.x, n.y - n.radius - 10);
        } else if (n.isTarget) {
          ctx.fillStyle = GOLD;
          ctx.font = 'bold 10px monospace';
          ctx.fillText('TARGET', n.x, n.y - n.radius - 10);
        }
      }
    }

    function drawSignal(ctx: CanvasRenderingContext2D) {
      if (!signal.active) return;

      // Draw trail
      for (const t of signal.trail) {
        const alpha = clamp(t.life / 0.5, 0, 1) * 0.6;
        ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, SIGNAL_RADIUS * alpha * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }

      // Glow
      ctx.shadowColor = PURPLE_GLOW;
      ctx.shadowBlur = 15;
      ctx.fillStyle = WHITE;
      ctx.beginPath();
      ctx.arc(signal.x, signal.y, SIGNAL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Core
      ctx.fillStyle = PURPLE_GLOW;
      ctx.beginPath();
      ctx.arc(signal.x, signal.y, SIGNAL_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    function drawHUD(ctx: CanvasRenderingContext2D) {
      // Top bar background
      ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
      ctx.fillRect(0, 0, W, 44);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.3)';
      ctx.fillRect(0, 43, W, 1);

      // Score
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`Score: ${score}`, 15, 22);

      // Round
      ctx.fillStyle = PURPLE_GLOW;
      ctx.font = '14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Round ${round}`, W / 2, 15);

      // Streak
      if (streak > 0) {
        const streakMult = Math.min(3, 1 + (streak - 1) * 0.5);
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`Streak: ${streak} (${streakMult}x)`, W / 2, 32);
      }

      // Lives (brain icons)
      ctx.textAlign = 'right';
      for (let i = 0; i < 3; i++) {
        if (i < lives) {
          drawBrainIcon(ctx, W - 20 - i * 30, 22, 10, PURPLE_GLOW);
        } else {
          drawBrainIcon(ctx, W - 20 - i * 30, 22, 10, '#333344');
        }
      }

      // Timer
      if (!signalFired && !roundComplete) {
        const remaining = Math.max(0, roundTimeLimit - roundTime);
        const timerColor = remaining <= 10 ? RED : remaining <= 20 ? GOLD : DIM;
        ctx.fillStyle = timerColor;
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`${Math.ceil(remaining)}s`, W - 110, 22);
      }

      // Fire button hint
      if (!signalFired && !roundComplete && connections.length > 0) {
        const btnX = W / 2;
        const btnY = H - 30;
        const btnW = 140;
        const btnH = 32;

        // Check if mouse is hovering the button
        const hovering = mouseX >= btnX - btnW / 2 && mouseX <= btnX + btnW / 2 &&
                         mouseY >= btnY - btnH / 2 && mouseY <= btnY + btnH / 2;

        ctx.fillStyle = hovering ? PURPLE : PURPLE_DARK;
        ctx.beginPath();
        roundedRect(ctx, btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
        ctx.fill();

        ctx.strokeStyle = PURPLE_GLOW;
        ctx.lineWidth = hovering ? 2 : 1;
        ctx.beginPath();
        roundedRect(ctx, btnX - btnW / 2, btnY - btnH / 2, btnW, btnH, 6);
        ctx.stroke();

        ctx.fillStyle = WHITE;
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isTouch ? 'TAP TO FIRE' : 'SPACE / FIRE', btnX, btnY);
      }

      // Connection count
      if (!roundComplete) {
        ctx.fillStyle = DIM;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Connections: ${connections.length}`, 15, H - 15);
      }

      // Instructions
      if (!signalFired && !roundComplete && connections.length === 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const instrText = isTouch
          ? 'Drag between nodes to connect. Tap FIRE to send signal.'
          : 'Drag between nodes to connect. Right-click to remove. Space to fire.';
        ctx.fillText(instrText, W / 2, H - 15);
      }
    }

    function drawBrainIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
      ctx.fillStyle = color;
      ctx.beginPath();
      // Simplified brain shape: two bumpy halves
      ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.7, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.7, Math.PI * 0.8, Math.PI * 2.2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x - r * 0.2, y + r * 0.3, r * 0.5, 0, Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + r * 0.2, y + r * 0.3, r * 0.5, 0, Math.PI);
      ctx.fill();

      // Dividing line
      ctx.strokeStyle = color === '#333344' ? '#222233' : BG;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - r * 0.8);
      ctx.quadraticCurveTo(x + r * 0.15, y, x, y + r * 0.7);
      ctx.stroke();
    }

    function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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
    // Menu screen
    // -------------------------------------------------------------------

    function drawMenu(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Animated background
      drawBgNodes(ctx);

      // Title glow
      const titlePulse = Math.sin(menuTime * 2) * 0.3 + 0.7;
      ctx.shadowColor = PURPLE;
      ctx.shadowBlur = 30 * titlePulse;

      // Title
      ctx.fillStyle = PURPLE_GLOW;
      ctx.font = 'bold 64px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('DENDRITE', W / 2, H / 2 - 100);
      ctx.shadowBlur = 0;

      // Subtitle
      ctx.fillStyle = DIM;
      ctx.font = '20px monospace';
      ctx.fillText('Build a Brain', W / 2, H / 2 - 50);

      // Decorative line
      const lineW = 200;
      ctx.strokeStyle = PURPLE;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - lineW / 2, H / 2 - 25);
      ctx.lineTo(W / 2 + lineW / 2, H / 2 - 25);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // How to play
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '13px monospace';
      const instructions = [
        'Connect concept nodes by dragging between them',
        'Fire a signal from START to reach TARGET',
        'Connect words from the same category to build your path',
      ];
      instructions.forEach((line, i) => {
        ctx.fillText(line, W / 2, H / 2 + 10 + i * 22);
      });

      // High score
      if (highScore > 0) {
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 16px monospace';
        ctx.fillText(`High Score: ${highScore}`, W / 2, H / 2 + 95);
      }

      // Start prompt
      const promptPulse = Math.sin(menuTime * 3) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(168, 85, 247, ${promptPulse})`;
      ctx.font = 'bold 16px monospace';
      const startText = isTouch ? 'Tap to Start' : 'Press ENTER or Click to Start';
      ctx.fillText(startText, W / 2, H / 2 + 145);

      // Decorative brain at bottom
      drawBrainIcon(ctx, W / 2, H / 2 + 190, 20, PURPLE_DIM);

      // Version / credit line
      ctx.fillStyle = 'rgba(102, 119, 136, 0.4)';
      ctx.font = '10px monospace';
      ctx.fillText('Neural Network Connection Game', W / 2, H - 20);
    }

    // -------------------------------------------------------------------
    // Game over screen
    // -------------------------------------------------------------------

    function drawGameOver(ctx: CanvasRenderingContext2D) {
      // Overlay
      ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.shadowColor = RED;
      ctx.shadowBlur = 20;
      ctx.fillStyle = RED;
      ctx.font = 'bold 48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('GAME OVER', W / 2, H / 2 - 110);
      ctx.shadowBlur = 0;

      // Decorative line
      ctx.strokeStyle = PURPLE;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 120, H / 2 - 75);
      ctx.lineTo(W / 2 + 120, H / 2 - 75);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Stats
      const statsY = H / 2 - 40;
      const lineH = 32;

      ctx.fillStyle = WHITE;
      ctx.font = 'bold 20px monospace';
      ctx.fillText(`Final Score: ${score}`, W / 2, statsY);

      ctx.fillStyle = highScore === score && score > 0 ? GOLD : DIM;
      ctx.font = '16px monospace';
      ctx.fillText(`High Score: ${highScore}`, W / 2, statsY + lineH);

      ctx.fillStyle = PURPLE_GLOW;
      ctx.font = '16px monospace';
      ctx.fillText(`Rounds Completed: ${round - 1}`, W / 2, statsY + lineH * 2);

      ctx.fillStyle = CYAN;
      ctx.font = '16px monospace';
      ctx.fillText(`Best Streak: ${bestStreak}`, W / 2, statsY + lineH * 3);

      // High score notification
      if (isNewHighScore) {
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 14px monospace';
        ctx.fillText('NEW HIGH SCORE!', W / 2, statsY + lineH * 4 + 10);
      }

      // Restart prompt
      const promptPulse = Math.sin(gameTime * 3) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(168, 85, 247, ${promptPulse})`;
      ctx.font = 'bold 16px monospace';
      const restartText = isTouch ? 'Tap to Play Again' : 'Press ENTER to Play Again';
      ctx.fillText(restartText, W / 2, H / 2 + 130);
    }

    // -------------------------------------------------------------------
    // Pause overlay
    // -------------------------------------------------------------------

    function drawPause(ctx: CanvasRenderingContext2D) {
      ctx.fillStyle = 'rgba(10, 10, 26, 0.7)';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = PURPLE_GLOW;
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PAUSED', W / 2, H / 2 - 15);

      ctx.fillStyle = DIM;
      ctx.font = '14px monospace';
      ctx.fillText('Press P or ESC to resume', W / 2, H / 2 + 25);
    }

    // -------------------------------------------------------------------
    // Main render
    // -------------------------------------------------------------------

    function render(ctx: CanvasRenderingContext2D) {
      ctx.save();

      // Screen shake
      if (shakeTimer > 0) {
        const intensity = shakeIntensity * (shakeTimer / 0.4);
        ctx.translate(
          (Math.random() - 0.5) * intensity,
          (Math.random() - 0.5) * intensity,
        );
      }

      if (state === 'menu') {
        drawMenu(ctx);
      } else if (state === 'playing') {
        drawBackground(ctx);
        drawConnections(ctx);
        drawDragPreview(ctx);
        drawNodes(ctx);
        drawSignal(ctx);
        drawParticles(ctx);
        drawFloatingTexts(ctx);
        drawHUD(ctx);

        if (paused) {
          drawPause(ctx);
        }
      } else if (state === 'gameover') {
        drawBackground(ctx);
        drawConnections(ctx);
        drawNodes(ctx);
        drawParticles(ctx);
        drawFloatingTexts(ctx);
        drawGameOver(ctx);
      }

      ctx.restore();

      // Don't draw D-pad overlay — this game uses touch drag, not D-pad
    }

    // -------------------------------------------------------------------
    // Input handlers
    // -------------------------------------------------------------------

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault();
        if (state === 'playing' && !paused) {
          spacePressed = true;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (state === 'menu') {
          startGame();
        } else if (state === 'gameover') {
          state = 'menu';
          isNewHighScore = false;
          initBgNodes();
        }
      }

      if (state === 'playing' && (e.key === 'p' || e.key === 'P' || e.key === 'Escape')) {
        paused = !paused;
        SoundEngine.play('click');
      }
    };

    const onKeyUp = (_e: KeyboardEvent) => {
    };

    // Cache canvas rect
    let cachedRect = canvas.getBoundingClientRect();
    const onResize = () => { cachedRect = canvas.getBoundingClientRect(); };
    window.addEventListener('resize', onResize);

    function canvasCoords(clientX: number, clientY: number): { cx: number; cy: number } {
      return {
        cx: ((clientX - cachedRect.left) / cachedRect.width) * W,
        cy: ((clientY - cachedRect.top) / cachedRect.height) * H,
      };
    }

    const onMouseMove = (e: MouseEvent) => {
      const { cx, cy } = canvasCoords(e.clientX, e.clientY);
      mouseX = cx;
      mouseY = cy;
    };

    const onMouseDown = (e: MouseEvent) => {
      const { cx, cy } = canvasCoords(e.clientX, e.clientY);
      mouseX = cx;
      mouseY = cy;

      if (e.button === 2) {
        // Right click - remove connection
        rightClicked = true;
        e.preventDefault();
        return;
      }

      if (e.button === 0) {
        mouseDown = true;

        if (state === 'menu') {
          startGame();
          return;
        }

        if (state === 'gameover') {
          state = 'menu';
          initBgNodes();
          return;
        }

        if (state === 'playing' && !paused && !signalFired && !roundComplete) {
          // Check if clicking the fire button
          const btnX = W / 2;
          const btnY = H - 30;
          const btnW = 140;
          const btnH = 32;
          if (connections.length > 0 &&
              cx >= btnX - btnW / 2 && cx <= btnX + btnW / 2 &&
              cy >= btnY - btnH / 2 && cy <= btnY + btnH / 2) {
            spacePressed = true;
            return;
          }

          // Check if clicking on a node to start dragging
          const nodeIdx = getNodeAt(cx, cy);
          if (nodeIdx >= 0) {
            dragging = true;
            dragFromIdx = nodeIdx;
          }
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        mouseDown = false;

        if (dragging && dragFromIdx >= 0 && state === 'playing' && !signalFired && !roundComplete) {
          const { cx, cy } = canvasCoords(e.clientX, e.clientY);
          mouseX = cx;
          mouseY = cy;
          const targetNode = getNodeAt(cx, cy);
          if (targetNode >= 0 && targetNode !== dragFromIdx) {
            addConnection(dragFromIdx, targetNode);
          }
        }

        dragging = false;
        dragFromIdx = -1;
      }
    };

    const onContextMenu = (e: Event) => {
      e.preventDefault();
    };

    // Touch handlers
    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (!t) return;
      const { cx, cy } = canvasCoords(t.clientX, t.clientY);
      mouseX = cx;
      mouseY = cy;

      if (state === 'menu') {
        startGame();
        return;
      }

      if (state === 'gameover') {
        state = 'menu';
        isNewHighScore = false;
        initBgNodes();
        return;
      }

      if (state === 'playing' && !paused && !signalFired && !roundComplete) {
        // Check fire button
        const btnX = W / 2;
        const btnY = H - 30;
        const btnW = 140;
        const btnH = 32;
        if (connections.length > 0 &&
            cx >= btnX - btnW / 2 && cx <= btnX + btnW / 2 &&
            cy >= btnY - btnH / 2 && cy <= btnY + btnH / 2) {
          spacePressed = true;
          return;
        }

        // Check node
        const nodeIdx = getNodeAt(cx, cy);
        if (nodeIdx >= 0) {
          dragging = true;
          dragFromIdx = nodeIdx;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (!t) return;
      const { cx, cy } = canvasCoords(t.clientX, t.clientY);
      mouseX = cx;
      mouseY = cy;
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (!t) return;
      const { cx, cy } = canvasCoords(t.clientX, t.clientY);
      mouseX = cx;
      mouseY = cy;

      if (dragging && dragFromIdx >= 0 && state === 'playing' && !signalFired && !roundComplete) {
        const targetNode = getNodeAt(cx, cy);
        if (targetNode >= 0 && targetNode !== dragFromIdx) {
          addConnection(dragFromIdx, targetNode);
        } else if (targetNode < 0) {
          // If released not on a node, try removing a connection near the release point
          removeConnectionAt(cx, cy);
        }
      }

      dragging = false;
      dragFromIdx = -1;
    };

    const onVisibilityChange = () => {
      if (document.hidden && state === 'playing') {
        paused = true;
      }
    };

    // -------------------------------------------------------------------
    // Game loop
    // -------------------------------------------------------------------

    function loop(timestamp: number) {
      if (destroyed) return;

      const rawDt = lastTime === 0 ? 1 / 60 : (timestamp - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.1);
      lastTime = timestamp;

      // Process deferred inputs
      if (spacePressed) {
        spacePressed = false;
        if (state === 'playing' && !paused) {
          fireSignal();
        }
      }

      if (rightClicked) {
        rightClicked = false;
        if (state === 'playing' && !paused && !signalFired && !roundComplete) {
          removeConnectionAt(mouseX, mouseY);
        }
      }

      // Update
      if (state === 'menu') {
        menuTime += dt;
        updateBgNodes(dt);
      } else if (state === 'playing') {
        update(dt);
      } else if (state === 'gameover') {
        gameTime += dt;
        updateParticles(dt);
        updateFloatingTexts(dt);
      }

      // Render
      render(ctx);

      animId = requestAnimationFrame(loop);
    }

    // -------------------------------------------------------------------
    // Init & bind
    // -------------------------------------------------------------------

    initBgNodes();
    highScore = getHighScore(GAME_SLUG);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', onTouchEnd, { passive: false });
    document.addEventListener('visibilitychange', onVisibilityChange);

    lastTime = 0;
    animId = requestAnimationFrame(loop);

    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      SoundEngine.stopAmbient();
      touch.destroy();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
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
        display: 'block',
        width: '100%',
        maxWidth: `${W}px`,
        height: 'auto',
        aspectRatio: `${W}/${H}`,
        imageRendering: 'auto',
        background: BG,
      }}
    />
  );
}
