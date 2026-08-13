/**
 * Upload de lote LEDI (FAI / FAO / PROC).
 * Materializa o arquivo em memória (1ª leitura) e envia ZIP em base64
 * ou XMLs em JSON — evita 2ª leitura no disco (Downloads/iCloud).
 */

import { api, ApiError, getToken } from '@/lib/api';
import {
  IoReadError,
  isIoReadError,
  materializeAsMemoryFile,
  readBinaryFile,
} from '@/lib/read-binary-file';

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

function wrapErr(err: unknown, fileName?: string): Error {
  if (err instanceof IoReadError) return err;
  if (isIoReadError(err)) return new IoReadError(fileName || '', err);
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

async function readXmlFromMemory(file: File): Promise<string> {
  const buf = await readBinaryFile(file);
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
      let mem: File;
      try {
        // 1ª (e única) leitura do disco → File em RAM + cache de bytes
        mem = await materializeAsMemoryFile(zip);
      } catch (e) {
        throw wrapErr(e, zip.name);
      }
      const buf = await readBinaryFile(mem);
      opts.onProgress?.(`Enviando ZIP (${Math.round(buf.byteLength / 1024)} KB)…`);
      const batch = await api<T>('/v1/dental/ledi/batches/from-zip', {
        method: 'POST',
        json: {
          name: opts.name || mem.name.replace(/\.zip$/i, ''),
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
        const mem = await materializeAsMemoryFile(f);
        items.push({ name: mem.name.slice(0, 255), xml: await readXmlFromMemory(mem) });
      } catch {
        failedNames.push(f.name);
      }
    }

    if (!items.length) {
      throw new IoReadError(failedNames[0] || 'XMLs');
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
