import Link from 'next/link';
import { getAllCategories, games } from '@/data/games';

export default function Footer() {
  const categories = getAllCategories();

  return (
    <footer className="border-t border-border mt-20 pt-12 pb-8 px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {/* Branding */}
        <div className="col-span-2 md:col-span-1">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-black bg-gradient-to-r from-accent to-[#ff7eb3] bg-clip-text text-transparent">
              Spryte
            </span>
            <span className="text-lg font-semibold text-foreground ml-1.5">Games</span>
          </Link>
          <p className="text-muted text-sm mt-3 max-w-xs">
            Free browser games. No downloads, no installs — just play.
          </p>
          <p className="text-xs text-muted/60 mt-2">
            {games.length} games and counting
          </p>
        </div>

        {/* Categories */}
        <div>
          <h4 className="font-semibold mb-3 text-sm text-foreground">Categories</h4>
          <div className="flex flex-col gap-1.5">
            {categories.map((cat) => (
              <Link
                key={cat}
                href={`/category/${cat.toLowerCase()}`}
                className="text-sm text-muted hover:text-accent transition-colors"
              >
                {cat}
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-semibold mb-3 text-sm text-foreground">Quick Links</h4>
          <div className="flex flex-col gap-1.5">
            <Link href="/" className="text-sm text-muted hover:text-accent transition-colors">
              Home
            </Link>
            <Link href="/search" className="text-sm text-muted hover:text-accent transition-colors">
              Search
            </Link>
            <Link href="/#games" className="text-sm text-muted hover:text-accent transition-colors">
              All Games
            </Link>
          </div>
        </div>

        {/* Legal & Info */}
        <div>
          <h4 className="font-semibold mb-3 text-sm text-foreground">Legal</h4>
          <div className="flex flex-col gap-1.5">
            <Link href="/privacy" className="text-sm text-muted hover:text-accent transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-muted hover:text-accent transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="text-sm text-muted mt-4">
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
