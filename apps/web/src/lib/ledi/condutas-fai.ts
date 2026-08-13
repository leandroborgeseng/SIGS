/**
 * Condutas/encaminhamentos da FAI (TipoEncaminhamentoIndividual) — espelho de
 * `apps/api/src/ledi/db-enums.ts` → `LEDI_CONDUTA`.
 *
 * Não usar condutas odonto (`tiposEncamOdonto`) nesta ficha.
 */

export type CondutaFaiUi = {
  code: number;
  key: string;
  label: string;
};

export const LEDI_CONDUTA_FAI: readonly CondutaFaiUi[] = [
  { code: 1, key: 'RETORNO_CONSULTA_AGENDADA', label: 'Retorno para consulta agendada' },
  { code: 2, key: 'RETORNO_CUIDADO_CONTINUADO', label: 'Retorno para cuidado continuado / programado' },
  { code: 3, key: 'AGENDAMENTO_NASF', label: 'Agendamento para NASF' },
  { code: 4, key: 'ENCAMINHAMENTO_ESPECIALIZADO', label: 'Encaminhamento para serviço especializado' },
  { code: 5, key: 'ENCAMINHAMENTO_CAPS', label: 'Encaminhamento para CAPS' },
  { code: 6, key: 'ENCAMINHAMENTO_INTERNACAO', label: 'Encaminhamento para internação hospitalar' },
  { code: 7, key: 'ENCAMINHAMENTO_URGENCIA', label: 'Encaminhamento para urgência' },
  { code: 8, key: 'ENCAMINHAMENTO_AD', label: 'Encaminhamento para atenção domiciliar' },
  { code: 9, key: 'ALTA', label: 'Alta do episódio' },
  { code: 10, key: 'ENCAMINHAMENTO_INTERSETORIAL', label: 'Encaminhamento intersetorial' },
  { code: 11, key: 'ENCAMINHAMENTO_INTERNO_DIA', label: 'Encaminhamento interno no dia' },
  { code: 12, key: 'AGENDAMENTO_GRUPOS', label: 'Agendamento para grupos' },
  { code: 13, key: 'MANTER_OBSERVACAO', label: 'Manter em observação' },
  { code: 14, key: 'AGENDAMENTO_EMULTI', label: 'Agendamento para eMulti' },
] as const;

export const CONDUTAS_FAI = LEDI_CONDUTA_FAI;
