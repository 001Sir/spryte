'use client';
import { useRef, useEffect } from 'react';
import { SoundEngine } from '@/lib/sounds';
import { getHighScore, setHighScore } from '@/lib/highscores';

// ─── Constants ───
const W = 800;
const H = 600;
const SLUG = 'whats-missing';

// Colors
const BG = '#0a0a1a';
const ACCENT = '#e879f9';
const ACCENT2 = '#a855f7';
const TEXT_WHITE = '#f0f0f0';
const TEXT_DIM = '#888';
const GREEN = '#34d399';
const RED = '#f87171';
const YELLOW = '#fbbf24';
const ORANGE = '#f97316';

// Scene area (where objects are drawn)
const SCENE_X = 50;
const SCENE_Y = 60;
const SCENE_W = 700;
const SCENE_H = 420;

// ─── Types ───
type GameState = 'menu' | 'playing' | 'gameover';
type PlayPhase = 'memorize' | 'find' | 'feedback' | 'transition';
type Theme = 'room' | 'kitchen' | 'outdoor' | 'space' | 'ocean';
type InteractionMode = 'choice' | 'click';

interface SceneObject {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void;
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

interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  id: string;
}

// ─── Object Drawing Functions ───
// Each returns a draw function for a specific object type

function drawTable(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(x, y + h * 0.3, w, h * 0.15);
  ctx.fillStyle = '#6B4F12';
  ctx.fillRect(x + w * 0.1, y + h * 0.45, w * 0.08, h * 0.55);
  ctx.fillRect(x + w * 0.82, y + h * 0.45, w * 0.08, h * 0.55);
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(x + w * 0.15, y + h * 0.4, w * 0.7, h * 0.1);
  ctx.fillRect(x + w * 0.15, y + h * 0.5, w * 0.08, h * 0.5);
  ctx.fillRect(x + w * 0.77, y + h * 0.5, w * 0.08, h * 0.5);
  ctx.fillRect(x + w * 0.15, y, w * 0.08, h * 0.45);
  ctx.fillRect(x + w * 0.77, y, w * 0.08, h * 0.45);
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x + w * 0.15, y, w * 0.7, h * 0.08);
}

function drawLamp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.35);
  ctx.lineTo(x + w * 0.8, y + h * 0.35);
  ctx.lineTo(x + w * 0.65, y);
  ctx.lineTo(x + w * 0.35, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#555';
  ctx.fillRect(x + w * 0.45, y + h * 0.35, w * 0.1, h * 0.55);
  ctx.fillRect(x + w * 0.3, y + h * 0.9, w * 0.4, h * 0.1);
}

function drawClock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.4;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.stroke();
}

function drawPlant(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x + w * 0.25, y + h * 0.6, w * 0.5, h * 0.4);
  ctx.fillStyle = '#228B22';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.5, y + h * 0.35, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#32CD32';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.35, y + h * 0.25, w * 0.2, h * 0.25, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawBook(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#DC143C';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#FFF8DC';
  ctx.fillRect(x + w * 0.1, y + h * 0.05, w * 0.85, h * 0.9);
  ctx.fillStyle = '#333';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x + w * 0.2, y + h * (0.2 + i * 0.2), w * 0.6, h * 0.04);
  }
}

function drawRug(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#B22222';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}

function drawFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#DAA520';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#4682B4';
  ctx.fillRect(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8);
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + w * 0.5, y + h * 0.5, w * 0.15, 0, Math.PI * 2);
  ctx.fill();
}

function drawVase(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#4169E1';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y);
  ctx.lineTo(x + w * 0.7, y);
  ctx.lineTo(x + w * 0.8, y + h * 0.3);
  ctx.lineTo(x + w * 0.85, y + h * 0.9);
  ctx.lineTo(x + w * 0.15, y + h * 0.9);
  ctx.lineTo(x + w * 0.2, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(x + w * 0.25, y + h * 0.9, w * 0.5, h * 0.1);
}

// Kitchen objects
function drawPot(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#666';
  ctx.fillRect(x + w * 0.1, y + h * 0.3, w * 0.8, h * 0.65);
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.3, w * 0.4, h * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#777';
  ctx.fillRect(x, y + h * 0.4, w * 0.1, h * 0.15);
  ctx.fillRect(x + w * 0.9, y + h * 0.4, w * 0.1, h * 0.15);
  ctx.fillStyle = '#444';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.2, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + w * 0.47, y + h * 0.2, w * 0.06, h * 0.12);
}

function drawPlate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#F5F5F5';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w * 0.35, h * 0.35, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCup(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#DEB887';
  ctx.fillRect(x + w * 0.15, y + h * 0.1, w * 0.6, h * 0.85);
  ctx.fillStyle = '#D2691E';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45, y + h * 0.15, w * 0.3, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#DEB887';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + w * 0.85, y + h * 0.45, w * 0.15, -Math.PI * 0.4, Math.PI * 0.4);
  ctx.stroke();
}

function drawFork(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(x + w * 0.4, y + h * 0.4, w * 0.2, h * 0.6);
  const tines = 4;
  for (let i = 0; i < tines; i++) {
    ctx.fillRect(x + w * (0.15 + i * 0.2), y, w * 0.1, h * 0.45);
  }
}

function drawKnife(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#C0C0C0';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.4, y);
  ctx.lineTo(x + w * 0.6, y);
  ctx.lineTo(x + w * 0.55, y + h * 0.5);
  ctx.lineTo(x + w * 0.45, y + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x + w * 0.35, y + h * 0.5, w * 0.3, h * 0.5);
}

