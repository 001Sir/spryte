import Link from 'next/link';
import Image from 'next/image';
import { getAllCategories, games } from '@/data/games';

export default function Footer() {
  const categories = getAllCategories();

  return (
    <footer className="border-t border-border mt-20 pt-12 pb-8 px-4" role="contentinfo">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Branding */}
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <Image
              src="/logo.png"
              alt="Spryte Games"
              width={48}
              height={48}
              className="rounded-full group-hover:shadow-lg group-hover:shadow-accent/10 transition-shadow"
            />
            <span className="text-lg font-bold text-foreground group-hover:text-accent transition-colors">Spryte Games</span>
          </Link>
          <p className="text-muted text-sm mt-3 max-w-xs leading-relaxed">
            Free browser games. No downloads, no installs — just play.
          </p>
          <p className="text-xs text-muted/60 mt-2">
            {games.length} games and counting
          </p>
        </div>

        {/* Categories */}
        <nav aria-label="Game categories">
          <h4 className="font-semibold mb-3 text-sm text-foreground flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Categories
          </h4>
          <div className="flex flex-col gap-2">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/category/${cat.toLowerCase()}`}
                className="text-sm text-muted hover:text-accent transition-colors py-0.5 hover:translate-x-0.5 transition-transform"
              >
                {cat}
              </Link>
            ))}
          </div>
        </nav>

        {/* Quick Links */}
        <nav aria-label="Quick links">
          <h4 className="font-semibold mb-3 text-sm text-foreground flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Quick Links
          </h4>
          <div className="flex flex-col gap-2">
            <Link href="/" className="text-sm text-muted hover:text-accent transition-colors py-0.5">
              Home
            </Link>
            <Link href="/search" className="text-sm text-muted hover:text-accent transition-colors py-0.5">
              Search
            </Link>
            <Link href="/#games" className="text-sm text-muted hover:text-accent transition-colors py-0.5">
              All Games
            </Link>
          </div>
        </nav>

        {/* Legal & Info */}
        <div>
          <h4 className="font-semibold mb-3 text-sm text-foreground flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Legal
          </h4>
          <nav aria-label="Legal links" className="flex flex-col gap-2">
            <Link href="/privacy" className="text-sm text-muted hover:text-accent transition-colors py-0.5">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-muted hover:text-accent transition-colors py-0.5">
              Terms of Service
            </Link>
          </nav>
          <p className="text-sm text-muted mt-4 leading-relaxed">
            All games run in your browser using HTML5. No plugins required.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted">
        <span>&copy; {new Date().getFullYear()} Spryte Games. All games are free to play.</span>
        <span className="text-muted/50">Made with passion for gaming</span>
      </div>
    </footer>
  );
}
