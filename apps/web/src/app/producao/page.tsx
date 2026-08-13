'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { ApiError, api } from '@/lib/api';
import { formatDateTime } from '@/lib/labels';

type Batch = {
  id: string;
  kind: string;
  status: string;
  createdAt: string;
  rfIdsCsv?: string;
  errorMessage?: string | null;
  statusChangedAt?: string | null;
};

type Finding = {
  code: string;
  severity: 'BLOCKER' | 'MONEY_RISK' | 'QUALITY_WARN';
  message: string;
  field?: string;
  hint?: string;
  moneyImpact?: string;
};

type BatchPreflight = {
  batchId: string;
  kind: string;
  status: string;
  createdAt: string;
  procedureCode?: string;
  findings: Finding[];
  blockers: number;
  moneyRisks: number;
  qualityWarns: number;
  canSendAlone: boolean;
};

type PreflightReport = {
  generatedAt: string;
  competencia?: string;
  totals: {
    batches: number;
    ready: number;
    blockers: number;
    moneyRisks: number;
    qualityWarns: number;
    canSend: boolean;
  };
  summary: {
    missingStructures: string[];
    sendBlockers: string[];
    productionLossRisks: string[];
    moneyLossRisks: string[];
  };
  batches: BatchPreflight[];
  sigtap: { known: number; unknown: number; unknownCodes: string[] };
  checklist: Array<{ id: string; ok: boolean; label: string }>;
};

type BpaExport = {
  format: string;
  competencia: string;
  totalLines: number;
  totalQuantity: number;
  csv: string;
  lines: Array<{ procedimento: string; label: string; cnes: string; sigtapKnown?: boolean }>;
  sigtap?: { known: number; unknown: number; unknownCodes: string[] };
};

const KIND_LABEL: Record<string, string> = {
  individual_encounter: 'Atendimento APS',
  vaccination: 'Vacinação',
  dental_encounter: 'Odontologia',
  home_care: 'Atenção domiciliar',
  collective_activity: 'Atividade coletiva',
};

const SEV_LABEL: Record<string, string> = {
  BLOCKER: 'Bloqueia envio',
  MONEY_RISK: 'Risco financeiro',
  QUALITY_WARN: 'Qualidade',
};

