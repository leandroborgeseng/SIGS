'use client';

import { FormEvent, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type MigrateReport = {
  dryRun: boolean;
  filesInZip: number;
  processed: number;
  truncated?: boolean;
  ok: number;
  rejected: number;
  persistedRecords: number;
  byCode: Record<string, number>;
  samples: Array<{ fileName: string; blockers: string[] }>;
};

export default function MigracaoZipPage() {
  const { hasPermission } = useAuth();
  const can = hasPermission('*') || hasPermission('production.manage');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [persist, setPersist] = useState(false);
  const [report, setReport] = useState<MigrateReport | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setError('Selecione um ZIP LEDI');
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('dryRun', persist ? '0' : '1');
      const res = await api<MigrateReport>('/v1/clinical-core/migrate-zip', {
        method: 'POST',
        body: fd,
      });
      setReport(res);
      setOk(
        res.dryRun
          ? `Dry-run: ${res.ok} ok · ${res.rejected} com blocker · ${res.processed}/${res.filesInZip} arquivos`
          : `Persistido: ${res.persistedRecords} ProductionRecord · ${res.ok} fichas · ${res.rejected} rejeitadas`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na migração');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell helpId="pacientes.migracao-zip">
      <PageHeader
        title="Migração ZIP → Paciente Mestre"
        eyebrow="Clinical core"
        description="Dry-run ou persistência de XMLs LEDI em ProductionRecord + Paciente Mestre. Sem PHI no relatório."
        actions={<HelpLink id="pacientes.migracao-zip" />}
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {!can ? (
        <p>Requer permissão de produção/TI.</p>
      ) : (
        <>
          <div
            className="card"
            style={{
              marginBottom: 16,
              padding: '12px 14px',
              background: 'var(--surface-2)',
              border: '1px solid var(--line)',
            }}
          >
            <div className="section-label" style={{ marginBottom: 4 }}>
              Como usar
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.5 }}>
              <li>Envie um ZIP LEDI. Default = dry-run (só contagens, sem PHI).</li>
              <li>Marque Persistir apenas para gravar Paciente Mestre + ProductionRecord.</li>
              <li>
                Reduz findings P×2 (<span className="mono">*_CNS_NOT_IN_CADASTRO_INDIVIDUAL</span>) na
                auditoria.
              </li>
            </ol>
          </div>
          <form className="card" onSubmit={onSubmit}>
            <div className="field">
              <label>ZIP LEDI</label>
              <input name="file" type="file" accept=".zip,application/zip" disabled={busy} />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={persist}
                onChange={(e) => setPersist(e.target.checked)}
                disabled={busy}
              />
              Persistir (desmarque = dry-run)
            </label>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? 'Processando…' : persist ? 'Migrar ZIP' : 'Dry-run ZIP'}
            </button>
          </form>
        </>
      )}

      {report ? (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-label">Relatório</div>
          <p style={{ fontSize: 13 }}>
            Modo: {report.dryRun ? 'dry-run' : 'persist'} · processados {report.processed}/
            {report.filesInZip}
            {report.truncated ? ' (truncado)' : ''} · ok {report.ok} · rejeitados {report.rejected}
            {!report.dryRun ? ` · records ${report.persistedRecords}` : ''}
          </p>
          {Object.keys(report.byCode).length ? (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(report.byCode)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 40)
                    .map(([c, n]) => (
                      <tr key={c}>
                        <td className="mono">{c}</td>
                        <td>{n}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {report.samples.length ? (
            <ul style={{ fontSize: 13 }}>
              {report.samples.map((s) => (
                <li key={s.fileName}>
                  <span className="mono">{s.fileName}</span>: {s.blockers.join(', ') || '—'}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
