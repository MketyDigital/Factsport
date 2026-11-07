import { MetadataRoute } from 'next'
import { headers } from 'next/headers'

const SITE_URL = 'https://factsport.com'
const PRIVATE_PATHS = [
  '/admin', '/api', '/dashboard', '/login', '/register', '/account',
  '/auth', '/forgot-password', '/vip', '/predict', '/payment', '/checkout', '/chat',
  '/studio', '/settings', '/how-to-play', '/leaderboard',
]

export default async function robots(): Promise<MetadataRoute.Robots> {
  const privateHost = (process.env.FACTSPORT_PRIVATE_PRODUCT_HOST || '').trim().toLowerCase();
  const requestHeaders = await headers();
  const requestHost = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').split(',')[0].trim().toLowerCase().split(':')[0];
  if (privateHost && requestHost === privateHost) return { rules: { userAgent: '*', disallow: '/' } };
  // Cloudflare Workers does not guarantee Vercel's VERCEL_ENV variable.
  // Indexing is disabled unless the owner explicitly enables it after the
  // V2 PostgreSQL sitemap, public content and live host have been verified.
  const indexingEnabled =
    process.env.FACTSPORT_INDEXING_ENABLED === 'true' &&
    process.env.NODE_ENV === 'production' &&
    process.env.FACTSPORT_EDITORIAL_BACKEND === 'postgres' &&
    process.env.FACTSPORT_MATCHES_BACKEND === 'postgres' &&
    process.env.FACTSPORT_SITEMAP_BACKEND === 'postgres'

  if (!indexingEnabled) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }

  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_PATHS,
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