export default function ProductionPage() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('ready');
  const [kind, setKind] = useState('');
  const [bpa, setBpa] = useState<BpaExport | null>(null);
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      let list = await api<Batch[]>(`/v1/production/batches${qs}`);
      if (kind) list = list.filter((r) => r.kind === kind);
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao listar lotes');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [status, kind]);

  async function runPreflight() {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const data = await api<PreflightReport>('/v1/production/preflight?status=ready');
      setReport(data);
      setOk(
        data.totals.canSend
          ? `Pré-envio OK — ${data.totals.batches} lote(s) aptos.`
          : `Pré-envio com pendências — ${data.totals.blockers} bloqueio(s), ${data.totals.moneyRisks} risco(s) financeiro(s).`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no pré-envio');
    } finally {
      setBusy(false);
    }
  }

  async function sendProduction(force = false) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      let current = report;
      if (!current || force === false) {
        current = await api<PreflightReport>('/v1/production/preflight?status=ready');
        setReport(current);
      }
      if (!current.totals.canSend && !force) {
        setError('Há bloqueios. Corrija as pendências do relatório ou use “Enviar mesmo assim”.');
        setBusy(false);
        return;
      }
      if (force && !confirm('Forçar envio com bloqueios/riscos? Isso pode gerar perda de produção ou glosa.')) {
        setBusy(false);
        return;
      }
      const res = await api<{ sent: number; forced?: boolean; preflight: PreflightReport }>(
        '/v1/production/send',
        { method: 'POST', json: { force } },
      );
      setReport(res.preflight);
      setOk(`${res.sent} lote(s) marcado(s) como enviado${res.forced ? ' (forçado)' : ''}.`);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === 'object' && 'preflight' in e.body) {
        setReport((e.body as { preflight: PreflightReport }).preflight);
      }
      setError(e instanceof Error ? e.message : 'Falha ao enviar');
    } finally {
      setBusy(false);
    }
  }

  async function markSent(id: string, force = false) {
    setError(null);
    setOk(null);
    try {
      await api(`/v1/production/batches/${id}/mark-sent`, {
        method: 'POST',
        json: { force },
      });
      setOk('Lote marcado como enviado.');
      await load();
      await runPreflight();
    } catch (e) {
      if (e instanceof ApiError && e.body && typeof e.body === 'object' && 'preflight' in e.body) {
        const pf = (e.body as { preflight: BatchPreflight }).preflight;
        setReport({
          generatedAt: new Date().toISOString(),
          totals: {
            batches: 1,
            ready: 1,
            blockers: pf.blockers,
            moneyRisks: pf.moneyRisks,
            qualityWarns: pf.qualityWarns,
            canSend: false,
          },
          summary: {
            missingStructures: pf.findings.filter((f) => f.severity === 'BLOCKER').map((f) => f.message),
            sendBlockers: pf.findings.filter((f) => f.severity === 'BLOCKER').map((f) => f.message),
            productionLossRisks: pf.findings.map((f) => f.moneyImpact || f.message).filter(Boolean) as string[],
            moneyLossRisks: pf.findings
              .filter((f) => f.severity === 'MONEY_RISK')
              .map((f) => f.moneyImpact || f.message),
          },
          batches: [pf],
          sigtap: { known: 0, unknown: 0, unknownCodes: [] },
          checklist: [],
        });
      }
      setError(e instanceof Error ? e.message : 'Falha ao marcar enviado');
    }
  }

  async function reprocess(id: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<{ outcome: string; status: string; errorMessage?: string | null }>(
        `/v1/production/batches/${id}/reprocess`,
        { method: 'POST', json: {} },
      );
      setOk(
        res.outcome === 'ready'
          ? 'Reprocessado → pronto para envio.'
          : `Reprocessado → ${res.status}${res.errorMessage ? `: ${res.errorMessage}` : ''}`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao reprocessar');
    } finally {
      setBusy(false);
    }
  }

  async function markError(id: string) {
    const message = prompt('Motivo do erro (opcional):') ?? undefined;
    if (message === null) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/production/batches/${id}/mark-error`, {
        method: 'POST',
        json: { message: message || undefined },
      });
      setOk('Lote marcado como erro.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao marcar erro');
    } finally {
      setBusy(false);
    }
  }

  async function reopen(id: string) {
    if (!confirm('Reabrir lote enviado para correção local?')) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/production/batches/${id}/reopen`, { method: 'POST', json: {} });
      setOk('Lote reaberto como pronto.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao reabrir');
    } finally {
      setBusy(false);
    }
  }

  async function exportBpa() {
    setError(null);
    setOk(null);
    try {
      const data = await api<BpaExport>('/v1/production/bpa/export');
      setBpa(data);
      const blob = new Blob([data.csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bpa-stub-${data.competencia}.csv`;
      a.click();
      setOk(
        `BPA ${data.format} · ${data.totalLines} linhas` +
          (data.sigtap ? ` · SIGTAP ${data.sigtap.known}/${data.sigtap.known + data.sigtap.unknown}` : ''),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no export BPA');
    }
  }

  return (
    <AppShell helpId="producao.ledi">
      <PageHeader
        title="Produção / LEDI / BPA"
        eyebrow="Gestão"
        description="Avalie estruturas antes de enviar — bloqueios e riscos de qualidade da produção/informação."
        actions={
          <>
            <HelpLink id="producao.ledi" />
            <Link className="btn btn-secondary" href="/sigtap">
              SIGTAP
            </Link>
            <Link className="btn btn-secondary" href="/lotacoes">
              Lotações
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ minHeight: 44 }}>
          <option value="">Todos os status</option>
          <option value="ready">Prontos</option>
          <option value="sent">Enviados</option>
          <option value="error">Erro</option>
          <option value="draft">Rascunho</option>
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ minHeight: 44 }}>
          <option value="">Todos os tipos</option>
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={busy}>
          Atualizar
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void runPreflight()} disabled={busy}>
          Avaliar antes de enviar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void sendProduction(false)}
          disabled={busy || (report ? !report.totals.canSend : false)}
        >
          Enviar produção
        </button>
        {report && !report.totals.canSend ? (
          <button type="button" className="btn btn-danger" onClick={() => void sendProduction(true)} disabled={busy}>
            Enviar mesmo assim
          </button>
        ) : null}
        <button type="button" className="btn btn-secondary" onClick={() => void exportBpa()} disabled={busy}>
          Exportar BPA stub
        </button>
      </div>

      {report ? (
        <div className="stack" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="section-label">Relatório pré-envio</div>
            <p style={{ marginTop: 0 }}>
              Gerado em {formatDateTime(report.generatedAt)}
              {report.competencia ? ` · competência ${report.competencia}` : ''}
            </p>
            <div className="grid-2">
              <div>
                <strong>{report.totals.batches}</strong> lote(s) ·{' '}
                <strong style={{ color: report.totals.canSend ? 'var(--ok)' : 'var(--danger, #b00020)' }}>
                  {report.totals.canSend ? 'APTO A ENVIAR' : 'BLOQUEADO'}
                </strong>
                <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>
                  Bloqueios: {report.totals.blockers} · Riscos financeiros: {report.totals.moneyRisks} ·
                  Qualidade: {report.totals.qualityWarns}
                </div>
              </div>
              <div>
                <div className="section-label">Checklist</div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {report.checklist.map((c) => (
                    <li key={c.id} style={{ color: c.ok ? 'inherit' : 'var(--danger, #b00020)' }}>
                      {c.ok ? '✓' : '✗'} {c.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="section-label">O que impede enviar</div>
              {report.summary.sendBlockers.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {report.summary.sendBlockers.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: 'var(--ink-3)' }}>Nenhum bloqueio estrutural.</p>
              )}
            </div>
            <div className="card">
              <div className="section-label">Risco de qualidade / perda de produção</div>
              {report.summary.moneyLossRisks.length || report.summary.productionLossRisks.length ? (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {[...new Set([...report.summary.moneyLossRisks, ...report.summary.productionLossRisks])]
                    .slice(0, 12)
                    .map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                </ul>
              ) : (
                <p style={{ margin: 0, color: 'var(--ink-3)' }}>Nenhum risco de qualidade listado.</p>
              )}
              {report.sigtap.unknownCodes.length ? (
                <p style={{ marginTop: 8 }}>
                  SIGTAP desconhecido: {report.sigtap.unknownCodes.join(', ')} —{' '}
                  <Link href="/sigtap">importar</Link>
                </p>
              ) : null}
            </div>
          </div>

          <div className="card">
            <div className="section-label">Por lote</div>
            {report.batches.map((b) => (
              <div key={b.batchId} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setExpanded(expanded === b.batchId ? null : b.batchId)}
                >
                  {expanded === b.batchId ? 'Ocultar' : 'Detalhar'}
                </button>{' '}
                <strong>{KIND_LABEL[b.kind] || b.kind}</strong>{' '}
                <span className="mono">{b.batchId.slice(0, 8)}</span> · {b.procedureCode || '—'} ·{' '}
                {b.blockers} bloq. / {b.moneyRisks} $ / {b.qualityWarns} qual.
                {expanded === b.batchId ? (
                  <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                    {b.findings.map((f, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        <strong>{SEV_LABEL[f.severity] || f.severity}</strong> — {f.message}
                        {f.hint ? (
                          <>
                            <br />
                            <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>Como corrigir: {f.hint}</span>
                          </>
                        ) : null}
                        {f.moneyImpact ? (
                          <>
                            <br />
                            <span style={{ color: 'var(--danger, #b00020)', fontSize: 13 }}>{f.moneyImpact}</span>
                          </>
                        ) : null}
                      </li>
                    ))}
                    {!b.findings.length ? <li>Sem pendências neste lote.</li> : null}
                  </ul>
                ) : null}
              </div>
            ))}
            {!report.batches.length ? <p style={{ color: 'var(--ink-3)' }}>Nenhum lote ready para avaliar.</p> : null}
          </div>
        </div>
      ) : (
        <div className="alert" style={{ marginBottom: 16 }}>
          Clique em <strong>Avaliar antes de enviar</strong> para gerar o relatório completo de estruturas,
          bloqueios e riscos financeiros.
        </div>
      )}

      {bpa?.sigtap?.unknownCodes?.length ? (
        <div className="alert">
          Códigos SIGTAP desconhecidos no último export: {bpa.sigtap.unknownCodes.slice(0, 8).join(', ')}
          {bpa.sigtap.unknownCodes.length > 8 ? '…' : ''} — importe em /sigtap.
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Criado em</th>
              <th>Tipo</th>
              <th>Status</th>
              <th>Erro / RF</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatDateTime(r.createdAt)}</td>
                <td>{KIND_LABEL[r.kind] || r.kind}</td>
                <td>{r.status}</td>
                <td>
                  {r.errorMessage ? (
                    <span style={{ color: 'var(--danger, #b00020)', fontSize: 13 }}>{r.errorMessage}</span>
                  ) : (
                    <span className="mono">{r.rfIdsCsv || '—'}</span>
                  )}
                </td>
                <td>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {r.status === 'ready' ? (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void markSent(r.id)}>
                          Enviar
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => void markError(r.id)}>
                          Erro
                        </button>
                      </>
                    ) : null}
                    {r.status === 'error' || r.status === 'draft' ? (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => void reprocess(r.id)}>
                        Reprocessar
                      </button>
                    ) : null}
                    {r.status === 'sent' ? (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => void reopen(r.id)}>
                        Reabrir
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <TableStateRow
                colSpan={5}
                loading={loading}
                empty="Nenhum lote — finalize APS, vacina, odonto, AD ou coletivo."
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
