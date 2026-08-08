// src/routes/cricket/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/cricket');

  const faqs = [
    {
      question: 'What does the Cricket Screener analyse?',
      answer:
        'The Cricket Screener analyses match winner, run line and total runs markets with a Market Expected Runs (MER) read, team sum consistency and 5-lamp confidence scoring across Test, ODI and T20.'
    },
    {
      question: 'Can I screen first-innings cricket runs separately?',
      answer:
        'Yes — a dedicated first-innings scope lets you model the team batting total independently from the full match winner market.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Cricket Odds Screener — PulseOdds', 'Match winner, run line and total runs analysis with MER and team sum consistency for Test, ODI and T20 markets.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Cricket Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Cricket Odds Screener — Match Analysis & Top Picks | PulseOdds',
    description: 'Screen cricket odds with PulseOdds. Match winner, run line, total runs, MER and 5-lamp confidence scoring. Free mathematical verdict engine.',
    canonical,
    og: { type: 'website', title: 'Cricket Odds Screener — PulseOdds', description: 'Match winner, run line and totals analysis for cricket.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Cricket Screener — PulseOdds', description: 'Screen cricket odds. Match winner. Run line. Totals.' },
    jsonLd
  });

  return { seo };
};
