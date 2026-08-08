// src/routes/predictor/[sport]/[matchId]/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildWebPageSchema, buildBreadcrumbSchema, buildPageGraph } from '$lib/schema/builders';

export const ssr = false;

export const load: PageLoad = ({ params }) => {
  const sportLabel = (params.sport ?? 'sport').charAt(0).toUpperCase() + (params.sport ?? 'sport').slice(1);
  const canonical = canonicalUrl(`/predictor/${params.sport}/${params.matchId}`);

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(
      canonical,
      `Full Match Analysis — ${sportLabel} AI Predictor | PulseOdds`,
      `Deep multi-agent ${sportLabel} match analysis: only selections whose Real Win Chance clears the confidence floor, graded after the final whistle.`,
      '2025-01-01',
      new Date().toISOString().split('T')[0]
    ),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'AI Predictor', url: 'https://pulseodds.ewinproject.org/predictor', position: 2 },
      { name: `${sportLabel} Predictor`, url: `https://pulseodds.ewinproject.org/predictor/${params.sport}`, position: 3 },
      { name: 'Full Match Analysis', url: canonical, position: 4 }
    ])
  ]);

  const seo = buildMeta({
    title: `Full Match Analysis — ${sportLabel} AI Predictor | PulseOdds`,
    description: `PulseOdds ${sportLabel} full match analysis. Multi-agent screening, ${''}Real Win Chance selections and post-match grading for a single fixture.`,
    canonical,
    og: { type: 'website', title: `Full Match Analysis — ${sportLabel}` , description: `Deep single-match ${sportLabel} analysis by the PulseOdds agent team.`, image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: `Full Match Analysis — ${sportLabel}`, description: 'Single-match analysis.' },
    jsonLd
  });

  return { seo };
};