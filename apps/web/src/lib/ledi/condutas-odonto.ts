/**
 * Condutas odontológicas (tiposEncamOdonto) — espelho de
 * `apps/api/src/ledi/db-enums.ts` → `LEDI_CONDUTA_ODONTO`.
 *
 * `code` = id numérico LEDI (valor no XML/Thrift). Não inventar códigos na UI:
 * desalinhamento quebra validação Siaps (ex.: 9≠ALTA, 12≠tratamento concluído).
 */

export type CondutaOdontoUi = {
  /** Id numérico LEDI enviado em tiposEncamOdonto. */
  code: number;
  /** Código amigável (DbEnum). */
  key: string;
  label: string;
};

/** Fonte canônica espelhada do domínio API (ordem do enum LEDI). */
export const LEDI_CONDUTA_ODONTO: readonly CondutaOdontoUi[] = [
  { code: 17, key: 'ALTA', label: 'Alta do episódio' },
  { code: 16, key: 'RETORNO', label: 'Retorno para consulta agendada' },
  { code: 15, key: 'TRATAMENTO_CONCLUIDO', label: 'Tratamento concluído' },
  { code: 12, key: 'AGENDAMENTO_OUTROS_AB', label: 'Agendamento para outros profissionais AB' },
  { code: 14, key: 'AGENDAMENTO_GRUPOS', label: 'Agendamento para grupos' },
  { code: 18, key: 'AGENDAMENTO_EMULTI', label: 'Agendamento para eMulti' },
  { code: 13, key: 'AGENDAMENTO_NASF', label: 'Agendamento para NASF' },
  {
    code: 1,
    key: 'NECESSIDADES_ESPECIAIS',
    label: 'Atendimento a pacientes com necessidades especiais',
  },
  { code: 2, key: 'CIRURGIA_BMF', label: 'Cirurgia BMF' },
  { code: 3, key: 'ENDODONTIA', label: 'Endodontia' },
  { code: 11, key: 'OUTROS', label: 'Outros' },
  { code: 99, key: 'NAO_SE_APLICA', label: 'Não se aplica' },
] as const;

/** Alias usado pelos selects do lote FAO. */
export const CONDUTAS_ODONTO = LEDI_CONDUTA_ODONTO;

export const CONDUTA_ODONTO_IDS = new Set(LEDI_CONDUTA_ODONTO.map((c) => c.code));

export function isLediCondutaOdontoId(n: number): boolean {
  return CONDUTA_ODONTO_IDS.has(n);
}
