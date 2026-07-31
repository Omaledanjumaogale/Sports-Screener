import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/instant-football');
  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Instant Football Screener — PulseOdds', 'Flash Line Instant Football odds screening across 5 target markets and Teams To Score triangulation.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Instant Football', url: canonical, position: 2 }
    ])
  ]);
  const seo = buildMeta({
    title: 'Flash Line Instant Football Screener — PulseOdds',
    description: 'Screen SportyBet Instant Football odds across 5 target markets with Teams To Score triangulation.',
    canonical,
    jsonLd
  });
  return { seo };
};
