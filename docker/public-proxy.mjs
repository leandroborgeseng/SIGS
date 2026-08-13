#!/usr/bin/env node
/**
 * Proxy público PROCESS_ROLE=all — stream (pipe), sem clonar o body.
 *
 *   PORT (3000) ─┬─ /api/*  →  API_PORT (3001) Nest
 *                └─ resto   →  WEB_INTERNAL_PORT (3002) Next
 *
 * O rewrite do Next clona o body (default 10mb; mesmo com 80mb ainda trunca).
 * ZIP LEDI multipart tem de chegar no Nest pelo pipe deste processo.
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

export function isApiPath(urlPath = '/') {
  const p = String(urlPath).split('?')[0] || '/';
  return p === '/api' || p.startsWith('/api/');
}

export function createPublicProxy(opts = {}) {
  const apiHost = opts.apiHost || '127.0.0.1';
  const webHost = opts.webHost || '127.0.0.1';
  const apiPort = Number(opts.apiPort || 3001);
  const webPort = Number(opts.webPort || 3002);
  const requestTimeoutMs = opts.requestTimeoutMs ?? 15 * 60 * 1000;

  const server = http.createServer((req, res) => {
    const dest = isApiPath(req.url)
      ? { host: apiHost, port: apiPort, label: 'API' }
      : { host: webHost, port: webPort, label: 'Web' };

    const headers = { ...req.headers };
    for (const h of HOP) delete headers[h];
    if (req.headers.host) {
      headers['x-forwarded-host'] ??= req.headers.host;
    }
    if (!headers['x-forwarded-proto']) {
      headers['x-forwarded-proto'] = req.socket?.encrypted ? 'https' : 'http';
    }

    const ct = String(req.headers['content-type'] || '');
    if (ct.includes('multipart/form-data')) {
      const cl = req.headers['content-length'] || 'chunked';
      console.log(
        `SIGS public-proxy stream multipart ${req.method} ${req.url} → ${dest.label}:${dest.port} content-length=${cl}`,
      );
    }

    const proxyReq = http.request(
      {
        protocol: 'http:',
        hostname: dest.host,
        port: dest.port,
        path: req.url,
        method: req.method,
        headers,
        timeout: requestTimeoutMs,
      },
      (proxyRes) => {
        const resHeaders = { ...proxyRes.headers };
        for (const h of HOP) delete resHeaders[h];
        res.writeHead(proxyRes.statusCode || 502, resHeaders);
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy(new Error('timeout'));
    });

    proxyReq.on('error', (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (!res.headersSent) {
        res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
        res.end(
          JSON.stringify({
            statusCode: 502,
            message: `Proxy público: ${dest.label} indisponível (${msg}).`,
          }),
        );
        return;
      }
      res.destroy(err);
    });

    req.on('aborted', () => proxyReq.destroy());
    req.pipe(proxyReq);
  });

  server.timeout = 0;
  server.headersTimeout = 0;
  server.requestTimeout = requestTimeoutMs;
  server.keepAliveTimeout = 120_000;
  return server;
}

function main() {
  const publicPort = Number(process.env.PORT || 3000);
  const apiPort = Number(process.env.API_PORT || 3001);
  const webPort = Number(process.env.WEB_INTERNAL_PORT || 3002);
  const server = createPublicProxy({ apiPort, webPort });
  server.listen(publicPort, '0.0.0.0', () => {
    console.log(
      `SIGS public-proxy :${publicPort} · /api → 127.0.0.1:${apiPort} (stream) · ui → 127.0.0.1:${webPort}`,
    );
  });
  server.on('error', (err) => {
    console.error('SIGS public-proxy falhou:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (thisFile === invoked) {
  main();
}
