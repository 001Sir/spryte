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
  | 'waterDamage' | 'lavaDeath' | 'starRating'
  // Memory / Quiz games (Déjà Vu, Spectrum, What's Missing)
  | 'shapeReveal' | 'memoryRecall' | 'decoyCatch' | 'wrongGuess' | 'timeDrain' | 'tickWarning'
  | 'estimateSlide' | 'lockIn' | 'bullseye' | 'nerveChain'
  // Slide Devil
  | 'trollActivate' | 'gravityFlip' | 'floorCrumble'
  // Shared
  | 'streakRise' | 'victoryFanfare' | 'newHighScore';

type AmbientTheme =
  | 'space-gravity' | 'colorful-puzzle' | 'dark-cave' | 'underground'
  | 'synth-combat' | 'cosmic-orbit' | 'organic' | 'quiz-ambient'
  | 'memory-ethereal' | 'missing-tension' | 'slide-chaos';

type OscType = OscillatorType;

interface SoundRecipe {
  play: (ctx: AudioContext, master: GainNode) => void;
}

// ─── Helpers ───────────────────────────────────────────────

/** Basic oscillator with envelope */
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

/** White noise burst */
function noise(
  ctx: AudioContext, dest: AudioNode,
  start: number, dur: number,
  vol: number = 0.1,
) {
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  if (bufferSize <= 0) return;
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

/** Noise through a BiquadFilter for shaped textures */
function filteredNoise(
  ctx: AudioContext, dest: AudioNode,
  filterType: BiquadFilterType, filterFreq: number,
  start: number, dur: number,
  vol: number = 0.1, q: number = 1,
) {
  const bufferSize = Math.floor(ctx.sampleRate * dur);
  if (bufferSize <= 0) return;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, start);
  filter.Q.setValueAtTime(q, start);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  src.connect(filter).connect(g).connect(dest);
  src.start(start);
  src.stop(start + dur);
}

/** Multiple detuned oscillators for rich chords */
function chord(
  ctx: AudioContext, dest: AudioNode,
  type: OscType, freqs: number[],
  start: number, dur: number,
  vol: number = 0.15,
  filterFreq?: number,
) {
  let target: AudioNode = dest;
  if (filterFreq) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(filterFreq, start);
    lp.connect(dest);
    target = lp;
  }
  const perVol = vol / Math.max(freqs.length, 1);
  for (const f of freqs) {
    osc(ctx, target, type, f, start, dur, perVol);
    // Slight detune for width
    osc(ctx, target, type, f * 1.003, start, dur, perVol * 0.5);
  }
}

/** Frequency sweep with optional filter */
function sweep(
  ctx: AudioContext, dest: AudioNode,
  type: OscType, startFreq: number, endFreq: number,
  start: number, dur: number,
  vol: number = 0.2,
  filterType?: BiquadFilterType, filterFreq?: number,
) {
  let target: AudioNode = dest;
  if (filterType && filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(filterFreq, start);
    f.connect(dest);
    target = f;
  }
  osc(ctx, target, type, startFreq, start, dur, vol, endFreq);
}

/** Oscillator with attack/sustain/release envelope */
function oscASR(
  ctx: AudioContext, dest: AudioNode,
  type: OscType, freq: number,
  start: number, attack: number, sustain: number, release: number,
  vol: number = 0.3,
  freqEnd?: number,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (freqEnd !== undefined) {
    o.frequency.linearRampToValueAtTime(freqEnd, start + attack + sustain + release);
  }
  const dur = attack + sustain + release;
  g.gain.setValueAtTime(0.001, start);
  g.gain.linearRampToValueAtTime(vol, start + attack);
  g.gain.setValueAtTime(vol, start + attack + sustain);
  g.gain.exponentialRampToValueAtTime(0.001, start + dur);
  o.connect(g).connect(dest);
  o.start(start);
  o.stop(start + dur + 0.01);
}

// ─── Sound Recipes ─────────────────────────────────────────

