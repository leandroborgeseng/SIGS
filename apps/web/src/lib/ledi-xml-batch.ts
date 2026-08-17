/**
 * Helpers puros do upload LEDI no browser: paths do ZIP e-SUS, fatias de XML
 * e detecção de tipo — sem fflate / DOM.
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

export type LediLoteTipo =
  | 'FAO'
  | 'FAI'
  | 'PROCEDIMENTOS'
  | 'CADASTRO_INDIVIDUAL'
  | 'CADASTRO_DOMICILIAR'
  | 'COLETIVO'
  | 'VISITA_ACS'
  | 'AD';

const TELA: Record<LediLoteTipo, { href: string; label: string }> = {
  FAI: { href: '/faturamento/lote/fai', label: 'Lote LEDI FAI' },
  FAO: { href: '/faturamento/lote/fao', label: 'Lote LEDI FAO' },
  PROCEDIMENTOS: { href: '/faturamento/lote/proc', label: 'Lote Procedimentos' },
  CADASTRO_INDIVIDUAL: {
    href: '/faturamento/lote/cadastro-individual',
    label: 'Lote Cadastro Individual',
  },
  CADASTRO_DOMICILIAR: {
    href: '/faturamento/lote/domicilio',
    label: 'Lote Cadastro Domiciliar',
  },
  COLETIVO: { href: '/faturamento/lote/coletivo', label: 'Lote Atividade Coletiva' },
  VISITA_ACS: { href: '/faturamento/lote/visita-acs', label: 'Lote Visita ACS' },
  AD: { href: '/faturamento/lote/ad', label: 'Lote Atenção Domiciliar' },
};

export const LEDI_TIPO_CODE: Record<LediLoteTipo, number> = {
  CADASTRO_INDIVIDUAL: 2,
  CADASTRO_DOMICILIAR: 3,
  FAI: 4,
  FAO: 5,
  COLETIVO: 6,
  PROCEDIMENTOS: 7,
  VISITA_ACS: 8,
  AD: 10,
};

const LOTE_IDS = new Set<string>(Object.keys(TELA));

export function isLediLoteTipo(v: string): v is LediLoteTipo {
  return LOTE_IDS.has(v);
}

export function parseLediLoteTipo(raw?: string | null, fallback: LediLoteTipo = 'FAO'): LediLoteTipo {
  const t = String(raw || '').trim().toUpperCase();
  if (t === 'PROC') return 'PROCEDIMENTOS';
  if (isLediLoteTipo(t)) return t;
  return fallback;
}

export function lediTelaAcceptCopy(tipo: LediLoteTipo): string {
  const short = TELA[tipo].label.replace(/^Lote (LEDI )?/, '');
  return `Esta tela aceita só ${short} (tipo ${LEDI_TIPO_CODE[tipo]}).`;
}

export class LediTipoMismatchError extends Error {
  readonly code = 'LEDI_TIPO_MISMATCH' as const;
  readonly expectedTipo: LediLoteTipo;
  readonly detectedTipo: string;
  readonly href: string;

  constructor(opts: { expectedTipo: LediLoteTipo; detectedTipo: string }) {
    const dest = TELA[opts.detectedTipo as LediLoteTipo];
    const expected = TELA[opts.expectedTipo];
    const detectedLabel = dest?.label || opts.detectedTipo;
    const where = dest
      ? `${dest.label} (${dest.href})`
      : 'a tela correspondente ao tipo da ficha';
    const vacinaHint =
      opts.detectedTipo === 'VACINA' ? ' Lote ZIP vacina (14) ainda não está nesta onda.' : '';
    super(
      `Este arquivo é ${detectedLabel}, não ${expected.label}. ` +
        `Abra ${where} e envie de lá.${vacinaHint} Separe os tipos — não analisamos este arquivo.`,
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

const DETECT_BY_CODE: Record<number, string> = {
  2: 'CADASTRO_INDIVIDUAL',
  3: 'CADASTRO_DOMICILIAR',
  4: 'FAI',
  5: 'FAO',
  6: 'COLETIVO',
  7: 'PROCEDIMENTOS',
  8: 'VISITA_ACS',
  10: 'AD',
  14: 'VACINA',
};

export function detectLediTipoId(xml: string): string {
  const codeMatch = xml.match(/<tipoDadoSerializado>\s*(\d+)\s*<\/tipoDadoSerializado>/i);
  const code = codeMatch ? Number(codeMatch[1]) : NaN;
  if (Number.isFinite(code) && DETECT_BY_CODE[code]) return DETECT_BY_CODE[code]!;
  if (/fichaAtendimentoOdontologicoMasterTransport/i.test(xml)) return 'FAO';
  if (/fichaAtendimentoIndividualMasterTransport/i.test(xml)) return 'FAI';
  if (/fichaProcedimentoMasterTransport/i.test(xml)) return 'PROCEDIMENTOS';
  if (/fichaVisitaDomiciliarMasterTransport/i.test(xml)) return 'VISITA_ACS';
  if (/fichaAtendimentoDomiciliarMasterTransport/i.test(xml)) return 'AD';
  if (/cadastroDomiciliarTransport/i.test(xml)) return 'CADASTRO_DOMICILIAR';
  if (/fichaVacinacaoMasterTransport/i.test(xml)) return 'VACINA';
  if (/fichaAtividadeColetivaMasterTransport/i.test(xml)) return 'COLETIVO';
  if (/cadastroIndividualTransport/i.test(xml)) return 'CADASTRO_INDIVIDUAL';
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
  if (LOTE_IDS.has(detected) || detected === 'VACINA') {
    throw new LediTipoMismatchError({ expectedTipo: opts.expectedTipo, detectedTipo: detected });
  }
}

export function parseLediTipoMismatch(err: unknown): LediTipoMismatchError | null {
  if (isLediTipoMismatchError(err)) return err;
  if (!err || typeof err !== 'object') return null;
  const body = (err as { body?: unknown }).body;
  const fromBody = parseMismatchPayload(body);
  if (fromBody) return fromBody;
  const msg = err instanceof Error ? err.message : '';
  if (/não analisamos este arquivo|LEDI_TIPO_MISMATCH/i.test(msg)) {
    return mismatchFromMessage(msg);
  }
  return null;
}

export function parseLediTipoMismatchFromJob(job: {
  errorMessage?: string | null;
  result?: Record<string, unknown> | null;
}): LediTipoMismatchError | null {
  const fromResult = parseMismatchPayload(job.result);
  if (fromResult) return fromResult;
  const msg = job.errorMessage || '';
  if (/não analisamos este arquivo|LEDI_TIPO_MISMATCH/i.test(msg)) {
    return mismatchFromMessage(msg);
  }
  return null;
}

function parseExpectedTipo(raw: unknown): LediLoteTipo {
  return parseLediLoteTipo(String(raw || ''), 'FAO');
}

function parseMismatchPayload(raw: unknown): LediTipoMismatchError | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.code !== 'LEDI_TIPO_MISMATCH') return null;
  return new LediTipoMismatchError({
    expectedTipo: parseExpectedTipo(o.expectedTipo),
    detectedTipo: String(o.detectedTipo || 'UNKNOWN'),
  });
}

function tipoFromMessageFragment(msg: string, prefix: 'é' | 'não'): string | null {
  const entries = Object.entries(TELA) as Array<[LediLoteTipo, { href: string; label: string }]>;
  for (const [id, t] of entries) {
    if (new RegExp(`${prefix} ${id}\\b`, 'i').test(msg)) return id;
    if (new RegExp(`${prefix} ${t.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(msg)) {
      return id;
    }
  }
  if (prefix === 'é') {
    if (/Cadastro Individual/i.test(msg)) return 'CADASTRO_INDIVIDUAL';
    if (/Cadastro Domiciliar|domiciliar/i.test(msg)) return 'CADASTRO_DOMICILIAR';
    if (/Procedimentos/i.test(msg)) return 'PROCEDIMENTOS';
    if (/Coletiva|coletivo/i.test(msg)) return 'COLETIVO';
    if (/Visita ACS/i.test(msg)) return 'VISITA_ACS';
    if (/Atenção Domiciliar|\bé AD\b/i.test(msg)) return 'AD';
    if (/Lote LEDI FAO|\bé FAO\b/i.test(msg)) return 'FAO';
    if (/Lote LEDI FAI|\bé FAI\b/i.test(msg)) return 'FAI';
  }
  return null;
}

function mismatchFromMessage(msg: string): LediTipoMismatchError {
  const detected = tipoFromMessageFragment(msg, 'é') || 'UNKNOWN';
  const expectedRaw = tipoFromMessageFragment(msg, 'não');
  const expected = parseLediLoteTipo(expectedRaw, 'FAO');
  return new LediTipoMismatchError({ expectedTipo: expected, detectedTipo: detected });
}

/**
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
