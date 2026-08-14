/**
 * Corpo da fatia ZIP LEDI: octet-stream (Buffer) ou JSON Safari
 * `{ uploadId, index, total, data: base64 }` (≤ ~0.7 MB por fatia de 512 KiB).
 */
export type LediChunkJsonBody = {
  uploadId?: string;
  index?: number;
  total?: number;
  data?: string;
  fileName?: string;
  expectedTipo?: string;
  name?: string;
  totalBytes?: number;
};

function isJsonObject(body: unknown): body is LediChunkJsonBody {
  return !!body && typeof body === 'object' && !Buffer.isBuffer(body) && !Array.isArray(body);
}

export function extractLediChunkBytes(req: { body?: unknown }): Buffer {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    return Buffer.from(req.body, 'base64');
  }
  if (isJsonObject(req.body) && typeof req.body.data === 'string' && req.body.data.length) {
    return Buffer.from(req.body.data, 'base64');
  }
  return Buffer.alloc(0);
}

function pickStr(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === 'string' && v.length) return v;
  }
  return undefined;
}

function pickNum(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Query tem prioridade; JSON Safari preenche o que faltar. */
export function mergeLediChunkInput(
  req: { body?: unknown },
  q: {
    uploadId?: string;
    index?: number;
    total?: number;
    fileName?: string;
    expectedTipo?: string;
    name?: string;
    totalBytes?: number;
  },
) {
  const json = isJsonObject(req.body) ? req.body : null;
  return {
    uploadId: pickStr(q.uploadId, json?.uploadId) || '',
    index: pickNum(q.index, json?.index) ?? -1,
    total: pickNum(q.total, json?.total) ?? -1,
    body: extractLediChunkBytes(req),
    fileName: pickStr(q.fileName, json?.fileName),
    expectedTipo: pickStr(q.expectedTipo, json?.expectedTipo),
    name: pickStr(q.name, json?.name),
    totalBytes: pickNum(q.totalBytes, json?.totalBytes),
  };
}
