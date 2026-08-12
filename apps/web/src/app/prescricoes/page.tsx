'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Row = {
  id: string;
  status: string;
  recipeType: string;
  hasOffCatalog: boolean;
  issuedAt?: string | null;
  createdAt: string;
  patient: { civilName: string; socialName?: string | null };
  items: Array<{ freeTextName?: string | null; medication?: { name: string } | null }>;
};

export default function PrescriptionsPage() {
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (facilityId) qs.set('facilityId', facilityId);
      if (status) qs.set('status', status);
      setRows(await api<Row[]>(`/v1/prescriptions?${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao listar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId, status]);

  return (
    <AppShell helpId="atendimento.prescricao">
      <PageHeader
        title="Prescrições / receitas"
        eyebrow="Operação"
        description="Receituário APS — catálogo municipal e emissão (RF-3.33 / RF-3.67)."
        actions={<HelpLink id="atendimento.prescricao" />}
      />
      <ErrorBox message={error} />
      <div className="row" style={{ marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ minHeight: 44 }}>
          <option value="">Todos</option>
          <option value="DRAFT">Rascunho</option>
          <option value="ISSUED">Emitidas</option>
          <option value="CANCELLED">Canceladas</option>
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Paciente</th>
              <th>Tipo</th>
              <th>Itens</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatDateTime(r.issuedAt || r.createdAt)}</td>
                <td>{displayPatientName(r.patient)}</td>
                <td>{r.recipeType}</td>
                <td>
                  {r.items.map((i) => i.medication?.name || i.freeTextName).join(', ')}
                  {r.hasOffCatalog ? ' *' : ''}
                </td>
                <td>{r.status}</td>
                <td>
                  <Link href={`/prescricoes/${r.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <TableStateRow
                colSpan={6}
                loading={loading}
                empty="Nenhuma receita — prescreva no atendimento clínico."
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
