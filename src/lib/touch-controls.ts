// TouchController — Canvas-rendered virtual D-pad & action button for mobile games
// Reusable overlay: D-pad (bottom-left) + Action button (bottom-right)
// Multi-touch aware, SSR-safe, only renders on touch-capable devices

// ─── Touch Detection ─────────────────────────────────────────────

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window;
}

// ─── State Interface ─────────────────────────────────────────────

export interface DPadState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean;
}

// ─── Geometry Helpers ────────────────────────────────────────────

interface Circle {
  cx: number;
  cy: number;
  r: number;
}

function pointInCircle(px: number, py: number, circle: Circle): boolean {
  const dx = px - circle.cx;
  const dy = py - circle.cy;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

/** Convert a canvas-space touch to the logical coordinate system */
function canvasTouchPos(
  canvas: HTMLCanvasElement,
  touch: Touch,
  logicalW: number,
  logicalH: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = logicalW / rect.width;
  const scaleY = logicalH / rect.height;
  return {
    x: (touch.clientX - rect.left) * scaleX,
    y: (touch.clientY - rect.top) * scaleY,
  };
}

// ─── Constants ───────────────────────────────────────────────────

const DPAD_RADIUS = 60;       // 120px diameter
const DPAD_MARGIN = 30;       // distance from edges
const DPAD_DEAD_ZONE = 12;    // px — ignore tiny movements in center

const ACTION_RADIUS = 30;     // 60px diameter
const ACTION_MARGIN = 30;

const OVERLAY_ALPHA = 0.3;
const PRESSED_ALPHA = 0.5;

// ─── TouchController ────────────────────────────────────────────

export class TouchController {
  state: DPadState = {
    up: false,
    down: false,
    left: false,
    right: false,
    action: false,
  };

  private canvas: HTMLCanvasElement;
  private enabled: boolean;

  // Bound handlers (so we can remove them later)
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchMove: (e: TouchEvent) => void;
  private onTouchEnd: (e: TouchEvent) => void;

  // Track last-known logical canvas dimensions for touch mapping
  private lastW = 0;
  private lastH = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.enabled = isTouchDevice();

    // Bind event handlers
    this.onTouchStart = (e) => this.handleTouches(e);
    this.onTouchMove = (e) => this.handleTouches(e);
    this.onTouchEnd = (e) => this.handleTouches(e);

    if (this.enabled) {
      canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
      canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
      canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
      canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    }
  }

  // ── Geometry (recomputed each frame from canvas dimensions) ──

  private dpadCircle(cw: number, ch: number): Circle {
    return {
      cx: DPAD_MARGIN + DPAD_RADIUS,
      cy: ch - DPAD_MARGIN - DPAD_RADIUS,
      r: DPAD_RADIUS,
    };
  }

  private actionCircle(cw: number, ch: number): Circle {
    return {
      cx: cw - ACTION_MARGIN - ACTION_RADIUS,
      cy: ch - ACTION_MARGIN - ACTION_RADIUS,
      r: ACTION_RADIUS,
    };
  }

  // ── Touch Processing ──────────────────────────────────────────

  private handleTouches(e: TouchEvent): void {
    e.preventDefault();

    const cw = this.lastW || this.canvas.width;
    const ch = this.lastH || this.canvas.height;
    const dpad = this.dpadCircle(cw, ch);
    const action = this.actionCircle(cw, ch);

    // Reset state — we rebuild from all current touches
    this.state.up = false;
    this.state.down = false;
    this.state.left = false;
    this.state.right = false;
    this.state.action = false;

    const touches = e.touches; // all fingers currently down
    for (let i = 0; i < touches.length; i++) {
      const pos = canvasTouchPos(this.canvas, touches[i], cw, ch);

      // Check action button
      if (pointInCircle(pos.x, pos.y, action)) {
        this.state.action = true;
        continue;
      }

      // Check d-pad (use a slightly larger hit area for comfort)
      const hitRadius = DPAD_RADIUS * 1.3;
      const dx = pos.x - dpad.cx;
      const dy = pos.y - dpad.cy;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        // Inside d-pad zone — determine direction(s)
        if (Math.abs(dx) < DPAD_DEAD_ZONE && Math.abs(dy) < DPAD_DEAD_ZONE) {
          // Dead zone center — no direction
          continue;
        }
        const angle = Math.atan2(dy, dx); // radians, 0 = right

        // Allow diagonal by checking overlapping 90-degree sectors with some tolerance
        // Each cardinal is a 120-degree arc centered on its direction
        const ARC = Math.PI / 3; // 60 degrees each side of cardinal = 120-degree arc

        // Right: angle ∈ (-ARC, +ARC)
        if (angle > -ARC && angle < ARC) this.state.right = true;
        // Down: angle ∈ (PI/2 - ARC, PI/2 + ARC)
        if (angle > Math.PI / 2 - ARC && angle < Math.PI / 2 + ARC) this.state.down = true;
        // Left: angle < -(PI - ARC) || angle > (PI - ARC)
        if (angle > Math.PI - ARC || angle < -(Math.PI - ARC)) this.state.left = true;
        // Up: angle ∈ (-PI/2 - ARC, -PI/2 + ARC)
        if (angle > -Math.PI / 2 - ARC && angle < -Math.PI / 2 + ARC) this.state.up = true;
      }
    }
  }

  // ── Rendering ─────────────────────────────────────────────────

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    if (!this.enabled) return;

    // Cache dimensions for touch mapping
    this.lastW = canvasWidth;
    this.lastH = canvasHeight;

    ctx.save();

    this.drawDPad(ctx, canvasWidth, canvasHeight);
    this.drawActionButton(ctx, canvasWidth, canvasHeight);

    ctx.restore();
  }

  private drawDPad(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
    const { cx, cy, r } = this.dpadCircle(cw, ch);

    // Background circle
    ctx.globalAlpha = OVERLAY_ALPHA;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.globalAlpha = OVERLAY_ALPHA + 0.1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Arrow indicators
    const arrowOffset = r * 0.55;
    const arrowSize = r * 0.22;

    // Up arrow
    this.drawArrow(ctx, cx, cy - arrowOffset, arrowSize, 'up', this.state.up);
    // Down arrow
    this.drawArrow(ctx, cx, cy + arrowOffset, arrowSize, 'down', this.state.down);
    // Left arrow
    this.drawArrow(ctx, cx - arrowOffset, cy, arrowSize, 'left', this.state.left);
    // Right arrow
    this.drawArrow(ctx, cx + arrowOffset, cy, arrowSize, 'right', this.state.right);
  }

  private drawArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    dir: 'up' | 'down' | 'left' | 'right',
    pressed: boolean,
  ): void {
    ctx.globalAlpha = pressed ? PRESSED_ALPHA + 0.3 : OVERLAY_ALPHA + 0.2;
    ctx.fillStyle = pressed ? '#00ccff' : '#ffffff';

    ctx.beginPath();
    switch (dir) {
      case 'up':
        ctx.moveTo(x, y - size);
        ctx.lineTo(x - size, y + size * 0.5);
        ctx.lineTo(x + size, y + size * 0.5);
        break;
      case 'down':
        ctx.moveTo(x, y + size);
        ctx.lineTo(x - size, y - size * 0.5);
        ctx.lineTo(x + size, y - size * 0.5);
        break;
      case 'left':
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size * 0.5, y - size);
        ctx.lineTo(x + size * 0.5, y + size);
        break;
      case 'right':
        ctx.moveTo(x + size, y);
        ctx.lineTo(x - size * 0.5, y - size);
        ctx.lineTo(x - size * 0.5, y + size);
        break;
    }
    ctx.closePath();
    ctx.fill();
  }

  private drawActionButton(ctx: CanvasRenderingContext2D, cw: number, ch: number): void {
    const { cx, cy, r } = this.actionCircle(cw, ch);
    const pressed = this.state.action;

    // Background circle
    ctx.globalAlpha = pressed ? PRESSED_ALPHA : OVERLAY_ALPHA;
    ctx.fillStyle = pressed ? '#00ccff' : '#ffffff';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring
    ctx.globalAlpha = (pressed ? PRESSED_ALPHA : OVERLAY_ALPHA) + 0.15;
    ctx.strokeStyle = pressed ? '#00ccff' : '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // "A" label
    ctx.globalAlpha = pressed ? 0.95 : 0.7;
    ctx.fillStyle = pressed ? '#003344' : '#ffffff';
    ctx.font = `bold ${Math.round(r * 0.9)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', cx, cy + 1);
  }

  // ── Cleanup ───────────────────────────────────────────────────

  destroy(): void {
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
  }
}
