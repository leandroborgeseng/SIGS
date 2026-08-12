/** Catálogo de alertas LEDI + Previne → como corrigir na UI. */

import { explainError } from './error-catalog';

export type AlertRepair = {
  title: string;
  where: string;
  how: string;
  /** Por que o parser gerou o alerta */
  why?: string;
  channel: 'LEDI' | 'PREVINE';
  ui?:
    | 'ine'
    | 'ciap'
    | 'cbo'
    | 'proc_b1'
    | 'proc_prev'
    | 'proc_art'
    | 'encam_15'
    | 'vigilancia'
    | 'st_cpf'
    | 'lote'
    | 'manual';
  button?: string;
  batchable?: boolean;
};

export const PREVINE_REPAIR: Record<string, AlertRepair> = {
  PREVINE_INE_MISSING: {
    title: 'INE ausente',
    where: 'Lote ou ficha → INE',
    how: 'Informe o INE da eSB. Sem INE o vínculo de equipe no Previne fica inconsistente.',
    channel: 'PREVINE',
    ui: 'ine',
    button: 'Preencher INE',
    batchable: true,
  },
  PREVINE_CBO_NOT_ESB: {
    title: 'CBO fora da ESB',
    where: 'Ficha → CBO',
    how: 'Use CBO odonto elegível (ex.: 223208 dentista ESF).',
    channel: 'PREVINE',
    ui: 'cbo',
    button: 'Aplicar CBO 223208',
    batchable: true,
  },
  PREVINE_PROBLEMAS_MISSING: {
    title: 'Sem CIAP/CID',
    where: 'Lote ou ficha → CIAP/CID',
    how: 'Inclua CIAP (ex. D82) ou CID-10 clínico real.',
    channel: 'PREVINE',
    ui: 'ciap',
    button: 'Incluir CIAP',
    batchable: true,
  },
  PREVINE_VIGILANCIA_99: {
    title: 'Vigilância só “99”',
    where: 'Ficha → vigilância',
    how: 'Troque 99 por código específico (ex.: 1 cárie, 3 periodontal).',
    channel: 'PREVINE',
    ui: 'vigilancia',
    button: 'Trocar vigilância',
    batchable: true,
  },
  PREVINE_B1_NO_FIRST_CONSULTA: {
    title: 'Sem 1ª consulta programada (B1)',
    where: 'Ficha → procedimento',
    how: 'Se for 1ª consulta programada, acrescente SIGTAP 0301010153.',
    channel: 'PREVINE',
    ui: 'proc_b1',
    button: 'Acrescentar 1ª consulta',
    batchable: true,
  },
  PREVINE_B2_NO_CONCLUSAO: {
    title: 'Sem tratamento concluído (B2)',
    where: 'Ficha → conduta 15',
    how: 'Ao concluir o plano, registre tiposEncamOdonto=15.',
    channel: 'PREVINE',
    ui: 'encam_15',
    button: 'Marcar conclusão (15)',
    batchable: true,
  },
  PREVINE_B2_NO_PAIR: {
    title: 'Sem par B1+B2',
    where: 'Ficha',
    how: 'B2 depende de 1ª consulta + conclusão na janela.',
    channel: 'PREVINE',
    ui: 'manual',
  },
  PREVINE_B3_HIGH_EXODONTIA: {
    title: 'Alta proporção de exodontia (B3)',
    where: 'Produção',
    how: 'Revise se preventivos/curativos estão registrados; alta exodontia piora B3.',
    channel: 'PREVINE',
    ui: 'manual',
  },
  PREVINE_B3_LOW_EXODONTIA_SHARE: {
    title: 'Baixa proporção de exodontia (B3)',
    where: 'Informativo',
    how: 'Faixa local abaixo do ótimo B3 — ajuste só se o mix clínico exigir.',
    channel: 'PREVINE',
    ui: 'manual',
  },
  PREVINE_B3_NO_EXODONTIA: {
    title: 'Sem exodontia neste XML',
    where: 'Informativo',
    how: 'Ok se o perfil for preventivo.',
    channel: 'PREVINE',
    ui: 'manual',
  },
  PREVINE_B5_NO_PREVENTIVE: {
    title: 'Sem preventivo (B5)',
    where: 'Ficha → preventivo',
    how: 'Acrescente preventivo elegível (ex. 0101020104).',
    channel: 'PREVINE',
    ui: 'proc_prev',
    button: 'Acrescentar preventivo',
    batchable: true,
  },
  PREVINE_B5_LOW_PREVENTIVE: {
    title: 'Poucos preventivos (B5)',
    where: 'Ficha → preventivo',
    how: 'Aumente registro de preventivos vs só curativos.',
    channel: 'PREVINE',
    ui: 'proc_prev',
    button: 'Acrescentar preventivo',
    batchable: true,
  },
  PREVINE_B5_HIGH_PREVENTIVE: {
    title: 'Preventivos muito altos (B5)',
    where: 'Informativo',
    how: '>85% preventivo também é Regular no B5.',
    channel: 'PREVINE',
    ui: 'manual',
  },
  PREVINE_B5_NO_PROCS: {
    title: 'Sem procedimentos para B5',
    where: 'Origem',
    how: 'Confira coMsProcedimento SIGTAP no XML.',
    channel: 'PREVINE',
    ui: 'manual',
  },
  PREVINE_B6_NO_ART: {
    title: 'Sem ART (B6)',
    where: 'Ficha → ART',
    how: 'Quando aplicável, registre TRA/ART 0307010074.',
    channel: 'PREVINE',
    ui: 'proc_art',
    button: 'Acrescentar ART',
    batchable: true,
  },
  PREVINE_B6_NO_RESTORATIVE: {
    title: 'B6 não se aplica',
    where: 'Informativo',
    how: 'Sem restauração neste atendimento.',
    channel: 'PREVINE',
    ui: 'manual',
  },
};

