import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Search Games',
  description:
    'Search free browser games on Spryte Games. Find action, puzzle, racing, arcade, and strategy games to play instantly.',
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
