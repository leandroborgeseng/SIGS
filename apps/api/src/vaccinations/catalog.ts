/**
 * Catálogo vacinação — IDs LEDI do dicionário oficial (integracao.esusab / regras vacinação).
 * Seed expandido + overlays de sync municipal (POST /v1/catalog/vaccination/sync).
 * Faixa etária: seed municipal aproximado (calendário básico); sync completo = TB_FAIXA_ETARIA_VACINACAO.
 */

export type CatalogOpt = {
  id: string;
  label: string;
  code?: string;
  /** id numérico LEDI / CDS (i64 Thrift) */
  lediId: number;
};

/** Faixa etária em dias de vida (RF-14.7/14.8). null = sem limite. */
export type AgeRange = {
  immunobiologicalId: string;
  /** Estratégia; omitida = qualquer */
  strategyId?: string;
  minDays: number;
  maxDays: number | null;
  label: string;
};

/** Imunobiológicos APS frequentes — códigos LEDI do dicionário de dados. */
export const IMMUNOBIOLOGICALS_SEED: CatalogOpt[] = [
  { id: 'HB', code: 'HB', label: 'Hepatite B', lediId: 9 },
  { id: 'FA', code: 'VFA', label: 'Febre amarela', lediId: 14 },
  { id: 'BCG', code: 'BCG', label: 'BCG', lediId: 15 },
  { id: 'HIB', code: 'Hib', label: 'Hib', lediId: 17 },
  { id: 'PNEUMO23', code: 'VPP23', label: 'Pneumo 23', lediId: 21 },
  { id: 'VIP', code: 'VIP', label: 'Poliomielite VIP (injetável)', lediId: 22 },
  { id: 'SCR', code: 'SCR', label: 'Tríplice viral (SCR)', lediId: 24 },
  { id: 'DT', code: 'dT', label: 'dT (adulto)', lediId: 25 },
  { id: 'VPC10', code: 'VPC10', label: 'Pneumo 10', lediId: 26 },
  { id: 'VOPB', code: 'VOPb', label: 'Polio oral bivalente (VOPb)', lediId: 28 },
  { id: 'INF3', code: 'INF3', label: 'Influenza trivalente', lediId: 33 },
  { id: 'VZ', code: 'VZ', label: 'Varicela', lediId: 34 },
  { id: 'HA', code: 'HA', label: 'Hepatite A', lediId: 35 },
  { id: 'MENC', code: 'MenC', label: 'Meningo C', lediId: 41 },
  { id: 'PENTA', code: 'PENTA', label: 'Penta (DTP/HepB/Hib)', lediId: 42 },
  { id: 'HEXA', code: 'Hexa', label: 'Hexa acelular', lediId: 43 },
  { id: 'ROTA', code: 'ROTA', label: 'Rotavírus', lediId: 45 },
  { id: 'DTP', code: 'DTP', label: 'DTP', lediId: 46 },
  { id: 'SCRV', code: 'SCRV', label: 'Tetra viral (SCRV)', lediId: 56 },
  { id: 'DTPA', code: 'dTpa', label: 'dTpa adulto', lediId: 57 },
  { id: 'VPC13', code: 'VPC13', label: 'Pneumo 13', lediId: 59 },
  { id: 'HPV4', code: 'HPV4', label: 'HPV quadrivalente', lediId: 67 },
  { id: 'INF4', code: 'INF4', label: 'Influenza tetravalente', lediId: 77 },
  { id: 'MENACWY', code: 'MenACWY', label: 'Meningo ACWY', lediId: 74 },
  { id: 'COVID_CORONAVAC', code: 'COVID-19 CORONAVAC', label: 'COVID-19 Coronavac', lediId: 86 },
  { id: 'COVID', code: 'COVID-19 PFIZER', label: 'COVID-19 RNAm Pfizer (Comirnaty)', lediId: 87 },
  { id: 'COVID_PED', code: 'COVID-19 PFIZER PED', label: 'COVID-19 Pfizer pediátrica', lediId: 99 },
  { id: 'DENGUE', code: 'DNG', label: 'Dengue (atenuada)', lediId: 104 },
];

/** @deprecated use getImmunobiologicals() — mantido para imports existentes */
export let IMMUNOBIOLOGICALS: CatalogOpt[] = [...IMMUNOBIOLOGICALS_SEED];

/** Overlay municipal (sync). */
let immunoOverlay: CatalogOpt[] = [];
let ageRangeOverlay: AgeRange[] = [];

/**
 * Faixas seed (dias de vida) — calendário básico PNI / RF-14.7.
 * Não substitui lookupFaixaEtaria(imuno, estratégia, dose) do e-SUS; sync DB depois.
 */
