'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader, StatusPill } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ENCOUNTER_STATUS_LABEL, displayPatientName, formatDateTime } from '@/lib/labels';

type Patient = { id: string; civilName: string; socialName?: string | null };
type Encounter = {
  id: string;
  status: string;
  startedAt: string;
  patient: Patient;
};

const STATUS_FILTER = Object.keys(ENCOUNTER_STATUS_LABEL);

export default function QueuePage() {
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Encounter[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!facilityId) return;
    setError(null);
    try {
      const qs = new URLSearchParams({ facilityId });
      if (status) qs.set('status', status);
      const [q, pts] = await Promise.all([
        api<Encounter[]>(`/v1/encounters/queue?${qs}`),
        api<Patient[]>('/v1/patients'),
      ]);
      setRows(q);
      setPatients(pts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar fila');
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId, status]);

  async function openEncounter(e: FormEvent) {
    e.preventDefault();
    if (!facilityId || !patientId) return;
    setError(null);
    try {
      const enc = await api<{ id: string; reused?: boolean }>('/v1/encounters', {
        method: 'POST',
        json: { patientId, facilityId, careLocation: 'UBS', shift: 'MANHA' },
      });
      // Já na fila do dia → continua o mesmo atendimento (sem 409)
      window.location.href = `/atendimento/${enc.id}${enc.reused ? '?continuado=1' : ''}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir atendimento');
    }
  }

  return (
    <AppShell helpId="atendimento.fila">
      <PageHeader
        title="Fila de atendimento"
        eyebrow="Operação"
        description="Status D2 — Aguardando até Evadiu."
        actions={<HelpLink id="atendimento.fila" />}
      />
      <ErrorBox message={error} />

      <form className="card row" onSubmit={openEncounter} style={{ marginBottom: 12 }}>
        <select
          required
          value={patientId}
          onChange={(e) => setPatientId(e.target.value)}
          style={{ flex: 1, minHeight: 44 }}
        >
          <option value="">Selecionar paciente para entrada na fila…</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{displayPatientName(p)}</option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">Entrar na fila</button>
      </form>

      <div className="row" style={{ marginBottom: 12 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ minHeight: 44 }}>
          <option value="">Todos os status ativos</option>
          {STATUS_FILTER.map((s) => (
            <option key={s} value={s}>{ENCOUNTER_STATUS_LABEL[s].label}</option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Entrada</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{displayPatientName(r.patient)}</td>
                <td className="mono">{formatDateTime(r.startedAt)}</td>
                <td>
                  <StatusPill status={r.status} map={ENCOUNTER_STATUS_LABEL} />
                </td>
                <td>
                  <Link className="btn btn-primary" href={`/atendimento/${r.id}`}>
                    Atender
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4}>Fila vazia.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
