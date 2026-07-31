import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/baseball');
  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Baseball Odds Screener — PulseOdds', 'Diamond Line Baseball Enterprise odds screening across 21 markets, 1-5 Innings, 1st Inning, and Extra Innings Draw signals.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Baseball Screener', url: canonical, position: 2 }
    ])
  ]);
  const seo = buildMeta({
    title: 'Diamond Line Baseball Odds Screener — PulseOdds',
    description: 'Screen MLB and baseball odds with PulseOdds. 21 markets across 9 Innings, 1-5 Innings, 1st Inning and Extra-Innings Draw consistency analysis.',
    canonical,
    jsonLd
  });
  return { seo };
};
