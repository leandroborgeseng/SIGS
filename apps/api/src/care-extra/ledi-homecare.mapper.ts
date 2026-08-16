import type { LotacaoHeader } from '../ledi/lotacao.resolver';
import { resolveCodigoIbgeMunicipio } from '../ledi/ibge';
import {
  resolveAdDesfecho,
  resolveAdModalidade,
  resolveLocalAtendimento,
  resolveSexo,
  resolveTipoAtendimento,
  resolveTurno,
} from '../ledi/db-enums';

export const AD_MAX_CHILDREN = 99;

export type LediHomeCareProblema = {
  ciap?: string | null;
  cid?: string | null;
  /** Alias de entrada (UI) — descartado após normalização */
  cid10?: string | null;
};

export function normalizeHomeCareProblemas(
  raw?: Array<{ ciap?: string | null; cid?: string | null; cid10?: string | null }> | null,
): Array<{ ciap?: string; cid?: string }> {
  return (raw || [])
    .map((p) => {
      const ciap = p.ciap?.trim() || undefined;
      const cid = (p.cid || p.cid10)?.trim() || undefined;
      return { ...(ciap ? { ciap } : {}), ...(cid ? { cid } : {}) };
    })
    .filter((p) => p.ciap || p.cid);
}

export type LediHomeCareChild = {
  cpfCidadao?: string | null;
  cnsCidadao?: string | null;
  stCidadaoNaoPossuiCpf: boolean;
  dataNascimento: string;
  sexo: number;
  sexoLabel?: string;
  turno?: number | null;
  localAtendimento?: number | null;
  atencaoDomiciliarModalidade: number;
  atencaoDomiciliarModalidadeLabel?: string;
  tipoAtendimento?: number | null;
  condicoesAvaliadas?: number[];
  problemasCondicoes?: LediHomeCareProblema[];
  cid?: string | null;
  ciap?: string | null;
  procedimentos: string[];
  condutaDesfecho?: number | null;
  condutaDesfechoLabel?: string | null;
  notas?: string | null;
};

export type LediHomeCareMaster = {
  uuidFicha: string;
  tpCdsOrigem: number;
  mapperVersion: 'ledi-homecare-v2';
  headerTransport: {
    profissionalCNS: string;
    cboCodigo_2002: string;
    cnes: string;
    ine?: string | null;
    dataAtendimento: string;
    codigoIbgeMunicipio?: string | null;
    lotacaoFormPrincipal: {
      profissionalCNS: string;
      cboCodigo_2002: string;
      cnes: string;
      ine?: string | null;
    };
  };
  atendimentosDomiciliares: LediHomeCareChild[];
  /** Compat BPA/preflight — espelho do 1º child */
  fichaAdTransport: LediHomeCareChild & {
    modalidade: string;
    careType: string;
    turnoLabel?: string | null;
  };
  facilityCnes: string;
};

export type HomeCareChildInput = {
  patient: {
    cpf?: string | null;
    cns?: string | null;
    birthDate: Date;
    sex: string;
  };
  careType: string;
  shift?: string | null;
  careLocation?: string | null;
  encounterType?: string | null;
  procedures: string[];
  desfecho?: string | null;
  notes?: string | null;
  condicoesAvaliadas?: number[] | null;
  problemasCondicoes?: LediHomeCareProblema[] | null;
};

