// src/routes/rugby/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/rugby');

  const faqs = [
    {
      question: 'What does the Rugby Screener analyse?',
      answer:
        'The Rugby Screener analyses moneyline, handicap and total points markets with a Market Expected Total (MET) read, team sum consistency and 5-lamp confidence scoring for union and league.'
    },
    {
      question: 'Does the Rugby Screener cover rugby league?',
      answer:
        'Yes — the same engine profiles both rugby union and rugby league markets, including draws-turned-2-way moneyline pricing where the bookmaker offers no draw leg.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Rugby Odds Screener — PulseOdds', 'Moneyline, handicap and total points analysis with MET and team sum consistency for rugby markets.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Rugby Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Rugby Odds Screener — Match Analysis & Top Picks | PulseOdds',
    description: 'Screen rugby odds with PulseOdds. Moneyline, handicap, total points, MET and 5-lamp confidence scoring. Free mathematical verdict engine.',
    canonical,
    og: { type: 'website', title: 'Rugby Odds Screener — PulseOdds', description: 'Moneyline, handicap and totals analysis for rugby.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Rugby Screener — PulseOdds', description: 'Screen rugby odds. Moneyline. Handicap. Totals.' },
    jsonLd
  });

  return { seo };
};
