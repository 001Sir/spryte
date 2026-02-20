import type { MetadataRoute } from 'next';
import { games, getAllCategories } from '@/data/games';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://sprytegames.com';

  const lastModified = new Date().toISOString();

  const gamePages = games.map((game) => ({
    url: `${baseUrl}/games/${game.slug}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const categoryPages = getAllCategories().map((category) => ({
    url: `${baseUrl}/category/${category.toLowerCase()}`,
    lastModified,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/games`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...gamePages,
    ...categoryPages,
  ];
}
