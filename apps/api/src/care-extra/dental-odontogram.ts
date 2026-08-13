/**
 * Odontograma clínico mínimo (RF-12.12 parcial).
 * Modelo: mapa chave→condição (persistido em odontogramJson / LEDI odontograma).
 * Chaves: dente FDI | Q1–Q4 | S1–S6 | BOCA.
 * Spec própria SIGS — não copia enums/UI do e-SUS.
 *
 * Gap LEDI: Thrift FAO ProcedimentoQuantidadeThrift só leva coMsProcedimento+quantidade;
 * tooth/region seguem no careJson e no payload mapper (não no XML Thrift oficial).
 */

/** Dentição permanente FDI (1x–4x). */
export const FDI_PERMANENT: readonly string[] = [
  '18', '17', '16', '15', '14', '13', '12', '11',
  '21', '22', '23', '24', '25', '26', '27', '28',
  '38', '37', '36', '35', '34', '33', '32', '31',
  '41', '42', '43', '44', '45', '46', '47', '48',
];

/** Dentição decídua FDI (5x–8x). */
export const FDI_DECIDUOUS: readonly string[] = [
  '55', '54', '53', '52', '51',
  '61', '62', '63', '64', '65',
  '75', '74', '73', '72', '71',
  '81', '82', '83', '84', '85',
];

export const FDI_ALL: readonly string[] = [...FDI_PERMANENT, ...FDI_DECIDUOUS];

/** Quadrantes FDI (1–4). */
export const ODONTOGRAM_QUADRANTS = [
  { code: 'Q1', label: 'Q1 — superior direito' },
  { code: 'Q2', label: 'Q2 — superior esquerdo' },
  { code: 'Q3', label: 'Q3 — inferior esquerdo' },
  { code: 'Q4', label: 'Q4 — inferior direito' },
] as const;

/** Sextantes periodontais (1–6). */
export const ODONTOGRAM_SEXTANTS = [
  { code: 'S1', label: 'S1 — superior direito' },
  { code: 'S2', label: 'S2 — superior anterior' },
  { code: 'S3', label: 'S3 — superior esquerdo' },
  { code: 'S4', label: 'S4 — inferior esquerdo' },
  { code: 'S5', label: 'S5 — inferior anterior' },
  { code: 'S6', label: 'S6 — inferior direito' },
] as const;

export const ODONTOGRAM_MOUTH = { code: 'BOCA', label: 'Boca (toda)' } as const;

export const ODONTOGRAM_SCOPE_CODES: readonly string[] = [
  ...ODONTOGRAM_QUADRANTS.map((q) => q.code),
  ...ODONTOGRAM_SEXTANTS.map((s) => s.code),
  ODONTOGRAM_MOUTH.code,
];

const FDI_SET = new Set(FDI_ALL);
const SCOPE_SET = new Set(ODONTOGRAM_SCOPE_CODES);

/** Arcadas para render (ordem clínica esquerda→direita do operador). */
export const ODONTOGRAM_ARCHES = {
  upperPermanent: ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'],
  lowerPermanent: ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'],
  upperDeciduous: ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'],
  lowerDeciduous: ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'],
} as const;

/**
 * Condições por dente/escopo (código curto estável no care/LEDI).
 * Ausência de chave = sem marcação neste atendimento.
 */
export const ODONTOGRAM_CONDITIONS = [
  { code: 'C', label: 'Cárie' },
  { code: 'R', label: 'Restaurado' },
  { code: 'E', label: 'Extraído / ausente' },
  { code: 'F', label: 'Fraturado' },
  { code: 'S', label: 'Selante' },
  { code: 'T', label: 'Endodontia' },
  { code: 'P', label: 'Prótese / coroa' },
  { code: 'X', label: 'Indicação de extração' },
  { code: 'O', label: 'Outro / observação' },
] as const;

export type OdontogramConditionCode = (typeof ODONTOGRAM_CONDITIONS)[number]['code'];
export type OdontogramScopeCode = (typeof ODONTOGRAM_SCOPE_CODES)[number];

const CONDITION_SET = new Set<string>(ODONTOGRAM_CONDITIONS.map((c) => c.code));

export type OdontogramMap = Record<string, string>;

export type ProcedurePlacement = {
  tooth?: string;
  region?: string;
};

