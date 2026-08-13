/**
 * Lê arquivo de texto no browser via leitura binária resiliente
 * (cache + stream + retries) — evita NotReadableError em Downloads/iCloud.
 */

import { IoReadError, isIoReadError, readBinaryFile } from '@/lib/read-binary-file';

function friendlyIoError(err: unknown, fileName: string): Error {
  if (err instanceof IoReadError) return err;
  if (isIoReadError(err)) return new IoReadError(fileName, err);
  const raw = err instanceof Error ? err.message : String(err || '');
  return err instanceof Error ? err : new Error(`Falha ao ler ${fileName}: ${raw}`);
}

export async function readTextFile(file: File): Promise<string> {
  try {
    const buf = await readBinaryFile(file);
    return new TextDecoder('utf-8').decode(buf);
  } catch (e) {
    throw friendlyIoError(e, file.name);
  }
}

/** Lê vários arquivos em lotes pequenos; falhas parciais viram erro agregável. */
export async function readTextFilesBatched(
  files: File[],
  opts?: {
    concurrency?: number;
    onProgress?: (done: number, total: number, name: string) => void;
  },
): Promise<Array<{ name: string; text: string }>> {
  const concurrency = Math.max(1, Math.min(opts?.concurrency ?? 8, 16));
  const out: Array<{ name: string; text: string }> = [];
  const errors: string[] = [];
  let done = 0;

  for (let i = 0; i < files.length; i += concurrency) {
    const slice = files.slice(i, i + concurrency);
    const parts = await Promise.all(
      slice.map(async (f) => {
        try {
          const text = await readTextFile(f);
          done += 1;
          opts?.onProgress?.(done, files.length, f.name);
          return { name: f.name, text };
        } catch (e) {
          done += 1;
          opts?.onProgress?.(done, files.length, f.name);
          errors.push(e instanceof Error ? e.message : String(e));
          return null;
        }
      }),
    );
    for (const p of parts) {
      if (p) out.push(p);
    }
  }

  if (!out.length) {
    throw new Error(errors[0] || 'Nenhum arquivo pôde ser lido.');
  }
  if (errors.length) {
    throw new Error(
      `Lidos ${out.length}/${files.length}. ${errors.length} falharam (ex.: ${errors[0]}). Selecione só os que faltaram e envie de novo.`,
    );
  }
  return out;
}
