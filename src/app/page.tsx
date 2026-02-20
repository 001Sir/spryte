import { games, getAllCategories, getGamesByCategory } from '@/data/games';
import { categoryColors, categoryIcons } from '@/data/categories';
import GameCard from '@/components/game/GameCard';
import RecentlyPlayed from '@/components/game/RecentlyPlayed';
import Favorites from '@/components/game/Favorites';
import DailyChallenge from '@/components/game/DailyChallenge';
import ScrollableRow from '@/components/layout/ScrollableRow';
import Link from 'next/link';
import Image from 'next/image';

const difficultyDot: Record<string, string> = {
  Easy: '#4ade80',
  Medium: '#f59e0b',
  Hard: '#e94560',
};

export default function Home() {
  const featured = games.find((g) => g.featured) || games[0];
  const categories = getAllCategories();
  const newGames = games.filter((g) => g.isNew);

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
    sameAs: [
      'https://twitter.com/SpryteGames',
    ],
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

  // Split featured title for accent styling
  const titleWords = featured.title.split(' ');
  const firstWord = titleWords[0];
  const restWords = titleWords.slice(1).join(' ');

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

      {/* ── Hero — Full viewport cinematic ── */}
      <section className="relative min-h-screen flex items-end overflow-hidden">
        {/* Shimmer skeleton — visible until video/image loads */}
        <div className="absolute inset-0 z-[0] animate-shimmer bg-gradient-to-r from-transparent via-white/[0.02] to-transparent" />
        {/* Blurred backdrop — video if preview exists, otherwise thumbnail */}
        <div className="absolute inset-0 z-[1]">
          {featured.preview ? (
            <video
              src={featured.preview}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover opacity-30"
              aria-hidden="true"
            />
          ) : (
            <Image
              src={featured.thumbnail}
              alt=""
              fill
              className="object-cover opacity-30"
              priority
              aria-hidden="true"
            />
          )}
        </div>
        {/* Vignette */}
        <div className="absolute inset-0 z-[2]" style={{ background: 'radial-gradient(ellipse at 50% 30%, transparent 20%, #06050e 80%)' }} />
        {/* Bottom gradient — strong fade to bg */}
        <div className="absolute bottom-0 left-0 right-0 h-[70%] z-[3]" style={{ background: 'linear-gradient(to top, #06050e 0%, #06050e 15%, rgba(6,5,14,0.8) 40%, transparent)' }} />

        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-4 sm:px-10 pb-20 pt-32">
          {/* H1 with pulsing dot — primary SEO heading */}
          <div className="flex items-center gap-2 mb-5">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-dot" />
            <h1 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-accent">
              Free Browser Games — Play Instantly
            </h1>
          </div>

          {/* Featured game title */}
          <h2
            className="text-[clamp(2.5rem,7vw,4.5rem)] font-black leading-[1] tracking-tight mb-4 max-w-[700px]"
            style={{ letterSpacing: '-0.03em' }}
          >
            {firstWord} <span className="text-accent">{restWords}</span>
          </h2>

          <p className="text-muted text-[1.05rem] leading-relaxed max-w-[500px] mb-9">
            {featured.description}
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-4 mb-8">
            <Link
              href={`/games/${featured.slug}`}
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-[14px] bg-accent text-white font-bold text-[0.95rem] transition-all duration-300 hover:-translate-y-0.5 shadow-[0_4px_30px_rgba(233,69,96,0.3),inset_0_1px_0_rgba(255,255,255,0.15)] hover:shadow-[0_8px_40px_rgba(233,69,96,0.4),inset_0_1px_0_rgba(255,255,255,0.15)]"
              aria-label={`Play ${featured.title} now`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
              Play Now
            </Link>
            <Link
              href={`/games/${featured.slug}#how-to-play`}
              className="inline-flex items-center gap-2 px-7 py-4 rounded-[14px] backdrop-blur-lg bg-white/[0.04] border border-white/[0.1] text-foreground font-semibold text-[0.9rem] transition-all duration-300 hover:bg-white/[0.08] hover:border-white/[0.2]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              How to Play
            </Link>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-[0.8rem] text-dim">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: difficultyDot[featured.difficulty] || '#9896a8' }}
              />
              {featured.difficulty}
            </div>
            <span className="text-[0.8rem] text-dim">
              {featured.categories.join(' / ')}
            </span>
            <span className="text-[0.8rem] text-dim">
              {featured.controls.split(',')[0]}
            </span>
          </div>
        </div>

        {/* Game preview card — floating on right (tablet + desktop) */}
        <div className="hidden md:block absolute right-6 md:right-8 lg:right-10 xl:right-20 bottom-24 z-10">
          <div className="relative w-[240px] lg:w-[320px] rounded-2xl overflow-hidden border border-white/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.5)] group/preview">
            <div className="aspect-[16/10] relative overflow-hidden">
              {featured.preview ? (
                <video
                  src={featured.preview}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image
                  src={featured.thumbnail}
                  alt={`${featured.title} preview`}
                  fill
                  sizes="(max-width: 1024px) 240px, 320px"
                  className="object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#111024] via-transparent to-transparent" />
              {/* Play overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/preview:bg-black/40 transition-colors">
                <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-[0_4px_20px_rgba(233,69,96,0.4)] transition-transform duration-300 group-hover/preview:scale-110">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="ml-0.5" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-[0.7rem] font-semibold text-foreground">{featured.title}</span>
                <span className="text-[0.6rem] text-dim px-2 py-0.5 rounded bg-white/[0.04]">{featured.categories[0]}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1.5 animate-scroll-cue">
          <span className="text-[0.65rem] uppercase tracking-[0.1em] text-dim">Scroll</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-dim" aria-hidden="true">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </div>
      </section>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-10">
        {/* ── Daily Challenge ── */}
        <div className="pt-12">
          <DailyChallenge />
        </div>

        {/* ── New Releases — Horizontal Showcase ── */}
        {newGames.length > 0 && (
          <section className="mb-20 pt-12">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-baseline gap-3">
                <h2 className="text-[1.3rem] font-bold tracking-tight">New Releases</h2>
                <span className="text-dim text-[0.85rem]">{newGames.length} games just dropped</span>
              </div>
            </div>
            <ScrollableRow className="flex gap-5 overflow-x-auto pb-4 snap-scroll-x">
              {newGames.map((game) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  className="group shrink-0 w-[340px] rounded-2xl overflow-hidden border border-white/[0.06] bg-card hover:border-white/[0.12] card-glow transition-all duration-400"
                  style={{
                    '--glow-color': `${game.color}20`,
                  } as React.CSSProperties}
                  aria-label={`Play ${game.title}`}
                >
                  <div
                    className="aspect-[16/10] relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${game.color}22, ${game.color}44)` }}
                  >
                    <Image
                      src={game.thumbnail}
                      alt={`${game.title} thumbnail`}
                      fill
                      sizes="340px"
                      className="object-cover transition-transform duration-600 group-hover:scale-105"
                      style={{ transitionTimingFunction: 'var(--ease-cinematic)' }}
                    />
                    {/* Overlay on hover with blur */}
                    <div className="absolute inset-0 bg-[#06050e]/60 backdrop-blur-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center shadow-[0_4px_20px_rgba(233,69,96,0.4)] scale-[0.8] group-hover:scale-100 transition-transform duration-300">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white" className="ml-0.5" aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-1.5 z-[2]">
                      <span className="text-[0.6rem] font-bold uppercase tracking-[0.06em] px-2.5 py-1 rounded-md backdrop-blur-md bg-green-500/20 text-green-400 border border-green-500/20">
                        New
                      </span>
                    </div>
                  </div>
                  {/* Body */}
                  <div className="p-4">
                    <div className="font-bold text-[0.95rem] mb-1.5">{game.title}</div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[0.7rem] text-dim px-2 py-0.5 rounded bg-white/[0.04]">
                        {game.categories[0]}
                      </span>
                      <span className="flex items-center gap-1 text-[0.7rem] text-dim">
                        <span
                          className="w-[5px] h-[5px] rounded-full"
                          style={{ background: difficultyDot[game.difficulty] || '#9896a8' }}
                        />
                        {game.difficulty}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </ScrollableRow>
          </section>
        )}

        {/* ── Recently Played ── */}
        <RecentlyPlayed />

        {/* ── Favorites ── */}
        <Favorites />

        {/* ── Category Strip ── */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[1.3rem] font-bold tracking-tight">Browse Categories</h2>
          </div>
          <ScrollableRow className="flex gap-3 overflow-x-auto pb-2" >
            {categories.map((cat) => {
              const catGames = getGamesByCategory(cat);
              const color = categoryColors[cat] || '#e94560';
              const icon = categoryIcons[cat] || '🎮';
              return (
                <Link
                  key={cat}
                  href={`/category/${cat.toLowerCase()}`}
                  className="group shrink-0 flex items-center gap-2.5 px-6 py-3.5 rounded-[14px] bg-card border border-white/[0.06] hover:border-white/[0.12] hover:bg-card-hover hover:-translate-y-0.5 transition-all duration-300 whitespace-nowrap"
                >
                  {/* Colored vertical bar */}
                  <div
                    className="w-[3px] h-6 rounded-full opacity-60 group-hover:opacity-100 transition-opacity"
                    style={{ background: color }}
                  />
                  <span className="text-lg" aria-hidden="true">{icon}</span>
                  <span className="font-semibold text-[0.85rem] text-foreground">{cat}</span>
                  <span className="text-[0.7rem] text-dim ml-1">({catGames.length})</span>
                </Link>
              );
            })}
          </ScrollableRow>
        </section>

        {/* ── All Games ── */}
        <section className="mb-20" id="games">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-[1.3rem] font-bold tracking-tight">All Games</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {games.map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
