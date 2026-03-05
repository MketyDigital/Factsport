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
      // Allows Next.js Image component to work with Cloudinary
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
  
  // The Secret Proxy Tunnel to Cloudinary
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

  // HTTP Security Headers
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
            value: 'SAMEORIGIN' // Prevents clickjacking
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff' // Stops XSS
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin' 
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' 
          }
        ],
      },
    ];
  },

  // BUILD FIX: Comprehensive fallback list for Twitter SDK on Edge/Cloudflare
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
        zlib: false,
        stream: false,
        http: false,
        https: false,
        crypto: false,
        os: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;