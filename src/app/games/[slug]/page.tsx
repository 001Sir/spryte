import { notFound } from 'next/navigation';
import { games, getGameBySlug } from '@/data/games';
import GamePlayer from '@/components/game/GamePlayer';
import GameInfo from '@/components/game/GameInfo';
import RelatedGames from '@/components/game/RelatedGames';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) return {};
  return {
    title: `Play ${game.title} Free Online`,
    description: `${game.description} Play ${game.title} for free in your browser on Spryte Games — no downloads required.`,
    keywords: [
      game.title,
      ...game.categories.map((c) => `${c.toLowerCase()} games`),
      'free browser game',
      'play online',
      'no download',
    ],
    openGraph: {
      title: `${game.title} — Play Free on Spryte Games`,
      description: `${game.description} No downloads required.`,
      url: `https://sprytegames.com/games/${slug}`,
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title: `${game.title} — Spryte Games`,
      description: game.description,
    },
    alternates: {
      canonical: `https://sprytegames.com/games/${slug}`,
    },
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) notFound();

  const primaryCategory = game.categories[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoGame',
    name: game.title,
    description: game.description,
    url: `https://sprytegames.com/games/${slug}`,
    genre: game.categories,
    gamePlatform: 'Web Browser',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Spryte Games',
      url: 'https://sprytegames.com',
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
        name: primaryCategory,
        item: `https://sprytegames.com/category/${primaryCategory.toLowerCase()}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: game.title,
        item: `https://sprytegames.com/games/${slug}`,
      },
    ],
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted mb-5" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <Link
          href={`/category/${primaryCategory.toLowerCase()}`}
          className="hover:text-foreground transition-colors"
        >
          {primaryCategory}
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-foreground font-medium truncate">{game.title}</span>
      </nav>

      <GamePlayer slug={game.slug} />
      <GameInfo game={game} />
      <RelatedGames currentGame={game} />
    </div>
  );
}
