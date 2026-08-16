/**
 * Catálogo vacinação — IDs LEDI do dicionário oficial (integracao.esusab).
 * Seed versionado (99 imunobiológicos) + overlays de sync municipal
 * (POST /v1/catalog/vaccination/sync → Prisma + memória).
 * Faixa etária: seed PNI aproximado; dump TB_FAIXA_ETARIA_VACINACAO não está no repo.
 */

export type { AgeRange, CatalogOpt } from './catalog.types';
export {
  AGE_RANGES_SEED,
  AGE_SEED_META,
  CATALOG_VERSION,
  IMMUNOBIOLOGICALS_SEED,
  IMMUNO_SEED_META,
} from './catalog.seed';

import type { AgeRange, CatalogOpt } from './catalog.types';
import {
  AGE_RANGES_SEED,
  CATALOG_VERSION,
  IMMUNOBIOLOGICALS_SEED,
} from './catalog.seed';

export type VaccineApplicationInput = {
  immunobiologicalId: string;
  strategyId: string;
  doseId: string;
  attendanceGroupId: string;
  lot: string;
  manufacturer: string;
  routeId: string;
  siteId: string;
  /** Validade do lote (ISO date) — RF-14.14 parcial */
  lotExpiry?: string;
  /** Preenchido pelo serviço quando baixa estoque (auditoria) */
  stockLotId?: string;
  prescriberCbo?: string;
  indicationCid10?: string;
  leprosyContact?: boolean;
  isClinicalResearch?: boolean;
  anvisaStudyProtocol?: string;
  anvisaProtocolVersion?: string;
  anvisaRegistrationNumber?: string;
  appliedAbroad?: boolean;
};

/** @deprecated use getImmunobiologicals() — mantido para imports existentes */
export let IMMUNOBIOLOGICALS: CatalogOpt[] = [...IMMUNOBIOLOGICALS_SEED];

/** Overlay municipal (sync). */
let immunoOverlay: CatalogOpt[] = [];
let ageRangeOverlay: AgeRange[] = [];

/** EstrategiaVacinacaoDbEnum (model-5.5.24) */
export const STRATEGIES: CatalogOpt[] = [
  { id: 'ROUTINE', label: 'Rotina', lediId: 1 },
  { id: 'SPECIAL', label: 'Especial', lediId: 2 },
  { id: 'BLOCK', label: 'Bloqueio', lediId: 3 },
  { id: 'INTENSIFICATION', label: 'Intensificação', lediId: 4 },
  { id: 'CAMPAIGN', label: 'Campanha indiscriminada', lediId: 5 },
  { id: 'CAMPAIGN_SELECTIVE', label: 'Campanha seletiva', lediId: 6 },
  { id: 'SEROTHERAPY', label: 'Soroterapia', lediId: 7 },
  { id: 'PRIVATE', label: 'Serviço privado', lediId: 8 },
  { id: 'MEV', label: 'MEV', lediId: 9 },
  { id: 'MULTIVACCINATION', label: 'Multivacinação', lediId: 10 },
  { id: 'RESEARCH', label: 'Pesquisa', lediId: 11 },
  { id: 'PRE_EXPOSURE', label: 'Pré-exposição', lediId: 12 },
  { id: 'POST_EXPOSURE', label: 'Pós-exposição', lediId: 13 },
  { id: 'REEXPOSURE', label: 'Reexposição', lediId: 14 },
  { id: 'SCHOOL', label: 'Vacinação escolar', lediId: 15 },
];

/**
 * Doses — dicionário LEDI (subconjunto APS + profilaxia frequente).
 * IDs amigáveis estáveis; lediId = código oficial.
 */
export const DOSES: CatalogOpt[] = [
  { id: 'D1', label: '1ª dose', lediId: 1 },
  { id: 'D2', label: '2ª dose', lediId: 2 },
  { id: 'D3', label: '3ª dose', lediId: 3 },
  { id: 'D4', label: '4ª dose', lediId: 4 },
  { id: 'D5', label: '5ª dose', lediId: 5 },
  { id: 'R1', label: '1º reforço', lediId: 6 },
  { id: 'R2', label: '2º reforço', lediId: 7 },
  { id: 'D', label: 'Dose', lediId: 8 },
  { id: 'DU', label: 'Dose única', lediId: 9 },
  { id: 'REV', label: 'Revacinação', lediId: 10 },
  { id: 'DI', label: 'Dose inicial', lediId: 36 },
  { id: 'DA', label: 'Dose adicional', lediId: 37 },
  { id: 'REF', label: 'Reforço', lediId: 38 },
  { id: 'R3', label: '3º reforço', lediId: 39 },
  { id: 'D0', label: 'Dose zero', lediId: 57 },
  { id: 'PT1', label: 'Profilaxia/Tratamento 1 unidade', lediId: 59 },
  { id: 'PT2', label: 'Profilaxia/Tratamento 2 unidades', lediId: 60 },
];

