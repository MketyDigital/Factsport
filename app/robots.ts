import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  // 🟢 Check if this is a Vercel production build
  // If it's a preview branch, VERCEL_ENV will be 'preview'
  const isProduction = process.env.VERCEL_ENV === 'production';

  // 🛑 If it is a preview domain (or local dev), block all robots completely
  if (!isProduction) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  // ✅ If it is your main factsport.com production site, allow crawling
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'], // Keep them out of your secure backend areas
    },
    sitemap: 'https://factsport.com/sitemap.xml',
  }
}