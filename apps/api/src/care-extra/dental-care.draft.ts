/**
 * Rascunho clínico/LEDI do atendimento odonto (careJson).
 * Campos alinhados ao validador FAO + RF-12 Onda 1.
 */
export type DentalCareDraft = {
  tipoAtendimento: number;
  /** Condicional: obrigatório se tipo=2 */
  tiposConsultaOdonto: number[];
  /** LEDI local 1–10 (default 1 UBS) */
  localAtendimento: number;
  /** 1 manhã · 2 tarde · 3 noite */
  turno: number;
  gestante: boolean;
  necessidadesEspeciais: boolean;
  /** Códigos string do catálogo (ALTA, TRATAMENTO_CONCLUIDO…) ou ids numéricos como string */
  outcomes: string[];
  vigilanciaSaudeBucal: number[];
  /** ESCOVA | CREME | FIO ou ids */
  fornecimentos: string[];
  problemasCondicoes: Array<{ ciap?: string; cid10?: string }>;
  stNaoPossuiCpf: boolean;
  justificativaNaoPossuiCpf?: number | null;
  /** ISO opcional — senão usa startedAt/finishedAt do encounter */
  dataHoraInicialAtendimento?: string | null;
  dataHoraFinalAtendimento?: string | null;
  assignmentId?: string | null;
  cbo?: string | null;
};

export function defaultDentalCareDraft(partial?: Partial<DentalCareDraft>): DentalCareDraft {
  const tipo = Number(process.env.DENTAL_DEFAULT_TIPO_ATENDIMENTO || 5);
  return {
    tipoAtendimento: [2, 4, 5, 6].includes(tipo) ? tipo : 5,
    tiposConsultaOdonto: [],
    localAtendimento: Number(process.env.DENTAL_DEFAULT_LOCAL || 1),
    turno: Number(process.env.DENTAL_DEFAULT_TURNO || 2),
    gestante: false,
    necessidadesEspeciais: false,
    outcomes: [],
    vigilanciaSaudeBucal: [],
    fornecimentos: [],
    problemasCondicoes: [],
    stNaoPossuiCpf: false,
    justificativaNaoPossuiCpf: null,
    dataHoraInicialAtendimento: null,
    dataHoraFinalAtendimento: null,
    assignmentId: null,
    cbo: null,
    ...partial,
  };
}

/** Franca default true; outras cidades: REQUIRE_INE_DENTAL_OPEN=false */
export function requireIneOnDentalOpen(): boolean {
  return process.env.REQUIRE_INE_DENTAL_OPEN !== 'false';
}

export function dentalMunicipioIbgeFallback(): string {
  return process.env.MUNICIPIO_IBGE || '3516200';
}
