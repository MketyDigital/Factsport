import { MetadataRoute } from 'next'
 

export default function robots(): MetadataRoute.Robots {
  // Logic: If we are on the production URL, allow everything.
  // We can't easily check domain inside this function, but the middleware lock
  // from Step 2 already prevents Google from crawling the Vercel site.
  
  // This is the standard config for your MAIN site
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://factsport.com/sitemap.xml',
  }
}