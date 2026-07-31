import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/instant-basketball');
  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Instant Basketball Screener — PulseOdds', 'Court Line Instant Basketball odds screening across 4 target markets and Overtime draw consistency.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Instant Basketball', url: canonical, position: 2 }
    ])
  ]);
  const seo = buildMeta({
    title: 'Court Line Instant Basketball Screener — PulseOdds',
    description: 'Screen SportyBet Instant Basketball odds across 4 target markets with Overtime draw consistency checks.',
    canonical,
    jsonLd
  });
  return { seo };
};
