/**
 * sitemap.js — Next.js App Router dynamic sitemap generator.
 *
 * Generates authoritative sitemap entries for all indexable public pages.
 * Excludes private authenticated habit and tracking routes.
 */
export default function sitemap() {
  const baseUrl = 'https://myvritta.vercel.app';
  const lastModified = new Date();

  return [
    {
      url: baseUrl,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
  ];
}
