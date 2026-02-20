// Stats Engine — aggregate game statistics persisted in localStorage

import { getHighScore, setHighScore } from './highscores';

const STORAGE_KEY = 'spryte-stats';

export interface GameStats {
  sessions: number;
  totalTimeMs: number;
  highScore: number;
  bestLevel: number;
  completions: number;
  firstPlayed: number;
  lastPlayed: number;
}

export interface GlobalStats {
  totalSessions: number;
  totalTimeMs: number;
  gamesPlayed: string[];
}

export interface StatsData {
  perGame: Record<string, GameStats>;
  global: GlobalStats;
}

// Active sessions tracking (in-memory only)
const activeSessions: Map<string, { slug: string; startTime: number }> = new Map();
let sessionCounter = 0;

function loadStats(): StatsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    perGame: {},
    global: { totalSessions: 0, totalTimeMs: 0, gamesPlayed: [] },
  };
}

function saveStats(data: StatsData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

function ensureGameStats(data: StatsData, slug: string): GameStats {
  if (!data.perGame[slug]) {
    data.perGame[slug] = {
      sessions: 0,
      totalTimeMs: 0,
      highScore: 0,
      bestLevel: 0,
      completions: 0,
      firstPlayed: Date.now(),
      lastPlayed: Date.now(),
    };
  }
  return data.perGame[slug];
}

export function startSession(slug: string): string {
  const id = `session-${++sessionCounter}-${Date.now()}`;
  activeSessions.set(id, { slug, startTime: Date.now() });
  return id;
}

export function endSession(
  sessionId: string,
  score: number,
  completed: boolean,
  level?: number
) {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  activeSessions.delete(sessionId);
  const elapsed = Date.now() - session.startTime;
  const { slug } = session;

  const data = loadStats();
  const gs = ensureGameStats(data, slug);

  gs.sessions++;
  gs.totalTimeMs += elapsed;
  gs.lastPlayed = Date.now();

  if (score > gs.highScore) {
    gs.highScore = score;
  }
  if (level !== undefined && level > gs.bestLevel) {
    gs.bestLevel = level;
  }
  if (completed) {
    gs.completions++;
  }

  // Update global stats
  data.global.totalSessions++;
  data.global.totalTimeMs += elapsed;
  if (!data.global.gamesPlayed.includes(slug)) {
    data.global.gamesPlayed.push(slug);
  }

  saveStats(data);

  // Also update existing highscore system if it's a new high
  const existingHigh = getHighScore(slug);
  if (score > existingHigh) {
    setHighScore(slug, score);
  }

  // Dispatch stats-updated event for reactive components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('spryte:stats-updated'));
  }
}

export function getStats(): StatsData {
  return loadStats();
}

export function getGameStats(slug: string): GameStats | null {
  const data = loadStats();
  return data.perGame[slug] || null;
}
