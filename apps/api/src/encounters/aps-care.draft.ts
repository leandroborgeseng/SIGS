/**
 * Rascunho clínico/LEDI da ficha APS origem (FAI tipo 4) — clinicalJson.
 * Condutas = TipoEncaminhamentoIndividual (não odonto).
 */

export const FAI_TIPO_ATENDIMENTO_IDS = [1, 2, 4, 5, 6] as const;

export type ApsProcedimento = {
  code: string;
  label?: string;
  quantidade?: number;
};

export type ApsCareDraft = {
  /** Marca origem ficha FAI (paralelo ao /odonto). */
  faiOrigin: boolean;
  /** LEDI tipoAtendimento — FAI admite 1, 2, 4, 5, 6 (default 5 consulta no dia). */
  tipoAtendimento: number;
  localAtendimento: number;
  turno: number;
  assignmentId?: string | null;
  cbo?: string | null;
  problemasCondicoes: Array<{ ciap?: string; cid10?: string }>;
  procedimentos: ApsProcedimento[];
  /** Códigos LEDI_CONDUTA (ALTA, RETORNO_CONSULTA_AGENDADA…) */
  outcomes: string[];
  stNaoPossuiCpf: boolean;
  justificativaNaoPossuiCpf?: number | null;
  gestante?: boolean;
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  ciapCodes?: string[];
  cidCodes?: string[];
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
};

export function defaultApsCareDraft(partial?: Partial<ApsCareDraft>): ApsCareDraft {
  const tipo = Number(process.env.APS_DEFAULT_TIPO_ATENDIMENTO || 5);
  return {
    faiOrigin: true,
    tipoAtendimento: (FAI_TIPO_ATENDIMENTO_IDS as readonly number[]).includes(tipo) ? tipo : 5,
    localAtendimento: Number(process.env.APS_DEFAULT_LOCAL || 1),
    turno: Number(process.env.APS_DEFAULT_TURNO || 2),
    assignmentId: null,
    cbo: null,
    problemasCondicoes: [],
    procedimentos: [],
    outcomes: [],
    stNaoPossuiCpf: false,
    justificativaNaoPossuiCpf: null,
    gestante: false,
    ...partial,
  };
}

export function parseApsCare(json: string | null | undefined): ApsCareDraft {
  try {
    const raw = JSON.parse(json || '{}') as Partial<ApsCareDraft> & {
      ciapCodes?: string[];
      cidCodes?: string[];
      procedures?: string[] | ApsProcedimento[];
    };
    const problemas =
      raw.problemasCondicoes?.length
        ? raw.problemasCondicoes
        : ([
            ...(raw.ciapCodes || []).map((ciap) => ({ ciap })),
            ...(raw.cidCodes || []).map((cid10) => ({ cid10 })),
          ] as Array<{ ciap?: string; cid10?: string }>).filter((p) => p.ciap || p.cid10);
    const procedimentos: ApsProcedimento[] = Array.isArray(raw.procedimentos)
      ? raw.procedimentos
      : Array.isArray(raw.procedures) && raw.procedures.some((p) => typeof p === 'object')
        ? (raw.procedures as ApsProcedimento[])
        : Array.isArray(raw.procedures)
          ? (raw.procedures as string[]).map((code) => ({ code, label: code, quantidade: 1 }))
          : [];
    return defaultApsCareDraft({
      ...raw,
      problemasCondicoes: problemas,
      procedimentos,
    });
  } catch {
    return defaultApsCareDraft();
  }
}

/** Franca default true; outras cidades: REQUIRE_INE_APS_OPEN=false */
export function requireIneOnApsOpen(): boolean {
  if (process.env.REQUIRE_INE_APS_OPEN === 'false') return false;
  if (process.env.REQUIRE_INE_APS_OPEN === 'true') return true;
  return process.env.REQUIRE_INE_DENTAL_OPEN !== 'false';
}

export function apsMunicipioIbgeFallback(): string {
  return process.env.MUNICIPIO_IBGE || '3516200';
}

export function isFaiOrigin(clinicalJson: string | null | undefined): boolean {
  try {
    const raw = JSON.parse(clinicalJson || '{}') as { faiOrigin?: boolean };
    return raw.faiOrigin === true;
  } catch {
    return false;
  }
}
