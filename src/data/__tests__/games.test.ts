import { describe, it, expect } from 'vitest';
import { games, searchGames, getGamesByCategory, getGameBySlug, getAllCategories } from '../games';

describe('games data', () => {
  it('has games in the list', () => {
    expect(games.length).toBeGreaterThanOrEqual(12);
  });

  it('all games have required fields', () => {
    for (const game of games) {
      expect(game.slug).toBeTruthy();
      expect(game.title).toBeTruthy();
      expect(game.description).toBeTruthy();
      expect(game.categories.length).toBeGreaterThan(0);
      expect(game.difficulty).toBeTruthy();
      expect(game.thumbnail).toBeTruthy();
      expect(game.color).toMatch(/^#/);
    }
  });

  it('all slugs are unique', () => {
    const slugs = games.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('searchGames finds by title', () => {
    const results = searchGames('drift');
    expect(results.some((g) => g.slug === 'drift')).toBe(true);
  });

  it('searchGames finds by category', () => {
    const results = searchGames('puzzle');
    expect(results.length).toBeGreaterThan(0);
    results.forEach((g) => {
      const match = g.title.toLowerCase().includes('puzzle') ||
        g.description.toLowerCase().includes('puzzle') ||
        g.categories.some((c) => c.toLowerCase().includes('puzzle'));
      expect(match).toBe(true);
    });
  });

  it('searchGames returns empty for nonsense query', () => {
    expect(searchGames('xyzabc123')).toHaveLength(0);
  });

  it('getGamesByCategory returns correct results', () => {
    const actionGames = getGamesByCategory('action');
    expect(actionGames.length).toBeGreaterThan(0);
    actionGames.forEach((g) => {
      expect(g.categories.some((c) => c.toLowerCase() === 'action')).toBe(true);
    });
  });

  it('getGameBySlug returns the game', () => {
    const game = getGameBySlug('gravity-well');
    expect(game).toBeDefined();
    expect(game?.title).toBe('Gravity Well');
  });

  it('getGameBySlug returns undefined for unknown slug', () => {
    expect(getGameBySlug('nonexistent')).toBeUndefined();
  });

  it('getAllCategories returns unique sorted categories', () => {
    const cats = getAllCategories();
    expect(cats.length).toBeGreaterThan(0);
    // Verify sorted
    const sorted = [...cats].sort();
    expect(cats).toEqual(sorted);
  });
});
