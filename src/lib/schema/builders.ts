// src/lib/schema/builders.ts
// Schema.org JSON-LD factory functions.
// ALL schema is assembled in server load() functions and passed as a serialized string
// to be rendered inside <svelte:head> — never injected client-side.

import type {
  SchemaBase,
  AuthorData,
  BreadcrumbItem,
  ArticleData,
  FAQItem,
  HowToStep,
  ProductData,
  SiteConfig
} from '$lib/types/seo';

/** Site-wide config — single source of truth for schema generation */
export const SITE: SiteConfig = {
  name: 'PulseOdds',
  tagline: 'Read the odds. Own the edge. Beat the Bookies.',
  url: 'https://pulseodds.ewinproject.org',
  description:
    'PulseOdds is a mathematical sports odds screening platform for football, basketball, tennis and table tennis. Profile verdicts, confidence scoring, and auto-saved picks for informed Nigerian punters.',
  logo: 'https://pulseodds.ewinproject.org/favicon.svg',
  ogImage: 'https://pulseodds.ewinproject.org/og-image.png',
  locale: 'en_NG',
  author: {
    name: 'Omale Danjuma Ogale',
    role: 'Founder & CEO',
    url: 'https://omaledanjumaogale.ewinproject.org/',
    sameAs: ['https://omaledanjumaogale.ewinproject.org/']
  },
  organization: {
    legalName: 'Elite Workforce Impact Nigeria Project',
    url: 'https://ewinproject.org',
    logo: 'https://ewinproject.org/logo.png',
    sameAs: ['https://ewinproject.org', 'https://pulseodds.ewinproject.org']
  }
};

/** Build Organization schema for E-WIN / PulseOdds */
export function buildOrganizationSchema(): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    legalName: SITE.organization.legalName,
    url: SITE.url,
    logo: {
      '@type': 'ImageObject',
      url: SITE.logo
    },
    parentOrganization: {
      '@type': 'Organization',
      name: 'Elite Workforce Impact Nigeria Project',
      url: SITE.organization.url
    },
    description: SITE.description,
    sameAs: SITE.organization.sameAs,
    foundingDate: '2025',
    founder: {
      '@type': 'Person',
      name: SITE.author.name,
      url: SITE.author.url
    },
    areaServed: {
      '@type': 'Country',
      name: 'Nigeria'
    }
  };
}

/** Build WebSite schema with Sitelinks Searchbox */
export function buildWebSiteSchema(): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    publisher: {
      '@id': `${SITE.url}/#organization`
    },
    inLanguage: 'en-NG',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE.url}/?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };
}

/** Build BreadcrumbList schema */
export function buildBreadcrumbSchema(crumbs: BreadcrumbItem[]): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb) => ({
      '@type': 'ListItem',
      position: crumb.position,
      name: crumb.name,
      item: crumb.url
    }))
  };
}

/** Build Article schema for blog/content pages */
export function buildArticleSchema(article: ArticleData): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${article.url}#article`,
    headline: article.title,
    description: article.description,
    url: article.url,
    image: {
      '@type': 'ImageObject',
      url: article.image
    },
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: article.author.url,
      jobTitle: article.author.role
    },
    publisher: {
      '@id': `${SITE.url}/#organization`
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url
    },
    keywords: article.keywords?.join(', '),
    inLanguage: 'en-NG'
  };
}

/** Build FAQPage schema */
export function buildFAQSchema(faqs: FAQItem[]): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };
}

/** Build HowTo schema */
export function buildHowToSchema(
  name: string,
  description: string,
  steps: HowToStep[]
): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name,
    description,
    step: steps.map((s) => ({
      '@type': 'HowToStep',
      position: s.position,
      name: s.name,
      text: s.text,
      ...(s.url ? { url: s.url } : {})
    }))
  };
}

/** Build SoftwareApplication schema for the screener SaaS */
export function buildSoftwareAppSchema(): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    applicationCategory: 'SportsApplication',
    operatingSystem: 'Any',
    url: SITE.url,
    description: SITE.description,
    offers: {
      '@type': 'Offer',
      price: '5000',
      priceCurrency: 'NGN',
      description: 'Monthly Punter Access Pass — full access to all 4 sport screeners',
      availability: 'https://schema.org/InStock'
    },
    author: {
      '@type': 'Person',
      name: SITE.author.name,
      url: SITE.author.url
    },
    publisher: {
      '@id': `${SITE.url}/#organization`
    },
    inLanguage: 'en-NG',
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      reviewCount: '1',
      bestRating: '5'
    }
  };
}

/** Build Person schema (E-E-A-T author) */
export function buildPersonSchema(author: AuthorData): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: author.url,
    jobTitle: author.role,
    ...(author.image ? { image: author.image } : {}),
    ...(author.sameAs ? { sameAs: author.sameAs } : {}),
    worksFor: {
      '@id': `${SITE.url}/#organization`
    }
  };
}

/** Build WebPage schema */
export function buildWebPageSchema(
  url: string,
  name: string,
  description: string,
  datePublished?: string,
  dateModified?: string
): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: { '@id': `${SITE.url}/#website` },
    publisher: { '@id': `${SITE.url}/#organization` },
    inLanguage: 'en-NG',
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {})
  };
}

/**
 * Merge multiple schema objects into a single @graph block
 * and return serialized JSON string for use in <svelte:head>.
 * AEO NOTE: @graph enables AI parsers to understand relationships
 * between entities on a page as a connected knowledge graph.
 */
export function buildPageGraph(schemas: SchemaBase[]): string {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': schemas.map(({ '@context': _ctx, ...rest }) => rest)
  };
  return JSON.stringify(graph, null, 0);
}
