'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type Severity = 'error' | 'warn' | 'info';

type Finding = {
  code: string;
  severity: Severity;
  message: string;
  entityType: string;
  entityId?: string | null;
  cnes?: string | null;
  ine?: string | null;
  ibgeCode?: string | null;
  details?: Record<string, unknown>;
};

type AuditReport = {
  ibgeCode: string;
  generatedAt: string;
  snapshotPath?: string;
  counts: {
    findings: number;
    bySeverity: Record<Severity, number>;
    byCode: Record<string, number>;
    facilitiesInScope: number;
    teamsInScope: number;
  };
  findings: Finding[];
  heuristics: { teamFacilityType: string };
};

type SyncResult = {
  ibgeCode: string;
  source: string;
  facilities: { created: number; updated: number; skipped: number };
  teams: { created: number; updated: number; skipped: number };
  totals: { establishments: number; teams: number; establishmentsActive: number };
};

const SEV_LABEL: Record<Severity, string> = {
  error: 'Erro',
  warn: 'Alerta',
  info: 'Info',
};

export default function CnesAuditoriaPage() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [severity, setSeverity] = useState<'' | Severity>('');
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuditReport>('/v1/cnes/audit?ibge=3516200');
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar auditoria CNES');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSync() {
    setSyncing(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<SyncResult>('/v1/cnes/sync?ibge=3516200&source=snapshot', {
        method: 'POST',
      });
      setOk(
        `Sync ${res.source}: estabelecimentos +${res.facilities.created}/~${res.facilities.updated} · equipes +${res.teams.created}/~${res.teams.updated} (snapshot ${res.totals.establishments} est. / ${res.totals.teams} eq.)`,
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no sync CNES');
    } finally {
      setSyncing(false);
    }
  }

  const codes = useMemo(() => {
    if (!report) return [];
    return Object.keys(report.counts.byCode || {}).sort();
  }, [report]);

  const filtered = useMemo(() => {
    if (!report) return [];
    return report.findings.filter((f) => {
      if (severity && f.severity !== severity) return false;
      if (code && f.code !== code) return false;
      if (!q.trim()) return true;
      const hay = `${f.code} ${f.message} ${f.cnes || ''} ${f.ine || ''} ${f.entityType}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [report, severity, code, q]);

  function exportCsv() {
    const rows = filtered.length ? filtered : report?.findings || [];
    const header = ['severity', 'code', 'message', 'entityType', 'entityId', 'cnes', 'ine', 'ibgeCode'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      header.join(','),
      ...rows.map((f) =>
        [f.severity, f.code, f.message, f.entityType, f.entityId, f.cnes, f.ine, f.ibgeCode]
          .map(esc)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cnes-auditoria-3516200-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell helpId="cadastros.cnes-auditoria">
      <PageHeader
        title="Auditoria cadastro CNES"
        eyebrow="Cadastros"
        description="Inconsistências do cadastro municipal (IBGE 3516200 — Franca) vs snapshot CNES. Sem dados de pacientes."
        actions={
          <>
            <HelpLink id="cadastros.cnes-auditoria" />
            <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
              Recarregar
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => void runSync()} disabled={syncing}>
              {syncing ? 'Sincronizando…' : 'Sync snapshot'}
            </button>
            <button type="button" className="btn" onClick={exportCsv} disabled={!report?.findings.length}>
              Export CSV
            </button>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {report ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
            <span>
              Findings: <strong>{report.counts.findings}</strong>
            </span>
            <span style={{ color: 'var(--danger, #b91c1c)' }}>
              Erros: {report.counts.bySeverity.error || 0}
            </span>
            <span>Alertas: {report.counts.bySeverity.warn || 0}</span>
            <span>Info: {report.counts.bySeverity.info || 0}</span>
            <span className="muted">
              Escopo: {report.counts.facilitiesInScope} unidades · {report.counts.teamsInScope} equipes
            </span>
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5, maxWidth: 820 }}>
            Heurística tipo equipe × unidade: {report.heuristics.teamFacilityType}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <select
          className="field-input"
          style={{ minHeight: 40, padding: '8px 10px' }}
          value={severity}
          onChange={(e) => setSeverity(e.target.value as '' | Severity)}
        >
          <option value="">Todas severidades</option>
          <option value="error">Erro</option>
          <option value="warn">Alerta</option>
          <option value="info">Info</option>
        </select>
        <select
          className="field-input"
          style={{ minHeight: 40, padding: '8px 10px', minWidth: 220 }}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        >
          <option value="">Todos os códigos</option>
          {codes.map((c) => (
            <option key={c} value={c}>
              {c} ({report?.counts.byCode[c] || 0})
            </option>
          ))}
        </select>
        <input
          className="field-input"
          style={{ flex: 1, minWidth: 180, minHeight: 40, padding: '8px 10px' }}
          placeholder="Filtrar mensagem, CNES, INE…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Severidade</th>
              <th>Código</th>
              <th>Mensagem</th>
              <th>CNES</th>
              <th>INE</th>
              <th>Entidade</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={`${f.code}-${f.entityId || i}-${f.cnes || ''}-${f.ine || ''}`}>
                <td>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        f.severity === 'error'
                          ? 'var(--danger, #b91c1c)'
                          : f.severity === 'warn'
                            ? 'var(--warn, #b45309)'
                            : 'var(--ink-3)',
                    }}
                  >
                    {SEV_LABEL[f.severity]}
                  </span>
                </td>
                <td className="mono">{f.code}</td>
                <td>{f.message}</td>
                <td className="mono">{f.cnes || '—'}</td>
                <td className="mono">{f.ine || '—'}</td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {f.entityType}
                  {f.entityId ? ` · ${f.entityId.slice(0, 8)}` : ''}
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <TableStateRow colSpan={6} loading={loading} empty="Nenhum finding com os filtros atuais." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
