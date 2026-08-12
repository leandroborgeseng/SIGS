import type { TreatmentProgress, TreatmentSnapshot } from './treatment-types';

/**
 * Estimativa pedagógica em R$ para o painel de tratamento.
 * Não é tabela oficial SIGTAP/Previne — serve para priorizar o trabalho.
 * Ajuste fino pode virar parâmetro municipal depois.
 */
export const ESTIMATE_BRL = {
  /** Produção média estimada por ficha que ainda não envia (bloqueio). */
  porFichaBloqueada: 45,
  /** Proxy de impacto Previne/repasse por ficha com risco de faturamento. */
  porFichaRisco: 95,
} as const;

export function formatBrl(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function estimateRiskBrl(snap: TreatmentSnapshot): number {
  return (
    snap.bloqueioEnvio * ESTIMATE_BRL.porFichaBloqueada +
    snap.riscoFaturamento * ESTIMATE_BRL.porFichaRisco
  );
}

export function estimateRecoveredBrl(progress: TreatmentProgress): number {
  const b = progress.baseline;
  const c = progress.current;
  const liberadasEnvio = Math.max(0, b.bloqueioEnvio - c.bloqueioEnvio);
  const melhoradasFat = Math.max(0, b.riscoFaturamento - c.riscoFaturamento);
  return (
    liberadasEnvio * ESTIMATE_BRL.porFichaBloqueada +
    melhoradasFat * ESTIMATE_BRL.porFichaRisco
  );
}

export function deltaDown(baseline: number, current: number): number {
  return Math.max(0, baseline - current);
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
