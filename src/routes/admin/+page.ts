// src/routes/admin/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/admin');

  const seo = buildMeta({
    title: 'Super Admin Control Room — AI Performance Data Bank | PulseOdds',
    description: 'AI prediction performance data bank: daily accuracy, calibration by signal band, Great AI Minds ranks, market strike rates and verdict leaderboards across all predictor sports.',
    canonical,
    og: { type: 'website', title: 'AI Performance Data Bank — PulseOdds', description: 'Super-admin control room for AI prediction performance.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'AI Performance Data Bank — PulseOdds', description: 'Super-admin control room for AI prediction performance.' },
    robots: 'noindex, nofollow'
  });

  return { seo };
};
