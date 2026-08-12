'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/labels';

type Audit = {
  id: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  at: string;
  rfIds?: string[];
};

export default function AuditPage() {
  const [rows, setRows] = useState<Audit[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setRows(await api<Audit[]>('/v1/audit?limit=200'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Sem permissão de auditoria');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const hay = `${r.action} ${r.resourceType} ${r.resourceId || ''} ${(r.rfIds || []).join(' ')}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AppShell helpId="admin.auditoria">
      <PageHeader
        title="Auditoria"
        eyebrow="Administração"
        description="Log de ações do sistema (últimos 200)."
        actions={<HelpLink id="admin.auditoria" />}
      />
      <ErrorBox message={error} />
      <div className="card" style={{ marginBottom: 12 }}>
        <input
          className="field-input"
          style={{ width: '100%', minHeight: 44, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)' }}
          placeholder="Buscar ação, entidade, RF…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Ação</th>
              <th>Entidade</th>
              <th>RF</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatDateTime(r.at)}</td>
                <td>{r.action}</td>
                <td className="mono">
                  {r.resourceType} {r.resourceId || ''}
                </td>
                <td className="mono">{(r.rfIds || []).join(', ') || '—'}</td>
              </tr>
            ))}
            {!filtered.length ? (
              <TableStateRow colSpan={4} loading={loading} empty="Nenhum registro." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
