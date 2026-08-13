// Preferir URL pública (build-time). Fallback `/api` = mesmo origin.
// PROCESS_ROLE=all: browser → :3000 /api → docker/public-proxy (pipe) → Nest :3001.
// next dev / PROCESS_ROLE=web: Route Handler stream p/ LEDI upload; rewrite p/ o resto.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** fetch sem Response (Safari: "Load failed"; Chrome: "Failed to fetch"). */
export class NetworkError extends Error {
  readonly code = 'NETWORK' as const;
  readonly bytesHint?: number;

  constructor(message: string, opts?: { cause?: unknown; bytesHint?: number }) {
    super(message);
    this.name = 'NetworkError';
    this.bytesHint = opts?.bytesHint;
    if (opts?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  return (
    err.name === 'TypeError' &&
    (/load failed/i.test(msg) ||
      /failed to fetch/i.test(msg) ||
      /networkerror/i.test(msg) ||
      /network request failed/i.test(msg))
  );
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sigs_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('sigs_token', token);
  else localStorage.removeItem('sigs_token');
}

export function getFacilityId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sigs_facility_id');
}

export function setFacilityId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) localStorage.setItem('sigs_facility_id', id);
  else localStorage.removeItem('sigs_facility_id');
}

function formatMb(bytes?: number): string | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function networkMessage(cause: unknown, bytesHint?: number): string {
  const raw = cause instanceof Error ? cause.message : String(cause || '');
  const size = formatMb(bytesHint);
  const sizeBit = size ? ` Payload ≈ ${size}.` : '';
  return (
    `Falha de rede no envio (sem resposta HTTP — típico Safari “Load failed” / Chrome “Failed to fetch”).` +
    sizeBit +
    ` A conexão caiu antes de uma resposta HTTP (timeout do gateway, rede ou processo derrubado).` +
    (raw ? ` Detalhe: ${raw}.` : '')
  );
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(', ')
          : String((data as { message: unknown }).message)
        : `Erro HTTP ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

async function doFetch(input: string, init: RequestInit, bytesHint?: number): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (e) {
    if (isNetworkError(e) || e instanceof TypeError) {
      throw new NetworkError(networkMessage(e, bytesHint), { cause: e, bytesHint });
    }
    throw e;
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit & { json?: unknown; bytesHint?: number } = {},
): Promise<T> {
  const { json, bytesHint, ...rest } = options;

  if (rest.body instanceof FormData) {
    return apiUpload<T>(path, rest.body, { bytesHint, method: rest.method });
  }

  const headers = new Headers(rest.headers || {});
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await doFetch(
    `${API_BASE}${path}`,
    {
      ...rest,
      headers,
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    },
    bytesHint,
  );
  return parseResponse<T>(res);
}

/**
 * POST multipart. Nunca setar Content-Type — o runtime coloca boundary.
 * `Content-Type: multipart/form-data` sem boundary → HTTP 400
 * "Multipart: Unexpected end of form".
 *
 * URL: `NEXT_PUBLIC_API_URL` se absoluta (host da API ou same-origin `/api`);
 * senão `/api` no mesmo host. Em role=all o host público é o proxy, não o Next.
 */
export async function apiUpload<T = unknown>(
  path: string,
  form: FormData,
  options: { bytesHint?: number; method?: string } = {},
): Promise<T> {
  const res = await doFetch(
    `${API_BASE}${path}`,
    {
      method: options.method || 'POST',
      headers: authHeaders(),
      body: form,
    },
    options.bytesHint,
  );
  return parseResponse<T>(res);
}

/**
 * PUT/POST binário pequeno (chunk ZIP LEDI). Content-Type octet-stream —
 * não usar FormData: o gateway corta multipart grande.
 */
export async function apiBinary<T = unknown>(
  path: string,
  body: Blob | ArrayBuffer,
  options: { bytesHint?: number; method?: string } = {},
): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', 'application/octet-stream');
  const res = await doFetch(
    `${API_BASE}${path}`,
    {
      method: options.method || 'PUT',
      headers,
      body: body as BodyInit,
    },
    options.bytesHint,
  );
  return parseResponse<T>(res);
}
