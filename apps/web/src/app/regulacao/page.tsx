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
  priority: string;
  procedureName: string;
  procedureCode: string;
  offProtocol: boolean;
  classification?: string | null;
  createdAt: string;
  patient: { civilName: string; socialName?: string | null };
  facility: { name: string };
};

export default function RegulationQueuePage() {
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState('');
  const [openOnly, setOpenOnly] = useState(true);
  const [scope, setScope] = useState<'unit' | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (scope === 'unit' && facilityId) qs.set('facilityId', facilityId);
      if (status) qs.set('status', status);
      if (openOnly && !status) qs.set('openOnly', '1');
      setRows(await api<Row[]>(`/v1/regulation/requests?${qs}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao listar');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId, status, openOnly, scope]);

  return (
    <AppShell helpId="regulacao.fila">
      <PageHeader
        title="Central de regulação"
        eyebrow="Gestão"
        description="Fila de solicitações de procedimentos (RF-3.52 / RF-13)."
        actions={<HelpLink id="regulacao.fila" />}
      />
      <ErrorBox message={error} />
      <div className="row" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        <select value={scope} onChange={(e) => setScope(e.target.value as 'unit' | 'all')} style={{ minHeight: 44 }}>
          <option value="all">Todas as unidades</option>
          <option value="unit">Só unidade atual</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ minHeight: 44 }}>
          <option value="">Status (filtro)</option>
          <option value="SUBMITTED">Enviadas</option>
          <option value="CLASSIFIED">Classificadas</option>
          <option value="RETURNED">Devolvidas</option>
          <option value="AUTHORIZED">Autorizadas</option>
          <option value="SCHEDULED">Agendadas</option>
          <option value="DENIED">Negadas</option>
          <option value="CLOSED">Encerradas</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} disabled={!!status} />
          Só abertas
        </label>
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
              <th>Unidade</th>
              <th>Procedimento</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatDateTime(r.createdAt)}</td>
                <td>{displayPatientName(r.patient)}</td>
                <td>{r.facility.name}</td>
                <td>
                  {r.procedureName}
                  {r.offProtocol ? ' *' : ''}
                </td>
                <td>
                  {r.priority}
                  {r.classification ? ` · ${r.classification}` : ''}
                </td>
                <td className="mono">{r.status}</td>
                <td>
                  <Link href={`/regulacao/${r.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <TableStateRow
                colSpan={7}
                loading={loading}
                empty="Nenhuma solicitação — envie pelo atendimento clínico."
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
