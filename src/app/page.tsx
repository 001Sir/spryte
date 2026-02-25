import { games, getAllCategories, getGamesByCategory } from '@/data/games';
import { categoryColors, categoryIcons } from '@/data/categories';
import GameGrid from '@/components/game/GameGrid';
import RecentlyPlayed from '@/components/game/RecentlyPlayed';
import Favorites from '@/components/game/Favorites';
import DailyChallenge from '@/components/game/DailyChallenge';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  const featured = games.find((g) => g.featured) || games[0];
  const categories = getAllCategories();

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

      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 pt-8">
        {/* ── Top row: Featured banner + Daily Challenge ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-4 mb-10">
          {/* Featured game banner */}
          <Link
            href={`/games/${featured.slug}`}
            className="group relative rounded-2xl overflow-hidden border border-white/[0.06] hover:border-white/[0.1] transition-all duration-300 card-glow"
            style={{ '--glow-color': `${featured.color}20` } as React.CSSProperties}
            aria-label={`Play ${featured.title}`}
          >
            <div className="relative aspect-[21/9] sm:aspect-[24/9] overflow-hidden">
              {featured.preview ? (
                <video
                  src={featured.preview}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                  aria-hidden="true"
                />
              ) : (
                <Image
                  src={featured.thumbnail}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  style={{ transitionTimingFunction: 'var(--ease-cinematic)' }}
                  priority
                  aria-hidden="true"
                />
              )}
              {/* Gradient overlays */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#06050e]/90 via-[#06050e]/40 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#06050e]/60 via-transparent to-transparent" />

              {/* Content overlay */}
              <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-7">
                <div className="flex items-center gap-2 mb-2">
                  {featured.isNew && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/20">New</span>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-accent/20 text-accent border border-accent/20">Featured</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight font-[family-name:var(--font-display)] mb-1.5" style={{ letterSpacing: '-0.02em' }}>
                  {featured.title}
                </h1>
                <p className="text-sm text-white/60 max-w-md line-clamp-1 mb-3 hidden sm:block">
                  {featured.description}
                </p>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold shadow-[0_4px_16px_rgba(233,69,96,0.3)] group-hover:shadow-[0_4px_24px_rgba(233,69,96,0.4)] transition-shadow">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play Now
                  </span>
                  <span className="text-xs text-white/40 hidden sm:flex items-center gap-3">
                    <span>{featured.categories[0]}</span>
                    <span>&middot;</span>
                    <span>{featured.difficulty}</span>
                  </span>
                </div>
              </div>
            </div>
          </Link>

          {/* Daily Challenge */}
          <DailyChallenge />
        </div>

        {/* ── Continue Playing (client-only, renders if has history) ── */}
        <RecentlyPlayed />

        {/* ── Favorites (client-only, renders if has favorites) ── */}
        <Favorites />

        {/* ── Browse: Category tabs + Game grid ── */}
        <section className="mb-16" id="games">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold tracking-tight font-[family-name:var(--font-display)]">
              All Games
            </h2>
            <span className="text-[0.65rem] font-semibold px-2 py-0.5 rounded-full bg-accent-soft/10 text-accent-soft">
              {games.length}
            </span>
          </div>

          {/* Category filter tabs */}
          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 scrollbar-hide">
            {categories.map((cat) => {
              const color = categoryColors[cat] || '#e94560';
              const icon = categoryIcons[cat] || '🎮';
              const count = getGamesByCategory(cat).length;
              return (
                <Link
                  key={cat}
                  href={`/category/${cat.toLowerCase()}`}
                  className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.06] transition-all text-sm whitespace-nowrap"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="text-[0.8rem] text-dim">{icon}</span>
                  <span className="text-[0.8rem] font-medium text-foreground">{cat}</span>
                  <span className="text-[0.65rem] text-dim/50">{count}</span>
                </Link>
              );
            })}
          </div>

          {/* Game grid */}
          <GameGrid games={games} />
        </section>
      </div>
    </>
  );
}
