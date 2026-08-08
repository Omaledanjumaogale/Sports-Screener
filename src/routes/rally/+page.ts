// src/routes/rally/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/rally');

  const faqs = [
    {
      question: 'What markets does the Table Tennis Screener cover?',
      answer: 'The Table Tennis Screener covers full match AND first-set markets simultaneously, providing safest pick selection, margin rank, sweep shape probability modeling, and set metric calculations.'
    },
    {
      question: 'Can I screen both first-set and full match table tennis odds together?',
      answer: 'Yes. The Table Tennis Screener is uniquely designed with dual-view screening — you can analyze first-set and full match odds in a single interface without switching between screens.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Table Tennis Odds Screener — PulseOdds', 'Dual first-set and full match table tennis screening with safest pick algorithm, margin rank and sweep shape modeling.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Table Tennis Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Table Tennis Odds Screener — Dual Match & Set Analysis | PulseOdds',
    description: 'Screen table tennis odds with PulseOdds dual match and first-set screener. Safest pick algorithm, sweep shape modeling, margin rank and set metrics for informed staking.',
    canonical,
    og: { type: 'website', title: 'Table Tennis Odds Screener — PulseOdds', description: 'Dual first-set and full match table tennis screening.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Table Tennis Screener — PulseOdds', description: 'Dual match & set screening. Safest pick. Sweep shapes.' },
    jsonLd
  });

  return { seo };
};
