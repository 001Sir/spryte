import { notFound } from 'next/navigation';
import { getAllCategories, getGamesByCategory } from '@/data/games';
import CategoryGameGrid from '@/components/game/CategoryGameGrid';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ category: string }>;
}

const categoryColors: Record<string, string> = {
  action: '#e94560',
  arcade: '#f59e0b',
  puzzle: '#06b6d4',
  racing: '#84cc16',
  strategy: '#7c3aed',
};

const categoryIcons: Record<string, string> = {
  action: '⚡',
  arcade: '🕹️',
  puzzle: '🧩',
  racing: '🏎️',
  strategy: '♟️',
};

export async function generateStaticParams() {
  return getAllCategories().map((c) => ({ category: c.toLowerCase() }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  return {
    title: `${label} Games — Spryte Games`,
    description: `Play free ${label} games in your browser.`,
    openGraph: {
      title: `${label} Games — Spryte Games`,
      description: `Play free ${label} games in your browser. No downloads required.`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const catGames = getGamesByCategory(category);
  if (catGames.length === 0) notFound();

  const label = category.charAt(0).toUpperCase() + category.slice(1);
  const color = categoryColors[category] || '#e94560';
  const icon = categoryIcons[category] || '🎮';

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 animate-fade-in">
      {/* Category header */}
      <div
        className="rounded-xl p-6 mb-8 border border-border relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${color}15, ${color}08, transparent)` }}
      >
        <div
          className="absolute top-[-20px] right-[-20px] w-[120px] h-[120px] rounded-full opacity-10 blur-2xl"
          style={{ background: color }}
        />
        <div className="relative">
          <span className="text-3xl mb-2 block">{icon}</span>
          <h1 className="text-3xl font-bold">{label} Games</h1>
          <p className="text-muted mt-1">
            {catGames.length} game{catGames.length !== 1 ? 's' : ''} in this category
          </p>
        </div>
      </div>

      <CategoryGameGrid games={catGames} />
    </div>
  );
}
