/**
 * Leitura binária resiliente no browser.
 * Retries / stream / FileReader quando o SO ou o navegador falham na 1ª leitura.
 * A mensagem NÃO culpa iCloud por padrão — só sugere se a heurística indicar.
 */

export type IoReadErrorInit = {
  fileName: string;
  cause?: unknown;
  fileSize?: number;
  fileType?: string;
  /** path relativo (webkitRelativePath) se houver */
  relativePath?: string;
};

function formatBytes(n?: number): string | null {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function describeCause(cause: unknown): string | null {
  if (cause == null) return null;
  if (cause instanceof Error) {
    const bits = [cause.name, cause.message].filter(Boolean);
    return bits.join(': ') || null;
  }
  const s = String(cause);
  return s && s !== '[object Object]' ? s : null;
}

/** Heurística fraca: path/nome/size 0 / NotReadable típico — tip, não diagnóstico. */
export function shouldHintCloudPlaceholder(opts: {
  fileName?: string;
  relativePath?: string;
  fileSize?: number;
  cause?: unknown;
}): boolean {
  const pathish = `${opts.relativePath || ''} ${opts.fileName || ''}`.toLowerCase();
  if (/icloud|downloads\//i.test(pathish)) return true;
  if (opts.fileSize === 0) return true;
  const detail = describeCause(opts.cause) || '';
  return /NotReadableError|I\/O read operation failed/i.test(detail);
}

export class IoReadError extends Error {
  readonly code = 'IO_READ' as const;
  readonly fileName: string;
  readonly fileSize?: number;
  readonly fileType?: string;
  readonly causeDetail: string | null;
  readonly hintCloud: boolean;

  constructor(fileNameOrInit: string | IoReadErrorInit, cause?: unknown) {
    const init: IoReadErrorInit =
      typeof fileNameOrInit === 'string'
        ? { fileName: fileNameOrInit, cause }
        : fileNameOrInit;

    const who = init.fileName ? `“${init.fileName}”` : 'o arquivo';
    const sizeLabel = formatBytes(init.fileSize);
    const causeDetail = describeCause(init.cause);
    const hintCloud = shouldHintCloudPlaceholder(init);

    const meta: string[] = [];
    if (sizeLabel) meta.push(sizeLabel);
    if (init.fileType) meta.push(`tipo ${init.fileType}`);
    const metaStr = meta.length ? ` (${meta.join(', ')})` : '';

    let msg = `Não foi possível ler ${who}${metaStr}`;
    if (causeDetail) msg += ` — ${causeDetail}`;
    msg += '. Use “Escolher de novo” e confira se o arquivo existe, não está vazio e não está em uso.';
    if (hintCloud) {
      msg +=
        ' Dica: se estiver em Downloads sincronizado com iCloud (placeholder na nuvem), copie para uma pasta local (ex.: Desktop) e selecione de lá.';
    }

    super(msg);
    this.name = 'IoReadError';
    this.fileName = init.fileName || '';
    this.fileSize = init.fileSize;
    this.fileType = init.fileType;
    this.causeDetail = causeDetail;
    this.hintCloud = hintCloud;
    if (init.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = init.cause;
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
    (err as { code?: string } | null)?.code === 'IO_READ'
  );
}

/** Cache por Blob/File — evita 2ª leitura no disco. */
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
    async () => file.slice(0).arrayBuffer(),
  ];
}

function toIoInit(file: NamedBlob, cause?: unknown): IoReadErrorInit {
  return {
    fileName: file.name || 'arquivo',
    cause,
    fileSize: typeof file.size === 'number' ? file.size : undefined,
    fileType: file.type || undefined,
    relativePath: file.webkitRelativePath || undefined,
  };
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
      toIoInit(file, new Error('Arquivo com 0 bytes (seleção vazia ou placeholder de nuvem)')),
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
        last = new Error('buffer vazio após leitura');
      } catch (e) {
        last = e;
      }
    }
  }

  throw new IoReadError(toIoInit(file, last));
}

/** Copia para File em memória (Blob) e popula o cache. */
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
): Promise<{ files: File[]; failedNames: string[]; errors: Error[] }> {
  const out: File[] = [];
  const failedNames: string[] = [];
  const errors: Error[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i]!;
    onProgress?.(`Preparando ${i + 1}/${files.length}: ${f.name}…`);
    try {
      out.push(await materializeAsMemoryFile(f));
    } catch (e) {
      failedNames.push(f.name);
      errors.push(e instanceof Error ? e : new Error(String(e)));
    }
  }
  return { files: out, failedNames, errors };
}

function guessMime(name: string): string {
  if (/\.zip$/i.test(name)) return 'application/zip';
  if (/\.xml$/i.test(name)) return 'application/xml';
  return 'application/octet-stream';
}

export { formatBytes };
