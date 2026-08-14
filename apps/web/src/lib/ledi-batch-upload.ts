/**
 * Upload de lote LEDI (FAI / FAO / PROC).
 *
 * ZIP (até 100 MB): caminho feliz NÃO monta na RAM. Para cada fatia 512 KiB:
 * readFileSlice (cascata Safari: objectURL/fetch → Response → FileReader;
 * Chromium: FileReader primeiro) → XHR POST imediato → descarta o buffer.
 * WebKit: se fatia falhar, 1× fallback lendo o ZIP inteiro e fatiando em RAM.
 * Servidor junta em disco (/upload-zip/chunk) e unzipa.
 * Se o XHR octet-stream RST, fallback JSON `{ data: base64 }` só da fatia.
 * XMLs soltos: ainda POST /upload multipart (fatias ≤ 1 MB).
 */

import { api, apiBinary, apiChunkJson, apiUpload, getToken, isNetworkError, NetworkError, ApiError, assertApiReachable } from '@/lib/api';
import { IoReadError, isIoReadError, formatBytes, readBinaryFile, readFileSlice } from '@/lib/read-binary-file';
import { extractJobId, isAsyncJobResponse, jobProgressLabel, waitForJob, type JobStatus } from '@/lib/jobs';
import {
  assertLediTipoMatch,
  isMemoryError,
  parseLediTipoMismatch,
  parseLediTipoMismatchFromJob,
  shouldUnzipZipInBrowser,
  BROWSER_UNZIP_MAX_BYTES,
  sliceEntryRanges,
  unzipFallbackMessage,
  type LediLoteTipo,
} from '@/lib/ledi-xml-batch';
import { entryToXml, unzipLediXmlEntries, type LediZipXmlEntry } from '@/lib/ledi-zip-client';

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

export type LediChunkResume = {
  uploadId: string;
  startIndex: number;
};

export class ChunkUploadError extends Error {
  readonly code = 'CHUNK_UPLOAD' as const;
  readonly uploadId: string;
  readonly failedIndex: number;
  readonly total: number;
  readonly fileName: string;