/**
 * Via de administração — seed TB_VIA_ADM_VACINA (ids estáveis CDS).
 * 1 Oral · 2 IM · 3 SC · 4 ID
 */
export const ROUTES: CatalogOpt[] = [
  { id: 'ORAL', label: 'Oral', lediId: 1 },
  { id: 'IM', label: 'Intramuscular', lediId: 2 },
  { id: 'SC', label: 'Subcutânea', lediId: 3 },
  { id: 'ID', label: 'Intradérmica', lediId: 4 },
];

/**
 * Local de aplicação — seed TB_LOCAL_APLICACAO_VACINA.
 * 1 Deltoide E · 2 Deltoide D · 3 Vasto lateral · 4 Oral / N/A
 */
export const SITES: CatalogOpt[] = [
  { id: 'LD', label: 'Deltoide esquerdo', lediId: 1 },
  { id: 'RD', label: 'Deltoide direito', lediId: 2 },
  { id: 'VL', label: 'Vasto lateral da coxa', lediId: 3 },
  { id: 'ORAL', label: 'Oral / não se aplica', lediId: 4 },
];

/** Grupo de atendimento — seed mínimo (expandir com sync municipal). */
export const ATTENDANCE_GROUPS: CatalogOpt[] = [
  { id: 'GERAL', label: 'Geral', lediId: 1 },
  { id: 'GESTANTE', label: 'Gestante', lediId: 2 },
  { id: 'PUERPERA', label: 'Puérpera', lediId: 3 },
];

const LOT_CHARSET = /^[A-Za-z0-9.\-\/ ]{1,30}$/;

function byId<T extends { id: string }>(list: readonly T[], id: string): T | undefined {
  return list.find((x) => x.id === id);
}

function mergeById(seed: CatalogOpt[], overlay: CatalogOpt[]): CatalogOpt[] {
  const map = new Map<string, CatalogOpt>();
  for (const row of seed) map.set(row.id, row);
  for (const row of overlay) map.set(row.id, row);
  return [...map.values()].sort((a, b) => a.lediId - b.lediId);
}

export function getImmunobiologicals(): CatalogOpt[] {
  IMMUNOBIOLOGICALS = mergeById(IMMUNOBIOLOGICALS_SEED, immunoOverlay);
  return IMMUNOBIOLOGICALS;
}

export function getAgeRanges(): AgeRange[] {
  if (!ageRangeOverlay.length) return AGE_RANGES_SEED;
  return [...AGE_RANGES_SEED, ...ageRangeOverlay];
}

export function getImmunoOverlay(): CatalogOpt[] {
  return [...immunoOverlay];
}

export function getAgeRangeOverlay(): AgeRange[] {
  return [...ageRangeOverlay];
}

export type CatalogSyncInput = {
  immunobiologicals?: CatalogOpt[];
  ageRanges?: AgeRange[];
  /** true = limpa overlays e volta ao seed */
  reset?: boolean;
};

export function syncCatalog(input: CatalogSyncInput = {}): {
  immunobiologicals: number;
  ageRanges: number;
  source: string;
  catalogVersion: string;
} {
  if (input.reset) {
    immunoOverlay = [];
    ageRangeOverlay = [];
  }
  if (input.immunobiologicals?.length) {
    for (const row of input.immunobiologicals) {
      if (!row.id || typeof row.lediId !== 'number') continue;
      immunoOverlay = immunoOverlay.filter((x) => x.id !== row.id);
      immunoOverlay.push({
        id: row.id,
        label: row.label || row.id,
        code: row.code,
        lediId: row.lediId,
      });
    }
  }
  if (input.ageRanges?.length) {
    ageRangeOverlay = [...ageRangeOverlay, ...input.ageRanges];
  }
  getImmunobiologicals();
  return {
    immunobiologicals: getImmunobiologicals().length,
    ageRanges: getAgeRanges().length,
    source: immunoOverlay.length || ageRangeOverlay.length ? 'seed+overlay' : 'ledi-dictionary-seed',
    catalogVersion: CATALOG_VERSION,
  };
}

