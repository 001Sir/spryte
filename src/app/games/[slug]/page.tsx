import { notFound } from 'next/navigation';
import { games, getGameBySlug } from '@/data/games';
import GamePlayer from '@/components/game/GamePlayer';
import GameInfo from '@/components/game/GameInfo';
import RelatedGames from '@/components/game/RelatedGames';
import Link from 'next/link';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return games.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) return {};
  return {
    title: `${game.title} — Spryte Games`,
    description: game.description,
  };
}

export default async function GamePage({ params }: Props) {
  const { slug } = await params;
  const game = getGameBySlug(slug);
  if (!game) notFound();

  const primaryCategory = game.categories[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 text-sm text-muted mb-5">
        <Link href="/" className="hover:text-foreground transition-colors">
          Home
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <Link
          href={`/category/${primaryCategory.toLowerCase()}`}
          className="hover:text-foreground transition-colors"
        >
          {primaryCategory}
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-40">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="text-foreground font-medium">{game.title}</span>
      </nav>

      <GamePlayer slug={game.slug} />
      <GameInfo game={game} />
      <RelatedGames currentGame={game} />
    </div>
  );
}
