export const categoryColors: Record<string, string> = {
  Action: '#e94560',
  Arcade: '#f59e0b',
  Physics: '#0ea5e9',
  Puzzle: '#06b6d4',
  Strategy: '#7c3aed',
};

export const categoryIcons: Record<string, string> = {
  Action: '⚡',
  Arcade: '🕹️',
  Physics: '🌌',
  Puzzle: '🧩',
  Strategy: '♟️',
};

/**
 * Get the color for a category (case-insensitive lookup).
 * Falls back to accent red if the category is unknown.
 */
export function getCategoryColor(category: string): string {
  // Try exact match first, then title-cased
  return (
    categoryColors[category] ||
    categoryColors[category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()] ||
    '#e94560'
  );
}

/**
 * Get the icon for a category (case-insensitive lookup).
 * Falls back to generic gamepad emoji if the category is unknown.
 */
export function getCategoryIcon(category: string): string {
  return (
    categoryIcons[category] ||
    categoryIcons[category.charAt(0).toUpperCase() + category.slice(1).toLowerCase()] ||
    '🎮'
  );
}
