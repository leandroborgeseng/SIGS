import type { LotacaoHeader } from '../ledi/lotacao.resolver';
import { resolveCodigoIbgeMunicipio } from '../ledi/ibge';
import {
  resolveCondutasOdonto,
  resolveLocalAtendimento,
  resolveSexo,
  resolveTipoConsultaOdonto,
  resolveTurno,
} from '../ledi/db-enums';

export type DentalProcedureInput = {
  tooth?: string;
  region?: string;
  code: string;
  label: string;
  done?: boolean;
};

export type DentalProblemaInput = {
  ciap?: string;
  cid10?: string;
};

export type LediDentalChild = {
  cpfCidadao?: string | null;
  cnsCidadao?: string | null;
  dtNascimento: number;
  sexo: number;
  sexoLabel?: string;
  gestante: boolean;
  necessidadesEspeciais?: boolean;
  localAtendimento?: number | null;
  tipoAtendimento: number;
  turno?: number | null;
  tiposConsultaOdonto?: number[];
  tiposEncamOdonto: number[];
  tiposEncamOdontoLabels?: string[];
  tiposVigilanciaSaudeBucal: number[];
  tiposFornecimOdonto?: number[];
  procedimentosRealizados: Array<{
    coMsProcedimento: string;
    quantidade?: number;
    tooth?: string;
    region?: string;
    label?: string;
  }>;
  problemasCondicoes: DentalProblemaInput[];
  odontograma?: Record<string, string>;
  dataHoraInicialAtendimento: number;
  dataHoraFinalAtendimento: number;
  stNaoPossuiCpf: boolean;
  justificativaNaoPossuiCpf?: number | null;
};

export type LediDentalMaster = {
  uuidFicha: string;
  tpCdsOrigem: number;
  mapperVersion: 'ledi-dental-v2';
  headerTransport: {
    profissionalCNS: string;
    cboCodigo_2002: string;
    cnes: string;
    ine?: string | null;
    dataAtendimento: number;
    codigoIbgeMunicipio?: string | null;
    lotacaoFormPrincipal: {
      profissionalCNS: string;
      cboCodigo_2002: string;
      cnes: string;
      ine?: string | null;
    };
  };
  atendimentosOdontologicos: LediDentalChild[];
  /** Compat preflight/BPA legado */
  fichaOdontoTransport: LediDentalChild & { condutas: number[]; procedimentos: DentalProcedureInput[] };
};

const FORNECIMENTO_MAP: Record<string, number> = {
  ESCOVA: 1,
  CREME: 2,
  FIO: 3,
};