export const LEDI_REPAIR: Record<string, AlertRepair> = {
  ST_NAO_POSSUI_CPF: {
    title: 'stNaoPossuiCpf ausente',
    where: 'Lote → auto-correção',
    how: 'Insere false quando há CNS/CPF (obrigatório LEDI).',
    channel: 'LEDI',
    ui: 'st_cpf',
    button: 'Corrigir stNaoPossuiCpf',
    batchable: true,
  },
  INE_MISSING: {
    title: 'INE ausente (LEDI)',
    where: 'Lote ou ficha',
    how: 'Preencha INE da eSB e revalide.',
    channel: 'LEDI',
    ui: 'ine',
    button: 'Preencher INE',
    batchable: true,
  },
  PROBLEMAS_MISSING: {
    title: 'Problemas/condições ausentes',
    where: 'Lote ou ficha',
    how: 'Inclua CIAP/CID no atendimento.',
    channel: 'LEDI',
    ui: 'ciap',
    button: 'Incluir CIAP',
    batchable: true,
  },
  PROBLEMA_SEM_CODIGO: {
    title: 'Problema sem código',
    where: 'Ficha → CIAP/CID',
    how: 'Informe CIAP ou CID-10 válido.',
    channel: 'LEDI',
    ui: 'ciap',
    button: 'Incluir CIAP',
    batchable: true,
  },
};

export function lookupRepair(code: string): AlertRepair | undefined {
  const base = PREVINE_REPAIR[code] || LEDI_REPAIR[code];
  const explain = explainError(code);
  if (!base && !explain) return undefined;
  if (!base && explain) {
    return {
      title: explain.title,
      where: explain.field || explain.channel,
      how: explain.how,
      why: explain.why,
      channel: explain.channel === 'PREVINE' ? 'PREVINE' : 'LEDI',
      ui: 'manual',
    };
  }
  return {
    ...base!,
    why: base!.why || explain?.why,
    how: base!.how || explain?.how || base!.how,
    title: base!.title || explain?.title || code,
  };
}

export function bodyForRepairUi(
  ui: NonNullable<AlertRepair['ui']>,
  fields: {
    ine?: string;
    ciap?: string;
    cid10?: string;
    cbo?: string;
    vigilancia?: string;
    tipoConsulta?: string;
  },
): Record<string, unknown> | null {
  if (ui === 'ine') {
    const ine = fields.ine?.trim();
    return ine ? { ine } : null;
  }
  if (ui === 'ciap') {
    return {
      problemasCondicoes: [
        { ciap: fields.ciap?.trim() || 'D82', cid10: fields.cid10?.trim() || undefined },
      ],
    };
  }
  if (ui === 'cbo') return { cboCodigo_2002: fields.cbo?.trim() || '223208' };
  if (ui === 'proc_b1') return { procedimentosAdd: [{ coMsProcedimento: '0301010153', quantidade: 1 }] };
  if (ui === 'proc_prev') return { procedimentosAdd: [{ coMsProcedimento: '0101020104', quantidade: 1 }] };
  if (ui === 'proc_art') return { procedimentosAdd: [{ coMsProcedimento: '0307010074', quantidade: 1 }] };
  if (ui === 'encam_15') {
    return {
      tiposEncamOdontoAdd: [15],
      tiposConsultaOdonto: [Number(fields.tipoConsulta) || 1],
    };
  }
  if (ui === 'vigilancia') {
    const codes = (fields.vigilancia || '1,3')
      .split(/[,;\s]+/)
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n) && n > 0);
    return codes.length ? { tiposVigilanciaSaudeBucal: codes } : null;
  }
  if (ui === 'st_cpf') return { stNaoPossuiCpf: true };
  return null;
}