function drawToaster(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#C0C0C0';
  const rad = Math.min(w, h) * 0.12;
  ctx.beginPath();
  ctx.moveTo(x + rad, y + h * 0.2);
  ctx.lineTo(x + w - rad, y + h * 0.2);
  ctx.quadraticCurveTo(x + w, y + h * 0.2, x + w, y + h * 0.2 + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + h * 0.2 + rad);
  ctx.quadraticCurveTo(x, y + h * 0.2, x + rad, y + h * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.fillRect(x + w * 0.2, y, w * 0.25, h * 0.25);
  ctx.fillRect(x + w * 0.55, y, w * 0.25, h * 0.25);
  ctx.fillStyle = '#888';
  ctx.fillRect(x + w * 0.85, y + h * 0.5, w * 0.1, h * 0.15);
}

function drawApple(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#DC143C';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.4, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#228B22';
  ctx.fillRect(x + w * 0.45, y, w * 0.1, h * 0.2);
  ctx.beginPath();
  ctx.ellipse(x + w * 0.6, y + h * 0.1, w * 0.12, h * 0.08, 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawJar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(173,216,230,0.6)';
  ctx.fillRect(x + w * 0.15, y + h * 0.15, w * 0.7, h * 0.8);
  ctx.fillStyle = '#666';
  ctx.fillRect(x + w * 0.2, y, w * 0.6, h * 0.18);
  ctx.fillStyle = '#FF6347';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.6, w * 0.2, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawSpoon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(x + w * 0.4, y + h * 0.45, w * 0.2, h * 0.55);
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.25, w * 0.3, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Outdoor objects
function drawTree(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x + w * 0.35, y + h * 0.5, w * 0.3, h * 0.5);
  ctx.fillStyle = '#228B22';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h * 0.55);
  ctx.lineTo(x, y + h * 0.55);
  ctx.closePath();
  ctx.fill();
}

function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.3;
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#FFA500';
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
    ctx.lineTo(cx + Math.cos(a) * r * 1.7, cy + Math.sin(a) * r * 1.7);
    ctx.stroke();
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#ECF0F1';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, y + h * 0.55, w * 0.25, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.55, y + h * 0.4, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.75, y + h * 0.55, w * 0.22, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.5);
  ctx.quadraticCurveTo(x + w * 0.25, y, x + w * 0.5, y + h * 0.3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.5, y + h * 0.3);
  ctx.quadraticCurveTo(x + w * 0.75, y, x + w, y + h * 0.5);
  ctx.stroke();
}

function drawFlower(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#228B22';
  ctx.fillRect(x + w * 0.45, y + h * 0.4, w * 0.1, h * 0.6);
  const cx = x + w / 2, cy = y + h * 0.3, r = w * 0.12;
  ctx.fillStyle = '#FF69B4';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3, r, r * 0.8, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2); ctx.fill();
}

function drawFence(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#DEB887';
  ctx.fillRect(x, y + h * 0.3, w, h * 0.1);
  ctx.fillRect(x, y + h * 0.7, w, h * 0.1);
  const posts = 5;
  for (let i = 0; i < posts; i++) {
    const px = x + (i / (posts - 1)) * w - w * 0.04;
    ctx.fillRect(px, y, w * 0.08, h);
    ctx.beginPath();
    ctx.moveTo(px, y);
    ctx.lineTo(px + w * 0.04, y - h * 0.08);
    ctx.lineTo(px + w * 0.08, y);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHouse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#CD853F';
  ctx.fillRect(x + w * 0.1, y + h * 0.4, w * 0.8, h * 0.6);
  ctx.fillStyle = '#8B0000';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.42);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w, y + h * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x + w * 0.4, y + h * 0.6, w * 0.2, h * 0.4);
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(x + w * 0.2, y + h * 0.5, w * 0.15, h * 0.15);
  ctx.fillRect(x + w * 0.65, y + h * 0.5, w * 0.15, h * 0.15);
}

function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#4169E1';
  ctx.fillRect(x, y + h * 0.35, w, h * 0.4);
  ctx.fillRect(x + w * 0.2, y + h * 0.05, w * 0.6, h * 0.35);
  ctx.fillStyle = '#87CEEB';
  ctx.fillRect(x + w * 0.25, y + h * 0.1, w * 0.22, h * 0.25);
  ctx.fillRect(x + w * 0.53, y + h * 0.1, w * 0.22, h * 0.25);
  ctx.fillStyle = '#333';
  ctx.beginPath(); ctx.arc(x + w * 0.25, y + h * 0.8, w * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.75, y + h * 0.8, w * 0.1, 0, Math.PI * 2); ctx.fill();
}

function drawBench(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#8B4513';
  ctx.fillRect(x, y + h * 0.35, w, h * 0.12);
  ctx.fillRect(x, y + h * 0.55, w, h * 0.08);
  ctx.fillRect(x + w * 0.05, y, w * 0.08, h);
  ctx.fillRect(x + w * 0.87, y, w * 0.08, h);
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#2E8B57';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, y + h * 0.6, w * 0.3, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.6, y + h * 0.5, w * 0.35, h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3CB371';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45, y + h * 0.4, w * 0.25, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

// Space objects
function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.35;
  ctx.fillStyle = '#E67E22';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#D35400';
  ctx.beginPath(); ctx.arc(cx - r * 0.2, cy - r * 0.1, r * 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#F39C12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 1.6, r * 0.3, -0.2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2;
  const outer = Math.min(w, h) * 0.4, inner = outer * 0.4;
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const aO = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const aI = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(aO) * outer, cy + Math.sin(aO) * outer);
    ctx.lineTo(cx + Math.cos(aI) * inner, cy + Math.sin(aI) * inner);
  }
  ctx.closePath();
  ctx.fill();
}

function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#E0E0E0';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w * 0.7, y + h * 0.3);
  ctx.lineTo(x + w * 0.7, y + h * 0.8);
  ctx.lineTo(x + w * 0.3, y + h * 0.8);
  ctx.lineTo(x + w * 0.3, y + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#87CEEB';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.4, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#E74C3C';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.7);
  ctx.lineTo(x + w * 0.1, y + h);
  ctx.lineTo(x + w * 0.3, y + h * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.7, y + h * 0.7);
  ctx.lineTo(x + w * 0.9, y + h);
  ctx.lineTo(x + w * 0.7, y + h * 0.85);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#F39C12';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.4, y + h * 0.8);
  ctx.lineTo(x + w / 2, y + h);
  ctx.lineTo(x + w * 0.6, y + h * 0.8);
  ctx.closePath();
  ctx.fill();
}

function drawAsteroid(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2;
  ctx.fillStyle = '#808080';
  ctx.beginPath();
  const pts = 8;
  for (let i = 0; i < pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = Math.min(w, h) * (0.3 + (((i * 7 + 3) % 5) / 10));
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#666';
  ctx.beginPath(); ctx.arc(cx - w * 0.1, cy - h * 0.05, w * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + w * 0.12, cy + h * 0.1, w * 0.04, 0, Math.PI * 2); ctx.fill();
}

function drawSatellite(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#C0C0C0';
  ctx.fillRect(x + w * 0.35, y + h * 0.3, w * 0.3, h * 0.4);
  ctx.fillStyle = '#1E90FF';
  ctx.fillRect(x, y + h * 0.35, w * 0.35, h * 0.3);
  ctx.fillRect(x + w * 0.65, y + h * 0.35, w * 0.35, h * 0.3);
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.15, w * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.15, w * 0.15, 0, Math.PI * 2);
  ctx.stroke();
}

