<!-- src/lib/components/SEO.svelte -->
<!-- Universal <svelte:head> SEO component. -->
<!-- Accepts a typed PageSEO prop and renders all meta tags, OG, Twitter, canonical, and JSON-LD. -->
<!-- CRITICAL: JSON-LD is ALWAYS passed as a pre-serialized string from server load() — never built client-side. -->

<script lang="ts">
  import type { PageSEO } from '$lib/types/seo';

  // Svelte 5 runes: $props() for typed component props
  const { seo }: { seo: PageSEO } = $props();
</script>

<svelte:head>
  <!-- Primary meta -->
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <meta name="robots" content={seo.robots ?? 'index, follow'} />

  <!-- Canonical — prevents duplicate citation dilution for AI engines -->
  <link rel="canonical" href={seo.canonical} />

  <!-- Open Graph — used by social platforms and some AI scrapers -->
  <meta property="og:type" content={seo.og.type} />
  <meta property="og:title" content={seo.og.title} />
  <meta property="og:description" content={seo.og.description} />
  <meta property="og:url" content={seo.og.url} />
  <meta property="og:image" content={seo.og.image} />
  {#if seo.og.imageAlt}
    <meta property="og:image:alt" content={seo.og.imageAlt} />
  {/if}
  {#if seo.og.siteName}
    <meta property="og:site_name" content={seo.og.siteName} />
  {/if}
  <meta property="og:locale" content={seo.og.locale ?? 'en_NG'} />

  <!-- Twitter/X Card -->
  <meta name="twitter:card" content={seo.twitter.card} />
  <meta name="twitter:title" content={seo.twitter.title} />
  <meta name="twitter:description" content={seo.twitter.description} />
  {#if seo.twitter.image}
    <meta name="twitter:image" content={seo.twitter.image} />
  {/if}
  {#if seo.twitter.imageAlt}
    <meta name="twitter:image:alt" content={seo.twitter.imageAlt} />
  {/if}
  {#if seo.twitter.site}
    <meta name="twitter:site" content={seo.twitter.site} />
  {/if}
  {#if seo.twitter.creator}
    <meta name="twitter:creator" content={seo.twitter.creator} />
  {/if}

  <!-- Content dates — important for E-E-A-T and AI freshness signals -->
  {#if seo.datePublished}
    <meta property="article:published_time" content={seo.datePublished} />
  {/if}
  {#if seo.dateModified}
    <meta property="article:modified_time" content={seo.dateModified} />
  {/if}

  <!-- hreflang for i18n (future-ready) -->
  {#if seo.hreflang}
    {#each seo.hreflang as hrl}
      <link rel="alternate" hreflang={hrl.lang} href={hrl.url} />
    {/each}
  {/if}

  <!-- JSON-LD Structured Data — MUST be server-rendered string, not client-built -->
  <!-- AEO NOTE: This single @graph block tells LLMs who we are, what the page is about, -->
  <!-- and establishes entity relationships (Organization → WebSite → WebPage → Author) -->
  {#if seo.jsonLd}
    {@html `<script type="application/ld+json">${seo.jsonLd}</script>`}
  {/if}
</svelte:head>
