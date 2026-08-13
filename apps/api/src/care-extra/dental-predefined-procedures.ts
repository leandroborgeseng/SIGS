/**
 * Catálogo SIGS de procedimentos predefinidos no odontograma (RF-12.13).
 * Códigos SIGTAP 10 dígitos usados em FAO/Previne B1–B6 e no seed APS.
 * Spec própria — não copia listas/UI do e-SUS.
 *
 * Escopos: tooth (FDI) · quadrant (Q1–Q4) · sextant (S1–S6) · mouth (BOCA) · encounter (sem dente).
 * Só procedimentos com `done !== false` entram em procedimentosRealizados no LEDI.
 */

import {
  isValidFdiTooth,
  isValidOdontogramScope,
  procedurePlacementFromKey,
  type ProcedurePlacement,
} from './dental-odontogram';
import type { DentalProcedureInput } from './ledi-dental.mapper';

export type OdontogramProcScope =
  | 'tooth'
  | 'quadrant'
  | 'sextant'
  | 'mouth'
  | 'encounter';

export type PrevineBucalTag = 'B1' | 'B3' | 'B5' | 'B6';

export type PredefinedDentalProcedure = {
  code: string;
  label: string;
  group: 'consulta' | 'preventivo' | 'restaurador' | 'cirurgico';
  scopes: readonly OdontogramProcScope[];
  previne?: PrevineBucalTag;
};

export const PREDEFINED_DENTAL_PROCEDURES: readonly PredefinedDentalProcedure[] = [
  {
    code: '0301010153',
    label: '1ª consulta odontológica programada',
    group: 'consulta',
    scopes: ['encounter'],
    previne: 'B1',
  },
  {
    code: '0101020010',
    label: 'Consulta odontológica',
    group: 'consulta',
    scopes: ['encounter'],
  },
  {
    code: '0101020104',
    label: 'Orientação de higiene bucal',
    group: 'preventivo',
    scopes: ['mouth', 'encounter'],
    previne: 'B5',
  },
  {
    code: '0101020074',
    label: 'Aplicação de flúor',
    group: 'preventivo',
    scopes: ['mouth', 'sextant'],
    previne: 'B5',
  },
  {
    code: '0101020082',
    label: 'Evidenciação de placa bacteriana',
    group: 'preventivo',
    scopes: ['mouth'],
    previne: 'B5',
  },
  {
    code: '0101020066',
    label: 'Selante de fóssulas e fissuras',
    group: 'preventivo',
    scopes: ['tooth'],
    previne: 'B5',
  },
  {
    code: '0101020058',
    label: 'Aplicação de cariostático',
    group: 'preventivo',
    scopes: ['tooth'],
    previne: 'B5',
  },
  {
    code: '0101020090',
    label: 'Selamento provisório de cavidade',
    group: 'preventivo',
    scopes: ['tooth'],
  },
  {
    code: '0307030040',
    label: 'Profilaxia / raspagem coronária',
    group: 'preventivo',
    scopes: ['mouth', 'sextant'],
    previne: 'B5',
  },
  {
    code: '0307010015',
    label: 'Restauração de dente permanente anterior',
    group: 'restaurador',
    scopes: ['tooth'],
    previne: 'B6',
  },
  {
    code: '0307010031',
    label: 'Restauração de dente permanente posterior',
    group: 'restaurador',
    scopes: ['tooth'],
    previne: 'B6',
  },
  {
    code: '0307010120',
    label: 'Restauração de dente decíduo',
    group: 'restaurador',
    scopes: ['tooth'],
    previne: 'B6',
  },
  {
    code: '0307010074',
    label: 'Restauração ART / TRA',
    group: 'restaurador',
    scopes: ['tooth'],
    previne: 'B6',
  },
  {
    code: '0414020138',
    label: 'Exodontia de dente permanente',
    group: 'cirurgico',
    scopes: ['tooth'],
    previne: 'B3',
  },
  {
    code: '0414020146',
    label: 'Exodontia de dente decíduo',
    group: 'cirurgico',
    scopes: ['tooth'],
    previne: 'B3',
  },
] as const;

const BY_CODE = new Map(PREDEFINED_DENTAL_PROCEDURES.map((p) => [p.code, p]));

export function predefinedDentalCatalog() {
  return {
    procedures: PREDEFINED_DENTAL_PROCEDURES.map((p) => ({
      code: p.code,
      label: p.label,
      group: p.group,
      scopes: [...p.scopes],
      previne: p.previne ?? null,
    })),
    note:
      'RF-12.13: catálogo predefinido no odontograma. Marque concluído para ir à FAO (procedimentosRealizados). ' +
      'Escopo incompatível com a seleção (dente/Q/S/BOCA) é rejeitado. Códigos SIGTAP livres (10 dígitos) ainda são aceitos.',
  };
}

export function lookupPredefinedProcedure(code: string): PredefinedDentalProcedure | undefined {
  return BY_CODE.get(normSigtapCode(code));
}

export function normSigtapCode(code: unknown): string {
  return String(code ?? '').replace(/\D/g, '');
}

export function scopeFromSelectionKey(key: string | null | undefined): OdontogramProcScope | null {
  const k = String(key || '').trim();
  if (!k) return null;
  if (isValidFdiTooth(k)) return 'tooth';
  const u = k.toUpperCase();
  if (/^Q[1-4]$/.test(u)) return 'quadrant';
  if (/^S[1-6]$/.test(u)) return 'sextant';
  if (u === 'BOCA') return 'mouth';
  return null;
}

