/**
 * Upload de lote LEDI.
 * 1) Preferência: ler ArrayBuffer no browser → JSON para a API (compatível com proxy Next).
 * 2) Aceita .zip (JSZip) — recomendado para pastas grandes em Downloads.
 */

import { api, ApiError, getToken } from '@/lib/api';
import JSZip from 'jszip';

const CHUNK = 20;

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

function decodeXmlBytes(buf: ArrayBuffer, fileName: string): string {
  const text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  if (!text.trim()) throw new Error(`Arquivo vazio: ${fileName}`);
  return text;
}

async function readXmlFile(file: File): Promise<string> {
  // arrayBuffer costuma funcionar quando FileReader/text falham em Downloads
  const buf = await file.arrayBuffer();
  return decodeXmlBytes(buf, file.name);
}

async function extractXmlsFromZip(file: File): Promise<Array<{ name: string; xml: string }>> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const out: Array<{ name: string; xml: string }> = [];
  const entries = Object.values(zip.files).filter((e) => !e.dir && /\.xml$/i.test(e.name));
  for (const entry of entries) {
    const xml = await entry.async('string');
    if (!xml.trim()) continue;
    const base = entry.name.split('/').pop() || entry.name;
    out.push({ name: base.slice(0, 255), xml });
  }
  if (!out.length) throw new Error('O ZIP não contém arquivos .xml');
  return out;
}

async function loadPayload(
  files: File[],
  onProgress?: (msg: string) => void,
): Promise<{ items: Array<{ name: string; xml: string }>; failedNames: string[] }> {
  const items: Array<{ name: string; xml: string }> = [];
  const failedNames: string[] = [];

  const zips = files.filter((f) => /\.zip$/i.test(f.name));
  const xmls = files.filter((f) => /\.xml$/i.test(f.name));

  for (const z of zips) {
    onProgress?.(`Abrindo ZIP ${z.name}…`);
    try {
      const extracted = await extractXmlsFromZip(z);
      items.push(...extracted);
    } catch (e) {
      failedNames.push(z.name);
      throw e instanceof Error
        ? e
        : new Error(`Falha ao abrir ZIP ${z.name}`);
    }
  }

  for (let i = 0; i < xmls.length; i++) {
    const f = xmls[i]!;
    onProgress?.(`Lendo ${i + 1}/${xmls.length}: ${f.name}`);
    try {
      const xml = await readXmlFile(f);
      items.push({ name: f.name.slice(0, 255), xml });
    } catch {
      // retry curto
      await new Promise((r) => setTimeout(r, 30));
      try {
        const xml = await readXmlFile(f);
        items.push({ name: f.name.slice(0, 255), xml });
      } catch {
        failedNames.push(f.name);
      }
    }
  }

  return { items, failedNames };
}

async function postJsonChunks<T extends { id: string }>(opts: {
  items: Array<{ name: string; xml: string }>;
  name?: string;
  expectedTipo: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  onProgress?: (msg: string) => void;
}): Promise<T> {
  let batch: T | null = null;
  const token = getToken();
  if (!token) throw new Error('Sessão expirada — faça login de novo.');

  for (let i = 0; i < opts.items.length; i += CHUNK) {
    const slice = opts.items.slice(i, i + CHUNK);
    opts.onProgress?.(
      `Validando na API ${Math.min(i + slice.length, opts.items.length)}/${opts.items.length}…`,
    );

    if (!batch) {
      batch = await api<T>('/v1/dental/ledi/batches', {
        method: 'POST',
        json: {
          name: opts.name,
          expectedTipo: opts.expectedTipo,
          files: slice,
        },
      });
    } else {
      // append via multipart-less JSON endpoint
      batch = await api<T>(`/v1/dental/ledi/batches/${batch.id}/append`, {
        method: 'POST',
        json: { files: slice },
      });
    }
  }

  if (!batch) throw new Error('Nenhum arquivo para enviar.');
  return batch;
}

export async function uploadLediBatchMultipart<T extends { id: string }>(opts: {
  files: File[];
  name?: string;
  expectedTipo: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  onProgress?: (msg: string) => void;
}): Promise<LediUploadResult<T>> {
  if (!opts.files.length) throw new Error('Selecione arquivos .xml ou um .zip');

  const { items, failedNames } = await loadPayload(opts.files, opts.onProgress);

  if (!items.length) {
    const sample = failedNames[0] || opts.files[0]?.name || 'arquivo';
    throw new Error(
      `Nenhum XML legível (ex.: “${sample}”). Compacte a pasta em .zip no Finder (clique direito → Comprimir) e envie o ZIP, ou copie a pasta para o Desktop.`,
    );
  }

  try {
    const batch = await postJsonChunks<T>({
      items,
      name: opts.name,
      expectedTipo: opts.expectedTipo,
      onProgress: opts.onProgress,
    });
    return { batch, uploaded: items.length, failedNames };
  } catch (e) {
    if (e instanceof ApiError) {
      throw new Error(`API recusou o lote (${e.status}): ${e.message}`);
    }
    throw e;
  }
}
