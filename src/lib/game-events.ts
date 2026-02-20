// Game Event Bridge — lightweight event dispatching for game lifecycle
// Games import and call these functions; listeners (stats, achievements, daily challenges) react.

export interface GameStartDetail {
  slug: string;
  timestamp: number;
}

export interface GameEndDetail {
  slug: string;
  score: number;
  completed: boolean;
  level?: number;
  timestamp: number;
}

export interface LevelCompleteDetail {
  slug: string;
  level: number;
  score: number;
  timestamp: number;
}

export function reportGameStart(slug: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GameStartDetail>('spryte:game-start', {
      detail: { slug, timestamp: Date.now() },
    })
  );
}

export function reportGameEnd(slug: string, score: number, completed: boolean, level?: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GameEndDetail>('spryte:game-end', {
      detail: { slug, score, completed, level, timestamp: Date.now() },
    })
  );
}

export function reportLevelComplete(slug: string, level: number, score: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<LevelCompleteDetail>('spryte:level-complete', {
      detail: { slug, level, score, timestamp: Date.now() },
    })
  );
}
