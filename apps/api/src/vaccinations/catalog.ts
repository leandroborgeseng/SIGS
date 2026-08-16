/**
 * Catálogo seed vacinação — IDs LEDI alinhados à documentação oficial
 * (regras imunobiológico×estratégia×dose + EstrategiaVacinacaoDbEnum).
 * Catálogo completo municipal virá de sync/DB; este seed cobre o MVP P5.
 */

export type CatalogOpt = {
  id: string;
  label: string;
  code?: string;
  /** id numérico LEDI / CDS (i64 Thrift) */
  lediId: number;
};

/** Imunobiológicos — IDs da tabela LEDI de regras de vacinação. */
export const IMMUNOBIOLOGICALS: CatalogOpt[] = [
  { id: 'BCG', code: 'BCG', label: 'BCG', lediId: 15 },
  { id: 'HB', code: 'HB', label: 'Hepatite B', lediId: 9 },
  { id: 'PENTA', code: 'PENTA', label: 'Penta (DTP/HepB/Hib)', lediId: 42 },
  { id: 'VIP', code: 'VIP', label: 'Poliomielite VIP (injetável)', lediId: 22 },
  { id: 'SCR', code: 'SCR', label: 'Tríplice viral (SCR)', lediId: 24 },
  { id: 'COVID', code: 'COVID', label: 'COVID-19 (RNAm Pfizer — seed)', lediId: 87 },
  { id: 'FA', code: 'FA', label: 'Febre amarela', lediId: 14 },
  { id: 'PNEUMO23', code: 'PNEUMO23', label: 'Pneumo 23', lediId: 21 },
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

export function resolveImmunoLediId(id: string): number | null {
  return byId(IMMUNOBIOLOGICALS, id)?.lediId ?? null;
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

export function validateVaccineApplications(apps: VaccineApplicationInput[]): string[] {
  const errors: string[] = [];
  if (!apps.length) errors.push('ao menos uma aplicação é obrigatória');
  if (apps.length > 99) errors.push('máximo 99 aplicações por ficha');

  const keys = new Set<string>();
  for (const [i, app] of apps.entries()) {
    const prefix = `applications[${i}]`;
    if (!app.immunobiologicalId) errors.push(`${prefix}.immunobiologicalId obrigatório`);
    else if (!byId(IMMUNOBIOLOGICALS, app.immunobiologicalId)) {
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