const recipes: Record<SoundName, SoundRecipe> = {
  // === UI ===
  click: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 800, t, 0.05, 0.12);
      osc(ctx, master, 'triangle', 1600, t, 0.03, 0.04);
      filteredNoise(ctx, master, 'highpass', 4000, t, 0.02, 0.03);
    },
  },
  menuSelect: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 440, t, 0.08, 0.18);
      osc(ctx, master, 'sine', 660, t + 0.05, 0.08, 0.18);
      osc(ctx, master, 'triangle', 880, t + 0.05, 0.06, 0.06);
      osc(ctx, master, 'sine', 442, t, 0.08, 0.08); // detune shimmer
    },
  },
  menuBack: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.1, 0.15, 350);
      osc(ctx, master, 'triangle', 300, t + 0.03, 0.08, 0.06);
      filteredNoise(ctx, master, 'lowpass', 800, t + 0.02, 0.04, 0.03);
    },
  },

  // === Actions ===
  launch: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 220, 880, t, 0.18, 0.25);
      osc(ctx, master, 'triangle', 440, t, 0.12, 0.08);
      filteredNoise(ctx, master, 'bandpass', 2000, t, 0.1, 0.1, 2);
      osc(ctx, master, 'sine', 110, t, 0.08, 0.12); // sub thump
    },
  },
  shoot: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'square', 800, 200, t, 0.1, 0.15, 'lowpass', 3000);
      osc(ctx, master, 'sine', 400, t, 0.04, 0.08);
      filteredNoise(ctx, master, 'highpass', 3000, t, 0.05, 0.06);
    },
  },
  dig: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'bandpass', 800, t, 0.08, 0.15, 3);
      osc(ctx, master, 'triangle', 180, t, 0.06, 0.1, 90);
      osc(ctx, master, 'sine', 90, t, 0.05, 0.08); // earthy sub
      filteredNoise(ctx, master, 'lowpass', 400, t + 0.03, 0.05, 0.06);
    },
  },
  place: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 350, t, 0.08, 0.18, 520);
      osc(ctx, master, 'triangle', 700, t + 0.02, 0.06, 0.06);
      osc(ctx, master, 'sine', 175, t, 0.06, 0.08); // sub
      filteredNoise(ctx, master, 'lowpass', 600, t, 0.03, 0.04);
    },
  },
  remove: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 520, t, 0.1, 0.15, 260);
      osc(ctx, master, 'triangle', 260, t + 0.03, 0.08, 0.06);
      filteredNoise(ctx, master, 'highpass', 2000, t, 0.04, 0.04);
    },
  },

  // === Impacts ===
  wallHit: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'lowpass', 1200, t, 0.08, 0.15, 2);
      osc(ctx, master, 'triangle', 180, t, 0.06, 0.12, 100);
      osc(ctx, master, 'sine', 80, t, 0.05, 0.1); // sub impact
      osc(ctx, master, 'square', 350, t, 0.02, 0.04);
    },
  },
  spikeHit: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'bandpass', 2500, t, 0.15, 0.2, 4);
      osc(ctx, master, 'sawtooth', 120, t, 0.18, 0.15, 50);
      osc(ctx, master, 'sine', 60, t, 0.12, 0.12); // sub
      osc(ctx, master, 'square', 300, t, 0.04, 0.06, 150);
      filteredNoise(ctx, master, 'highpass', 5000, t, 0.06, 0.05);
    },
  },
  enemyHit: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 280, t, 0.06, 0.15, 140);
      osc(ctx, master, 'sine', 560, t, 0.04, 0.06);
      filteredNoise(ctx, master, 'bandpass', 1500, t, 0.05, 0.08, 3);
      osc(ctx, master, 'sine', 70, t, 0.04, 0.08); // sub punch
    },
  },
  bounce: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 350, t, 0.1, 0.2, 700);
      osc(ctx, master, 'triangle', 700, t + 0.02, 0.06, 0.06);
      osc(ctx, master, 'sine', 175, t, 0.05, 0.08); // sub
      filteredNoise(ctx, master, 'lowpass', 1000, t, 0.03, 0.03);
    },
  },
  playerDamage: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'lowpass', 1500, t, 0.18, 0.18, 2);
      osc(ctx, master, 'sawtooth', 180, t, 0.18, 0.2, 70);
      osc(ctx, master, 'sine', 60, t, 0.15, 0.15); // deep sub
      osc(ctx, master, 'square', 250, t + 0.02, 0.08, 0.06, 120);
      filteredNoise(ctx, master, 'highpass', 3000, t + 0.05, 0.08, 0.04);
    },
  },

  // === Pickups ===
  collectGem: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [800, 1200, 1600], t, 0.12, 0.18);
      osc(ctx, master, 'triangle', 2400, t + 0.04, 0.06, 0.04); // sparkle
      osc(ctx, master, 'sine', 3200, t + 0.06, 0.04, 0.02); // high shimmer
    },
  },
  collectOrb: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.08, 0.18);
      osc(ctx, master, 'sine', 900, t + 0.04, 0.08, 0.14);
      osc(ctx, master, 'triangle', 1200, t + 0.06, 0.06, 0.06);
      osc(ctx, master, 'sine', 602, t, 0.08, 0.06); // detune warmth
    },
  },
  collectPowerup: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [500, 700, 1000], t, 0.08, 0.2);
      osc(ctx, master, 'sine', 1400, t + 0.08, 0.08, 0.12);
      osc(ctx, master, 'triangle', 2000, t + 0.12, 0.06, 0.05); // sparkle
      osc(ctx, master, 'sine', 250, t, 0.06, 0.08); // warm sub
    },
  },
  heal: {
    play(ctx, master) {
      const t = ctx.currentTime;
      oscASR(ctx, master, 'sine', 400, t, 0.04, 0.06, 0.12, 0.2, 800);
      osc(ctx, master, 'triangle', 800, t + 0.03, 0.1, 0.06);
      osc(ctx, master, 'sine', 1200, t + 0.06, 0.08, 0.04); // shimmer
      filteredNoise(ctx, master, 'lowpass', 600, t + 0.05, 0.08, 0.02);
    },
  },
  collectStar: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 1000, t, 0.05, 0.2);
      osc(ctx, master, 'sine', 1500, t + 0.04, 0.06, 0.15);
      osc(ctx, master, 'triangle', 2000, t + 0.07, 0.05, 0.06); // sparkle
      osc(ctx, master, 'sine', 3000, t + 0.09, 0.04, 0.03); // high shimmer
      osc(ctx, master, 'sine', 1002, t, 0.05, 0.06); // detune
    },
  },
  collectResource: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'triangle', 500, t, 0.08, 0.15);
      osc(ctx, master, 'triangle', 750, t + 0.04, 0.08, 0.12);
      osc(ctx, master, 'sine', 1000, t + 0.07, 0.06, 0.06);
      osc(ctx, master, 'sine', 250, t, 0.04, 0.06); // warm sub
    },
  },

  // === State ===
  levelComplete: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [523, 659, 784], t, 0.15, 0.2);
      chord(ctx, master, 'sine', [659, 784, 1047], t + 0.15, 0.15, 0.2);
      osc(ctx, master, 'sine', 1047, t + 0.3, 0.25, 0.25);
      osc(ctx, master, 'triangle', 2094, t + 0.35, 0.12, 0.04); // shimmer
      osc(ctx, master, 'sine', 262, t, 0.1, 0.08); // warm bass
    },
  },
  gameOver: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [400, 475], t, 0.25, 0.18, 800);
      osc(ctx, master, 'sine', 300, t + 0.2, 0.35, 0.15, 80);
      osc(ctx, master, 'sine', 60, t, 0.2, 0.1); // dark sub
      filteredNoise(ctx, master, 'lowpass', 400, t + 0.1, 0.2, 0.04);
    },
  },
  waveStart: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 300, 600, t, 0.15, 0.18);
      osc(ctx, master, 'triangle', 600, t + 0.08, 0.12, 0.08);
      osc(ctx, master, 'sine', 150, t, 0.06, 0.08); // sub
      filteredNoise(ctx, master, 'bandpass', 3000, t + 0.1, 0.06, 0.03);
    },
  },
  waveClear: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [600, 800, 1000], t, 0.12, 0.2);
      osc(ctx, master, 'triangle', 1500, t + 0.1, 0.08, 0.06);
      osc(ctx, master, 'sine', 2000, t + 0.14, 0.06, 0.03); // sparkle
      osc(ctx, master, 'sine', 300, t, 0.06, 0.06); // warm base
    },
  },

  // === Game-specific ===
  portalEnter: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 400, 1600, t, 0.25, 0.15);
      sweep(ctx, master, 'sine', 200, 800, t + 0.03, 0.22, 0.08);
      osc(ctx, master, 'triangle', 1200, t + 0.1, 0.12, 0.04); // shimmer
      filteredNoise(ctx, master, 'bandpass', 3000, t, 0.15, 0.05, 5);
    },
  },
  enemyFreeze: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 800, 2500, t, 0.15, 0.15);
      osc(ctx, master, 'triangle', 1800, t + 0.03, 0.12, 0.06);
      filteredNoise(ctx, master, 'highpass', 6000, t, 0.1, 0.06);
      osc(ctx, master, 'sine', 2500, t + 0.08, 0.08, 0.03); // ice sparkle
    },
  },
  enemyDeath: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'bandpass', 1500, t, 0.12, 0.15, 3);
      osc(ctx, master, 'square', 400, t, 0.08, 0.12, 100);
      osc(ctx, master, 'sine', 800, t + 0.03, 0.08, 0.08);
      osc(ctx, master, 'sine', 60, t, 0.06, 0.1); // sub thud
      filteredNoise(ctx, master, 'highpass', 4000, t + 0.04, 0.06, 0.04);
    },
  },
  pulse: {
    play(ctx, master) {
      const t = ctx.currentTime;
      oscASR(ctx, master, 'sine', 250, t, 0.03, 0.08, 0.12, 0.18, 100);
      osc(ctx, master, 'triangle', 180, t + 0.03, 0.12, 0.08);
      osc(ctx, master, 'sine', 80, t, 0.08, 0.1); // deep pulse sub
      filteredNoise(ctx, master, 'lowpass', 500, t + 0.05, 0.08, 0.03);
    },
  },
  beamFire: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sawtooth', 200, t, 0.15, 0.08, 350);
      osc(ctx, master, 'sine', 400, t, 0.12, 0.05);
      osc(ctx, master, 'triangle', 600, t + 0.02, 0.08, 0.03);
      filteredNoise(ctx, master, 'bandpass', 2000, t, 0.08, 0.04, 3);
    },
  },
  charge: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 180, 600, t, 0.22, 0.12);
      osc(ctx, master, 'triangle', 360, t + 0.05, 0.12, 0.04);
      filteredNoise(ctx, master, 'lowpass', 800, t, 0.12, 0.03);
    },
  },
  tetherLink: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.08, 0.2);
      osc(ctx, master, 'sine', 750, t + 0.04, 0.08, 0.15);
      osc(ctx, master, 'triangle', 1000, t + 0.06, 0.06, 0.06); // sparkle
      osc(ctx, master, 'sine', 502, t, 0.08, 0.06); // detune
    },
  },
  tetherUnlink: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 700, t, 0.1, 0.15, 350);
      osc(ctx, master, 'triangle', 350, t + 0.04, 0.08, 0.06);
      filteredNoise(ctx, master, 'highpass', 2000, t, 0.04, 0.04);
    },
  },
  tetherKill: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 500, t, 0.06, 0.18, 180);
      filteredNoise(ctx, master, 'bandpass', 1500, t, 0.08, 0.1, 3);
      osc(ctx, master, 'sine', 900, t + 0.03, 0.06, 0.08);
      osc(ctx, master, 'sine', 60, t, 0.05, 0.08); // sub thump
    },
  },
  flood: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 280, 560, t, 0.15, 0.15);
      osc(ctx, master, 'triangle', 220, t + 0.02, 0.1, 0.08);
      filteredNoise(ctx, master, 'lowpass', 600, t, 0.1, 0.06);
      osc(ctx, master, 'sine', 140, t, 0.06, 0.06); // warm sub
    },
  },
  cellUnlock: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 800, t, 0.06, 0.2);
      osc(ctx, master, 'sine', 1200, t + 0.04, 0.08, 0.15);
      osc(ctx, master, 'triangle', 1600, t + 0.07, 0.06, 0.06); // sparkle
      osc(ctx, master, 'sine', 802, t, 0.06, 0.06); // detune
    },
  },
  planetCrash: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'lowpass', 800, t, 0.35, 0.22, 2);
      osc(ctx, master, 'sawtooth', 80, t, 0.35, 0.2, 30);
      osc(ctx, master, 'sine', 40, t, 0.3, 0.18); // massive sub
      osc(ctx, master, 'sine', 160, t + 0.05, 0.2, 0.1, 50);
      filteredNoise(ctx, master, 'bandpass', 2000, t + 0.1, 0.15, 0.06, 3);
    },
  },
  planetEscape: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 350, 1000, t, 0.25, 0.18);
      osc(ctx, master, 'triangle', 700, t + 0.08, 0.12, 0.06);
      filteredNoise(ctx, master, 'bandpass', 3000, t + 0.1, 0.1, 0.04, 4);
      osc(ctx, master, 'sine', 175, t, 0.08, 0.06); // launch sub
    },
  },
  asteroidSpawn: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'bandpass', 1200, t, 0.1, 0.1, 3);
      osc(ctx, master, 'triangle', 130, t, 0.12, 0.1, 70);
      osc(ctx, master, 'sine', 260, t + 0.03, 0.06, 0.04);
      osc(ctx, master, 'sine', 65, t, 0.06, 0.06); // sub rumble
    },
  },
  solarFlare: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sawtooth', 80, 400, t, 0.35, 0.15, 'lowpass', 1200);
      filteredNoise(ctx, master, 'bandpass', 1500, t, 0.25, 0.1, 3);
      osc(ctx, master, 'sine', 200, t + 0.1, 0.25, 0.1, 600);
      osc(ctx, master, 'sine', 40, t, 0.15, 0.1); // deep sub
    },
  },
  eventWarning: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 600, t, 0.08, 0.12);
      osc(ctx, master, 'square', 600, t + 0.14, 0.08, 0.12);
      osc(ctx, master, 'square', 600, t + 0.28, 0.08, 0.12);
      osc(ctx, master, 'sine', 300, t, 0.06, 0.04); // undertone
      osc(ctx, master, 'triangle', 1200, t + 0.02, 0.04, 0.03); // alarm overtone
    },
  },
  wellPlace: {
    play(ctx, master) {
      const t = ctx.currentTime;
      oscASR(ctx, master, 'sine', 300, t, 0.02, 0.04, 0.1, 0.2, 600);
      osc(ctx, master, 'triangle', 450, t + 0.03, 0.08, 0.08);
      osc(ctx, master, 'sine', 150, t, 0.05, 0.08); // sub
      filteredNoise(ctx, master, 'lowpass', 500, t, 0.03, 0.03);
    },
  },
  wellRemove: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.12, 0.15, 250);
      osc(ctx, master, 'triangle', 250, t + 0.05, 0.08, 0.06);
      filteredNoise(ctx, master, 'highpass', 2000, t, 0.04, 0.03);
    },
  },
  wellAdjust: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.06, 0.1);
      osc(ctx, master, 'triangle', 750, t + 0.02, 0.04, 0.04);
      osc(ctx, master, 'sine', 502, t, 0.06, 0.04); // subtle detune
    },
  },
  frequencyMatch: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [700, 1050, 1400], t, 0.12, 0.2);
      osc(ctx, master, 'triangle', 2100, t + 0.08, 0.06, 0.04); // sparkle
      osc(ctx, master, 'sine', 350, t, 0.06, 0.06); // warm base
    },
  },
  comboUp: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.05, 0.15);
      osc(ctx, master, 'sine', 800, t + 0.04, 0.05, 0.15);
      osc(ctx, master, 'sine', 1000, t + 0.08, 0.05, 0.18);
      osc(ctx, master, 'triangle', 1200, t + 0.12, 0.06, 0.06); // sparkle top
      osc(ctx, master, 'sine', 300, t, 0.04, 0.06); // warm sub
    },
  },
  waterDamage: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'lowpass', 600, t, 0.12, 0.1, 2);
      osc(ctx, master, 'sine', 220, t, 0.14, 0.12, 120);
      osc(ctx, master, 'triangle', 350, t + 0.03, 0.08, 0.04);
      osc(ctx, master, 'sine', 80, t, 0.08, 0.06); // deep sub
    },
  },
  lavaDeath: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'lowpass', 1000, t, 0.25, 0.18, 2);
      osc(ctx, master, 'sawtooth', 120, t, 0.25, 0.2, 40);
      osc(ctx, master, 'sine', 50, t, 0.2, 0.15); // massive sub
      osc(ctx, master, 'sine', 250, t + 0.05, 0.18, 0.08, 60);
      filteredNoise(ctx, master, 'bandpass', 2000, t + 0.08, 0.1, 0.04, 3);
    },
  },
  starRating: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 900, t, 0.08, 0.2);
      osc(ctx, master, 'sine', 1350, t + 0.06, 0.1, 0.15);
      osc(ctx, master, 'triangle', 1800, t + 0.1, 0.06, 0.05); // sparkle
      osc(ctx, master, 'sine', 902, t, 0.08, 0.06); // detune
    },
  },

  // === Memory / Quiz Games (Déjà Vu, Spectrum, What's Missing) ===

  shapeReveal: {
    play(ctx, master) {
      const t = ctx.currentTime;
      oscASR(ctx, master, 'sine', 300, t, 0.05, 0.08, 0.15, 0.12, 900);
      osc(ctx, master, 'triangle', 600, t + 0.04, 0.15, 0.06);
      osc(ctx, master, 'sine', 1200, t + 0.07, 0.12, 0.04);
      filteredNoise(ctx, master, 'highpass', 5000, t + 0.02, 0.1, 0.03);
      osc(ctx, master, 'sine', 150, t, 0.08, 0.06); // warm sub
    },
  },
  memoryRecall: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [440, 554, 660], t, 0.15, 0.18);
      osc(ctx, master, 'triangle', 880, t + 0.04, 0.12, 0.06);
      osc(ctx, master, 'sine', 1320, t + 0.08, 0.08, 0.03); // shimmer
      osc(ctx, master, 'sine', 220, t, 0.06, 0.06); // warm sub
    },
  },
  decoyCatch: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.05, 0.14);
      osc(ctx, master, 'sine', 750, t + 0.03, 0.05, 0.14);
      osc(ctx, master, 'sine', 900, t + 0.06, 0.05, 0.14);
      osc(ctx, master, 'sine', 1100, t + 0.09, 0.05, 0.14);
      osc(ctx, master, 'sine', 1350, t + 0.12, 0.08, 0.18);
      osc(ctx, master, 'triangle', 2700, t + 0.14, 0.06, 0.04); // sparkle
      osc(ctx, master, 'sine', 300, t, 0.04, 0.06); // sub
    },
  },
  wrongGuess: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'square', 175, t, 0.2, 0.12, 110);
      osc(ctx, master, 'square', 185, t, 0.2, 0.1, 115);
      osc(ctx, master, 'sawtooth', 90, t, 0.22, 0.08);
      osc(ctx, master, 'sine', 55, t, 0.15, 0.06); // dark sub
      filteredNoise(ctx, master, 'lowpass', 600, t, 0.15, 0.06, 2);
    },
  },
  timeDrain: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 500, 120, t, 0.3, 0.15, 'lowpass', 800);
      osc(ctx, master, 'triangle', 350, t + 0.05, 0.2, 0.06, 80);
      filteredNoise(ctx, master, 'lowpass', 400, t + 0.15, 0.12, 0.04);
    },
  },
  tickWarning: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 1200, t, 0.03, 0.12);
      osc(ctx, master, 'triangle', 800, t, 0.02, 0.06);
      osc(ctx, master, 'sine', 2400, t, 0.015, 0.03); // high tick
    },
  },
  estimateSlide: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 600, t, 0.03, 0.08);
      osc(ctx, master, 'triangle', 900, t, 0.02, 0.03);
    },
  },
  lockIn: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 180, t, 0.06, 0.18);
      osc(ctx, master, 'triangle', 800, t, 0.03, 0.12);
      filteredNoise(ctx, master, 'lowpass', 1200, t, 0.03, 0.08);
      osc(ctx, master, 'sine', 90, t, 0.04, 0.08); // thump sub
    },
  },
  bullseye: {
    play(ctx, master) {
      const t = ctx.currentTime;
      chord(ctx, master, 'sine', [523, 659, 784], t, 0.18, 0.2);
      osc(ctx, master, 'sine', 1047, t + 0.06, 0.15, 0.1);
      osc(ctx, master, 'triangle', 1568, t + 0.1, 0.1, 0.05);
      osc(ctx, master, 'sine', 2093, t + 0.14, 0.08, 0.03); // high sparkle
      osc(ctx, master, 'sine', 262, t, 0.08, 0.06); // warm sub
    },
  },
  nerveChain: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 400, t, 0.04, 0.12);
      osc(ctx, master, 'sine', 500, t + 0.025, 0.04, 0.13);
      osc(ctx, master, 'sine', 650, t + 0.05, 0.04, 0.15);
      osc(ctx, master, 'square', 800, t + 0.075, 0.06, 0.06);
      osc(ctx, master, 'triangle', 1000, t + 0.09, 0.04, 0.04); // tension peak
    },
  },

  // === Slide Devil ===
  trollActivate: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'square', 600, 250, t, 0.08, 0.12, 'lowpass', 1500);
      osc(ctx, master, 'sawtooth', 400, t + 0.03, 0.08, 0.08, 180);
      filteredNoise(ctx, master, 'bandpass', 1200, t + 0.02, 0.05, 0.06, 4);
      osc(ctx, master, 'sine', 220, t + 0.08, 0.1, 0.1); // devious low tone
    },
  },
  gravityFlip: {
    play(ctx, master) {
      const t = ctx.currentTime;
      sweep(ctx, master, 'sine', 900, 150, t, 0.15, 0.2);
      sweep(ctx, master, 'sine', 150, 800, t + 0.12, 0.18, 0.15);
      osc(ctx, master, 'triangle', 400, t + 0.04, 0.1, 0.06);
      osc(ctx, master, 'sine', 75, t + 0.1, 0.08, 0.08); // gravity sub
    },
  },
  floorCrumble: {
    play(ctx, master) {
      const t = ctx.currentTime;
      filteredNoise(ctx, master, 'lowpass', 800, t, 0.18, 0.15, 2);
      osc(ctx, master, 'triangle', 180, t, 0.12, 0.1, 50);
      filteredNoise(ctx, master, 'bandpass', 1200, t + 0.06, 0.12, 0.06, 3);
      osc(ctx, master, 'sine', 100, t + 0.04, 0.18, 0.08, 30);
      osc(ctx, master, 'sine', 50, t, 0.1, 0.08); // sub rumble
    },
  },

  // === Shared ===
  streakRise: {
    play(ctx, master) {
      const t = ctx.currentTime;
      osc(ctx, master, 'sine', 500, t, 0.04, 0.1);
      osc(ctx, master, 'sine', 650, t + 0.03, 0.04, 0.12);
      osc(ctx, master, 'sine', 850, t + 0.06, 0.04, 0.15);
      osc(ctx, master, 'sine', 1100, t + 0.09, 0.06, 0.18);
      osc(ctx, master, 'triangle', 1650, t + 0.12, 0.05, 0.05); // sparkle
      osc(ctx, master, 'sine', 250, t, 0.03, 0.05); // warm sub
    },
  },
  victoryFanfare: {
    play(ctx, master) {
      const t = ctx.currentTime;
      // C major arpeggio with harmonics
      chord(ctx, master, 'sine', [523, 659, 784], t, 0.15, 0.2);
      chord(ctx, master, 'sine', [659, 784, 1047], t + 0.12, 0.15, 0.2);
      osc(ctx, master, 'sine', 1047, t + 0.25, 0.15, 0.22);
      osc(ctx, master, 'sine', 1319, t + 0.32, 0.2, 0.2);
      osc(ctx, master, 'triangle', 2093, t + 0.36, 0.15, 0.05); // high sparkle
      osc(ctx, master, 'sine', 2637, t + 0.4, 0.1, 0.03);
      osc(ctx, master, 'sine', 262, t, 0.12, 0.08); // bass foundation
      osc(ctx, master, 'sine', 131, t + 0.25, 0.15, 0.06); // deep bass
    },
  },
  newHighScore: {
    play(ctx, master) {
      const t = ctx.currentTime;
      // Sparkling cascade
      osc(ctx, master, 'sine', 800, t, 0.04, 0.15);
      osc(ctx, master, 'sine', 1000, t + 0.03, 0.04, 0.15);
      osc(ctx, master, 'sine', 1200, t + 0.06, 0.04, 0.15);
      osc(ctx, master, 'sine', 1500, t + 0.09, 0.05, 0.18);
      // Rich chord at the end
      chord(ctx, master, 'sine', [800, 1000, 1200, 1500], t + 0.15, 0.22, 0.2);
      osc(ctx, master, 'triangle', 2000, t + 0.18, 0.12, 0.04); // sparkle
      osc(ctx, master, 'sine', 3000, t + 0.22, 0.08, 0.02); // high shimmer
      osc(ctx, master, 'sine', 400, t + 0.15, 0.15, 0.06); // warm bass
    },
  },
};

