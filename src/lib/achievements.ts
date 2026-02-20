// Achievements System — ~30 achievements across per-game, cross-game, and meta categories

import { StatsData } from './stats';
import { games } from '@/data/games';

const STORAGE_KEY = 'spryte-achievements';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: 'per-game' | 'cross-game' | 'meta' | 'daily';
  gameSlug?: string;
  secret?: boolean;
  check: (stats: StatsData, earned: EarnedMap, extras?: AchievementExtras) => boolean;
}

export interface AchievementExtras {
  streak?: number;
  completedDays?: number;
}

export type EarnedMap = Record<string, { earnedAt: number }>;

function loadEarned(): EarnedMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveEarned(earned: EarnedMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(earned));
  } catch {}
}

// Per-game achievements (2 per game = 24)
const perGameAchievements: Achievement[] = [
  // Gravity Well
  { id: 'gw-scorer', title: 'Gravity Master', description: 'Score 500+ in Gravity Well', icon: '🌀', category: 'per-game', gameSlug: 'gravity-well', check: (s) => (s.perGame['gravity-well']?.highScore ?? 0) >= 500 },
  { id: 'gw-levels', title: 'Well Navigator', description: 'Reach level 5 in Gravity Well', icon: '🧭', category: 'per-game', gameSlug: 'gravity-well', check: (s) => (s.perGame['gravity-well']?.bestLevel ?? 0) >= 5 },

  // Chroma Flood
  { id: 'cf-scorer', title: 'Color Conqueror', description: 'Score 300+ in Chroma Flood', icon: '🎨', category: 'per-game', gameSlug: 'chroma-flood', check: (s) => (s.perGame['chroma-flood']?.highScore ?? 0) >= 300 },
  { id: 'cf-sessions', title: 'Flood Enthusiast', description: 'Play Chroma Flood 10 times', icon: '🌊', category: 'per-game', gameSlug: 'chroma-flood', check: (s) => (s.perGame['chroma-flood']?.sessions ?? 0) >= 10 },

  // Echo Chamber
  { id: 'ec-scorer', title: 'Echo Expert', description: 'Score 400+ in Echo Chamber', icon: '🔊', category: 'per-game', gameSlug: 'echo-chamber', check: (s) => (s.perGame['echo-chamber']?.highScore ?? 0) >= 400 },
  { id: 'ec-levels', title: 'Dark Navigator', description: 'Reach level 8 in Echo Chamber', icon: '🌑', category: 'per-game', gameSlug: 'echo-chamber', check: (s) => (s.perGame['echo-chamber']?.bestLevel ?? 0) >= 8 },

  // Terravore
  { id: 'tv-scorer', title: 'Terrain Devourer', description: 'Score 500+ in Terravore', icon: '🐛', category: 'per-game', gameSlug: 'terravore', check: (s) => (s.perGame['terravore']?.highScore ?? 0) >= 500 },
  { id: 'tv-levels', title: 'Deep Digger', description: 'Reach level 5 in Terravore', icon: '⛏️', category: 'per-game', gameSlug: 'terravore', check: (s) => (s.perGame['terravore']?.bestLevel ?? 0) >= 5 },

  // Pulse Weaver
  { id: 'pw-scorer', title: 'Frequency Master', description: 'Score 600+ in Pulse Weaver', icon: '〰️', category: 'per-game', gameSlug: 'pulse-weaver', check: (s) => (s.perGame['pulse-weaver']?.highScore ?? 0) >= 600 },
  { id: 'pw-waves', title: 'Wave Survivor', description: 'Survive 10 waves in Pulse Weaver', icon: '🛡️', category: 'per-game', gameSlug: 'pulse-weaver', check: (s) => (s.perGame['pulse-weaver']?.bestLevel ?? 0) >= 10 },

  // Orbit Keeper
  { id: 'ok-scorer', title: 'Orbital Mechanic', description: 'Score 400+ in Orbit Keeper', icon: '🪐', category: 'per-game', gameSlug: 'orbit-keeper', check: (s) => (s.perGame['orbit-keeper']?.highScore ?? 0) >= 400 },
  { id: 'ok-levels', title: 'Cosmic Guardian', description: 'Reach level 8 in Orbit Keeper', icon: '🌟', category: 'per-game', gameSlug: 'orbit-keeper', check: (s) => (s.perGame['orbit-keeper']?.bestLevel ?? 0) >= 8 },

  // Symbiosis
  { id: 'sb-scorer', title: 'Symbiotic Bond', description: 'Score 500+ in Symbiosis', icon: '🦠', category: 'per-game', gameSlug: 'symbiosis', check: (s) => (s.perGame['symbiosis']?.highScore ?? 0) >= 500 },
  { id: 'sb-waves', title: 'Tether Champion', description: 'Survive 8 waves in Symbiosis', icon: '🔗', category: 'per-game', gameSlug: 'symbiosis', check: (s) => (s.perGame['symbiosis']?.bestLevel ?? 0) >= 8 },

  // Drift
  { id: 'dr-scorer', title: 'Ghost Drifter', description: 'Score 300+ in Drift', icon: '👻', category: 'per-game', gameSlug: 'drift', check: (s) => (s.perGame['drift']?.highScore ?? 0) >= 300 },
  { id: 'dr-levels', title: 'Momentum Master', description: 'Complete 10 levels in Drift', icon: '💨', category: 'per-game', gameSlug: 'drift', check: (s) => (s.perGame['drift']?.bestLevel ?? 0) >= 10 },

  // Spectrum
  { id: 'sp-scorer', title: 'Sharp Estimator', description: 'Score 800+ in Spectrum', icon: '🎯', category: 'per-game', gameSlug: 'spectrum', check: (s) => (s.perGame['spectrum']?.highScore ?? 0) >= 800 },
  { id: 'sp-sessions', title: 'Knowledge Seeker', description: 'Play Spectrum 15 times', icon: '📊', category: 'per-game', gameSlug: 'spectrum', check: (s) => (s.perGame['spectrum']?.sessions ?? 0) >= 15 },

  // Deja Vu
  { id: 'dv-scorer', title: 'Perfect Memory', description: 'Score 500+ in Deja Vu', icon: '🧠', category: 'per-game', gameSlug: 'deja-vu', check: (s) => (s.perGame['deja-vu']?.highScore ?? 0) >= 500 },
  { id: 'dv-sessions', title: 'Deja Vu Devotee', description: 'Play Deja Vu 10 times', icon: '🔄', category: 'per-game', gameSlug: 'deja-vu', check: (s) => (s.perGame['deja-vu']?.sessions ?? 0) >= 10 },

  // Slide Devil
  { id: 'sd-levels', title: 'Devil Defier', description: 'Complete 10 levels in Slide Devil', icon: '😈', category: 'per-game', gameSlug: 'slide-devil', check: (s) => (s.perGame['slide-devil']?.bestLevel ?? 0) >= 10 },
  { id: 'sd-complete', title: 'Slide Conqueror', description: 'Beat all 15 levels of Slide Devil', icon: '👑', category: 'per-game', gameSlug: 'slide-devil', check: (s) => (s.perGame['slide-devil']?.bestLevel ?? 0) >= 15 },

  // What's Missing
  { id: 'wm-scorer', title: 'Eagle Eye', description: 'Score 400+ in What\'s Missing', icon: '🦅', category: 'per-game', gameSlug: 'whats-missing', check: (s) => (s.perGame['whats-missing']?.highScore ?? 0) >= 400 },
  { id: 'wm-sessions', title: 'Keen Observer', description: 'Play What\'s Missing 10 times', icon: '🔍', category: 'per-game', gameSlug: 'whats-missing', check: (s) => (s.perGame['whats-missing']?.sessions ?? 0) >= 10 },
];

