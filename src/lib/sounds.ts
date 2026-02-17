// SoundEngine — Web Audio API synthesized sounds for Spryte Games
// Lazy AudioContext init, SSR-safe, Safari compat, localStorage persistence

type SoundName =
  // UI
  | 'click' | 'menuSelect' | 'menuBack'
  // Actions
  | 'launch' | 'shoot' | 'dig' | 'place' | 'remove'
  // Impacts
  | 'wallHit' | 'spikeHit' | 'enemyHit' | 'bounce' | 'playerDamage'
  // Pickups
  | 'collectGem' | 'collectOrb' | 'collectPowerup' | 'heal' | 'collectStar' | 'collectResource'
  // State
  | 'levelComplete' | 'gameOver' | 'waveStart' | 'waveClear'
  // Game-specific
  | 'portalEnter' | 'enemyFreeze' | 'enemyDeath' | 'pulse' | 'beamFire' | 'charge'
  | 'tetherLink' | 'tetherUnlink' | 'tetherKill'
  | 'flood' | 'cellUnlock'
  | 'planetCrash' | 'planetEscape' | 'asteroidSpawn' | 'solarFlare' | 'eventWarning'
  | 'wellPlace' | 'wellRemove' | 'wellAdjust'
  | 'frequencyMatch' | 'comboUp'
  | 'waterDamage' | 'lavaDeath' | 'starRating';

type OscType = OscillatorType;

interface SoundRecipe {
  play: (ctx: AudioContext, master: GainNode) => void;
}

// Helper: create an oscillator note
function osc(
  ctx: AudioContext, dest: AudioNode,
  type: OscType, freq: number,
  start: number, dur: number,
  vol: number = 0.3,
  freqEnd?: number,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    o.frequency.linearRampToValueAtTime(freqEnd, start + dur);
  }
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur);
}

// Helper: white noise burst
function noise(
  ctx: AudioContext, dest: AudioNode,
  start: number, dur: number,
  vol: number = 0.1,
) {
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(g).connect(dest);
  src.start(start);
  src.stop(start + dur);
}

