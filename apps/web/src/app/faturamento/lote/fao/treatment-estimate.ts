/** Helpers numéricos do painel de tratamento (sem estimativa em R$). */

export function deltaDown(baseline: number, current: number): number {
  return Math.max(0, baseline - current);
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
