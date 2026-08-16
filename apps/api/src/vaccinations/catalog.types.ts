/** Tipos do catálogo de vacinação (compartilhados seed ↔ runtime). */

export type CatalogOpt = {
  id: string;
  label: string;
  code?: string;
  /** id numérico LEDI / CDS (i64 Thrift) */
  lediId: number;
};

/** Faixa etária em dias de vida (RF-14.7/14.8). null = sem limite. */
export type AgeRange = {
  immunobiologicalId: string;
  /** Estratégia; omitida = qualquer */
  strategyId?: string;
  minDays: number;
  maxDays: number | null;
  label: string;
};
