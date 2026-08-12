/** Condutas odontológicas frequentes (tiposEncamOdonto). */
export const CONDUTAS_ODONTO = [
  { code: 1, label: 'Retorno para consulta agendada' },
  { code: 2, label: 'Retorno para cuidados continuados' },
  { code: 3, label: 'Agendamento para outros profissionais ABS' },
  { code: 4, label: 'Agendamento para NASF' },
  { code: 9, label: 'Alta do episódio' },
  { code: 12, label: 'Tratamento concluído' },
  { code: 15, label: 'Tratamento concluído (conduta 15)' },
  { code: 16, label: 'Agendamento para grupos' },
  { code: 17, label: 'Outros' },
] as const;
