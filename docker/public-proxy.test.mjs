import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import {
  createPublicProxy,
  isApiPath,
  isStreamedBody,
  isZipChunkPath,
  PUBLIC_PROXY_MAX_BODY_BYTES,
} from './public-proxy.mjs';

test('isApiPath só casa /api', () => {
  assert.equal(isApiPath('/api'), true);
  assert.equal(isApiPath('/api/v1/dental/ledi/batches/upload-zip'), true);
  assert.equal(isApiPath('/api/v1/dental/ledi/batches/upload-zip/chunk'), true);
  assert.equal(isApiPath('/api/health?x=1'), true);
  assert.equal(isApiPath('/faturamento/lote/fao'), false);
  assert.equal(isApiPath('/apix'), false);
});

test('isZipChunkPath casa POST /upload-zip/chunk', () => {
  assert.equal(isZipChunkPath('/api/v1/dental/ledi/batches/upload-zip/chunk'), true);
  assert.equal(
    isZipChunkPath('/api/v1/dental/ledi/batches/upload-zip/chunk?uploadId=x'),
    true,
  );
  assert.equal(isZipChunkPath('/api/v1/dental/ledi/batches/upload-zip'), false);
  assert.equal(isStreamedBody('/api/v1/dental/ledi/batches/upload-zip/chunk', ''), true);
  assert.equal(isStreamedBody('/api/health', 'application/octet-stream'), true);
  assert.equal(isStreamedBody('/api/health', 'application/json'), false);
});

test('413 se Content-Length > 100 MB', async () => {
  assert.equal(PUBLIC_PROXY_MAX_BODY_BYTES, 100 * 1024 * 1024);

  const api = http.createServer((_req, res) => {
    res.writeHead(200);
    res.end('should-not-reach');
  });
  await listen(api, 0);
  const web = http.createServer((_req, res) => {
    res.writeHead(500);
    res.end('web');
  });
  await listen(web, 0);
  const proxy = createPublicProxy({
    apiPort: api.address().port,
    webPort: web.address().port,
  });
  await listen(proxy, 0);
  try {
    const result = await new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: proxy.address().port,
          path: '/api/v1/dental/ledi/batches/upload-zip/chunk',
          method: 'POST',
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': String(PUBLIC_PROXY_MAX_BODY_BYTES + 1),
          },
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            resolve({
              status: res.statusCode,
              json: JSON.parse(Buffer.concat(chunks).toString('utf8')),
            });
          });
        },
      );
      req.on('error', reject);
      req.end();
    });
    assert.equal(result.status, 413);
    assert.match(String(result.json.message), /100 MB/);
  } finally {
    await close(proxy);
    await close(api);
    await close(web);
  }
});

test('pipe multipart >10mb chega inteiro na API (sem clone/truncate)', async () => {
  const bodySize = 12 * 1024 * 1024;
  const payload = Buffer.alloc(bodySize, 0x61);

  let received = 0;
  const api = http.createServer((req, res) => {
    req.on('data', (c) => {
      received += c.length;
    });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ received }));
    });
  });
  await listen(api, 0);
  const apiPort = api.address().port;

  const web = http.createServer((_req, res) => {
    res.writeHead(500);
    res.end('web should not receive /api');
  });
  await listen(web, 0);
  const webPort = web.address().port;

  const proxy = createPublicProxy({ apiPort, webPort, requestTimeoutMs: 60_000 });
  await listen(proxy, 0);
  const proxyPort = proxy.address().port;

  try {
    const result = await postBuffer(
      proxyPort,
      '/api/v1/dental/ledi/batches/upload-zip',
      payload,
      'multipart/form-data; boundary=----TestBoundary',
    );
    assert.equal(result.status, 200);
    assert.equal(result.json.received, bodySize);
    assert.equal(received, bodySize);
  } finally {
    await close(proxy);
    await close(api);
    await close(web);
  }
});

test('POST /upload-zip/chunk octet-stream chega na API (idle no meio do body)', async () => {
  const bodySize = 512 * 1024;
  const payload = Buffer.alloc(bodySize, 0x62);

  let received = 0;
  const api = http.createServer((req, res) => {
    assert.equal(req.method, 'POST');
    assert.match(req.url, /\/upload-zip\/chunk/);
    req.on('data', (c) => {
      received += c.length;
    });
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ received }));
    });
  });
  await listen(api, 0);
  const apiPort = api.address().port;

  const web = http.createServer((_req, res) => {
    res.writeHead(500);
    res.end('web should not receive /api');
  });
  await listen(web, 0);
  const webPort = web.address().port;

  const proxy = createPublicProxy({ apiPort, webPort, requestTimeoutMs: 5_000 });
  await listen(proxy, 0);
  const proxyPort = proxy.address().port;

  try {
    const result = await postBufferWithIdle(
      proxyPort,
      '/api/v1/dental/ledi/batches/upload-zip/chunk?uploadId=x&index=0&total=1',
      payload,
      'application/octet-stream',
      750,
    );
    assert.equal(result.status, 200);
    assert.equal(result.json.received, bodySize);
    assert.equal(received, bodySize);
  } finally {
    await close(proxy);
    await close(api);
    await close(web);
  }
});

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.listen(port, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
}

function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function postBuffer(port, pathName, buf, contentType) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathName,
        method: 'POST',
        headers: {
          'content-type': contentType,
          'content-length': buf.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    req.on('error', reject);
    req.end(buf);
  });
}

/** Envia o body em duas metades com pausa — o proxy não pode cortar idle. */
function postBufferWithIdle(port, pathName, buf, contentType, idleMs) {
  return new Promise((resolve, reject) => {
    const mid = Math.max(1, Math.floor(buf.length / 2));
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathName,
        method: 'POST',
        headers: {
          'content-type': contentType,
          'content-length': buf.length,
        },
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }
          resolve({ status: res.statusCode, json });
        });
      },
    );
    req.on('error', reject);
    req.write(buf.subarray(0, mid));
    setTimeout(() => {
      req.write(buf.subarray(mid));
      req.end();
    }, idleMs);
  });
}
