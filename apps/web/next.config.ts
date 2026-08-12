import type { NextConfig } from 'next';

const apiProxy =
  process.env.API_INTERNAL_URL?.replace(/\/$/, '') || 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxy}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
