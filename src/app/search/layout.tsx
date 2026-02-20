import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Games',
  description:
    'Search free browser games on Spryte Games. Find action, puzzle, racing, arcade, and strategy games to play instantly.',
  robots: {
    index: false,
    follow: true,
  },
  openGraph: {
    title: 'Search Games — Spryte Games',
    description:
      'Search free browser games on Spryte Games. Find action, puzzle, arcade, and strategy games to play instantly.',
    url: 'https://sprytegames.com/search',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Search Games on Spryte Games',
      },
    ],
  },
  alternates: {
    canonical: 'https://sprytegames.com/search',
  },
};

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
