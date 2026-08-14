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
  /** Fatia FileReader falhou — sugerir Chrome/Edge (não montar o ZIP na RAM). */
  hintAltBrowser?: boolean;
};

/** XMLs soltos / textos. ZIP LEDI NÃO passa por aqui — sobe fatia a fatia. */
export const READ_WHOLE_FILE_MAX_BYTES = 8 * 1024 * 1024;

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

/**
 * Só sugere nuvem se o path/nome/size 0 apontarem para isso.
 * “I/O read operation failed” no Safari NÃO implica iCloud (Downloads local,
 * drag-drop e 2ª leitura no mesmo handle também falham).
 */
export function shouldHintCloudPlaceholder(opts: {
  fileName?: string;
  relativePath?: string;
  fileSize?: number;
  cause?: unknown;
}): boolean {
  const pathish = `${opts.relativePath || ''} ${opts.fileName || ''}`.toLowerCase();
  if (/icloud/i.test(pathish)) return true;
  if (opts.fileSize === 0) return true;
  return false;
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
    const blobFailed = /Blob loading failed/i.test(causeDetail || '');
    const large =
      typeof init.fileSize === 'number' && init.fileSize > READ_WHOLE_FILE_MAX_BYTES;
    const hintAltBrowser = Boolean(init.hintAltBrowser || blobFailed || large);

    const meta: string[] = [];
    if (sizeLabel) meta.push(sizeLabel);
    if (init.fileType) meta.push(`tipo ${init.fileType}`);
    const metaStr = meta.length ? ` (${meta.join(', ')})` : '';

    let msg = `Não foi possível ler ${who}${metaStr}`;
    if (causeDetail) msg += ` — ${causeDetail}`;
    if (hintAltBrowser) {
      msg +=
        '. O Safari falhou ao ler uma fatia deste arquivo (não carregamos o ZIP inteiro na RAM). Use Chrome ou Edge, ou escolha de novo pelo botão — não arraste do Finder se falhar.';
    } else {
      msg +=
        '. O Safari não leu o arquivo; escolha de novo pelo botão, não arraste do Finder se falhar.';
    }
    if (hintCloud) {
      msg +=
        ' Se o arquivo estiver só na nuvem (iCloud), copie para uma pasta local (ex.: Desktop) e selecione de lá.';
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
    /Blob loading failed/i.test(msg) ||
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

/**
 * FileReader.readAsArrayBuffer no Blob dado (File inteiro OU file.slice()).
 * NÃO usar blob.arrayBuffer() / fetch(blobUrl) — o WebKit falha com
 * “I/O read operation failed” / “Blob loading failed”.
 */
async function readViaFileReader(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer) || result.byteLength === 0) {
        reject(new Error('FileReader devolveu buffer vazio'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader falhou'));
    reader.onabort = () => reject(new Error('FileReader abortado'));
    reader.readAsArrayBuffer(file);
  });
}

async function readViaResponse(file: Blob): Promise<ArrayBuffer> {
  return new Response(file).arrayBuffer();
}

type NamedBlob = Blob & { name?: string; webkitRelativePath?: string };

/** Último recurso — nunca File.slice nem blob URL (Safari). */
function fallbackStrategies(file: NamedBlob): Array<() => Promise<ArrayBuffer>> {
  return [
    async () => file.arrayBuffer(),
    async () => readViaStream(file),
    async () => readViaResponse(file),
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

function cacheAndReturn(file: NamedBlob, buf: ArrayBuffer): ArrayBuffer {
  const owned = copyArrayBuffer(buf);
  bufferCache.set(file, owned);
  return owned;
}

/**
 * Só XMLs / arquivos pequenos. ZIP LEDI NÃO usa isto — FileReader no Blob
 * inteiro (~13 MB) quebra o WebKit com “Blob loading failed” e 50–100 MB OOM.
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
  if (typeof file.size === 'number' && file.size > READ_WHOLE_FILE_MAX_BYTES) {
    throw new IoReadError({
      ...toIoInit(
        file,
        new Error(
          `Arquivo ${formatBytes(file.size)} — grande demais para ler inteiro no Safari. O ZIP sobe fatia a fatia.`,
        ),
      ),
      hintAltBrowser: true,
    });
  }

  const rounds = Math.max(1, opts?.retries ?? 3);
  const delays = [0, 150, 450];
  let last: unknown;

  for (let round = 0; round < rounds; round++) {
    if (delays[round]) await sleep(delays[round]!);
    try {
      opts?.onAttempt?.(`lendo ${name} na memória (tentativa ${round + 1}/${rounds})`);
      const buf = await readViaFileReader(file);
      if (buf && buf.byteLength > 0) return cacheAndReturn(file, buf);
      last = new Error('buffer vazio após FileReader');
    } catch (e) {
      last = e;
    }
  }

  for (const attempt of fallbackStrategies(file)) {
    try {
      opts?.onAttempt?.(`lendo ${name} (alternativa após FileReader)`);
      const buf = await attempt();
      if (buf && buf.byteLength > 0) return cacheAndReturn(file, buf);
      last = new Error('buffer vazio após leitura');
    } catch (e) {
      last = e;
    }
  }

  throw new IoReadError(toIoInit(file, last));
}

/**
 * Uma fatia via FileReader.readAsArrayBuffer(file.slice(start,end)).
 * Nunca blob.arrayBuffer() / fetch. Retry 3×. Não concatena o arquivo.
 */
export async function readFileSlice(
  file: NamedBlob,
  start: number,
  end: number,
  opts?: { retries?: number; onAttempt?: (label: string) => void },
): Promise<ArrayBuffer> {
  const size = typeof file.size === 'number' ? file.size : 0;
  const lo = Math.max(0, start);
  const hi = Math.min(size || end, end);
  if (hi <= lo) {
    throw new IoReadError({
      ...toIoInit(file, new Error(`Fatia vazia [${lo},${hi})`)),
      hintAltBrowser: true,
    });
  }
  const expected = hi - lo;
  const rounds = Math.max(1, opts?.retries ?? 3);
  const delays = [0, 150, 450];
  let last: unknown;
  for (let round = 0; round < rounds; round++) {
    if (delays[round]) await sleep(delays[round]!);
    try {
      opts?.onAttempt?.(
        `lendo fatia ${lo}-${hi} (tentativa ${round + 1}/${rounds})`,
      );
      const slice = file.slice(lo, hi);
      const buf = await readViaFileReader(slice);
      if (buf.byteLength !== expected) {
        last = new Error(`fatia ${buf.byteLength} bytes, esperado ${expected}`);
        continue;
      }
      return buf;
    } catch (e) {
      last = e;
    }
  }
  throw new IoReadError({
    ...toIoInit(file, last),
    hintAltBrowser: true,
  });
}

/**
 * Fatia de um buffer já na RAM (XMLs). ZIP LEDI não usa — lê file.slice + POST.
 */
export function subarrayChunk(bytes: Uint8Array, index: number, chunkSize: number): ArrayBuffer {
  const start = index * chunkSize;
  const end = Math.min(start + chunkSize, bytes.byteLength);
  const view = bytes.subarray(start, end);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
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