  constructor(opts: {
    uploadId: string;
    failedIndex: number;
    total: number;
    fileName: string;
    cause?: unknown;
  }) {
    super(
      `Falhou na parte ${opts.failedIndex + 1}/${opts.total} de “${opts.fileName}”. ` +
        `Clique em Retomar envio (continua deste ponto) ou Recomeçar (do zero).`,
    );
    this.name = 'ChunkUploadError';
    this.uploadId = opts.uploadId;
    this.failedIndex = opts.failedIndex;
    this.total = opts.total;
    this.fileName = opts.fileName;
    if (opts.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export function isChunkUploadError(err: unknown): err is ChunkUploadError {
  return err instanceof ChunkUploadError;
}

export function parseParteProgress(msg: string): { current: number; total: number } | null {
  const m = /parte\s+(\d+)\s*\/\s*(\d+)/i.exec(msg);
  if (!m) return null;
  const current = Number(m[1]);
  const total = Number(m[2]);
  if (!Number.isFinite(current) || !Number.isFinite(total) || total < 1) return null;
  return { current, total };
}

export function isAnalyzingProgress(msg: string): boolean {
  return /analisando|extraindo|lendo zip|conferindo job|conferindo se o job/i.test(msg);
}

function lediImportJobKey(uploadId: string): string {
  return `ledi-import-zip:${uploadId}`;
}

async function recoverJobAfterLastChunk(
  uploadId: string,
): Promise<{ async: true; jobId: string } | null> {
  try {
    const job = await api<{ id: string }>(
      `/v1/jobs/by-key/${encodeURIComponent(lediImportJobKey(uploadId))}`,
    );
    if (job?.id) return { async: true, jobId: job.id };
  } catch {
    return null;
  }
  return null;
}

/** Alinhado ao FileInterceptor ZIP na API (100 MB). */
export const MAX_ZIP_BYTES = 100 * 1024 * 1024;
export { BROWSER_UNZIP_MAX_BYTES, shouldUnzipZipInBrowser };
export const ZIP_CHUNK_BYTES = 512 * 1024;
/** Limite prático por XML no multipart da API. */
export const MAX_XML_BYTES = 5 * 1024 * 1024;
const TIPO_SAMPLE = 8;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function newUploadId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function postChunkWithRetry<T>(
  path: string,
  body: ArrayBuffer,
  opts: { bytesHint: number; onProgress?: (msg: string) => void; label: string },
): Promise<T> {
  const attempts = 3;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      opts.onProgress?.(`Reenviando ${opts.label} (tentativa ${i + 1}/${attempts})…`);
      await sleep(700 * i);
    }
    try {
      return await apiBinary<T>(path, body, { bytesHint: opts.bytesHint });
    } catch (e) {
      last = e;
      if (e instanceof NetworkError && e.apiDown) throw e;
      if (e instanceof ApiError) throw e;
      if (!isNetworkError(e) && !(e instanceof NetworkError)) throw e;
      try {
        opts.onProgress?.(`${opts.label} — fallback JSON (Safari)…`);
        return await apiChunkJson<T>(path, body, { bytesHint: opts.bytesHint });
      } catch (jsonErr) {
        last = jsonErr;
        if (jsonErr instanceof NetworkError && jsonErr.apiDown) throw jsonErr;
        if (jsonErr instanceof ApiError) throw jsonErr;
        if (!isNetworkError(jsonErr) && !(jsonErr instanceof NetworkError)) throw jsonErr;
      }
    }
  }
  throw last;
}

function chunkQuery(opts: {
  uploadId: string;
  index: number;
  total: number;
  fileName: string;
  expectedTipo: LediLoteTipo;
  name?: string;
  totalBytes: number;
}): string {
  const q = new URLSearchParams({
    uploadId: opts.uploadId,
    index: String(opts.index),
    total: String(opts.total),
    fileName: opts.fileName,
    expectedTipo: opts.expectedTipo,
    totalBytes: String(opts.totalBytes),
  });
  if (opts.name) q.set('name', opts.name);
  return `/v1/dental/ledi/batches/upload-zip/chunk?${q.toString()}`;
}

async function waitForImportJob<T extends { id: string; summary?: { total?: number } }>(
  jobId: string,
  onProgress?: (msg: string) => void,
  onJob?: (job: JobStatus) => void,
): Promise<LediUploadResult<T>> {
  const job = await waitForJob(jobId, {
    timeoutMs: 45 * 60_000,
    intervalMs: 1500,
    onProgress: (j) => {
      onProgress?.(jobProgressLabel(j));
      onJob?.(j);
    },
  });
  if (job.status !== 'completed') {
    const mismatch = parseLediTipoMismatchFromJob(job);
    if (mismatch) throw mismatch;
    throw new Error(job.errorMessage || `Análise do ZIP falhou (${job.status}).`);
  }
  const batchId = String((job.result as { batchId?: unknown } | null)?.batchId || '');
  if (!batchId) throw new Error('Análise concluiu sem lote — tente enviar de novo.');
  const batch = await api<T>(`/v1/dental/ledi/batches/${batchId}`);
  const uploaded = Number((batch as { summary?: { total?: number } }).summary?.total) || 0;
  return { batch, uploaded, failedNames: [] };
}

async function uploadZipViaServerChunks<T extends { id: string; summary?: { total?: number } }>(opts: {
  zip: File;
  name?: string;
  expectedTipo: LediLoteTipo;
  onProgress?: (msg: string) => void;
  onJob?: (job: JobStatus) => void;
  resume?: LediChunkResume;
}): Promise<LediUploadResult<T>> {
  const zip = opts.zip;
  assertZipSize(zip);
  const totalBytes = zip.size;
  const sizeLabel = formatBytes(totalBytes) || `${totalBytes} B`;
  const total = Math.max(1, Math.ceil(totalBytes / ZIP_CHUNK_BYTES));
  opts.onProgress?.(
    `ZIP ${zip.name} (${sizeLabel}) — ${total} partes de 512 KiB, sem montar na RAM`,
  );
  const uploadId = opts.resume?.uploadId || newUploadId();
  const startIndex = Math.max(0, Math.min(opts.resume?.startIndex ?? 0, total - 1));
  let last: unknown;
  for (let i = startIndex; i < total; i++) {
    const start = i * ZIP_CHUNK_BYTES;
    const end = Math.min(start + ZIP_CHUNK_BYTES, totalBytes);
    const label = `lendo+enviando parte ${i + 1}/${total}`;
    opts.onProgress?.(
      i === total - 1 ? `${label} — última fatia; em seguida o servidor analisa` : label,
    );
    let chunk: ArrayBuffer | undefined;
    try {
      chunk = await readFileSlice(zip, start, end, {
        retries: 3,
        onAttempt: () => opts.onProgress?.(label),
      });
      last = await postChunkWithRetry(
        chunkQuery({
          uploadId,
          index: i,
          total,
          fileName: zip.name,
          expectedTipo: opts.expectedTipo,
          name: opts.name,
          totalBytes,
        }),
        chunk,
        { bytesHint: chunk.byteLength, onProgress: opts.onProgress, label },
      );
      chunk = undefined;
    } catch (e) {
      if (isIoReadError(e)) throw wrapErr(e, zip.name, totalBytes);
      if (i === total - 1) {
        opts.onProgress?.('analisando no servidor — conferindo se o job já existe…');
        const recovered = await recoverJobAfterLastChunk(uploadId);
        if (recovered) {
          last = recovered;
          break;
        }
      }
      throw new ChunkUploadError({
        uploadId,
        failedIndex: i,
        total,
        fileName: zip.name,
        cause: e,
      });
    } finally {
      chunk = undefined;
    }
  }

  opts.onProgress?.('analisando no servidor');
  let jobId = extractJobId(last);
  if (!jobId) {
    const recovered = await recoverJobAfterLastChunk(uploadId);
    jobId = extractJobId(recovered);
    if (recovered) last = recovered;
  }
  if (jobId) {
    return waitForImportJob<T>(jobId, opts.onProgress, opts.onJob);
  }
  if (isAsyncJobResponse(last)) {
    return waitForImportJob<T>(last.jobId, opts.onProgress, opts.onJob);
  }
  if (last && typeof last === 'object' && last !== null && 'id' in last && !('jobId' in last)) {
    const batch = last as T;
    return { batch, uploaded: Number(batch.summary?.total) || 0, failedNames: [] };
  }
  throw new Error(
    'Última fatia enviada, mas o servidor não devolveu o job. Recarregue os lotes recentes ou envie de novo.',
  );
}

function wrapErr(err: unknown, fileName?: string, fileSize?: number): Error {
  const mismatch = parseLediTipoMismatch(err);
  if (mismatch) return mismatch;
  if (err instanceof ChunkUploadError) return err;
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
    const lim = formatBytes(MAX_ZIP_BYTES) || '100 MB';
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
  const attempts = 3;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      opts.onProgress?.(`Reenviando ${opts.label} (tentativa ${i + 1}/${attempts})…`);
      await sleep(600 * i);
    }
    try {
      return await apiUpload<T>(path, buildForm(), { bytesHint: opts.bytesHint });
    } catch (e) {
      last = e;
      if (e instanceof NetworkError && e.apiDown) throw e;
      if (!isNetworkError(e) && !(e instanceof NetworkError)) throw e;
      if (e instanceof ApiError) throw e;
    }
  }
  throw last;
}

