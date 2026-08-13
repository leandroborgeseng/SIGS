/**
 * Leitura binária resiliente no browser.
 * Downloads/iCloud no macOS frequentemente falham com NotReadableError
 * ("The I/O read operation failed") — retries, stream e cópia em memória
 * costumam recuperar; se não, a UX pede escolher de novo / Desktop.
 */

export class IoReadError extends Error {
  readonly code = 'IO_READ' as const;
  readonly fileName: string;

  constructor(fileName: string, cause?: unknown) {
    const who = fileName ? `“${fileName}”` : 'o arquivo';
    super(
      `O navegador não conseguiu ler ${who} (erro típico de Downloads/iCloud). ` +
        `Use “Escolher de novo”, ou copie o .zip para o Desktop (fora do iCloud) e selecione de lá.`,
    );
    this.name = 'IoReadError';
    this.fileName = fileName;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export function isIoReadError(err: unknown): boolean {
  if (err instanceof IoReadError) return true;
  const msg = err instanceof Error ? err.message : String(err || '');
  const name = err instanceof Error ? err.name : '';
  return (
    /I\/O read operation failed/i.test(msg) ||
    /NotReadableError/i.test(name) ||
    /NotReadableError/i.test(msg) ||
    /NotFoundError/i.test(name) ||
    /Downloads\/iCloud/i.test(msg) ||
    (err as { code?: string } | null)?.code === 'IO_READ'
  );
}

/** Cache por Blob/File — evita 2ª leitura no disco (comum falhar no iCloud). */
const bufferCache = new WeakMap<Blob, ArrayBuffer>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function copyArrayBuffer(buf: ArrayBuffer): ArrayBuffer {
  return buf.slice(0);
}

async function readViaStream(file: Blob): Promise<ArrayBuffer> {
  if (typeof file.stream !== 'function') throw new Error('stream indisponível');
  const reader = file.stream().getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value?.byteLength) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out.buffer;
}

async function readViaFileReader(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error || new Error('FileReader falhou'));
    reader.onabort = () => reject(new Error('FileReader abortado'));
    reader.readAsArrayBuffer(file);
  });
}

async function readViaObjectUrl(file: Blob): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch blob URL ${res.status}`);
    return await res.arrayBuffer();
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function readViaResponse(file: Blob): Promise<ArrayBuffer> {
  return new Response(file).arrayBuffer();
}

type NamedBlob = Blob & { name?: string; webkitRelativePath?: string };

function strategies(file: NamedBlob): Array<() => Promise<ArrayBuffer>> {
  const size = file.size;
  return [
    async () => file.arrayBuffer(),
    async () => file.slice(0, size).arrayBuffer(),
    async () => readViaStream(file),
    async () => readViaResponse(file),
    async () => readViaObjectUrl(file),
    async () => readViaFileReader(file),
    // slice “inteiro” de novo — às vezes materializa placeholder iCloud
    async () => file.slice(0).arrayBuffer(),
  ];
}

/**
 * Lê bytes com várias estratégias + backoff.
 * Resultado fica em WeakMap para reuso sem tocar o disco de novo.
 */
export async function readBinaryFile(
  file: NamedBlob,
  opts?: { retries?: number; onAttempt?: (label: string) => void },
): Promise<ArrayBuffer> {
  const cached = bufferCache.get(file);
  if (cached && cached.byteLength > 0) return cached;

  const name = file.name || 'arquivo';
  if (typeof file.size === 'number' && file.size === 0) {
    throw new IoReadError(
      name,
      new Error('Arquivo com 0 bytes (placeholder iCloud ou seleção vazia)'),
    );
  }

  const rounds = Math.max(1, opts?.retries ?? 3);
  const delays = [0, 120, 400, 900];
  let last: unknown;

  for (let round = 0; round < rounds; round++) {
    if (delays[round]) await sleep(delays[round]!);
    for (const attempt of strategies(file)) {
      try {
        opts?.onAttempt?.(`lendo ${name} (tentativa ${round + 1})`);
        const buf = await attempt();
        if (buf && buf.byteLength > 0) {
          const owned = copyArrayBuffer(buf);
          bufferCache.set(file, owned);
          return owned;
        }
        last = new Error('buffer vazio');
      } catch (e) {
        last = e;
      }
    }
  }

  throw new IoReadError(name, last);
}

/** Copia para File em memória (Blob) e popula o cache — upload não rele o disco. */
export async function materializeAsMemoryFile(file: File): Promise<File> {
  const buf = await readBinaryFile(file);
  const mem = new File([buf], file.name, {
    type: file.type || guessMime(file.name),
    lastModified: file.lastModified || Date.now(),
  });
  bufferCache.set(mem, buf);
  return mem;
}

export async function materializeFiles(
  files: File[],
  onProgress?: (msg: string) => void,
): Promise<{ files: File[]; failedNames: string[] }> {
  const out: File[] = [];
  const failedNames: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    onProgress?.(`Preparando ${i + 1}/${files.length}: ${f.name}…`);
    try {
      out.push(await materializeAsMemoryFile(f));
    } catch {
      failedNames.push(f.name);
    }
  }
  return { files: out, failedNames };
}

function guessMime(name: string): string {
  if (/\.zip$/i.test(name)) return 'application/zip';
  if (/\.xml$/i.test(name)) return 'application/xml';
  return 'application/octet-stream';
}
