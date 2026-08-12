/** Catálogo mínimo seed (MVP) — códigos estáveis para regras BCG/Especial. */
export const IMMUNOBIOLOGICALS = [
  { id: 'BCG', code: 'BCG', label: 'BCG' },
  { id: 'HB', code: 'HB', label: 'Hepatite B' },
  { id: 'PENTA', code: 'PENTA', label: 'Penta' },
  { id: 'VIP', code: 'VIP', label: 'Poliomielite VIP' },
  { id: 'SCR', code: 'SCR', label: 'Tríplice viral' },
  { id: 'COVID', code: 'COVID', label: 'COVID-19' },
] as const;

export const STRATEGIES = [
  { id: 'ROUTINE', label: 'Rotina' },
  { id: 'SPECIAL', label: 'Estratégia Especial' },
  { id: 'CAMPAIGN', label: 'Campanha' },
  { id: 'BLOCK', label: 'Bloqueio' },
  { id: 'RESEARCH', label: 'Pesquisa' },
] as const;

export const DOSES = [
  { id: 'D1', label: '1ª dose' },
  { id: 'D2', label: '2ª dose' },
  { id: 'D3', label: '3ª dose' },
  { id: 'REF', label: 'Reforço' },
  { id: 'DU', label: 'Dose única' },
] as const;

export const ROUTES = [
  { id: 'IM', label: 'Intramuscular' },
  { id: 'SC', label: 'Subcutânea' },
  { id: 'ID', label: 'Intradérmica' },
  { id: 'ORAL', label: 'Oral' },
] as const;

export const SITES = [
  { id: 'LD', label: 'Deltoide esquerdo' },
  { id: 'RD', label: 'Deltoide direito' },
  { id: 'VL', label: 'Vasto lateral da coxa' },
  { id: 'ORAL', label: 'Oral' },
] as const;

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

export function validateVaccineApplications(apps: VaccineApplicationInput[]): string[] {
  const errors: string[] = [];
  if (!apps.length) errors.push('ao menos uma aplicação é obrigatória');
  if (apps.length > 99) errors.push('máximo 99 aplicações por ficha');

  const keys = new Set<string>();
  for (const [i, app] of apps.entries()) {
    const prefix = `applications[${i}]`;
    if (!app.immunobiologicalId) errors.push(`${prefix}.immunobiologicalId obrigatório`);
    if (!app.strategyId) errors.push(`${prefix}.strategyId obrigatório após imunobiológico`);
    if (!app.doseId) errors.push(`${prefix}.doseId obrigatório`);
    if (!app.attendanceGroupId) errors.push(`${prefix}.attendanceGroupId obrigatório`);
    if (!app.lot || !LOT_CHARSET.test(app.lot)) {
      errors.push(`${prefix}.lot inválido (charset/tamanho)`);
    }
    if (!app.manufacturer) errors.push(`${prefix}.manufacturer obrigatório`);
    if (!app.routeId) errors.push(`${prefix}.routeId obrigatório`);
    if (!app.siteId) errors.push(`${prefix}.siteId obrigatório`);

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
