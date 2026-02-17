import { Game } from '@/types/game';

export const games: Game[] = [
  {
    slug: 'gravity-well',
    title: 'Gravity Well',
    description: 'Place gravity attractors and repulsors to guide a drifting particle to the goal. Careful — your wells also pull hazard debris into the path.',
    categories: ['Puzzle', 'Strategy'],
    controls: 'Mouse click to place/remove wells, Scroll to adjust strength',
    howToPlay: [
      'Click to place gravity wells that attract or repel particles',
      'Guide the drifting particle through the goal zone',
      'Avoid pulling hazard debris into the particle path',
      'Use the scroll wheel to fine-tune well strength',
      'Remove misplaced wells by clicking on them again',
    ],
    controlsList: [
      { key: 'Left Click', action: 'Place / remove well' },
      { key: 'Right Click', action: 'Toggle attractor / repulsor' },
      { key: 'Scroll', action: 'Adjust well strength' },
    ],
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
    howToPlay: [
      'Click a color on the palette to flood-fill your territory',
      'Absorb adjacent regions that match your chosen color',
      'Plan ahead to unlock locked regions strategically',
      'Conquer the entire board in as few moves as possible',
    ],
    controlsList: [
      { key: 'Left Click', action: 'Select color from palette' },
    ],
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
    howToPlay: [
      'Move through dark rooms using the Arrow Keys',
      'Click to send a sound pulse that reveals your surroundings',
      'Enemies freeze while illuminated by the pulse',
      'Time your pulses carefully — enemies move in the dark',
      'Reach the exit before your pulse charges run out',
    ],
    controlsList: [
      { key: 'Arrow Keys', action: 'Move character' },
      { key: 'Left Click', action: 'Send sound pulse' },
    ],
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
    howToPlay: [
      'Move your creature with Arrow Keys or WASD',
      'Press Space to dig through terrain and create tunnels',
      'Collect buried treasure scattered throughout the level',
      'Avoid breaking into water or lava pockets',
      'Plan your tunnels to stay safe from floods and flows',
    ],
    controlsList: [
      { key: 'Arrow Keys / WASD', action: 'Move creature' },
      { key: 'Space', action: 'Dig terrain' },
    ],
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
    howToPlay: [
      'Move with WASD and aim your beam with the mouse',
      'Hold click to fire a continuous sine-wave beam',
      'Scroll to adjust your beam frequency to match enemy resonance',
      'Destroy geometric enemies by hitting their resonant frequency',
      'Manage your beam energy — overheating leaves you vulnerable',
    ],
    controlsList: [
      { key: 'WASD', action: 'Move character' },
      { key: 'Mouse', action: 'Aim beam' },
      { key: 'Hold Click', action: 'Fire beam' },
      { key: 'Scroll', action: 'Adjust frequency' },
    ],
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
    howToPlay: [
      'Click and drag planets to adjust their velocity vectors',
      'Maintain stable orbits as long as possible',
      'Watch for rogue asteroids and solar flares disrupting paths',
      'Use Space to pause and plan your next adjustment',
    ],
    controlsList: [
      { key: 'Click & Drag', action: 'Adjust planet velocity' },
      { key: 'Space', action: 'Pause simulation' },
    ],
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
    howToPlay: [
      'Move the Host with WASD and aim the Parasite with the mouse',
      'Press Space to link or unlink the two organisms',
      'Use the elastic tether to clothesline enemy waves',
      'Coordinate both organisms to survive incoming attacks',
    ],
    controlsList: [
      { key: 'WASD', action: 'Move Host' },
      { key: 'Mouse', action: 'Aim Parasite' },
      { key: 'Space', action: 'Link / unlink organisms' },
    ],
    difficulty: 'Medium',
    thumbnail: '/thumbnails/symbiosis.svg',
    color: '#d946ef',
    isNew: true,
  },
  {
    slug: 'drift',
    title: 'Drift',
    description: 'A zero-friction momentum puzzle. Push off walls and drift through hazardous rooms. No legs, no brakes — just pure ghost momentum.',
    categories: ['Puzzle', 'Action'],
    controls: 'Click & drag to aim, release to launch. Arrow Keys/WASD to aim, Space to charge & launch, R to restart',
    howToPlay: [
      'Click and drag to aim your launch direction, then release',
      'Drift through rooms using pure momentum — there are no brakes',
      'Bounce off walls to change direction and reach the exit',
      'Avoid hazards scattered throughout each room',
      'Press R to restart the current level if you get stuck',
    ],
    controlsList: [
      { key: 'Click & Drag', action: 'Aim and launch' },
      { key: 'Arrow Keys / WASD', action: 'Aim direction' },
      { key: 'Space', action: 'Charge and launch' },
      { key: 'R', action: 'Restart level' },
    ],
    difficulty: 'Medium',
    thumbnail: '/thumbnails/drift.svg',
    color: '#51e2ff',
    isNew: true,
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
