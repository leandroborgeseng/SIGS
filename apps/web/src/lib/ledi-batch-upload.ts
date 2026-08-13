/**
 * Upload de lote LEDI (FAI / FAO / PROC).
 *
 * ZIP ≤ ~5 MB: descompacta no browser (fflate) e envia XMLs em fatias
 * (Arquivo.zip / amostra). ZIP maior: NÃO unzipa no Safari — fatias
 * octet-stream 512 KiB em POST /upload-zip/chunk; unzip + análise no Node.
 */

import { api, apiBinary, apiUpload, getToken, isNetworkError, NetworkError, ApiError } from '@/lib/api';
import { IoReadError, isIoReadError, formatBytes, readBinaryFile } from '@/lib/read-binary-file';
import { isAsyncJobResponse, waitForJob } from '@/lib/jobs';
import {
  assertLediTipoMatch,
  isMemoryError,
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

/** Alinhado ao FileInterceptor ZIP na API (100 MB). */
export const MAX_ZIP_BYTES = 100 * 1024 * 1024;
/** Acima disto o Safari não unzipa — sobe o ZIP em chunks para o Node. */
export const BROWSER_UNZIP_MAX_BYTES = 5 * 1024 * 1024;
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

export function shouldUnzipZipInBrowser(size: number): boolean {
  return size > 0 && size <= BROWSER_UNZIP_MAX_BYTES;
}

async function postChunkWithRetry<T>(
  path: string,
  body: Blob,
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
      if (!isNetworkError(e) && !(e instanceof NetworkError)) throw e;
      if (e instanceof ApiError) throw e;
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

async function uploadZipViaServerChunks<T extends { id: string; summary?: { total?: number } }>(opts: {
  zip: File;
  name?: string;
  expectedTipo: LediLoteTipo;
  onProgress?: (msg: string) => void;
}): Promise<LediUploadResult<T>> {
  const zip = opts.zip;
  assertZipSize(zip);
  const total = Math.max(1, Math.ceil(zip.size / ZIP_CHUNK_BYTES));
  const uploadId = newUploadId();
  let last: unknown;
  for (let i = 0; i < total; i++) {
    const start = i * ZIP_CHUNK_BYTES;
    const blob = zip.slice(start, Math.min(start + ZIP_CHUNK_BYTES, zip.size));
    const label = `parte ${i + 1}/${total}`;
    opts.onProgress?.(label);
    last = await postChunkWithRetry(
      chunkQuery({
        uploadId,
        index: i,
        total,
        fileName: zip.name,
        expectedTipo: opts.expectedTipo,
        name: opts.name,
        totalBytes: zip.size,
      }),
      blob,
      { bytesHint: blob.size, onProgress: opts.onProgress, label },
    );
  }

  opts.onProgress?.('analisando no servidor');
  if (isAsyncJobResponse(last)) {
    const job = await waitForJob(last.jobId, {
      timeoutMs: 30 * 60_000,
      intervalMs: 1500,
      onProgress: (j) => {
        opts.onProgress?.(j.progressMessage || 'analisando no servidor');
      },
    });
    if (job.status !== 'completed') {
      throw new Error(job.errorMessage || `Análise do ZIP falhou (${job.status}).`);
    }
    const batchId = String((job.result as { batchId?: unknown } | null)?.batchId || '');
    if (!batchId) throw new Error('Análise concluiu sem lote — tente enviar de novo.');
    const batch = await api<T>(`/v1/dental/ledi/batches/${batchId}`);
    const uploaded = Number((batch as { summary?: { total?: number } }).summary?.total) || 0;
    return { batch, uploaded, failedNames: [] };
  }
  if (last && typeof last === 'object' && last !== null && 'id' in last) {
    const batch = last as T;
    return { batch, uploaded: Number(batch.summary?.total) || 0, failedNames: [] };
  }
  throw new Error('Resposta inesperada após o envio do ZIP.');
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
}): Promise<LediUploadResult<T>> {
  if (!opts.files.length) throw new Error('Selecione arquivos .xml ou um .zip');
  if (!getToken()) throw new Error('Sessão expirada — faça login de novo.');

  const zips = opts.files.filter((f) => /\.zip$/i.test(f.name));
  const xmls = opts.files.filter((f) => /\.xml$/i.test(f.name));
  const zip = zips[0];

  try {
    if (zips.length > 1) throw new Error('Envie um ZIP por vez.');

    let entries: LediZipXmlEntry[];
    let failedNames: string[] = [];

    if (zip) {
      if (shouldUnzipZipInBrowser(zip.size)) {
        entries = await unzipZipFile(zip, opts.onProgress);
      } else {
        return await uploadZipViaServerChunks<T>({
          zip,
          name: opts.name,
          expectedTipo: opts.expectedTipo,
          onProgress: opts.onProgress,
        });
      }
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