function drawComet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#E8E8E8';
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h / 2, Math.min(w, h) * 0.2, 0, Math.PI * 2);
  ctx.fill();
  const grd = ctx.createLinearGradient(x, y + h / 2, x + w * 0.6, y + h / 2);
  grd.addColorStop(0, 'rgba(135,206,250,0)');
  grd.addColorStop(1, 'rgba(135,206,250,0.6)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.3);
  ctx.lineTo(x + w * 0.65, y + h * 0.4);
  ctx.lineTo(x + w * 0.65, y + h * 0.6);
  ctx.lineTo(x, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
}

function drawMoon(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * 0.4;
  ctx.fillStyle = '#ECF0F1';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#BDC3C7';
  ctx.beginPath(); ctx.arc(cx - r * 0.3, cy - r * 0.2, r * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.2, cy + r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + r * 0.1, cy - r * 0.35, r * 0.08, 0, Math.PI * 2); ctx.fill();
}

function drawUfo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = 'rgba(135,206,250,0.4)';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.35);
  ctx.quadraticCurveTo(x + w / 2, y, x + w * 0.65, y + h * 0.35);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#808080';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.45, w / 2, h * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFD700';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x + w * (0.2 + i * 0.2), y + h * 0.48, w * 0.03, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#666';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.55, w * 0.2, h * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawNebula(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2;
  const colors = ['rgba(147,51,234,0.3)', 'rgba(236,72,153,0.25)', 'rgba(59,130,246,0.2)'];
  const positions = [[0, 0], [-0.2, -0.15], [0.2, 0.1]];
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i];
    ctx.beginPath();
    ctx.ellipse(cx + w * positions[i][0], cy + h * positions[i][1], w * 0.35, h * 0.3, i * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 6; i++) {
    const sx = x + w * ((i * 37 + 13) % 100) / 100;
    const sy = y + h * ((i * 53 + 29) % 100) / 100;
    ctx.beginPath(); ctx.arc(sx, sy, 1, 0, Math.PI * 2); ctx.fill();
  }
}

// Ocean objects
function drawFish(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FF6347';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45, y + h / 2, w * 0.35, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.8, y + h / 2);
  ctx.lineTo(x + w, y + h * 0.2);
  ctx.lineTo(x + w, y + h * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x + w * 0.3, y + h * 0.4, w * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(x + w * 0.3, y + h * 0.4, w * 0.03, 0, Math.PI * 2); ctx.fill();
}

function drawWhale(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#4682B4';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.45, y + h * 0.55, w * 0.4, h * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.85, y + h * 0.45);
  ctx.lineTo(x + w, y + h * 0.2);
  ctx.lineTo(x + w, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x + w * 0.2, y + h * 0.45, w * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#87CEEB';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y + h * 0.2);
  ctx.quadraticCurveTo(x + w * 0.2, y, x + w * 0.28, y + h * 0.15);
  ctx.stroke();
}

function drawBoat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#8B4513';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.5);
  ctx.lineTo(x + w * 0.1, y + h);
  ctx.lineTo(x + w * 0.9, y + h);
  ctx.lineTo(x + w, y + h * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#A0522D';
  ctx.fillRect(x + w * 0.47, y + h * 0.05, w * 0.06, h * 0.5);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.53, y + h * 0.1);
  ctx.lineTo(x + w * 0.85, y + h * 0.35);
  ctx.lineTo(x + w * 0.53, y + h * 0.45);
  ctx.closePath();
  ctx.fill();
}

function drawAnchor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 3;
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.2);
  ctx.lineTo(x + w * 0.8, y + h * 0.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w * 0.25, y + h * 0.85, w * 0.15, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w * 0.75, y + h * 0.85, w * 0.15, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.85, w * 0.4, 0.2, Math.PI - 0.2, false);
  ctx.stroke();
}

function drawLighthouse(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.25);
  ctx.lineTo(x + w * 0.7, y + h * 0.25);
  ctx.lineTo(x + w * 0.8, y + h);
  ctx.lineTo(x + w * 0.2, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#E74C3C';
  ctx.fillRect(x + w * 0.32, y + h * 0.4, w * 0.36, h * 0.12);
  ctx.fillRect(x + w * 0.28, y + h * 0.65, w * 0.44, h * 0.12);
  ctx.fillStyle = '#FFD700';
  ctx.fillRect(x + w * 0.25, y + h * 0.15, w * 0.5, h * 0.12);
  ctx.fillStyle = '#FFF8DC';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.15);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w * 0.65, y + h * 0.15);
  ctx.closePath();
  ctx.fill();
}

function drawStarfish(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cx = x + w / 2, cy = y + h / 2;
  const outer = Math.min(w, h) * 0.4, inner = outer * 0.35;
  ctx.fillStyle = '#FF7F50';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const aO = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const aI = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(cx + Math.cos(aO) * outer, cy + Math.sin(aO) * outer);
    ctx.lineTo(cx + Math.cos(aI) * inner, cy + Math.sin(aI) * inner);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#FF6347';
  ctx.beginPath(); ctx.arc(cx, cy, inner * 0.6, 0, Math.PI * 2); ctx.fill();
}

function drawShell(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FFDAB9';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.9);
  ctx.quadraticCurveTo(x + w / 2, y, x + w * 0.9, y + h * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#DEB887';
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.9, w * 0.1 * i, Math.PI + 0.3, -0.3);
    ctx.stroke();
  }
}