/** Substitui overlays em memória (ex.: hidratação a partir do Prisma). */
export function replaceOverlays(input: {
  immunobiologicals?: CatalogOpt[];
  ageRanges?: AgeRange[];
}): void {
  immunoOverlay = input.immunobiologicals ? [...input.immunobiologicals] : [];
  ageRangeOverlay = input.ageRanges ? [...input.ageRanges] : [];
  getImmunobiologicals();
}

/** Estoque/frio + almox vacinal leve — RF-14.3–6 / 15–19 (sem IoT). */
export const STOCK_MVP = {
  status: 'beyond-mvp' as const,
  rf: [
    'RF-14.3',
    'RF-14.4',
    'RF-14.5',
    'RF-14.6',
    'RF-14.15',
    'RF-14.16',
    'RF-14.17',
    'RF-14.18',
    'RF-14.19',
  ],
  features: {
    lotQuantityUnit: true,
    expiry: true,
    targetTempRangeC: true,
    applyDecrementWhenStockExists: true,
    voidRestoreQuantity: true,
    coldEquipmentRegistry: true,
    thermalBoxRegistry: true,
    manualTempReadings: true,
    supplyLinksAndConsume: true,
    stockLotColdEquipmentLink: true,
  },
  notIncluded: [
    'Monitoramento contínuo de geladeira (sensores/IoT)',
    'Alarmes e gráficos de temperatura em tempo real',
    'Almoxarifado farmacêutico geral / farmácia municipal',
    'Transferência entre salas/unidades',
  ],
  note:
    'Lote + validade + qty + equipamento frio + caixa térmica + leitura manual °C + insumos leves (seringas etc.) vinculados ao imuno. Baixa estoque/insumos no create; void devolve. Sem IoT.',
};

/** @deprecated use STOCK_MVP */
export const STOCK_STUB = STOCK_MVP;

export const COLD_EQUIPMENT_KINDS = [
  { id: 'REFRIGERATOR', label: 'Geladeira' },
  { id: 'FREEZER', label: 'Freezer' },
  { id: 'COLD_ROOM', label: 'Câmara fria' },
] as const;

export const COLD_EQUIPMENT_STATUSES = [
  { id: 'ACTIVE', label: 'Ativo' },
  { id: 'MAINTENANCE', label: 'Manutenção' },
  { id: 'INACTIVE', label: 'Inativo' },
] as const;

export const THERMAL_BOX_STATUSES = [
  { id: 'AVAILABLE', label: 'Disponível' },
  { id: 'IN_USE', label: 'Em uso' },
  { id: 'MAINTENANCE', label: 'Manutenção' },
] as const;

export function resolveImmunoLediId(id: string): number | null {
  return byId(getImmunobiologicals(), id)?.lediId ?? null;
}

export function resolveStrategyLediId(id: string): number | null {
  return byId(STRATEGIES, id)?.lediId ?? null;
}

export function resolveDoseLediId(id: string): number | null {
  return byId(DOSES, id)?.lediId ?? null;
}

export function resolveRouteLediId(id: string): number | null {
  return byId(ROUTES, id)?.lediId ?? null;
}

export function resolveSiteLediId(id: string): number | null {
  return byId(SITES, id)?.lediId ?? null;
}

export function resolveAttendanceGroupLediId(id: string): number | null {
  return byId(ATTENDANCE_GROUPS, id)?.lediId ?? null;
}

