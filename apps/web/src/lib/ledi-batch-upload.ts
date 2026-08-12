/**
 * Upload de lote LEDI via multipart FormData.
 * Evita FileReader/file.text() no browser (NotReadableError em Downloads/iCloud).
 */

import { api, ApiError, getToken } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const CHUNK = 25;

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // NÃO setar Content-Type — o browser define boundary do multipart

  const res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: form });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'message' in data
        ? Array.isArray((data as { message: unknown }).message)
          ? ((data as { message: string[] }).message).join(', ')
          : String((data as { message: unknown }).message)
        : `Erro HTTP ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

function buildForm(
  files: File[],
  opts: { name?: string; expectedTipo: string },
): FormData {
  const form = new FormData();
  if (opts.name) form.append('name', opts.name);
  form.append('expectedTipo', opts.expectedTipo);
  for (const f of files) {
    form.append('files', f, f.name);
  }
  return form;
}

export type LediUploadResult<T> = {
  batch: T;
  uploaded: number;
  failedNames: string[];
};

/**
 * Envia XMLs em pedaços via multipart. Arquivos que falharem no pedaço
 * são reenviados um a um; os que ainda falharem entram em failedNames.
 */
export async function uploadLediBatchMultipart<T extends { id: string }>(opts: {
  files: File[];
  name?: string;
  expectedTipo: 'FAO' | 'FAI' | 'PROCEDIMENTOS';
  onProgress?: (msg: string) => void;
}): Promise<LediUploadResult<T>> {
  const xmls = opts.files.filter((f) => f.name.toLowerCase().endsWith('.xml'));
  if (!xmls.length) throw new Error('Selecione arquivos .xml');

  let batch: T | null = null;
  const failedNames: string[] = [];
  let uploaded = 0;

  for (let i = 0; i < xmls.length; i += CHUNK) {
    const slice = xmls.slice(i, i + CHUNK);
    opts.onProgress?.(
      `Enviando ${Math.min(i + slice.length, xmls.length)}/${xmls.length} (multipart)…`,
    );

    try {
      const form = buildForm(slice, {
        name: batch ? undefined : opts.name,
        expectedTipo: opts.expectedTipo,
      });
      if (!batch) {
        batch = await postForm<T>('/v1/dental/ledi/batches/upload', form);
      } else {
        batch = await postForm<T>(`/v1/dental/ledi/batches/${batch.id}/upload`, form);
      }
      uploaded += slice.length;
    } catch {
      // pedaço falhou — tenta arquivo a arquivo
      for (const f of slice) {
        opts.onProgress?.(
          `Reenviando individual ${uploaded + failedNames.length + 1}/${xmls.length}: ${f.name}`,
        );
        try {
          const form = buildForm([f], {
            name: batch ? undefined : opts.name,
            expectedTipo: opts.expectedTipo,
          });
          if (!batch) {
            batch = await postForm<T>('/v1/dental/ledi/batches/upload', form);
          } else {
            batch = await postForm<T>(`/v1/dental/ledi/batches/${batch.id}/upload`, form);
          }
          uploaded += 1;
        } catch {
          failedNames.push(f.name);
        }
      }
    }
  }

  if (!batch) {
    throw new Error(
      failedNames.length
        ? `Nenhum XML enviado. Ex.: “${failedNames[0]}” — copie a pasta para o Desktop (fora do iCloud/Downloads) e tente de novo.`
        : 'Nenhum XML enviado.',
    );
  }

  return { batch, uploaded, failedNames };
}