export function isValidFdiTooth(tooth: string): boolean {
  return FDI_SET.has(String(tooth || '').trim());
}

export function isValidOdontogramScope(key: string): boolean {
  return SCOPE_SET.has(String(key || '').trim().toUpperCase());
}

/** Chave válida no mapa: dente FDI ou escopo Q/S/BOCA. */
export function isValidOdontogramKey(key: string): boolean {
  const k = String(key || '').trim();
  if (!k) return false;
  return isValidFdiTooth(k) || isValidOdontogramScope(k);
}

export function isValidOdontogramCondition(code: string): boolean {
  return CONDITION_SET.has(String(code || '').trim().toUpperCase());
}

/**
 * Normaliza seleção da UI/ficha → tooth (FDI) ou region (Q/S/BOCA) para procedimento.
 * Escopos e dentes são mutuamente exclusivos no placement.
 */
export function procedurePlacementFromKey(key: string | null | undefined): ProcedurePlacement {
  const k = String(key || '').trim();
  if (!k) return {};
  if (isValidFdiTooth(k)) return { tooth: k };
  const scope = k.toUpperCase();
  if (isValidOdontogramScope(scope)) return { region: scope };
  return {};
}

/** Reconstitui chave de seleção a partir de procedimento persistido. */
export function selectionKeyFromProcedure(p: {
  tooth?: string | null;
  region?: string | null;
}): string {
  const tooth = String(p.tooth || '').trim();
  if (isValidFdiTooth(tooth)) return tooth;
  const region = String(p.region || '').trim().toUpperCase();
  if (isValidOdontogramScope(region)) return region;
  return tooth || '11';
}

/**
 * Normaliza mapa chave→condição (FDI / Q / S / BOCA).
 * Chaves/códigos inválidos → Error (mensagem para BadRequest na API).
 * Valores vazios são omitidos.
 */
export function normalizeOdontogram(raw: unknown): OdontogramMap {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('odontograma deve ser objeto { denteFDI|Qn|Sn|BOCA: condição }');
  }
  const out: OdontogramMap = {};
  const errors: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const rawKey = String(key).trim();
    if (value == null || value === '') continue;
    const code = String(value).trim().toUpperCase();
    if (!code) continue;
    const mapKey = isValidFdiTooth(rawKey)
      ? rawKey
      : isValidOdontogramScope(rawKey)
        ? rawKey.toUpperCase()
        : null;
    if (!mapKey) {
      errors.push(`chave inválida: ${rawKey}`);
      continue;
    }
    if (!isValidOdontogramCondition(code)) {
      errors.push(`condição inválida em ${mapKey}: ${code}`);
      continue;
    }
    out[mapKey] = code;
  }
  if (errors.length) {
    throw new Error(`odontograma: ${errors.slice(0, 8).join('; ')}`);
  }
  return out;
}

export function odontogramMarkedCount(map: OdontogramMap): number {
  return Object.keys(map).length;
}

export function odontogramCatalog() {
  return {
    conditions: ODONTOGRAM_CONDITIONS.map((c) => ({ code: c.code, label: c.label })),
    scopes: {
      quadrants: ODONTOGRAM_QUADRANTS.map((q) => ({ code: q.code, label: q.label })),
      sextants: ODONTOGRAM_SEXTANTS.map((s) => ({ code: s.code, label: s.label })),
      mouth: { code: ODONTOGRAM_MOUTH.code, label: ODONTOGRAM_MOUTH.label },
    },
    arches: {
      upperPermanent: [...ODONTOGRAM_ARCHES.upperPermanent],
      lowerPermanent: [...ODONTOGRAM_ARCHES.lowerPermanent],
      upperDeciduous: [...ODONTOGRAM_ARCHES.upperDeciduous],
      lowerDeciduous: [...ODONTOGRAM_ARCHES.lowerDeciduous],
    },
    fdiPermanent: [...FDI_PERMANENT],
    fdiDeciduous: [...FDI_DECIDUOUS],
    note:
      'RF-12.12: marcação por dente (FDI), quadrante (Q1–Q4), sextante (S1–S6) e boca. ' +
      'Procedimento SIGTAP usa tooth (FDI) ou region (escopo). ' +
      'Gap: Thrift FAO oficial não serializa tooth/region — ficam no careJson/mapper. Histórico e procedimentos predefinidos (RF-12.13) depois.',
  };
}
