/**
 * Lê arquivo de texto no browser com fallbacks.
 * Evita NotReadableError ("The I/O read operation failed") comum com FileReader
 * em Downloads / iCloud / muitos arquivos de uma vez.
 */

function friendlyIoError(err: unknown, fileName: string): Error {
  const raw = err instanceof Error ? err.message : String(err || '');
  if (/I\/O read operation failed|NotReadableError|NotFoundError|Permission/i.test(raw)) {
    return new Error(
      `Não foi possível ler “${fileName}”. Reabra a pasta (Downloads), selecione de novo ou copie os XMLs para uma pasta local e tente outra vez.`,
    );
  }
  return err instanceof Error ? err : new Error(`Falha ao ler ${fileName}: ${raw}`);
}

async function readWithFileReader(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
    reader.onabort = () => reject(new Error('Leitura abortada'));
    reader.readAsText(file);
  });
}

export async function readTextFile(file: File): Promise<string> {
  try {
    if (typeof file.text === 'function') {
      return await file.text();
    }
  } catch {
    // cai no FileReader
  }
  try {
    return await readWithFileReader(file);
  } catch (first) {
    // retry único (alguns browsers falham na 1ª passagem em pastas sincronizadas)
    await new Promise((r) => setTimeout(r, 40));
    try {
      if (typeof file.text === 'function') return await file.text();
      return await readWithFileReader(file);
    } catch (second) {
      throw friendlyIoError(second || first, file.name);
    }
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
