import type { LotacaoHeader } from '../ledi/lotacao.resolver';
import { resolveCodigoIbgeMunicipio } from '../ledi/ibge';
import {
  resolveAtividadeColetiva,
  resolvePublicoAlvo,
  resolveTemaReuniao,
  resolveTemaSaude,
  resolveTurno,
} from '../ledi/db-enums';

export type LediCollectiveMaster = {
  uuidFicha: string;
  tpCdsOrigem: number;
  mapperVersion: 'ledi-collective-v2';
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
  atividadeTipo: number;
  atividadeTipoLabel?: string;
  turno?: number | null;
  numParticipantes: number;
  publicoAlvo: number[];
  temasParaReuniao?: number[];
  temasParaSaude?: number[];
  praticasTemasParaSaudeV200?: number[];
  procedimento?: string | null;
  cnesLocalAtividade: string;
  fichaAtividadeColetivaTransport: {
    tipoAtividade: number;
    tema: number | null;
    publicoAlvo: number;
    turno: number | null;
    numParticipantes: number;
    procedimentos: string[];
    notas?: string | null;
    dataAtividade: string;
  };
  facilityCnes: string;
  participantCount: number;
};

export function buildCollectiveLediPayload(input: {
  uuidFicha: string;
  lotacao: LotacaoHeader;
  codigoIbgeMunicipio?: string | null;
  heldAt: Date;
  activityType: string;
  theme: string;
  audience: string;
  shift?: string | null;
  participantCount: number;
  procedures?: string[];
  notes?: string | null;
}): LediCollectiveMaster {
  if (!input.participantCount || input.participantCount < 1) {
    throw new Error('participantCount >= 1 obrigatório');
  }
  const atividade = resolveAtividadeColetiva(input.activityType);
  if (!atividade) throw new Error(`atividadeTipo inválido: "${input.activityType}"`);
  const publico = resolvePublicoAlvo(input.audience);
  if (!publico) throw new Error(`publicoAlvo inválido: "${input.audience}"`);
  const turno = resolveTurno(input.shift);

  const isReuniao = atividade.id <= 3;
  let temaId: number | null = null;
  let temasParaReuniao: number[] | undefined;
  let temasParaSaude: number[] | undefined;

  if (isReuniao) {
    const tema = resolveTemaReuniao(input.theme) ?? resolveTemaReuniao('OUTROS');
    temaId = tema?.id ?? null;
    temasParaReuniao = temaId != null ? [temaId] : [];
  } else {
    const tema = resolveTemaSaude(input.theme) ?? resolveTemaSaude('OUTROS_TEMAS');
    temaId = tema?.id ?? null;
    temasParaSaude = temaId != null ? [temaId] : [];
  }

  const lotacaoFormPrincipal = {
    profissionalCNS: input.lotacao.profissionalCNS,
    cboCodigo_2002: input.lotacao.cboCodigo_2002,
    cnes: input.lotacao.cnes,
    ine: input.lotacao.ine ?? null,
  };

  const procedures = input.procedures || [];
  const dataAtividade = input.heldAt.toISOString().slice(0, 10);

  return {
    uuidFicha: input.uuidFicha,
    tpCdsOrigem: 3,
    mapperVersion: 'ledi-collective-v2',
    headerTransport: {
      ...lotacaoFormPrincipal,
      dataAtendimento: dataAtividade,
      codigoIbgeMunicipio: resolveCodigoIbgeMunicipio(input.codigoIbgeMunicipio),
      lotacaoFormPrincipal,
    },
    atividadeTipo: atividade.id,
    atividadeTipoLabel: atividade.label,
    turno: turno?.id ?? null,
    numParticipantes: input.participantCount,
    publicoAlvo: [publico.id],
    temasParaReuniao,
    temasParaSaude,
    praticasTemasParaSaudeV200: temasParaSaude,
    procedimento: procedures[0] || null,
    cnesLocalAtividade: input.lotacao.cnes,
    fichaAtividadeColetivaTransport: {
      tipoAtividade: atividade.id,
      tema: temaId,
      publicoAlvo: publico.id,
      turno: turno?.id ?? null,
      numParticipantes: input.participantCount,
      procedimentos: procedures,
      notas: input.notes ?? null,
      dataAtividade,
    },
    facilityCnes: input.lotacao.cnes,
    participantCount: input.participantCount,
  };
}
