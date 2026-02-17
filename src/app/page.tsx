import { games, getAllCategories, getGamesByCategory } from '@/data/games';
import { categoryColors, categoryIcons } from '@/data/categories';
import GameCard from '@/components/game/GameCard';
import RecentlyPlayed from '@/components/game/RecentlyPlayed';
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
    <div className="max-w-7xl mx-auto px-4 py-8">
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
      {/* Hero */}
      <section className="relative rounded-2xl overflow-hidden mb-14 border border-border shadow-[0_0_60px_rgba(233,69,96,0.06)]">
        <div
          className="animate-gradient p-8 sm:p-12 md:p-16 relative"
          style={{
            background: `linear-gradient(135deg, ${featured.color}20, #e9456020, ${featured.color}30, #0a0a0f)`,
            backgroundSize: '200% 200%',
          }}
        >
          {/* Subtle decorative circles */}
          <div
            className="absolute top-[-50px] right-[-50px] w-[200px] h-[200px] rounded-full opacity-10 blur-3xl"
            style={{ background: featured.color }}
          />
          <div
            className="absolute bottom-[-30px] left-[20%] w-[150px] h-[150px] rounded-full opacity-10 blur-3xl"
            style={{ background: '#e94560' }}
          />

          <div className="relative max-w-lg">
            <Image
              src="/logo.png"
              alt=""
              width={64}
              height={64}
              className="rounded-full mb-4 shadow-lg"
              aria-hidden="true"
              priority
            />
            <span className="text-xs font-medium uppercase tracking-wider text-accent">
              Featured Game
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mt-2 mb-4 leading-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5)' }}>
              {featured.title}
            </h1>
            <p className="text-muted mb-6 text-lg leading-relaxed">{featured.description}</p>

            {/* Stat badges */}
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-foreground/80 backdrop-blur-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
                  <rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 12h4M8 10v4" />
                </svg>
                {games.length} Games
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-foreground/80 backdrop-blur-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                {categories.length} Categories
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-foreground/80 backdrop-blur-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Free Forever
              </span>
            </div>

            <Link
              href={`/games/${featured.slug}`}
              className="animate-glow inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-7 py-3.5 rounded-xl font-semibold transition-all duration-300 shadow-lg shadow-accent/20"
              aria-label={`Play ${featured.title} now`}
            >
              Play Now
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* New Games */}
      {games.filter((g) => g.isNew).length > 0 && (
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400 shrink-0" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <h2 className="text-2xl font-bold">New Games</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {games.filter((g) => g.isNew).map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Played */}
      <RecentlyPlayed />

      {/* All Games */}
      <section className="mb-14" id="games">
        <div className="flex items-center gap-3 mb-6">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent shrink-0" aria-hidden="true">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <path d="M6 12h4M8 10v4M15 11h.01M18 13h.01" />
          </svg>
          <h2 className="text-2xl font-bold">All Games</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {games.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      {/* Browse by Category */}
      <section className="mb-14">
        <div className="flex items-center gap-3 mb-6">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent shrink-0" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <h2 className="text-2xl font-bold">Browse by Category</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {categories.map((cat) => {
            const catGames = getGamesByCategory(cat);
            const color = categoryColors[cat] || '#e94560';
            const icon = categoryIcons[cat] || '🎮';
            return (
              <Link
                key={cat}
                href={`/category/${cat.toLowerCase()}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-accent/40 transition-all duration-200 p-5 hover:scale-[1.02] card-glow"
                style={{ '--glow-color': `${color}18` } as React.CSSProperties}
              >
                <div
                  className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
                  style={{ background: `linear-gradient(135deg, ${color}, transparent)` }}
                />
                {/* Colored top bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 opacity-40 group-hover:opacity-80 transition-opacity" style={{ background: color }} />
                <div className="relative">
                  <span className="text-2xl mb-2 block" aria-hidden="true">{icon}</span>
                  <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors">{cat}</h3>
                  <p className="text-xs text-muted mt-1">
                    {catGames.length} game{catGames.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
