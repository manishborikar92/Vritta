/**
 * robots.js — Next.js App Router crawler configuration.
 *
 * Configures crawler access rules:
 * - Allows indexing of public landing / auth routes
 * - Disallows private protected habit and routine routes (/today, /habits, /insights)
 * - Points crawlers to authoritative sitemap.xml
 */
export default function robots() {
  const baseUrl = 'https://myvritta.vercel.app';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/today', '/habits', '/insights'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
