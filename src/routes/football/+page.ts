// src/routes/football/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import {
  buildOrganizationSchema,
  buildBreadcrumbSchema,
  buildWebPageSchema,
  buildPageGraph,
  buildFAQSchema
} from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/football');

  const faqs = [
    {
      question: 'What does the Football Screener analyse?',
      answer:
        'The Football Screener analyses half-time and full-time result profiles, correct score clusters, BTTS (Both Teams to Score) probability signals, and provides a 5-lamp confidence scoreboard with gold/silver/bronze top pick rankings.'
    },
    {
      question: 'How is the 5-lamp football confidence score calculated?',
      answer:
        'The 5-lamp score is derived from four internal mathematical profiles applied to the inputted decimal odds. Each lamp represents a tier of confidence — 5 lamps is the strongest signal, 1 lamp is the weakest.'
    },
    {
      question: 'What odds format does the Football Screener use?',
      answer:
        'The Football Screener uses European decimal odds (e.g. 1.85, 2.40, 3.75) in the range 1.01 to 5.00, selectable in 0.01 increments via the sequential odds picker.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(
      canonical,
      'Football Odds Screener — PulseOdds',
      'Half-time/full-time profile analysis, correct score clusters, BTTS signals and 5-lamp confidence scoreboard for football betting markets.',
      '2025-01-01',
      new Date().toISOString().split('T')[0]
    ),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Football Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Football Odds Screener — Profile Analysis & Top Picks | PulseOdds',
    description:
      'Screen football odds with PulseOdds. Half-time/full-time analysis, correct score clusters, BTTS signals, 5-lamp confidence scoring and top pick rankings. Free mathematical verdict engine.',
    canonical,
    og: { type: 'website', title: 'Football Odds Screener — PulseOdds', description: 'Half-time/full-time profile analysis and BTTS signals for football betting.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Football Odds Screener — PulseOdds', description: 'Screen football odds. Profile analysis. 5-lamp confidence.' },
    jsonLd
  });

  return { seo };
};
