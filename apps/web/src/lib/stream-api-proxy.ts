/**
 * Encaminha o Request para a API interna em streaming (sem bufferizar o ZIP).
 * Usado pelos Route Handlers /api/v1/dental/ledi/... quando o Next ainda
 * recebe o upload (next dev / PROCESS_ROLE=web). Em PROCESS_ROLE=all o
 * docker/public-proxy.mjs pega /api antes do Next. Teto documentado: 100 MB.
 */

function apiOrigin(): string {
  return (process.env.API_INTERNAL_URL || 'http://127.0.0.1:3001').replace(/\/$/, '');
}

const PASS_HEADERS = [
  'content-type',
  'content-length',
  'authorization',
  'x-correlation-id',
  'x-request-id',
  'cookie',
  'accept',
] as const;

export function internalApiUrl(request: Request): string {
  const incoming = new URL(request.url);
  return `${apiOrigin()}${incoming.pathname}${incoming.search}`;
}

export async function streamToInternalApi(request: Request): Promise<Response> {
  const url = internalApiUrl(request);
  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }

  const init: RequestInit & { duplex: 'half' } = {
    method: request.method,
    headers,
    duplex: 'half',
    redirect: 'manual',
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    if (!request.body) {
      return Response.json(
        {
          statusCode: 400,
          message:
            'Upload sem stream de corpo (o Next consumiu o body antes do pipe). ' +
            'No Railway PROCESS_ROLE=all o ZIP deve ir pelo proxy público :3000 /api → Nest :3001, sem rewrite.',
        },
        { status: 400 },
      );
    }
    init.body = request.body;
  }

  try {
    const res = await fetch(url, init);
    const out = new Headers();
    const ct = res.headers.get('content-type');
    if (ct) out.set('content-type', ct);
    const corr = res.headers.get('x-correlation-id');
    if (corr) out.set('x-correlation-id', corr);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: out,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      {
        statusCode: 502,
        message: `Falha ao encaminhar o upload em stream para a API (${url}): ${msg}`,
      },
      { status: 502 },
    );
  }
}