// Sound recipes — all synthesized
const recipes: Record<SoundName, SoundRecipe> = {
  // === UI ===
  click: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 800, t, 0.05, 0.15);
    },
  },
  menuSelect: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.08, 0.2);
      osc(ctx, master, 'sine', 700, t + 0.06, 0.08, 0.2);
    },
  },
  menuBack: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.08, 0.15, 400);
    },
  },

  // === Actions ===
  launch: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 300, t, 0.15, 0.3, 600);
      noise(ctx, master, t, 0.08, 0.08);
    },
  },
  shoot: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 600, t, 0.08, 0.15, 200);
    },
  },
  dig: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.06, 0.15);
      osc(ctx, master, 'triangle', 200, t, 0.06, 0.1, 100);
    },
  },
  place: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 400, t, 0.1, 0.2, 500);
    },
  },
  remove: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.1, 0.15, 300);
    },
  },

  // === Impacts ===
  wallHit: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.06, 0.12);
      osc(ctx, master, 'triangle', 200, t, 0.06, 0.1, 120);
    },
  },
  spikeHit: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.12, 0.2);
      osc(ctx, master, 'sawtooth', 150, t, 0.15, 0.15, 60);
    },
  },
  enemyHit: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 300, t, 0.06, 0.15, 150);
      noise(ctx, master, t, 0.04, 0.06);
    },
  },
  bounce: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 400, t, 0.1, 0.2, 600);
    },
  },
  playerDamage: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.15, 0.15);
      osc(ctx, master, 'sawtooth', 200, t, 0.15, 0.2, 80);
    },
  },

  // === Pickups ===
  collectGem: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 800, t, 0.06, 0.2);
      osc(ctx, master, 'sine', 1200, t + 0.06, 0.08, 0.15);
    },
  },
  collectOrb: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.06, 0.18);
      osc(ctx, master, 'sine', 900, t + 0.05, 0.06, 0.12);
    },
  },
  collectPowerup: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.06, 0.2);
      osc(ctx, master, 'sine', 700, t + 0.06, 0.06, 0.2);
      osc(ctx, master, 'sine', 1000, t + 0.12, 0.1, 0.2);
    },
  },
  heal: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 400, t, 0.12, 0.2, 800);
    },
  },
  collectStar: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 1000, t, 0.05, 0.2);
      osc(ctx, master, 'sine', 1400, t + 0.05, 0.08, 0.15);
    },
  },
  collectResource: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'triangle', 500, t, 0.06, 0.15);
      osc(ctx, master, 'triangle', 750, t + 0.05, 0.06, 0.12);
    },
  },

  // === State ===
  levelComplete: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.12, 0.2);
      osc(ctx, master, 'sine', 650, t + 0.1, 0.12, 0.2);
      osc(ctx, master, 'sine', 800, t + 0.2, 0.12, 0.2);
      osc(ctx, master, 'sine', 1000, t + 0.3, 0.2, 0.25);
    },
  },
  gameOver: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 400, t, 0.2, 0.2, 200);
      osc(ctx, master, 'sine', 300, t + 0.2, 0.3, 0.15, 100);
      noise(ctx, master, t + 0.1, 0.15, 0.05);
    },
  },
  waveStart: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 300, t, 0.1, 0.15, 500);
      osc(ctx, master, 'sine', 500, t + 0.1, 0.15, 0.15, 700);
    },
  },
  waveClear: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.1, 0.2);
      osc(ctx, master, 'sine', 800, t + 0.08, 0.1, 0.2);
      osc(ctx, master, 'sine', 1000, t + 0.16, 0.15, 0.2);
    },
  },

  // === Game-specific ===
  portalEnter: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.2, 0.15, 1200);
      osc(ctx, master, 'sine', 300, t + 0.05, 0.2, 0.1, 600);
    },
  },
  enemyFreeze: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 1000, t, 0.15, 0.15, 2000);
      osc(ctx, master, 'triangle', 1500, t + 0.05, 0.1, 0.08);
    },
  },
  enemyDeath: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.1, 0.12);
      osc(ctx, master, 'square', 400, t, 0.08, 0.15, 100);
      osc(ctx, master, 'sine', 800, t + 0.05, 0.08, 0.1);
    },
  },
  pulse: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 300, t, 0.2, 0.15, 100);
      osc(ctx, master, 'triangle', 200, t + 0.05, 0.15, 0.08);
    },
  },
  beamFire: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sawtooth', 200, t, 0.15, 0.1, 300);
      osc(ctx, master, 'sine', 400, t, 0.15, 0.05);
    },
  },
  charge: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 200, t, 0.2, 0.1, 500);
    },
  },
  tetherLink: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.08, 0.2);
      osc(ctx, master, 'sine', 800, t + 0.06, 0.08, 0.15);
    },
  },
  tetherUnlink: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 700, t, 0.08, 0.15, 400);
    },
  },
  tetherKill: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 500, t, 0.06, 0.2, 200);
      noise(ctx, master, t, 0.06, 0.08);
      osc(ctx, master, 'sine', 900, t + 0.04, 0.06, 0.1);
    },
  },
  flood: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 300, t, 0.12, 0.15, 500);
      osc(ctx, master, 'triangle', 250, t + 0.03, 0.1, 0.08);
    },
  },
  cellUnlock: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 800, t, 0.06, 0.2);
      osc(ctx, master, 'sine', 1100, t + 0.05, 0.08, 0.15);
    },
  },
  planetCrash: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.3, 0.2);
      osc(ctx, master, 'sawtooth', 100, t, 0.3, 0.2, 40);
      osc(ctx, master, 'sine', 200, t, 0.2, 0.15, 60);
    },
  },
  planetEscape: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 400, t, 0.2, 0.15, 800);
      noise(ctx, master, t + 0.1, 0.1, 0.05);
    },
  },
  asteroidSpawn: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.08, 0.08);
      osc(ctx, master, 'triangle', 150, t, 0.1, 0.1, 80);
    },
  },
  solarFlare: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sawtooth', 100, t, 0.3, 0.15, 300);
      noise(ctx, master, t, 0.2, 0.1);
      osc(ctx, master, 'sine', 200, t + 0.1, 0.2, 0.1, 500);
    },
  },
  eventWarning: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 600, t, 0.1, 0.15);
      osc(ctx, master, 'square', 600, t + 0.15, 0.1, 0.15);
      osc(ctx, master, 'square', 600, t + 0.3, 0.1, 0.15);
    },
  },
  wellPlace: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 350, t, 0.1, 0.2, 550);
      osc(ctx, master, 'triangle', 400, t + 0.05, 0.08, 0.1);
    },
  },
  wellRemove: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 550, t, 0.1, 0.15, 300);
    },
  },
  wellAdjust: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.06, 0.1);
    },
  },
  frequencyMatch: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 700, t, 0.06, 0.2);
      osc(ctx, master, 'sine', 1050, t + 0.05, 0.08, 0.2);
      osc(ctx, master, 'sine', 1400, t + 0.1, 0.1, 0.15);
    },
  },
  comboUp: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.05, 0.15);
      osc(ctx, master, 'sine', 800, t + 0.05, 0.05, 0.15);
      osc(ctx, master, 'sine', 1000, t + 0.1, 0.08, 0.2);
    },
  },
  waterDamage: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.1, 0.08);
      osc(ctx, master, 'sine', 250, t, 0.12, 0.12, 150);
    },
  },
  lavaDeath: {
    play(ctx, master) {
      const t = ctx.currentTime;
      noise(ctx, master, t, 0.2, 0.15);
      osc(ctx, master, 'sawtooth', 150, t, 0.2, 0.2, 50);
      osc(ctx, master, 'sine', 300, t + 0.05, 0.15, 0.1, 80);
    },
  },
  starRating: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 900, t, 0.08, 0.2);
      osc(ctx, master, 'sine', 1200, t + 0.07, 0.1, 0.15);
    },
  },
};

