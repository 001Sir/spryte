import { Game } from '@/types/game';

export const games: Game[] = [
  {
    slug: 'gravity-well',
    title: 'Gravity Well',
    description: 'Place gravity attractors and repulsors to guide a drifting particle to the goal. Careful — your wells also pull hazard debris into the path.',
    categories: ['Puzzle', 'Strategy'],
    controls: 'Mouse click to place/remove wells, Scroll to adjust strength',
    difficulty: 'Medium',
    thumbnail: '/thumbnails/gravity-well.svg',
    color: '#7c3aed',
    featured: true,
  },
  {
    slug: 'chroma-flood',
    title: 'Chroma Flood',
    description: 'Flood-fill colored regions from a corner to conquer the board. Locked regions add layers of strategy — plan your colors wisely.',
    categories: ['Puzzle', 'Strategy'],
    controls: 'Mouse click on color palette to change territory color',
    difficulty: 'Easy',
    thumbnail: '/thumbnails/chroma-flood.svg',
    color: '#06b6d4',
  },
  {
    slug: 'echo-chamber',
    title: 'Echo Chamber',
    description: 'Navigate dark rooms using expanding sound-wave pulses that briefly reveal your surroundings. Enemies freeze when illuminated but move in silence.',
    categories: ['Puzzle', 'Action'],
    controls: 'Arrow Keys to move, Mouse click to send sound pulse',
    difficulty: 'Medium',
    thumbnail: '/thumbnails/echo-chamber.svg',
    color: '#eab308',
  },
  {
    slug: 'terravore',
    title: 'Terravore',
    description: 'Play as a creature that devours terrain. Dig tunnels to reach buried treasure while avoiding water floods and lava flows.',
    categories: ['Action', 'Strategy'],
    controls: 'Arrow Keys / WASD to move, Space to dig',
    difficulty: 'Medium',
    thumbnail: '/thumbnails/terravore.svg',
    color: '#84cc16',
  },
  {
    slug: 'pulse-weaver',
    title: 'Pulse Weaver',
    description: 'Shoot a sine-wave beam at geometric enemies and tune your frequency to match their resonance. Precision and timing are everything.',
    categories: ['Action', 'Arcade'],
    controls: 'WASD to move, Mouse to aim, Hold click to fire beam, Scroll to adjust frequency',
    difficulty: 'Hard',
    thumbnail: '/thumbnails/pulse-weaver.svg',
    color: '#f43f5e',
  },
  {
    slug: 'orbit-keeper',
    title: 'Orbit Keeper',
    description: 'Keep planets in stable orbits by adjusting their velocity vectors as rogue asteroids and solar flares create chaos.',
    categories: ['Strategy', 'Puzzle'],
    controls: 'Click and drag planets to adjust velocity, Space to pause',
    difficulty: 'Hard',
    thumbnail: '/thumbnails/orbit-keeper.svg',
    color: '#0ea5e9',
  },
  {
    slug: 'symbiosis',
    title: 'Symbiosis',
    description: 'Control two linked organisms — a tough Host and a nimble Parasite. Use the elastic tether between them to clothesline waves of enemies.',
    categories: ['Action', 'Strategy'],
    controls: 'WASD moves Host, Mouse aims Parasite, Space to link/unlink',
    difficulty: 'Medium',
    thumbnail: '/thumbnails/symbiosis.svg',
    color: '#d946ef',
  },
  {
    slug: 'drift',
    title: 'Drift',
    description: 'A zero-friction momentum puzzle. Push off walls and drift through hazardous rooms. No legs, no brakes — just pure ghost momentum.',
    categories: ['Puzzle', 'Action'],
    controls: 'Click & drag to aim, release to launch',
    difficulty: 'Medium',
    thumbnail: '/thumbnails/drift.svg',
    color: '#51e2ff',
  },
];

export function getGameBySlug(slug: string): Game | undefined {
  return games.find((g) => g.slug === slug);
}

export function getGamesByCategory(category: string): Game[] {
  return games.filter((g) =>
    g.categories.some((c) => c.toLowerCase() === category.toLowerCase())
  );
}

export function searchGames(query: string): Game[] {
  const q = query.toLowerCase();
  return games.filter(
    (g) =>
      g.title.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q) ||
      g.categories.some((c) => c.toLowerCase().includes(q))
  );
}

export function getAllCategories(): string[] {
  const cats = new Set<string>();
  games.forEach((g) => g.categories.forEach((c) => cats.add(c)));
  return Array.from(cats).sort();
}
