'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export type PendingIssueRow = {
  code: string;
  severity: string;
  title: string;
  how: string;
  channel: string;
  blocksSiaps: boolean;
  impact: 'siaps' | 'qualidade_previne';
};

export type PendingFichaRow = {
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
  gate: 'bloqueia_siaps' | 'qualidade_previne';
  issues: PendingIssueRow[];
};

export type PendingReportPayload = {
  batchId: string;
  name: string;
  generatedAt: string;
  expectedTipo: string;
  totalFichas: number;
  pendingCount: number;
  severityFilter: string[] | null;
  countsBySeverity: { BLOCKER: number; MONEY_RISK: number; QUALITY_WARN: number };
  fichas: PendingFichaRow[];
  csv: string;
  markdown: string;
};

function downloadText(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  batchId: string;
  fileSlug: string;
  disabled?: boolean;
};

export function PendingReportPanel({ batchId, fileSlug, disabled }: Props) {
  const [severity, setSeverity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<PendingReportPayload | null>(null);

  async function load() {
    setBusy(true);
    setError(null);
    try {
      const q = severity ? `?severity=${encodeURIComponent(severity)}` : '';
      const data = await api<PendingReportPayload>(
        `/v1/dental/ledi/batches/${batchId}/pending-report${q}`,
      );
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao gerar o relatório');
    } finally {
      setBusy(false);
    }
  }

  const slug = `ledi-${fileSlug}-pendencias-${batchId.slice(0, 8)}`;

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Relatório do que falta</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Depois do tratamento automático, lista só as fichas que ainda não estão ideais (bloqueio de
        envio, risco de qualidade ou aviso). CPF/CNS mascarados — sem XML clínico.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          disabled={busy || disabled}
        >
          <option value="">Todas as pendências</option>
          <option value="BLOCKER">Só BLOCKER (bloqueia Siaps)</option>
          <option value="MONEY_RISK">Só MONEY_RISK</option>
          <option value="QUALITY_WARN">Só QUALITY_WARN</option>
        </select>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || disabled}
          onClick={() => void load()}
        >
          {busy ? 'Gerando…' : 'Relatório do que falta'}
        </button>
        {report ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                downloadText(`${slug}.csv`, `\uFEFF${report.csv}`, 'text/csv;charset=utf-8')
              }
            >
              Baixar CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                downloadText(`${slug}.md`, report.markdown, 'text/markdown;charset=utf-8')
              }
            >
              Baixar Markdown
            </button>
          </>
        ) : null}
      </div>
      {error ? (
        <p className="muted" style={{ color: 'var(--danger)', marginTop: 8 }}>
          {error}
        </p>
      ) : null}
      {report ? (
        <div style={{ marginTop: 12 }}>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            {report.pendingCount} ficha(s) neste recorte de {report.totalFichas} · BLOCKER{' '}
            {report.countsBySeverity.BLOCKER} · MONEY_RISK {report.countsBySeverity.MONEY_RISK} ·
            QUALITY_WARN {report.countsBySeverity.QUALITY_WARN}
          </p>
          {!report.fichas.length ? (
            <p className="muted">Nada pendente neste filtro — lote ideal ou só INFO restante.</p>
          ) : (
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th align="left">Arquivo</th>
                    <th align="left">UUID</th>
                    <th align="left">CPF / CNS</th>
                    <th>Data</th>
                    <th align="left">Profissional</th>
                    <th align="left">Gate</th>
                    <th align="left">O que falta</th>
                  </tr>
                </thead>
                <tbody>
                  {report.fichas.map((f) => (
                    <tr key={f.itemId}>
                      <td>{f.fileName}</td>
                      <td>
                        <code style={{ fontSize: 11 }}>{f.uuidFicha || '—'}</code>
                      </td>
                      <td>
                        {f.cpfMasked || '—'}
                        <br />
                        <span className="muted">{f.cnsMasked || '—'}</span>
                      </td>
                      <td align="center">{f.dataAtendimento || '—'}</td>
                      <td>{f.profissionalCnsMasked || '—'}</td>
                      <td>
                        {f.gate === 'bloqueia_siaps' ? (
                          <strong>bloqueia Siaps/envio</strong>
                        ) : (
                          <span>só qualidade / Previne</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {f.issues.map((iss) => (
                          <div key={iss.code} style={{ marginBottom: 4 }}>
                            <code>{iss.code}</code>{' '}
                            <span className="muted">{iss.severity}</span>
                            <br />
                            {iss.title}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