function xmlToFile(name: string, xml: string): File {
  return new File([xml], name, { type: 'application/xml' });
}

function buildXmlForm(files: File[], extra?: { name?: string; expectedTipo: LediLoteTipo }): FormData {
  const form = new FormData();
  for (const f of files) form.append('files', f, f.name);
  if (extra?.name) form.append('name', extra.name);
  if (extra?.expectedTipo) form.append('expectedTipo', extra.expectedTipo);
  return form;
}

async function unzipZipFile(
  zip: File,
  onProgress?: (msg: string) => void,
): Promise<LediZipXmlEntry[]> {
  assertZipSize(zip);
  const sizeLabel = formatBytes(zip.size) || `${zip.size} B`;
  onProgress?.(`Lendo ZIP ${zip.name} (${sizeLabel}) no navegador…`);
  let buf: ArrayBuffer;
  try {
    buf = await readBinaryFile(zip, {
      onAttempt: (label) => onProgress?.(label),
    });
  } catch (e) {
    if (isMemoryError(e)) throw new Error(unzipFallbackMessage(zip.name));
    throw e;
  }
  onProgress?.(`Descompactando ${zip.name} (XMLs ficam aqui; o ZIP não sobe)…`);
  try {
    const u8 = new Uint8Array(buf);
    return await unzipLediXmlEntries(u8, zip.name);
  } catch (e) {
    if (isMemoryError(e)) throw new Error(unzipFallbackMessage(zip.name));
    throw e;
  }
}

async function xmlFilesToEntries(
  xmls: File[],
  onProgress?: (msg: string) => void,
): Promise<{ entries: LediZipXmlEntry[]; failedNames: string[] }> {
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
  const entries: LediZipXmlEntry[] = [];
  for (let i = 0; i < usable.length; i++) {
    const f = usable[i]!;
    onProgress?.(`Lendo XML ${i + 1}/${usable.length}: ${f.name}…`);
    try {
      const buf = await readBinaryFile(f);
      const bytes = new Uint8Array(buf);
      if (!bytes.length) {
        failedNames.push(f.name);
        continue;
      }
      entries.push({ name: f.name.slice(0, 255), bytes });
    } catch {
      failedNames.push(f.name);
    }
  }
  if (!entries.length) {
    throw new Error('Nenhum XML válido para enviar.');
  }
  return { entries, failedNames };
}

