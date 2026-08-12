export const REGULATION_PROCEDURE_SEED = [
  {
    code: 'CONS_CARDIO',
    name: 'Consulta em cardiologia',
    specialty: 'Cardiologia',
    requiresCid: true,
  },
  {
    code: 'CONS_ORTO',
    name: 'Consulta em ortopedia',
    specialty: 'Ortopedia',
    requiresCid: true,
  },
  {
    code: 'USG_ABD',
    name: 'Ultrassonografia de abdômen total',
    specialty: 'Diagnóstico por imagem',
    requiresCid: false,
  },
  {
    code: 'ENDO_DIG',
    name: 'Endoscopia digestiva alta',
    specialty: 'Gastroenterologia',
    requiresCid: true,
  },
  {
    code: 'RM_JOELHO',
    name: 'Ressonância magnética de joelho',
    specialty: 'Diagnóstico por imagem',
    requiresCid: false,
  },
] as const;

export const REGULATION_COMPLEX_SEED = [
  {
    code: 'CRM-FRANCA',
    name: 'Complexo Regulador Municipal de Franca',
    type: 'MUNICIPAL',
  },
] as const;
