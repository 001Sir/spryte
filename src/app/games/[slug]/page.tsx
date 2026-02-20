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
      card: 'summary_large_image',
      title: `${game.title} — Play Free on Spryte Games`,
      description: `${game.description} No downloads required.`,
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
    image: `https://sprytegames.com${game.thumbnail}`,
    genre: game.categories,
    gamePlatform: 'Web Browser',
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    playMode: 'SinglePlayer',
    numberOfPlayers: 1,
    inLanguage: 'en',
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
      logo: 'https://sprytegames.com/logo.png',
    },
  };

  const faqJsonLd = game.howToPlay
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `How do you play ${game.title}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: game.howToPlay.join(' '),
            },
          },
          {
            '@type': 'Question',
            name: `What are the controls for ${game.title}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: game.controls,
            },
          },
          {
            '@type': 'Question',
            name: `Is ${game.title} free to play?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: `Yes, ${game.title} is completely free to play in your browser on Spryte Games. No downloads or installs required.`,
            },
          },
        ],
      }
    : null;

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
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
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

      {/* SEO content section — crawlable text with cross-links */}
      <section className="mt-8 bg-card border border-white/[0.06] rounded-xl p-6">
        <h2 className="text-lg font-bold mb-3">About {game.title}</h2>
        <p className="text-sm text-muted leading-relaxed mb-4">
          {game.title} is a free {game.categories.map(c => c.toLowerCase()).join(' and ')}{' '}
          game you can play instantly in your browser on Spryte Games. {game.description}{' '}
          No downloads, no installs, and no account needed — just click play and enjoy.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-dim">Browse more:</span>
          {game.categories.map((cat) => (
            <Link
              key={cat}
              href={`/category/${cat.toLowerCase()}`}
              className="text-accent hover:underline"
            >
              Free {cat} Games
            </Link>
          ))}
          <span className="text-dim">·</span>
          <Link href="/games" className="text-accent hover:underline">
            All Games
          </Link>
        </div>
      </section>

      <RelatedGames currentGame={game} />
    </div>
  );
}
