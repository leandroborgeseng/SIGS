/** Ciclo de vida dos lotes de produção LEDI/BPA. */

export const BATCH_STATUSES = ['draft', 'ready', 'sent', 'error'] as const;
export type BatchStatus = (typeof BATCH_STATUSES)[number];

const ALLOWED: Record<BatchStatus, BatchStatus[]> = {
  draft: ['ready', 'error'],
  ready: ['sent', 'error', 'draft'],
  error: ['ready', 'draft'],
  sent: ['ready'], // reabrir para correção / reenvio local
};

export function isBatchStatus(s: string): s is BatchStatus {
  return (BATCH_STATUSES as readonly string[]).includes(s);
}

export function canTransition(from: string, to: string): boolean {
  if (!isBatchStatus(from) || !isBatchStatus(to)) return false;
  if (from === to) return true;
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: string, to: string) {
  if (!canTransition(from, to)) {
    throw new Error(`Transição de status inválida: ${from} → ${to}`);
  }
}

export const STATUS_LABEL: Record<BatchStatus, string> = {
  draft: 'Rascunho',
  ready: 'Pronto',
  sent: 'Enviado',
  error: 'Erro',
};
