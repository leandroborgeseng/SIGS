/**
 * Catálogo de reparo FAI (tipo 4) — auto só o que é seguro.
 * Não inventa CIAP/CID, conduta, profissional nem paciente.
 */

import {
  bodyForRepairUi,
  lookupRepair,
  type AlertRepair,
  type RepairMode,
} from '../fao/repair-catalog';
import { FAI_SAFE_DEFAULTS } from './fai-defaults';

/** BLOCKER clínico: sugerir na ficha, nunca aplicar em lote. */
export const FAI_MANUAL_CODES = new Set([
  'CONDUTA_MISSING',
  'PROBLEMAS_MISSING',
  'PROBLEMA_SEM_CODIGO',
  'TIPO_ATENDIMENTO',
  'SEXO_INVALID',
  'PATIENT_ID_MISSING',
  'CNS_INVALID',
  'CPF_INVALID',
  'DT_NASCIMENTO_MISSING',
  'DATA_ATENDIMENTO_MISSING',
  'PROF_CNS_MISSING',
  'PROF_CNS_INVALID',
  'DT_NASCIMENTO_AFTER_ATEND',
  'HORA_FIM_ANTES_INI',
  'HORA_INI_MISSING',
  'HORA_FIM_MISSING',
  'CPF_CNS_BOTH',
]);

const FAI_HOWS: Record<string, string> = {
  CONDUTA_MISSING: `Não aplicamos conduta em lote. Sugestão LEDI (só na ficha, se o profissional confirmar): ${FAI_SAFE_DEFAULTS.condutaSugerida} = retorno para consulta agendada. Escolha o desfecho real no catálogo TipoEncaminhamentoIndividual.`,
  PROBLEMAS_MISSING:
    'Não inventamos CIAP/CID. Abra a ficha e informe o diagnóstico real do atendimento.',
  PROBLEMA_SEM_CODIGO:
    'Não chutamos código clínico. Preencha CIAP ou CID-10 reais na ficha.',
  TIPO_ATENDIMENTO: `Não classificamos o atendimento automaticamente. Sugestão (só na ficha): ${FAI_SAFE_DEFAULTS.tipoAtendimentoSugerido} = consulta no dia. Confirme com o profissional.`,
  SEXO_INVALID: 'Informe sexo 0 ou 1 na ficha. Não inferimos sexo.',
  PATIENT_ID_MISSING: 'Informe CNS ou CPF do cidadão. Não criamos identificador.',
  CNS_INVALID: 'O dígito verificador falhou — corrija o CNS no cadastro. Formatação (espaços) é outro alerta (CNS_FORMAT).',
  CPF_INVALID: 'O dígito verificador falhou — corrija o CPF no cadastro.',
  DT_NASCIMENTO_MISSING: 'Informe a data de nascimento. Não inventamos data.',
  DATA_ATENDIMENTO_MISSING: 'Informe a data do atendimento. Não inventamos competência.',
  PROF_CNS_MISSING: 'Informe o CNS do profissional na lotação. Não inventamos profissional.',
  PROF_CNS_INVALID: 'Corrija o CNS do profissional no cadastro da lotação.',
  DT_NASCIMENTO_AFTER_ATEND: 'Ajuste nascimento ou data do atendimento — inconsistência lógica.',
  PREVINE_VIGILANCIA_99:
    'Vigilância 99 é qualidade de informação odonto; na FAI não forçamos código de vigilância.',
};

export function lookupFaiRepair(code: string): AlertRepair | undefined {
  const base = lookupRepair(code);
  if (!base) return undefined;

  if (FAI_MANUAL_CODES.has(code)) {
    return {
      ...base,
      mode: 'individual',
      batchable: false,
      suggestOnly: true,
      how: FAI_HOWS[code] || base.how,
      button: undefined,
      readyGoal: 'Corrigir cada ficha com o dado clínico/cadastral real até o alerta sumir.',
    };
  }

  return {
    ...base,
    how: FAI_HOWS[code] || base.how,
  };
}

export function faiBodyForRepairUi(
  ui: NonNullable<AlertRepair['ui']>,
  fields: Parameters<typeof bodyForRepairUi>[1],
): Record<string, unknown> | null {
  if (ui === 'ciap') return null;
  if (ui === 'cbo') return null;
  if (ui === 'vigilancia' || ui === 'proc_b1' || ui === 'proc_prev' || ui === 'proc_art' || ui === 'encam_15') {
    return null;
  }
  return bodyForRepairUi(ui, fields);
}

export type { AlertRepair, RepairMode };
