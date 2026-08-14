import { createHash } from 'crypto';

export const LEDI_AUTOFIX_CHUNK_DEFAULT = 150;
export const LEDI_ANALYZE_CHUNK_DEFAULT = 150;

export type LediJobMode = 'apply' | 'dry-run' | 'import';

export type LediChartSummary = {
  total: number;
  siapsReady?: number;
  withBlockers?: number;
  withWarn?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  autoFixableItems?: number;
  treatment?: {
    current?: {
      fichas?: number;
      bloqueioEnvio?: number;
      riscoFaturamento?: number;
      indicadores?: number;
      ideais?: number;
    };
  };
};

export type LediAutofixCheckpoint = {
  processed: number;
  total: number;
  touched: number;
  wouldTouch?: number;
  dryRun?: boolean;
  before?: { withBlockers: number; siapsReady: number };
  after?: { withBlockers: number; siapsReady: number };
  beforeCodes?: Record<string, number>;
  afterCodes?: Record<string, number>;
  summary?: LediChartSummary;
  batchId?: string;
};

export function lediAutofixChunkSize(): number {
  const n = Number(process.env.LEDI_AUTOFIX_CHUNK_SIZE || LEDI_AUTOFIX_CHUNK_DEFAULT);
  if (!Number.isFinite(n)) return LEDI_AUTOFIX_CHUNK_DEFAULT;
  return Math.min(500, Math.max(20, Math.floor(n)));
}

export function lediAnalyzeChunkSize(): number {
  const n = Number(process.env.LEDI_IMPORT_ANALYZE_CHUNK || LEDI_ANALYZE_CHUNK_DEFAULT);
  if (!Number.isFinite(n)) return LEDI_ANALYZE_CHUNK_DEFAULT;
  return Math.min(500, Math.max(20, Math.floor(n)));
}

export function lediAutofixAsyncThreshold(): number {
  const n = Number(process.env.LEDI_AUTOFIX_ASYNC_THRESHOLD || 40);
  if (!Number.isFinite(n)) return 40;
  return Math.max(1, Math.floor(n));
}

export function lediFichaProgressMessage(
  processed: number,
  total: number,
  mode: LediJobMode,
): string {
  const verb = mode === 'dry-run' ? 'simulando' : mode === 'import' ? 'analisando' : 'processando';
  const safeTotal = Math.max(0, total);
  const safeProcessed = Math.min(Math.max(0, processed), safeTotal || processed);
  return `${verb} ficha ${safeProcessed} de ${safeTotal}`;
}

export function lediFichaProgressPct(processed: number, total: number): number {
  if (total <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
}

export function parseLediFichaProgress(
  message?: string | null,
): { processed: number; total: number } | null {
  if (!message) return null;
  const m = /(processando|simulando|analisando)\s+ficha\s+(\d+)\s+de\s+(\d+)/i.exec(message);
  if (!m) return null;
  const processed = Number(m[2]);
  const total = Number(m[3]);
  if (!Number.isFinite(processed) || !Number.isFinite(total) || total < 1) return null;
  return { processed, total };
}

export function lediAutofixIdempotencyKey(
  batchId: string,
  opts: { dryRun?: boolean; onlyItemIds?: string[] },
): string {
  const prefix = opts.dryRun ? 'ledi-dry-run' : 'ledi-auto-fix';
  const ids = opts.onlyItemIds?.filter(Boolean) || [];
  if (!ids.length) return `${prefix}:${batchId}`;
  const h = createHash('sha1')
    .update([...ids].sort().join(','))
    .digest('hex')
    .slice(0, 12);
  return `${prefix}:${batchId}:sel:${h}`;
}

export function chartSnapshotFromSummary(summary: LediChartSummary | null | undefined): LediChartSummary {
  const t = summary?.treatment?.current;
  return {
    total: summary?.total ?? 0,
    siapsReady: summary?.siapsReady,
    withBlockers: summary?.withBlockers,
    withWarn: summary?.withWarn,
    previneReady: summary?.previneReady,
    readyForFinalSend: summary?.readyForFinalSend,
    autoFixableItems: summary?.autoFixableItems,
    treatment: t
      ? {
          current: {
            fichas: t.fichas,
            bloqueioEnvio: t.bloqueioEnvio,
            riscoFaturamento: t.riscoFaturamento,
            indicadores: t.indicadores,
            ideais: t.ideais,
          },
        }
      : summary?.treatment,
  };
}

export function mapToCountRecord(map: Map<string, number>): Record<string, number> {
  return Object.fromEntries(map.entries());
}

export function countRecordToMap(rec?: Record<string, number> | null): Map<string, number> {
  const map = new Map<string, number>();
  if (!rec) return map;
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === 'number' && Number.isFinite(v)) map.set(k, v);
  }
  return map;
}

export function parseAutofixCheckpoint(raw: unknown): LediAutofixCheckpoint | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const processed = typeof o.processed === 'number' ? o.processed : 0;
  const total = typeof o.total === 'number' ? o.total : 0;
  const touched = typeof o.touched === 'number' ? o.touched : 0;
  if (processed < 0 || total < 0) return null;
  return {
    processed,
    total,
    touched,
    wouldTouch: typeof o.wouldTouch === 'number' ? o.wouldTouch : undefined,
    dryRun: o.dryRun === true,
    before:
      o.before && typeof o.before === 'object'
        ? (o.before as LediAutofixCheckpoint['before'])
        : undefined,
    after:
      o.after && typeof o.after === 'object' ? (o.after as LediAutofixCheckpoint['after']) : undefined,
    beforeCodes:
      o.beforeCodes && typeof o.beforeCodes === 'object'
        ? (o.beforeCodes as Record<string, number>)
        : undefined,
    afterCodes:
      o.afterCodes && typeof o.afterCodes === 'object'
        ? (o.afterCodes as Record<string, number>)
        : undefined,
    summary:
      o.summary && typeof o.summary === 'object' ? (o.summary as LediChartSummary) : undefined,
    batchId: typeof o.batchId === 'string' ? o.batchId : undefined,
  };
}
