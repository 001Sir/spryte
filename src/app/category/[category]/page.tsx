import { notFound } from 'next/navigation';
import { getAllCategories, getGamesByCategory } from '@/data/games';
import { getCategoryColor, getCategoryIcon } from '@/data/categories';
import CategoryGameGrid from '@/components/game/CategoryGameGrid';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return getAllCategories().map((c) => ({ category: c.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return {
    title: `Free ${label} Games — Play Online`,
    description: `Play free ${label} games in your browser on Spryte Games. No downloads, no installs — instant ${label.toLowerCase()} gaming fun.`,
    keywords: [
      `${label.toLowerCase()} games`,
      `free ${label.toLowerCase()} games`,
      `online ${label.toLowerCase()} games`,
      'browser games',
      'no download games',
    ],
    openGraph: {
      title: `Free ${label} Games — Spryte Games`,
      description: `Play free ${label} games in your browser. No downloads required.`,
      url: `https://sprytegames.com/category/${category}`,
      images: [
        {
          url: '/og-image.png',
          width: 1200,
          height: 630,
          alt: `Free ${label} Games on Spryte Games`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Free ${label} Games — Spryte Games`,
      description: `Play free ${label} games in your browser. No downloads required.`,
      images: ['/og-image.png'],
    },
    alternates: {
      canonical: `https://sprytegames.com/category/${category}`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const catGames = getGamesByCategory(category);
  if (catGames.length === 0) notFound();

  const label = category.charAt(0).toUpperCase() + category.slice(1);
  const color = getCategoryColor(category);
  const icon = getCategoryIcon(category);

  const categoryJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Free ${label} Games`,
    description: `Play free ${label} games in your browser on Spryte Games. No downloads, no installs.`,
    url: `https://sprytegames.com/category/${category}`,
    mainEntity: {
      '@type': 'ItemList',
      name: `${label} Games`,
      numberOfItems: catGames.length,
      itemListElement: catGames.map((game, i) => ({
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
        name: `${label} Games`,
        item: `https://sprytegames.com/category/${category}`,
      },
    ],
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
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
        <span className="text-foreground font-medium">{label} Games</span>
      </nav>

      {/* Category header */}
      <div
        className="rounded-xl p-6 mb-8 border border-white/[0.06] relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}15, ${color}08, transparent)`, borderLeftWidth: '3px', borderLeftColor: color }}
      >
        <div
          className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] rounded-full opacity-10 blur-2xl"
          style={{ background: color }}
        />
        <div className="relative">
          <span className="text-3xl mb-2 block" aria-hidden="true">{icon}</span>
          <h1 className="text-3xl font-bold" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.3)' }}>{label} Games</h1>
          <p className="text-muted mt-1">
            {catGames.length} free {label.toLowerCase()} game{catGames.length !== 1 ? 's' : ''} to play instantly in your browser — no downloads required.
          </p>
        </div>
      </div>

      <CategoryGameGrid games={catGames} />
    </div>
  );
}
