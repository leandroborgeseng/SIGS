/**
 * Upload de lote LEDI (FAI / FAO / PROC).
 * Preferência: FormData multipart (ZIP/XML) — evita base64 no JSON (estoura memória
 * e costuma gerar Safari “Load failed” em ZIPs médios/grandes atrás do proxy).
 */

import { api, ApiError, getToken, isNetworkError, NetworkError } from '@/lib/api';
import { IoReadError, isIoReadError, formatBytes } from '@/lib/read-binary-file';

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

/** Alinhado ao FileInterceptor ZIP na API (80 MB). */
export const MAX_ZIP_BYTES = 80 * 1024 * 1024;
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
            ` Provável: corpo grande, timeout ou conexão caiu.`,
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
      return await api<T>(path, {
        method: 'POST',
        body: buildForm(),
        bytesHint: opts.bytesHint,
      });
    } catch (e) {
      last = e;
      // Retry só em falha de rede sem HTTP (Load failed / Failed to fetch).
      if (!isNetworkError(e) && !(e instanceof NetworkError)) throw e;
      if (e instanceof ApiError) throw e;
    }
  }
  throw last;
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
      opts.onProgress?.(`Enviando ZIP ${zip.name} (${sizeLabel}) via multipart…`);

      const batch = await postFormWithRetry<T>(
        '/v1/dental/ledi/batches/upload-zip',
        () => {
          const form = new FormData();
          form.append('file', zip, zip.name);
          form.append('name', opts.name || zip.name.replace(/\.zip$/i, ''));
          form.append('expectedTipo', opts.expectedTipo);
          return form;
        },
        {
          bytesHint: zip.size,
          onProgress: opts.onProgress,
          label: zip.name,
        },
      );

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