// Loopable sounds use repeated scheduling
const LOOP_SOUNDS: Set<SoundName> = new Set(['beamFire', 'charge']);

// ─── Ambient Music Themes ──────────────────────────────────

interface AmbientConfig {
  /** Pad frequencies (2-3 oscillators) */
  pads: { freq: number; type: OscType; vol: number }[];
  /** Lowpass filter frequency */
  filterFreq: number;
  /** LFO speed in Hz (0.05–0.3 typical) */
  lfoSpeed: number;
  /** LFO depth (0 = none, 1 = full) */
  lfoDepth: number;
  /** Master volume for this theme */
  volume: number;
  /** Optional sub bass frequency */
  subBass?: number;
  /** Optional high shimmer frequency */
  shimmer?: number;
  /** Detune amount in cents */
  detune?: number;
}

const ambientThemes: Record<AmbientTheme, AmbientConfig> = {
  'space-gravity': {
    pads: [
      { freq: 55, type: 'sine', vol: 0.4 },      // Deep A bass drone
      { freq: 220, type: 'sine', vol: 0.2 },      // A3 pad
      { freq: 329.63, type: 'triangle', vol: 0.1 }, // E4 fifth
    ],
    filterFreq: 400,
    lfoSpeed: 0.08,
    lfoDepth: 0.4,
    volume: 0.1,
    subBass: 27.5,
    detune: 8,
  },
  'colorful-puzzle': {
    pads: [
      { freq: 261.63, type: 'sine', vol: 0.25 },   // C4
      { freq: 329.63, type: 'sine', vol: 0.2 },     // E4
      { freq: 392, type: 'triangle', vol: 0.15 },    // G4
    ],
    filterFreq: 800,
    lfoSpeed: 0.15,
    lfoDepth: 0.25,
    volume: 0.08,
    shimmer: 1046.5,
    detune: 5,
  },
  'dark-cave': {
    pads: [
      { freq: 65.41, type: 'sine', vol: 0.35 },    // C2 dark drone
      { freq: 130.81, type: 'sawtooth', vol: 0.08 }, // C3 gritty
      { freq: 155.56, type: 'triangle', vol: 0.12 }, // Eb3 minor
    ],
    filterFreq: 300,
    lfoSpeed: 0.06,
    lfoDepth: 0.5,
    volume: 0.1,
    subBass: 32.7,
    detune: 12,
  },
  'underground': {
    pads: [
      { freq: 73.42, type: 'sine', vol: 0.3 },     // D2 earthy
      { freq: 146.83, type: 'triangle', vol: 0.15 }, // D3
      { freq: 174.61, type: 'sine', vol: 0.12 },     // F3 minor
    ],
    filterFreq: 350,
    lfoSpeed: 0.1,
    lfoDepth: 0.35,
    volume: 0.09,
    subBass: 36.71,
    shimmer: 587.33,
    detune: 6,
  },
  'synth-combat': {
    pads: [
      { freq: 110, type: 'sawtooth', vol: 0.12 },   // A2 tense
      { freq: 164.81, type: 'square', vol: 0.06 },   // E3 fifth
      { freq: 220, type: 'sine', vol: 0.15 },        // A3
    ],
    filterFreq: 600,
    lfoSpeed: 0.25,
    lfoDepth: 0.3,
    volume: 0.09,
    subBass: 55,
    detune: 10,
  },
  'cosmic-orbit': {
    pads: [
      { freq: 196, type: 'sine', vol: 0.2 },        // G3
      { freq: 246.94, type: 'sine', vol: 0.18 },     // B3
      { freq: 293.66, type: 'triangle', vol: 0.12 }, // D4
    ],
    filterFreq: 700,
    lfoSpeed: 0.12,
    lfoDepth: 0.3,
    volume: 0.09,
    shimmer: 783.99,
    detune: 7,
  },
  'organic': {
    pads: [
      { freq: 130.81, type: 'sine', vol: 0.25 },    // C3
      { freq: 196, type: 'triangle', vol: 0.15 },    // G3
      { freq: 261.63, type: 'sine', vol: 0.12 },     // C4
    ],
    filterFreq: 500,
    lfoSpeed: 0.18,
    lfoDepth: 0.4,
    volume: 0.09,
    subBass: 65.41,
    detune: 4,
  },
  'quiz-ambient': {
    pads: [
      { freq: 220, type: 'sine', vol: 0.2 },        // A3 neutral
      { freq: 277.18, type: 'sine', vol: 0.15 },     // C#4
      { freq: 329.63, type: 'triangle', vol: 0.1 },  // E4
    ],
    filterFreq: 600,
    lfoSpeed: 0.1,
    lfoDepth: 0.2,
    volume: 0.08,
    detune: 3,
  },
  'memory-ethereal': {
    pads: [
      { freq: 174.61, type: 'sine', vol: 0.22 },    // F3
      { freq: 261.63, type: 'sine', vol: 0.15 },     // C4
      { freq: 349.23, type: 'triangle', vol: 0.1 },  // F4
    ],
    filterFreq: 550,
    lfoSpeed: 0.09,
    lfoDepth: 0.3,
    volume: 0.08,
    shimmer: 698.46,
    detune: 5,
  },
  'missing-tension': {
    pads: [
      { freq: 146.83, type: 'sine', vol: 0.22 },    // D3
      { freq: 220, type: 'triangle', vol: 0.15 },     // A3
      { freq: 293.66, type: 'sine', vol: 0.1 },       // D4
    ],
    filterFreq: 500,
    lfoSpeed: 0.14,
    lfoDepth: 0.3,
    volume: 0.08,
    subBass: 73.42,
    detune: 6,
  },
  'slide-chaos': {
    pads: [
      { freq: 98, type: 'sawtooth', vol: 0.1 },     // G2
      { freq: 146.83, type: 'sine', vol: 0.18 },     // D3
      { freq: 196, type: 'triangle', vol: 0.12 },    // G3
    ],
    filterFreq: 500,
    lfoSpeed: 0.2,
    lfoDepth: 0.35,
    volume: 0.09,
    subBass: 49,
    detune: 8,
  },
};