export function procedureFitsScope(
  item: Pick<PredefinedDentalProcedure, 'scopes'>,
  scope: OdontogramProcScope | null,
): boolean {
  if (item.scopes.includes('encounter') && (scope == null || scope === 'encounter')) return true;
  if (!scope) return item.scopes.includes('encounter');
  return item.scopes.includes(scope);
}

function placementForCatalogItem(
  item: PredefinedDentalProcedure,
  selectionKey: string | null | undefined,
): ProcedurePlacement {
  const encounterOnly = item.scopes.length === 1 && item.scopes[0] === 'encounter';
  if (encounterOnly) return {};

  const scope = scopeFromSelectionKey(selectionKey);
  if (item.scopes.includes('encounter') && !scope) return {};
  if (!procedureFitsScope(item, scope)) {
    const where = scope ? `seleção ${String(selectionKey).toUpperCase()}` : 'sem seleção de dente/escopo';
    throw new Error(
      `procedimento ${item.code} (${item.label}) não se aplica a ${where}; escopos: ${item.scopes.join(', ')}`,
    );
  }
  if (scope === 'tooth' || scope === 'quadrant' || scope === 'sextant' || scope === 'mouth') {
    return procedurePlacementFromKey(selectionKey);
  }
  return {};
}

/** Aplica item do catálogo à seleção do odontograma. Default: planejado (done=false). */
export function applyCatalogProcedure(
  code: string,
  selectionKey?: string | null,
  opts?: { done?: boolean; label?: string },
): DentalProcedureInput {
  const item = lookupPredefinedProcedure(code);
  if (!item) {
    throw new Error(`procedimento predefinido desconhecido: ${normSigtapCode(code) || code}`);
  }
  const placement = placementForCatalogItem(item, selectionKey);
  return {
    ...placement,
    code: item.code,
    label: opts?.label?.trim() || item.label,
    done: opts?.done ?? false,
  };
}

function procedureDedupeKey(p: DentalProcedureInput): string {
  const code = normSigtapCode(p.code);
  const tooth = String(p.tooth || '').trim();
  const region = String(p.region || '').trim().toUpperCase();
  return `${code}|${tooth}|${region}`;
}

export function normalizeDentalProcedure(raw: unknown): DentalProcedureInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('procedimento deve ser objeto { code, label, tooth?, region?, done? }');
  }
  const rec = raw as Record<string, unknown>;
  const code = normSigtapCode(rec.code);
  if (!/^\d{10}$/.test(code)) {
    throw new Error(`código SIGTAP inválido: ${String(rec.code ?? '')}`);
  }
  const catalog = lookupPredefinedProcedure(code);
  const label = String(rec.label ?? catalog?.label ?? '').trim();
  if (!label) throw new Error(`procedimento ${code} sem label`);

  const toothRaw = rec.tooth != null && rec.tooth !== '' ? String(rec.tooth).trim() : '';
  const regionRaw = rec.region != null && rec.region !== '' ? String(rec.region).trim().toUpperCase() : '';
  if (toothRaw && !isValidFdiTooth(toothRaw)) {
    throw new Error(`dente FDI inválido no procedimento ${code}: ${toothRaw}`);
  }
  if (regionRaw && !isValidOdontogramScope(regionRaw)) {
    throw new Error(`região inválida no procedimento ${code}: ${regionRaw}`);
  }
  if (toothRaw && regionRaw) {
    throw new Error(`procedimento ${code}: informe tooth ou region, não ambos`);
  }

  const selectionKey = toothRaw || regionRaw || null;
  const placement = catalog
    ? placementForCatalogItem(catalog, selectionKey)
    : {
        ...(toothRaw ? { tooth: toothRaw } : {}),
        ...(regionRaw ? { region: regionRaw } : {}),
      };

  const done = rec.done === undefined ? undefined : Boolean(rec.done);
  return {
    ...placement,
    code,
    label,
    ...(done === undefined ? {} : { done }),
  };
}

/** Normaliza lista; deduplica por código+local (último ganha, inclusive `done`). */
export function normalizeDentalProcedures(raw: unknown): DentalProcedureInput[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new Error('procedures deve ser lista');
  }
  const map = new Map<string, DentalProcedureInput>();
  const errors: string[] = [];
  for (const item of raw) {
    try {
      const p = normalizeDentalProcedure(item);
      map.set(procedureDedupeKey(p), p);
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  if (errors.length) {
    throw new Error(`procedures: ${errors.slice(0, 8).join('; ')}`);
  }
  return [...map.values()];
}

/** LEDI FAO: só realizados (done omitido = legado, conta como realizado). */
export function realizadosForLedi(procedures: DentalProcedureInput[]): DentalProcedureInput[] {
  return procedures.filter((p) => p.done !== false);
}

export function toggleProcedureDone(
  list: DentalProcedureInput[],
  match: { code: string; tooth?: string; region?: string },
  done: boolean,
): DentalProcedureInput[] {
  const code = normSigtapCode(match.code);
  const tooth = String(match.tooth || '').trim();
  const region = String(match.region || '').trim().toUpperCase();
  return list.map((p) => {
    if (normSigtapCode(p.code) !== code) return p;
    if (String(p.tooth || '').trim() !== tooth) return p;
    if (String(p.region || '').trim().toUpperCase() !== region) return p;
    return { ...p, done };
  });
}
