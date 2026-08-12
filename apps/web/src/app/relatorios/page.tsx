'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ENCOUNTER_STATUS_LABEL, formatDateTime } from '@/lib/labels';

type EncReport = {
  items: Array<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string | null;
    patientName: string;
    facilityName: string;
  }>;
  byStatus?: Record<string, number>;
};

type VacReport = {
  items: Array<{
    recordId: string;
    appliedAt: string;
    patientName: string;
    facilityName: string;
    immunobiological?: string;
  }>;
};

function toCsv(rows: string[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function monthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsPage() {
  const { facilityId } = useAuth();
  const [tab, setTab] = useState<'encounters' | 'vaccinations'>('encounters');
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [enc, setEnc] = useState<EncReport | null>(null);
  const [vac, setVac] = useState<VacReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set('from', new Date(from).toISOString());
    if (to) {
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      qs.set('to', end.toISOString());
    }
    if (facilityId) qs.set('facilityId', facilityId);
    try {
      if (tab === 'encounters') {
        const data = await api<EncReport>(`/v1/reports/encounters?${qs}`);
        setEnc(data);
        setOk(`${data.items.length} atendimento(s) no período.`);
      } else {
        const data = await api<VacReport>(`/v1/reports/vaccinations?${qs}`);
        setVac(data);
        setOk(`${data.items.length} registro(s) de vacina no período.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no relatório');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [tab, facilityId]);

  function exportCsv() {
    if (tab === 'encounters' && enc) {
      const csv = toCsv([
        ['id', 'paciente', 'unidade', 'status', 'inicio', 'fim'],
        ...enc.items.map((i) => [
          i.id,
          i.patientName,
          i.facilityName,
          ENCOUNTER_STATUS_LABEL[i.status]?.label || i.status,
          i.startedAt,
          i.finishedAt || '',
        ]),
      ]);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'relatorio-atendimentos.csv';
      a.click();
    }
    if (tab === 'vaccinations' && vac) {
      const csv = toCsv([
        ['id', 'paciente', 'unidade', 'aplicado_em', 'imuno'],
        ...vac.items.map((i) => [
          i.recordId,
          i.patientName,
          i.facilityName,
          i.appliedAt,
          i.immunobiological || '',
        ]),
      ]);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'relatorio-vacinas.csv';
      a.click();
    }
  }

  return (
    <AppShell helpId="relatorios.minimos">
      <PageHeader
        title="Relatórios"
        eyebrow="Gestão"
        description="Atendimentos e vacinas por período · escopo da unidade selecionada."
        actions={<HelpLink id="relatorios.minimos" />}
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />
      <div className="row" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className={`btn ${tab === 'encounters' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('encounters')}
        >
          Atendimentos
        </button>
        <button
          type="button"
          className={`btn ${tab === 'vaccinations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('vaccinations')}
        >
          Vacinas
        </button>
      </div>
      <form className="card row" onSubmit={load} style={{ marginBottom: 12 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>De</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Até</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" style={{ alignSelf: 'end' }} disabled={loading}>
          {loading ? 'Filtrando…' : 'Filtrar'}
        </button>
        <button className="btn btn-secondary" type="button" style={{ alignSelf: 'end' }} onClick={exportCsv}>
          Exportar CSV
        </button>
      </form>

      {tab === 'encounters' ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Unidade</th>
                <th>Status</th>
                <th>Início</th>
              </tr>
            </thead>
            <tbody>
              {(enc?.items || []).map((i) => (
                <tr key={i.id}>
                  <td>{i.patientName}</td>
                  <td>{i.facilityName}</td>
                  <td>{ENCOUNTER_STATUS_LABEL[i.status]?.label || i.status}</td>
                  <td className="mono">{formatDateTime(i.startedAt)}</td>
                </tr>
              ))}
              {!enc?.items?.length ? (
                <TableStateRow colSpan={4} loading={loading} empty="Sem atendimentos no período." />
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Unidade</th>
                <th>Aplicado em</th>
              </tr>
            </thead>
            <tbody>
              {(vac?.items || []).map((i, idx) => (
                <tr key={`${i.recordId}-${idx}`}>
                  <td>{i.patientName}</td>
                  <td>{i.facilityName}</td>
                  <td className="mono">{formatDateTime(i.appliedAt)}</td>
                </tr>
              ))}
              {!vac?.items?.length ? (
                <TableStateRow colSpan={3} loading={loading} empty="Sem vacinas no período." />
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
