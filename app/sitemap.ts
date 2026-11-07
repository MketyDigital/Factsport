import { MetadataRoute } from 'next'
import { listPublicEditorialArticles } from '@/lib/adapters/postgres-editorial'
import { listPostgresMatchesWindow } from '@/lib/adapters/postgres-matches'

const SITE_URL = 'https://factsport.com'

const STATIC_ROUTES = [
  ['', 1.0, 'daily'],
  ['/news', 0.9, 'hourly'],
  ['/matches', 0.9, 'hourly'],
  ['/live', 0.9, 'always'],
  ['/highlights', 0.8, 'daily'],
  ['/standings', 0.8, 'daily'],
  ['/tournaments', 0.7, 'daily'],
  ['/privacy-policy', 0.3, 'yearly'],
  ['/terms', 0.3, 'yearly'],
  ['/disclaimer', 0.3, 'yearly'],
] as const

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sitemap is intentionally fail-closed. Do not query the legacy Supabase
  // database from the V2 public sitemap or expose a partial mixed data source.
  const ready =
    process.env.NODE_ENV === 'production' &&
    process.env.FACTSPORT_INDEXING_ENABLED === 'true' &&
    process.env.FACTSPORT_SITEMAP_BACKEND === 'postgres' &&
    process.env.FACTSPORT_EDITORIAL_BACKEND === 'postgres' &&
    process.env.FACTSPORT_MATCHES_BACKEND === 'postgres'

  if (!ready) return []

  try {
    const now = new Date()
    const from = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
    const to = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)

    const [articles, matches] = await Promise.all([
      listPublicEditorialArticles({ limit: 50, offset: 0 }),
      listPostgresMatchesWindow({ from: from.toISOString(), to: to.toISOString() }),
    ])

    const staticUrls: MetadataRoute.Sitemap = STATIC_ROUTES.map(([route, priority, changeFrequency]) => ({
      url: `${SITE_URL}${route}`,
      changeFrequency,
      priority,
    }))

    const articleUrls: MetadataRoute.Sitemap = articles
      .filter(article => !!article.slug && !!article.published_at)
      .map(article => ({
        url: `${SITE_URL}/news/${encodeURIComponent(article.slug)}`,
        lastModified: new Date(article.updated_at || article.published_at),
        changeFrequency: 'weekly',
        priority: 0.7,
      }))

    const matchUrls: MetadataRoute.Sitemap = matches
      .filter(match => !!match.id && !!match.match_date)
      .map(match => ({
        url: `${SITE_URL}/match/${match.id}`,
        lastModified: new Date(match.updated_at || match.match_date),
        changeFrequency: 'hourly',
        priority: 0.6,
      }))

    return [...staticUrls, ...articleUrls, ...matchUrls]
  } catch (error) {
    console.error('V2 public sitemap generation failed closed', error)
    return []
  }
}
