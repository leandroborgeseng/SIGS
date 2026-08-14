/**
 * Relatório do que ainda falta nas fichas LEDI após autofix.
 * Sem XML clínico, sem R$ pedagógico, identificadores mascarados (LGPD).
 */

import { getLediError, type LediChannel, type LediSeverity } from './ledi-error-registry';
import type { FaoFinding } from './ledi-fao.validator';
import type { PrevineXray } from './ledi-fao-previne-xray';

export const PENDING_SEVERITIES = ['BLOCKER', 'MONEY_RISK', 'QUALITY_WARN'] as const;
export type PendingSeverity = (typeof PENDING_SEVERITIES)[number];

export type PendingImpact = 'siaps' | 'qualidade_previne';
export type PendingGate = 'bloqueia_siaps' | 'qualidade_previne';

export const PENDING_REPORT_CSV_COLUMNS = [
  'arquivo',
  'uuid',
  'cpf',
  'cns',
  'data',
  'profissional_cns',
  'tipo_ficha',
  'gate',
  'siaps_ready',
  'codigo',
  'severidade',
  'titulo',
  'o_que_corrigir',
  'canal',
] as const;

export type PendingIssue = {
  code: string;
  severity: PendingSeverity;
  title: string;
  how: string;
  channel: LediChannel | 'UNKNOWN';
  blocksSiaps: boolean;
  impact: PendingImpact;
};

export type PendingFicha = {
  itemId: string;
  fileName: string;
  uuidFicha: string | null;
  cpfMasked: string | null;
  cnsMasked: string | null;
  dataAtendimento: string | null;
  profissionalCnsMasked: string | null;
  fichaTipo: string | null;
  siapsReady: boolean;
  previneReady: boolean;
  gate: PendingGate;
  issues: PendingIssue[];
};

export type PendingReportItemInput = {
  itemId: string;
  fileName: string;
  xml?: string | null;
  findings: FaoFinding[];
  previne?: PrevineXray | null;
  fichaTipo?: string | null;
};

export type PendingReport = {
  batchId: string;
  name: string;
  generatedAt: string;
  expectedTipo: string;
  totalFichas: number;
  pendingCount: number;
  severityFilter: PendingSeverity[] | null;
  countsBySeverity: Record<PendingSeverity, number>;
  fichas: PendingFicha[];
  csv: string;
  markdown: string;
};

const SEVERITY_SET = new Set<string>(PENDING_SEVERITIES);

const SEVERITY_ALIASES: Record<string, PendingSeverity> = {
  BLOCKER: 'BLOCKER',
  MONEY: 'MONEY_RISK',
  MONEY_RISK: 'MONEY_RISK',
  QUALITY: 'QUALITY_WARN',
  QUALITY_WARN: 'QUALITY_WARN',
  WARN: 'QUALITY_WARN',
};

export function parseSeverityFilter(raw?: string | null): PendingSeverity[] | null {
  if (!raw?.trim()) return null;
  const parts = raw
    .split(/[,+|]/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const out: PendingSeverity[] = [];
  for (const p of parts) {
    const mapped = SEVERITY_ALIASES[p];
    if (!mapped) {
      throw new Error(`severity inválida: ${p}. Use BLOCKER, MONEY_RISK ou QUALITY_WARN.`);
    }
    if (!out.includes(mapped)) out.push(mapped);
  }
  return out.length ? out : null;
}

/** CPF: `***.***.***-xx` (últimos 2 dígitos). */
export function maskCpf(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length < 2) return '***.***.***-**';
  return `***.***.***-${d.slice(-2)}`;
}

/** CNS: asteriscos + últimos 4 dígitos. */
export function maskCns(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (!d) return '****';
  if (d.length <= 4) return '*'.repeat(d.length);
  return `${'*'.repeat(d.length - 4)}${d.slice(-4)}`;
}

