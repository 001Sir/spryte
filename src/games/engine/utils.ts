// Shared game utilities — extracted from common patterns across 15+ games

/** Linear interpolation between a and b by factor t (0→a, 1→b) */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value between min and max */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Euclidean distance between two points */
export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/** Smoothstep easing (0→0, 1→1 with smooth curve) */
export function smoothstep(t: number): number {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Ease out cubic */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease in out cubic */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Particle System ──

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  alpha?: number;
}

/** Update particles: apply velocity, decay life, remove dead */
export function updateParticles(particles: Particle[], dt: number): Particle[] {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  return particles.filter((p) => p.life > 0);
}

/** Draw particles to a 2D canvas context */
export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]) {
  for (const p of particles) {
    const progress = 1 - p.life / p.maxLife;
    const alpha = p.alpha !== undefined ? p.alpha * (1 - progress) : 1 - progress;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (1 - progress * 0.5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Spawn a burst of particles at a position */
export function spawnParticles(
  x: number,
  y: number,
  count: number,
  color: string,
  opts?: {
    speed?: number;
    size?: number;
    life?: number;
  }
): Particle[] {
  const speed = opts?.speed ?? 100;
  const size = opts?.size ?? 3;
  const life = opts?.life ?? 0.8;
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const spd = speed * (0.5 + Math.random() * 0.5);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: life * (0.5 + Math.random() * 0.5),
      maxLife: life,
      size: size * (0.5 + Math.random()),
      color,
    });
  }
  return particles;
}

// ── Drawing Helpers ──

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

/** Update floating text positions and life */
export function updateFloatingTexts(texts: FloatingText[], dt: number): FloatingText[] {
  for (const t of texts) {
    t.y += t.vy * dt;
    t.life -= dt;
  }
  return texts.filter((t) => t.life > 0);
}

/** Draw floating text items */
export function drawFloatingTexts(ctx: CanvasRenderingContext2D, texts: FloatingText[], fontSize = 14) {
  for (const t of texts) {
    const alpha = t.life / t.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = t.color;
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

/** Draw a rounded rectangle */
export function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
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

/** Draw a glow effect behind a shape */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  intensity = 0.3
) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color.replace(')', `,${intensity})`).replace('rgb(', 'rgba('));
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// ── Canvas DPI Setup ──

/** Set up a canvas for high-DPI displays. Returns the DPI scale factor. */
export function setupCanvasDPI(
  canvas: HTMLCanvasElement,
  width: number,
  height: number
): number {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.scale(dpr, dpr);
  return dpr;
}
