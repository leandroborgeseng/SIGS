/**
 * Leitura binária resiliente no browser.
 * ZIP LEDI: fatias com cascata de estratégias (Safari/WebKit first).
 * A mensagem NÃO culpa iCloud por padrão — só sugere se a heurística indicar.
 */

export type IoReadErrorInit = {
  fileName: string;
  cause?: unknown;
  fileSize?: number;
  fileType?: string;
  /** path relativo (webkitRelativePath) se houver */
  relativePath?: string;
  /** Fatia / File API falhou — sugerir Chrome/Edge + reescolher. */
  hintAltBrowser?: boolean;
};

/** XMLs soltos / textos. ZIP LEDI evita isto no caminho feliz. */
export const READ_WHOLE_FILE_MAX_BYTES = 8 * 1024 * 1024;

/** Fallback WebKit: ler ZIP inteiro (~13–20 MB) após falha de fatia. */
const WHOLE_FILE_FALLBACK_MAX_BYTES = 24 * 1024 * 1024;

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
        '. Escolha de novo pelo botão (não arraste do Finder se falhar). ' +
        'Se continuar, envie via Chrome ou Edge. ' +
        'No Mac: `node tools/split-ledi-zip.cjs <arquivo.zip>` gera pedaços ~4 MB no Desktop para subir no Safari.';
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

/**
 * Safari / iOS (qualquer browser no iOS = WebKit). Chrome/Edge desktop = false.
 */
export function isWebKit(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS|CriOS|EdgiOS/i.test(ua);
}

/** Cache por Blob/File — evita 2ª leitura no disco. */
const bufferCache = new WeakMap<Blob, ArrayBuffer>();

/** Fallback WebKit: ZIP inteiro em RAM após falha de fatia (uma vez por File). */
const wholeFileFallbackCache = new WeakMap<Blob, Uint8Array>();

/** Estratégia que funcionou por arquivo (só debug). */
const sliceStrategyLog = new WeakMap<Blob, string>();

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function copyArrayBuffer(buf: ArrayBuffer): ArrayBuffer {
  return buf.slice(0);
}

function copySubarray(src: Uint8Array, start: number, end: number): ArrayBuffer {
  const view = src.subarray(start, end);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

function isOomError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e || '');
  return /out of memory|allocation failed|OOM|Array buffer allocation failed|Invalid array length/i.test(
    msg,
  );
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
  const buf = await new Response(file).arrayBuffer();
  if (!buf.byteLength) throw new Error('Response.arrayBuffer vazio');
  return buf;
}

async function readViaObjectUrl(file: Blob): Promise<ArrayBuffer> {
  const url = URL.createObjectURL(file);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch(objectURL) HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) throw new Error('fetch(objectURL) buffer vazio');
    return buf;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type SliceStrategy = { name: string; run: (blob: Blob) => Promise<ArrayBuffer> };

/**
 * Ordem por motor:
 * - WebKit: objectURL/fetch → Response → FileReader (FileReader(slice) costuma
 *   dar NotReadableError / I/O read failed no Safari com ZIP ~13 MB).
 * - Chromium: FileReader → Response → objectURL (caminho estável atual).
 */
function sliceStrategies(): SliceStrategy[] {
  const fr: SliceStrategy = { name: 'FileReader', run: readViaFileReader };
  const resp: SliceStrategy = { name: 'Response.arrayBuffer', run: readViaResponse };
  const obj: SliceStrategy = { name: 'objectURL+fetch', run: readViaObjectUrl };
  if (isWebKit()) return [obj, resp, fr];
  return [fr, resp, obj];
}

type NamedBlob = Blob & { name?: string; webkitRelativePath?: string };

/** Último recurso para arquivos pequenos (XML) — nunca no caminho ZIP feliz. */
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
 * Só XMLs / arquivos pequenos. ZIP LEDI NÃO usa isto no caminho feliz —
 * sobe fatia a fatia (com fallback WebKit controlado em readFileSlice).
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
 * Uma vez por File (WebKit): tenta ler o ZIP inteiro após falha de fatia.
 * 13 MB às vezes passa com picker fresco. OOM → aborta sem derrubar a página.
 */