function drawCoral(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#FF4500';
  ctx.fillRect(x + w * 0.4, y + h * 0.5, w * 0.2, h * 0.5);
  ctx.beginPath();
  ctx.ellipse(x + w * 0.3, y + h * 0.35, w * 0.15, h * 0.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.55, y + h * 0.25, w * 0.18, h * 0.22, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.75, y + h * 0.4, w * 0.12, h * 0.18, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawCrab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = '#DC143C';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.5, w * 0.3, h * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#DC143C';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + h * 0.5); ctx.lineTo(x, y + h * 0.25); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y + h * 0.2, w * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w * 0.8, y + h * 0.5); ctx.lineTo(x + w, y + h * 0.25); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + w, y + h * 0.2, w * 0.06, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x + w * 0.4, y + h * 0.4, w * 0.04, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * 0.6, y + h * 0.4, w * 0.04, 0, Math.PI * 2); ctx.fill();
  for (let i = 0; i < 3; i++) {
    ctx.strokeStyle = '#DC143C';
    ctx.beginPath();
    ctx.moveTo(x + w * (0.3 + i * 0.1), y + h * 0.75);
    ctx.lineTo(x + w * (0.25 + i * 0.08), y + h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * (0.55 + i * 0.1), y + h * 0.75);
    ctx.lineTo(x + w * (0.6 + i * 0.08), y + h);
    ctx.stroke();
  }
}

// ─── Theme Definitions ───
interface ThemeDef {
  name: string;
  label: string;
  bgColor: string;
  bgColor2: string;
  drawBg: (ctx: CanvasRenderingContext2D) => void;
  objects: { name: string; draw: (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => void }[];
}

const THEMES: ThemeDef[] = [
  {
    name: 'room', label: 'Living Room',
    bgColor: '#1a1520', bgColor2: '#2a2035',
    drawBg(ctx) {
      ctx.fillStyle = '#2a2035';
      ctx.fillRect(SCENE_X, SCENE_Y, SCENE_W, SCENE_H);
      ctx.fillStyle = '#3a2a40';
      ctx.fillRect(SCENE_X, SCENE_Y + SCENE_H * 0.65, SCENE_W, SCENE_H * 0.35);
      ctx.strokeStyle = '#4a3a50';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(SCENE_X, SCENE_Y + SCENE_H * 0.65);
      ctx.lineTo(SCENE_X + SCENE_W, SCENE_Y + SCENE_H * 0.65);
      ctx.stroke();
    },
    objects: [
      { name: 'Table', draw: drawTable },
      { name: 'Chair', draw: drawChair },
      { name: 'Lamp', draw: drawLamp },
      { name: 'Clock', draw: drawClock },
      { name: 'Plant', draw: drawPlant },
      { name: 'Book', draw: drawBook },
      { name: 'Rug', draw: drawRug },
      { name: 'Window', draw: drawWindow },
      { name: 'Frame', draw: drawFrame },
      { name: 'Vase', draw: drawVase },
    ],
  },
  {
    name: 'kitchen', label: 'Kitchen',
    bgColor: '#1a1a20', bgColor2: '#252530',
    drawBg(ctx) {
      ctx.fillStyle = '#252530';
      ctx.fillRect(SCENE_X, SCENE_Y, SCENE_W, SCENE_H);
      ctx.fillStyle = '#303040';
      ctx.fillRect(SCENE_X, SCENE_Y + SCENE_H * 0.7, SCENE_W, SCENE_H * 0.3);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const tx = SCENE_X + (i / 8) * SCENE_W;
        ctx.strokeRect(tx, SCENE_Y, SCENE_W / 8, SCENE_H * 0.35);
      }
    },
    objects: [
      { name: 'Pot', draw: drawPot },
      { name: 'Plate', draw: drawPlate },
      { name: 'Cup', draw: drawCup },
      { name: 'Fork', draw: drawFork },
      { name: 'Knife', draw: drawKnife },
      { name: 'Toaster', draw: drawToaster },
      { name: 'Apple', draw: drawApple },
      { name: 'Jar', draw: drawJar },
      { name: 'Spoon', draw: drawSpoon },
      { name: 'Clock', draw: drawClock },
    ],
  },
  {
    name: 'outdoor', label: 'Outdoor Park',
    bgColor: '#0a1a0a', bgColor2: '#1a2a1a',
    drawBg(ctx) {
      ctx.fillStyle = '#1a3a4a';
      ctx.fillRect(SCENE_X, SCENE_Y, SCENE_W, SCENE_H * 0.5);
      ctx.fillStyle = '#2a5a2a';
      ctx.fillRect(SCENE_X, SCENE_Y + SCENE_H * 0.5, SCENE_W, SCENE_H * 0.5);
      ctx.fillStyle = '#3a7a3a';
      ctx.fillRect(SCENE_X, SCENE_Y + SCENE_H * 0.5, SCENE_W, SCENE_H * 0.05);
    },
    objects: [
      { name: 'Tree', draw: drawTree },
      { name: 'Sun', draw: drawSun },
      { name: 'Cloud', draw: drawCloud },
      { name: 'Bird', draw: drawBird },
      { name: 'Flower', draw: drawFlower },
      { name: 'Fence', draw: drawFence },
      { name: 'House', draw: drawHouse },
      { name: 'Car', draw: drawCar },
      { name: 'Bench', draw: drawBench },
      { name: 'Bush', draw: drawBush },
    ],
  },
  {
    name: 'space', label: 'Outer Space',
    bgColor: '#050510', bgColor2: '#0a0a20',
    drawBg(ctx) {
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(SCENE_X, SCENE_Y, SCENE_W, SCENE_H);
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 40; i++) {
        const sx = SCENE_X + ((i * 97 + 13) % SCENE_W);
        const sy = SCENE_Y + ((i * 53 + 29) % SCENE_H);
        const sr = 0.5 + (i % 3) * 0.5;
        ctx.globalAlpha = 0.3 + (i % 5) * 0.12;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    objects: [
      { name: 'Planet', draw: drawPlanet },
      { name: 'Star', draw: drawStar },
      { name: 'Rocket', draw: drawRocket },
      { name: 'Asteroid', draw: drawAsteroid },
      { name: 'Satellite', draw: drawSatellite },
      { name: 'Comet', draw: drawComet },
      { name: 'Moon', draw: drawMoon },
      { name: 'UFO', draw: drawUfo },
      { name: 'Nebula', draw: drawNebula },
      { name: 'Star', draw: drawStar },
    ],
  },
  {
    name: 'ocean', label: 'Ocean',
    bgColor: '#0a1a2a', bgColor2: '#0a2a3a',
    drawBg(ctx) {
      const grd = ctx.createLinearGradient(SCENE_X, SCENE_Y, SCENE_X, SCENE_Y + SCENE_H);
      grd.addColorStop(0, '#0a3a5a');
      grd.addColorStop(0.3, '#0a2a4a');
      grd.addColorStop(1, '#0a1520');
      ctx.fillStyle = grd;
      ctx.fillRect(SCENE_X, SCENE_Y, SCENE_W, SCENE_H);
      ctx.strokeStyle = 'rgba(100,180,255,0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const wy = SCENE_Y + SCENE_H * (0.1 + i * 0.15);
        ctx.beginPath();
        for (let wx = SCENE_X; wx < SCENE_X + SCENE_W; wx += 5) {
          ctx.lineTo(wx, wy + Math.sin(wx * 0.03 + i) * 4);
        }
        ctx.stroke();
      }
    },
    objects: [
      { name: 'Fish', draw: drawFish },
      { name: 'Whale', draw: drawWhale },
      { name: 'Boat', draw: drawBoat },
      { name: 'Anchor', draw: drawAnchor },
      { name: 'Lighthouse', draw: drawLighthouse },
      { name: 'Starfish', draw: drawStarfish },
      { name: 'Shell', draw: drawShell },
      { name: 'Coral', draw: drawCoral },
      { name: 'Crab', draw: drawCrab },
      { name: 'Fish', draw: drawFish },
    ],
  },
];

// ─── Scene Generation ───
function generateScene(theme: ThemeDef, objectCount: number, rng: () => number): SceneObject[] {
  const available = [...theme.objects];
  const objs: SceneObject[] = [];
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const count = Math.min(objectCount, available.length);

  // Shuffle
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  const selected = available.slice(0, count);
  const maxAttempts = 80;

  for (let i = 0; i < selected.length; i++) {
    const obj = selected[i];
    const size = 45 + rng() * 30;
    const objW = size + rng() * 20;
    const objH = size + rng() * 20;

    let bestX = 0, bestY = 0, found = false;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const tx = SCENE_X + 20 + rng() * (SCENE_W - objW - 40);
      const ty = SCENE_Y + 20 + rng() * (SCENE_H - objH - 40);
      let overlaps = false;
      for (const p of placed) {
        if (tx < p.x + p.w + 10 && tx + objW + 10 > p.x &&
            ty < p.y + p.h + 10 && ty + objH + 10 > p.y) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        bestX = tx;
        bestY = ty;
        found = true;
        break;
      }
    }
    if (!found) {
      bestX = SCENE_X + 20 + rng() * (SCENE_W - objW - 40);
      bestY = SCENE_Y + 20 + rng() * (SCENE_H - objH - 40);
    }
    placed.push({ x: bestX, y: bestY, w: objW, h: objH });
    objs.push({
      id: `${obj.name}-${i}`,
      name: obj.name,
      x: bestX,
      y: bestY,
      w: objW,
      h: objH,
      draw: obj.draw,
    });
  }

  return objs;
}

