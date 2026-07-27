// src/routes/basketball/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildBreadcrumbSchema, buildWebPageSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/basketball');

  const faqs = [
    {
      question: 'What is the Market Expected Total (MET) in basketball?',
      answer: 'The Market Expected Total (MET) is a mathematical derivation of the expected total score in a basketball game based on inputted decimal odds. PulseOdds uses MET to assess over/under and total points market value.'
    },
    {
      question: 'What basketball markets does PulseOdds screen?',
      answer: 'The Basketball Screener covers team total odds, spread analysis, quarter-pace modeling, and overall game total (MET), providing confidence rankings with gold/silver/bronze value badges.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(canonical, 'Basketball Odds Screener — PulseOdds', 'MET-based basketball odds analysis with spread ranking, team totals and quarter-pace modeling.', '2025-01-01', new Date().toISOString().split('T')[0]),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'Basketball Screener', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'Basketball Odds Screener — MET Analysis & Rankings | PulseOdds',
    description: 'Screen basketball odds with PulseOdds Market Expected Total (MET) engine. Team totals, quarter pace, spread ranking and confidence tiers for basketball betting markets.',
    canonical,
    og: { type: 'website', title: 'Basketball Odds Screener — PulseOdds', description: 'MET-based basketball odds analysis and spread ranking.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Basketball Odds Screener — PulseOdds', description: 'MET analysis. Spread ranking. Confidence tiers.' },
    jsonLd
  });

  return { seo };
};
