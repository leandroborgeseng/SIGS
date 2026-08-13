/**
 * Upload de lote LEDI (FAI / FAO / PROC).
 * ZIP: fatias octet-stream 512 KiB via POST — 2.0 MB redondo caía no Safari/Railway
 * sem HTTP (“Load failed”). XML: FormData multipart (arquivos pequenos).
 */

import { apiUpload, api, apiBinary, ApiError, getToken, isNetworkError, NetworkError } from '@/lib/api';
import { IoReadError, isIoReadError, formatBytes } from '@/lib/read-binary-file';
import { isAsyncJobResponse, waitForJob } from '@/lib/jobs';

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

/** Alinhado ao FileInterceptor ZIP na API (80 MB). */
export const MAX_ZIP_BYTES = 80 * 1024 * 1024;
/** Fatia octet-stream — 512 KiB (nunca 2.0 MB redondo: Safari/Railway derruba). */
export const ZIP_CHUNK_BYTES = 512 * 1024;
/** Limite prático por XML no multipart da API. */
export const MAX_XML_BYTES = 5 * 1024 * 1024;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function wrapErr(err: unknown, fileName?: string, fileSize?: number): Error {
  if (err instanceof IoReadError || err instanceof NetworkError || err instanceof ApiError) {
    return err;
  }
  if (isIoReadError(err)) {
    return new IoReadError({
      fileName: fileName || '',
      cause: err,
      fileSize,
    });
  }
  if (isNetworkError(err)) {
    return err instanceof NetworkError
      ? err
      : new NetworkError(
          `Falha de rede no envio (sem resposta HTTP).` +
            (fileSize != null ? ` Payload ≈ ${formatBytes(fileSize)}.` : '') +
            ` A conexão caiu antes de uma resposta HTTP (timeout, rede ou processo derrubado).`,
          { cause: err, bytesHint: fileSize },
        );
  }
  if (err instanceof Error) return err;
  return new Error(String(err || 'Falha no envio'));
}

function assertZipSize(file: File): void {
  if (typeof file.size === 'number' && file.size === 0) {
    throw new IoReadError({
      fileName: file.name,
      fileSize: 0,
      fileType: file.type,
      cause: new Error('Arquivo com 0 bytes'),
    });
  }
  if (file.size > MAX_ZIP_BYTES) {
    const have = formatBytes(file.size) || '?';
    const lim = formatBytes(MAX_ZIP_BYTES) || '80 MB';
    throw new Error(
      `ZIP “${file.name}” tem ${have}; o limite de upload é ${lim}. Divida o lote ou compacte menos fichas.`,
    );
  }
}

async function postFormWithRetry<T>(
  path: string,
  buildForm: () => FormData,
  opts: { bytesHint: number; onProgress?: (msg: string) => void; label: string },
): Promise<T> {
  const attempts = 2;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      opts.onProgress?.(`Reenviando ${opts.label} (tentativa ${i + 1}/${attempts})…`);
      await sleep(600);
    }
    try {
      return await apiUpload<T>(path, buildForm(), { bytesHint: opts.bytesHint });
    } catch (e) {
      last = e;
      // Retry só em falha de rede sem HTTP (Load failed / Failed to fetch).
      if (!isNetworkError(e) && !(e instanceof NetworkError)) throw e;
      if (e instanceof ApiError) throw e;
    }
  }
  throw last;
}

function newUploadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function postZipChunkWithRetry<T>(
  path: string,
  blob: Blob,
  opts: { bytesHint: number; onProgress?: (msg: string) => void; label: string },
): Promise<T> {
  const attempts = 3;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      opts.onProgress?.(`Reenviando ${opts.label} (tentativa ${i + 1}/${attempts})…`);
      await sleep(400 * i);
    }
    try {
      return await apiBinary<T>(path, blob, { bytesHint: opts.bytesHint, method: 'POST' });
    } catch (e) {
      last = e;
      // Retry 2–3× em TypeError “Load failed” / Failed to fetch (sem HTTP).
      if (!isNetworkError(e) && !(e instanceof NetworkError)) throw e;
      if (e instanceof ApiError) throw e;
    }
  }
  throw last;
}