export function formatLediDate(raw: string | null | undefined): string | null {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    const ms = n >= 1e11 ? n : n * 1000;
    const d = new Date(ms);
    if (!Number.isFinite(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function tagFirst(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}\\b[^>]*>\\s*([^<]*)`, 'i'));
  const v = m?.[1]?.trim();
  return v || null;
}

export type FichaIdentity = {
  uuidFicha: string | null;
  cpfMasked: string | null;
  cnsMasked: string | null;
  dataAtendimento: string | null;
  profissionalCnsMasked: string | null;
};

/** Só tags de identificação — não devolve XML nem texto clínico. */
export function extractFichaIdentity(xml: string | null | undefined): FichaIdentity {
  if (!xml) {
    return {
      uuidFicha: null,
      cpfMasked: null,
      cnsMasked: null,
      dataAtendimento: null,
      profissionalCnsMasked: null,
    };
  }
  const cpfDigits = (tagFirst(xml, 'cpfCidadao') || '').replace(/\D/g, '');
  const cnsDigits = (tagFirst(xml, 'cnsCidadao') || tagFirst(xml, 'cns') || '').replace(/\D/g, '');
  const profDigits = (tagFirst(xml, 'profissionalCNS') || '').replace(/\D/g, '');
  const dataRaw =
    tagFirst(xml, 'dataAtendimento') || tagFirst(xml, 'dataHoraInicialAtendimento');
  return {
    uuidFicha: tagFirst(xml, 'uuidFicha'),
    cpfMasked: cpfDigits ? maskCpf(cpfDigits) : null,
    cnsMasked: cnsDigits ? maskCns(cnsDigits) : null,
    dataAtendimento: formatLediDate(dataRaw),
    profissionalCnsMasked: profDigits ? maskCns(profDigits) : null,
  };
}

function asPendingSeverity(raw: string | undefined): PendingSeverity | null {
  if (!raw) return null;
  return SEVERITY_SET.has(raw) ? (raw as PendingSeverity) : null;
}

function issueFromCode(
  code: string,
  severity: PendingSeverity,
  fallbackHow?: string,
): PendingIssue {
  const def = getLediError(code);
  const blocksSiaps = severity === 'BLOCKER';
  const channel: LediChannel | 'UNKNOWN' =
    def?.channel || (code.startsWith('PREVINE_') ? 'PREVINE' : 'LEDI');
  return {
    code,
    severity,
    title: def?.title || code,
    how: def?.how || fallbackHow || 'Corrigir na ficha (sem texto no catálogo).',
    channel,
    blocksSiaps,
    impact: blocksSiaps ? 'siaps' : 'qualidade_previne',
  };
}

export function collectPendingIssues(
  findings: FaoFinding[],
  previne: PrevineXray | null | undefined,
  severityFilter: PendingSeverity[] | null,
): PendingIssue[] {
  const allow = severityFilter ? new Set(severityFilter) : null;
  const byCode = new Map<string, PendingIssue>();

  for (const f of findings) {
    const sev = asPendingSeverity(f.severity);
    if (!sev) continue;
    if (allow && !allow.has(sev)) continue;
    if (!byCode.has(f.code)) {
      byCode.set(f.code, issueFromCode(f.code, sev, f.hint));
    }
  }

  if (previne?.gaps) {
    for (const g of previne.gaps) {
      const sev = asPendingSeverity(g.severity);
      if (!sev) continue;
      if (allow && !allow.has(sev)) continue;
      if (!byCode.has(g.code)) {
        byCode.set(g.code, issueFromCode(g.code, sev, g.hint || g.message));
      }
    }
  }

  const rank: Record<PendingSeverity, number> = {
    BLOCKER: 0,
    MONEY_RISK: 1,
    QUALITY_WARN: 2,
  };
  return [...byCode.values()].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.code.localeCompare(b.code),
  );
}

export function itemIsPending(
  findings: FaoFinding[],
  previne: PrevineXray | null | undefined,
  severityFilter: PendingSeverity[] | null,
): boolean {
  return collectPendingIssues(findings, previne, severityFilter).length > 0;
}

function csvCell(v: string | number | boolean | null | undefined): string {
  const s = v == null ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildPendingCsv(fichas: PendingFicha[]): string {
  const header = PENDING_REPORT_CSV_COLUMNS.join(',');
  const rows: string[] = [header];
  for (const f of fichas) {
    for (const issue of f.issues) {
      const cells: Record<(typeof PENDING_REPORT_CSV_COLUMNS)[number], string> = {
        arquivo: f.fileName,
        uuid: f.uuidFicha || '',
        cpf: f.cpfMasked || '',
        cns: f.cnsMasked || '',
        data: f.dataAtendimento || '',
        profissional_cns: f.profissionalCnsMasked || '',
        tipo_ficha: f.fichaTipo || '',
        gate: f.gate,
        siaps_ready: f.siapsReady ? 'sim' : 'nao',
        codigo: issue.code,
        severidade: issue.severity,
        titulo: issue.title,
        o_que_corrigir: issue.how,
        canal: issue.channel,
      };
      rows.push(PENDING_REPORT_CSV_COLUMNS.map((c) => csvCell(cells[c])).join(','));
    }
  }
  return rows.join('\n') + '\n';
}

function gateLabel(gate: PendingGate): string {
  return gate === 'bloqueia_siaps'
    ? 'bloqueia Siaps/envio'
    : 'só qualidade / Previne (não bloqueia envio)';
}

export function buildPendingMarkdown(opts: {
  name: string;
  batchId: string;
  expectedTipo: string;
  generatedAt: string;
  totalFichas: number;
  pendingCount: number;
  severityFilter: PendingSeverity[] | null;
  fichas: PendingFicha[];
}): string {
  const filtro = opts.severityFilter?.length
    ? opts.severityFilter.join(', ')
    : 'BLOCKER + MONEY_RISK + QUALITY_WARN';
  const lines: string[] = [
    `# Relatório do que falta — ${opts.name}`,
    ``,
    `- **Lote:** \`${opts.batchId}\``,
    `- **Tipo:** ${opts.expectedTipo}`,
    `- **Gerado em:** ${opts.generatedAt}`,
    `- **Fichas no lote:** ${opts.totalFichas}`,
    `- **Fichas neste recorte:** ${opts.pendingCount}`,
    `- **Filtro de severidade:** ${filtro}`,
    ``,
    `Identificadores mascarados (CPF \`***.***.***-xx\`). Sem XML clínico.`,
    ``,
    `**Gate:** BLOCKER bloqueia Siaps/envio. MONEY_RISK e QUALITY_WARN são qualidade / Previne.`,
    ``,
  ];

  if (!opts.fichas.length) {
    lines.push('_Nenhuma ficha pendente neste recorte._', '');
    return lines.join('\n');
  }

  for (const f of opts.fichas) {
    lines.push(`## ${f.fileName}`, ``);
    lines.push(`- **UUID:** ${f.uuidFicha ? `\`${f.uuidFicha}\`` : '—'}`);
    lines.push(`- **CPF:** ${f.cpfMasked || '—'}`);
    lines.push(`- **CNS:** ${f.cnsMasked || '—'}`);
    lines.push(`- **Data:** ${f.dataAtendimento || '—'}`);
    lines.push(`- **Profissional (CNS):** ${f.profissionalCnsMasked || '—'}`);
    if (f.fichaTipo) lines.push(`- **Tipo da ficha:** ${f.fichaTipo}`);
    lines.push(`- **Gate:** ${gateLabel(f.gate)}`);
    lines.push(`- **Siaps-ready:** ${f.siapsReady ? 'sim' : 'não'}`);
    lines.push('');
    lines.push(`| Código | Severidade | O que corrigir | Impacto |`);
    lines.push(`|---|---|---|---|`);
    for (const issue of f.issues) {
      const impacto = issue.blocksSiaps ? 'bloqueia Siaps/envio' : 'qualidade / Previne';
      lines.push(
        `| \`${issue.code}\` | ${issue.severity} | ${issue.title} — ${issue.how.replace(/\|/g, '/')} | ${impacto} |`,
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function buildPendingReport(opts: {
  batchId: string;
  name: string;
  expectedTipo: string;
  totalFichas: number;
  items: PendingReportItemInput[];
  severityFilter?: PendingSeverity[] | null;
  generatedAt?: string;
}): PendingReport {
  const severityFilter = opts.severityFilter ?? null;
  const generatedAt = opts.generatedAt || new Date().toISOString();
  const fichas: PendingFicha[] = [];
  const countsBySeverity: Record<PendingSeverity, number> = {
    BLOCKER: 0,
    MONEY_RISK: 0,
    QUALITY_WARN: 0,
  };

  for (const item of opts.items) {
    const listed = collectPendingIssues(item.findings, item.previne, severityFilter);
    if (!listed.length) continue;

    const allRemaining = collectPendingIssues(item.findings, item.previne, null);
    const hasBlocker = allRemaining.some((i) => i.severity === 'BLOCKER');
    const identity = extractFichaIdentity(item.xml);
    const previneReady = !item.previne || (item.previne.summary?.moneyRisks ?? 0) === 0;

    for (const issue of listed) {
      countsBySeverity[issue.severity] += 1;
    }

    fichas.push({
      itemId: item.itemId,
      fileName: item.fileName,
      uuidFicha: identity.uuidFicha,
      cpfMasked: identity.cpfMasked,
      cnsMasked: identity.cnsMasked,
      dataAtendimento: identity.dataAtendimento,
      profissionalCnsMasked: identity.profissionalCnsMasked,
      fichaTipo: item.fichaTipo || null,
      siapsReady: !hasBlocker,
      previneReady,
      gate: hasBlocker ? 'bloqueia_siaps' : 'qualidade_previne',
      issues: listed,
    });
  }

  const markdown = buildPendingMarkdown({
    name: opts.name,
    batchId: opts.batchId,
    expectedTipo: opts.expectedTipo,
    generatedAt,
    totalFichas: opts.totalFichas,
    pendingCount: fichas.length,
    severityFilter,
    fichas,
  });

  return {
    batchId: opts.batchId,
    name: opts.name,
    generatedAt,
    expectedTipo: opts.expectedTipo,
    totalFichas: opts.totalFichas,
    pendingCount: fichas.length,
    severityFilter,
    countsBySeverity,
    fichas,
    csv: buildPendingCsv(fichas),
    markdown,
  };
}

export function assertNoPedagogicalMoney(text: string): boolean {
  return !/R\$\s*\d/.test(text);
}

/** Garante que dígitos crus de CPF/CNS não vazem no artefato. */
export function assertIdentifiersMasked(text: string, rawDigits: string[]): boolean {
  return rawDigits.every((d) => !d || !text.includes(d));
}

export function isLediSeverity(v: string): v is LediSeverity {
  return v === 'BLOCKER' || v === 'MONEY_RISK' || v === 'QUALITY_WARN' || v === 'INFO';
}
