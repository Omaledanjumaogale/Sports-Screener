import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/vfootball');
  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Virtual Football Screener — PulseOdds', 'Pulse Line Virtual Football odds screening across 5 target selections and Correct Score joint distribution.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Virtual Football', url: canonical, position: 2 }
    ])
  ]);
  const seo = buildMeta({
    title: 'Pulse Line Virtual Football Screener — PulseOdds',
    description: 'Screen SportyBet Virtual Football odds across 5 target selections with 16-scoreline joint distribution grid.',
    canonical,
    jsonLd
  });
  return { seo };
};
