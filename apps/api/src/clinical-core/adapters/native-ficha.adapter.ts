/**
 * LEDI P1: ficha APS/odonto nativa → recursos Sigs* (FHIR-like).
 * Não lê XML e-SUS; o mapper LEDI continua o adaptador de exportação.
 */

import type {
  SigsComposition,
  SigsCondition,
  SigsEncounter,
  SigsIdentifier,
  SigsPatient,
  SigsProcedure,
} from '../sigs-fhir.types';

export type NativeFichaTipo = 'FAI' | 'FAO' | 'VAC';

export type NativeFichaInput = {
  fichaTipo: NativeFichaTipo;
  encounterId: string;
  uuidFicha?: string;
  status: 'in-progress' | 'finished';
  periodStart?: string;
  periodEnd?: string;
  patient: {
    id: string;
    civilName?: string | null;
    cpf?: string | null;
    cns?: string | null;
    birthDate?: Date | string | null;
    sex?: string | null;
  };
  practitionerCns?: string | null;
  cbo?: string | null;
  cnes?: string | null;
  ine?: string | null;
  ibgeMunicipio?: string | null;
  localAtendimento?: number | null;
  turno?: number | null;
  tipoAtendimento?: number | null;
  gestante?: boolean;
  stNaoPossuiCpf?: boolean;
  justificativaNaoPossuiCpf?: number | null;
  procedures: Array<{ code: string; quantity?: number }>;
  conditions: Array<{ ciap?: string; cid10?: string }>;
  extensions?: Record<string, unknown>;
};

export function nativeKeyFor(fichaTipo: NativeFichaTipo, encounterId: string): string {
  return `native:${fichaTipo}:${encounterId}`;
}

export function sexFromCadastro(sex?: string | null): SigsPatient['sex'] {
  const s = String(sex || '')
    .trim()
    .toUpperCase();
  if (s === 'M' || s === 'MALE' || s === 'MASCULINO' || s === '0') return 'male';
  if (s === 'F' || s === 'FEMALE' || s === 'FEMININO' || s === '1') return 'female';
  return 'unknown';
}

