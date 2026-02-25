import Link from 'next/link';
import Image from 'next/image';
import { getAllCategories, games, getGamesByCategory } from '@/data/games';
import { categoryIcons } from '@/data/categories';

export default function Footer() {
  const categories = getAllCategories();

  return (
    <footer className="relative z-10 border-t border-white/[0.06] mt-20 bg-surface" role="contentinfo">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-10 pt-10 pb-8">
        <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">
          {/* Branding */}
          <div className="sm:max-w-[280px] shrink-0">
            <Link href="/" className="inline-flex items-center gap-2.5 group mb-3">
              <Image src="/logo.png" alt="Spryte Games" width={32} height={32} className="rounded-full" />
              <span className="text-base font-bold text-foreground group-hover:text-accent transition-colors">
                Spryte Games
              </span>
            </Link>
            <p className="text-[0.75rem] text-dim leading-relaxed">
              {games.length} free browser games. No downloads, no accounts — just play.
            </p>
          </div>

          {/* Link columns */}
          <div className="flex-1 grid grid-cols-3 gap-x-8 gap-y-6">
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dim mb-3">Categories</h4>
              <nav aria-label="Game categories" className="flex flex-col gap-1.5">
                {categories.map((cat) => (
                  <Link
                    key={cat}
                    href={`/category/${cat.toLowerCase()}`}
                    className="text-[0.75rem] text-dim hover:text-foreground transition-colors inline-flex items-center gap-1.5"
                  >
                    <span className="text-[10px]" aria-hidden="true">{categoryIcons[cat] || '🎮'}</span>
                    {cat}
                    <span className="text-[0.6rem] text-dim/40">({getGamesByCategory(cat).length})</span>
                  </Link>
                ))}
              </nav>
            </div>

            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dim mb-3">Explore</h4>
              <nav aria-label="Site links" className="flex flex-col gap-1.5">
                <Link href="/games" className="text-[0.75rem] text-dim hover:text-foreground transition-colors">All Games</Link>
                <Link href="/achievements" className="text-[0.75rem] text-dim hover:text-foreground transition-colors">Achievements</Link>
                <Link href="/stats" className="text-[0.75rem] text-dim hover:text-foreground transition-colors">Statistics</Link>
                <Link href="/about" className="text-[0.75rem] text-dim hover:text-foreground transition-colors">About</Link>
                <Link href="/faq" className="text-[0.75rem] text-dim hover:text-foreground transition-colors">FAQ</Link>
              </nav>
            </div>

            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-dim mb-3">Legal</h4>
              <nav aria-label="Legal links" className="flex flex-col gap-1.5">
                <Link href="/privacy" className="text-[0.75rem] text-dim hover:text-foreground transition-colors">Privacy</Link>
                <Link href="/terms" className="text-[0.75rem] text-dim hover:text-foreground transition-colors">Terms</Link>
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-10 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[0.7rem] text-dim/50">
          <span>&copy; {new Date().getFullYear()} Spryte Games</span>
          <span>Free to play &middot; No plugins required</span>
        </div>
      </div>
    </footer>
  );
}
