/**
 * Identificação de tipo de ficha LEDI (envelope dadoTransporte).
 * Lotes Franca 5974691: FAI=4, FAO=5, Procedimentos=7.
 */

export type LediLoteTipo = 'FAO' | 'FAI' | 'PROCEDIMENTOS';

export type LediFichaTipoId = 'FAI' | 'FAO' | 'PROCEDIMENTOS' | 'VACINA' | 'COLETIVO' | 'OUTRO' | 'UNKNOWN';

export const LEDI_TIPO_MISMATCH = 'LEDI_TIPO_MISMATCH' as const;

export const LOTE_TELA: Record<LediLoteTipo, { href: string; label: string; tipoCode: number }> = {
  FAI: { href: '/faturamento/lote/fai', label: 'Lote LEDI FAI', tipoCode: 4 },
  FAO: { href: '/faturamento/lote/fao', label: 'Lote LEDI FAO', tipoCode: 5 },
  PROCEDIMENTOS: { href: '/faturamento/lote/proc', label: 'Lote Procedimentos', tipoCode: 7 },
};

export type LediTipoMismatchPayload = {
  code: typeof LEDI_TIPO_MISMATCH;
  expectedTipo: LediLoteTipo;
  detectedTipo: string;
  href: string;
  sampleFile?: string;
  message: string;
};

export type LediFichaTipo = {
  id: LediFichaTipoId;
  code: number | null;
  label: string;
  /** Onde corrigir no SIGS hoje */
  correctionPath: string;
  /** true = tela /faturamento/lote/fao (validador FAO) */
  odontoLoteSupported: boolean;
  masterTag?: string;
};

const BY_CODE: Record<number, Omit<LediFichaTipo, 'code'>> = {
  2: {
    id: 'VACINA',
    label: 'Vacinação',
    correctionPath: 'Vacinação / produção LEDI vacina (ainda não no lote odonto)',
    odontoLoteSupported: false,
    masterTag: 'fichaVacinacaoMasterTransport',
  },
  4: {
    id: 'FAI',
    label: 'Atendimento Individual (FAI)',
    correctionPath: 'Faturamento → Lote LEDI FAI (`/faturamento/lote/fai`)',
    odontoLoteSupported: false,
    masterTag: 'fichaAtendimentoIndividualMasterTransport',
  },
  5: {
    id: 'FAO',
    label: 'Atendimento Odontológico (FAO)',
    correctionPath: 'Faturamento → Lote LEDI FAO (`/faturamento/lote/fao`)',
    odontoLoteSupported: true,
    masterTag: 'fichaAtendimentoOdontologicoMasterTransport',
  },
  6: {
    id: 'COLETIVO',
    label: 'Atividade Coletiva',
    correctionPath: 'Atividade coletiva / produção LEDI coletivo',
    odontoLoteSupported: false,
    masterTag: 'fichaAtividadeColetivaMasterTransport',
  },
  7: {
    id: 'PROCEDIMENTOS',
    label: 'Ficha de Procedimentos',
    correctionPath: 'Faturamento → Lote Procedimentos (`/faturamento/lote/proc`)',
    odontoLoteSupported: false,
    masterTag: 'fichaProcedimentoMasterTransport',
  },
};

const BY_TAG: Array<{ re: RegExp; code: number }> = [
  { re: /fichaAtendimentoOdontologicoMasterTransport/i, code: 5 },
  { re: /fichaAtendimentoIndividualMasterTransport/i, code: 4 },
  { re: /fichaProcedimentoMasterTransport/i, code: 7 },
  { re: /fichaVacinacaoMasterTransport/i, code: 2 },
  { re: /fichaAtividadeColetivaMasterTransport/i, code: 6 },
];

export function detectLediFichaTipo(xml: string): LediFichaTipo {
  const codeMatch = xml.match(/<tipoDadoSerializado>\s*(\d+)\s*<\/tipoDadoSerializado>/i);
  let code = codeMatch ? Number(codeMatch[1]) : null;

  if (code == null || !Number.isFinite(code) || !BY_CODE[code]) {
    for (const t of BY_TAG) {
      if (t.re.test(xml)) {
        code = t.code;
        break;
      }
    }
  }

  if (code != null && BY_CODE[code]) {
    return { ...BY_CODE[code], code };
  }

  const fileHint = '';
  return {
    id: 'UNKNOWN',
    code: code ?? null,
    label: code != null ? `Tipo LEDI ${code} (não mapeado)` : 'Tipo não identificado',
    correctionPath: 'Abra o XML e confira tipoDadoSerializado / tag MasterTransport',
    odontoLoteSupported: false,
    masterTag: fileHint || undefined,
  };
}