async function tryWholeFileFallback(
  file: NamedBlob,
  opts?: { onAttempt?: (label: string) => void },
): Promise<Uint8Array> {
  const hit = wholeFileFallbackCache.get(file);
  if (hit) return hit;

  const size = typeof file.size === 'number' ? file.size : 0;
  if (size <= 0 || size > WHOLE_FILE_FALLBACK_MAX_BYTES) {
    throw new Error(
      `fallback inteiro indisponível (size=${formatBytes(size) || size}, max=${formatBytes(WHOLE_FILE_FALLBACK_MAX_BYTES)})`,
    );
  }

  const name = file.name || 'arquivo';
  const attempts: SliceStrategy[] = [
    { name: 'whole-FileReader', run: readViaFileReader },
    { name: 'whole-Response', run: readViaResponse },
    { name: 'whole-objectURL+fetch', run: readViaObjectUrl },
  ];

  let last: unknown;
  for (const s of attempts) {
    try {
      opts?.onAttempt?.(
        `Safari: lendo “${name}” inteiro (${formatBytes(size)}) via ${s.name} (fallback após fatia)…`,
      );
      const buf = await s.run(file);
      if (!buf.byteLength || (size > 0 && buf.byteLength !== size)) {
        last = new Error(`${s.name}: ${buf.byteLength} bytes, esperado ${size}`);
        continue;
      }
      const u8 = new Uint8Array(buf);
      wholeFileFallbackCache.set(file, u8);
      bufferCache.set(file, copyArrayBuffer(buf));
      if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        console.debug(`[read-binary-file] WebKit whole-file fallback OK via ${s.name} (${formatBytes(size)})`);
      }
      return u8;
    } catch (e) {
      last = e;
      if (isOomError(e)) {
        throw new Error(`OOM ao ler arquivo inteiro (${formatBytes(size)}): ${describeCause(e)}`);
      }
    }
  }
  throw last instanceof Error ? last : new Error(String(last || 'fallback inteiro falhou'));
}

/**
 * Fatia do File: cascata de estratégias (não depende só de FileReader(slice)).
 * No WebKit, se todas as fatias falharem → tenta 1× ler o arquivo inteiro e
 * fatiar de Uint8Array em memória (só após falha; try/catch de OOM).
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

  const fromMem = wholeFileFallbackCache.get(file);
  if (fromMem) {
    if (hi > fromMem.byteLength) {
      throw new IoReadError({
        ...toIoInit(file, new Error(`fatia [${lo},${hi}) além do buffer em memória`)),
        hintAltBrowser: true,
      });
    }
    return copySubarray(fromMem, lo, hi);
  }

  const strategies = sliceStrategies();
  const rounds = Math.max(1, opts?.retries ?? 2);
  const delays = [0, 120, 350];
  let last: unknown;

  for (const strategy of strategies) {
    for (let round = 0; round < rounds; round++) {
      if (delays[round]) await sleep(delays[round]!);
      try {
        opts?.onAttempt?.(
          `lendo fatia ${lo}-${hi} via ${strategy.name} (${round + 1}/${rounds})`,
        );
        const slice = file.slice(lo, hi);
        const buf = await strategy.run(slice);
        if (buf.byteLength !== expected) {
          last = new Error(
            `${strategy.name}: fatia ${buf.byteLength} bytes, esperado ${expected}`,
          );
          continue;
        }
        if (!sliceStrategyLog.has(file)) {
          sliceStrategyLog.set(file, strategy.name);
          if (typeof console !== 'undefined' && typeof console.debug === 'function') {
            console.debug(
              `[read-binary-file] fatia OK via ${strategy.name}` +
                (isWebKit() ? ' (WebKit)' : ' (non-WebKit)'),
            );
          }
        }
        return buf;
      } catch (e) {
        last = e;
      }
    }
  }

  if (isWebKit()) {
    try {
      const all = await tryWholeFileFallback(file, opts);
      if (hi > all.byteLength) {
        throw new Error(`fallback inteiro curto: ${all.byteLength} < ${hi}`);
      }
      if (!sliceStrategyLog.has(file)) {
        sliceStrategyLog.set(file, 'whole-file-fallback');
      }
      return copySubarray(all, lo, hi);
    } catch (e) {
      last = e;
      if (typeof console !== 'undefined' && typeof console.debug === 'function') {
        console.debug('[read-binary-file] WebKit whole-file fallback falhou:', e);
      }
    }
  }

  throw new IoReadError({
    ...toIoInit(file, last),
    hintAltBrowser: true,
  });
}

/**
 * Fatia de um buffer já na RAM (XMLs). ZIP LEDI no caminho feliz usa file.slice.
 */
export function subarrayChunk(bytes: Uint8Array, index: number, chunkSize: number): ArrayBuffer {
  const start = index * chunkSize;
  const end = Math.min(start + chunkSize, bytes.byteLength);
  return copySubarray(bytes, start, end);
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
