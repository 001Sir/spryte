import type { MetadataRoute } from 'next';
import { games, getAllCategories } from '@/data/games';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://sprytegames.com';

  const gamePages = games.map((game) => ({
    url: `${baseUrl}/games/${game.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const categoryPages = getAllCategories().map((category) => ({
    url: `${baseUrl}/category/${category.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    ...gamePages,
    ...categoryPages,
  ];
}
