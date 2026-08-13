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
  async redirects() {
    // Aliases da release anterior (Stream A) — manter ≥ 1 release
    return [
      {
        source: '/odonto/lote',
        destination: '/faturamento/lote/fao',
        permanent: true,
      },
      {
        source: '/odonto/faturamento',
        destination: '/faturamento/odonto',
        permanent: true,
      },
      {
        source: '/aps/lote',
        destination: '/faturamento/lote/fai',
        permanent: true,
      },
      {
        source: '/procedimentos/lote',
        destination: '/faturamento/lote/proc',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