// ─── Seeded RNG ───
function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// ─── Difficulty Config ───
interface DifficultyConfig {
  objectCount: number;
  memorizeTime: number; // frames (60fps)
  findTime: number;     // frames
  mode: InteractionMode;
}

function getDifficulty(round: number): DifficultyConfig {
  if (round <= 3) return { objectCount: 5, memorizeTime: 300, findTime: 900, mode: 'choice' };
  if (round <= 6) return { objectCount: 7, memorizeTime: 240, findTime: 720, mode: 'choice' };
  if (round <= 9) return { objectCount: 8, memorizeTime: 180, findTime: 600, mode: 'choice' };
  if (round <= 12) return { objectCount: 9, memorizeTime: 150, findTime: 540, mode: 'click' };
  if (round <= 15) return { objectCount: 10, memorizeTime: 120, findTime: 480, mode: 'click' };
  return { objectCount: 10, memorizeTime: 100, findTime: 420, mode: 'click' };
}

// ═══════════════════════════════
// Main Component
// ═══════════════════════════════
export default function WhatsMissingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // ─── Game State ───
    let state: GameState = 'menu';
    let phase: PlayPhase = 'memorize';
    let round = 0;
    let score = 0;
    let lives = 3;
    let streak = 0;
    let bestStreak = 0;
    let totalCorrect = 0;
    let totalRounds = 0;
    let highScore = getHighScore(SLUG);

    // Scene state
    let currentTheme: ThemeDef = THEMES[0];
    let sceneObjects: SceneObject[] = [];
    let removedObject: SceneObject | null = null;
    let nothingRemoved = false;

    // Timer
    let phaseTimer = 0;
    let phaseMaxTime = 0;

    // Feedback
    let feedbackCorrect = false;
    let feedbackTimer = 0;
    const FEEDBACK_TIME = 90;

    // Transition
    let transitionTimer = 0;
    const TRANSITION_TIME = 40;

    // Interaction
    let interactionMode: InteractionMode = 'choice';
    let choiceButtons: ButtonRect[] = [];
    let hoveredButton: string | null = null;
    let playerAnswer: string | null = null;

    // Click mode
    let clickX = -1;
    let clickY = -1;
    let showClickMarker = false;

    // Mouse
    let mouseX = 0, mouseY = 0;

    // Particles
    let particles: Particle[] = [];

    // Menu animation
    let menuTime = 0;

    // Screen shake
    let shakeX = 0, shakeY = 0, shakeMag = 0;

    // ─── Helpers ───
    function addParticles(px: number, py: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 3;
        particles.push({
          x: px, y: py,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 40 + Math.random() * 30,
          maxLife: 40 + Math.random() * 30,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    function startRound() {
      round++;
      totalRounds++;
      const diff = getDifficulty(round);
      interactionMode = diff.mode;

      // Random theme
      currentTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
      const rng = seededRng(Date.now() + round * 1000);
      sceneObjects = generateScene(currentTheme, diff.objectCount, rng);

      // Decide if we remove something (90% chance) or nothing (10% chance — trick rounds)
      nothingRemoved = Math.random() < 0.1 && round > 3;
      if (nothingRemoved) {
        removedObject = null;
      } else {
        const idx = Math.floor(Math.random() * sceneObjects.length);
        removedObject = sceneObjects[idx];
      }

      phase = 'memorize';
      phaseTimer = 0;
      phaseMaxTime = diff.memorizeTime;
      choiceButtons = [];
      hoveredButton = null;
      playerAnswer = null;
      clickX = -1;
      clickY = -1;
      showClickMarker = false;
    }

    function startFindPhase() {
      const diff = getDifficulty(round);
      phase = 'find';
      phaseTimer = 0;
      phaseMaxTime = diff.findTime;

      if (interactionMode === 'choice') {
        buildChoiceButtons();
      }
    }

    function buildChoiceButtons() {
      const btns: ButtonRect[] = [];
      const allNames = sceneObjects.map(o => o.name);
      const correctName = removedObject ? removedObject.name : null;

      const options: string[] = [];
      if (correctName) options.push(correctName);

      // Add distractors from the scene objects that were NOT removed
      const remaining = allNames.filter(n => n !== correctName);
      const shuffled = [...new Set(remaining)].sort(() => Math.random() - 0.5);
      for (const n of shuffled) {
        if (options.length >= 3) break;
        if (!options.includes(n)) options.push(n);
      }

      // If not enough, add from theme
      if (options.length < 3) {
        const themeNames = currentTheme.objects.map(o => o.name);
        for (const n of themeNames) {
          if (options.length >= 3) break;
          if (!options.includes(n)) options.push(n);
        }
      }

      // Always add "Nothing's Missing!" option
      options.push("Nothing");

      // Shuffle options
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
      }

      const btnW = 150;
      const btnH = 40;
      const gap = 12;
      const totalW = options.length * btnW + (options.length - 1) * gap;
      const startX = (W - totalW) / 2;
      const btnY = H - 65;

      for (let i = 0; i < options.length; i++) {
        btns.push({
          x: startX + i * (btnW + gap),
          y: btnY,
          w: btnW,
          h: btnH,
          label: options[i],
          id: options[i],
        });
      }
      choiceButtons = btns;
    }

    function handleAnswer(answer: string) {
      if (phase !== 'find') return;
      playerAnswer = answer;
      const isCorrect = nothingRemoved
        ? answer === 'Nothing'
        : answer === (removedObject?.name || '');

      feedbackCorrect = isCorrect;
      if (isCorrect) {
        const timeRatio = 1 - (phaseTimer / phaseMaxTime);
        const basePoints = 100;
        const speedBonus = Math.floor(100 * timeRatio * timeRatio);
        const streakMult = 1 + streak * 0.1;
        const roundScore = Math.floor((basePoints + speedBonus) * Math.min(streakMult, 3));
        score += roundScore;
        streak++;
        if (streak > bestStreak) bestStreak = streak;
        totalCorrect++;
        SoundEngine.play('collectGem');
        if (streak > 0 && streak % 5 === 0) SoundEngine.play('comboUp');
        if (removedObject) {
          addParticles(removedObject.x + removedObject.w / 2, removedObject.y + removedObject.h / 2, GREEN, 20);
        } else {
          addParticles(W / 2, H / 2, GREEN, 20);
        }
      } else {
        lives--;
        streak = 0;
        SoundEngine.play('playerDamage');
        shakeMag = 8;
        if (removedObject) {
          addParticles(removedObject.x + removedObject.w / 2, removedObject.y + removedObject.h / 2, RED, 15);
        }
      }

      phase = 'feedback';
      feedbackTimer = 0;
    }

    function handleClickAnswer(cx: number, cy: number) {
      if (phase !== 'find') return;
      clickX = cx;
      clickY = cy;
      showClickMarker = true;

      if (nothingRemoved) {
        // Clicking anywhere is wrong in trick round — need to press "Nothing" button
        // We don't auto-handle click as answer for trick rounds in click mode
        // Instead, there's always a small "Nothing Missing" button in click mode too
        return;
      }

      if (removedObject) {
        const obj = removedObject;
        const margin = 20;
        if (cx >= obj.x - margin && cx <= obj.x + obj.w + margin &&
            cy >= obj.y - margin && cy <= obj.y + obj.h + margin) {
          handleAnswer(obj.name);
        }
      }
    }

    function endGame() {
      state = 'gameover';
      if (score > highScore) {
        highScore = score;
        setHighScore(SLUG, score);
      }
      SoundEngine.play('gameOver');
    }

    // ─── Update ───
    function update() {
      // Particles
      particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.life--;
        return p.life > 0;
      });

      // Shake
      if (shakeMag > 0) {
        shakeX = (Math.random() - 0.5) * shakeMag;
        shakeY = (Math.random() - 0.5) * shakeMag;
        shakeMag *= 0.85;
        if (shakeMag < 0.5) { shakeMag = 0; shakeX = 0; shakeY = 0; }
      }

      if (state === 'menu') {
        menuTime++;
        return;
      }

      if (state !== 'playing') return;

      if (phase === 'memorize') {
        phaseTimer++;
        if (phaseTimer >= phaseMaxTime) {
          startFindPhase();
        }
      } else if (phase === 'find') {
        phaseTimer++;
        if (phaseTimer >= phaseMaxTime) {
          // Time's up
          lives--;
          streak = 0;
          feedbackCorrect = false;
          SoundEngine.play('playerDamage');
          shakeMag = 8;
          phase = 'feedback';
          feedbackTimer = 0;
        }
      } else if (phase === 'feedback') {
        feedbackTimer++;
        if (feedbackTimer >= FEEDBACK_TIME) {
          if (lives <= 0) {
            endGame();
          } else {
            phase = 'transition';
            transitionTimer = 0;
          }
        }
      } else if (phase === 'transition') {
        transitionTimer++;
        if (transitionTimer >= TRANSITION_TIME) {
          startRound();
        }
      }
    }

    // ─── Draw ───
    function drawScene(showAll: boolean) {
      currentTheme.drawBg(ctx);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(SCENE_X, SCENE_Y, SCENE_W, SCENE_H);

      for (const obj of sceneObjects) {
        if (!showAll && removedObject && obj.id === removedObject.id) continue;
        ctx.save();
        obj.draw(ctx, obj.x, obj.y, obj.w, obj.h);
        ctx.restore();
      }
    }

    function drawTimerBar(timeLeft: number, maxTime: number, yPos: number) {
      const ratio = Math.max(0, timeLeft / maxTime);
      const barW = 300;
      const barH = 8;
      const barX = (W - barW) / 2;

      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(barX, yPos, barW, barH, 4);
      ctx.fill();

      let color = GREEN;
      if (ratio < 0.3) color = RED;
      else if (ratio < 0.6) color = YELLOW;

      if (ratio < 0.25) {
        const pulse = Math.sin(phaseTimer * 0.2) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(barX, yPos, barW * ratio, barH, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    function drawHUD() {
      // Score
      ctx.fillStyle = TEXT_WHITE;
      ctx.font = 'bold 18px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(`Score: ${score}`, 20, 30);

      // Round
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '14px system-ui';
      ctx.fillText(`Round ${round}`, 20, 50);

      // Streak
      if (streak > 0) {
        ctx.fillStyle = ORANGE;
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'left';
        const mult = Math.min(1 + streak * 0.1, 3).toFixed(1);
        ctx.fillText(`Streak: ${streak} (${mult}x)`, 150, 30);
      }

      // Lives
      ctx.textAlign = 'right';
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < lives ? RED : 'rgba(255,255,255,0.15)';
        ctx.font = '20px system-ui';
        ctx.fillText('♥', W - 20 - (2 - i) * 28, 30);
      }

      // Theme label
      ctx.fillStyle = ACCENT;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(currentTheme.label, W - 20, 50);

      // High score
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '12px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`Best: ${highScore}`, W - 20, H - 10);
    }

    function drawChoiceButtons() {
      for (const btn of choiceButtons) {
        const isHovered = hoveredButton === btn.id;
        const isSelected = playerAnswer === btn.id;

        if (phase === 'feedback' && playerAnswer !== null) {
          const isCorrectAnswer = nothingRemoved ? btn.id === 'Nothing' : btn.id === removedObject?.name;
          if (isCorrectAnswer) {
            ctx.fillStyle = GREEN;
            ctx.globalAlpha = 0.9;
          } else if (isSelected && !feedbackCorrect) {
            ctx.fillStyle = RED;
            ctx.globalAlpha = 0.9;
          } else {
            ctx.fillStyle = '#333';
            ctx.globalAlpha = 0.4;
          }
        } else {
          ctx.fillStyle = isHovered ? ACCENT2 : '#333';
          ctx.globalAlpha = isHovered ? 0.9 : 0.7;
        }

        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.strokeStyle = isHovered ? ACCENT : 'rgba(255,255,255,0.15)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(btn.x, btn.y, btn.w, btn.h, 10);
        ctx.stroke();

        ctx.fillStyle = TEXT_WHITE;
        ctx.font = 'bold 14px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(btn.label === 'Nothing' ? "Nothing's Missing" : btn.label, btn.x + btn.w / 2, btn.y + btn.h / 2);
      }
      ctx.textBaseline = 'alphabetic';
    }

    function drawNothingButton() {
      // Small "Nothing Missing" button for click mode
      const btnW = 160;
      const btnH = 36;
      const btnX = W - btnW - 20;
      const btnY = H - 60;

      const isHovered = hoveredButton === 'nothing-btn';

      ctx.fillStyle = isHovered ? ACCENT2 : '#333';
      ctx.globalAlpha = isHovered ? 0.85 : 0.6;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isHovered ? ACCENT : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 8);
      ctx.stroke();

      ctx.fillStyle = TEXT_WHITE;
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText("Nothing's Missing", btnX + btnW / 2, btnY + btnH / 2 + 4);

      // Store for hit testing
      choiceButtons = [{
        x: btnX, y: btnY, w: btnW, h: btnH,
        label: 'Nothing', id: 'Nothing',
      }];
    }

    function drawParticles() {
      for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawMenuScreen() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Animated background objects
      ctx.save();
      ctx.globalAlpha = 0.12;
      const t = menuTime * 0.01;
      for (let i = 0; i < 8; i++) {
        const theme = THEMES[i % THEMES.length];
        const obj = theme.objects[i % theme.objects.length];
        const ox = 100 + (i * 97) % (W - 200);
        const oy = 100 + (i * 53) % (H - 200);
        const bob = Math.sin(t + i * 1.2) * 8;
        obj.draw(ctx, ox, oy + bob, 50, 50);
      }
      ctx.restore();

      // Title glow
      const glowR = 120 + Math.sin(menuTime * 0.03) * 20;
      const grd = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, glowR);
      grd.addColorStop(0, 'rgba(232,121,249,0.15)');
      grd.addColorStop(1, 'rgba(232,121,249,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // Title
      ctx.fillStyle = ACCENT;
      ctx.font = 'bold 48px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText("What's Missing?", W / 2, 200);

      ctx.fillStyle = TEXT_DIM;
      ctx.font = '16px system-ui';
      ctx.fillText('Memorize the scene, then find what disappeared', W / 2, 240);

      // Info
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '13px system-ui';
      ctx.fillText('5 themed scenes  •  Hybrid controls  •  Increasing difficulty', W / 2, 280);

      // High score
      if (highScore > 0) {
        ctx.fillStyle = YELLOW;
        ctx.font = 'bold 16px system-ui';
        ctx.fillText(`Best Score: ${highScore}`, W / 2, 320);
      }

      // Start button
      const btnW = 200;
      const btnH = 50;
      const btnX = W / 2 - btnW / 2;
      const btnY = 360;
      const pulse = Math.sin(menuTime * 0.06) * 0.15 + 0.85;

      ctx.fillStyle = ACCENT;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 12);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#000';
      ctx.font = 'bold 20px system-ui';
      ctx.fillText('Play', W / 2, btnY + btnH / 2 + 7);

      // Controls
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '12px system-ui';
      ctx.fillText('Click / Tap to play  •  3 lives  •  Beat your high score!', W / 2, 440);
      ctx.fillText('Easy rounds: Multiple choice  |  Hard rounds: Click where it was', W / 2, 460);
    }

    function drawPlayingScreen() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(shakeX, shakeY);

      if (phase === 'memorize') {
        drawScene(true);
        drawHUD();

        // "Memorize!" label
        const fadeIn = Math.min(phaseTimer / 20, 1);
        ctx.globalAlpha = fadeIn;
        ctx.fillStyle = ACCENT;
        ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('Memorize this scene!', W / 2, H - 30);
        ctx.globalAlpha = 1;

        drawTimerBar(phaseMaxTime - phaseTimer, phaseMaxTime, H - 50);

      } else if (phase === 'find') {
        // Draw scene without removed object
        drawScene(false);
        drawHUD();

        // Instruction
        ctx.fillStyle = YELLOW;
        ctx.font = 'bold 16px system-ui';
        ctx.textAlign = 'center';
        if (interactionMode === 'choice') {
          ctx.fillText("What's missing? Pick below!", W / 2, H - 80);
          drawChoiceButtons();
        } else {
          ctx.fillText("Click where the missing object was!", W / 2, SCENE_Y + SCENE_H + 25);
          drawNothingButton();
        }

        drawTimerBar(phaseMaxTime - phaseTimer, phaseMaxTime, SCENE_Y - 15);

        // Click marker
        if (showClickMarker) {
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(clickX, clickY, 15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(clickX - 8, clickY);
          ctx.lineTo(clickX + 8, clickY);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(clickX, clickY - 8);
          ctx.lineTo(clickX, clickY + 8);
          ctx.stroke();
        }

      } else if (phase === 'feedback') {
        drawScene(false);
        drawHUD();

        // Show where the removed object was
        if (removedObject && !nothingRemoved) {
          const flash = Math.sin(feedbackTimer * 0.15) * 0.3 + 0.5;
          ctx.strokeStyle = feedbackCorrect ? GREEN : RED;
          ctx.lineWidth = 3;
          ctx.globalAlpha = flash;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(removedObject.x - 5, removedObject.y - 5, removedObject.w + 10, removedObject.h + 10);
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;

          // Draw ghost of removed object
          ctx.globalAlpha = 0.35 + Math.sin(feedbackTimer * 0.1) * 0.15;
          ctx.save();
          removedObject.draw(ctx, removedObject.x, removedObject.y, removedObject.w, removedObject.h);
          ctx.restore();
          ctx.globalAlpha = 1;

          // Label
          ctx.fillStyle = feedbackCorrect ? GREEN : RED;
          ctx.font = 'bold 14px system-ui';
          ctx.textAlign = 'center';
          ctx.fillText(removedObject.name, removedObject.x + removedObject.w / 2, removedObject.y - 12);
        }

        // Feedback text
        ctx.font = 'bold 28px system-ui';
        ctx.textAlign = 'center';
        if (feedbackCorrect) {
          ctx.fillStyle = GREEN;
          const msgs = ['Correct!', 'Nice eye!', 'Sharp!', 'Perfect!', 'Got it!'];
          ctx.fillText(msgs[round % msgs.length], W / 2, H - 30);
        } else {
          ctx.fillStyle = RED;
          const msgs = ['Wrong!', 'Missed it!', 'Nope!', "Time's up!"];
          ctx.fillText(feedbackTimer === 0 && phaseTimer >= phaseMaxTime ? msgs[3] : msgs[round % 3], W / 2, H - 30);
        }

        if (interactionMode === 'choice') {
          drawChoiceButtons();
        }

      } else if (phase === 'transition') {
        const alpha = 1 - transitionTimer / TRANSITION_TIME;
        ctx.globalAlpha = alpha;
        drawScene(false);
        ctx.globalAlpha = 1;

        ctx.fillStyle = ACCENT;
        ctx.font = 'bold 24px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(`Round ${round + 1}`, W / 2, H / 2);

        const nextThemeName = '...';
        ctx.fillStyle = TEXT_DIM;
        ctx.font = '14px system-ui';
        ctx.fillText(`Get ready! ${nextThemeName}`, W / 2, H / 2 + 30);
      }

      drawParticles();
      ctx.restore();
    }

    function drawGameOverScreen() {
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // Dim background objects
      ctx.save();
      ctx.globalAlpha = 0.06;
      for (let i = 0; i < 5; i++) {
        const theme = THEMES[i % THEMES.length];
        const obj = theme.objects[i];
        obj.draw(ctx, 100 + i * 130, 400, 50, 50);
      }
      ctx.restore();

      // Title
      ctx.fillStyle = RED;
      ctx.font = 'bold 42px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', W / 2, 130);

      // Score
      ctx.fillStyle = TEXT_WHITE;
      ctx.font = 'bold 32px system-ui';
      ctx.fillText(`${score}`, W / 2, 185);
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '14px system-ui';
      ctx.fillText('SCORE', W / 2, 205);

      if (score >= highScore && score > 0) {
        ctx.fillStyle = YELLOW;
        ctx.font = 'bold 16px system-ui';
        ctx.fillText('New High Score!', W / 2, 235);
      }

      // Stats
      const stats = [
        { label: 'Rounds', value: `${totalRounds}` },
        { label: 'Correct', value: `${totalCorrect}` },
        { label: 'Accuracy', value: totalRounds > 0 ? `${Math.round(totalCorrect / totalRounds * 100)}%` : '0%' },
        { label: 'Best Streak', value: `${bestStreak}` },
      ];
      const statY = 270;
      const statGap = 140;
      const startStatX = W / 2 - ((stats.length - 1) * statGap) / 2;

      for (let i = 0; i < stats.length; i++) {
        const sx = startStatX + i * statGap;
        ctx.fillStyle = TEXT_WHITE;
        ctx.font = 'bold 26px system-ui';
        ctx.fillText(stats[i].value, sx, statY);
        ctx.fillStyle = TEXT_DIM;
        ctx.font = '12px system-ui';
        ctx.fillText(stats[i].label, sx, statY + 20);
      }

      // Play again button
      const btnW = 200;
      const btnH = 50;
      const btnX = W / 2 - btnW / 2;
      const btnY = 360;
      const pulse = Math.sin(menuTime * 0.06) * 0.15 + 0.85;

      ctx.fillStyle = ACCENT;
      ctx.globalAlpha = pulse;
      ctx.beginPath();
      ctx.roundRect(btnX, btnY, btnW, btnH, 12);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.fillStyle = '#000';
      ctx.font = 'bold 20px system-ui';
      ctx.fillText('Play Again', W / 2, btnY + btnH / 2 + 7);

      // Best score
      ctx.fillStyle = TEXT_DIM;
      ctx.font = '13px system-ui';
      ctx.fillText(`Best: ${highScore}`, W / 2, 440);

      drawParticles();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      if (state === 'menu') drawMenuScreen();
      else if (state === 'playing') drawPlayingScreen();
      else if (state === 'gameover') drawGameOverScreen();
    }

    // ─── Game Loop ───
    let animId = 0;
    function gameLoop() {
      update();
      draw();
      animId = requestAnimationFrame(gameLoop);
    }

    // ─── Input ───
    function getCanvasCoords(e: MouseEvent | Touch): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }

    function handleMouseMove(e: MouseEvent) {
      const pos = getCanvasCoords(e);
      mouseX = pos.x;
      mouseY = pos.y;

      // Button hover
      hoveredButton = null;
      for (const btn of choiceButtons) {
        if (pos.x >= btn.x && pos.x <= btn.x + btn.w &&
            pos.y >= btn.y && pos.y <= btn.y + btn.h) {
          hoveredButton = btn.id;
          break;
        }
      }
    }

    function handleClick(e: MouseEvent) {
      const pos = getCanvasCoords(e);
      SoundEngine.play('click');

      if (state === 'menu') {
        // Check start button
        const btnW = 200, btnH = 50;
        const btnX = W / 2 - btnW / 2, btnY = 360;
        if (pos.x >= btnX && pos.x <= btnX + btnW && pos.y >= btnY && pos.y <= btnY + btnH) {
          state = 'playing';
          round = 0;
          score = 0;
          lives = 3;
          streak = 0;
          bestStreak = 0;
          totalCorrect = 0;
          totalRounds = 0;
          startRound();
          SoundEngine.play('menuSelect');
        }
        return;
      }

      if (state === 'gameover') {
        const btnW = 200, btnH = 50;
        const btnX = W / 2 - btnW / 2, btnY = 360;
        if (pos.x >= btnX && pos.x <= btnX + btnW && pos.y >= btnY && pos.y <= btnY + btnH) {
          state = 'playing';
          round = 0;
          score = 0;
          lives = 3;
          streak = 0;
          bestStreak = 0;
          totalCorrect = 0;
          totalRounds = 0;
          startRound();
          SoundEngine.play('menuSelect');
        }
        return;
      }

      if (state === 'playing' && phase === 'find') {
        // Check choice buttons
        for (const btn of choiceButtons) {
          if (pos.x >= btn.x && pos.x <= btn.x + btn.w &&
              pos.y >= btn.y && pos.y <= btn.y + btn.h) {
            handleAnswer(btn.id);
            return;
          }
        }

        // Click mode — click on scene
        if (interactionMode === 'click') {
          if (pos.x >= SCENE_X && pos.x <= SCENE_X + SCENE_W &&
              pos.y >= SCENE_Y && pos.y <= SCENE_Y + SCENE_H) {
            handleClickAnswer(pos.x, pos.y);
          }
        }
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        if (state === 'menu' || state === 'gameover') {
          e.preventDefault();
          state = 'playing';
          round = 0;
          score = 0;
          lives = 3;
          streak = 0;
          bestStreak = 0;
          totalCorrect = 0;
          totalRounds = 0;
          startRound();
          SoundEngine.play('menuSelect');
        }
      }

      if (state === 'playing' && phase === 'find' && interactionMode === 'choice') {
        // Number keys to select
        const num = parseInt(e.key);
        if (num >= 1 && num <= choiceButtons.length) {
          handleAnswer(choiceButtons[num - 1].id);
        }
      }
    }

    function handleTouchStart(e: TouchEvent) {
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = getCanvasCoords(e.touches[0]);
        mouseX = pos.x;
        mouseY = pos.y;

        // Reuse click logic
        handleClick({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY } as MouseEvent);
      }
    }

    // ─── Attach Events ───
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    animId = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
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
        cursor: 'crosshair',
      }}
    />
  );
}
