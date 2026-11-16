/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.espncdn.com', // Allows team logos from ESPN
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
      },
    ],
  },

  // 🛡️ SECURITY ADDITION: HTTP Security Headers
  async headers() {
    return [
      {
        // Apply these headers to all routes
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload' // Forces HTTPS for 2 years
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN' // Prevents your site from being embedded in a malicious iframe (Clickjacking)
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff' // Prevents browsers from guessing file types (Stops XSS)
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin' // Protects user privacy on external links
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' // Blocks malicious browser feature access
          }
        ],
      },
      // 🟢 THE CORS BOUNCER (Stops other websites from using your API)
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://factsport.com" }, 
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ]
      }
    ];
  },
};

export default nextConfig;
