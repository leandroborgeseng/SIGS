import type { LotacaoHeader } from '../ledi/lotacao.resolver';
import { resolveCodigoIbgeMunicipio } from '../ledi/ibge';
import {
  resolveCondutas,
  resolveLocalAtendimento,
  resolveSexo,
  resolveTipoAtendimento,
  resolveTurno,
} from '../ledi/db-enums';

export type ClinicalData = {
  faiOrigin?: boolean;
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  ciapCodes?: string[];
  cidCodes?: string[];
  procedures?: string[];
  procedimentos?: Array<{ code: string; label?: string; quantidade?: number }>;
  problemasCondicoes?: Array<{ ciap?: string; cid10?: string }>;
  outcomes?: string[];
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  tipoAtendimento?: number;
  localAtendimento?: number;
  turno?: number;
  stNaoPossuiCpf?: boolean;
  justificativaNaoPossuiCpf?: number | null;
  gestante?: boolean;
};

export type LediIndividualChild = {
  cpfCidadao?: string | null;
  cns?: string | null;
  stNaoPossuiCpf?: boolean;
  justificativaNaoPossuiCpf?: number | null;
  dataNascimento?: string;
  /** id LEDI Sexo */
  sexo: number;
  sexoLabel?: string;
  /** id LocalAtendimento */
  localDeAtendimento?: number | null;
  localDeAtendimentoLabel?: string | null;
  /** id CdsTurno */
  turno?: number | null;
  turnoLabel?: string | null;
  /** id TipoAtendimento */
  tipoAtendimento?: number | null;
  tipoAtendimentoLabel?: string | null;
  dataHoraInicialAtendimento?: string;
  dataHoraFinalAtendimento?: string | null;
  /** ids TipoEncaminhamentoIndividual */
  condutas: number[];
  condutasLabels?: string[];
  ciap2MotivoConsulta?: string[];
  problemaCondicaoAvaliada?: { cid10?: string[]; ciaps?: string[] };
  procedimentosRealizados?: Array<{ coMsProcedimento: string; quantidade: number }>;
  medicoes?: { peso?: number; altura?: number; perimetroCefalico?: number };
  soap?: {
    subjetivo?: string;
    objetivo?: string;
    avaliacao?: string;
    plano?: string;
  };
};

export type LediLotacaoForm = {
  profissionalCNS: string;
  cboCodigo_2002: string;
  cnes: string;
  ine?: string | null;
};

export type LediIndividualMaster = {
  uuidFicha: string;
  tpCdsOrigem: number;
  mapperVersion: 'ledi-individual-v2';
  headerTransport: {
    /** Espelho flat (preflight / BPA stub) */
    profissionalCNS: string;
    cboCodigo_2002: string;
    cnes: string;
    ine?: string | null;
    dataAtendimento: string;
    codigoIbgeMunicipio?: string | null;
    /** Formato próximo ao VariasLotacoesHeaderThrift */
    lotacaoFormPrincipal: LediLotacaoForm;
  };
  atendimentosIndividuais: LediIndividualChild[];
};

