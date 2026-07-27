// src/routes/sitemap.xml/+server.ts
// Dynamic sitemap generator. Returns valid XML with Content-Type: application/xml.
// Static routes are hardcoded; dynamic routes can be pulled from Convex/CMS.
// AEO NOTE: Sitemap is how AI crawlers discover all indexable pages in one request.

import type { RequestHandler } from '@sveltejs/kit';

const SITE_URL = 'https://pulseodds.ewinproject.org';

interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function buildSitemapXML(entries: SitemapEntry[]): string {
  const urls = entries
    .map(
      (e) => `
  <url>
    <loc>${e.url}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${urls}
</urlset>`;
}

export const GET: RequestHandler = async () => {
  const today = formatDate(new Date());

  // Static pages — hardcoded with appropriate priority and change frequency
  const staticEntries: SitemapEntry[] = [
    {
      url: `${SITE_URL}/`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '1.0'
    },
    {
      url: `${SITE_URL}/football`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.9'
    },
    {
      url: `${SITE_URL}/basketball`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.9'
    },
    {
      url: `${SITE_URL}/tennis`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.9'
    },
    {
      url: `${SITE_URL}/rally`,
      lastmod: today,
      changefreq: 'weekly',
      priority: '0.9'
    }
    // NOTE: /auth is intentionally excluded from sitemap (private, disallowed in robots.txt)
  ];

  // Dynamic entries can be added here by fetching from Convex or CMS
  // Example: const posts = await fetchBlogPosts(); — MANUAL STEP if blog is added
  const dynamicEntries: SitemapEntry[] = [];

  const allEntries = [...staticEntries, ...dynamicEntries];
  const xml = buildSitemapXML(allEntries);

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Cache for 24h at CDN level; revalidate daily for freshness
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      'X-Robots-Tag': 'noindex' // Don't index the sitemap URL itself
    }
  });
};