function toIso(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function toDateOnly(value?: Date | string | null): string | undefined {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : undefined;
}

function digits(value?: string | null): string | undefined {
  const d = String(value || '').replace(/\D/g, '');
  return d || undefined;
}

function patientFromInput(p: NativeFichaInput['patient']): SigsPatient {
  const identifiers: SigsIdentifier[] = [];
  const cpf = digits(p.cpf);
  const cns = digits(p.cns);
  if (cpf) identifiers.push({ system: 'cpf', value: cpf, use: 'official' });
  if (cns) identifiers.push({ system: 'cns', value: cns, use: 'official' });
  return {
    resourceType: 'Patient',
    id: p.id,
    identifiers,
    civilName: p.civilName || undefined,
    birthDate: toDateOnly(p.birthDate),
    sex: sexFromCadastro(p.sex),
  };
}

function proceduresFrom(input: NativeFichaInput['procedures']): SigsProcedure[] {
  const out: SigsProcedure[] = [];
  for (const p of input) {
    const code = digits(p.code);
    if (!code) continue;
    const q = p.quantity && p.quantity > 0 ? p.quantity : 1;
    out.push({ resourceType: 'Procedure', code, quantity: q });
  }
  return out;
}

function conditionsFrom(input: NativeFichaInput['conditions']): SigsCondition[] {
  const out: SigsCondition[] = [];
  const seen = new Set<string>();
  for (const c of input) {
    const ciap = c.ciap?.trim() || undefined;
    const cid10 = c.cid10?.trim() || undefined;
    if (!ciap && !cid10) continue;
    const key = `${ciap || ''}|${cid10 || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ resourceType: 'Condition', ciap, cid10 });
  }
  return out;
}

export function nativeFichaToEncounter(input: NativeFichaInput): SigsEncounter {
  const nativeKey = nativeKeyFor(input.fichaTipo, input.encounterId);
  return {
    resourceType: 'Encounter',
    id: input.encounterId,
    fichaTipo: input.fichaTipo,
    uuidFicha: input.uuidFicha || nativeKey,
    status: input.status,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    patient: patientFromInput(input.patient),
    practitionerCns: digits(input.practitionerCns) || input.practitionerCns || undefined,
    cbo: input.cbo || undefined,
    cnes: input.cnes || undefined,
    ine: input.ine || undefined,
    ibgeMunicipio: input.ibgeMunicipio || undefined,
    localAtendimento: input.localAtendimento ?? undefined,
    turno: input.turno ?? undefined,
    tipoAtendimento: input.tipoAtendimento ?? undefined,
    gestante: input.gestante,
    stNaoPossuiCpf: input.stNaoPossuiCpf,
    justificativaNaoPossuiCpf: input.justificativaNaoPossuiCpf ?? undefined,
    procedures: proceduresFrom(input.procedures),
    conditions: conditionsFrom(input.conditions),
    extensions: {
      nativeKey,
      encounterId: input.encounterId,
      ...(input.extensions || {}),
    },
  };
}

export function nativeFichaToComposition(input: NativeFichaInput): SigsComposition {
  const encounter = nativeFichaToEncounter(input);
  return {
    resourceType: 'Composition',
    id: input.encounterId,
    title:
      input.fichaTipo === 'FAI'
        ? 'Atendimento individual (nativo)'
        : input.fichaTipo === 'VAC'
          ? 'Vacinação (nativo)'
          : 'Atendimento odontológico (nativo)',
    fichaTipo: input.fichaTipo,
    fichaTipoCode: input.fichaTipo === 'FAI' ? 4 : input.fichaTipo === 'VAC' ? 7 : 5,
    uuidFicha: encounter.uuidFicha,
    encounters: [encounter],
    sourceFormat: 'sigs-native',
  };
}

/** Campos individuais do mapper FAI (JSON nativo, não XML). */
export type FaiMasterLike = {
  uuidFicha?: string;
  headerTransport?: {
    profissionalCNS?: string;
    cboCodigo_2002?: string;
    cnes?: string;
    ine?: string | null;
    codigoIbgeMunicipio?: string | null;
  };
  atendimentosIndividuais?: Array<{
    cpfCidadao?: string | null;
    cns?: string | null;
    dataNascimento?: string;
    localDeAtendimento?: number | null;
    turno?: number | null;
    tipoAtendimento?: number | null;
    dataHoraInicialAtendimento?: string;
    dataHoraFinalAtendimento?: string | null;
    condutas?: number[];
    problemaCondicaoAvaliada?: { cid10?: string[]; ciaps?: string[] };
    procedimentosRealizados?: Array<{ coMsProcedimento: string; quantidade: number }>;
    medicoes?: { peso?: number; altura?: number; perimetroCefalico?: number };
    soap?: { subjetivo?: string; objetivo?: string; avaliacao?: string; plano?: string };
    stNaoPossuiCpf?: boolean;
    justificativaNaoPossuiCpf?: number | null;
  }>;
};

export function faiMasterToNativeInput(
  payload: FaiMasterLike,
  ctx: {
    encounterId: string;
    patient: NativeFichaInput['patient'];
    status: NativeFichaInput['status'];
    gestante?: boolean;
  },
): NativeFichaInput {
  const child = payload.atendimentosIndividuais?.[0];
  const header = payload.headerTransport;
  const ciaps = child?.problemaCondicaoAvaliada?.ciaps || [];
  const cids = child?.problemaCondicaoAvaliada?.cid10 || [];
  const conditions: NativeFichaInput['conditions'] = [];
  const n = Math.max(ciaps.length, cids.length);
  for (let i = 0; i < n; i++) {
    conditions.push({ ciap: ciaps[i], cid10: cids[i] });
  }
  return {
    fichaTipo: 'FAI',
    encounterId: ctx.encounterId,
    uuidFicha: payload.uuidFicha,
    status: ctx.status,
    periodStart: child?.dataHoraInicialAtendimento,
    periodEnd: child?.dataHoraFinalAtendimento || undefined,
    patient: {
      ...ctx.patient,
      cpf: ctx.patient.cpf ?? child?.cpfCidadao,
      cns: ctx.patient.cns ?? child?.cns,
      birthDate: ctx.patient.birthDate ?? child?.dataNascimento,
    },
    practitionerCns: header?.profissionalCNS,
    cbo: header?.cboCodigo_2002,
    cnes: header?.cnes,
    ine: header?.ine,
    ibgeMunicipio: header?.codigoIbgeMunicipio,
    localAtendimento: child?.localDeAtendimento,
    turno: child?.turno,
    tipoAtendimento: child?.tipoAtendimento,
    gestante: ctx.gestante,
    stNaoPossuiCpf: child?.stNaoPossuiCpf,
    justificativaNaoPossuiCpf: child?.justificativaNaoPossuiCpf,
    procedures: (child?.procedimentosRealizados || []).map((p) => ({
      code: p.coMsProcedimento,
      quantity: p.quantidade,
    })),
    conditions,
    extensions: {
      condutas: child?.condutas,
      soap: child?.soap,
      medicoes: child?.medicoes,
    },
  };
}

/** Campos individuais do mapper FAO (JSON nativo, não XML). */
export type FaoMasterLike = {
  uuidFicha?: string;
  headerTransport?: {
    profissionalCNS?: string;
    cboCodigo_2002?: string;
    cnes?: string;
    ine?: string | null;
    codigoIbgeMunicipio?: string | null;
  };
  atendimentosOdontologicos?: Array<{
    cpfCidadao?: string | null;
    cnsCidadao?: string | null;
    localAtendimento?: number | null;
    turno?: number | null;
    tipoAtendimento?: number;
    dataHoraInicialAtendimento?: number;
    dataHoraFinalAtendimento?: number;
    gestante?: boolean;
    stNaoPossuiCpf?: boolean;
    justificativaNaoPossuiCpf?: number | null;
    tiposEncamOdonto?: number[];
    tiposVigilanciaSaudeBucal?: number[];
    problemasCondicoes?: Array<{ ciap?: string; cid10?: string }>;
    procedimentosRealizados?: Array<{ coMsProcedimento: string; quantidade?: number }>;
  }>;
};

export function faoMasterToNativeInput(
  payload: FaoMasterLike,
  ctx: {
    encounterId: string;
    patient: NativeFichaInput['patient'];
    status: NativeFichaInput['status'];
  },
): NativeFichaInput {
  const child = payload.atendimentosOdontologicos?.[0];
  const header = payload.headerTransport;
  return {
    fichaTipo: 'FAO',
    encounterId: ctx.encounterId,
    uuidFicha: payload.uuidFicha,
    status: ctx.status,
    periodStart: child?.dataHoraInicialAtendimento
      ? new Date(child.dataHoraInicialAtendimento).toISOString()
      : undefined,
    periodEnd: child?.dataHoraFinalAtendimento
      ? new Date(child.dataHoraFinalAtendimento).toISOString()
      : undefined,
    patient: {
      ...ctx.patient,
      cpf: ctx.patient.cpf ?? child?.cpfCidadao,
      cns: ctx.patient.cns ?? child?.cnsCidadao,
    },
    practitionerCns: header?.profissionalCNS,
    cbo: header?.cboCodigo_2002,
    cnes: header?.cnes,
    ine: header?.ine,
    ibgeMunicipio: header?.codigoIbgeMunicipio,
    localAtendimento: child?.localAtendimento,
    turno: child?.turno,
    tipoAtendimento: child?.tipoAtendimento,
    gestante: child?.gestante,
    stNaoPossuiCpf: child?.stNaoPossuiCpf,
    justificativaNaoPossuiCpf: child?.justificativaNaoPossuiCpf,
    procedures: (child?.procedimentosRealizados || []).map((p) => ({
      code: p.coMsProcedimento,
      quantity: p.quantidade,
    })),
    conditions: child?.problemasCondicoes || [],
    extensions: {
      tiposEncamOdonto: child?.tiposEncamOdonto,
      tiposVigilanciaSaudeBucal: child?.tiposVigilanciaSaudeBucal,
    },
  };
}
