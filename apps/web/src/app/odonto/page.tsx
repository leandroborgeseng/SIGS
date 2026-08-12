'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
type Row = {
  id: string;
  status: string;
  startedAt: string;
  encounterType: string;
  patient: Patient;
  productionBatchId?: string | null;
};

export default function OdontoPage() {
  const router = useRouter();
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [anamnese, setAnamnese] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const qs = facilityId ? `?facilityId=${facilityId}` : '';
    const [list, pts, profs] = await Promise.all([
      api<Row[]>(`/v1/dental-encounters${qs}`),
      api<Patient[]>('/v1/patients'),
      api<Professional[]>('/v1/professionals'),
    ]);
    setRows(list);
    setPatients(pts);
    setProfessionals(profs);
    if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [facilityId]);

  async function open(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    if (!patientId) return setError('Selecione o paciente.');
    setError(null);
    setBusy(true);
    try {
      const row = await api<{ id: string }>('/v1/dental-encounters', {
        method: 'POST',
        json: {
          patientId,
          facilityId,
          professionalId: professionalId || undefined,
          anamnese: anamnese || undefined,
          encounterType: 'CONSULTA',
          procedures: [{ tooth: '11', code: '0301010030', label: 'Consulta odontológica', done: false }],
        },
      });
      router.push(`/odonto/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Odontologia"
        subtitle="Atendimento clínico Siaps-ready (LEDI FAO) · Onda 1"
        actions={
          <>
            <HelpLink id="odonto.atendimento" />
            <Link className="btn ghost" href="/odonto/lote">
              Lote LEDI FAO
            </Link>
            <Link className="btn ghost" href="/odonto/faturamento">
              Fila faturamento
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />

      <section className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Novo atendimento</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Tipo padrão: <strong>5 — consulta no dia</strong>. Cada abertura entra na{' '}
          <Link href="/odonto/faturamento">fila de faturamento</Link> do mês.
        </p>
        <form onSubmit={open} className="grid-form">
          <label>
            Paciente
            <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
              <option value="">—</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {displayPatientName(p)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Profissional
            <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
              <option value="">—</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.civilName}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Anamnese (opcional)
            <textarea value={anamnese} onChange={(e) => setAnamnese(e.target.value)} rows={2} />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Abrindo…' : 'Abrir atendimento'}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Atendimentos</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Paciente</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatDateTime(r.startedAt)}</td>
                <td>{displayPatientName(r.patient)}</td>
                <td>{r.status}</td>
                <td>
                  <Link href={`/odonto/${r.id}`}>Abrir</Link>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={4} className="muted">
                  Nenhum atendimento ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </AppShell>
  );
}
