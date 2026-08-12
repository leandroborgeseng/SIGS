/**
 * Identificação de tipo de ficha LEDI (envelope dadoTransporte).
 * Lotes Franca 5974691: FAI=4, FAO=5, Procedimentos=7.
 */

export type LediFichaTipoId = 'FAI' | 'FAO' | 'PROCEDIMENTOS' | 'VACINA' | 'COLETIVO' | 'OUTRO' | 'UNKNOWN';

export type LediFichaTipo = {
  id: LediFichaTipoId;
  code: number | null;
  label: string;
  /** Onde corrigir no SIGS hoje */
  correctionPath: string;
  /** true = tela /odonto/lote (validador FAO) */
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
    correctionPath: 'APS → Lote LEDI FAI (`/aps/lote`)',
    odontoLoteSupported: false,
    masterTag: 'fichaAtendimentoIndividualMasterTransport',
  },
  5: {
    id: 'FAO',
    label: 'Atendimento Odontológico (FAO)',
    correctionPath: 'Odontologia → Lote LEDI FAO (`/odonto/lote`)',
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
    correctionPath: 'Produção → Lote Procedimentos (`/procedimentos/lote`)',
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