function sampleXmls(entries: LediZipXmlEntry[], n = TIPO_SAMPLE): string[] {
  const out: string[] = [];
  const last = Math.min(n, entries.length);
  for (let i = 0; i < last; i++) {
    const parsed = entryToXml(entries[i]!);
    if (parsed?.xml) out.push(parsed.xml);
  }
  if (entries.length > n) {
    const parsed = entryToXml(entries[entries.length - 1]!);
    if (parsed?.xml) out.push(parsed.xml);
  }
  return out;
}

async function postXmlSlice<T>(opts: {
  files: File[];
  batchId?: string;
  name?: string;
  expectedTipo: LediLoteTipo;
  summarize: boolean;
  bytesHint: number;
  onProgress?: (msg: string) => void;
  label: string;
}): Promise<T> {
  const path = opts.batchId
    ? `/v1/dental/ledi/batches/${opts.batchId}/upload${opts.summarize ? '' : '?summarize=0'}`
    : '/v1/dental/ledi/batches/upload';
  return postFormWithRetry<T>(
    path,
    () =>
      buildXmlForm(
        opts.files,
        opts.batchId ? undefined : { name: opts.name, expectedTipo: opts.expectedTipo },
      ),
    { bytesHint: opts.bytesHint, onProgress: opts.onProgress, label: opts.label },
  );
}

export async function uploadLediBatchMultipart<
  T extends { id: string; summary?: { total?: number } },
>(opts: {
  files: File[];
  name?: string;
  expectedTipo: LediLoteTipo;
  onProgress?: (msg: string) => void;
  onJob?: (job: JobStatus) => void;
  resume?: LediChunkResume;
}): Promise<LediUploadResult<T>> {
  if (!opts.files.length) throw new Error('Selecione arquivos .xml ou um .zip');
  if (!getToken()) throw new Error('Sessão expirada — faça login de novo.');
  await assertApiReachable();

  const zips = opts.files.filter((f) => /\.zip$/i.test(f.name));
  const xmls = opts.files.filter((f) => /\.xml$/i.test(f.name));
  const zip = zips[0];

  try {
    if (zips.length > 1) throw new Error('Envie um ZIP por vez.');

    let entries: LediZipXmlEntry[];
    let failedNames: string[] = [];

    if (zip) {
      if (opts.resume || !shouldUnzipZipInBrowser(zip.size)) {
        return await uploadZipViaServerChunks<T>({
          zip,
          name: opts.name,
          expectedTipo: opts.expectedTipo,
          onProgress: opts.onProgress,
          onJob: opts.onJob,
          resume: opts.resume,
        });
      }
      entries = await unzipZipFile(zip, opts.onProgress);
    } else {
      if (!xmls.length) throw new Error('Selecione arquivos .xml ou um .zip');
      const read = await xmlFilesToEntries(xmls, opts.onProgress);
      entries = read.entries;
      failedNames = read.failedNames;
    }

    const total = entries.length;
    opts.onProgress?.(`Conferindo tipo LEDI (${Math.min(TIPO_SAMPLE, total)} fichas)…`);
    assertLediTipoMatch({
      expectedTipo: opts.expectedTipo,
      sampleXmls: sampleXmls(entries),
    });

    const ranges = sliceEntryRanges(entries.map((e) => e.bytes.byteLength));
    let batch: T | undefined;
    let uploaded = 0;

    for (let r = 0; r < ranges.length; r++) {
      const { start, end } = ranges[r]!;
      const slice = entries.slice(start, end);
      const files: File[] = [];
      let bytesHint = 0;
      for (const entry of slice) {
        const parsed = entryToXml(entry);
        if (!parsed) {
          failedNames.push(entry.name);
          continue;
        }
        files.push(xmlToFile(parsed.name, parsed.xml));
        bytesHint += parsed.xml.length;
      }
      if (!files.length) continue;

      const after = uploaded + files.length;
      const last = r === ranges.length - 1;
      if (last && total >= 1500) {
        opts.onProgress?.(`fichas ${after}/${total} — consolidando análise do lote…`);
      } else {
        opts.onProgress?.(`fichas ${after}/${total}`);
      }
      batch = await postXmlSlice<T>({
        files,
        batchId: batch?.id,
        name: opts.name,
        expectedTipo: opts.expectedTipo,
        summarize: last,
        bytesHint,
        onProgress: opts.onProgress,
        label: `fichas ${after}/${total}`,
      });
      uploaded = after;
      for (const entry of slice) {
        (entry as { bytes: Uint8Array | null }).bytes = null as unknown as Uint8Array;
      }
    }

    if (!batch) throw new Error('Nenhum XML válido para enviar.');
    return { batch, uploaded, failedNames };
  } catch (e) {
    throw wrapErr(e, zip?.name, zip?.size);
  }
}
