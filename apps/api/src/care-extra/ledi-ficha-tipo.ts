/**
 * Identificação de tipo de ficha LEDI (envelope dadoTransporte).
 * Códigos: TipoDadoTranspEnum (cds.common.api-5.5.24) — não inventar.
 * Wizard ZIP live: 2, 3, 4, 5, 6, 7, 8, 10 (4/5/7 com dump Franca; demais schema sintético).
 * Vacina (14): detecção apenas — lote ZIP não pedido nesta onda.
 */

export type LediLoteTipo =
  | 'FAO'
  | 'FAI'
  | 'PROCEDIMENTOS'
  | 'CADASTRO_INDIVIDUAL'
  | 'CADASTRO_DOMICILIAR'
  | 'COLETIVO'
  | 'VISITA_ACS'
  | 'AD';

export type LediFichaTipoId =
  | 'FAI'
  | 'FAO'
  | 'PROCEDIMENTOS'
  | 'CADASTRO_INDIVIDUAL'
  | 'CADASTRO_DOMICILIAR'
  | 'VISITA_ACS'
  | 'AD'
  | 'VACINA'
  | 'COLETIVO'
  | 'OUTRO'
  | 'UNKNOWN';

export const LEDI_TIPO_MISMATCH = 'LEDI_TIPO_MISMATCH' as const;

/** Telas de wizard ZIP ativas. */
export const LOTE_TELA: Record<LediLoteTipo, { href: string; label: string; tipoCode: number }> = {
  FAI: { href: '/faturamento/lote/fai', label: 'Lote LEDI FAI', tipoCode: 4 },
  FAO: { href: '/faturamento/lote/fao', label: 'Lote LEDI FAO', tipoCode: 5 },
  PROCEDIMENTOS: { href: '/faturamento/lote/proc', label: 'Lote Procedimentos', tipoCode: 7 },
  CADASTRO_INDIVIDUAL: {
    href: '/faturamento/lote/cadastro-individual',
    label: 'Lote Cadastro Individual',
    tipoCode: 2,
  },
  CADASTRO_DOMICILIAR: {
    href: '/faturamento/lote/domicilio',
    label: 'Lote Cadastro Domiciliar',
    tipoCode: 3,
  },
  COLETIVO: { href: '/faturamento/lote/coletivo', label: 'Lote Atividade Coletiva', tipoCode: 6 },
  VISITA_ACS: { href: '/faturamento/lote/visita-acs', label: 'Lote Visita ACS', tipoCode: 8 },
  AD: { href: '/faturamento/lote/ad', label: 'Lote Atenção Domiciliar', tipoCode: 10 },
};

/** @deprecated stubs viraram live — mantido para links nativos. */
export const CDS_LOTE_STUB: Record<
  'CADASTRO_DOMICILIAR' | 'VISITA_ACS' | 'AD',
  { href: string; label: string; tipoCode: number; nativeHref: string }
> = {
  CADASTRO_DOMICILIAR: {
    href: '/faturamento/lote/domicilio',
    label: 'Lote Cadastro Domiciliar',
    tipoCode: 3,
    nativeHref: '/territorio',
  },
  VISITA_ACS: {
    href: '/faturamento/lote/visita-acs',
    label: 'Lote Visita ACS',
    tipoCode: 8,
    nativeHref: '/territorio',
  },
  AD: {
    href: '/faturamento/lote/ad',
    label: 'Lote Atenção Domiciliar',
    tipoCode: 10,
    nativeHref: '/ad',
  },
};

export const LEDI_LOTE_TIPOS: readonly LediLoteTipo[] = [
  'CADASTRO_INDIVIDUAL',
  'CADASTRO_DOMICILIAR',
  'FAI',
  'FAO',
  'COLETIVO',
  'PROCEDIMENTOS',
  'VISITA_ACS',
  'AD',
] as const;

export function isLediLoteTipo(v: string): v is LediLoteTipo {
  return (LEDI_LOTE_TIPOS as readonly string[]).includes(v);
}

