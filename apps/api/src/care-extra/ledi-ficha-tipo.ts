/**
 * Identificação de tipo de ficha LEDI (envelope dadoTransporte).
 * Códigos: TipoDadoTranspEnum (cds.common.api-5.5.24) — não inventar.
 * Lotes Franca 5974691 com wizard: FAI=4, FAO=5, Procedimentos=7.
 * CDS 3/8/10: detecção + stub (sem pipeline ZIP até amostra XML).
 */

export type LediLoteTipo = 'FAO' | 'FAI' | 'PROCEDIMENTOS';

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

/** Telas de wizard ZIP ativas (só 4/5/7). */
export const LOTE_TELA: Record<LediLoteTipo, { href: string; label: string; tipoCode: number }> = {
  FAI: { href: '/faturamento/lote/fai', label: 'Lote LEDI FAI', tipoCode: 4 },
  FAO: { href: '/faturamento/lote/fao', label: 'Lote LEDI FAO', tipoCode: 5 },
  PROCEDIMENTOS: { href: '/faturamento/lote/proc', label: 'Lote Procedimentos', tipoCode: 7 },
};

/**
 * Stubs CDS (3/8/10): rota informativa, sem upload/validação.
 * Fonte: TipoDadoTranspEnum + DTOs *Transport.
 */
export const CDS_LOTE_STUB: Record<
  'CADASTRO_DOMICILIAR' | 'VISITA_ACS' | 'AD',
  { href: string; label: string; tipoCode: number; nativeHref: string }
> = {
  CADASTRO_DOMICILIAR: {
    href: '/faturamento/lote/domicilio',
    label: 'Lote Cadastro Domiciliar (stub)',
    tipoCode: 3,
    nativeHref: '/territorio',
  },
  VISITA_ACS: {
    href: '/faturamento/lote/visita-acs',
    label: 'Lote Visita ACS (stub)',
    tipoCode: 8,
    nativeHref: '/territorio',
  },
  AD: {
    href: '/faturamento/lote/ad',
    label: 'Lote Atenção Domiciliar (stub)',
    tipoCode: 10,
    nativeHref: '/ad',
  },
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
  /** true = wizard ZIP ativo (4/5/7) */
  loteXmlLive: boolean;
  masterTag?: string;
};

const BY_CODE: Record<number, Omit<LediFichaTipo, 'code'>> = {
  2: {
    id: 'CADASTRO_INDIVIDUAL',
    label: 'Cadastro Individual',
    correctionPath: 'Cadastro paciente (`/pacientes`) — sem lote XML nesta fase',
    odontoLoteSupported: false,
    loteXmlLive: false,
    masterTag: 'cadastroIndividualTransport',
  },
  3: {
    id: 'CADASTRO_DOMICILIAR',
    label: 'Cadastro Domiciliar',
    correctionPath: `${CDS_LOTE_STUB.CADASTRO_DOMICILIAR.label} (${CDS_LOTE_STUB.CADASTRO_DOMICILIAR.href}) · origem ${CDS_LOTE_STUB.CADASTRO_DOMICILIAR.nativeHref}`,
    odontoLoteSupported: false,
    loteXmlLive: false,
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
    correctionPath: 'Atividade coletiva / produção LEDI coletivo',
    odontoLoteSupported: false,
    loteXmlLive: false,
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
    correctionPath: `${CDS_LOTE_STUB.VISITA_ACS.label} (${CDS_LOTE_STUB.VISITA_ACS.href}) · origem ${CDS_LOTE_STUB.VISITA_ACS.nativeHref}`,
    odontoLoteSupported: false,
    loteXmlLive: false,
    masterTag: 'fichaVisitaDomiciliarMasterTransport',
  },
  10: {
    id: 'AD',
    label: 'Atendimento Domiciliar (AD)',
    correctionPath: `${CDS_LOTE_STUB.AD.label} (${CDS_LOTE_STUB.AD.href}) · origem ${CDS_LOTE_STUB.AD.nativeHref}`,
    odontoLoteSupported: false,
    loteXmlLive: false,
    masterTag: 'fichaAtendimentoDomiciliarMasterTransport',
  },
  14: {
    id: 'VACINA',
    label: 'Vacinação',
    correctionPath: 'Vacinação / produção LEDI vacina (ainda não no lote ZIP)',
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
  if (n.includes('atendimentodomiciliar') || (n.includes('domiciliar') && n.includes('atend'))) return 'AD';
  if (n.includes('cadastrodomiciliar') || n.includes('domicilio')) return 'CADASTRO_DOMICILIAR';
  if (n.includes('cadastroindividual')) return 'CADASTRO_INDIVIDUAL';
  return null;
}

function hrefForDetectedTipo(detectedTipo: string): string {
  if (detectedTipo in LOTE_TELA) return LOTE_TELA[detectedTipo as LediLoteTipo].href;
  if (detectedTipo in CDS_LOTE_STUB) {
    return CDS_LOTE_STUB[detectedTipo as keyof typeof CDS_LOTE_STUB].href;
  }
  return '';
}

function labelForDetectedTipo(detectedTipo: string): string {
  if (detectedTipo in LOTE_TELA) return LOTE_TELA[detectedTipo as LediLoteTipo].label;
  if (detectedTipo in CDS_LOTE_STUB) {
    return CDS_LOTE_STUB[detectedTipo as keyof typeof CDS_LOTE_STUB].label;
  }
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
    const stubHint =
      opts.detectedTipo in CDS_LOTE_STUB
        ? ' Lote XML deste tipo ainda é stub (sem upload) — use a origem nativa até haver dump de amostra.'
        : '';
    super(
      `Este ZIP é ${detectedLabel}, não ${expected.label}. ` +
        `Abra ${where} e envie de lá.${sample}${stubHint} ` +
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
