/**
 * Helpers puros do upload LEDI no browser: paths do ZIP e-SUS, fatias de XML
 * e detecção de tipo (FAI/FAO/PROC) — sem fflate / DOM.
 */

export const XML_SLICE_MAX_FILES = 80;
/** Teto por POST multipart — o caminho que já funciona (Arquivo.zip / XMLs soltos). */
export const XML_SLICE_MAX_BYTES = 1024 * 1024;
/**
 * Unzip no browser desligado: ZIP ≤5 MB ia para POST /upload de XMLs (~0.2 MB)
 * e o Safari falhava com “Load failed” (proxy/socket, não tamanho).
 * ZIP (qualquer tamanho) sobe em /upload-zip/chunk.
 */
export const BROWSER_UNZIP_MAX_BYTES = 0;

export function shouldUnzipZipInBrowser(_size: number): boolean {
  return false;
}

export type LediLoteTipo = 'FAO' | 'FAI' | 'PROCEDIMENTOS';

const TIPO_BY_CODE: Record<number, LediLoteTipo> = {
  4: 'FAI',
  5: 'FAO',
  7: 'PROCEDIMENTOS',
};

const TELA: Record<LediLoteTipo, { href: string; label: string }> = {
  FAI: { href: '/faturamento/lote/fai', label: 'Lote LEDI FAI' },
  FAO: { href: '/faturamento/lote/fao', label: 'Lote LEDI FAO' },
  PROCEDIMENTOS: { href: '/faturamento/lote/proc', label: 'Lote Procedimentos' },
};

export class LediTipoMismatchError extends Error {
  readonly code = 'LEDI_TIPO_MISMATCH' as const;
  readonly expectedTipo: LediLoteTipo;
  readonly detectedTipo: string;
  readonly href: string;

  constructor(opts: { expectedTipo: LediLoteTipo; detectedTipo: string }) {
    const dest = TELA[opts.detectedTipo as LediLoteTipo];
    const where = dest
      ? `${dest.label} (${dest.href})`
      : 'a tela correspondente ao tipo da ficha';
    super(
      `Este arquivo é ${opts.detectedTipo}, não ${opts.expectedTipo}. ` +
        `Abra ${where} e envie de lá — senão todas as fichas entram como tipo errado.`,
    );
    this.name = 'LediTipoMismatchError';
    this.expectedTipo = opts.expectedTipo;
    this.detectedTipo = opts.detectedTipo;
    this.href = dest?.href || '';
  }
}

export function isLediTipoMismatchError(err: unknown): err is LediTipoMismatchError {
  return (
    err instanceof LediTipoMismatchError ||
    (err instanceof Error && (err as { code?: string }).code === 'LEDI_TIPO_MISMATCH')
  );
}

export function normalizeZipPath(name: string): string {
  return String(name || '').replace(/\\/g, '/');
}

export function isUnsafeZipPath(name: string): boolean {
  const n = normalizeZipPath(name);
  if (!n || n.startsWith('/') || /^[a-zA-Z]:/.test(n)) return true;
  return n.split('/').includes('..');
}

export function isJunkZipEntry(name: string): boolean {
  const n = normalizeZipPath(name);
  if (!n || n.endsWith('/')) return true;
  if (isUnsafeZipPath(n)) return true;
  if (n === '__MACOSX' || n.startsWith('__MACOSX/') || n.includes('/__MACOSX/')) return true;
  const base = n.split('/').pop() || n;
  if (base.startsWith('._') || base.startsWith('.')) return true;
  if (base.toLowerCase() === '.ds_store') return true;
  return false;
}

/** *.xml e *.esus.xml; ignora __MACOSX / AppleDouble. */
export function isLediXmlZipEntry(name: string): boolean {
  if (isJunkZipEntry(name)) return false;
  const base = normalizeZipPath(name).split('/').pop() || name;
  return /\.xml$/i.test(base);
}