// Cross-game achievements (5)
const crossGameAchievements: Achievement[] = [
  {
    id: 'explorer', title: 'Explorer', description: `Play all ${games.length} games`, icon: '🗺️', category: 'cross-game',
    check: (s) => s.global.gamesPlayed.length >= games.length,
  },
  {
    id: 'dedicated', title: 'Dedicated', description: 'Complete 50 game sessions', icon: '💎', category: 'cross-game',
    check: (s) => s.global.totalSessions >= 50,
  },
  {
    id: 'high-roller', title: 'High Roller', description: 'Score 500+ in 5 different games', icon: '🎰', category: 'cross-game',
    check: (s) => {
      const count = Object.values(s.perGame).filter((g) => g.highScore >= 500).length;
      return count >= 5;
    },
  },
  {
    id: 'marathon', title: 'Marathon', description: 'Play for 2 hours total', icon: '⏱️', category: 'cross-game',
    check: (s) => s.global.totalTimeMs >= 2 * 60 * 60 * 1000,
  },
  {
    id: 'all-rounder', title: 'All-Rounder', description: 'Earn at least 1 achievement per game', icon: '🏅', category: 'cross-game',
    check: (_s, earned) => {
      const gameSlugs = games.map((g) => g.slug);
      return gameSlugs.every((slug) =>
        perGameAchievements.some((a) => a.gameSlug === slug && earned[a.id])
      );
    },
  },
];

