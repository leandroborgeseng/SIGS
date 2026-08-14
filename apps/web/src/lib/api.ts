// Browser: sempre mesmo origin `/api` — evita preflight CORS (PUT/octet-stream
// em host da API divergente → Safari “Load failed” / Failed to fetch).
// PROCESS_ROLE=all: :3000 /api → docker/public-proxy (pipe) → Nest :3001.
// next dev / PROCESS_ROLE=web: Route Handler stream p/ LEDI; rewrite p/ o resto.
// SSR: NEXT_PUBLIC_API_URL se absoluta; senão `/api`.
function apiBase(): string {
  if (typeof window !== 'undefined') return '/api';
  return process.env.NEXT_PUBLIC_API_URL || '/api';
}

/** Timeout por pedido. Fatia ZIP: 3 min — Safari abortava ~2 MB sem HTTP. */
export const API_FETCH_TIMEOUT_MS = 180_000;
export const API_BINARY_TIMEOUT_MS = 180_000;

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

export const API_DOWN_MESSAGE =
  'API fora do ar (GET /api/health falhou). O servidor não está respondendo — tente de novo em instantes; se persistir, o processo Nest ou o proxy caiu.';

/** fetch sem Response (Safari: "Load failed"; Chrome: "Failed to fetch"). */
export class NetworkError extends Error {
  readonly code = 'NETWORK' as const;
  readonly bytesHint?: number;
  readonly apiDown?: boolean;

