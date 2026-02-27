'use client';

import { useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';
import { reportGameStart, reportGameEnd, reportLevelComplete } from '@/lib/game-events';

// ─── Canvas ───
const W = 800;
const H = 600;

// ─── Colors ───
const BG = '#0a0a1a';
const CYAN = '#00ffff';
const MAGENTA = '#ff00ff';
const WHITE = '#ffffff';
const DIM = '#334455';
const GOLD = '#ffd700';
const PHASE_A_COLOR = CYAN;
const PHASE_B_COLOR = MAGENTA;
const BOTH_COLOR = '#aa88ff';
const GHOST_ALPHA = 0.15;

// ─── Physics ───
const PLAYER_X = 150;
const PLAYER_SIZE = 22;
const DASH_GRAVITY = 1800;
const DASH_JUMP = -580;
const COYOTE_MS = 80;
const GLIDE_GRAVITY_DEFAULT = 400;
const GLIDE_FLY = -350;
const FLIP_GRAVITY = 1800;
const WAVE_SPEED = 350;

// ─── Types ───
type Phase = 'A' | 'B';
type PhaseAffinity = 'A' | 'B' | 'both';
type ModeType = 'dash' | 'glide' | 'flip' | 'wave';
type GameState = 'menu' | 'levelSelect' | 'levelIntro' | 'playing' | 'dead' | 'levelComplete' | 'paused';

interface LevelElement {
  x: number; y: number; w: number; h: number;
  phase: PhaseAffinity;
  type: 'ground' | 'platform' | 'obstacle' | 'spike';
}

interface Portal {
  x: number; y: number;
  toMode: ModeType;
}

interface Collectible {
  x: number; y: number;
  phase: PhaseAffinity;
  collected: boolean;
}

interface LevelConfig {
  name: string;
  scrollSpeed: number;
  groundY: number;
  elements: LevelElement[];
  portals: Portal[];
  collectibles: Collectible[];
  length: number;
  startMode: ModeType;
  allowPhaseShift: boolean;
}

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

interface Star {
  x: number; y: number; speed: number; size: number; alpha: number;
}

// ─── Helpers ───
function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}


function phaseColor(p: PhaseAffinity): string {
  return p === 'A' ? PHASE_A_COLOR : p === 'B' ? PHASE_B_COLOR : BOTH_COLOR;
}

function rect(x: number, y: number, w: number, h: number, phase: PhaseAffinity, type: LevelElement['type'] = 'obstacle'): LevelElement {
  return { x, y, w, h, phase, type };
}

function ground(x: number, w: number, y: number, phase: PhaseAffinity = 'both'): LevelElement {
  return { x, y, w, h: H - y + 50, phase, type: 'ground' };
}

function plat(x: number, y: number, w: number, phase: PhaseAffinity = 'both'): LevelElement {
  return { x, y, w, h: 16, phase, type: 'platform' };
}

function spike(x: number, y: number, w: number, h: number, phase: PhaseAffinity = 'both'): LevelElement {
  return { x, y, w, h, phase, type: 'spike' };
}

function portal(x: number, y: number, toMode: ModeType): Portal {
  return { x, y, toMode };
}

function star(x: number, y: number, phase: PhaseAffinity): Collectible {
  return { x, y, phase, collected: false };
}

