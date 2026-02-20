'use client';

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'spryte-particles-enabled';

function getStoredPref(): boolean {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    if (val !== null) return val === 'true';
    // Default: disabled if user prefers reduced motion
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return true;
  }
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  o: number;
}

export default function Particles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [enabled, setEnabled] = useState(true);
  const animIdRef = useRef<number>(0);

  // Hydrate from localStorage
  useEffect(() => {
    setEnabled(getStoredPref());
  }, []);

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!enabled) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);

    const COUNT = 60;
    const CONNECTION_DIST = 120;
    const particles: Particle[] = [];

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        o: Math.random() * 0.3 + 0.1,
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.06;
            ctx!.strokeStyle = `rgba(124, 58, 237, ${alpha})`;
            ctx!.lineWidth = 0.5;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }

      for (const p of particles) {
        ctx!.fillStyle = `rgba(233, 69, 96, ${p.o})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function update() {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      }
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      draw();
      return;
    }

    function loop() {
      update();
      draw();
      animIdRef.current = requestAnimationFrame(loop);
    }
    animIdRef.current = requestAnimationFrame(loop);

    const onResize = () => {
      w = canvas!.width = window.innerWidth;
      h = canvas!.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [enabled]);

  return (
    <>
      <canvas ref={canvasRef} className="particles-canvas" aria-hidden="true" />
      <button
        onClick={toggle}
        className="fixed bottom-6 left-6 z-40 frosted-glass border border-white/[0.06] hover:border-white/[0.12] text-dim hover:text-muted p-2.5 rounded-full shadow-lg transition-all duration-300 hover:scale-110 group/particles"
        aria-label={enabled ? 'Disable background particles' : 'Enable background particles'}
        title={enabled ? 'Disable particles' : 'Enable particles'}
      >
        {enabled ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="1" />
            <circle cx="4" cy="8" r="1" />
            <circle cx="20" cy="8" r="1" />
            <circle cx="7" cy="18" r="1" />
            <circle cx="17" cy="18" r="1" />
            <path d="M4 8l8 4M20 8l-8 4M7 18l5-6M17 18l-5-6" opacity="0.4" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="1" />
            <circle cx="4" cy="8" r="1" />
            <circle cx="20" cy="8" r="1" />
            <circle cx="7" cy="18" r="1" />
            <circle cx="17" cy="18" r="1" />
            <path d="M2 2l20 20" strokeWidth="2.5" />
          </svg>
        )}
      </button>
    </>
  );
}