  constructor(message: string, opts?: { cause?: unknown; bytesHint?: number; apiDown?: boolean }) {
    super(message);
    this.name = 'NetworkError';
    this.bytesHint = opts?.bytesHint;
    this.apiDown = opts?.apiDown;
    if (opts?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export function isNetworkError(err: unknown): boolean {
  if (err instanceof NetworkError) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message || '';
  if (err.name === 'AbortError' || /aborted|the operation was aborted/i.test(msg)) {
    return true;
  }
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

function networkMessage(cause: unknown, bytesHint?: number, apiDown?: boolean): string {
  if (apiDown) return API_DOWN_MESSAGE;
  const raw = cause instanceof Error ? cause.message : String(cause || '');
  const size = formatMb(bytesHint);
  const small = typeof bytesHint === 'number' && bytesHint < 1024 * 1024;
  const sizeBit = size
    ? small
      ? ` O corpo era pequeno (${size}) — não é limite de tamanho.`
      : ` Payload ≈ ${size}.`
    : '';
  return (
    `Falha de rede no envio (sem resposta HTTP — típico Safari “Load failed” / Chrome “Failed to fetch”).` +
    sizeBit +
    (small
      ? ` A conexão foi fechada pelo proxy/API (socket, CORS ou processo).`
      : ` A conexão caiu antes de uma resposta HTTP (timeout do gateway, rede ou processo derrubado).`) +
    (raw ? ` Detalhe: ${raw}.` : '')
  );
}

/** GET /api/health — não usa doFetch (evita recursão). */
export async function probeApiHealth(): Promise<'ok' | 'down'> {
  try {
    const res = await fetch(`${apiBase()}/health`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return 'down';
    const body = (await res.json().catch(() => null)) as { status?: string } | null;
    if (body && body.status && body.status !== 'ok') return 'down';
    return 'ok';
  } catch {
    return 'down';
  }
}

export async function assertApiReachable(): Promise<void> {
  const status = await probeApiHealth();
  if (status === 'down') {
    throw new NetworkError(API_DOWN_MESSAGE, { apiDown: true });
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseHttpJson<T>(status: number, text: string): Promise<T> {
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (status < 200 || status >= 300) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(', ')
          : String((data as { message: unknown }).message)
        : `Erro HTTP ${status}`;
    throw new ApiError(status, msg, data);
  }

  return data as T;
}

async function parseResponse<T>(res: Response): Promise<T> {
  return parseHttpJson<T>(res.status, await res.text());
}

async function doFetch(
  input: string,
  init: RequestInit,
  bytesHint?: number,
  timeoutMs = API_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      credentials: 'same-origin',
      signal: init.signal ?? ctrl.signal,
    });
  } catch (e) {
    if (isNetworkError(e) || e instanceof TypeError) {
      const down = (await probeApiHealth()) === 'down';
      throw new NetworkError(networkMessage(e, bytesHint, down), {
        cause: e,
        bytesHint,
        apiDown: down,
      });
    }
    throw e;
  } finally {
    clearTimeout(timer);
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
    `${apiBase()}${path}`,
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
 * URL: sempre `/api` no browser (mesmo origin). Em role=all o host público é o proxy.
 */
export async function apiUpload<T = unknown>(
  path: string,
  form: FormData,
  options: { bytesHint?: number; method?: string } = {},
): Promise<T> {
  const res = await doFetch(
    `${apiBase()}${path}`,
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
 * POST binário (chunk ZIP LEDI). Safari: XMLHttpRequest + ArrayBuffer —
 * `fetch` + Blob/octet-stream costuma RST (“Load failed”) sem HTTP.
 * POST (não PUT) — Bearer no header; cookies não autenticam esta rota.
 */
export async function apiBinary<T = unknown>(
  path: string,
  body: Blob | ArrayBuffer,
  options: { bytesHint?: number; method?: string } = {},
): Promise<T> {
  const buf = body instanceof ArrayBuffer ? body : await body.arrayBuffer();
  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    Accept: 'application/json',
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `${apiBase()}${path}`;
  const method = options.method || 'POST';
  try {
    if (typeof XMLHttpRequest !== 'undefined') {
      const { status, text } = await xhrSend(url, {
        method,
        headers,
        body: buf,
        timeoutMs: API_BINARY_TIMEOUT_MS,
      });
      return parseHttpJson<T>(status, text);
    }
    const hdrs = new Headers();
    for (const [k, v] of Object.entries(headers)) hdrs.set(k, v);
    const res = await doFetch(
      url,
      { method, headers: hdrs, body: buf },
      options.bytesHint,
      API_BINARY_TIMEOUT_MS,
    );
    return parseResponse<T>(res);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (isNetworkError(e) || e instanceof TypeError) {
      const down = (await probeApiHealth()) === 'down';
      throw new NetworkError(networkMessage(e, options.bytesHint, down), {
        cause: e,
        bytesHint: options.bytesHint,
        apiDown: down,
      });
    }
    throw e;
  }
}

/** Teto do fallback JSON (512 KiB × 4/3 ≈ 0,67 MB). */
export const JSON_CHUNK_MAX_BYTES = Math.floor(0.7 * 1024 * 1024);

export type LediChunkJsonPayload = {
  uploadId?: string;
  index?: number;
  total?: number;
  data: string;
  fileName?: string;
  expectedTipo?: string;
  name?: string;
  totalBytes?: number;
};

export async function blobToBase64(body: Blob | ArrayBuffer): Promise<string> {
  const blob = body instanceof ArrayBuffer ? new Blob([body]) : body;
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || '');
        const comma = s.indexOf(',');
        resolve(comma >= 0 ? s.slice(comma + 1) : s);
      };
      r.onerror = () => reject(r.error || new Error('FileReader falhou'));
      r.readAsDataURL(blob);
    });
  }
  const buf = body instanceof ArrayBuffer ? body : await body.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const step = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function chunkJsonFromPath(path: string, data: string): LediChunkJsonPayload {
  const payload: LediChunkJsonPayload = { data };
  try {
    const u = new URL(path, 'http://sigs.invalid');
    const uploadId = u.searchParams.get('uploadId') || undefined;
    const index = u.searchParams.get('index');
    const total = u.searchParams.get('total');
    const fileName = u.searchParams.get('fileName') || undefined;
    const expectedTipo = u.searchParams.get('expectedTipo') || undefined;
    const name = u.searchParams.get('name') || undefined;
    const totalBytes = u.searchParams.get('totalBytes');
    if (uploadId) payload.uploadId = uploadId;
    if (index != null) payload.index = Number(index);
    if (total != null) payload.total = Number(total);
    if (fileName) payload.fileName = fileName;
    if (expectedTipo) payload.expectedTipo = expectedTipo;
    if (name) payload.name = name;
    if (totalBytes != null) payload.totalBytes = Number(totalBytes);
  } catch {
    /* path relativo sem query — o caller já mandou data */
  }
  return payload;
}

/**
 * Fallback Safari: POST JSON `{ uploadId, index, total, data: base64 }`.
 * O parser JSON da API já funciona (login, fichas); evita octet-stream+fetch.
 */
export async function apiChunkJson<T = unknown>(
  path: string,
  body: Blob | ArrayBuffer,
  options: { bytesHint?: number } = {},
): Promise<T> {
  const data = await blobToBase64(body);
  const json = chunkJsonFromPath(path, data);
  return api<T>(path, { method: 'POST', json, bytesHint: options.bytesHint });
}

function xhrSend(
  url: string,
  opts: {
    method: string;
    headers: Record<string, string>;
    body: XMLHttpRequestBodyInit;
    timeoutMs: number;
  },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, url, true);
    xhr.timeout = opts.timeoutMs;
    xhr.withCredentials = true;
    xhr.responseType = 'text';
    for (const [k, v] of Object.entries(opts.headers)) {
      xhr.setRequestHeader(k, v);
    }
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText || '' });
    xhr.onerror = () => reject(new TypeError('Load failed'));
    xhr.ontimeout = () => reject(new TypeError('Load failed'));
    xhr.onabort = () => reject(new TypeError('Load failed'));
    try {
      xhr.send(opts.body);
    } catch (e) {
      reject(e);
    }
  });
}
