'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (open) {
      setVolume(SoundEngine.volume);
      setMuted(SoundEngine.muted);
      setCbMode(getColorblindMode());
      setConfirmClear(false);
    }
  }, [open]);

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Escape to close
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

  const handleClearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    // Clear all spryte localStorage keys
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('spryte'));
    keys.forEach((k) => localStorage.removeItem(k));
    setConfirmClear(false);
    setOpen(false);
    window.location.reload();
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 text-dim hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-white/[0.04]"
        aria-label="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-[480px] mx-4 bg-surface border border-white/[0.08] rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              role="dialog"
              aria-label="Settings"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
                <h2 className="font-bold text-lg font-[family-name:var(--font-display)]">Settings</h2>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 text-dim hover:text-foreground transition-colors rounded-lg"
                  aria-label="Close settings"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-6">
                {/* Audio section */}
                <div>
                  <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim mb-3">Audio</h3>

                  {/* Volume slider with visual feedback */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm text-muted" htmlFor="volume-slider">Volume</label>
                      <span className="text-xs text-accent-soft font-mono font-medium">{Math.round(volume * 100)}%</span>
                    </div>
                    <div className="relative">
                      <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-soft rounded-full transition-all duration-100"
                          style={{ width: `${volume * 100}%` }}
                        />
                      </div>
                      <input
                        id="volume-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={volume}
                        onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Mute toggle */}
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-muted" htmlFor="mute-toggle">Mute All Sounds</label>
                    <button
                      id="mute-toggle"
                      onClick={handleMuteToggle}
                      className={`w-11 h-6 rounded-full transition-colors relative ${
                        muted ? 'bg-accent' : 'bg-white/[0.1]'
                      }`}
                      role="switch"
                      aria-checked={muted}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                          muted ? 'translate-x-[22px]' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Accessibility section */}
                <div>
                  <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim mb-3">Accessibility</h3>
                  <label className="text-sm text-muted block mb-2" htmlFor="colorblind-select">
                    Color Vision Mode
                  </label>
                  <select
                    id="colorblind-select"
                    value={cbMode}
                    onChange={(e) => handleCbChange(e.target.value as ColorblindMode)}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-foreground appearance-none cursor-pointer focus:border-accent-soft/50 transition-colors"
                  >
                    {colorblindModes.map((mode) => (
                      <option key={mode.value} value={mode.value} className="bg-card text-foreground">
                        {mode.label} — {mode.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Data section */}
                <div>
                  <h3 className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-dim mb-3">Data</h3>
                  <p className="text-xs text-dim mb-3">
                    All data is stored locally on your device. Clearing data will reset your stats, achievements, and preferences.
                  </p>
                  <button
                    onClick={handleClearData}
                    className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      confirmClear
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
                        : 'bg-white/[0.04] text-muted border border-white/[0.06] hover:bg-white/[0.08] hover:text-foreground'
                    }`}
                  >
                    {confirmClear ? 'Are you sure? Click again to confirm' : 'Clear All Data'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
