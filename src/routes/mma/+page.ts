// src/routes/mma/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/mma');

  const faqs = [
    {
      question: 'What does the MMA Screener analyse?',
      answer:
        'The MMA Screener analyses fight winner, total rounds over/under and method-of-victory markets with a Market Expected Rounds Total (MERT) read and 5-lamp confidence scoring for UFC and other promotions.'
    },
    {
      question: 'Can I screen both fight winner and rounds together?',
      answer:
        'Yes — the full fight scope combines the moneyline winner market with the total rounds over/under so both angles are screened in a single interface.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'MMA Odds Screener — PulseOdds', 'Fight winner, total rounds and method-of-victory analysis with MERT for UFC and combat sports markets.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'MMA Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'MMA Odds Screener — Fight Analysis & Top Picks | PulseOdds',
    description: 'Screen MMA odds with PulseOdds. Fight winner, total rounds, method of victory, MERT and 5-lamp confidence scoring. Free mathematical verdict engine.',
    canonical,
    og: { type: 'website', title: 'MMA Odds Screener — PulseOdds', description: 'Fight winner, rounds and method analysis for MMA.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'MMA Screener — PulseOdds', description: 'Screen MMA odds. Fight winner. Rounds. Method.' },
    jsonLd
  });

  return { seo };
};
