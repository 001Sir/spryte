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
      <section className="relative rounded-2xl overflow-hidden mb-14 border border-border">
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
              className="rounded-full mb-4"
              aria-hidden="true"
              priority
            />
            <span className="text-xs font-medium uppercase tracking-wider text-accent">
              Featured Game
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mt-2 mb-4 leading-tight">
              {featured.title}
            </h1>
            <p className="text-muted mb-6 text-lg">{featured.description}</p>

            {/* Stat badges */}
            <div className="flex flex-wrap gap-3 mb-8">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-foreground/80">
                🎮 {games.length} Games
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-foreground/80">
                📂 {categories.length} Categories
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-foreground/80">
                ✨ Free Forever
              </span>
            </div>

            <Link
              href={`/games/${featured.slug}`}
              className="animate-glow inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-7 py-3.5 rounded-xl font-semibold transition-all duration-300"
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

      {/* Recently Played */}
      <RecentlyPlayed />

      {/* All Games / Trending */}
      <section className="mb-14" id="games">
        <h2 className="text-2xl font-bold mb-6">All Games</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {games.map((game) => (
            <GameCard key={game.slug} game={game} />
          ))}
        </div>
      </section>

      {/* Browse by Category */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {categories.map((cat) => {
            const catGames = getGamesByCategory(cat);
            const color = categoryColors[cat] || '#e94560';
            const icon = categoryIcons[cat] || '🎮';
            return (
              <Link
                key={cat}
                href={`/category/${cat.toLowerCase()}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-accent/40 transition-all duration-200 p-5 hover:scale-[1.02]"
              >
                <div
                  className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity"
                  style={{ background: `linear-gradient(135deg, ${color}, transparent)` }}
                />
                <div className="relative">
                  <span className="text-2xl mb-2 block">{icon}</span>
                  <h3 className="font-semibold text-foreground">{cat}</h3>
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
