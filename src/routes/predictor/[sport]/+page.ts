// src/routes/predictor/[sport]/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildWebPageSchema, buildBreadcrumbSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';
import { PREDICTOR_SPORTS } from '$lib/predictorTypes';

export const prerender = true;

export const entries = () => PREDICTOR_SPORTS.map((sport) => ({ sport }));

const LABEL: Record<string, string> = {
  football: 'Football',
  basketball: 'Basketball',
  tennis: 'Tennis',
  rally: 'Table Tennis',
  hockey: 'Hockey',
  baseball: 'Baseball',
  americanfootball: 'American Football',
  rugby: 'Rugby',
  cricket: 'Cricket',
  mma: 'MMA',
  volleyball: 'Volleyball'
};

export const load: PageLoad = ({ params }) => {
  const sport = LABEL[params.sport] ?? params.sport;
  const canonical = canonicalUrl(`/predictor/${params.sport}`);

  const faqs = [
    {
      question: `What does the ${sport} AI Predictor show?`,
      answer: `The ${sport} AI Predictor surfaces only matches whose Real Win Chance clears the 60% confidence floor, using pre-cached data from betwatch.fr and cross-reference odds, betting and prediction registries.`
    },
    {
      question: 'How often is the AI Predictor cache refreshed?',
      answer: 'A nightly midnight (00:00 UTC) cycle run by the agent team refreshes the day cache for all sports; a manual refresh is always available.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(
      canonical,
      `${sport} AI Predictor — PulseOdds`,
      `High-confidence ${sport} selections: only matches whose Real Win Chance exceeds 60%, refreshed nightly from betwatch.fr and cross-reference sources.`,
      '2025-01-01',
      new Date().toISOString().split('T')[0]
    ),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'AI Predictor', url: 'https://pulseodds.ewinproject.org/predictor', position: 2 },
      { name: `${sport} Predictor`, url: canonical, position: 3 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: `${sport} AI Predictor — 60%+ Confidence Selections | PulseOdds`,
    description: `PulseOdds ${sport} AI Predictor. See only matches whose selection probability exceeds 60%, powered by a multi-agent team and pre-cached betwatch.fr data refreshed nightly.`,
    canonical,
    og: { type: 'website', title: `${sport} AI Predictor — PulseOdds`, description: `Only ${sport} matches over the 60% confidence floor, refreshed nightly.`, image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: `${sport} AI Predictor — PulseOdds`, description: 'High-confidence selections only.' },
    jsonLd
  });

  return { seo };
};