interface AmbientState {
  oscillators: OscillatorNode[];
  gains: GainNode[];
  lfo: OscillatorNode;
  lfoGain: GainNode;
  masterGain: GainNode;
  filter: BiquadFilterNode;
}

// ─── Sound Engine ──────────────────────────────────────────

class _SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private _volume: number = 0.5;
  private _muted: boolean = false;
  private cooldowns: Map<string, number> = new Map();
  private loopTimers: Map<string, number> = new Map();
  private static COOLDOWN_MS = 30;

  // Music playback (file-based)
  private musicAudio: HTMLAudioElement | null = null;
  private musicVolume: number = 0.35;
  private musicPlaying: boolean = false;

  // Ambient music (procedural)
  private ambientState: AmbientState | null = null;
  private ambientTheme: AmbientTheme | null = null;
  private ambientVolume: number = 1.0; // multiplied by theme volume

  // Cached audio file buffers
  private fileCache: Map<string, AudioBuffer> = new Map();
  private loadingFiles: Map<string, Promise<AudioBuffer | null>> = new Map();

  constructor() {
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

    const now = performance.now();
    const last = this.cooldowns.get(name) || 0;
    if (now - last < _SoundEngine.COOLDOWN_MS) return;
    this.cooldowns.set(name, now);

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
    if (this.loopTimers.has(name)) return;

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
    // Sync file-based music volume
    if (this.musicAudio) {
      this.musicAudio.volume = muted ? 0 : this.musicVolume;
    }
    // Sync ambient music
    if (this.ambientState && this.ctx) {
      const theme = this.ambientTheme ? ambientThemes[this.ambientTheme] : null;
      const targetVol = muted ? 0 : (theme?.volume ?? 0.1) * this.ambientVolume;
      this.ambientState.masterGain.gain.setTargetAtTime(targetVol, this.ctx.currentTime, 0.3);
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

  // ── Ambient Music (Procedural) ──

  startAmbient(theme: AmbientTheme) {
    // Don't restart the same theme
    if (this.ambientTheme === theme && this.ambientState) return;
    this.stopAmbient();

    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const config = ambientThemes[theme];
    if (!config) return;

    this.ambientTheme = theme;
    const now = this.ctx.currentTime;

    // Master gain for the ambient system (fades in)
    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    const targetVol = this._muted ? 0 : config.volume * this.ambientVolume;
    masterGain.gain.linearRampToValueAtTime(targetVol, now + 2.0); // 2s fade in
    masterGain.connect(this.master!);

    // Lowpass filter for warmth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(config.filterFreq, now);
    filter.Q.setValueAtTime(0.7, now);
    filter.connect(masterGain);

    // LFO for breathing effect
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(config.lfoSpeed, now);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(config.lfoDepth * 0.5, now);
    lfo.connect(lfoGain);
    lfo.start(now);

    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    // Create pad oscillators
    for (const pad of config.pads) {
      const o = this.ctx.createOscillator();
      o.type = pad.type;
      o.frequency.setValueAtTime(pad.freq, now);
      if (config.detune) {
        o.detune.setValueAtTime(config.detune, now);
      }
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(pad.vol, now);
      // Connect LFO to gain for breathing
      lfoGain.connect(g.gain);
      o.connect(g).connect(filter);
      o.start(now);
      oscillators.push(o);
      gains.push(g);

      // Detuned copy for stereo width
      const o2 = this.ctx.createOscillator();
      o2.type = pad.type;
      o2.frequency.setValueAtTime(pad.freq * 1.002, now);
      if (config.detune) {
        o2.detune.setValueAtTime(-config.detune, now);
      }
      const g2 = this.ctx.createGain();
      g2.gain.setValueAtTime(pad.vol * 0.5, now);
      lfoGain.connect(g2.gain);
      o2.connect(g2).connect(filter);
      o2.start(now);
      oscillators.push(o2);
      gains.push(g2);
    }

    // Optional sub bass
    if (config.subBass) {
      const sub = this.ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(config.subBass, now);
      const subG = this.ctx.createGain();
      subG.gain.setValueAtTime(0.15, now);
      sub.connect(subG).connect(filter);
      sub.start(now);
      oscillators.push(sub);
      gains.push(subG);
    }

    // Optional high shimmer
    if (config.shimmer) {
      const sh = this.ctx.createOscillator();
      sh.type = 'triangle';
      sh.frequency.setValueAtTime(config.shimmer, now);
      const shG = this.ctx.createGain();
      shG.gain.setValueAtTime(0.03, now);
      lfoGain.connect(shG.gain);
      sh.connect(shG).connect(filter);
      sh.start(now);
      oscillators.push(sh);
      gains.push(shG);
    }

    this.ambientState = {
      oscillators,
      gains,
      lfo,
      lfoGain,
      masterGain,
      filter,
    };
  }

  stopAmbient() {
    if (!this.ambientState || !this.ctx) {
      this.ambientState = null;
      this.ambientTheme = null;
      return;
    }

    const now = this.ctx.currentTime;
    const { oscillators, lfo, masterGain } = this.ambientState;

    // Fade out over 1 second
    masterGain.gain.setTargetAtTime(0, now, 0.3);

    // Stop everything after fade
    const stopTime = now + 1.5;
    for (const o of oscillators) {
      try { o.stop(stopTime); } catch { /* already stopped */ }
    }
    try { lfo.stop(stopTime); } catch { /* already stopped */ }

    this.ambientState = null;
    this.ambientTheme = null;
  }

  // ── File-based SFX ──

  preload(src: string) {
    this.init();
    if (!this.ctx) return;
    if (this.fileCache.has(src) || this.loadingFiles.has(src)) return;
    const promise = fetch(src)
      .then(r => r.arrayBuffer())
      .then(buf => this.ctx!.decodeAudioData(buf))
      .then(decoded => { this.fileCache.set(src, decoded); return decoded; })
      .catch(() => null);
    this.loadingFiles.set(src, promise);
  }

  playFile(src: string, volume = 0.5) {
    if (this._muted) return;
    this.init();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();

    const cached = this.fileCache.get(src);
    if (cached) {
      this._playBuffer(cached, volume);
    } else {
      const loading = this.loadingFiles.get(src);
      if (loading) {
        loading.then(buf => { if (buf) this._playBuffer(buf, volume); });
      } else {
        this.preload(src);
        this.loadingFiles.get(src)?.then(buf => { if (buf) this._playBuffer(buf, volume); });
      }
    }
  }

  private _playBuffer(buffer: AudioBuffer, volume: number) {
    if (!this.ctx || !this.master) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    source.connect(gain).connect(this.master);
    source.start();
  }

  // ── Music (MP3 file playback) ──

  playMusic(src: string, loop = true) {
    if (typeof window === 'undefined') return;
    this.stopMusic();
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = this._muted ? 0 : this.musicVolume;
    audio.play().catch(() => {
      // Autoplay blocked
    });
    this.musicAudio = audio;
    this.musicPlaying = true;
  }

  stopMusic() {
    if (this.musicAudio) {
      this.musicAudio.pause();
      this.musicAudio.currentTime = 0;
      this.musicAudio = null;
    }
    this.musicPlaying = false;
  }

  pauseMusic() {
    if (this.musicAudio && this.musicPlaying) {
      this.musicAudio.pause();
    }
  }

  resumeMusic() {
    if (this.musicAudio && this.musicPlaying && !this._muted) {
      this.musicAudio.play().catch(() => {});
    }
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

// Singleton — SSR-safe
export const SoundEngine = new _SoundEngine();
