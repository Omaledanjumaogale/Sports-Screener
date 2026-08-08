// src/routes/volleyball/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/volleyball');

  const faqs = [
    {
      question: 'What does the Volleyball Screener analyse?',
      answer:
        'The Volleyball Screener analyses match winner, total sets and first-set markets with set-shape modeling, sweep probability signals and 5-lamp confidence scoring.'
    },
    {
      question: 'Can I screen both full match and first-set volleyball odds together?',
      answer:
        'Yes — dual-view screening lets you analyse first-set and full match odds in a single interface without switching between screens.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Volleyball Odds Screener — PulseOdds', 'Match winner, total sets and first-set analysis with set-shape modeling and sweep signals for volleyball markets.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Volleyball Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Volleyball Odds Screener — Match & Set Analysis | PulseOdds',
    description: 'Screen volleyball odds with PulseOdds. Match winner, total sets, first-set markets, sweep shapes and 5-lamp confidence scoring. Free mathematical verdict engine.',
    canonical,
    og: { type: 'website', title: 'Volleyball Odds Screener — PulseOdds', description: 'Match winner, total sets and first-set analysis.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Volleyball Screener — PulseOdds', description: 'Screen volleyball odds. Winner. Sets. First set.' },
    jsonLd
  });

  return { seo };
};
