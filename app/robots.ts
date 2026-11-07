import { MetadataRoute } from 'next'

const SITE_URL = 'https://factsport.com'

export default function robots(): MetadataRoute.Robots {
  // Cloudflare Workers does not guarantee Vercel's VERCEL_ENV variable.
  // Indexing is therefore an explicit release setting, disabled by default.
  // Set FACTSPORT_INDEXING_ENABLED=true only on the approved public production
  // deployment after the sitemap, canonical URLs, and content have been verified.
  const indexingEnabled =
    process.env.FACTSPORT_INDEXING_ENABLED === 'true' &&
    process.env.NODE_ENV === 'production'

  if (!indexingEnabled) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/dashboard/', '/login', '/register', '/account/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