export function ageInDays(birthDate: Date, at: Date): number {
  const ms = at.getTime() - birthDate.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function lookupAgeRange(
  immunobiologicalId: string,
  strategyId?: string,
): AgeRange | undefined {
  const ranges = getAgeRanges().filter((r) => r.immunobiologicalId === immunobiologicalId);
  if (!ranges.length) return undefined;
  if (strategyId) {
    const exact = ranges.find((r) => r.strategyId === strategyId);
    if (exact) return exact;
  }
  return ranges.find((r) => !r.strategyId) ?? ranges[0];
}

/** RF-14.8 — bloqueia fora da faixa quando houver regra seed/overlay. */
export function validateAgeForApplications(
  apps: VaccineApplicationInput[],
  birthDate: Date,
  appliedAt: Date,
): string[] {
  const errors: string[] = [];
  const days = ageInDays(birthDate, appliedAt);
  if (days < 0) {
    errors.push('data de nascimento não pode ser após a aplicação');
    return errors;
  }
  for (const [i, app] of apps.entries()) {
    const range = lookupAgeRange(app.immunobiologicalId, app.strategyId);
    if (!range) continue;
    const prefix = `applications[${i}]`;
    if (days < range.minDays) {
      errors.push(
        `${prefix}: idade ${days}d abaixo do mínimo (${range.minDays}d) — ${range.label}`,
      );
    }
    if (range.maxDays != null && days > range.maxDays) {
      errors.push(
        `${prefix}: idade ${days}d acima do máximo (${range.maxDays}d) — ${range.label}`,
      );
    }
  }
  return errors;
}

export function validateVaccineApplications(apps: VaccineApplicationInput[]): string[] {
  const errors: string[] = [];
  const immunos = getImmunobiologicals();
  if (!apps.length) errors.push('ao menos uma aplicação é obrigatória');
  if (apps.length > 99) errors.push('máximo 99 aplicações por ficha');

  const keys = new Set<string>();
  for (const [i, app] of apps.entries()) {
    const prefix = `applications[${i}]`;
    if (!app.immunobiologicalId) errors.push(`${prefix}.immunobiologicalId obrigatório`);
    else if (!byId(immunos, app.immunobiologicalId)) {
      errors.push(`${prefix}.immunobiologicalId inválido`);
    }
    if (!app.strategyId) errors.push(`${prefix}.strategyId obrigatório após imunobiológico`);
    else if (!byId(STRATEGIES, app.strategyId)) {
      errors.push(`${prefix}.strategyId inválido`);
    }
    if (!app.doseId) errors.push(`${prefix}.doseId obrigatório`);
    else if (!byId(DOSES, app.doseId)) errors.push(`${prefix}.doseId inválido`);
    if (!app.attendanceGroupId) errors.push(`${prefix}.attendanceGroupId obrigatório`);
    else if (!byId(ATTENDANCE_GROUPS, app.attendanceGroupId)) {
      errors.push(`${prefix}.attendanceGroupId inválido`);
    }
    if (!app.lot || !LOT_CHARSET.test(app.lot)) {
      errors.push(`${prefix}.lot inválido (charset/tamanho)`);
    }
    if (!app.manufacturer) errors.push(`${prefix}.manufacturer obrigatório`);
    if (!app.routeId) errors.push(`${prefix}.routeId obrigatório`);
    else if (!byId(ROUTES, app.routeId)) errors.push(`${prefix}.routeId inválido`);
    if (!app.siteId) errors.push(`${prefix}.siteId obrigatório`);
    else if (!byId(SITES, app.siteId)) errors.push(`${prefix}.siteId inválido`);
    if (app.lotExpiry) {
      const exp = new Date(app.lotExpiry);
      if (Number.isNaN(exp.getTime())) errors.push(`${prefix}.lotExpiry inválida`);
    }

    if (app.strategyId === 'SPECIAL') {
      if (!app.prescriberCbo?.trim()) errors.push(`${prefix}.prescriberCbo obrigatório (Estratégia Especial)`);
      if (!app.indicationCid10?.trim()) errors.push(`${prefix}.indicationCid10 obrigatório (Estratégia Especial)`);
    }

    if (app.immunobiologicalId === 'BCG' && typeof app.leprosyContact !== 'boolean') {
      errors.push(`${prefix}.leprosyContact obrigatório para BCG`);
    }

    if (app.strategyId === 'RESEARCH' || app.isClinicalResearch) {
      if (!app.anvisaStudyProtocol?.trim()) errors.push(`${prefix}.anvisaStudyProtocol obrigatório (pesquisa)`);
      if (!app.anvisaProtocolVersion?.trim()) errors.push(`${prefix}.anvisaProtocolVersion obrigatório (pesquisa)`);
      if (!app.anvisaRegistrationNumber?.trim()) {
        errors.push(`${prefix}.anvisaRegistrationNumber obrigatório (pesquisa)`);
      }
    }

    const dupKey = `${app.immunobiologicalId}|${app.strategyId}|${app.doseId}|${app.lot}`;
    if (keys.has(dupKey)) errors.push(`${prefix} duplicada na ficha`);
    keys.add(dupKey);
  }
  return errors;
}
