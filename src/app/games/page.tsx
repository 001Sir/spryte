import { games, getAllCategories, getGamesByCategory } from '@/data/games';
import { categoryColors, categoryIcons } from '@/data/categories';
import GameCard from '@/components/game/GameCard';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'All Free Browser Games — Play Online',
  description:
    'Browse all free browser games on Spryte Games. Action, puzzle, arcade, strategy & physics games — no downloads, no installs, play instantly.',
  keywords: [
    'free browser games',
    'online games list',
    'HTML5 games',
    'no download games',
    'play free games',
    'browser gaming',
  ],
  openGraph: {
    title: 'All Free Browser Games — Spryte Games',
    description:
      'Browse all free browser games. Action, puzzle, arcade, strategy & physics games — play instantly.',
    url: 'https://sprytegames.com/games',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'All Games on Spryte Games',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Free Browser Games — Spryte Games',
    description:
      'Browse all free browser games. Action, puzzle, arcade, strategy & physics — play instantly.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://sprytegames.com/games',
  },
};

export default function GamesPage() {
  const categories = getAllCategories();

  const gamesListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'All Free Browser Games',
    description:
      'Browse all free browser games on Spryte Games. No downloads required.',
    url: 'https://sprytegames.com/games',
    mainEntity: {
      '@type': 'ItemList',
      name: 'All Games',
      numberOfItems: games.length,
      itemListElement: games.map((game, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: game.title,
        url: `https://sprytegames.com/games/${game.slug}`,
      })),
    },
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://sprytegames.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'All Games',
        item: 'https://sprytegames.com/games',
      },
    ],
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gamesListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Breadcrumbs */}
      <nav
        className="flex items-center gap-2 text-sm text-muted mb-5"
        aria-label="Breadcrumb"
      >
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="opacity-40"
          aria-hidden="true"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-foreground font-medium">All Games</span>
      </nav>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">
          All Free Browser Games
        </h1>
        <p className="text-muted max-w-xl">
          {games.length} free games to play instantly in your browser. No
          downloads, no installs, no accounts — just pick a game and play.
        </p>
      </div>

      {/* Category quick links */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map((cat) => {
          const color = categoryColors[cat] || '#e94560';
          const icon = categoryIcons[cat] || '🎮';
          const count = getGamesByCategory(cat).length;
          return (
            <Link
              key={cat}
              href={`/category/${cat.toLowerCase()}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-card border border-white/[0.06] hover:border-white/[0.12] text-sm text-dim hover:text-foreground transition-all duration-200"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
              />
              <span aria-hidden="true">{icon}</span>
              {cat}
              <span className="text-xs text-dim/50">({count})</span>
            </Link>
          );
        })}
      </div>

      {/* All games grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {games.map((game) => (
          <GameCard key={game.slug} game={game} />
        ))}
      </div>
    </div>
  );
}
