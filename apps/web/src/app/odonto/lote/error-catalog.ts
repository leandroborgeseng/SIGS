/**
 * Catálogo de erros LEDI para a UI.
 * Textos e severidade vêm do registry unificado (`@/lib/ledi/error-registry`).
 */

import {
  LEDI_ERROR_REGISTRY,
  getLediError,
  type LediSeverity,
} from '@/lib/ledi/error-registry';

export type ErrorSeverity = LediSeverity;

export type ErrorExplain = {
  code: string;
  severity: ErrorSeverity;
  channel: 'LEDI' | 'PREVINE' | 'LOTE';
  title: string;
  why: string;
  how: string;
  field?: string;
};

export const ERROR_CATALOG: Record<string, ErrorExplain> = Object.fromEntries(
  Object.values(LEDI_ERROR_REGISTRY).map((d) => [
    d.code,
    {
      code: d.code,
      severity: d.severity,
      channel: d.channel,
      title: d.title,
      why: d.why,
      how: d.how,
      field: d.field,
    },
  ]),
);

export function explainError(code: string): ErrorExplain | undefined {
  const d = getLediError(code);
  if (!d) return undefined;
  return {
    code: d.code,
    severity: d.severity,
    channel: d.channel,
    title: d.title,
    why: d.why,
    how: d.how,
    field: d.field,
  };
}

export function allErrorExplanations(): ErrorExplain[] {
  return Object.values(ERROR_CATALOG).sort((a, b) => a.code.localeCompare(b.code));
}

/** Prioridade de tratamento: 1 bloqueio → 2 faturamento → 3 indicadores → 4 info. */
export function severityRank(sev?: string): number {
  if (sev === 'BLOCKER') return 1;
  if (sev === 'MONEY_RISK') return 2;
  if (sev === 'QUALITY_WARN') return 3;
  if (sev === 'INFO') return 4;
  return 9;
}

export function resolveSeverity(code: string, fallback?: string): ErrorSeverity | string {
  return ERROR_CATALOG[code]?.severity || fallback || '';
}

/** Rótulo curto para badge na UI. */
export function severityLabel(sev?: string): string {
  if (sev === 'BLOCKER') return 'Bloqueia envio';
  if (sev === 'MONEY_RISK') return 'Risco faturamento';
  if (sev === 'INFO') return 'Info governo';
  if (sev === 'QUALITY_WARN') return 'Indicadores';
  return sev || '';
}

/** Classe CSS da barra / badge (cores distintas por prioridade). */
export function severityTone(sev?: string): string {
  if (sev === 'BLOCKER') return 'blocker';
  if (sev === 'MONEY_RISK') return 'money';
  if (sev === 'QUALITY_WARN') return 'quality';
  if (sev === 'INFO') return 'info';
  return '';
}

export function compareBySeverityThenCount(
  a: { severity?: string; files?: number },
  b: { severity?: string; files?: number },
): number {
  const bySev = severityRank(a.severity) - severityRank(b.severity);
  if (bySev !== 0) return bySev;
  return (b.files || 0) - (a.files || 0);
}