// Meta achievements (3)
const metaAchievements: Achievement[] = [
  {
    id: 'first-steps', title: 'First Steps', description: 'Complete your first game session', icon: '🎮', category: 'meta',
    check: (s) => s.global.totalSessions >= 1,
  },
  {
    id: 'collector', title: 'Collector', description: 'Earn 10 achievements', icon: '🏆', category: 'meta',
    check: (_s, earned) => Object.keys(earned).length >= 10,
  },
  {
    id: 'completionist', title: 'Completionist', description: 'Earn all achievements', icon: '✨', category: 'meta', secret: true,
    check: (_s, earned) => {
      const allNonMeta = [...perGameAchievements, ...crossGameAchievements];
      return allNonMeta.every((a) => earned[a.id]);
    },
  },
];

// Daily challenge achievements (added here, checked with extras)
const dailyAchievements: Achievement[] = [
  {
    id: 'first-challenge', title: 'First Challenge', description: 'Complete your first daily challenge', icon: '📅', category: 'daily',
    check: (_s, _e, extras) => (extras?.completedDays ?? 0) >= 1,
  },
  {
    id: 'week-warrior', title: 'Week Warrior', description: 'Achieve a 7-day challenge streak', icon: '🔥', category: 'daily',
    check: (_s, _e, extras) => (extras?.streak ?? 0) >= 7,
  },
  {
    id: 'monthly-master', title: 'Monthly Master', description: 'Achieve a 30-day challenge streak', icon: '🌙', category: 'daily', secret: true,
    check: (_s, _e, extras) => (extras?.streak ?? 0) >= 30,
  },
];

export const allAchievements: Achievement[] = [
  ...perGameAchievements,
  ...crossGameAchievements,
  ...metaAchievements,
  ...dailyAchievements,
];

export function getAllAchievements(): Achievement[] {
  return allAchievements;
}

export function getEarnedAchievements(): EarnedMap {
  return loadEarned();
}

export function checkNewAchievements(
  stats: StatsData,
  extras?: AchievementExtras
): Achievement[] {
  const earned = loadEarned();
  const newlyEarned: Achievement[] = [];

  for (const achievement of allAchievements) {
    if (earned[achievement.id]) continue;
    if (achievement.check(stats, earned, extras)) {
      earned[achievement.id] = { earnedAt: Date.now() };
      newlyEarned.push(achievement);
    }
  }

  if (newlyEarned.length > 0) {
    // Re-check meta achievements that depend on earned count
    for (const achievement of metaAchievements) {
      if (earned[achievement.id]) continue;
      if (achievement.check(stats, earned, extras)) {
        earned[achievement.id] = { earnedAt: Date.now() };
        newlyEarned.push(achievement);
      }
    }
    saveEarned(earned);
  }

  return newlyEarned;
}

export function getAchievementProgress(id: string, stats: StatsData): number {
  const a = allAchievements.find((x) => x.id === id);
  if (!a) return 0;

  // Calculate progress for common patterns
  const gs = a.gameSlug ? stats.perGame[a.gameSlug] : null;
  if (a.id.endsWith('-scorer') && gs) {
    const target = parseInt(a.description.match(/(\d+)\+/)?.[1] || '0');
    return target > 0 ? Math.min(1, gs.highScore / target) : 0;
  }
  if (a.id.endsWith('-levels') || a.id.endsWith('-waves')) {
    if (gs) {
      const target = parseInt(a.description.match(/(\d+)/)?.[1] || '0');
      return target > 0 ? Math.min(1, gs.bestLevel / target) : 0;
    }
  }
  if (a.id.endsWith('-sessions') && gs) {
    const target = parseInt(a.description.match(/(\d+)/)?.[1] || '0');
    return target > 0 ? Math.min(1, gs.sessions / target) : 0;
  }
  if (a.id === 'explorer') return Math.min(1, stats.global.gamesPlayed.length / games.length);
  if (a.id === 'dedicated') return Math.min(1, stats.global.totalSessions / 50);
  if (a.id === 'marathon') return Math.min(1, stats.global.totalTimeMs / (2 * 60 * 60 * 1000));
  if (a.id === 'first-steps') return Math.min(1, stats.global.totalSessions);

  return 0;
}

export function getGameAchievements(slug: string): Achievement[] {
  return perGameAchievements.filter((a) => a.gameSlug === slug);
}
