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
      answer: `The ${sport} AI Predictor is a Master Pass feature that surfaces only matches whose Real Win Chance clears the confidence floor, using pre-cached data from betwatch.fr and cross-reference odds, betting and prediction registries.`
    },
    {
      question: 'How often is the AI Predictor cache refreshed?',
      answer: 'A nightly midnight (00:00 UTC) cycle run by the agent team refreshes the day cache for all sports; a manual refresh is always available.'
    },
    {
      question: `How do I open a full ${sport} match analysis?`,
      answer: 'Use the "Full Analysis" link on any qualifying match card to open the complete single-match report with every segmented selection and post-match grading.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(
      canonical,
      `${sport} AI Predictor — PulseOdds`,
      `High-confidence ${sport} selections: a Master Pass feature surfacing only matches whose Real Win Chance clears the confidence floor, refreshed nightly from betwatch.fr and cross-reference sources.`,
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
    title: `${sport} AI Predictor — Master Pass Selections | PulseOdds`,
    description: `PulseOdds ${sport} AI Predictor. A Master Pass feature showing only matches whose selection probability clears the confidence floor, powered by a multi-agent team and pre-cached data refreshed nightly.`,
    canonical,
    og: { type: 'website', title: `${sport} AI Predictor — PulseOdds`, description: `Only ${sport} matches over the confidence floor, refreshed nightly.`, image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: `${sport} AI Predictor — PulseOdds`, description: 'High-confidence selections only.' },
    jsonLd
  });

  return { seo };
};