// ─── Level Data ───
function makeLevels(): LevelConfig[] {
  return [
    // Level 1: First Steps — basic dash jumps, no phase shift
    {
      name: 'First Steps',
      scrollSpeed: 180,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: false,
      length: 4000,
      portals: [],
      collectibles: [
        star(800, 400, 'both'),
        star(1800, 380, 'both'),
        star(2800, 350, 'both'),
      ],
      elements: [
        ground(0, 4200, 480),
        // gap 1
        rect(600, 480, 120, 120, 'both', 'spike'),
        plat(650, 420, 80),
        // gap 2
        rect(1000, 480, 80, 120, 'both', 'spike'),
        rect(1120, 480, 80, 120, 'both', 'spike'),
        plat(1050, 400, 100),
        // platforms section
        plat(1500, 400, 100),
        plat(1650, 350, 100),
        plat(1800, 380, 100),
        // obstacle run
        rect(2200, 430, 40, 50, 'both', 'obstacle'),
        rect(2400, 430, 40, 50, 'both', 'obstacle'),
        rect(2600, 430, 40, 50, 'both', 'obstacle'),
        rect(2800, 410, 40, 70, 'both', 'obstacle'),
        // final section
        rect(3200, 420, 60, 60, 'both', 'obstacle'),
        rect(3400, 400, 50, 80, 'both', 'obstacle'),
        plat(3500, 380, 120),
      ],
    },
    // Level 2: Getting Rhythm — tighter gaps
    {
      name: 'Getting Rhythm',
      scrollSpeed: 200,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: false,
      length: 4500,
      portals: [],
      collectibles: [
        star(1200, 350, 'both'),
        star(2400, 300, 'both'),
        star(3600, 380, 'both'),
      ],
      elements: [
        ground(0, 4700, 480),
        // rapid obstacles
        rect(500, 430, 40, 50, 'both', 'obstacle'),
        rect(650, 430, 40, 50, 'both', 'obstacle'),
        rect(800, 430, 40, 50, 'both', 'obstacle'),
        rect(950, 410, 40, 70, 'both', 'obstacle'),
        // platform hops
        plat(1100, 400, 80),
        plat(1250, 360, 80),
        plat(1400, 320, 80),
        plat(1550, 360, 80),
        plat(1700, 400, 80),
        // spike gauntlet
        spike(1900, 460, 40, 20, 'both'),
        spike(1980, 460, 40, 20, 'both'),
        spike(2060, 460, 40, 20, 'both'),
        rect(2200, 400, 60, 80, 'both', 'obstacle'),
        plat(2300, 350, 120),
        rect(2500, 380, 50, 100, 'both', 'obstacle'),
        rect(2650, 380, 50, 100, 'both', 'obstacle'),
        // final gauntlet
        spike(2900, 460, 40, 20, 'both'),
        rect(2980, 430, 40, 50, 'both', 'obstacle'),
        spike(3060, 460, 40, 20, 'both'),
        rect(3140, 430, 40, 50, 'both', 'obstacle'),
        plat(3300, 380, 100),
        rect(3500, 400, 60, 80, 'both', 'obstacle'),
        rect(3700, 380, 60, 100, 'both', 'obstacle'),
        plat(3800, 350, 120),
        rect(4000, 420, 50, 60, 'both', 'obstacle'),
      ],
    },
    // Level 3: Dual Vision — phase shift introduced
    {
      name: 'Dual Vision',
      scrollSpeed: 200,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: true,
      length: 4500,
      portals: [],
      collectibles: [
        star(1000, 350, 'A'),
        star(2200, 380, 'B'),
        star(3400, 320, 'A'),
      ],
      elements: [
        ground(0, 4700, 480),
        // Phase A platforms (cyan)
        plat(600, 380, 120, 'A'),
        plat(900, 340, 120, 'A'),
        // Phase B wall blocking if in A
        rect(750, 350, 40, 130, 'B', 'obstacle'),
        // Phase A wall
        rect(1100, 380, 40, 100, 'A', 'obstacle'),
        // Both phase ground spike - must jump
        spike(1300, 460, 60, 20, 'both'),
        // Phase B platforms
        plat(1500, 360, 120, 'B'),
        plat(1700, 320, 100, 'B'),
        // Phase A obstacle
        rect(1600, 340, 40, 140, 'A', 'obstacle'),
        // Alternating section
        rect(2000, 400, 50, 80, 'A', 'obstacle'),
        rect(2150, 400, 50, 80, 'B', 'obstacle'),
        rect(2300, 400, 50, 80, 'A', 'obstacle'),
        rect(2450, 400, 50, 80, 'B', 'obstacle'),
        // Phase platforms
        plat(2700, 360, 100, 'A'),
        plat(2850, 380, 100, 'B'),
        plat(3000, 340, 100, 'A'),
        rect(3200, 380, 50, 100, 'B', 'obstacle'),
        rect(3400, 380, 50, 100, 'A', 'obstacle'),
        plat(3600, 360, 120, 'B'),
        spike(3800, 460, 80, 20, 'both'),
        plat(3900, 380, 100, 'A'),
        rect(4100, 400, 60, 80, 'both', 'obstacle'),
      ],
    },
    // Level 4: Split Path — heavy phase switching
    {
      name: 'Split Path',
      scrollSpeed: 220,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: true,
      length: 5000,
      portals: [],
      collectibles: [
        star(1400, 300, 'B'),
        star(2600, 280, 'A'),
        star(4000, 320, 'B'),
      ],
      elements: [
        ground(0, 5200, 480),
        // A-only path
        plat(500, 380, 100, 'A'),
        rect(500, 380, 100, 16, 'A', 'platform'),
        rect(650, 360, 40, 120, 'B', 'obstacle'),
        plat(800, 340, 100, 'A'),
        rect(950, 300, 40, 180, 'B', 'obstacle'),
        // Switch to B
        rect(1100, 360, 40, 120, 'A', 'obstacle'),
        plat(1200, 340, 100, 'B'),
        plat(1400, 300, 100, 'B'),
        rect(1550, 320, 40, 160, 'A', 'obstacle'),
        // Rapid alternation
        rect(1800, 420, 40, 60, 'A', 'obstacle'),
        rect(1900, 420, 40, 60, 'B', 'obstacle'),
        rect(2000, 420, 40, 60, 'A', 'obstacle'),
        rect(2100, 420, 40, 60, 'B', 'obstacle'),
        rect(2200, 420, 40, 60, 'A', 'obstacle'),
        rect(2300, 420, 40, 60, 'B', 'obstacle'),
        // Tricky platforms
        plat(2500, 350, 80, 'A'),
        plat(2600, 280, 80, 'B'),
        plat(2700, 350, 80, 'A'),
        rect(2800, 380, 40, 100, 'both', 'obstacle'),
        // Final gauntlet
        spike(3000, 460, 50, 20, 'A'),
        spike(3100, 460, 50, 20, 'B'),
        spike(3200, 460, 50, 20, 'A'),
        spike(3300, 460, 50, 20, 'B'),
        plat(3500, 360, 100, 'B'),
        rect(3700, 380, 60, 100, 'A', 'obstacle'),
        plat(3800, 340, 100, 'A'),
        rect(4000, 320, 50, 160, 'B', 'obstacle'),
        plat(4200, 360, 120, 'B'),
        spike(4400, 460, 80, 20, 'both'),
      ],
    },
    // Level 5: Take Flight — glide introduction
    {
      name: 'Take Flight',
      scrollSpeed: 220,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: true,
      length: 5500,
      portals: [
        portal(1800, 400, 'glide'),
        portal(3500, 400, 'dash'),
      ],
      collectibles: [
        star(1000, 350, 'A'),
        star(2600, 250, 'B'),
        star(4200, 380, 'A'),
      ],
      elements: [
        ground(0, 2000, 480),
        // Dash section
        rect(500, 420, 40, 60, 'A', 'obstacle'),
        rect(700, 420, 40, 60, 'B', 'obstacle'),
        plat(900, 360, 100, 'A'),
        rect(1100, 380, 50, 100, 'B', 'obstacle'),
        plat(1300, 350, 100, 'both'),
        rect(1500, 400, 50, 80, 'A', 'obstacle'),
        // Glide section — no ground
        plat(2000, 300, 80, 'A'),
        plat(2200, 350, 80, 'B'),
        plat(2400, 280, 80, 'A'),
        plat(2600, 250, 80, 'B'),
        plat(2800, 320, 80, 'both'),
        plat(3000, 280, 80, 'A'),
        plat(3200, 350, 80, 'B'),
        // Back to ground for dash
        ground(3400, 2300, 480),
        rect(3800, 420, 50, 60, 'A', 'obstacle'),
        rect(3950, 420, 50, 60, 'B', 'obstacle'),
        rect(4100, 400, 50, 80, 'both', 'obstacle'),
        plat(4300, 380, 100, 'A'),
        spike(4500, 460, 60, 20, 'both'),
        rect(4700, 420, 50, 60, 'A', 'obstacle'),
        plat(4900, 380, 120, 'B'),
      ],
    },
    // Level 6: Sky Divide — glide-heavy
    {
      name: 'Sky Divide',
      scrollSpeed: 240,
      groundY: 480,
      startMode: 'glide',
      allowPhaseShift: true,
      length: 5500,
      portals: [
        portal(2800, 350, 'dash'),
        portal(4000, 400, 'glide'),
      ],
      collectibles: [
        star(900, 200, 'A'),
        star(2200, 180, 'B'),
        star(4600, 250, 'A'),
      ],
      elements: [
        // Glide corridors with phase walls
        plat(0, 480, 300, 'both'),
        // Ceiling and floor constraints
        rect(400, 0, 40, 200, 'A', 'obstacle'),
        rect(400, 350, 40, 250, 'A', 'obstacle'),
        rect(600, 0, 40, 280, 'B', 'obstacle'),
        rect(600, 400, 40, 200, 'B', 'obstacle'),
        rect(800, 0, 40, 150, 'A', 'obstacle'),
        rect(800, 300, 40, 300, 'A', 'obstacle'),
        // Narrow gap phase B
        rect(1000, 0, 40, 220, 'B', 'obstacle'),
        rect(1000, 340, 40, 260, 'B', 'obstacle'),
        // Wider section
        plat(1200, 280, 80, 'A'),
        plat(1400, 350, 80, 'B'),
        rect(1600, 0, 40, 250, 'both', 'obstacle'),
        rect(1600, 380, 40, 220, 'both', 'obstacle'),
        plat(1800, 300, 100, 'A'),
        rect(2000, 0, 40, 200, 'B', 'obstacle'),
        rect(2000, 320, 40, 280, 'B', 'obstacle'),
        plat(2200, 180, 80, 'B'),
        rect(2400, 0, 40, 280, 'A', 'obstacle'),
        rect(2400, 400, 40, 200, 'A', 'obstacle'),
        // Dash section
        ground(2700, 1500, 480),
        rect(3000, 420, 50, 60, 'A', 'obstacle'),
        rect(3200, 420, 50, 60, 'B', 'obstacle'),
        rect(3400, 400, 50, 80, 'both', 'obstacle'),
        plat(3600, 380, 100, 'A'),
        rect(3800, 420, 40, 60, 'B', 'obstacle'),
        // Back to glide
        plat(4200, 300, 80, 'A'),
        rect(4400, 0, 40, 220, 'B', 'obstacle'),
        rect(4400, 350, 40, 250, 'B', 'obstacle'),
        plat(4600, 250, 80, 'A'),
        plat(4800, 320, 80, 'B'),
        plat(5000, 280, 100, 'both'),
      ],
    },
    // Level 7: Gravity Shift — flip mode
    {
      name: 'Gravity Shift',
      scrollSpeed: 240,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: true,
      length: 5500,
      portals: [
        portal(1500, 400, 'flip'),
        portal(3800, 400, 'dash'),
      ],
      collectibles: [
        star(800, 380, 'A'),
        star(2400, 100, 'B'),
        star(4400, 380, 'A'),
      ],
      elements: [
        ground(0, 1700, 480),
        // Dash intro
        rect(400, 420, 50, 60, 'A', 'obstacle'),
        rect(600, 420, 50, 60, 'B', 'obstacle'),
        plat(800, 380, 100, 'A'),
        rect(1000, 400, 50, 80, 'B', 'obstacle'),
        rect(1200, 420, 50, 60, 'A', 'obstacle'),
        // Flip section — ground and ceiling
        ground(1400, 2600, 480),
        rect(1400, 0, 4000, 16, 'both', 'ground'), // ceiling
        // Phase obstacles on floor and ceiling
        rect(1700, 440, 40, 40, 'A', 'obstacle'),
        rect(1700, 16, 40, 40, 'A', 'obstacle'),
        rect(1900, 440, 40, 40, 'B', 'obstacle'),
        rect(1900, 16, 40, 40, 'B', 'obstacle'),
        plat(2100, 400, 80, 'A'),
        plat(2100, 80, 80, 'A'), // ceiling platform
        rect(2300, 440, 40, 40, 'both', 'obstacle'),
        plat(2400, 100, 100, 'B'),
        rect(2600, 440, 50, 40, 'A', 'obstacle'),
        rect(2600, 16, 50, 40, 'B', 'obstacle'),
        plat(2800, 380, 80, 'B'),
        plat(2800, 100, 80, 'A'),
        rect(3000, 420, 60, 60, 'A', 'obstacle'),
        rect(3000, 16, 60, 60, 'B', 'obstacle'),
        rect(3200, 440, 40, 40, 'B', 'obstacle'),
        rect(3200, 16, 40, 40, 'A', 'obstacle'),
        plat(3400, 360, 100, 'A'),
        plat(3400, 120, 100, 'B'),
        rect(3600, 420, 50, 60, 'both', 'obstacle'),
        // Back to dash
        rect(4000, 420, 50, 60, 'A', 'obstacle'),
        rect(4200, 400, 50, 80, 'B', 'obstacle'),
        plat(4400, 380, 100, 'A'),
        rect(4600, 420, 40, 60, 'B', 'obstacle'),
        rect(4800, 400, 60, 80, 'both', 'obstacle'),
        plat(5000, 380, 120, 'A'),
      ],
    },
    // Level 8: Upside Down — multi-mode combos
    {
      name: 'Upside Down',
      scrollSpeed: 260,
      groundY: 480,
      startMode: 'flip',
      allowPhaseShift: true,
      length: 6000,
      portals: [
        portal(1800, 400, 'dash'),
        portal(3200, 400, 'glide'),
        portal(4500, 400, 'flip'),
      ],
      collectibles: [
        star(1200, 100, 'B'),
        star(2800, 300, 'A'),
        star(5000, 100, 'B'),
      ],
      elements: [
        // Flip start
        ground(0, 2000, 480),
        rect(0, 0, 6200, 16, 'both', 'ground'),
        rect(400, 440, 40, 40, 'A', 'obstacle'),
        rect(400, 16, 40, 40, 'B', 'obstacle'),
        rect(600, 440, 40, 40, 'B', 'obstacle'),
        rect(600, 16, 40, 40, 'A', 'obstacle'),
        plat(800, 380, 80, 'A'),
        plat(800, 100, 80, 'B'),
        rect(1000, 440, 50, 40, 'both', 'obstacle'),
        rect(1200, 100, 80, 16, 'B', 'platform'),
        rect(1400, 420, 40, 60, 'A', 'obstacle'),
        rect(1600, 16, 40, 60, 'B', 'obstacle'),
        // Dash section
        rect(2000, 420, 50, 60, 'A', 'obstacle'),
        rect(2200, 420, 50, 60, 'B', 'obstacle'),
        plat(2400, 380, 80, 'A'),
        rect(2600, 400, 50, 80, 'both', 'obstacle'),
        plat(2800, 350, 100, 'A'),
        rect(3000, 420, 40, 60, 'B', 'obstacle'),
        // Glide section
        plat(3400, 300, 80, 'A'),
        plat(3600, 250, 80, 'B'),
        plat(3800, 320, 80, 'A'),
        plat(4000, 270, 80, 'B'),
        plat(4200, 350, 80, 'both'),
        // Flip finale
        rect(4700, 440, 40, 40, 'A', 'obstacle'),
        rect(4700, 16, 40, 40, 'B', 'obstacle'),
        plat(4900, 380, 80, 'B'),
        plat(4900, 100, 80, 'A'),
        rect(5100, 440, 50, 40, 'A', 'obstacle'),
        rect(5100, 16, 50, 40, 'B', 'obstacle'),
        plat(5300, 360, 100, 'B'),
        plat(5300, 120, 100, 'A'),
        rect(5500, 420, 60, 60, 'both', 'obstacle'),
      ],
    },
    // Level 9: Wave Runner — all modes
    {
      name: 'Wave Runner',
      scrollSpeed: 260,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: true,
      length: 6500,
      portals: [
        portal(1200, 400, 'wave'),
        portal(2800, 350, 'glide'),
        portal(4000, 400, 'flip'),
        portal(5200, 400, 'dash'),
      ],
      collectibles: [
        star(1800, 250, 'A'),
        star(3400, 200, 'B'),
        star(5600, 380, 'A'),
      ],
      elements: [
        ground(0, 1400, 480),
        // Dash warmup
        rect(400, 420, 40, 60, 'A', 'obstacle'),
        rect(600, 420, 40, 60, 'B', 'obstacle'),
        rect(800, 400, 50, 80, 'both', 'obstacle'),
        plat(1000, 380, 100, 'A'),
        // Wave corridors
        rect(1400, 0, 40, 200, 'A', 'obstacle'),
        rect(1400, 350, 40, 250, 'A', 'obstacle'),
        rect(1600, 0, 40, 250, 'B', 'obstacle'),
        rect(1600, 400, 40, 200, 'B', 'obstacle'),
        rect(1800, 0, 40, 180, 'A', 'obstacle'),
        rect(1800, 330, 40, 270, 'A', 'obstacle'),
        rect(2000, 0, 40, 280, 'B', 'obstacle'),
        rect(2000, 420, 40, 180, 'B', 'obstacle'),
        rect(2200, 0, 40, 200, 'both', 'obstacle'),
        rect(2200, 350, 40, 250, 'both', 'obstacle'),
        rect(2400, 0, 40, 240, 'A', 'obstacle'),
        rect(2400, 380, 40, 220, 'A', 'obstacle'),
        plat(2600, 300, 80, 'B'),
        // Glide
        plat(3000, 280, 80, 'A'),
        plat(3200, 350, 80, 'B'),
        plat(3400, 200, 80, 'B'),
        plat(3600, 300, 80, 'A'),
        // Flip
        ground(3900, 1500, 480),
        rect(3900, 0, 1500, 16, 'both', 'ground'),
        rect(4200, 440, 40, 40, 'A', 'obstacle'),
        rect(4200, 16, 40, 40, 'B', 'obstacle'),
        rect(4400, 440, 40, 40, 'B', 'obstacle'),
        rect(4400, 16, 40, 40, 'A', 'obstacle'),
        rect(4600, 440, 40, 40, 'both', 'obstacle'),
        rect(4800, 16, 40, 40, 'both', 'obstacle'),
        plat(5000, 380, 80, 'A'),
        // Dash finish
        rect(5400, 420, 50, 60, 'A', 'obstacle'),
        rect(5600, 420, 50, 60, 'B', 'obstacle'),
        plat(5800, 380, 100, 'both'),
        rect(6000, 400, 60, 80, 'A', 'obstacle'),
      ],
    },
    // Level 10: Phase Finale — everything, fast
    {
      name: 'Phase Finale',
      scrollSpeed: 280,
      groundY: 480,
      startMode: 'dash',
      allowPhaseShift: true,
      length: 7000,
      portals: [
        portal(1000, 400, 'flip'),
        portal(2000, 100, 'wave'),
        portal(3200, 350, 'glide'),
        portal(4500, 400, 'dash'),
        portal(5500, 400, 'flip'),
      ],
      collectibles: [
        star(1600, 100, 'B'),
        star(3800, 200, 'A'),
        star(6200, 380, 'B'),
      ],
      elements: [
        ground(0, 1200, 480),
        // Quick dash
        rect(400, 420, 40, 60, 'A', 'obstacle'),
        rect(550, 420, 40, 60, 'B', 'obstacle'),
        rect(700, 400, 50, 80, 'both', 'obstacle'),
        // Flip section
        ground(900, 1300, 480),
        rect(900, 0, 1300, 16, 'both', 'ground'),
        rect(1200, 440, 40, 40, 'A', 'obstacle'),
        rect(1200, 16, 40, 40, 'B', 'obstacle'),
        rect(1400, 440, 40, 40, 'B', 'obstacle'),
        rect(1400, 16, 40, 40, 'A', 'obstacle'),
        plat(1600, 100, 80, 'B'),
        plat(1600, 380, 80, 'A'),
        rect(1800, 440, 50, 40, 'both', 'obstacle'),
        rect(1800, 16, 50, 40, 'both', 'obstacle'),
        // Wave section
        rect(2200, 0, 40, 200, 'A', 'obstacle'),
        rect(2200, 350, 40, 250, 'A', 'obstacle'),
        rect(2400, 0, 40, 250, 'B', 'obstacle'),
        rect(2400, 380, 40, 220, 'B', 'obstacle'),
        rect(2600, 0, 40, 180, 'A', 'obstacle'),
        rect(2600, 300, 40, 300, 'A', 'obstacle'),
        rect(2800, 0, 40, 220, 'B', 'obstacle'),
        rect(2800, 360, 40, 240, 'B', 'obstacle'),
        rect(3000, 0, 40, 200, 'both', 'obstacle'),
        rect(3000, 350, 40, 250, 'both', 'obstacle'),
        // Glide section
        plat(3400, 280, 80, 'A'),
        plat(3600, 350, 80, 'B'),
        plat(3800, 200, 80, 'A'),
        plat(4000, 300, 80, 'B'),
        plat(4200, 250, 80, 'both'),
        // Dash finale
        ground(4400, 1800, 480),
        rect(4700, 420, 40, 60, 'A', 'obstacle'),
        rect(4850, 420, 40, 60, 'B', 'obstacle'),
        rect(5000, 400, 50, 80, 'A', 'obstacle'),
        rect(5150, 400, 50, 80, 'B', 'obstacle'),
        plat(5300, 380, 100, 'both'),
        // Final flip
        ground(5400, 1800, 480),
        rect(5400, 0, 1800, 16, 'both', 'ground'),
        rect(5700, 440, 40, 40, 'A', 'obstacle'),
        rect(5700, 16, 40, 40, 'B', 'obstacle'),
        rect(5900, 440, 40, 40, 'B', 'obstacle'),
        rect(5900, 16, 40, 40, 'A', 'obstacle'),
        plat(6100, 380, 80, 'A'),
        plat(6100, 100, 80, 'B'),
        rect(6300, 440, 50, 40, 'A', 'obstacle'),
        rect(6300, 16, 50, 40, 'B', 'obstacle'),
        plat(6500, 360, 100, 'both'),
        plat(6500, 120, 100, 'both'),
      ],
    },
  ];
}

