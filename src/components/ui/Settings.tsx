'use client';

import { useState, useEffect, useRef } from 'react';
import { SoundEngine } from '@/lib/sounds';
import {
  getColorblindMode,
  setColorblindMode,
  colorblindModes,
  type ColorblindMode,
} from '@/lib/colorblind';

export default function Settings() {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [cbMode, setCbMode] = useState<ColorblindMode>('none');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVolume(SoundEngine.volume);
    setMuted(SoundEngine.muted);
    setCbMode(getColorblindMode());
  }, [open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    SoundEngine.setVolume(v);
  };

  const handleMuteToggle = () => {
    const newMuted = SoundEngine.toggleMute();
    setMuted(newMuted);
  };

  const handleCbChange = (mode: ColorblindMode) => {
    setCbMode(mode);
    setColorblindMode(mode);
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-2 text-dim hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/[0.04]"
        aria-label="Settings"
        aria-expanded={open}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-card border border-white/[0.1] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-4 z-50 animate-fade-in">
          <h3 className="font-semibold text-sm mb-4">Settings</h3>

          {/* Volume */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted" htmlFor="volume-slider">
                Sound Volume
              </label>
              <span className="text-xs text-dim font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input
              id="volume-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-white/[0.06] rounded-full appearance-none cursor-pointer accent-accent"
            />
          </div>

          {/* Mute toggle */}
          <div className="mb-4 flex items-center justify-between">
            <label className="text-xs text-muted" htmlFor="mute-toggle">
              Mute All Sounds
            </label>
            <button
              id="mute-toggle"
              onClick={handleMuteToggle}
              className={`w-10 h-5 rounded-full transition-colors relative ${
                muted ? 'bg-accent' : 'bg-white/[0.1]'
              }`}
              role="switch"
              aria-checked={muted}
            >
              <span
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  muted ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Colorblind mode */}
          <div>
            <label className="text-xs text-muted block mb-2" htmlFor="colorblind-select">
              Colorblind Mode
            </label>
            <select
              id="colorblind-select"
              value={cbMode}
              onChange={(e) => handleCbChange(e.target.value as ColorblindMode)}
              className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-foreground appearance-none cursor-pointer focus:border-accent/50 transition-colors"
            >
              {colorblindModes.map((mode) => (
                <option key={mode.value} value={mode.value} className="bg-card text-foreground">
                  {mode.label} — {mode.description}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