export function buildDentalLediPayload(input: {
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
  /** LEDI: 2,4,5,6 — default 5 (consulta no dia) */
  tipoAtendimento?: number;
  /** Se informado, prevalece sobre encounterType */
  tiposConsultaOdonto?: number[];
  outcomes: string[];
  vigilanciaSaudeBucal?: number[];
  fornecimentos?: string[];
  problemasCondicoes?: DentalProblemaInput[];
  gestante?: boolean;
  necessidadesEspeciais?: boolean;
  stNaoPossuiCpf?: boolean;
  justificativaNaoPossuiCpf?: number | null;
  /** LEDI local 1–10 — se setado, prevalece sobre careLocation */
  localAtendimento?: number;
  /** LEDI turno 1–3 — se setado, prevalece sobre shift */
  turno?: number;
  procedures: DentalProcedureInput[];
  odontogram?: Record<string, string>;
}): LediDentalMaster {
  if (!input.outcomes.length) throw new Error('outcomes (condutas odonto) obrigatórias');
  const vigil = input.vigilanciaSaudeBucal?.length ? input.vigilanciaSaudeBucal : undefined;
  if (!vigil?.length) {
    throw new Error('tiposVigilanciaSaudeBucal obrigatório (≥1) para conformidade FAO/RNDS');
  }
  const problemas = input.problemasCondicoes?.filter((p) => p.ciap || p.cid10) ?? [];
  if (!problemas.length) {
    throw new Error('problemasCondicoes obrigatório (CIAP e/ou CID10) para conformidade FAO');
  }

  const encams = resolveCondutasOdonto(input.outcomes);
  const sexo = resolveSexo(input.patient.sex);
  if (!sexo) throw new Error(`sexo inválido: "${input.patient.sex}"`);
  const turnoResolved = input.turno
    ? { id: input.turno }
    : resolveTurno(input.shift);
  const localResolved = input.localAtendimento
    ? { id: input.localAtendimento }
    : resolveLocalAtendimento(input.careLocation ?? 'UBS');
  const tipoConsulta = resolveTipoConsultaOdonto(input.encounterType ?? 'CONSULTA');
  const tipoAtendimento = input.tipoAtendimento ?? 5;
  if (![2, 4, 5, 6].includes(tipoAtendimento)) {
    throw new Error('tipoAtendimento deve ser 2, 4, 5 ou 6');
  }

  const hasCpf = !!input.patient.cpf;
  const hasCns = !!input.patient.cns;
  const stNaoPossuiCpf = input.stNaoPossuiCpf ?? false;
  if (!hasCpf && !hasCns && !stNaoPossuiCpf) {
    throw new Error('paciente sem CPF/CNS — informe identificação ou stNaoPossuiCpf');
  }
  // LEDI: CPF e CNS mutuamente exclusivos — prioriza CPF
  const cpfCidadao = hasCpf ? input.patient.cpf : null;
  const cnsCidadao = hasCpf ? null : input.patient.cns;

  const lotacaoFormPrincipal = {
    profissionalCNS: input.lotacao.profissionalCNS,
    cboCodigo_2002: input.lotacao.cboCodigo_2002,
    cnes: input.lotacao.cnes,
    ine: input.lotacao.ine ?? null,
  };

  const procedimentosRealizados = input.procedures.map((p) => ({
    coMsProcedimento: p.code.replace(/\D/g, ''),
    quantidade: 1,
    tooth: p.tooth,
    region: p.region,
    label: p.label,
  }));

  const tiposFornecimOdonto = (input.fornecimentos || [])
    .map((f) => FORNECIMENTO_MAP[f.toUpperCase()] ?? Number(f))
    .filter((n) => Number.isFinite(n));

  const startedMs = input.startedAt.getTime();
  const finishedMs = (input.finishedAt ?? new Date()).getTime();
  const gestante = input.gestante ?? false;
  if (gestante && sexo.id === 0) {
    throw new Error('gestante=true incompatível com sexo masculino');
  }

  const encamIds = encams.map((e) => e.id);
  let tiposConsultaOdonto =
    input.tiposConsultaOdonto?.length
      ? [...input.tiposConsultaOdonto]
      : tipoAtendimento === 4
        ? []
        : tipoConsulta
          ? [tipoConsulta.id]
          : [];
  if (tipoAtendimento === 4) tiposConsultaOdonto = [];
  // FAO#8: alta do episódio (17) incompatível com consulta 1/2; tratamento concluído (15) exige 1/2
  if (encamIds.includes(17)) {
    tiposConsultaOdonto = tiposConsultaOdonto.filter((id) => id !== 1 && id !== 2);
  }
  if (encamIds.includes(15) && !tiposConsultaOdonto.some((id) => id === 1 || id === 2)) {
    tiposConsultaOdonto = [1];
  }

  const child: LediDentalChild = {
    cpfCidadao,
    cnsCidadao,
    dtNascimento: input.patient.birthDate.getTime(),
    sexo: sexo.id,
    sexoLabel: sexo.label,
    gestante,
    necessidadesEspeciais: input.necessidadesEspeciais ?? false,
    localAtendimento: localResolved?.id ?? 1,
    tipoAtendimento,
    turno: turnoResolved?.id ?? 1,
    tiposConsultaOdonto,
    tiposEncamOdonto: encamIds,
    tiposEncamOdontoLabels: encams.map((e) => e.label),
    tiposVigilanciaSaudeBucal: vigil,
    tiposFornecimOdonto,
    procedimentosRealizados,
    problemasCondicoes: problemas,
    odontograma: input.odontogram,
    dataHoraInicialAtendimento: startedMs,
    dataHoraFinalAtendimento: finishedMs,
    stNaoPossuiCpf,
    justificativaNaoPossuiCpf: stNaoPossuiCpf ? input.justificativaNaoPossuiCpf ?? null : null,
  };

  return {
    uuidFicha: input.uuidFicha.length <= 36
      ? `${input.lotacao.cnes}-${input.uuidFicha}`
      : input.uuidFicha,
    tpCdsOrigem: 3,
    mapperVersion: 'ledi-dental-v2',
    headerTransport: {
      ...lotacaoFormPrincipal,
      dataAtendimento: startedMs,
      codigoIbgeMunicipio: resolveCodigoIbgeMunicipio(input.codigoIbgeMunicipio),
      lotacaoFormPrincipal,
    },
    atendimentosOdontologicos: [child],
    fichaOdontoTransport: {
      ...child,
      condutas: child.tiposEncamOdonto,
      procedimentos: input.procedures,
    },
  };
}
