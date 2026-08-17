'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type TeamMember = {
  assignmentId: string;
  professionalId: string;
  name: string;
  cns: string | null;
  cbo: string;
  cboLabel: string;
  roleLabel: string | null;
  active: boolean;
  startedAt: string;
};

type TeamDetail = {
  id: string;
  name: string;
  ine: string | null;
  teamTypeId: string;
  teamTypeLabel: string;
  active: boolean;
  memberCount: number;
  hasMembers: boolean;
  facility: { id: string; name: string; cnes: string | null; municipalNetwork: boolean };
  members: TeamMember[];
};

export default function EquipeDetailPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<TeamDetail>(`/v1/cnes/teams/${id}`)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Falha ao carregar equipe');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell helpId="cadastros.equipes">
      <PageHeader
        title={detail?.name || 'Equipe'}
        eyebrow="Cadastros · Equipes"
        description={
          detail
            ? `${detail.teamTypeId} — ${detail.teamTypeLabel} · INE ${detail.ine || '—'} · ${detail.facility.name}${detail.facility.cnes ? ` (${detail.facility.cnes})` : ''}`
            : 'Membros lotados na equipe CNES (rede municipal).'
        }
        actions={
          <>
            <HelpLink id="cadastros.equipes" />
            <Link className="btn btn-secondary" href="/equipes">
              Todas as equipes
            </Link>
            <Link className="btn btn-secondary" href="/equipes?tab=multi">
              Multi-equipe
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />

      <div className="card">
        <div className="section-label">Membros ({detail?.memberCount ?? 0})</div>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNS</th>
                <th>CBO / função</th>
                <th>Vínculo</th>
              </tr>
            </thead>
            <tbody>
              {(detail?.members || []).map((m) => (
                <tr key={m.assignmentId}>
                  <td>{m.name}</td>
                  <td className="mono">{m.cns || '—'}</td>
                  <td>
                    {m.cboLabel}
                    <div className="muted mono" style={{ fontSize: 12 }}>
                      {m.cbo}
                    </div>
                  </td>
                  <td>{m.active ? 'Ativo' : 'Encerrado'}</td>
                </tr>
              ))}
              {!(detail?.members || []).length ? (
                <TableStateRow
                  colSpan={4}
                  loading={loading}
                  empty="Sem membros ativos — importe profissionais lotados em /equipes ou na auditoria CNES."
                />
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
