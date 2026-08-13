/**
 * Odontograma clínico mínimo (RF-12.12 parcial).
 * Modelo: mapa FDI → código de condição (persistido em odontogramJson / LEDI odontograma).
 * Spec própria SIGS — não copia enums/UI do e-SUS.
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

const FDI_SET = new Set(FDI_ALL);

/** Arcadas para render (ordem clínica esquerda→direita do operador). */
export const ODONTOGRAM_ARCHES = {
  upperPermanent: ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'],
  lowerPermanent: ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'],
  upperDeciduous: ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65'],
  lowerDeciduous: ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75'],
} as const;

/**
 * Condições por dente (código curto estável no care/LEDI).
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

const CONDITION_SET = new Set<string>(ODONTOGRAM_CONDITIONS.map((c) => c.code));

export type OdontogramMap = Record<string, string>;

export function isValidFdiTooth(tooth: string): boolean {
  return FDI_SET.has(String(tooth || '').trim());
}

export function isValidOdontogramCondition(code: string): boolean {
  return CONDITION_SET.has(String(code || '').trim().toUpperCase());
}

/**
 * Normaliza mapa FDI→condição.
 * Chaves/códigos inválidos → Error (mensagem para BadRequest na API).
 * Valores vazios são omitidos.
 */
export function normalizeOdontogram(raw: unknown): OdontogramMap {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('odontograma deve ser objeto { denteFDI: condição }');
  }
  const out: OdontogramMap = {};
  const errors: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const tooth = String(key).trim();
    if (value == null || value === '') continue;
    const code = String(value).trim().toUpperCase();
    if (!code) continue;
    if (!isValidFdiTooth(tooth)) {
      errors.push(`dente inválido: ${tooth}`);
      continue;
    }
    if (!isValidOdontogramCondition(code)) {
      errors.push(`condição inválida em ${tooth}: ${code}`);
      continue;
    }
    out[tooth] = code;
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
    arches: {
      upperPermanent: [...ODONTOGRAM_ARCHES.upperPermanent],
      lowerPermanent: [...ODONTOGRAM_ARCHES.lowerPermanent],
      upperDeciduous: [...ODONTOGRAM_ARCHES.upperDeciduous],
      lowerDeciduous: [...ODONTOGRAM_ARCHES.lowerDeciduous],
    },
    fdiPermanent: [...FDI_PERMANENT],
    fdiDeciduous: [...FDI_DECIDUOUS],
    note: 'MVP RF-12.12: marcação por dente (FDI). Quadrante/sextante/boca e histórico entram depois.',
  };
}
