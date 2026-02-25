import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Achievements',
  description:
    'Track your achievements on Spryte Games. Unlock per-game, cross-game, daily, and meta achievements as you play free browser games.',
  openGraph: {
    title: 'Achievements — Spryte Games',
    description:
      'Track your achievements across all free browser games on Spryte Games.',
    url: 'https://sprytegames.com/achievements',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Spryte Games Achievements',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Achievements — Spryte Games',
    description:
      'Track your achievements across all free browser games on Spryte Games.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: 'https://sprytegames.com/achievements',
  },
};

export default function AchievementsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
