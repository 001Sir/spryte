import { games } from '@/data/games';
import BentoMosaic from '@/components/game/BentoMosaic';
import RecentlyPlayed from '@/components/game/RecentlyPlayed';
import Favorites from '@/components/game/Favorites';
import DailyChallenge from '@/components/game/DailyChallenge';

export default function Home() {
  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Spryte Games',
    url: 'https://sprytegames.com',
    description:
      'Play free browser games instantly. No downloads, no installs — just fun.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://sprytegames.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Spryte Games',
    url: 'https://sprytegames.com',
    logo: 'https://sprytegames.com/logo.png',
    sameAs: ['https://twitter.com/SpryteGames'],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contact@sprytegames.com',
      contactType: 'customer service',
    },
  };

  const gameListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'All Games on Spryte Games',
    numberOfItems: games.length,
    itemListElement: games.map((game, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: game.title,
      url: `https://sprytegames.com/games/${game.slug}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameListJsonLd) }}
      />

      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 pt-16">
        {/* Page header */}
        <div className="mb-8">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-dim mb-2">Browse Collection</p>
          <h1 className="text-[clamp(1.8rem,5vw,2.4rem)] font-black tracking-tight font-[family-name:var(--font-display)]" style={{ letterSpacing: '-0.03em' }}>
            {games.length} Games. One <span className="text-accent">Platform</span>.
          </h1>
        </div>

        {/* Recently Played (client-only, renders if has history) */}
        <RecentlyPlayed />

        {/* Favorites (client-only, renders if has favorites) */}
        <Favorites />

        {/* Bento Mosaic Grid — everything in one grid */}
        <BentoMosaic games={games} dailyChallenge={<DailyChallenge />} />
      </div>
    </>
  );
}