/** Query/payload do wizard ZIP: 2/3/4/5/6/7/8/10. Não colapsar CDS em FAO. */
export function parseLediLoteTipo(raw?: string | null, fallback: LediLoteTipo = 'FAO'): LediLoteTipo {
  const t = String(raw || '').trim().toUpperCase();
  if (t === 'PROC') return 'PROCEDIMENTOS';
  if (isLediLoteTipo(t)) return t;
  return fallback;
}

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
  correctionPath: string;
  odontoLoteSupported: boolean;
  /** true = wizard ZIP ativo */
  loteXmlLive: boolean;
  masterTag?: string;
};

const BY_CODE: Record<number, Omit<LediFichaTipo, 'code'>> = {
  2: {
    id: 'CADASTRO_INDIVIDUAL',
    label: 'Cadastro Individual',
    correctionPath: 'Faturamento → Lote Cadastro Individual (`/faturamento/lote/cadastro-individual`)',
    odontoLoteSupported: false,
    loteXmlLive: true,
    masterTag: 'cadastroIndividualTransport',
  },
  3: {
    id: 'CADASTRO_DOMICILIAR',
    label: 'Cadastro Domiciliar',
    correctionPath: `Faturamento → Lote Cadastro Domiciliar (${LOTE_TELA.CADASTRO_DOMICILIAR.href}) · origem /territorio`,
    odontoLoteSupported: false,
    loteXmlLive: true,
    masterTag: 'cadastroDomiciliarTransport',
  },
  4: {
    id: 'FAI',
    label: 'Atendimento Individual (FAI)',
    correctionPath: 'Faturamento → Lote LEDI FAI (`/faturamento/lote/fai`)',
    odontoLoteSupported: false,
    loteXmlLive: true,
    masterTag: 'fichaAtendimentoIndividualMasterTransport',
  },
  5: {
    id: 'FAO',
    label: 'Atendimento Odontológico (FAO)',
    correctionPath: 'Faturamento → Lote LEDI FAO (`/faturamento/lote/fao`)',
    odontoLoteSupported: true,
    loteXmlLive: true,
    masterTag: 'fichaAtendimentoOdontologicoMasterTransport',
  },
  6: {
    id: 'COLETIVO',
    label: 'Atividade Coletiva',
    correctionPath: 'Faturamento → Lote Atividade Coletiva (`/faturamento/lote/coletivo`) · origem /coletivo',
    odontoLoteSupported: false,
    loteXmlLive: true,
    masterTag: 'fichaAtividadeColetivaMasterTransport',
  },
  7: {
    id: 'PROCEDIMENTOS',
    label: 'Ficha de Procedimentos',
    correctionPath: 'Faturamento → Lote Procedimentos (`/faturamento/lote/proc`)',
    odontoLoteSupported: false,
    loteXmlLive: true,
    masterTag: 'fichaProcedimentoMasterTransport',
  },
  8: {
    id: 'VISITA_ACS',
    label: 'Visita Domiciliar (ACS)',
    correctionPath: `Faturamento → Lote Visita ACS (${LOTE_TELA.VISITA_ACS.href}) · origem /territorio`,
    odontoLoteSupported: false,
    loteXmlLive: true,
    masterTag: 'fichaVisitaDomiciliarMasterTransport',
  },
  10: {
    id: 'AD',
    label: 'Atendimento Domiciliar (AD)',
    correctionPath: `Faturamento → Lote AD (${LOTE_TELA.AD.href}) · origem /ad`,
    odontoLoteSupported: false,
    loteXmlLive: true,
    masterTag: 'fichaAtendimentoDomiciliarMasterTransport',
  },
  14: {
    id: 'VACINA',
    label: 'Vacinação',
    correctionPath: 'Vacinação / produção LEDI vacina (lote ZIP não nesta onda)',
    odontoLoteSupported: false,
    loteXmlLive: false,
    masterTag: 'fichaVacinacaoMasterTransport',
  },
};

