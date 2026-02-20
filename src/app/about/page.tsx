import type { Metadata } from 'next';
import Link from 'next/link';
import { games } from '@/data/games';

export const metadata: Metadata = {
  title: 'About',
  description: 'Learn about Spryte Games — a free browser gaming platform with HTML5 Canvas games. No downloads, no accounts, just play.',
};

export default function AboutPage() {
  return (
    <div className="max-w-[800px] mx-auto px-4 sm:px-10 py-24">
      <nav className="flex items-center gap-2 text-sm text-dim mb-8" aria-label="Breadcrumbs">
        <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
        <span>/</span>
        <span className="text-foreground">About</span>
      </nav>

      <h1 className="text-3xl font-bold mb-8">About Spryte Games</h1>

      <div className="space-y-8 text-muted leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">What is Spryte Games?</h2>
          <p>
            Spryte Games is a free browser gaming platform featuring {games.length} original games
            you can play instantly — no downloads, no sign-ups, no app stores. Just open your
            browser and play.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Technology</h2>
          <p>
            Every game on Spryte Games is built from scratch using <strong className="text-foreground">HTML5 Canvas</strong> and
            the <strong className="text-foreground">Web Audio API</strong>. All sound effects are procedurally synthesized —
            no audio files are loaded. The site is built with Next.js and runs entirely in
            your browser with no server-side processing for gameplay.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Privacy First</h2>
          <p>
            We believe gaming should be simple and private. Spryte Games:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Has no user accounts or login requirements</li>
            <li>Uses no third-party tracking or analytics scripts</li>
            <li>Stores all data (scores, favorites, stats) locally on your device</li>
            <li>Never sends your gameplay data to any server</li>
            <li>Works offline once cached by your browser</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mb-3">Game Collection</h2>
          <p>
            Our library includes {games.length} games spanning multiple genres: action, arcade,
            puzzle, strategy, and physics. From the zero-friction puzzles of Drift to
            the memory challenges of Deja Vu, there&apos;s something for every type of player.
          </p>
          <div className="mt-4">
            <Link
              href="/games"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-all font-medium text-sm"
            >
              Browse All Games
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