function buildChild(input: HomeCareChildInput): LediHomeCareChild {
  const modalidade = resolveAdModalidade(input.careType);
  if (!modalidade) throw new Error(`modalidade AD inválida: "${input.careType}"`);
  const sexo = resolveSexo(input.patient.sex);
  if (!sexo) throw new Error(`sexo inválido: "${input.patient.sex}"`);
  const turno = resolveTurno(input.shift);
  const local = resolveLocalAtendimento(input.careLocation ?? 'DOMICILIO');
  const tipo = resolveTipoAtendimento(input.encounterType ?? 'ATENDIMENTO_PROGRAMADO');
  const desfecho = resolveAdDesfecho(input.desfecho ?? 'PERMANENCIA');
  const problemas = normalizeHomeCareProblemas(input.problemasCondicoes);
  const firstCiap = problemas.find((p) => p.ciap)?.ciap ?? null;
  const firstCid = problemas.find((p) => p.cid)?.cid ?? null;
  const hasCpf = Boolean(input.patient.cpf?.trim());
  const hasCns = Boolean(input.patient.cns?.trim());

  return {
    cpfCidadao: hasCpf ? input.patient.cpf : null,
    cnsCidadao: hasCns ? input.patient.cns : null,
    stCidadaoNaoPossuiCpf: !hasCpf,
    dataNascimento: input.patient.birthDate.toISOString().slice(0, 10),
    sexo: sexo.id,
    sexoLabel: sexo.label,
    turno: turno?.id ?? null,
    localAtendimento: local?.id ?? 4,
    atencaoDomiciliarModalidade: modalidade.id,
    atencaoDomiciliarModalidadeLabel: modalidade.label,
    tipoAtendimento: tipo?.id ?? null,
    condicoesAvaliadas: input.condicoesAvaliadas?.length
      ? [...input.condicoesAvaliadas]
      : undefined,
    problemasCondicoes: problemas.length ? problemas : undefined,
    cid: firstCid,
    ciap: firstCiap,
    procedimentos: input.procedures,
    condutaDesfecho: desfecho?.id ?? null,
    condutaDesfechoLabel: desfecho?.label ?? null,
    notas: input.notes ?? null,
  };
}

/** Aceita 1 child (legado) ou lista 1–99 (multi-child LEDI). */
export function buildHomeCareLediPayload(input: {
  uuidFicha: string;
  lotacao: LotacaoHeader;
  codigoIbgeMunicipio?: string | null;
  visitedAt: Date;
  /** @deprecated use `children` — mantido para callers/tests de 1 paciente */
  patient?: HomeCareChildInput['patient'];
  careType?: string;
  shift?: string | null;
  careLocation?: string | null;
  encounterType?: string | null;
  procedures?: string[];
  desfecho?: string | null;
  notes?: string | null;
  condicoesAvaliadas?: number[] | null;
  problemasCondicoes?: LediHomeCareProblema[] | null;
  children?: HomeCareChildInput[];
}): LediHomeCareMaster {
  const childrenInput: HomeCareChildInput[] =
    input.children?.length
      ? input.children
      : input.patient
        ? [
            {
              patient: input.patient,
              careType: input.careType || 'AD1',
              shift: input.shift,
              careLocation: input.careLocation,
              encounterType: input.encounterType,
              procedures: input.procedures || [],
              desfecho: input.desfecho,
              notes: input.notes,
              condicoesAvaliadas: input.condicoesAvaliadas,
              problemasCondicoes: input.problemasCondicoes,
            },
          ]
        : [];

  if (!childrenInput.length) {
    throw new Error('atendimentosDomiciliares exige ao menos 1 cidadão');
  }
  if (childrenInput.length > AD_MAX_CHILDREN) {
    throw new Error(`atendimentosDomiciliares máximo ${AD_MAX_CHILDREN} por ficha`);
  }

  const lotacaoFormPrincipal = {
    profissionalCNS: input.lotacao.profissionalCNS,
    cboCodigo_2002: input.lotacao.cboCodigo_2002,
    cnes: input.lotacao.cnes,
    ine: input.lotacao.ine ?? null,
  };

  const children = childrenInput.map(buildChild);
  const first = children[0]!;
  const firstModalidade = resolveAdModalidade(childrenInput[0]!.careType)!;
  const firstTurno = resolveTurno(childrenInput[0]!.shift);

  return {
    uuidFicha: input.uuidFicha,
    tpCdsOrigem: 3,
    mapperVersion: 'ledi-homecare-v2',
    headerTransport: {
      ...lotacaoFormPrincipal,
      dataAtendimento: input.visitedAt.toISOString().slice(0, 10),
      codigoIbgeMunicipio: resolveCodigoIbgeMunicipio(input.codigoIbgeMunicipio),
      lotacaoFormPrincipal,
    },
    atendimentosDomiciliares: children,
    fichaAdTransport: {
      ...first,
      modalidade: firstModalidade.code,
      careType: firstModalidade.code,
      turnoLabel: firstTurno?.label ?? null,
    },
    facilityCnes: input.lotacao.cnes,
  };
}
