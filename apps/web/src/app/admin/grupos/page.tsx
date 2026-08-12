'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type Role = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  permissions: string[];
};

export default function GroupsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setRoles(await api<Role[]>('/v1/roles'));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Falha ao carregar perfis');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppShell helpId="admin.grupos">
      <PageHeader
        title="Grupos / Perfis"
        eyebrow="Administração"
        description="Matriz de permissões por perfil (leitura)."
        actions={<HelpLink id="admin.grupos" />}
      />
      <ErrorBox message={error} />
      {loading && !roles.length ? <p className="table-state">Carregando…</p> : null}
      <div className="stack">
        {roles.map((r) => (
          <div className="card" key={r.id}>
            <strong>{r.name}</strong>
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
              {r.code} · {r.description || '—'}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              {r.permissions.map((p) => (
                <span className="pill brand" key={p}>
                  {p}
                </span>
              ))}
            </div>
          </div>
        ))}
        {!roles.length && !loading ? (
          <div className="table-wrap">
            <table className="data">
              <tbody>
                <TableStateRow colSpan={1} empty="Nenhum perfil encontrado." />
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
