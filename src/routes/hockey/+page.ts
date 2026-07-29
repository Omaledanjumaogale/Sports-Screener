// src/routes/hockey/+page.ts
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
  const canonical = canonicalUrl('/hockey');

  const faqs = [
    {
      question: 'What does the Ice Hockey Screener analyze?',
      answer:
        'The Ice Hockey Screener analyzes Regular Time and 1st Period goals, puck line handicaps, Overtime Intelligence P(OT) probability, Moneyline split consistency, and Correct Score Reconciliation (Shutout risk, Odd/Even, BTTS).'
    },
    {
      question: 'How does Overtime Intelligence work in Ice Hockey?',
      answer:
        'Overtime Intelligence derives the implied overtime probability P(OT) directly from the 3-way 1X2 regulation draw price (~24% NHL historical anchor), then checks Moneyline-incl-OT split consistency under a coinflip-shootout model.'
    },
    {
      question: 'What is the Empty-Net Reversal in Hockey?',
      answer:
        'Unlike basketball, a lopsided favourite in ice hockey raises expected total scoring due to late empty-net goal risk when goaltenders are pulled. The screener treats lopsided favorites as Over-supporting and tight matchups as Under-supporting.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(
      canonical,
      'Ice Hockey Odds Screener — PulseOdds',
      'Puck line handicap, 3-period goal pace, Overtime Intelligence, and CS Reconciliation for ice hockey betting markets.',
      '2025-01-01',
      new Date().toISOString().split('T')[0]
    ),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Ice Hockey Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Ice Hockey Odds Screener — Puck Line & Overtime Intelligence | PulseOdds',
    description:
      'Screen ice hockey odds with PulseOdds. Overtime probability modeling, puck line ranking, CS reconciliation, empty-net reversal logic, and 5-lamp confidence scoring.',
    canonical,
    og: {
      type: 'website',
      title: 'Ice Hockey Odds Screener — PulseOdds',
      description: 'Puck line handicap, 3-period goal pace, and Overtime Intelligence for ice hockey betting.',
      image: 'https://pulseodds.ewinproject.org/og-image.png',
      url: canonical,
      locale: 'en_NG',
      siteName: 'PulseOdds'
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Ice Hockey Odds Screener — PulseOdds',
      description: 'Screen ice hockey odds. Overtime probability & Puck Line modeling.'
    },
    jsonLd
  });

  return { seo };
};