export function uniqueBaseName(pathName: string, used: Map<string, number>): string {
  const base = (normalizeZipPath(pathName).split('/').pop() || pathName).slice(0, 240);
  const n = (used.get(base) || 0) + 1;
  used.set(base, n);
  if (n === 1) return base.slice(0, 255);
  const suffixed = base.replace(/\.xml$/i, '') + `-${n}.xml`;
  return suffixed.slice(0, 255);
}

export function decodeXmlBytes(u8: Uint8Array): string {
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(u8.subarray(3));
  }
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(u8.subarray(2));
  }
  const headLen = Math.min(240, u8.length);
  const head = new TextDecoder('latin1').decode(u8.subarray(0, headLen));
  const m = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
  const enc = (m?.[1] || '').toLowerCase();
  if (
    enc &&
    enc !== 'utf-8' &&
    enc !== 'utf8' &&
    /8859|latin|windows-1252|cp1252|iso-8859|ibm850|cp850/i.test(enc)
  ) {
    return new TextDecoder('latin1').decode(u8);
  }
  return new TextDecoder('utf-8').decode(u8);
}

export function detectLediTipoId(xml: string): string {
  const codeMatch = xml.match(/<tipoDadoSerializado>\s*(\d+)\s*<\/tipoDadoSerializado>/i);
  const code = codeMatch ? Number(codeMatch[1]) : NaN;
  if (Number.isFinite(code) && TIPO_BY_CODE[code]) return TIPO_BY_CODE[code]!;
  if (/fichaAtendimentoOdontologicoMasterTransport/i.test(xml)) return 'FAO';
  if (/fichaAtendimentoIndividualMasterTransport/i.test(xml)) return 'FAI';
  if (/fichaProcedimentoMasterTransport/i.test(xml)) return 'PROCEDIMENTOS';
  return 'UNKNOWN';
}

export function dominantLediTipo(xmls: string[]): string | null {
  const counts = new Map<string, number>();
  for (const xml of xmls) {
    const id = detectLediTipoId(xml);
    if (id === 'UNKNOWN') continue;
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  let best: string | null = null;
  let n = 0;
  for (const [id, c] of counts) {
    if (c > n) {
      best = id;
      n = c;
    }
  }
  return best;
}

export function assertLediTipoMatch(opts: {
  expectedTipo: LediLoteTipo;
  sampleXmls: string[];
}): void {
  const detected = dominantLediTipo(opts.sampleXmls);
  if (!detected) return;
  if (detected === opts.expectedTipo) return;
  if (detected === 'FAO' || detected === 'FAI' || detected === 'PROCEDIMENTOS') {
    throw new LediTipoMismatchError({ expectedTipo: opts.expectedTipo, detectedTipo: detected });
  }
}

/**
 * Fatias de ~50–100 XMLs ou ≤ 1 MB (o que estourar primeiro).
 * Um XML maior que o teto vai sozinho (limite por arquivo é outro).
 */
export function sliceEntryRanges(
  sizes: number[],
  maxFiles = XML_SLICE_MAX_FILES,
  maxBytes = XML_SLICE_MAX_BYTES,
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let start = 0;
  let bytes = 0;
  let count = 0;
  for (let i = 0; i < sizes.length; i++) {
    const sz = Math.max(0, sizes[i] || 0);
    if (count > 0 && (count >= maxFiles || bytes + sz > maxBytes)) {
      ranges.push({ start, end: i });
      start = i;
      bytes = 0;
      count = 0;
    }
    bytes += sz;
    count += 1;
  }
  if (count) ranges.push({ start, end: sizes.length });
  return ranges;
}

export function isMemoryError(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err || '');
  return /out of memory|allocation failed|oom|Maximum call stack|RangeError/i.test(msg);
}

export function unzipFallbackMessage(fileName: string): string {
  return (
    `Não foi possível descompactar “${fileName}” neste navegador (memória ou ZIP inválido). ` +
      `Envie um ZIP menor e achatado (~200 XMLs, como Arquivo.zip) ou gere a amostra no Desktop: ` +
      `node tools/make-sistemas-fai-amostra.cjs`
  );
}