export function buildIndividualEncounterLediPayload(input: {
  uuidFicha: string;
  lotacao: LotacaoHeader;
  codigoIbgeMunicipio?: string | null;
  startedAt: Date;
  finishedAt?: Date | null;
  patient: {
    cpf?: string | null;
    cns?: string | null;
    birthDate: Date;
    sex: string;
  };
  careLocation?: string | null;
  shift?: string | null;
  encounterType?: string | null;
  tipoAtendimento?: number | null;
  localAtendimento?: number | null;
  turno?: number | null;
  clinical: ClinicalData;
}): LediIndividualMaster {
  const outcomes = input.clinical.outcomes ?? [];
  if (!outcomes.length) {
    throw new Error('outcomes (condutas) obrigatórias');
  }
  const condutas = resolveCondutas(outcomes);
  const turno = resolveTurno(input.turno ?? input.clinical.turno ?? input.shift);
  const local = resolveLocalAtendimento(
    input.localAtendimento ?? input.clinical.localAtendimento ?? input.careLocation,
  );
  const tipo = resolveTipoAtendimento(
    input.tipoAtendimento ?? input.clinical.tipoAtendimento ?? input.encounterType,
  );
  const sexo = resolveSexo(input.patient.sex);
  if (!sexo) {
    throw new Error(`sexo inválido: "${input.patient.sex}"`);
  }

  const lotacaoFormPrincipal: LediLotacaoForm = {
    profissionalCNS: input.lotacao.profissionalCNS,
    cboCodigo_2002: input.lotacao.cboCodigo_2002,
    cnes: input.lotacao.cnes,
    ine: input.lotacao.ine ?? null,
  };

  const problemas = input.clinical.problemasCondicoes || [];
  const ciaps = [
    ...problemas.map((p) => p.ciap).filter((x): x is string => !!x),
    ...(input.clinical.ciapCodes || []),
  ];
  const cids = [
    ...problemas.map((p) => p.cid10).filter((x): x is string => !!x),
    ...(input.clinical.cidCodes || []),
  ];
  const uniq = (xs: string[]) => [...new Set(xs.map((s) => s.trim()).filter(Boolean))];

  const procedimentosRealizados = (input.clinical.procedimentos || [])
    .map((p) => ({
      coMsProcedimento: String(p.code || '').replace(/\D/g, ''),
      quantidade: p.quantidade && p.quantidade > 0 ? p.quantidade : 1,
    }))
    .filter((p) => p.coMsProcedimento.length === 10);

  const child: LediIndividualChild = {
    cpfCidadao: input.patient.cpf,
    cns: input.patient.cns,
    stNaoPossuiCpf: input.clinical.stNaoPossuiCpf ?? false,
    justificativaNaoPossuiCpf: input.clinical.justificativaNaoPossuiCpf ?? null,
    dataNascimento: input.patient.birthDate.toISOString().slice(0, 10),
    sexo: sexo.id,
    sexoLabel: sexo.label,
    localDeAtendimento: local?.id ?? null,
    localDeAtendimentoLabel: local?.label ?? null,
    turno: turno?.id ?? null,
    turnoLabel: turno?.label ?? null,
    tipoAtendimento: tipo?.id ?? null,
    tipoAtendimentoLabel: tipo?.label ?? null,
    dataHoraInicialAtendimento: input.startedAt.toISOString(),
    dataHoraFinalAtendimento: input.finishedAt?.toISOString() ?? null,
    condutas: condutas.map((c) => c.id),
    condutasLabels: condutas.map((c) => c.label),
    ciap2MotivoConsulta: uniq(ciaps),
    problemaCondicaoAvaliada: {
      cid10: uniq(cids),
      ciaps: uniq(ciaps),
    },
    procedimentosRealizados: procedimentosRealizados.length ? procedimentosRealizados : undefined,
    medicoes: {
      peso: input.clinical.weightKg,
      altura: input.clinical.heightCm,
      perimetroCefalico: input.clinical.headCircumferenceCm,
    },
    soap: {
      subjetivo: input.clinical.soapSubjective,
      objetivo: input.clinical.soapObjective,
      avaliacao: input.clinical.soapAssessment,
      plano: input.clinical.soapPlan,
    },
  };

  return {
    uuidFicha: input.uuidFicha,
    tpCdsOrigem: 3,
    mapperVersion: 'ledi-individual-v2',
    headerTransport: {
      profissionalCNS: lotacaoFormPrincipal.profissionalCNS,
      cboCodigo_2002: lotacaoFormPrincipal.cboCodigo_2002,
      cnes: lotacaoFormPrincipal.cnes,
      ine: lotacaoFormPrincipal.ine,
      dataAtendimento: input.startedAt.toISOString().slice(0, 10),
      codigoIbgeMunicipio: resolveCodigoIbgeMunicipio(input.codigoIbgeMunicipio),
      lotacaoFormPrincipal,
    },
    atendimentosIndividuais: [child],
  };
}
