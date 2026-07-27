// src/routes/+page.ts
// Homepage universal load() function.
// Assembles all SEO metadata and Schema.org @graph server-side.
// AEO NOTE: All structured data is generated here — NEVER client-only —
// so LLM crawlers receive full JSON-LD in the initial HTML response.

import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';
import {
  buildOrganizationSchema,
  buildWebSiteSchema,
  buildFAQSchema,
  buildHowToSchema,
  buildSoftwareAppSchema,
  buildWebPageSchema,
  buildPageGraph
} from '$lib/schema/builders';

export const prerender = true;

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/');

  // FAQ data — targeting top AI queries (answer-first for LLM extraction)
  const faqs = [
    {
      question: 'What is PulseOdds?',
      answer:
        'PulseOdds is a mathematical sports odds screening platform that helps punters analyze football, basketball, tennis and table tennis odds before staking. It applies four mathematical profile models and outputs a 5-lamp confidence score and ranked top picks. It is NOT a bookmaker or gambling operator.'
    },
    {
      question: 'How does sports odds screening work on PulseOdds?',
      answer:
        'Users select a sport, input their decimal odds (1.01–5.00) from any bookmaker, and PulseOdds instantly applies its 4-profile mathematical verdict engine to calculate confidence ratings and rank picks by value (gold, silver, bronze badges).'
    },
    {
      question: 'What is the Market Expected Total (MET) in basketball odds?',
      answer:
        'The Market Expected Total (MET) is a mathematical derivation of the expected total score in a basketball game, calculated from the inputted decimal odds. It helps assess over/under and total points market value.'
    },
    {
      question: 'What is the Market Expected Games (MEG) in tennis odds?',
      answer:
        'The Market Expected Games (MEG) is PulseOdds\'s calculation of expected total games in a tennis match based on odds inputs. It is used to screen over/under game totals and correct score markets in tennis.'
    },
    {
      question: 'How much does PulseOdds cost?',
      answer:
        'Access to all four sports screeners (Football, Basketball, Tennis, Table Tennis) requires a monthly donation of ₦5,000 Nigerian Naira — the "Punter Access Pass".'
    },
    {
      question: 'Is PulseOdds safe and legal?',
      answer:
        'PulseOdds is a non-gambling, informational analytics tool. It does not accept bets or handle gambling transactions. Users must comply with local gambling laws and must be 18+. PulseOdds is strictly an educational screening tool, not a guaranteed profit system.'
    },
    {
      question: 'Who created PulseOdds?',
      answer:
        'PulseOdds was created by Omale Danjuma Ogale, Founder & CEO of the Elite Workforce Impact Nigeria (E-WIN) Project, as part of the E-WIN digital tools ecosystem for Nigerian workforce empowerment.'
    },
    {
      question: 'Does PulseOdds work on mobile?',
      answer:
        'Yes. PulseOdds is mobile-first and works on all screen sizes. It supports offline-first operation with local storage fallback, so screener state is preserved even without an internet connection.'
    }
  ];

  // How-to steps mirroring the homepage "7 Easy Steps"
  const howToSteps = [
    { position: 1, name: 'Choose Match & Sport', text: 'Select any match from Football, Basketball, Tennis, or Table Tennis.' },
    { position: 2, name: 'Launch Screener', text: 'Click the sport card on the homepage to navigate to your chosen sport screener.' },
    { position: 3, name: 'Input Bookmaker Lines & Odds', text: 'Input the lines and decimal odds as displayed on your favourite bookmaker site.' },
    { position: 4, name: 'Run Odds Screening', text: 'Let PulseOdds perform instant mathematical analysis across 4 profile models.' },
    { position: 5, name: 'Manage Your Workspace', text: 'Clear or save to history to screen another match seamlessly.' },
    { position: 6, name: 'Build Informed Betslips', text: 'Build your betslip with ranked verdicts and stake responsibly.' },
    { position: 7, name: 'Beat the Bookies Together', text: 'Use the intelligence edge to become an informed, smarter punter.' }
  ];

  // Build the full @graph JSON-LD block
  const jsonLd = buildPageGraph([
    buildOrganizationSchema(),
    buildWebSiteSchema(),
    buildSoftwareAppSchema(),
    buildWebPageSchema(
      canonical,
      'PulseOdds — Sports Odds Intelligence',
      'Mathematical sports odds screening for football, basketball, tennis and table tennis. Part of the Elite Workforce Impact Nigeria (E-WIN) Project.',
      '2025-01-01',
      new Date().toISOString().split('T')[0]
    ),
    buildFAQSchema(faqs),
    buildHowToSchema(
      'How to Use PulseOdds Sports Screener in 7 Steps',
      'A step-by-step guide to screening sports odds using PulseOdds mathematical verdict engine.',
      howToSteps
    )
  ]);

  // Build complete PageSEO config
  const seo = buildMeta({
    title: 'PulseOdds — Read the odds. Own the edge. Beat the Bookies',
    description:
      'PulseOdds is a free-to-use mathematical sports odds screening tool for football, basketball, tennis and table tennis. Get instant profile verdicts, confidence scoring, and top pick rankings. Part of the E-WIN Project.',
    canonical,
    og: {
      type: 'website',
      title: 'PulseOdds — Sports Odds Intelligence',
      description: 'Read the odds. Own the edge. Mathematical screening for football, basketball, tennis & table tennis. Part of the E-WIN Project.',
      image: 'https://pulseodds.ewinproject.org/og-image.png',
      imageAlt: 'PulseOdds — Sports Odds Intelligence Platform',
      url: canonical,
      locale: 'en_NG',
      siteName: 'PulseOdds'
    },
    twitter: {
      card: 'summary_large_image',
      title: 'PulseOdds — Sports Odds Intelligence',
      description: 'Read the odds. Own the edge. Beat the Bookies.',
      image: 'https://pulseodds.ewinproject.org/og-image.png'
    },
    jsonLd,
    datePublished: '2025-01-01',
    dateModified: new Date().toISOString().split('T')[0]
  });

  return { seo, faqs };
};