// Loopable sounds use repeated scheduling
const LOOP_SOUNDS: Set<SoundName> = new Set(['beamFire', 'charge']);

class _SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _volume: number = 0.5;
  private _muted: boolean = false;
  private cooldowns: Map<string, number> = new Map();
  private loopTimers: Map<string, number> = new Map();
  private static COOLDOWN_MS = 30;

  constructor() {
    // Load persisted settings (SSR-safe)
    if (typeof window !== 'undefined') {
      try {
        const vol = localStorage.getItem('spryte-sound-volume');
        if (vol !== null) this._volume = parseFloat(vol);
        const muted = localStorage.getItem('spryte-sound-muted');
        if (muted !== null) this._muted = muted === 'true';
      } catch {
        // localStorage unavailable
      }
    }
  }

  private init() {
    if (this.ctx) return;
    const AC = (typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((window as any).AudioContext || (window as any).webkitAudioContext)) as typeof AudioContext | undefined;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.setValueAtTime(this._muted ? 0 : this._volume, this.ctx.currentTime);
    this.master.connect(this.ctx.destination);
  }

  /** Call on first user gesture to ensure AudioContext is running */
  ensureResumed() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(name: SoundName) {
    if (this._muted) return;
    this.init();
    if (!this.ctx || !this.master) return;

    // Cooldown check
    const now = performance.now();
    const last = this.cooldowns.get(name) || 0;
    if (now - last < _SoundEngine.COOLDOWN_MS) return;
    this.cooldowns.set(name, now);

    // Resume if suspended (safety net)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const recipe = recipes[name];
    if (recipe) {
      recipe.play(this.ctx, this.master);
    }
  }

  startLoop(name: SoundName) {
    if (!LOOP_SOUNDS.has(name)) return;
    if (this.loopTimers.has(name)) return; // already looping

    const tick = () => {
      this.play(name);
    };
    tick();
    const interval = window.setInterval(tick, 180);
    this.loopTimers.set(name, interval);
  }

  stopLoop(name: SoundName) {
    const timer = this.loopTimers.get(name);
    if (timer !== undefined) {
      clearInterval(timer);
      this.loopTimers.delete(name);
    }
  }

  stopAllLoops() {
    this.loopTimers.forEach((timer) => clearInterval(timer));
    this.loopTimers.clear();
  }

  get muted() {
    return this._muted;
  }

  setMuted(muted: boolean) {
    this._muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setValueAtTime(muted ? 0 : this._volume, this.ctx.currentTime);
    }
    if (muted) {
      this.stopAllLoops();
    }
    try {
      localStorage.setItem('spryte-sound-muted', String(muted));
    } catch {
      // ignore
    }
  }

  toggleMute() {
    this.setMuted(!this._muted);
    return this._muted;
  }

  get volume() {
    return this._volume;
  }

  setVolume(vol: number) {
    this._volume = Math.max(0, Math.min(1, vol));
    if (!this._muted && this.master && this.ctx) {
      this.master.gain.setValueAtTime(this._volume, this.ctx.currentTime);
    }
    try {
      localStorage.setItem('spryte-sound-volume', String(this._volume));
    } catch {
      // ignore
    }
  }
}

// Singleton — SSR-safe: instance is created but AudioContext is not init'd until first play/ensureResumed
export const SoundEngine = new _SoundEngine();