export function detectLediFichaTipoFromFileName(fileName: string): LediFichaTipoId | null {
  const n = fileName.toLowerCase();
  if (n.includes('odontologico') || n.includes('odonto')) return 'FAO';
  if (n.includes('atendimentoindividual') || n.includes('individual')) return 'FAI';
  if (n.includes('procedimento')) return 'PROCEDIMENTOS';
  if (n.includes('vacina')) return 'VACINA';
  if (n.includes('coletiva') || n.includes('coletivo')) return 'COLETIVO';
  return null;
}

export class LediTipoMismatchError extends Error {
  readonly code = LEDI_TIPO_MISMATCH;
  readonly expectedTipo: LediLoteTipo;
  readonly detectedTipo: string;
  readonly href: string;
  readonly sampleFile?: string;

  constructor(opts: { expectedTipo: LediLoteTipo; detectedTipo: string; sampleFile?: string }) {
    const dest = LOTE_TELA[opts.detectedTipo as LediLoteTipo];
    const expected = LOTE_TELA[opts.expectedTipo];
    const where = dest ? `${dest.label} (${dest.href})` : 'a tela correspondente ao tipo da ficha';
    const detectedLabel = dest?.label || opts.detectedTipo;
    const sample = opts.sampleFile ? ` Ex.: ${opts.sampleFile}.` : '';
    super(
      `Este ZIP é ${detectedLabel}, não ${expected.label}. ` +
        `Abra ${where} e envie de lá.${sample} ` +
        `Separe os tipos — não analisamos este arquivo.`,
    );
    this.name = 'LediTipoMismatchError';
    this.expectedTipo = opts.expectedTipo;
    this.detectedTipo = opts.detectedTipo;
    this.href = dest?.href || '';
    this.sampleFile = opts.sampleFile;
  }

  toPayload(): LediTipoMismatchPayload {
    return {
      code: LEDI_TIPO_MISMATCH,
      expectedTipo: this.expectedTipo,
      detectedTipo: this.detectedTipo,
      href: this.href,
      sampleFile: this.sampleFile,
      message: this.message,
    };
  }

  toHttpBody() {
    return {
      statusCode: 400 as const,
      error: 'Bad Request',
      ...this.toPayload(),
    };
  }
}

export function isLediTipoMismatchError(err: unknown): err is LediTipoMismatchError {
  return (
    err instanceof LediTipoMismatchError ||
    (typeof err === 'object' &&
      err != null &&
      (err as { code?: string }).code === LEDI_TIPO_MISMATCH &&
      typeof (err as { message?: string }).message === 'string')
  );
}

export function extractTipoMismatch(err: unknown): LediTipoMismatchPayload | null {
  if (err instanceof LediTipoMismatchError) return err.toPayload();
  if (typeof err !== 'object' || err == null) return null;
  const anyErr = err as { getResponse?: () => unknown; code?: string; message?: string };
  if (typeof anyErr.getResponse === 'function') {
    const r = anyErr.getResponse();
    if (typeof r === 'object' && r && (r as { code?: string }).code === LEDI_TIPO_MISMATCH) {
      const body = r as LediTipoMismatchPayload;
      return {
        code: LEDI_TIPO_MISMATCH,
        expectedTipo: body.expectedTipo,
        detectedTipo: body.detectedTipo,
        href: body.href || '',
        sampleFile: body.sampleFile,
        message: body.message,
      };
    }
  }
  return null;
}

/**
 * Gate P0: qualquer ficha fora do tipo da tela recusa o lote inteiro.
 * Não valida LEDI — só tipoDadoSerializado / tag MasterTransport.
 */
export function assertLoteTipoMatch(opts: {
  expectedTipo: LediLoteTipo;
  files: Array<{ name?: string; xml: string }>;
}): void {
  for (const f of opts.files) {
    const xml = f.xml?.trim();
    if (!xml) continue;
    const tipo = detectLediFichaTipo(xml);
    if (tipo.id !== opts.expectedTipo) {
      throw new LediTipoMismatchError({
        expectedTipo: opts.expectedTipo,
        detectedTipo: tipo.id,
        sampleFile: f.name,
      });
    }
  }
}
