import Link from 'next/link';
import Image from 'next/image';
import { getAllCategories, games, getGamesByCategory } from '@/data/games';
import { categoryIcons } from '@/data/categories';

export default function Footer() {
  const categories = getAllCategories();

  return (
    <footer className="relative z-10 border-t border-white/[0.06] mt-20 bg-surface" role="contentinfo">
      {/* Main footer content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 pt-12 pb-10">
        {/* Top row: branding + description */}
        <div className="flex flex-col sm:flex-row items-start gap-6 mb-10">
          <Link href="/" className="inline-flex items-center gap-3 group shrink-0">
            <Image
              src="/logo.png"
              alt="Spryte Games"
              width={44}
              height={44}
              className="rounded-full"
            />
            <span className="text-xl font-bold text-foreground group-hover:text-accent transition-colors">
              Spryte Games
            </span>
          </Link>
          <p className="text-sm text-dim leading-relaxed max-w-md">
            Play free browser games instantly. No downloads, no installs, no accounts — just pick a game and play. All {games.length} games run entirely in your browser using HTML5.
          </p>
        </div>

        {/* Navigation grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-8">
          {/* Games column */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-4">
              Games
            </h4>
            <nav aria-label="Popular games" className="flex flex-col gap-2.5">
              {games.slice(0, 5).map((game) => (
                <Link
                  key={game.slug}
                  href={`/games/${game.slug}`}
                  className="text-sm text-dim hover:text-foreground transition-colors"
                >
                  {game.title}
                </Link>
              ))}
              <Link
                href="/#games"
                className="text-sm text-accent hover:text-accent-hover transition-colors mt-1"
              >
                View all games
              </Link>
            </nav>
          </div>

          {/* Categories column */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-4">
              Categories
            </h4>
            <nav aria-label="Game categories" className="flex flex-col gap-2.5">
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/category/${cat.toLowerCase()}`}
                  className="text-sm text-dim hover:text-foreground transition-colors inline-flex items-center gap-2"
                >
                  <span className="text-xs" aria-hidden="true">{categoryIcons[cat] || '🎮'}</span>
                  {cat}
                  <span className="text-xs text-dim/50">({getGamesByCategory(cat).length})</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Site column */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-4">
              Site
            </h4>
            <nav aria-label="Site links" className="flex flex-col gap-2.5">
              <Link href="/" className="text-sm text-dim hover:text-foreground transition-colors">
                Home
              </Link>
              <Link href="/search" className="text-sm text-dim hover:text-foreground transition-colors">
                Search Games
              </Link>
              <Link href="/#games" className="text-sm text-dim hover:text-foreground transition-colors">
                All Games
              </Link>
            </nav>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-dim mb-4">
              Legal
            </h4>
            <nav aria-label="Legal links" className="flex flex-col gap-2.5">
              <Link href="/privacy" className="text-sm text-dim hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-dim hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-dim/70">
          <span>&copy; {new Date().getFullYear()} Spryte Games. All rights reserved.</span>
          <span>Free to play. No plugins required.</span>
        </div>
      </div>
    </footer>
  );
}
