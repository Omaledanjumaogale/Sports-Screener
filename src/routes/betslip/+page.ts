// src/routes/betslip/+page.ts
import type { PageLoad } from './$types';
import { buildMeta, canonicalUrl } from '$lib/seo';

export const load: PageLoad = () => {
  const canonical = canonicalUrl('/betslip');
  const seo = buildMeta({
    title: 'Bet Slip | PulseOdds',
    description: 'Your accumulative bet slip: market options selected across fixtures and sports, with post-match grading and combined odds.',
    canonical,
    og: { type: 'website', title: 'Bet Slip — PulseOdds', description: 'Your accumulative bet slip across fixtures and sports.', image: 'https://pulseodds.ewinproject.org/og-image.png', url: canonical, locale: 'en_NG', siteName: 'PulseOdds' },
    twitter: { card: 'summary_large_image', title: 'Bet Slip — PulseOdds', description: 'Your accumulative bet slip.' }
  });
  return { seo };
};
