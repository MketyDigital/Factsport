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
};

export default nextConfig;