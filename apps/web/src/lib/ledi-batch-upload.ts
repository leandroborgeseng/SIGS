/**
 * Upload de lote LEDI.
 * XML → um POST JSON; ZIP → base64 → /from-zip.
 * Erros de I/O do browser (Downloads/iCloud) são traduzidos — o arquivo
 * precisa estar legível localmente (ex.: copiado para o Desktop).
 */

import { api, ApiError, getToken } from '@/lib/api';

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

function isIoReadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err || '');
  const name = err instanceof Error ? err.name : '';
  return (
    /I\/O read operation failed/i.test(msg) ||
    /NotReadableError/i.test(name) ||
    /NotReadableError/i.test(msg) ||
    /NotFoundError/i.test(name)
  );
}

function ioHint(fileName?: string): string {
  const who = fileName ? `“${fileName}”` : 'o arquivo';
  return (
    `O navegador não conseguiu ler ${who} (erro típico de Downloads/iCloud). ` +
    `Copie o .zip ou a pasta para o Desktop (ou ~/Documents), selecione de lá, ` +
    `ou arraste o arquivo desta pasta para a área de envio.`
  );
}

function wrapErr(err: unknown, fileName?: string): Error {
  if (isIoReadError(err)) return new Error(ioHint(fileName));
  if (err instanceof ApiError) return new Error(`Falha no envio (${err.status}): ${err.message}`);
  if (err instanceof Error) return err;
  return new Error(String(err || 'Falha no envio'));
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Várias estratégias — algumas pastas do macOS falham só em um método. */
async function readArrayBufferRobust(file: File): Promise<ArrayBuffer> {
  const attempts: Array<() => Promise<ArrayBuffer>> = [
    async () => file.arrayBuffer(),
    async () => file.slice(0, file.size).arrayBuffer(),
    async () =>
      new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error || new Error('FileReader falhou'));
        reader.readAsArrayBuffer(file);
      }),
  ];

  let last: unknown;
  for (const attempt of attempts) {
    try {
      const buf = await attempt();
      if (buf && buf.byteLength > 0) return buf;
      last = new Error('buffer vazio');
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  throw wrapErr(last, file.name);
}

async function readXmlFile(file: File): Promise<string> {
  const buf = await readArrayBufferRobust(file);
  const text = new TextDecoder('utf-8').decode(buf);
  if (!text.trim()) throw new Error(`Arquivo vazio: ${file.name}`);
  return text;
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
      opts.onProgress?.(`Lendo ZIP ${zip.name}…`);
      let buf: ArrayBuffer;
      try {
        buf = await readArrayBufferRobust(zip);
      } catch (e) {
        throw wrapErr(e, zip.name);
      }
      opts.onProgress?.(`Enviando ZIP (${Math.round(buf.byteLength / 1024)} KB)…`);
      const batch = await api<T>('/v1/dental/ledi/batches/from-zip', {
        method: 'POST',
        json: {
          name: opts.name || zip.name.replace(/\.zip$/i, ''),
          expectedTipo: opts.expectedTipo,
          zipBase64: bufferToBase64(buf),
        },
      });
      return { batch, uploaded: batch.summary?.total ?? 0, failedNames: [] };
    }

    const items: Array<{ name: string; xml: string }> = [];
    const failedNames: string[] = [];

    for (let i = 0; i < xmls.length; i++) {
      const f = xmls[i]!;
      opts.onProgress?.(`Lendo ${i + 1}/${xmls.length}…`);
      try {
        items.push({ name: f.name.slice(0, 255), xml: await readXmlFile(f) });
      } catch {
        failedNames.push(f.name);
      }
    }

    if (!items.length) {
      throw new Error(
        failedNames.length
          ? ioHint(failedNames[0])
          : 'Nenhum XML legível. Compacte a pasta em .zip no Desktop e envie o ZIP.',
      );
    }

    opts.onProgress?.(`Enviando ${items.length} fichas…`);
    const batch = await api<T>('/v1/dental/ledi/batches', {
      method: 'POST',
      json: {
        name: opts.name,
        expectedTipo: opts.expectedTipo,
        files: items,
      },
    });

    return { batch, uploaded: items.length, failedNames };
  } catch (e) {
    throw wrapErr(e);
  }
}
