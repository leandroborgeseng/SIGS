/** @type {import('next').NextConfig} */
const apiProxy = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  // Rewrite externo SEMPRE clona o body (Next cloneBodyStream; default 10mb).
  // A UI LEDI envia ZIP em fatias 512 KiB (/upload-zip/chunk) via XHR (Safari).
  // XMLs soltos: POST /upload. Route Handler stream
  // (app/api/v1/dental/ledi/...) tem precedência de FS; em PROCESS_ROLE=all o
  // docker/public-proxy.mjs pega /api antes do Next.
  experimental: {
    middlewareClientMaxBodySize: '100mb',
    proxyTimeout: 300_000,
  },
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
        source: '/aps/faturamento',
        destination: '/faturamento/aps',
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