export const AGE_RANGES_SEED: AgeRange[] = [
  { immunobiologicalId: 'BCG', minDays: 0, maxDays: 365 * 5, label: 'BCG: 0–5 anos (catch-up básico)' },
  { immunobiologicalId: 'HB', minDays: 0, maxDays: null, label: 'Hepatite B: desde o nascimento' },
  { immunobiologicalId: 'ROTA', minDays: 42, maxDays: 245, label: 'Rotavírus: ~6 sem–8 meses' },
  { immunobiologicalId: 'PENTA', minDays: 60, maxDays: 365 * 7, label: 'Penta: ~2 meses–7 anos' },
  { immunobiologicalId: 'HEXA', minDays: 60, maxDays: 365 * 7, label: 'Hexa: ~2 meses–7 anos' },
  { immunobiologicalId: 'VIP', minDays: 60, maxDays: null, label: 'VIP: a partir de ~2 meses' },
  { immunobiologicalId: 'VOPB', minDays: 60, maxDays: 365 * 5, label: 'VOPb: ~2 meses–5 anos' },
  { immunobiologicalId: 'VPC10', minDays: 60, maxDays: 365 * 5, label: 'Pneumo 10: ~2 meses–5 anos' },
  { immunobiologicalId: 'MENC', minDays: 90, maxDays: null, label: 'Meningo C: a partir de ~3 meses' },
  { immunobiologicalId: 'SCR', minDays: 365, maxDays: null, label: 'SCR: a partir de 12 meses' },
  { immunobiologicalId: 'SCRV', minDays: 365, maxDays: null, label: 'SCRV: a partir de 12 meses' },
  { immunobiologicalId: 'VZ', minDays: 365, maxDays: null, label: 'Varicela: a partir de 12 meses' },
  { immunobiologicalId: 'HA', minDays: 365, maxDays: null, label: 'Hepatite A: a partir de 12 meses' },
  { immunobiologicalId: 'FA', minDays: 274, maxDays: null, label: 'Febre amarela: a partir de ~9 meses' },
  { immunobiologicalId: 'DT', minDays: 365 * 7, maxDays: null, label: 'dT: a partir de 7 anos' },
  { immunobiologicalId: 'DTPA', minDays: 365 * 7, maxDays: null, label: 'dTpa: a partir de 7 anos' },
  { immunobiologicalId: 'HPV4', minDays: 365 * 9, maxDays: 365 * 15, label: 'HPV4: 9–14 anos (rotina seed)' },
  { immunobiologicalId: 'PNEUMO23', minDays: 365 * 60, maxDays: null, label: 'Pneumo 23: ≥60 anos (rotina seed)' },
  { immunobiologicalId: 'INF3', minDays: 180, maxDays: null, label: 'Influenza: a partir de 6 meses' },
  { immunobiologicalId: 'INF4', minDays: 180, maxDays: null, label: 'Influenza tetra: a partir de 6 meses' },
  { immunobiologicalId: 'COVID', minDays: 365 * 5, maxDays: null, label: 'COVID Pfizer: ≥5 anos (seed)' },
  { immunobiologicalId: 'COVID_PED', minDays: 180, maxDays: 365 * 5 - 1, label: 'COVID pediátrica: 6 meses–<5 anos (seed)' },
  { immunobiologicalId: 'COVID_CORONAVAC', minDays: 365 * 3, maxDays: null, label: 'Coronavac: ≥3 anos (seed)' },
  { immunobiologicalId: 'DENGUE', minDays: 365 * 4, maxDays: 365 * 60, label: 'Dengue: 4–59 anos (seed)' },
];

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

/** Doses — IDs da documentação LEDI (regras vacinação). */
export const DOSES: CatalogOpt[] = [
  { id: 'D1', label: '1ª dose', lediId: 1 },
  { id: 'D2', label: '2ª dose', lediId: 2 },
  { id: 'D3', label: '3ª dose', lediId: 3 },
  { id: 'R1', label: '1º reforço', lediId: 6 },
  { id: 'R2', label: '2º reforço', lediId: 7 },
  { id: 'D', label: 'Dose', lediId: 8 },
  { id: 'DU', label: 'Dose única', lediId: 9 },
  { id: 'REV', label: 'Revacinação', lediId: 10 },
  { id: 'REF', label: 'Reforço', lediId: 38 },
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
  prescriberCbo?: string;
  indicationCid10?: string;
  leprosyContact?: boolean;
  isClinicalResearch?: boolean;
  anvisaStudyProtocol?: string;
  anvisaProtocolVersion?: string;
  anvisaRegistrationNumber?: string;
  appliedAbroad?: boolean;
};

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
  };
}

/** Estoque/frio adiado — stub RF-14.3–6 / 15–19 */
export const STOCK_STUB = {
  status: 'deferred' as const,
  rf: ['RF-14.3', 'RF-14.4', 'RF-14.5', 'RF-14.6', 'RF-14.15', 'RF-14.16', 'RF-14.17', 'RF-14.18', 'RF-14.19'],
  note: 'Estoque em salas, rede de frio, caixa térmica e temperatura — fora desta fatia (stub).',
};

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
