/** @type {import('next').NextConfig} */
const apiProxy = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

const nextConfig = {
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

module.exports = nextConfig;
