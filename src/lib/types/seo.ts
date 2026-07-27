// src/lib/types/seo.ts
// TypeScript types for the full SEO/AEO/GEO metadata layer.
// All types are strict and align with Schema.org + Open Graph + Twitter Card standards.

/** Base Open Graph metadata */
export interface OpenGraphMeta {
  title: string;
  description: string;
  /** Absolute URL to OG image (1200×630px recommended) */
  image: string;
  imageAlt?: string;
  url: string;
  type: 'website' | 'article' | 'profile';
  locale?: string;
  siteName?: string;
}

/** Twitter/X Card metadata */
export interface TwitterMeta {
  card: 'summary' | 'summary_large_image' | 'app' | 'player';
  title: string;
  description: string;
  image?: string;
  imageAlt?: string;
  site?: string;
  creator?: string;
}

/** Base interface for all Schema.org objects */
export interface SchemaBase {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

/** Breadcrumb item for BreadcrumbList schema */
export interface BreadcrumbItem {
  name: string;
  /** Absolute URL */
  url: string;
  position: number;
}

/** Author / Person data for E-E-A-T compliance */
export interface AuthorData {
  name: string;
  role: string;
  url: string;
  image?: string;
  sameAs?: string[];
}

/** FAQ item for FAQPage schema */
export interface FAQItem {
  question: string;
  answer: string;
}

/** Article data for Article schema */
export interface ArticleData {
  title: string;
  description: string;
  url: string;
  image: string;
  datePublished: string; // ISO 8601
  dateModified: string;  // ISO 8601
  author: AuthorData;
  keywords?: string[];
}

/** How-to step for HowTo schema */
export interface HowToStep {
  name: string;
  text: string;
  position: number;
  url?: string;
}

/** Product data */
export interface ProductData {
  name: string;
  description: string;
  url: string;
  image: string;
  price: string;
  currency: string;
  availability: 'InStock' | 'OutOfStock' | 'PreOrder';
}

/** Full page SEO config — passed to SEO.svelte component */
export interface PageSEO {
  title: string;
  description: string;
  /** Canonical URL (absolute) */
  canonical: string;
  /** robots meta content */
  robots?: string;
  og: OpenGraphMeta;
  twitter: TwitterMeta;
  /** Serialized JSON-LD string (from buildPageGraph) — rendered server-side */
  jsonLd?: string;
  /** datePublished for content pages (ISO 8601) */
  datePublished?: string;
  /** dateModified for content pages (ISO 8601) */
  dateModified?: string;
  /** hreflang pairs for i18n */
  hreflang?: { lang: string; url: string }[];
}

/** Global site config used as default SEO base */
export interface SiteConfig {
  name: string;
  tagline: string;
  url: string;
  description: string;
  logo: string;
  ogImage: string;
  locale: string;
  twitterHandle?: string;
  author: AuthorData;
  organization: {
    legalName: string;
    url: string;
    logo: string;
    sameAs: string[];
  };
}
