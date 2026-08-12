/**
 * Upload de lote LEDI — restaura o que funcionava.
 *
 * XML: ler no browser → um único POST JSON (como antes).
 * ZIP: arrayBuffer → base64 → POST /from-zip (API descompacta; sem multipart quebrado no proxy).
 */

import { api, ApiError, getToken } from '@/lib/api';

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function readXmlFile(file: File): Promise<string> {
  try {
    const buf = await file.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buf);
    if (text.trim()) return text;
  } catch {
    // FileReader
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text.trim()) reject(new Error(`Arquivo vazio: ${file.name}`));
      else resolve(text);
    };
    reader.onerror = () =>
      reject(reader.error || new Error(`Não foi possível ler ${file.name}`));
    reader.readAsText(file);
  });
}

export async function uploadLediBatchMultipart<T extends { id: string; summary?: { total?: number } }>(opts: {
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
      const buf = await zip.arrayBuffer();
      opts.onProgress?.(`Enviando ZIP (${Math.round(buf.byteLength / 1024)} KB)…`);
      const batch = await api<T>('/v1/dental/ledi/batches/from-zip', {
        method: 'POST',
        json: {
          name: opts.name || zip.name.replace(/\.zip$/i, ''),
          expectedTipo: opts.expectedTipo,
          zipBase64: bufferToBase64(buf),
        },
      });
      return {
        batch,
        uploaded: batch.summary?.total ?? 0,
        failedNames: [],
      };
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
        `Nenhum XML legível${failedNames[0] ? ` (ex.: “${failedNames[0]}”)` : ''}. Compacte a pasta em .zip e envie o ZIP.`,
      );
    }

    opts.onProgress?.(`Enviando ${items.length} fichas (um único lote)…`);
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
    if (e instanceof ApiError) {
      throw new Error(`Falha no envio (${e.status}): ${e.message}`);
    }
    throw e;
  }
}
