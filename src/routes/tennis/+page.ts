// src/routes/tennis/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/tennis');

  const faqs = [
    {
      question: 'What is the Market Expected Games (MEG) in tennis odds?',
      answer: "The Market Expected Games (MEG) is PulseOdds's calculation of expected total games in a tennis match derived from decimal odds inputs. MEG helps screen over/under game totals and correct set score markets."
    },
    {
      question: 'Does PulseOdds account for court surface in tennis screening?',
      answer: 'Yes. The Tennis Screener includes surface modifier factors for hard courts, clay courts, and grass courts that influence the MEG and confidence outputs.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Tennis Odds Screener — PulseOdds', 'MEG-based tennis odds analysis with surface modifiers, correct score intelligence and dual tiebreak signals.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Tennis Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Tennis Odds Screener — MEG Analysis & Surface Modifiers | PulseOdds',
    description: 'Screen tennis odds with PulseOdds Market Expected Games (MEG) engine. Surface modifiers, correct score intelligence, tiebreak signals and dual match/set screening.',
    canonical,
    og: { type: 'website', title: 'Tennis Odds Screener — PulseOdds', description: 'MEG tennis analysis with surface modifiers and tiebreak signals.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Tennis Odds Screener — PulseOdds', description: 'MEG analysis. Surface modifiers. Tiebreak signals.' },
    jsonLd
  });

  return { seo };
};
