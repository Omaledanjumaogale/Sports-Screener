// src/routes/american-football/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/american-football');

  const faqs = [
    {
      question: 'What does the American Football Screener analyse?',
      answer:
        'The American Football Screener analyses moneyline, point spread, game totals and team total markets with a Market Expected Points Total (MEPT) read, team sum consistency and 5-lamp confidence scoring.'
    },
    {
      question: 'How is the 5-lamp American football confidence score calculated?',
      answer:
        'The 5-lamp score is derived from four internal mathematical profiles applied to the inputted decimal odds. Each lamp represents a tier of confidence — 5 lamps is the strongest signal, 1 lamp is the weakest.'
    },
    {
      question: 'What odds format does the American Football Screener use?',
      answer:
        'The American Football Screener uses European decimal odds (e.g. 1.85, 2.40, 3.75) in the range 1.01 to 5.00, selectable in 0.01 increments via the sequential odds picker.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(
      canonical,
      'American Football Odds Screener — PulseOdds',
      'Moneyline, point spread and game total profile analysis with MEPT and team sum consistency for NFL betting markets.',
      '2025-01-01',
      new Date().toISOString().split('T')[0]
    ),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'American Football Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'American Football Odds Screener — NFL Analysis & Top Picks | PulseOdds',
    description:
      'Screen American football odds with PulseOdds. Moneyline, spread, game totals, team totals, MEPT and 5-lamp confidence scoring for NFL markets. Free mathematical verdict engine.',
    canonical,
    og: { type: 'website', title: 'American Football Odds Screener — PulseOdds', description: 'Moneyline, spread and totals analysis for NFL betting.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'American Football Screener — PulseOdds', description: 'Screen NFL odds. Moneyline. Spread. Totals.' },
    jsonLd
  });

  return { seo };
};
