// src/routes/predictor/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import { buildOrganizationSchema, buildWebPageSchema, buildBreadcrumbSchema, buildPageGraph, buildFAQSchema } from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/predictor');

  const faqs = [
    {
      question: 'What is the AI Predictor?',
      answer: 'The AI Predictor is a Master Pass feature: a multi-agent screening service that shows only matches whose selection probability exceeds a 60% Real Win Chance floor, using pre-cached data from betwatch.fr and cross-reference odds, betting and prediction registries.'
    },
    {
      question: 'How do I use the AI Predictor?',
      answer: 'Pick a sport, watch the agent team meter reach 100%, then review the matches that cleared the confidence floor with their top selections, punter edge and post-match grading.'
    },
    {
      question: 'How can I get the Master Pass?',
      answer: 'Choose the Master Pass tier at checkout (₦10,000/month) to unlock the AI Predictor across all 11 sports and all segmented high-confidence picks.'
    },
    {
      question: 'Who are the agents behind the AI Predictor?',
      answer: 'Eze Ugo orchestrates nine Nigeria-named specialists: fixtures, odds, traded volume, research, normalization, probability, risk, reporting and cache scheduling.'
    }
  ];

  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebPageSchema(
      canonical,
      'AI Predictor — PulseOdds',
      'Multi-agent AI Predictor showing only matches whose Real Win Chance exceeds 60%, refreshed nightly from betwatch.fr and cross-reference sources across all 11 sports.',
      '2025-01-01',
      new Date().toISOString().split('T')[0]
    ),
    buildBreadcrumbSchema([
      { name: 'Home', url: 'https://pulseodds.ewinproject.org/', position: 1 },
      { name: 'AI Predictor', url: canonical, position: 2 }
    ]),
    buildFAQSchema(faqs)
  ]);

  const seo = buildMeta({
    title: 'AI Predictor — Master Pass, 11 Sports | PulseOdds',
    description: 'PulseOdds AI Predictor: a Master Pass feature showing only matches whose Real Win Chance exceeds 60%, across all 11 sports. Refreshed nightly by a multi-agent team.',
    canonical,
    og: { type: 'website', title: 'AI Predictor — PulseOdds', description: 'High-confidence picks across 11 sports, refreshed nightly.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'AI Predictor — PulseOdds', description: 'Only 60%+ confidence matches, refreshed nightly.' },
    jsonLd
  });

  return { seo };
};
