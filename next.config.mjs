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
      // 🟢 ADDED: Allows Next.js Image component to work with Cloudinary
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  
  // 🟢 ADDED: The Secret Proxy Tunnel to Cloudinary
  async rewrites() {
    return [
      {
        // Whenever the frontend asks for an image starting with /cdn/
        source: '/cdn/:path*',
        // Next.js silently fetches it from your Cloudinary account
        destination: 'https://res.cloudinary.com/dggojl7qm/image/upload/:path*',
      },
    ];
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
    ];
  },
};

export default nextConfig;