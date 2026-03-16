import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  const baseUrl = 'https://factsport.com';

  // 1. Fetch the latest 500 matches
  const { data: matches } = await supabase
    .from('matches')
    .select('id, updated_at')
    .order('match_date', { ascending: false })
    .limit(500);

  // 2. Fetch the latest 500 news articles
  const { data: news } = await supabase
    .from('news')
    .select('slug, updated_at')
    .order('created_at', { ascending: false })
    .limit(500);

  // 3. Build Match URLs
  const matchUrls = (matches || []).map((match) => ({
    url: `${baseUrl}/match/${match.id}`,
    lastModified: match.updated_at ? new Date(match.updated_at) : new Date(),
    changeFrequency: 'always' as const, 
    priority: 0.9,
  }));

  // 4. Build News URLs
  const newsUrls = (news || []).map((article) => ({
    url: `${baseUrl}/news/${article.slug}`,
    lastModified: article.updated_at ? new Date(article.updated_at) : new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  // 5. Core Static Pages
  const staticPages = [
    '',
    '/matches',
    '/live',
    '/highlights',
    '/news',
    '/standings',
    '/leaderboard',
    '/vip/upgrade',
    '/how-to-play',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'hourly' as const,
    priority: route === '' ? 1.0 : 0.8,
  }));

  return [...staticPages, ...matchUrls, ...newsUrls];
}