const BY_TAG: Array<{ re: RegExp; code: number }> = [
  { re: /fichaAtendimentoOdontologicoMasterTransport/i, code: 5 },
  { re: /fichaAtendimentoIndividualMasterTransport/i, code: 4 },
  { re: /fichaProcedimentoMasterTransport/i, code: 7 },
  { re: /fichaVacinacaoMasterTransport/i, code: 14 },
  { re: /fichaAtividadeColetivaMasterTransport/i, code: 6 },
  { re: /fichaVisitaDomiciliarMasterTransport/i, code: 8 },
  { re: /fichaAtendimentoDomiciliarMasterTransport/i, code: 10 },
  { re: /cadastroDomiciliarTransport/i, code: 3 },
  { re: /cadastroIndividualTransport/i, code: 2 },
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

  return {
    id: 'UNKNOWN',
    code: code ?? null,
    label: code != null ? `Tipo LEDI ${code} (não mapeado)` : 'Tipo não identificado',
    correctionPath: 'Abra o XML e confira tipoDadoSerializado / tag MasterTransport',
    odontoLoteSupported: false,
    loteXmlLive: false,
  };
}

export function detectLediFichaTipoFromFileName(fileName: string): LediFichaTipoId | null {
  const n = fileName.toLowerCase();
  if (n.includes('odontologico') || n.includes('odonto')) return 'FAO';
  if (n.includes('atendimentoindividual') || n.includes('individual')) return 'FAI';
  if (n.includes('procedimento')) return 'PROCEDIMENTOS';
  if (n.includes('vacina')) return 'VACINA';
  if (n.includes('coletiva') || n.includes('coletivo')) return 'COLETIVO';
  if (n.includes('visitadomiciliar') || n.includes('visita')) return 'VISITA_ACS';
  if (n.includes('atendimentodomiciliar') || (n.includes('domiciliar') && n.includes('atend')))
    return 'AD';
  if (n.includes('cadastrodomiciliar') || n.includes('domicilio')) return 'CADASTRO_DOMICILIAR';
  if (n.includes('cadastroindividual')) return 'CADASTRO_INDIVIDUAL';
  return null;
}

function hrefForDetectedTipo(detectedTipo: string): string {
  if (detectedTipo in LOTE_TELA) return LOTE_TELA[detectedTipo as LediLoteTipo].href;
  return '';
}

function labelForDetectedTipo(detectedTipo: string): string {
  if (detectedTipo in LOTE_TELA) return LOTE_TELA[detectedTipo as LediLoteTipo].label;
  return detectedTipo;
}

export class LediTipoMismatchError extends Error {
  readonly code = LEDI_TIPO_MISMATCH;
  readonly expectedTipo: LediLoteTipo;
  readonly detectedTipo: string;
  readonly href: string;
  readonly sampleFile?: string;

  constructor(opts: { expectedTipo: LediLoteTipo; detectedTipo: string; sampleFile?: string }) {
    const destHref = hrefForDetectedTipo(opts.detectedTipo);
    const expected = LOTE_TELA[opts.expectedTipo];
    const detectedLabel = labelForDetectedTipo(opts.detectedTipo);
    const where = destHref
      ? `${detectedLabel} (${destHref})`
      : 'a tela correspondente ao tipo da ficha';
    const sample = opts.sampleFile ? ` Ex.: ${opts.sampleFile}.` : '';
    const vacinaHint =
      opts.detectedTipo === 'VACINA'
        ? ' Lote ZIP de vacinação (tipo 14) ainda não está nesta onda.'
        : '';
    super(
      `Este ZIP é ${detectedLabel}, não ${expected.label}. ` +
        `Abra ${where} e envie de lá.${sample}${vacinaHint} ` +
        `Separe os tipos — não analisamos este arquivo.`,
    );
    this.name = 'LediTipoMismatchError';
    this.expectedTipo = opts.expectedTipo;
    this.detectedTipo = opts.detectedTipo;
    this.href = destHref;
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
