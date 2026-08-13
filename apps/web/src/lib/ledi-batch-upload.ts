/**
 * Upload de lote LEDI (FAI / FAO / PROC).
 *
 * ZIP: descompacta no browser (fflate) e envia XMLs em fatias ≤1 MB / ~80
 * fichas via POST /upload e POST /:batchId/upload — o caminho que já funciona
 * para Arquivo.zip / XMLs soltos. Não manda o ZIP pelo gateway (/chunk).
 */

import { apiUpload, getToken, isNetworkError, NetworkError, ApiError } from '@/lib/api';
import { IoReadError, isIoReadError, formatBytes, readBinaryFile } from '@/lib/read-binary-file';
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

/** Alinhado ao FileInterceptor ZIP na API (80 MB). */
export const MAX_ZIP_BYTES = 80 * 1024 * 1024;
/** Limite prático por XML no multipart da API. */
export const MAX_XML_BYTES = 5 * 1024 * 1024;
const TIPO_SAMPLE = 8;

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
