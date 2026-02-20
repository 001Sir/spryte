// Colorblind-Friendly Mode — color remapping utilities

const STORAGE_KEY = 'spryte-colorblind-mode';

export type ColorblindMode = 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';

export const colorblindModes: { value: ColorblindMode; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'Default colors' },
  { value: 'protanopia', label: 'Protanopia', description: 'Red-blind' },
  { value: 'deuteranopia', label: 'Deuteranopia', description: 'Green-blind' },
  { value: 'tritanopia', label: 'Tritanopia', description: 'Blue-blind' },
];

// Color remapping tables for each mode
// Maps common game colors to accessible alternatives
const remapTables: Record<Exclude<ColorblindMode, 'none'>, Record<string, string>> = {
  protanopia: {
    '#ef4444': '#e8a735', // red -> amber
    '#f87171': '#f0b948', // light red -> light amber
    '#dc2626': '#d69e2e', // dark red -> dark amber
    '#e94560': '#e8a735', // accent red -> amber
    '#4ade80': '#38bdf8', // green -> blue
    '#22c55e': '#0ea5e9', // green -> blue
    '#84cc16': '#38bdf8', // lime -> blue
    '#16a34a': '#0284c7', // dark green -> dark blue
    '#34d399': '#67e8f9', // teal -> cyan
  },
  deuteranopia: {
    '#4ade80': '#fbbf24', // green -> yellow
    '#22c55e': '#f59e0b', // green -> amber
    '#84cc16': '#fbbf24', // lime -> yellow
    '#16a34a': '#d97706', // dark green -> dark amber
    '#34d399': '#fcd34d', // teal -> light yellow
    '#ef4444': '#c084fc', // red -> purple
    '#f87171': '#d8b4fe', // light red -> light purple
    '#dc2626': '#a855f7', // dark red -> purple
    '#e94560': '#c084fc', // accent red -> purple
  },
  tritanopia: {
    '#3b82f6': '#f87171', // blue -> red
    '#2563eb': '#dc2626', // dark blue -> dark red
    '#38bdf8': '#fb923c', // light blue -> orange
    '#0ea5e9': '#ea580c', // cyan -> dark orange
    '#06b6d4': '#fb923c', // cyan -> orange
    '#fbbf24': '#c084fc', // yellow -> purple
    '#f59e0b': '#a855f7', // amber -> purple
    '#eab308': '#9333ea', // yellow -> dark purple
  },
};

export function getColorblindMode(): ColorblindMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && colorblindModes.some((m) => m.value === stored)) {
      return stored as ColorblindMode;
    }
  } catch {}
  return 'none';
}

export function setColorblindMode(mode: ColorblindMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new Event('spryte:colorblind-changed'));
  } catch {}
}

export function remapColor(hex: string, mode?: ColorblindMode): string {
  const m = mode ?? getColorblindMode();
  if (m === 'none') return hex;
  const table = remapTables[m];
  return table[hex.toLowerCase()] ?? hex;
}

// Pattern overlay types for shape/texture differentiation
export type PatternType = 'dots' | 'stripes' | 'crosshatch' | 'zigzag' | 'solid';

export const colorPatterns: Record<string, PatternType> = {
  red: 'stripes',
  green: 'dots',
  blue: 'crosshatch',
  yellow: 'zigzag',
  purple: 'solid',
  orange: 'dots',
  cyan: 'stripes',
  pink: 'crosshatch',
};

export function drawPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pattern: PatternType,
  color: string
) {
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;

  switch (pattern) {
    case 'dots':
      for (let dx = 4; dx < w; dx += 8) {
        for (let dy = 4; dy < h; dy += 8) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    case 'stripes':
      for (let d = -h; d < w; d += 6) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d + h, y + h);
        ctx.stroke();
      }
      break;
    case 'crosshatch':
      for (let d = -h; d < w; d += 8) {
        ctx.beginPath();
        ctx.moveTo(x + d, y);
        ctx.lineTo(x + d + h, y + h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + d + h, y);
        ctx.lineTo(x + d, y + h);
        ctx.stroke();
      }
      break;
    case 'zigzag':
      ctx.beginPath();
      for (let dx = 0; dx < w; dx += 8) {
        const dy = (dx / 8) % 2 === 0 ? 2 : h - 2;
        if (dx === 0) ctx.moveTo(x + dx, y + dy);
        else ctx.lineTo(x + dx, y + dy);
      }
      ctx.stroke();
      break;
    case 'solid':
      break;
  }

  ctx.restore();
}