async function uploadZipInChunks<T extends { id: string; summary?: { total?: number } }>(opts: {
  zip: File;
  name?: string;
  expectedTipo: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  onProgress?: (msg: string) => void;
}): Promise<T | { async: true; jobId: string; xmlCount?: number }> {
  const { zip } = opts;
  const uploadId = newUploadId();
  const total = Math.max(1, Math.ceil(zip.size / ZIP_CHUNK_BYTES));
  const sizeLabel = formatBytes(zip.size) || `${zip.size} B`;
  opts.onProgress?.(
    `Enviando ZIP ${zip.name} (${sizeLabel}) em ${total} parte${total === 1 ? '' : 's'}…`,
  );

  let last: T | { async: true; jobId: string; xmlCount?: number } | { complete?: boolean } | undefined;
  for (let i = 0; i < total; i++) {
    const start = i * ZIP_CHUNK_BYTES;
    const end = Math.min(start + ZIP_CHUNK_BYTES, zip.size);
    const blob = zip.slice(start, end);
    opts.onProgress?.(`Enviando parte ${i + 1}/${total} (${sizeLabel})…`);

    const qs = new URLSearchParams({
      uploadId,
      index: String(i),
      total: String(total),
      fileName: zip.name,
      expectedTipo: opts.expectedTipo,
      name: opts.name || zip.name.replace(/\.zip$/i, ''),
      totalBytes: String(zip.size),
    });
    const chunk = await postZipChunkWithRetry<
      T | { async: true; jobId: string; xmlCount?: number } | { complete?: boolean; received?: number }
    >(`/v1/dental/ledi/batches/upload-zip/chunk?${qs.toString()}`, blob, {
      bytesHint: blob.size,
      onProgress: opts.onProgress,
      label: `parte ${i + 1}/${total}`,
    });
    last = chunk;
    if (i < total - 1 && chunk && typeof chunk === 'object' && 'complete' in chunk && chunk.complete === true) {
      break;
    }
  }

  if (!last || (typeof last === 'object' && 'complete' in last && last.complete === false)) {
    throw new Error('Upload em partes não concluiu — tente de novo.');
  }
  return last as T | { async: true; jobId: string; xmlCount?: number };
}

export async function uploadLediBatchMultipart<
  T extends { id: string; summary?: { total?: number } },
>(opts: {
  files: File[];
  name?: string;
  expectedTipo: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  onProgress?: (msg: string) => void;
}): Promise<LediUploadResult<T>> {
  if (!opts.files.length) throw new Error('Selecione arquivos .xml ou um .zip');
  if (!getToken()) throw new Error('Sessão expirada — faça login de novo.');

  const zips = opts.files.filter((f) => /\.zip$/i.test(f.name));
  const xmls = opts.files.filter((f) => /\.xml$/i.test(f.name));

  try {
    if (zips.length) {
      if (zips.length > 1) throw new Error('Envie um ZIP por vez.');
      const zip = zips[0]!;
      assertZipSize(zip);

      const sizeLabel = formatBytes(zip.size) || `${zip.size} B`;
      opts.onProgress?.(`Enviando ZIP ${zip.name} (${sizeLabel}) em partes (sem multipart grande)…`);

      const uploaded = await uploadZipInChunks<T>({
        zip,
        name: opts.name,
        expectedTipo: opts.expectedTipo,
        onProgress: opts.onProgress,
      });

      let batch: T;
      if (isAsyncJobResponse(uploaded)) {
        const n = uploaded.xmlCount;
        opts.onProgress?.(
          n
            ? `ZIP aceito (${n} XMLs). Analisando no servidor — lotes grandes como sistemas.zip não cabem no request HTTP…`
            : 'ZIP aceito. Analisando no servidor…',
        );
        const job = await waitForJob(uploaded.jobId, {
          timeoutMs: 15 * 60_000,
          onProgress: (j) => {
            const pct = j.progressPct != null ? ` ${j.progressPct}%` : '';
            opts.onProgress?.(j.progressMessage ? `${j.progressMessage}${pct}` : `Processando ZIP…${pct}`);
          },
        });
        if (job.status !== 'completed') {
          throw new Error(job.errorMessage || `Falha ao importar ZIP (${job.status})`);
        }
        const batchId = job.result?.batchId;
        if (typeof batchId !== 'string' || !batchId) {
          throw new Error('Importação concluiu sem id de lote — recarregue Faturamento → Lote.');
        }
        batch = await api<T>(`/v1/dental/ledi/batches/${batchId}`);
      } else {
        batch = uploaded;
      }

      return { batch, uploaded: batch.summary?.total ?? 0, failedNames: [] };
    }

    if (!xmls.length) throw new Error('Selecione arquivos .xml ou um .zip');

    const tooBig = xmls.filter((f) => f.size > MAX_XML_BYTES);
    if (tooBig.length) {
      const f = tooBig[0]!;
      throw new Error(
        `XML “${f.name}” tem ${formatBytes(f.size)}; limite por arquivo é ${formatBytes(MAX_XML_BYTES)}.`,
      );
    }
    const empty = xmls.filter((f) => f.size === 0);
    if (empty.length === xmls.length) {
      throw new IoReadError({
        fileName: empty[0]?.name || 'XMLs',
        fileSize: 0,
        cause: new Error('Todos os XMLs têm 0 bytes'),
      });
    }

    const usable = xmls.filter((f) => f.size > 0);
    const failedNames = empty.map((f) => f.name);
    const totalBytes = usable.reduce((s, f) => s + f.size, 0);

    opts.onProgress?.(`Enviando ${usable.length} XML(s) via multipart (${formatBytes(totalBytes)})…`);

    const batch = await postFormWithRetry<T>(
      '/v1/dental/ledi/batches/upload',
      () => {
        const form = new FormData();
        for (const f of usable) form.append('files', f, f.name);
        if (opts.name) form.append('name', opts.name);
        form.append('expectedTipo', opts.expectedTipo);
        return form;
      },
      {
        bytesHint: totalBytes,
        onProgress: opts.onProgress,
        label: `${usable.length} XMLs`,
      },
    );

    return { batch, uploaded: usable.length, failedNames };
  } catch (e) {
    const zip = zips[0];
    throw wrapErr(e, zip?.name, zip?.size);
  }
}
