import {
  VaccineApplicationInput,
  resolveAttendanceGroupLediId,
  resolveDoseLediId,
  resolveImmunoLediId,
  resolveRouteLediId,
  resolveSiteLediId,
  resolveStrategyLediId,
} from './catalog';
import {
  resolveLocalAtendimento,
  resolveSexo,
  resolveTurno,
} from '../ledi/db-enums';
import type { LotacaoHeader } from '../ledi/lotacao.resolver';
import { resolveCodigoIbgeMunicipio } from '../ledi/ibge';

export type LediVacinaRow = {
  /** id LEDI imunobiológico (i64) */
  imunobiologico: number;
  imunobiologicoCode?: string;
  estrategiaVacinacao: number;
  estrategiaVacinacaoCode?: string;
  dose: number;
  doseCode?: string;
  lote: string;
  fabricante: string;
  grupoAtendimento: number;
  grupoAtendimentoCode?: string;
  viaAdministracao: number;
  viaAdministracaoCode?: string;
  localAplicacao: number;
  localAplicacaoCode?: string;
  cboPrescritorCodigo2002?: string;
  cid10MotivoIndicacao?: string;
  stPesquisaClinica?: boolean;
  anvisaProtocoloEstudo?: string;
  anvisaProtocoloVersao?: string;
  anvisaNumeroRegistro?: string;
  stAplicadoExterior?: boolean;
  comunicanteHanseniase?: boolean;
};

export type LediVacinacaoChild = {
  cpf?: string | null;
  cns?: string | null;
  dataNascimento: string;
  sexo: number;
  sexoLabel?: string;
  turno: number | null;
  turnoLabel?: string | null;
  localAtendimento: number | null;
  localAtendimentoLabel?: string | null;
  stComunicanteHanseniase?: boolean;
  vacinas: LediVacinaRow[];
};

export type LediVacinacaoMaster = {
  uuidFicha: string;
  tpCdsOrigem: number;
  mapperVersion: 'ledi-vaccination-v2';
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
  vacinacoesIndividuais: LediVacinacaoChild[];
};

function requireLediId(
  label: string,
  id: string,
  resolver: (id: string) => number | null,
): number {
  const n = resolver(id);
  if (n == null) throw new Error(`${label} inválido: "${id}"`);
  return n;
}

export function buildVaccinationLediPayload(input: {
  uuidFicha: string;
  lotacao: LotacaoHeader;
  codigoIbgeMunicipio?: string | null;
  appliedAt: Date;
  shift: string;
  careLocation: string;
  patient: {
    cpf?: string | null;
    cns?: string | null;
    birthDate: Date;
    sex: string;
  };
  applications: VaccineApplicationInput[];
}): LediVacinacaoMaster {
  const rows: LediVacinaRow[] = input.applications.map((a) => ({
    imunobiologico: requireLediId('imunobiologico', a.immunobiologicalId, resolveImmunoLediId),
    imunobiologicoCode: a.immunobiologicalId,
    estrategiaVacinacao: requireLediId('estrategiaVacinacao', a.strategyId, resolveStrategyLediId),
    estrategiaVacinacaoCode: a.strategyId,
    dose: requireLediId('dose', a.doseId, resolveDoseLediId),
    doseCode: a.doseId,
    lote: a.lot,
    fabricante: a.manufacturer,
    grupoAtendimento: requireLediId(
      'grupoAtendimento',
      a.attendanceGroupId,
      resolveAttendanceGroupLediId,
    ),
    grupoAtendimentoCode: a.attendanceGroupId,
    viaAdministracao: requireLediId('viaAdministracao', a.routeId, resolveRouteLediId),
    viaAdministracaoCode: a.routeId,
    localAplicacao: requireLediId('localAplicacao', a.siteId, resolveSiteLediId),
    localAplicacaoCode: a.siteId,
    cboPrescritorCodigo2002: a.prescriberCbo,
    cid10MotivoIndicacao: a.indicationCid10,
    stPesquisaClinica: a.isClinicalResearch,
    anvisaProtocoloEstudo: a.anvisaStudyProtocol,
    anvisaProtocoloVersao: a.anvisaProtocolVersion,
    anvisaNumeroRegistro: a.anvisaRegistrationNumber,
    stAplicadoExterior: a.appliedAbroad,
    comunicanteHanseniase: a.leprosyContact,
  }));

  const leprosy = input.applications.some(
    (a) => a.immunobiologicalId === 'BCG' && a.leprosyContact === true,
  );

  const turno = resolveTurno(input.shift);
  const local = resolveLocalAtendimento(input.careLocation);
  const sexo = resolveSexo(input.patient.sex);
  if (!sexo) throw new Error(`sexo inválido: "${input.patient.sex}"`);

  const lotacaoFormPrincipal = {
    profissionalCNS: input.lotacao.profissionalCNS,
    cboCodigo_2002: input.lotacao.cboCodigo_2002,
    cnes: input.lotacao.cnes,
    ine: input.lotacao.ine ?? null,
  };

  return {
    uuidFicha: input.uuidFicha,
    tpCdsOrigem: 3,
    mapperVersion: 'ledi-vaccination-v2',
    headerTransport: {
      ...lotacaoFormPrincipal,
      dataAtendimento: input.appliedAt.toISOString().slice(0, 10),
      codigoIbgeMunicipio: resolveCodigoIbgeMunicipio(input.codigoIbgeMunicipio),
      lotacaoFormPrincipal,
    },
    vacinacoesIndividuais: [
      {
        cpf: input.patient.cpf,
        cns: input.patient.cns,
        dataNascimento: input.patient.birthDate.toISOString().slice(0, 10),
        sexo: sexo.id,
        sexoLabel: sexo.label,
        turno: turno?.id ?? null,
        turnoLabel: turno?.label ?? null,
        localAtendimento: local?.id ?? null,
        localAtendimentoLabel: local?.label ?? null,
        stComunicanteHanseniase: leprosy || undefined,
        vacinas: rows,
      },
    ],
  };
}
