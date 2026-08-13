/**
 * Docker/Railway HEALTHCHECK — tenta API direta, depois proxy Next.
 * Exit 0 = ok; 1 = falha.
 */
const apiPort = process.env.API_PORT || (process.env.PROCESS_ROLE === 'all' ? '3001' : null);
const publicPort = process.env.PORT || '3000';
const candidates = [];
if (apiPort) candidates.push(`http://127.0.0.1:${apiPort}/api/health`);
candidates.push(`http://127.0.0.1:${publicPort}/api/health`);

async function probe(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json().catch(() => ({}));
  if (body && body.status && body.status !== 'ok') throw new Error(`status=${body.status}`);
}

let lastErr;
for (const url of candidates) {
  try {
    await probe(url);
    process.exit(0);
  } catch (err) {
    lastErr = err;
  }
}
console.error('healthcheck failed:', lastErr?.message || lastErr);
process.exit(1);
