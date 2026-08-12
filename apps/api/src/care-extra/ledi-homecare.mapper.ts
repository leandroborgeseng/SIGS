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

export type LediHomeCareChild = {
  cpfCidadao?: string | null;
  cnsCidadao?: string | null;
  dataNascimento: string;
  sexo: number;
  sexoLabel?: string;
  turno?: number | null;
  localAtendimento?: number | null;
  atencaoDomiciliarModalidade: number;
  atencaoDomiciliarModalidadeLabel?: string;
  tipoAtendimento?: number | null;
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
  fichaAdTransport: LediHomeCareChild & {
    modalidade: string;
    careType: string;
    turnoLabel?: string | null;
  };
  facilityCnes: string;
};

export function buildHomeCareLediPayload(input: {
  uuidFicha: string;
  lotacao: LotacaoHeader;
  codigoIbgeMunicipio?: string | null;
  visitedAt: Date;
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
}): LediHomeCareMaster {
  const modalidade = resolveAdModalidade(input.careType);
  if (!modalidade) throw new Error(`modalidade AD inválida: "${input.careType}"`);
  const sexo = resolveSexo(input.patient.sex);
  if (!sexo) throw new Error(`sexo inválido: "${input.patient.sex}"`);
  const turno = resolveTurno(input.shift);
  const local = resolveLocalAtendimento(input.careLocation ?? 'DOMICILIO');
  const tipo = resolveTipoAtendimento(input.encounterType ?? 'ATENDIMENTO_PROGRAMADO');
  const desfecho = resolveAdDesfecho(input.desfecho ?? 'PERMANENCIA');

  const lotacaoFormPrincipal = {
    profissionalCNS: input.lotacao.profissionalCNS,
    cboCodigo_2002: input.lotacao.cboCodigo_2002,
    cnes: input.lotacao.cnes,
    ine: input.lotacao.ine ?? null,
  };

  const child: LediHomeCareChild = {
    cpfCidadao: input.patient.cpf,
    cnsCidadao: input.patient.cns,
    dataNascimento: input.patient.birthDate.toISOString().slice(0, 10),
    sexo: sexo.id,
    sexoLabel: sexo.label,
    turno: turno?.id ?? null,
    localAtendimento: local?.id ?? 4,
    atencaoDomiciliarModalidade: modalidade.id,
    atencaoDomiciliarModalidadeLabel: modalidade.label,
    tipoAtendimento: tipo?.id ?? null,
    procedimentos: input.procedures,
    condutaDesfecho: desfecho?.id ?? null,
    condutaDesfechoLabel: desfecho?.label ?? null,
    notas: input.notes ?? null,
  };

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
    atendimentosDomiciliares: [child],
    fichaAdTransport: {
      ...child,
      modalidade: modalidade.code,
      careType: modalidade.code,
      turnoLabel: turno?.label ?? null,
    },
    facilityCnes: input.lotacao.cnes,
  };
}