// ─── Progress Storage ───
const STORAGE_KEY = 'spryte-phaseshift-progress';

interface ProgressData {
  unlocked: number;
  stars: number[][];
  attempts: number[];
  bestAttempts: number[];
}

function loadProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { unlocked: 2, stars: Array.from({ length: 10 }, () => []), attempts: new Array(10).fill(0), bestAttempts: new Array(10).fill(0) };
}

function saveProgress(p: ProgressData): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

// ─── Component ───
export default function PhaseShiftGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let destroyed = false;
    let animId = 0;
    let lastTime = 0;

    // ─── Game State ───
    let state: GameState = 'menu';
    const levels = makeLevels();
    const progress = loadProgress();
    let highScore = getHighScore('phase-shift');
    let totalScore = 0;

    // ─── Current Level State ───
    let currentLevel = 0;
    let cameraX = 0;
    let phase: Phase = 'A';
    let mode: ModeType = 'dash';
    let phaseFlashTimer = 0;
    let phaseLockFlash = 0;
    let shakeTimer = 0;
    let modeTransitionTimer = 0;
    let modeTransitionColor = GOLD;
    let playerRotation = 0;
    let levelIntroTimer = 0;
    const shakeIntensity = 8;
    let attempts = 0;

    // ─── Player ───
    const px = PLAYER_X;
    let py = 400;
    let vy = 0;
    let onGround = false;
    let coyoteTimer = 0;
    let gravityDir = 1; // 1 = down, -1 = up (flip mode)
    let deathGhostTimer = 0;
    let deathX = 0;
    let deathY = 0;
    let deathMode: ModeType = 'dash';

    // ─── Particles ───
    let particles: Particle[] = [];
    const MAX_PARTICLES = 100;

    // ─── Stars (parallax) ───
    let bgStars: Star[] = [];

    // ─── Input ───
    let actionPressed = false; // jump/fly/flip/wave
    let actionJustPressed = false;
    let phaseJustPressed = false;

    // ─── Level Elements (deep cloned per attempt) ───
    let levelElements: LevelElement[] = [];
    let levelPortals: Portal[] = [];
    let levelCollectibles: Collectible[] = [];
    let levelConfig: LevelConfig | null = null;

    // ─── Menu animation ───
    let menuTime = 0;
    let selectedLevel = 0;

    // ─── Init stars ───
    function initStars() {
      bgStars = [];
      for (let i = 0; i < 120; i++) {
        bgStars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          speed: 0.2 + Math.random() * 0.8,
          size: 0.5 + Math.random() * 2,
          alpha: 0.3 + Math.random() * 0.7,
        });
      }
    }
    initStars();

    // ─── Start Level ───
    function startLevel(idx: number) {
      currentLevel = idx;
      const lvl = levels[idx];
      levelConfig = lvl;
      cameraX = 0;
      phase = 'A';
      mode = lvl.startMode;
      phaseFlashTimer = 0;
      phaseLockFlash = 0;
      modeTransitionTimer = 0;
      shakeTimer = 0;
      playerRotation = 0;
      py = lvl.groundY - PLAYER_SIZE;
      vy = 0;
      onGround = true;
      gravityDir = 1;
      particles = [];
      attempts++;
      progress.attempts[idx] = (progress.attempts[idx] || 0) + 1;

      // Deep clone elements/collectibles
      levelElements = lvl.elements.map(e => ({ ...e }));
      levelPortals = lvl.portals.map(p => ({ ...p }));
      levelCollectibles = lvl.collectibles.map(c => ({ ...c, collected: false }));

      state = 'levelIntro';
      levelIntroTimer = 1.5;
      reportGameStart('phase-shift');
    }

    // ─── Input Handlers ───
    function onKeyDown(e: KeyboardEvent) {
      // Always prevent default on keys that scroll the page — even on repeat
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.repeat) return;

      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        actionJustPressed = true;
        actionPressed = true;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX' || e.code === 'ArrowDown') {
        phaseJustPressed = true;
      }

      // Menu/state navigation
      if (state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) {
        SoundEngine.play('menuSelect');
        state = 'levelSelect';
        selectedLevel = 0;
        e.preventDefault();
        return;
      }
      if (state === 'levelSelect') {
        if (e.code === 'ArrowRight' || e.code === 'KeyD') {
          selectedLevel = Math.min(selectedLevel + 1, 9);
          SoundEngine.play('click');
        }
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
          selectedLevel = Math.max(selectedLevel - 1, 0);
          SoundEngine.play('click');
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          selectedLevel = Math.min(selectedLevel + 5, 9);
          SoundEngine.play('click');
        }
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          selectedLevel = Math.max(selectedLevel - 5, 0);
          SoundEngine.play('click');
        }
        if (e.code === 'Enter' || e.code === 'Space') {
          if (selectedLevel < progress.unlocked) {
            attempts = 0;
            SoundEngine.play('menuSelect');
            startLevel(selectedLevel);
          } else {
            SoundEngine.play('menuBack');
          }
          e.preventDefault();
        }
        if (e.code === 'Escape') {
          SoundEngine.play('menuBack');
          state = 'menu';
        }
        return;
      }

      if (state === 'dead') {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyR') {
          startLevel(currentLevel);
          // Clear input so the intro isn't instantly skipped
          actionJustPressed = false;
          phaseJustPressed = false;
          SoundEngine.play('menuSelect');
          e.preventDefault();
          return;
        }
        if (e.code === 'Escape') {
          state = 'levelSelect';
          SoundEngine.play('menuBack');
          e.preventDefault();
          return;
        }
      }
      if (state === 'levelComplete' && (e.code === 'Enter' || e.code === 'Space')) {
        SoundEngine.play('menuSelect');
        state = 'levelSelect';
        e.preventDefault();
        return;
      }
      if (state === 'playing' && (e.code === 'KeyP' || e.code === 'Escape')) {
        state = 'paused';
        SoundEngine.play('click');
        e.preventDefault();
        return;
      }
      if (state === 'paused') {
        if (e.code === 'KeyP' || e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space') {
          state = 'playing';
          SoundEngine.play('click');
          e.preventDefault();
        }
        if (e.code === 'KeyR') {
          startLevel(currentLevel);
          actionJustPressed = false;
          phaseJustPressed = false;
          SoundEngine.play('menuSelect');
          e.preventDefault();
        }
        return;
      }
      if (state === 'playing' && e.code === 'KeyR') {
        startLevel(currentLevel);
        actionJustPressed = false;
        phaseJustPressed = false;
        SoundEngine.play('menuSelect');
        e.preventDefault();
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        actionPressed = false;
      }
    }

    function onTouchStart(e: TouchEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const tx = e.changedTouches[i].clientX - rect.left;
        const halfW = rect.width / 2;
        if (tx < halfW) {
          actionJustPressed = true;
          actionPressed = true;
        } else {
          phaseJustPressed = true;
        }
      }
      // Handle state transitions
      if (state === 'menu') {
        SoundEngine.play('menuSelect');
        state = 'levelSelect';
        return;
      }
      if (state === 'levelSelect') {
        // Handle level selection via touch
        const firstTouch = e.changedTouches[0];
        const tx2 = (firstTouch.clientX - rect.left) * (W / rect.width);
        const ty2 = (firstTouch.clientY - rect.top) * (H / rect.height);
        const startX = 100;
        const startY = 200;
        const cellW = 120;
        const cellH = 100;
        for (let i = 0; i < 10; i++) {
          const col = i % 5;
          const row = Math.floor(i / 5);
          const cx = startX + col * cellW;
          const cy = startY + row * cellH;
          if (tx2 >= cx && tx2 < cx + cellW - 10 && ty2 >= cy && ty2 < cy + cellH - 10) {
            selectedLevel = i;
            if (i < progress.unlocked) {
              attempts = 0;
              SoundEngine.play('menuSelect');
              startLevel(i);
              actionJustPressed = false;
              phaseJustPressed = false;
            } else {
              SoundEngine.play('menuBack');
            }
            return;
          }
        }
        return;
      }
      if (state === 'dead') {
        startLevel(currentLevel);
        actionJustPressed = false;
        phaseJustPressed = false;
        SoundEngine.play('menuSelect');
        return;
      }
      if (state === 'levelComplete') {
        SoundEngine.play('menuSelect');
        state = 'levelSelect';
        return;
      }
      if (state === 'paused') {
        state = 'playing';
        SoundEngine.play('click');
        return;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const tx = e.changedTouches[i].clientX - rect.left;
        const halfW = rect.width / 2;
        if (tx < halfW) {
          actionPressed = false;
        }
      }
    }

    function onLevelSelectClick(e: MouseEvent) {
      if (state !== 'levelSelect') return;
      const rect = canvas!.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const my = (e.clientY - rect.top) * (H / rect.height);

      // Level grid: 5 cols x 2 rows, starting at (100, 200), each cell 120x100
      const startX = 100;
      const startY = 200;
      const cellW = 120;
      const cellH = 100;
      for (let i = 0; i < 10; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const cx = startX + col * cellW;
        const cy = startY + row * cellH;
        if (mx >= cx && mx < cx + cellW - 10 && my >= cy && my < cy + cellH - 10) {
          selectedLevel = i;
          if (i < progress.unlocked) {
            attempts = 0;
            SoundEngine.play('menuSelect');
            startLevel(i);
          } else {
            SoundEngine.play('menuBack');
          }
          return;
        }
      }
    }

    canvas.addEventListener('mousedown', onLevelSelectClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });

    // ─── Collision ───
    function collides(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function isElementActive(el: LevelElement): boolean {
      return el.phase === 'both' || el.phase === phase;
    }

    // ─── Spawn Particles ───
    function spawnParticles(x: number, y: number, count: number, color: string, spread: number = 100) {
      for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
        const lifespan = 0.3 + Math.random() * 0.5;
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * spread,
          vy: (Math.random() - 0.5) * spread,
          life: lifespan,
          maxLife: lifespan,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    // ─── Trail particles ───
    function spawnTrail() {
      const color = phase === 'A' ? PHASE_A_COLOR : PHASE_B_COLOR;
      if (particles.length < MAX_PARTICLES) {
        const lifespan = 0.2 + Math.random() * 0.2;
        particles.push({
          x: px + PLAYER_SIZE / 2 + (Math.random() - 0.5) * 6,
          y: py + PLAYER_SIZE / 2 + (Math.random() - 0.5) * 6,
          vx: -30 - Math.random() * 20,
          vy: (Math.random() - 0.5) * 15,
          life: lifespan,
          maxLife: lifespan,
          color,
          size: 2 + Math.random() * 2,
        });
      }
    }

    // ─── Die ───
    function die() {
      state = 'dead';
      deathGhostTimer = 0.5;
      deathX = px;
      deathY = py;
      deathMode = mode;
      SoundEngine.play('playerDamage');
      spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, 25, phase === 'A' ? CYAN : MAGENTA, 200);
      reportGameEnd('phase-shift', totalScore, false, currentLevel + 1);
    }

    // ─── Level Complete ───
    function completeLevel() {
      state = 'levelComplete';

      // Calculate score
      const starsCollected = levelCollectibles.filter(c => c.collected).length;
      let levelScore = 1000 + starsCollected * 200;
      if (attempts <= 1) levelScore += 500;
      else if (attempts <= 2) levelScore += 300;
      else if (attempts <= 3) levelScore += 100;
      totalScore += levelScore;

      // Save star data
      const collectedIndices: number[] = [];
      levelCollectibles.forEach((c, i) => { if (c.collected) collectedIndices.push(i); });
      if (!progress.stars[currentLevel]) progress.stars[currentLevel] = [];
      collectedIndices.forEach(i => {
        if (!progress.stars[currentLevel].includes(i)) progress.stars[currentLevel].push(i);
      });

      // Unlock next level
      if (currentLevel + 1 < 10 && progress.unlocked <= currentLevel + 1) {
        progress.unlocked = currentLevel + 2;
      }
      if (!progress.bestAttempts[currentLevel] || attempts < progress.bestAttempts[currentLevel]) {
        progress.bestAttempts[currentLevel] = attempts;
      }

      saveProgress(progress);

      if (totalScore > highScore) {
        setHighScore('phase-shift', totalScore);
        highScore = totalScore;
        SoundEngine.play('newHighScore');
      } else if (currentLevel === 9) {
        SoundEngine.play('victoryFanfare');
      } else {
        SoundEngine.play('levelComplete');
      }

      reportLevelComplete('phase-shift', currentLevel + 1, totalScore);
      reportGameEnd('phase-shift', totalScore, currentLevel === 9, currentLevel + 1);
    }

    // ─── Update Particles (always, even when dead) ───
    function updateParticles(dt: number) {
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }
    }

    // ─── Update ───
    function update(dt: number) {
      // Always update particles so death explosions animate
      updateParticles(dt);

      // Death ghost fade
      if (deathGhostTimer > 0) deathGhostTimer -= dt;

      if (state !== 'playing') return;
      if (!levelConfig) return;

      const cfg = levelConfig;

      // ─ Phase shift ─
      if (phaseJustPressed) {
        if (cfg.allowPhaseShift) {
          phase = phase === 'A' ? 'B' : 'A';
          phaseFlashTimer = 0.15;
          SoundEngine.play('portalEnter');
          spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, 10, phase === 'A' ? CYAN : MAGENTA, 80);
        } else {
          phaseLockFlash = 0.5;
          SoundEngine.play('menuBack');
        }
      }

      // ─ Scroll ─
      cameraX += cfg.scrollSpeed * dt;

      // ─ Check portals ─
      const worldPx = px + cameraX;
      for (const p of levelPortals) {
        if (Math.abs(worldPx - p.x) < 30 && Math.abs(py - p.y) < 60) {
          if (mode !== p.toMode) {
            const modeColors: Record<ModeType, string> = {
              dash: '#ffaa00', glide: '#00ff88', flip: '#ff4488', wave: '#44aaff',
            };
            mode = p.toMode;
            modeTransitionTimer = 0.4;
            modeTransitionColor = modeColors[p.toMode];
            SoundEngine.play('waveStart');
            spawnParticles(px + PLAYER_SIZE / 2, py + PLAYER_SIZE / 2, 20, modeTransitionColor, 150);
            // Reset gravity dir when switching to non-flip
            if (mode !== 'flip') gravityDir = 1;
          }
        }
      }

      // ─ Mode-specific physics ─
      const pSize = PLAYER_SIZE;
      const halfP = pSize / 2;

      if (mode === 'dash') {
        // Gravity
        vy += DASH_GRAVITY * dt;
        if (vy > 900) vy = 900;

        // Jump
        if (onGround) coyoteTimer = COYOTE_MS;
        else coyoteTimer = Math.max(0, coyoteTimer - dt * 1000);

        if (actionJustPressed && coyoteTimer > 0) {
          vy = DASH_JUMP;
          onGround = false;
          coyoteTimer = 0;
          SoundEngine.play('launch');
        }
      } else if (mode === 'glide') {
        if (actionPressed) {
          vy += GLIDE_FLY * dt * 4;
          if (vy < -300) vy = -300;
        } else {
          vy += GLIDE_GRAVITY_DEFAULT * dt;
          if (vy > 400) vy = 400;
        }
      } else if (mode === 'flip') {
        vy += FLIP_GRAVITY * gravityDir * dt;
        if (Math.abs(vy) > 900) vy = 900 * Math.sign(vy);

        if (actionJustPressed) {
          gravityDir *= -1;
          vy = 0;
          SoundEngine.play('gravityFlip');
          spawnParticles(px + halfP, py + halfP, 8, phase === 'A' ? CYAN : MAGENTA, 60);
        }
      } else if (mode === 'wave') {
        if (actionPressed) {
          vy = -WAVE_SPEED;
        } else {
          vy = WAVE_SPEED;
        }
      }

      py += vy * dt;

      // ─ Collision with elements ─
      onGround = false;
      for (const el of levelElements) {
        if (!isElementActive(el)) continue;

        const elScreenX = el.x - cameraX;
        if (elScreenX > W + 100 || elScreenX + el.w < -100) continue;

        if (!collides(px, py, pSize, pSize, elScreenX, el.y, el.w, el.h)) continue;

        if (el.type === 'spike' || el.type === 'obstacle') {
          die();
          return;
        }

        // Ground / platform collision resolution
        if (el.type === 'ground' || el.type === 'platform') {
          const prevPy = py - vy * dt;

          if (mode === 'flip' && gravityDir === -1) {
            // Inverted gravity — land on underside (ceiling-walk)
            const elBottom = el.y + el.h;
            if (vy < 0 && py < elBottom && prevPy >= elBottom - 4) {
              py = elBottom;
              vy = 0;
              onGround = true;
            }
          } else {
            // Normal gravity — land on top
            if (vy > 0 && py + pSize > el.y && prevPy + pSize <= el.y + 4) {
              py = el.y - pSize;
              vy = 0;
              onGround = true;
            }
            // Head bonk — hitting underside while jumping (dash/glide only)
            if (vy < 0 && py < el.y + el.h && prevPy >= el.y + el.h - 2) {
              py = el.y + el.h;
              vy = 0;
            }
          }
        }
      }

      // ─ Floor boundary (death) ─
      if (py > H + 50) {
        die();
        return;
      }
      // Ceiling boundary
      if (py < -50) {
        die();
        return;
      }

      // ─ Collectibles (wider hitbox at high speeds to prevent misses) ─
      const collectW = 24 + cfg.scrollSpeed * dt;
      for (const c of levelCollectibles) {
        if (c.collected) continue;
        if (c.phase !== 'both' && c.phase !== phase) continue;
        const cx = c.x - cameraX;
        if (collides(px, py, pSize, pSize, cx - collectW / 2, c.y - 12, collectW, 24)) {
          c.collected = true;
          SoundEngine.play('collectStar');
          spawnParticles(cx, c.y, 10, GOLD, 80);
        }
      }

      // ─ Level complete check ─
      if (cameraX >= cfg.length) {
        completeLevel();
        return;
      }

      // Trail
      if (Math.random() < 0.6) spawnTrail();

      // ─ Player rotation (wave mode tilts, others return to 0) ─
      if (mode === 'wave') {
        playerRotation = actionPressed ? -0.7 : 0.7;
      } else if (mode === 'dash' || mode === 'glide') {
        // Slight tilt based on vy
        playerRotation = clamp(vy * 0.0003, -0.2, 0.2);
      } else {
        playerRotation = 0;
      }

      // ─ Timers ─
      if (phaseFlashTimer > 0) phaseFlashTimer -= dt;
      if (phaseLockFlash > 0) phaseLockFlash -= dt;
      if (modeTransitionTimer > 0) modeTransitionTimer -= dt;
      if (shakeTimer > 0) shakeTimer -= dt;
    }

    // ─── Draw ───
    function draw() {
      ctx.save();

      // Screen shake (decays over time)
      if (shakeTimer > 0) {
        const decay = shakeTimer / 0.3;
        const sx = (Math.random() - 0.5) * shakeIntensity * 2 * decay;
        const sy = (Math.random() - 0.5) * shakeIntensity * 2 * decay;
        ctx.translate(sx, sy);
      }

      // ─ Background ─
      ctx.fillStyle = BG;
      ctx.fillRect(-10, -10, W + 20, H + 20);

      // Subtle phase tint on background (during gameplay states)
      if (state === 'playing' || state === 'paused' || state === 'dead' || state === 'levelComplete' || state === 'levelIntro') {
        const tint = phase === 'A' ? 'rgba(0,255,255,0.015)' : 'rgba(255,0,255,0.015)';
        ctx.fillStyle = tint;
        ctx.fillRect(-10, -10, W + 20, H + 20);
      }

      // ─ Stars ─
      for (const s of bgStars) {
        ctx.globalAlpha = s.alpha * 0.6;
        ctx.fillStyle = WHITE;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      }
      ctx.globalAlpha = 1;

      if (state === 'menu') {
        drawMenu();
        ctx.restore();
        return;
      }
      if (state === 'levelSelect') {
        drawLevelSelect();
        ctx.restore();
        return;
      }

      if (!levelConfig) { ctx.restore(); return; }

      // ─ Grid floor (neon perspective) ─
      drawGrid();

      // ─ Speed lines ─
      drawSpeedLines();

      // ─ Level elements ─
      for (const el of levelElements) {
        const sx = el.x - cameraX;
        if (sx > W + 60 || sx + el.w < -60) continue;
        const active = isElementActive(el);
        drawElement(el, sx, active);
      }

      // ─ Portals ─
      for (const p of levelPortals) {
        const sx = p.x - cameraX;
        if (sx > W + 40 || sx < -40) continue;
        drawPortal(p, sx);
      }

      // ─ Collectibles ─
      for (const c of levelCollectibles) {
        if (c.collected) continue;
        const sx = c.x - cameraX;
        if (sx > W + 20 || sx < -20) continue;
        const active = c.phase === 'both' || c.phase === phase;
        drawCollectible(c, sx, active);
      }

      // ─ Edge warnings for approaching obstacles ─
      if (state === 'playing' && levelConfig && levelConfig.scrollSpeed >= 240) {
        for (const el of levelElements) {
          if (el.type !== 'obstacle' && el.type !== 'spike') continue;
          if (!isElementActive(el)) continue;
          const sx = el.x - cameraX;
          // Show warning for obstacles just off-screen right
          if (sx > W - 20 && sx < W + 80) {
            const warningAlpha = 1 - (sx - (W - 20)) / 100;
            ctx.globalAlpha = clamp(warningAlpha, 0, 0.6) * (0.5 + Math.sin(Date.now() * 0.01) * 0.5);
            ctx.fillStyle = phaseColor(el.phase);
            // Small triangle arrow pointing left
            const wy = clamp(el.y + el.h / 2, 30, H - 30);
            ctx.beginPath();
            ctx.moveTo(W - 5, wy - 6);
            ctx.lineTo(W - 12, wy);
            ctx.lineTo(W - 5, wy + 6);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // ─ Player ─
      if (state === 'playing' || state === 'paused' || state === 'levelIntro') {
        drawPlayer();
      }

      // ─ Death ghost (fading player outline expanding outward) ─
      if (state === 'dead' && deathGhostTimer > 0) {
        ctx.save();
        const ghostAlpha = (deathGhostTimer / 0.5) * 0.5;
        const color = phase === 'A' ? CYAN : MAGENTA;
        ctx.globalAlpha = ghostAlpha;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20 * (deathGhostTimer / 0.5);
        const ghCx = deathX + PLAYER_SIZE / 2;
        const ghCy = deathY + PLAYER_SIZE / 2;
        const ghHalf = PLAYER_SIZE / 2 + (1 - deathGhostTimer / 0.5) * 8;
        if (deathMode === 'dash') {
          ctx.strokeRect(ghCx - ghHalf, ghCy - ghHalf, ghHalf * 2, ghHalf * 2);
        } else if (deathMode === 'glide') {
          ctx.beginPath();
          ctx.moveTo(ghCx + ghHalf, ghCy);
          ctx.lineTo(ghCx - ghHalf, ghCy - ghHalf);
          ctx.lineTo(ghCx - ghHalf, ghCy + ghHalf);
          ctx.closePath();
          ctx.stroke();
        } else if (deathMode === 'flip') {
          ctx.beginPath();
          ctx.arc(ghCx, ghCy, ghHalf, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(ghCx, ghCy - ghHalf);
          ctx.lineTo(ghCx + ghHalf, ghCy);
          ctx.lineTo(ghCx, ghCy + ghHalf);
          ctx.lineTo(ghCx - ghHalf, ghCy);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.restore();
      }

      // ─ Particles ─
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      // ─ Phase flash ─
      if (phaseFlashTimer > 0) {
        const alpha = (phaseFlashTimer / 0.15) * 0.2;
        ctx.fillStyle = phase === 'A' ? CYAN : MAGENTA;
        ctx.globalAlpha = alpha;
        ctx.fillRect(-10, -10, W + 20, H + 20);
        ctx.globalAlpha = 1;
      }

      // ─ Mode transition flash ─
      if (modeTransitionTimer > 0) {
        const alpha = (modeTransitionTimer / 0.4) * 0.12;
        ctx.fillStyle = modeTransitionColor;
        ctx.globalAlpha = alpha;
        ctx.fillRect(-10, -10, W + 20, H + 20);
        ctx.globalAlpha = 1;
      }

      // ─ HUD ─
      drawHUD();

      // ─ Overlays ─
      if (state === 'levelIntro') drawLevelIntroOverlay();
      if (state === 'dead') drawDeathOverlay();
      if (state === 'levelComplete') drawLevelCompleteOverlay();
      if (state === 'paused') drawPauseOverlay();

      ctx.restore();
    }

    // ─── Draw Helpers ───
    function drawMenu() {
      // Title
      ctx.save();
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 30;
      ctx.fillStyle = CYAN;
      ctx.font = 'bold 56px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PHASE SHIFT', W / 2, 180);
      ctx.shadowBlur = 0;

      // Subtitle
      ctx.fillStyle = MAGENTA;
      ctx.font = '20px monospace';
      ctx.shadowColor = MAGENTA;
      ctx.shadowBlur = 15;
      ctx.fillText('TWO DIMENSIONS. ONE CHANCE.', W / 2, 220);
      ctx.shadowBlur = 0;

      // Animated phase shapes
      const t = menuTime;
      // Phase A shape
      ctx.save();
      ctx.translate(W / 2 - 80, 320);
      ctx.rotate(t * 0.5);
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 15;
      ctx.strokeStyle = CYAN;
      ctx.lineWidth = 2;
      ctx.strokeRect(-20, -20, 40, 40);
      ctx.restore();

      // Phase B shape
      ctx.save();
      ctx.translate(W / 2 + 80, 320);
      ctx.rotate(-t * 0.5);
      ctx.shadowColor = MAGENTA;
      ctx.shadowBlur = 15;
      ctx.strokeStyle = MAGENTA;
      ctx.lineWidth = 2;
      ctx.strokeRect(-20, -20, 40, 40);
      ctx.restore();

      // Divider line between
      ctx.strokeStyle = BOTH_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 290);
      ctx.lineTo(W / 2, 350);
      ctx.stroke();
      ctx.setLineDash([]);

      // Press Enter
      const flash = Math.sin(t * 3) > 0;
      ctx.fillStyle = flash ? WHITE : DIM;
      ctx.font = '18px monospace';
      ctx.fillText('PRESS ENTER OR TAP TO START', W / 2, 430);

      // High score
      if (highScore > 0) {
        ctx.fillStyle = GOLD;
        ctx.font = '14px monospace';
        ctx.fillText(`HIGH SCORE: ${highScore}`, W / 2, 470);
      }

      // Controls info
      ctx.fillStyle = DIM;
      ctx.font = '12px monospace';
      ctx.fillText('SPACE/W = Action  |  SHIFT/X = Phase Shift  |  P = Pause', W / 2, 530);
      ctx.fillText('Touch: Left = Action  |  Right = Phase Shift', W / 2, 550);

      ctx.restore();
    }

    function drawLevelSelect() {
      ctx.save();
      ctx.textAlign = 'center';

      // Title
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 20;
      ctx.fillStyle = CYAN;
      ctx.font = 'bold 36px monospace';
      ctx.fillText('SELECT LEVEL', W / 2, 100);
      ctx.shadowBlur = 0;

      // Total score
      ctx.fillStyle = GOLD;
      ctx.font = '14px monospace';
      ctx.fillText(`TOTAL SCORE: ${totalScore}  |  HIGH SCORE: ${highScore}`, W / 2, 140);

      // Grid 5x2
      const startX = 100;
      const startY = 200;
      const cellW = 120;
      const cellH = 100;

      for (let i = 0; i < 10; i++) {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const cx = startX + col * cellW;
        const cy = startY + row * cellH;
        const unlocked = i < progress.unlocked;
        const selected = i === selectedLevel;

        // Cell bg
        ctx.fillStyle = selected ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
        ctx.strokeStyle = unlocked ? (selected ? CYAN : DIM) : '#222';
        ctx.lineWidth = selected ? 2 : 1;
        ctx.fillRect(cx, cy, cellW - 10, cellH - 10);
        ctx.strokeRect(cx, cy, cellW - 10, cellH - 10);

        // Level number
        ctx.fillStyle = unlocked ? WHITE : '#444';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`${i + 1}`, cx + (cellW - 10) / 2, cy + 30);

        // Level name
        ctx.font = '10px monospace';
        ctx.fillStyle = unlocked ? DIM : '#333';
        ctx.fillText(levels[i].name, cx + (cellW - 10) / 2, cy + 50);

        // Stars + best attempts
        if (unlocked) {
          const starCount = progress.stars[i] ? progress.stars[i].length : 0;
          for (let s = 0; s < 3; s++) {
            ctx.fillStyle = s < starCount ? GOLD : '#333';
            ctx.font = '14px monospace';
            ctx.fillText(s < starCount ? '\u2605' : '\u2606', cx + 25 + s * 20, cy + 72);
          }
          // Best attempt count
          const best = progress.bestAttempts[i];
          if (best > 0) {
            ctx.fillStyle = '#556';
            ctx.font = '9px monospace';
            ctx.fillText(best === 1 ? '1st try!' : `${best} tries`, cx + (cellW - 10) / 2, cy + 86);
          }
        } else {
          ctx.fillStyle = '#444';
          ctx.font = '20px monospace';
          ctx.fillText('\uD83D\uDD12', cx + (cellW - 10) / 2, cy + 72);
        }
      }

      // Instructions
      ctx.fillStyle = DIM;
      ctx.font = '12px monospace';
      ctx.fillText('ARROW KEYS TO SELECT  |  ENTER TO PLAY  |  ESC FOR MENU', W / 2, 460);
      ctx.fillText('TAP A LEVEL TO PLAY', W / 2, 480);

      // Modes legend
      ctx.font = '11px monospace';
      ctx.fillStyle = '#556677';
      ctx.fillText('MODES:  DASH(Square)  GLIDE(Triangle)  FLIP(Circle)  WAVE(Diamond)', W / 2, 530);

      ctx.restore();
    }

    function drawGrid() {
      if (!levelConfig) return;
      const gY = levelConfig.groundY;
      // Check if any ground exists at the current camera position
      const hasGround = levelElements.some(el =>
        el.type === 'ground' && el.phase !== (phase === 'A' ? 'B' : 'A') &&
        el.x - cameraX < W && el.x + el.w - cameraX > 0
      );
      if (!hasGround) return;

      ctx.save();
      ctx.strokeStyle = phase === 'A' ? 'rgba(0,255,255,0.1)' : 'rgba(255,0,255,0.1)';
      ctx.lineWidth = 1;

      // Horizontal lines
      for (let i = 0; i < 8; i++) {
        const y = gY + i * 20;
        const alpha = 0.15 - i * 0.015;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Vertical lines (scrolling)
      const spacing = 60;
      const offset = (cameraX * 0.5) % spacing;
      ctx.globalAlpha = 0.08;
      for (let x = -offset; x < W + spacing; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, gY);
        ctx.lineTo(x + (x - W / 2) * 0.3, H);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawSpeedLines() {
      if (!levelConfig) return;
      ctx.save();
      const speed = levelConfig.scrollSpeed;
      const intensity = speed / 300;
      ctx.globalAlpha = intensity * 0.15;
      ctx.strokeStyle = phase === 'A' ? CYAN : MAGENTA;
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const y = 50 + Math.sin(cameraX * 0.01 + i * 1.7) * (H * 0.4);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(30 + speed * 0.1, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(W, y + 30);
        ctx.lineTo(W - 30 - speed * 0.1, y + 30);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawElement(el: LevelElement, sx: number, active: boolean) {
      ctx.save();
      const col = phaseColor(el.phase);

      if (active) {
        ctx.fillStyle = col;
        ctx.globalAlpha = el.type === 'ground' ? 0.4 : 0.7;
        ctx.shadowColor = col;
        ctx.shadowBlur = el.type === 'ground' ? 0 : 8;
        ctx.fillRect(sx, el.y, el.w, el.h);

        // Border
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.9;
        ctx.strokeRect(sx, el.y, el.w, el.h);

        if (el.type === 'spike') {
          // Draw X pattern on spikes
          ctx.beginPath();
          ctx.moveTo(sx, el.y);
          ctx.lineTo(sx + el.w, el.y + el.h);
          ctx.moveTo(sx + el.w, el.y);
          ctx.lineTo(sx, el.y + el.h);
          ctx.stroke();
        }
      } else {
        // Ghost
        ctx.globalAlpha = GHOST_ALPHA;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(sx, el.y, el.w, el.h);
        ctx.setLineDash([]);
      }

      ctx.restore();
    }

    function drawPortal(p: Portal, sx: number) {
      ctx.save();
      const t = Date.now() * 0.003;
      const pulse = 0.8 + Math.sin(t) * 0.2;
      const modeColors: Record<ModeType, string> = {
        dash: '#ffaa00',
        glide: '#00ff88',
        flip: '#ff4488',
        wave: '#44aaff',
      };
      const col = modeColors[p.toMode];
      const r = 20 * pulse;

      ctx.shadowColor = col;
      ctx.shadowBlur = 20;
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(sx, p.y, r, 0, Math.PI * 2);
      ctx.stroke();

      // Inner circle
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(sx, p.y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();

      // Mode label
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = col;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(p.toMode.toUpperCase(), sx, p.y - r - 8);

      ctx.restore();
    }

    function drawCollectible(c: Collectible, sx: number, active: boolean) {
      ctx.save();
      const t = Date.now() * 0.004;
      const bob = Math.sin(t + c.x * 0.01) * 5;
      const y = c.y + bob;

      ctx.globalAlpha = active ? 1 : GHOST_ALPHA;
      ctx.shadowColor = GOLD;
      ctx.shadowBlur = active ? 12 : 0;

      // Star shape
      ctx.fillStyle = GOLD;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5);
        const outerR = 10;
        const innerR = 4;
        ctx.lineTo(sx + Math.cos(angle) * outerR, y + Math.sin(angle) * outerR);
        const midAngle = angle + Math.PI / 5;
        ctx.lineTo(sx + Math.cos(midAngle) * innerR, y + Math.sin(midAngle) * innerR);
      }
      ctx.closePath();
      ctx.fill();

      // Phase indicator ring
      if (c.phase !== 'both') {
        ctx.strokeStyle = phaseColor(c.phase);
        ctx.lineWidth = 1;
        ctx.globalAlpha = active ? 0.5 : 0.1;
        ctx.beginPath();
        ctx.arc(sx, y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawPlayer() {
      ctx.save();
      const color = phase === 'A' ? CYAN : MAGENTA;

      const cx = px + PLAYER_SIZE / 2;
      const cy = py + PLAYER_SIZE / 2;
      const half = PLAYER_SIZE / 2;

      // Apply rotation
      ctx.translate(cx, cy);
      ctx.rotate(playerRotation);
      ctx.translate(-cx, -cy);

      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      if (mode === 'dash') {
        // Square
        ctx.globalAlpha = 0.8;
        ctx.fillRect(px, py, PLAYER_SIZE, PLAYER_SIZE);
        ctx.globalAlpha = 1;
        ctx.strokeRect(px, py, PLAYER_SIZE, PLAYER_SIZE);
      } else if (mode === 'glide') {
        // Triangle pointing right
        ctx.beginPath();
        ctx.moveTo(cx + half, cy);
        ctx.lineTo(cx - half, cy - half);
        ctx.lineTo(cx - half, cy + half);
        ctx.closePath();
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      } else if (mode === 'flip') {
        // Circle
        ctx.beginPath();
        ctx.arc(cx, cy, half, 0, Math.PI * 2);
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
        // Gravity direction arrow
        ctx.beginPath();
        ctx.moveTo(cx, cy - 5 * gravityDir);
        ctx.lineTo(cx - 5, cy + 5 * gravityDir);
        ctx.lineTo(cx + 5, cy + 5 * gravityDir);
        ctx.closePath();
        ctx.fillStyle = BG;
        ctx.globalAlpha = 0.6;
        ctx.fill();
      } else if (mode === 'wave') {
        // Diamond
        ctx.beginPath();
        ctx.moveTo(cx, cy - half);
        ctx.lineTo(cx + half, cy);
        ctx.lineTo(cx, cy + half);
        ctx.lineTo(cx - half, cy);
        ctx.closePath();
        ctx.globalAlpha = 0.8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.stroke();
      }

      // Mode transition glow ring
      if (modeTransitionTimer > 0) {
        const t = modeTransitionTimer / 0.4;
        ctx.strokeStyle = modeTransitionColor;
        ctx.lineWidth = 2;
        ctx.globalAlpha = t * 0.8;
        ctx.shadowColor = modeTransitionColor;
        ctx.shadowBlur = 20 * t;
        ctx.beginPath();
        ctx.arc(cx, cy, half + 8 + (1 - t) * 15, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    function drawHUD() {
      if (!levelConfig) return;
      ctx.save();

      // Progress bar
      const prog = clamp(cameraX / levelConfig.length, 0, 1);
      const barW = 300;
      const barH = 6;
      const barX = W / 2 - barW / 2;
      const barY = 16;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(barX, barY, barW, barH);
      ctx.fillStyle = phase === 'A' ? CYAN : MAGENTA;
      ctx.shadowColor = phase === 'A' ? CYAN : MAGENTA;
      ctx.shadowBlur = 6;
      ctx.fillRect(barX, barY, barW * prog, barH);
      ctx.shadowBlur = 0;

      // Level name
      ctx.fillStyle = WHITE;
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${currentLevel + 1}. ${levelConfig.name}`, 15, 24);

      // Mode indicator with shape icon
      ctx.textAlign = 'right';
      ctx.fillStyle = '#aabb99';
      ctx.font = '11px monospace';
      const modeLabel = `MODE: ${mode.toUpperCase()}`;
      ctx.fillText(modeLabel, W - 30, 24);
      // Draw tiny mode shape icon
      const iconX = W - 18;
      const iconY = 19;
      const iconR = 5;
      ctx.strokeStyle = '#aabb99';
      ctx.fillStyle = '#aabb99';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.8;
      if (mode === 'dash') {
        ctx.strokeRect(iconX - iconR, iconY - iconR, iconR * 2, iconR * 2);
      } else if (mode === 'glide') {
        ctx.beginPath();
        ctx.moveTo(iconX + iconR, iconY);
        ctx.lineTo(iconX - iconR, iconY - iconR);
        ctx.lineTo(iconX - iconR, iconY + iconR);
        ctx.closePath();
        ctx.stroke();
      } else if (mode === 'flip') {
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconR, 0, Math.PI * 2);
        ctx.stroke();
      } else if (mode === 'wave') {
        ctx.beginPath();
        ctx.moveTo(iconX, iconY - iconR);
        ctx.lineTo(iconX + iconR, iconY);
        ctx.lineTo(iconX, iconY + iconR);
        ctx.lineTo(iconX - iconR, iconY);
        ctx.closePath();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Phase indicator
      if (levelConfig.allowPhaseShift) {
        ctx.textAlign = 'right';
        ctx.fillStyle = phase === 'A' ? CYAN : MAGENTA;
        ctx.font = 'bold 12px monospace';
        ctx.shadowColor = phase === 'A' ? CYAN : MAGENTA;
        ctx.shadowBlur = 8;
        ctx.fillText(`PHASE ${phase}`, W - 15, 42);
        ctx.shadowBlur = 0;
      }

      // Phase locked flash
      if (phaseLockFlash > 0 && !levelConfig.allowPhaseShift) {
        ctx.fillStyle = '#ff4444';
        ctx.globalAlpha = clamp(phaseLockFlash / 0.5, 0, 1) * 0.9;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText('PHASE LOCKED', W - 15, 42);
        ctx.globalAlpha = 1;
      }

      // Stars collected
      const collected = levelCollectibles.filter(c => c.collected).length;
      ctx.textAlign = 'left';
      ctx.fillStyle = GOLD;
      ctx.font = '12px monospace';
      for (let s = 0; s < 3; s++) {
        ctx.fillText(s < collected ? '\u2605' : '\u2606', 15 + s * 18, 48);
      }

      // Score
      ctx.textAlign = 'right';
      ctx.fillStyle = '#888';
      ctx.font = '11px monospace';
      ctx.fillText(`SCORE: ${totalScore}`, W - 15, 58);

      ctx.restore();
    }

    function drawDeathOverlay() {
      if (!levelConfig) return;
      ctx.save();
      ctx.fillStyle = 'rgba(10,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 40px monospace';
      ctx.shadowColor = '#ff4444';
      ctx.shadowBlur = 20;
      ctx.fillText('CRASHED', W / 2, H / 2 - 50);
      ctx.shadowBlur = 0;

      // Progress and attempt info
      const pct = Math.floor(clamp(cameraX / levelConfig.length, 0, 1) * 100);
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      ctx.fillText(`${pct}% COMPLETE  |  ATTEMPT #${attempts}`, W / 2, H / 2 - 15);

      ctx.fillStyle = DIM;
      ctx.font = '16px monospace';
      ctx.fillText('PRESS ENTER OR TAP TO RETRY', W / 2, H / 2 + 20);

      ctx.fillStyle = '#556';
      ctx.font = '12px monospace';
      ctx.fillText('R = RESTART  |  ESC = LEVEL SELECT', W / 2, H / 2 + 50);

      ctx.restore();
    }

    function drawLevelCompleteOverlay() {
      ctx.save();
      const isVictory = currentLevel === 9;
      ctx.fillStyle = isVictory ? 'rgba(0,5,15,0.85)' : 'rgba(0,10,20,0.7)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';

      if (isVictory) {
        // Special victory screen
        ctx.fillStyle = GOLD;
        ctx.font = 'bold 42px monospace';
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 25;
        ctx.fillText('PHASE MASTER', W / 2, H / 2 - 80);
        ctx.shadowBlur = 0;

        ctx.fillStyle = CYAN;
        ctx.font = '16px monospace';
        ctx.shadowColor = CYAN;
        ctx.shadowBlur = 10;
        ctx.fillText('ALL 10 LEVELS COMPLETE', W / 2, H / 2 - 45);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = CYAN;
        ctx.font = 'bold 36px monospace';
        ctx.shadowColor = CYAN;
        ctx.shadowBlur = 20;
        ctx.fillText('LEVEL COMPLETE', W / 2, H / 2 - 80);
        ctx.shadowBlur = 0;
      }

      // Stars
      const collected = levelCollectibles.filter(c => c.collected).length;
      ctx.font = '30px monospace';
      ctx.fillStyle = GOLD;
      for (let s = 0; s < 3; s++) {
        ctx.fillText(s < collected ? '\u2605' : '\u2606', W / 2 - 40 + s * 40, H / 2 - 10);
      }

      // Score breakdown
      ctx.fillStyle = WHITE;
      ctx.font = '14px monospace';
      ctx.fillText(`COMPLETION: +1000`, W / 2, H / 2 + 25);
      ctx.fillText(`STARS: +${collected * 200}`, W / 2, H / 2 + 45);
      const bonus = attempts <= 1 ? 500 : attempts <= 2 ? 300 : attempts <= 3 ? 100 : 0;
      ctx.fillText(`ATTEMPT BONUS: +${bonus}`, W / 2, H / 2 + 65);

      ctx.fillStyle = GOLD;
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`TOTAL: ${totalScore}`, W / 2, H / 2 + 100);

      if (isVictory) {
        // Total stars across all levels
        const totalStars = progress.stars.reduce((sum, s) => sum + s.length, 0);
        ctx.fillStyle = '#aaa';
        ctx.font = '13px monospace';
        ctx.fillText(`STARS: ${totalStars}/30  |  FINAL SCORE: ${totalScore}`, W / 2, H / 2 + 125);
      }

      ctx.fillStyle = DIM;
      ctx.font = '14px monospace';
      ctx.fillText('PRESS ENTER OR TAP TO CONTINUE', W / 2, H / 2 + 155);

      ctx.restore();
    }

    function drawLevelIntroOverlay() {
      if (!levelConfig) return;
      ctx.save();

      // Semi-transparent overlay
      const fadeIn = clamp(1 - (levelIntroTimer - 1.2) / 0.3, 0, 1);
      const fadeOut = clamp(levelIntroTimer / 0.3, 0, 1);
      const overlayAlpha = Math.min(fadeIn, fadeOut) * 0.7;
      ctx.fillStyle = `rgba(5,5,20,${overlayAlpha})`;
      ctx.fillRect(0, 0, W, H);

      const textAlpha = Math.min(fadeIn, fadeOut);
      ctx.globalAlpha = textAlpha;
      ctx.textAlign = 'center';

      // Level number
      ctx.fillStyle = DIM;
      ctx.font = '16px monospace';
      ctx.fillText(`LEVEL ${currentLevel + 1}`, W / 2, H / 2 - 50);

      // Level name
      ctx.fillStyle = CYAN;
      ctx.font = 'bold 36px monospace';
      ctx.shadowColor = CYAN;
      ctx.shadowBlur = 20;
      ctx.fillText(levelConfig.name.toUpperCase(), W / 2, H / 2);
      ctx.shadowBlur = 0;

      // Mode and phase info
      const modeNames: Record<ModeType, string> = {
        dash: 'DASH', glide: 'GLIDE', flip: 'FLIP', wave: 'WAVE',
      };
      ctx.fillStyle = '#888';
      ctx.font = '13px monospace';
      const phaseText = levelConfig.allowPhaseShift ? 'PHASE SHIFT ENABLED' : 'PHASE SHIFT LOCKED';
      ctx.fillText(`${modeNames[levelConfig.startMode]} MODE  |  ${phaseText}`, W / 2, H / 2 + 35);

      // Speed
      ctx.fillStyle = '#556';
      ctx.font = '11px monospace';
      ctx.fillText(`SPEED: ${levelConfig.scrollSpeed}`, W / 2, H / 2 + 60);

      ctx.globalAlpha = 1;
      ctx.restore();
    }

    function drawPauseOverlay() {
      if (!levelConfig) return;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,10,0.75)';
      ctx.fillRect(0, 0, W, H);

      ctx.textAlign = 'center';
      ctx.fillStyle = WHITE;
      ctx.font = 'bold 36px monospace';
      ctx.fillText('PAUSED', W / 2, H / 2 - 60);

      // Level info
      ctx.fillStyle = '#888';
      ctx.font = '14px monospace';
      const pct = Math.floor(clamp(cameraX / levelConfig.length, 0, 1) * 100);
      ctx.fillText(`LEVEL ${currentLevel + 1}: ${levelConfig.name.toUpperCase()}  —  ${pct}%`, W / 2, H / 2 - 25);

      // Mode & phase status
      ctx.font = '12px monospace';
      const modeColor = mode === 'dash' ? '#ffaa00' : mode === 'glide' ? '#00ff88' : mode === 'flip' ? '#ff4488' : '#44aaff';
      ctx.fillStyle = modeColor;
      ctx.fillText(`MODE: ${mode.toUpperCase()}`, W / 2 - 80, H / 2 + 5);
      if (levelConfig.allowPhaseShift) {
        ctx.fillStyle = phase === 'A' ? CYAN : MAGENTA;
        ctx.fillText(`PHASE: ${phase}`, W / 2 + 80, H / 2 + 5);
      }

      // Stars collected this run
      const collected = levelCollectibles.filter(c => c.collected).length;
      ctx.fillStyle = GOLD;
      ctx.font = '14px monospace';
      for (let s = 0; s < 3; s++) {
        ctx.fillText(s < collected ? '\u2605' : '\u2606', W / 2 - 20 + s * 20, H / 2 + 35);
      }

      // Controls
      ctx.fillStyle = DIM;
      ctx.font = '13px monospace';
      ctx.fillText('P / ESC = RESUME  |  R = RESTART', W / 2, H / 2 + 70);

      ctx.fillStyle = '#445';
      ctx.font = '11px monospace';
      ctx.fillText('SPACE/W = Action  |  SHIFT/X = Phase Shift', W / 2, H / 2 + 95);

      ctx.restore();
    }

    // ─── Game Loop ───
    function gameLoop(timestamp: number) {
      if (destroyed) return;

      if (!lastTime) lastTime = timestamp;
      let dt = (timestamp - lastTime) / 1000;
      lastTime = timestamp;
      if (dt > 0.05) dt = 0.05; // cap

      menuTime += dt;

      // Update stars parallax
      for (const s of bgStars) {
        s.x -= s.speed * 0.3;
        if (s.x < -2) s.x = W + 2;
      }

      // Level intro countdown (skip on any input)
      if (state === 'levelIntro') {
        levelIntroTimer -= dt;
        if (levelIntroTimer <= 0 || actionJustPressed || phaseJustPressed) {
          state = 'playing';
          actionJustPressed = false;
          phaseJustPressed = false;
        }
      }

      update(dt);
      draw();

      // Consume frame input
      actionJustPressed = false;
      phaseJustPressed = false;

      animId = requestAnimationFrame(gameLoop);
    }

    animId = requestAnimationFrame(gameLoop);

    // ─── Ambient music ───
    SoundEngine.play('click'); // Wake up audio context

    // ─── Cleanup ───
    return () => {
      destroyed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('mousedown', onLevelSelectClick);
    };
  }, []);

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', maxWidth: '100%', height: 'auto' }} />;
}
