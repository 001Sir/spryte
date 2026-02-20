// Daily Challenge Engine — deterministic date-seeded challenge selection

import { games } from '@/data/games';

const STORAGE_KEY = 'spryte-daily-challenges';

export interface DailyChallenge {
  id: string; // e.g. "2026-02-20"
  gameSlug: string;
  gameTitle: string;
  description: string;
  type: 'score' | 'level' | 'completion';
  target: number;
}

interface DailyChallengeData {
  completed: Record<string, boolean>; // dateStr -> true
  bestStreak: number;
}

// Templates per challenge type
const challengeTemplates = [
  { type: 'score' as const, targets: [200, 300, 400, 500], desc: (t: number) => `Score ${t}+ points` },
  { type: 'score' as const, targets: [100, 250, 350, 450], desc: (t: number) => `Reach a score of ${t}` },
  { type: 'level' as const, targets: [3, 5, 7, 10], desc: (t: number) => `Reach level ${t}` },
  { type: 'completion' as const, targets: [1, 2, 3, 1], desc: (t: number) => `Complete ${t} session${t > 1 ? 's' : ''}` },
];

// Simple hash for date string -> deterministic index
function dateHash(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getDateStr(date?: Date): string {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getDailyChallenge(date?: Date): DailyChallenge {
  const dateStr = getDateStr(date);
  const hash = dateHash(dateStr);

  const gameIndex = hash % games.length;
  const templateIndex = (hash >> 4) % challengeTemplates.length;
  const targetIndex = (hash >> 8) % 4;

  const game = games[gameIndex];
  const template = challengeTemplates[templateIndex];
  const target = template.targets[targetIndex];

  return {
    id: dateStr,
    gameSlug: game.slug,
    gameTitle: game.title,
    description: template.desc(target),
    type: template.type,
    target,
  };
}

function loadData(): DailyChallengeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { completed: {}, bestStreak: 0 };
}

function saveData(data: DailyChallengeData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function completeDailyChallenge(id: string) {
  const data = loadData();
  if (data.completed[id]) return;
  data.completed[id] = true;

  // Calculate current streak
  const streak = calculateStreak(data.completed);
  if (streak > data.bestStreak) {
    data.bestStreak = streak;
  }

  saveData(data);

  // Dispatch stats-updated to trigger achievement checks
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('spryte:stats-updated'));
  }
}

export function getDailyChallengeStatus(id: string): boolean {
  const data = loadData();
  return !!data.completed[id];
}

function calculateStreak(completed: Record<string, boolean>): number {
  let streak = 0;
  const today = new Date();

  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getDateStr(d);
    if (completed[dateStr]) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function getStreak(): number {
  const data = loadData();
  return calculateStreak(data.completed);
}

export function getBestStreak(): number {
  const data = loadData();
  return data.bestStreak;
}

export function getCompletedDays(): string[] {
  const data = loadData();
  return Object.keys(data.completed);
}

// Auto-check on game-end event
export function checkDailyCompletion(slug: string, score: number, level?: number) {
  const challenge = getDailyChallenge();
  if (challenge.gameSlug !== slug) return;
  if (getDailyChallengeStatus(challenge.id)) return;

  let met = false;
  if (challenge.type === 'score' && score >= challenge.target) met = true;
  if (challenge.type === 'level' && (level ?? 0) >= challenge.target) met = true;
  if (challenge.type === 'completion') met = true; // any completion counts

  if (met) {
    completeDailyChallenge(challenge.id);
  }
}
