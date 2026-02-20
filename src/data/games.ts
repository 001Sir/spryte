import { Game } from '@/types/game';

export const games: Game[] = [
  {
    slug: 'gravity-well',
    title: 'Gravity Well',
    description: 'Place gravity attractors and repulsors to guide a drifting particle to the goal. Careful — your wells also pull hazard debris into the path.',
    categories: ['Puzzle', 'Physics'],
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
    categories: ['Action', 'Arcade'],
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
    categories: ['Strategy', 'Physics'],
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
    categories: ['Puzzle', 'Arcade'],
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
  {
    slug: 'spectrum',
    title: 'Spectrum',
    description: 'Place estimates on a number line and bet your confidence from 1x to 5x. Build nerve chains with bold accurate guesses — but miss big and the chain breaks.',
    categories: ['Puzzle', 'Strategy'],
    controls: 'Mouse drag to estimate, Click to lock in, 1-5 keys for confidence, Enter to confirm',
    howToPlay: [
      'A question appears — drag the marker on the number line to place your estimate',
      'Lock in your estimate by clicking away from the line or pressing Enter',
      'Bet your confidence: 1x (safe) to 5x (nerve) — higher risk, higher reward',
      'Score is based on accuracy × confidence multiplier',
      'Consecutive accurate answers at 3x+ confidence build a nerve chain with escalating bonuses',
      'Miss badly at high confidence and the chain breaks with a score penalty',
    ],
    controlsList: [
      { key: 'Mouse Drag', action: 'Move estimate on number line' },
      { key: 'Arrow Keys', action: 'Fine-tune estimate' },
      { key: '1-5 Keys', action: 'Select confidence level' },
      { key: 'Enter', action: 'Lock in / Confirm' },
    ],
    difficulty: 'Medium',
    thumbnail: '/thumbnails/spectrum.svg',
    color: '#f97316',
    isNew: true,
  },
  {
    slug: 'deja-vu',
    title: 'Déjà Vu',
    description: 'Shapes appear one at a time — answer "New" or "Seen before." Decoy shapes that differ by just one property add psychological challenge. Rewards speed, accuracy, and streaks.',
    categories: ['Puzzle', 'Arcade'],
    controls: 'N / Left Arrow = New, S / Right Arrow = Seen, Enter to start',
    howToPlay: [
      'Shapes appear one at a time — decide if you\'ve seen each one before',
      'Press N or Left Arrow to answer "New", S or Right Arrow for "Seen"',
      'Beware of decoys: shapes that look similar but differ by one property are still NEW',
      'Faster correct answers earn speed bonuses — the timer shrinks each round',
      'Build streaks for score multipliers up to 2x — wrong answers reset your streak',
      'You have 3 lives — losing all lives or surviving 30 rounds ends the game',
    ],
    controlsList: [
      { key: 'N / ←', action: 'Answer "New"' },
      { key: 'S / →', action: 'Answer "Seen"' },
      { key: 'Enter / Space', action: 'Start / Play again' },
      { key: 'Click / Tap', action: 'Press buttons' },
    ],
    difficulty: 'Medium',
    thumbnail: '/thumbnails/deja-vu.svg',
    color: '#14b8a6',
    isNew: true,
  },
  {
    slug: 'slide-devil',
    title: 'Slide Devil',
    description: 'A troll platformer with zero friction. Floors vanish, gravity flips, exits teleport, and controls reverse — all while you slide uncontrollably.',
    categories: ['Action', 'Arcade'],
    controls: 'Arrow Keys / WASD to move, Up / Space to jump, R to restart',
    howToPlay: [
      'Move and jump through 15 increasingly devious levels',
      'Beware: near-zero friction means you slide on everything',
      'Floors crumble, gravity flips, and exits move when you get close',
      'Wall-jump to escape traps and reach the exit door',
      'Press R to restart the current level after dying',
    ],
    controlsList: [
      { key: 'Arrow Keys / WASD', action: 'Move left/right' },
      { key: 'Up / Space', action: 'Jump / Wall-jump' },
      { key: 'R', action: 'Restart level' },
      { key: 'P', action: 'Pause' },
    ],
    difficulty: 'Hard',
    thumbnail: '/thumbnails/slide-devil.svg',
    color: '#dc2626',
    isNew: true,
  },
  {
    slug: 'whats-missing',
    title: "What's Missing?",
    description: 'Memorize a procedurally generated scene, then spot what disappeared. Five themed worlds — rooms, kitchens, parks, space, and ocean — with hybrid controls that shift from multiple choice to click-the-spot as difficulty ramps up.',
    categories: ['Puzzle', 'Arcade'],
    controls: 'Click to select answer or click where the object was, Enter to start',
    howToPlay: [
      'A scene full of objects appears — memorize it before time runs out',
      'One object is removed — figure out what\'s missing!',
      'Early rounds: pick from multiple choice buttons below the scene',
      'Later rounds: click the exact spot where the missing object was',
      'Watch out for trick rounds where nothing was removed!',
      'Faster answers earn speed bonuses — build streaks for up to 3x multiplier',
      'You have 3 lives — wrong answers and timeouts cost a life',
    ],
    controlsList: [
      { key: 'Click / Tap', action: 'Select answer or click missing spot' },
      { key: '1-4 Keys', action: 'Quick-select choice (easy rounds)' },
      { key: 'Enter / Space', action: 'Start / Play again' },
    ],
    difficulty: 'Medium',
    thumbnail: '/thumbnails/whats-missing.svg',
    color: '#e879f9',
    isNew: true,
  },
  {
    slug: 'cascade',
    title: 'Cascade',
    description: 'Numbers rain into columns. When adjacent numbers sum to 10, they explode — triggering chain reactions that multiply your score. One smart placement can set off a 15-combo cascade.',
    categories: ['Puzzle', 'Arcade'],
    controls: 'Arrow Keys / A-D to move, Down / Space to drop, Click column to drop',
    howToPlay: [
      'Numbers fall one at a time — move them left/right and drop into columns',
      'When two adjacent numbers (horizontal or vertical) sum to 10, they explode',
      'Explosions cascade: everything above drops, potentially triggering more matches',
      'Each chain level doubles your score multiplier (1x → 2x → 4x → 8x...)',
      'Watch the NEXT preview to plan your placement',
      'Game over when a column fills to the top',
    ],
    controlsList: [
      { key: '← → / A D', action: 'Move piece left/right' },
      { key: '↓ / S / Space', action: 'Instant drop' },
      { key: 'Click Column', action: 'Drop piece there' },
      { key: 'P', action: 'Pause' },
    ],
    difficulty: 'Easy',
    thumbnail: '/thumbnails/cascade.svg',
    color: '#f59e0b',
    isNew: true,
  },
  {
    slug: 'ricochet',
    title: 'Ricochet',
    description: 'One shot per level. Your bullet bounces off walls and must hit every target in a single ricochet chain. Aim, fire, watch. 30 levels of increasing precision.',
    categories: ['Puzzle', 'Action'],
    controls: 'Click & drag to aim, release to fire, R to retry',
    howToPlay: [
      'You get ONE shot per level — aim carefully',
      'Click and drag from the cannon to set your angle',
      'A dotted line previews your first few bounces',
      'Release to fire — the bullet ricochets off walls',
      'Hit ALL targets to complete the level',
      'Later levels add boost walls (blue), split walls (purple), and moving targets',
    ],
    controlsList: [
      { key: 'Click & Drag', action: 'Aim shot' },
      { key: 'Release', action: 'Fire' },
      { key: 'R', action: 'Retry level' },
      { key: 'P', action: 'Pause' },
    ],
    difficulty: 'Medium',
    thumbnail: '/thumbnails/ricochet.svg',
    color: '#22d3ee',
    isNew: true,
  },
  {
    slug: 'burn',
    title: 'Burn',
    description: 'Place ignition points on a procedural map. Fire spreads through grass, trees, and buildings — but stops at water and stone. Burn exactly the target percentage. Too much or too little and you fail.',
    categories: ['Strategy', 'Puzzle'],
    controls: 'Click to ignite, Enter to extinguish, R to restart',
    howToPlay: [
      'Click on flammable terrain to place an ignition point',
      'Fire spreads realistically — grass burns fast, buildings burn slow',
      'Water, stone, and dirt are natural firebreaks',
      'Wind direction affects spread speed — watch the compass indicator',
      'Press Enter/Space to extinguish all fire when you think you\'ve hit the target',
      'Your burn percentage must land within the target range to win',
      'Closer to the exact center of the range = more points',
    ],
    controlsList: [
      { key: 'Left Click', action: 'Place ignition point' },
      { key: 'Enter / Space', action: 'Extinguish fire / Continue' },
      { key: 'R', action: 'Restart level' },
      { key: 'P', action: 'Pause' },
    ],
    difficulty: 'Medium',
    thumbnail: '/thumbnails/burn.svg',
    color: '#f97316',
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
