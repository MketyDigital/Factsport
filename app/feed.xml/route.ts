import { createClient } from '@/app/lib/supabase/server';
import { NextResponse } from 'next/server';

export const revalidate = 60; // Cache for 1 minute

export async function GET() {
  const supabase = createClient();
  
  // Get latest 20 news articles for the RSS feed
  const { data: articles } = await supabase
    .from('news')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  const baseUrl = 'https://factsport.com';

  const rssItems = (articles || []).map((article) => `
    <item>
      <title><![CDATA[${article.title}]]></title>
      <link>${baseUrl}/news/${article.slug}</link>
      <guid>${baseUrl}/news/${article.slug}</guid>
      <pubDate>${new Date(article.created_at).toUTCString()}</pubDate>
      <description><![CDATA[${article.body?.substring(0, 200) || ''}...]]></description>
      ${article.image_url ? `<enclosure url="${article.image_url}" type="image/jpeg" length="0" />` : ''}
    </item>
  `).join('');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>FactSport - Breaking News</title>
        <link>${baseUrl}</link>
        <description>The latest football news, transfers, and sports updates.</description>
        <language>en-us</language>
        <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
        ${rssItems}
      </channel>
    </rss>`;

  return new NextResponse(rssFeed, {
    headers: {
      'Content-Type': 'text/xml',
      'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
    },
  });
}