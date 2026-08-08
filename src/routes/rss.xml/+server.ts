// src/routes/rss.xml/+server.ts
// AI-friendly RSS/Atom feed for content aggregators and LLM pipelines.
// AEO NOTE: RSS is used by AI content aggregators (Perplexity, news LLMs) to
// track updates. A well-formed feed increases citation frequency.

import type { RequestHandler } from '@sveltejs/kit';

const SITE_URL = 'https://pulseodds.ewinproject.org';
const SITE_NAME = 'PulseOdds — Sports Odds Intelligence';
const AUTHOR = 'Omale Danjuma Ogale';

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface FeedItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  guid: string;
  category?: string;
}

export const GET: RequestHandler = async () => {
  const now = new Date().toUTCString();

  // Core platform pages as feed items — these represent the main content units
  const items: FeedItem[] = [
    {
      title: 'Football Odds Screener — PulseOdds',
      link: `${SITE_URL}/football`,
      description:
        'Half-time/full-time profile analysis, correct score clusters, BTTS, 5-lamp scoreboard and live market ranking for football betting markets.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/football`,
      category: 'Football'
    },
    {
      title: 'Basketball Odds Screener — PulseOdds',
      link: `${SITE_URL}/basketball`,
      description:
        'Market Expected Total (MET) analysis, team totals, quarter pace, and spread ranking across basketball betting markets.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/basketball`,
      category: 'Basketball'
    },
    {
      title: 'Tennis Odds Screener — PulseOdds',
      link: `${SITE_URL}/tennis`,
      description:
        'Market Expected Games (MEG), correct score intelligence, surface modifiers and dual tiebreak signals for tennis markets.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/tennis`,
      category: 'Tennis'
    },
    {
      title: 'Table Tennis Screener — PulseOdds',
      link: `${SITE_URL}/rally`,
      description:
        'Full match and first-set multi-market screening, safest pick, margin rank, sweep shapes and set metrics for table tennis.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/rally`,
      category: 'Table Tennis'
    },
    {
      title: 'American Football Screener — PulseOdds',
      link: `${SITE_URL}/american-football`,
      description:
        'Moneyline, point spread, game totals and team totals with MEPT and team sum consistency for NFL betting markets.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/american-football`,
      category: 'American Football'
    },
    {
      title: 'Rugby Screener — PulseOdds',
      link: `${SITE_URL}/rugby`,
      description:
        'Moneyline, handicap and total points with MET and team sum consistency for rugby union and league markets.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/rugby`,
      category: 'Rugby'
    },
    {
      title: 'Cricket Screener — PulseOdds',
      link: `${SITE_URL}/cricket`,
      description:
        'Match winner, run line and total runs with MER and team sum consistency across Test, ODI and T20 markets.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/cricket`,
      category: 'Cricket'
    },
    {
      title: 'MMA Screener — PulseOdds',
      link: `${SITE_URL}/mma`,
      description:
        'Fight winner, total rounds and method-of-victory with MERT across UFC and other combat sports markets.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/mma`,
      category: 'MMA'
    },
    {
      title: 'Volleyball Screener — PulseOdds',
      link: `${SITE_URL}/volleyball`,
      description:
        'Match winner, total sets and first-set markets with set-shape modeling and sweep signals.',
      pubDate: 'Mon, 27 Jul 2026 00:00:00 GMT',
      guid: `${SITE_URL}/volleyball`,
      category: 'Volleyball'
    }
  ];

  const itemsXML = items
    .map(
      (item) => `
    <item>
      <title>${escapeXML(item.title)}</title>
      <link>${item.link}</link>
      <description>${escapeXML(item.description)}</description>
      <pubDate>${item.pubDate}</pubDate>
      <guid isPermaLink="true">${item.guid}</guid>
      <author>${escapeXML(AUTHOR)}</author>
      ${item.category ? `<category>${escapeXML(item.category)}</category>` : ''}
    </item>`
    )
    .join('');

  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXML(SITE_NAME)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXML('PulseOdds — Mathematical sports odds screening for football, basketball, tennis and table tennis. Part of the Elite Workforce Impact Nigeria (E-WIN) Project.')}</description>
    <language>en-NG</language>
    <lastBuildDate>${now}</lastBuildDate>
    <managingEditor>${escapeXML(AUTHOR)}</managingEditor>
    <copyright>© 2025-2026 Elite Workforce Impact Nigeria Project</copyright>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${SITE_URL}/favicon.svg</url>
      <title>${escapeXML(SITE_NAME)}</title>
      <link>${SITE_URL}</link>
    </image>
    ${itemsXML}
  </channel>
</rss>`;

  return new Response(feed, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=900'
    }
  });
};
