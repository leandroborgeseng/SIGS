#!/usr/bin/env node
/**
 * Proxy público PROCESS_ROLE=all — stream (pipe), sem clonar o body.
 *
 *   PORT (3000) ─┬─ /api/*  →  API_PORT (3001) Nest
 *                └─ resto   →  WEB_INTERNAL_PORT (3002) Next
 *
 * O rewrite do Next clona o body (default 10mb; mesmo com 100mb ainda trunca).
 * ZIP LEDI: fatias 512 KiB (octet-stream ou JSON base64) em pipe até o Nest.
 * POST /upload-zip/chunk usa Connection: close (Safari HTTP/2 multiplex).
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

/** Teto de Content-Length no proxy (ZIP LEDI até 100 MB). Fatias de 512 KiB passam. */
export const PUBLIC_PROXY_MAX_BODY_BYTES = 100 * 1024 * 1024;

export function isApiPath(urlPath = '/') {
  const p = String(urlPath).split('?')[0] || '/';
  return p === '/api' || p.startsWith('/api/');
}

/** POST/PUT da UI — fatias octet-stream 512 KiB. */
export function isZipChunkPath(urlPath = '/') {
  const p = String(urlPath).split('?')[0] || '/';
  return p.includes('/dental/ledi/batches/upload-zip/chunk');
}

/** Body em pipe: não aplicar idle timeout no socket (Safari “Load failed”). */
export function isStreamedBody(urlPath = '/', contentType = '') {
  const ct = String(contentType).toLowerCase();
  return (
    isZipChunkPath(urlPath) ||
    ct.includes('multipart/form-data') ||
    ct.includes('application/octet-stream')
  );
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

    const cl = Number(req.headers['content-length']);
    if (Number.isFinite(cl) && cl > PUBLIC_PROXY_MAX_BODY_BYTES) {
          res.writeHead(413, {
            'content-type': 'application/json; charset=utf-8',
            connection: 'close',
          });
      res.end(
        JSON.stringify({
          statusCode: 413,
          message: `Corpo excede ${Math.round(PUBLIC_PROXY_MAX_BODY_BYTES / (1024 * 1024))} MB (limite do proxy). Envie o ZIP em fatias /upload-zip/chunk.`,
        }),
      );
      req.resume();
      return;
    }

    const ct = String(req.headers['content-type'] || '');
    const streamBody = isStreamedBody(req.url, ct);
    const zipChunk = isZipChunkPath(req.url);
    // Connection: close no POST de chunk — evita HTTP/2 multiplex / keep-alive
    // reutilizar um socket já RST (Safari “Load failed” sem HTTP).
    if (zipChunk) {
      headers.connection = 'close';
    }
    if (streamBody) {
      const clh = req.headers['content-length'] || 'chunked';
      console.log(
        `SIGS public-proxy stream ${ct.split(';')[0] || 'body'} ${req.method} ${req.url} → ${dest.label}:${dest.port} content-length=${clh}${zipChunk ? ' connection=close' : ''}`,
      );
      // Idle no meio do body (Safari pausa / backpressure) não pode derrubar o socket.
      req.setTimeout(0);
      if (req.socket) req.socket.setTimeout(0);
    }

    let settled = false;
    const fail = (status, message) => {
      if (settled) return;
      settled = true;
      console.error(`SIGS public-proxy ${status} ${req.method} ${req.url}: ${message}`);
      try {
        proxyReq.destroy();
      } catch {
        /* already closed */
      }
      // Nunca destruir o socket do cliente se o Nest ainda não respondeu —
      // RST vira Safari “Load failed” sem HTTP. Sempre tenta 502/504 JSON.
      if (!res.headersSent && !res.writableEnded) {
        try {
          res.writeHead(status, {
            'content-type': 'application/json; charset=utf-8',
            connection: 'close',
          });
          res.end(JSON.stringify({ statusCode: status, message }));
        } catch (err) {
          console.error(
            'SIGS public-proxy não escreveu JSON de erro:',
            err instanceof Error ? err.message : err,
          );
        }
        return;
      }
      console.error(
        `SIGS public-proxy: Nest já respondeu; não destruo o socket do cliente (${req.method} ${req.url})`,
      );
    };

    const proxyReq = http.request(
      {
        protocol: 'http:',
        hostname: dest.host,
        port: dest.port,
        path: req.url,
        method: req.method,
        headers,
        // timeout do http.request é idle/inactivity — corta POST /upload-zip/chunk.
        timeout: streamBody ? 0 : requestTimeoutMs,
        agent: zipChunk ? false : undefined,
      },
      (proxyRes) => {
        settled = true;
        const resHeaders = { ...proxyRes.headers };
        for (const h of HOP) delete resHeaders[h];
        if (zipChunk) resHeaders.connection = 'close';
        console.log(
          `SIGS public-proxy ← ${dest.label} ${proxyRes.statusCode} ${req.method} ${req.url}`,
        );
        res.writeHead(proxyRes.statusCode || 502, resHeaders);
        proxyRes.on('error', (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`SIGS public-proxy upstream res error: ${msg}`);
          if (!res.headersSent && !res.writableEnded) {
            fail(502, `Proxy público: falha na resposta de ${dest.label} (${msg}).`);
            return;
          }
          if (!res.writableEnded) {
            try {
              res.end();
            } catch {
              /* already closed */
            }
          }
        });
        proxyRes.pipe(res);
      },
    );

    if (streamBody) {
      proxyReq.setTimeout(0);
    }

    proxyReq.on('timeout', () => {
      fail(504, `Proxy público: timeout ao falar com ${dest.label}.`);
    });

    proxyReq.on('error', (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      fail(502, `Proxy público: ${dest.label} indisponível (${msg}).`);
    });

    // Erro no pipe do body (Safari “Load failed” se o socket cair sem HTTP).
    req.on('error', (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `SIGS public-proxy req error ${req.method} ${req.url}: ${msg} settled=${settled}`,
      );
      fail(502, `Proxy público: falha no pipe (${msg}).`);
    });

    // Cliente abortou. Encerra o upstream; não RST a resposta se headers já foram.
    req.on('aborted', () => {
      console.warn(
        `SIGS public-proxy client aborted ${req.method} ${req.url} settled=${settled} headersSent=${res.headersSent}`,
      );
      if (!settled) {
        try {
          proxyReq.destroy();
        } catch {
          /* already closed */
        }
      }
    });

    req.pipe(proxyReq);
  });

  server.timeout = 0;
  // headersTimeout=0 em alguns Node fecha na hora. Manter > keepAliveTimeout.
  server.headersTimeout = Math.max(requestTimeoutMs, 125_000);
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
