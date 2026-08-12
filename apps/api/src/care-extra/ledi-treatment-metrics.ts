import type { FaoFinding } from './ledi-fao.validator';
import type { PrevineXray } from './ledi-fao-previne-xray';

/** Snapshot de tratamento do lote (baseline × atual). */
export type TreatmentSnapshot = {
  fichas: number;
  /** Atendimentos/registros dentro das fichas (aprox. via XML). */
  registros: number;
  /** Fichas com BLOCKER — não passam no Siaps. */
  bloqueioEnvio: number;
  /** Sem blocker, mas com risco de faturamento/Previne. */
  riscoFaturamento: number;
  /** Só indicadores/qualidade (sem blocker nem money risk). */
  indicadores: number;
  /** Prontas para envio final (Siaps + Previne sem money risk). */
  ideais: number;
  alertasBloqueio: number;
  alertasRisco: number;
  alertasIndicadores: number;
};

export type TreatmentProgress = {
  baseline: TreatmentSnapshot;
  current: TreatmentSnapshot;
  /** Fichas tocadas por auto-correção/patch acumuladas no lote. */
  fichasCorrigidasAcumulado: number;
  ultimaCorrecaoQtd: number;
  ultimaCorrecaoEm: string | null;
};

/** Conta atendimentos/registros no XML LEDI (aprox.). */
export function countRegistrosXml(xml?: string | null): number {
  if (!xml?.trim()) return 1;
  const sections: RegExp[] = [
    /<atendimentosOdontologicos\b[^>]*>([\s\S]*?)<\/atendimentosOdontologicos>/i,
    /<atendimentosIndividuais\b[^>]*>([\s\S]*?)<\/atendimentosIndividuais>/i,
  ];
  for (const re of sections) {
    const m = xml.match(re);
    if (!m?.[1]) continue;
    const body = m[1];
    const children =
      body.match(/<(?:[\w]+:)?Ficha\w*Child\b/gi) ||
      body.match(/<dataHoraInicialAtendimento>/gi) ||
      body.match(/<dtInicioAtendimento>/gi) ||
      body.match(/<cnsCidadao>/gi) ||
      body.match(/<cpfCidadao>/gi);
    if (children?.length) return children.length;
    return 1;
  }
  const procEntries =
    xml.match(/<numTotalAfericaoPa>/gi) ||
    xml.match(/<(?:[\w]+:)?fichaProcedimentoChild\b/gi) ||
    xml.match(/<cnsCidadao>/gi);
  if (procEntries?.length) return procEntries.length;
  return 1;
}

export function buildTreatmentSnapshot(
  items: Array<{
    findingsJson: string;
    previneJson?: string | null;
    currentXml?: string | null;
    originalXml?: string | null;
  }>,
): TreatmentSnapshot {
  let registros = 0;
  let bloqueioEnvio = 0;
  let riscoFaturamento = 0;
  let indicadores = 0;
  let ideais = 0;
  let alertasBloqueio = 0;
  let alertasRisco = 0;
  let alertasIndicadores = 0;

  for (const it of items) {
    const findings = JSON.parse(it.findingsJson || '[]') as FaoFinding[];
    let previne: PrevineXray | null = null;
    try {
      previne = it.previneJson ? (JSON.parse(it.previneJson) as PrevineXray) : null;
    } catch {
      previne = null;
    }

    registros += countRegistrosXml(it.currentXml || it.originalXml);

    const blockers = findings.filter((f) => f.severity === 'BLOCKER').length;
    const moneyLedi = findings.filter((f) => f.severity === 'MONEY_RISK').length;
    const quality = findings.filter((f) => f.severity === 'QUALITY_WARN').length;
    const moneyPrev = previne?.summary.moneyRisks ?? 0;
    const qualityPrev = previne?.summary.qualityWarns ?? 0;

    alertasBloqueio += blockers;
    alertasRisco += moneyLedi + moneyPrev;
    alertasIndicadores += quality + qualityPrev;

    const hasBlocker = blockers > 0;
    const hasMoney = moneyLedi > 0 || moneyPrev > 0;
    const hasQuality = quality > 0 || qualityPrev > 0;

    if (hasBlocker) bloqueioEnvio += 1;
    else if (hasMoney) riscoFaturamento += 1;
    else if (hasQuality) indicadores += 1;
    else ideais += 1;
  }

  return {
    fichas: items.length,
    registros,
    bloqueioEnvio,
    riscoFaturamento,
    indicadores,
    ideais,
    alertasBloqueio,
    alertasRisco,
    alertasIndicadores,
  };
}

export function mergeTreatmentProgress(
  prev: Partial<TreatmentProgress> | undefined,
  current: TreatmentSnapshot,
  opts?: { touchedDelta?: number },
): TreatmentProgress {
  const baseline = prev?.baseline || current;
  const fichasCorrigidasAcumulado =
    (prev?.fichasCorrigidasAcumulado || 0) + (opts?.touchedDelta || 0);
  const ultimaCorrecaoQtd = opts?.touchedDelta ?? prev?.ultimaCorrecaoQtd ?? 0;
  const ultimaCorrecaoEm =
    opts?.touchedDelta && opts.touchedDelta > 0
      ? new Date().toISOString()
      : prev?.ultimaCorrecaoEm || null;

  return {
    baseline,
    current,
    fichasCorrigidasAcumulado,
    ultimaCorrecaoQtd,
    ultimaCorrecaoEm,
  };
}
