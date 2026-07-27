// src/lib/seo.ts
// SEO utility: buildMeta() function + defaultSEO config.
// Used by all +page.ts load() functions to generate typed PageSEO configs.

import type { PageSEO, SiteConfig } from '$lib/types/seo';
import { SITE } from '$lib/schema/builders';

export { SITE };

/**
 * Build a complete PageSEO config for any page.
 * Merges page-specific overrides with site-wide defaults.
 *
 * AEO NOTE: Every page MUST have unique, descriptive title and description.
 * Duplicate metadata confuses AI citation engines and dilutes authority.
 */
export function buildMeta(overrides: Partial<PageSEO> & { title: string; description: string; canonical: string }): PageSEO {
  const { title, description, canonical } = overrides;

  return {
    title,
    description,
    canonical,
    robots: overrides.robots ?? 'index, follow, max-snippet:-1, max-image-preview:large',
    og: {
      title,
      description,
      image: SITE.ogImage,
      imageAlt: `${SITE.name} — ${SITE.tagline}`,
      url: canonical,
      type: 'website',
      locale: 'en_NG',
      siteName: SITE.name,
      ...overrides.og
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      image: SITE.ogImage,
      imageAlt: `${SITE.name} — ${SITE.tagline}`,
      ...overrides.twitter
    },
    jsonLd: overrides.jsonLd,
    datePublished: overrides.datePublished,
    dateModified: overrides.dateModified,
    hreflang: overrides.hreflang
  };
}

/** Default global SEO used as fallback in +layout.svelte */
export const defaultSEO: PageSEO = buildMeta({
  title: `${SITE.name} — ${SITE.tagline}`,
  description: SITE.description,
  canonical: SITE.url,
  robots: 'index, follow, max-snippet:-1, max-image-preview:large'
});

/** Generate canonical URL for a given path */
export function canonicalUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${SITE.url}${clean}`;
}
