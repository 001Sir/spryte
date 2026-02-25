import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Statistics',
  description:
    'View your gaming statistics on Spryte Games — playtime, sessions, high scores, and per-game breakdowns for all free browser games.',
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: 'Your Statistics — Spryte Games',
    description:
      'View your gaming statistics — playtime, sessions, and high scores on Spryte Games.',
    url: 'https://sprytegames.com/stats',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Spryte Games Statistics',
      },
    ],
  },
  alternates: {
    canonical: 'https://sprytegames.com/stats',
  },
};

export default function StatsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
