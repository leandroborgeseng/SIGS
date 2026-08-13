'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
type Assignment = {
  id: string;
  cbo: string;
  roleLabel?: string | null;
  active: boolean;
  professionalId: string;
  professional: Professional;
  team?: { id: string; name: string; ine?: string | null } | null;
};
type Row = {
  id: string;
  status: string;
  startedAt: string;
  encounterType: string;
  patient: Patient;
  productionBatchId?: string | null;
};

function statusLabel(status: string) {
  if (status === 'IN_PROGRESS') return 'Em atendimento';
  if (status === 'COMPLETED') return 'Finalizado';
  if (status === 'VOID') return 'Anulado';
  return status;
}

export default function OdontoPage() {
  const router = useRouter();
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [anamnese, setAnamnese] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const assignmentsForProfessional = useMemo(
    () =>
      assignments.filter(
        (a) => a.active && (!professionalId || a.professionalId === professionalId),
      ),
    [assignments, professionalId],
  );

  async function load() {
    const qs = facilityId ? `?facilityId=${facilityId}` : '';
    const assignQs = new URLSearchParams({ activeOnly: '1' });
    if (facilityId) assignQs.set('facilityId', facilityId);
    const [list, pts, profs, assigns] = await Promise.all([
      api<Row[]>(`/v1/dental-encounters${qs}`),
      api<Patient[]>('/v1/patients'),
      api<Professional[]>('/v1/professionals'),
      api<Assignment[]>(`/v1/assignments?${assignQs}`),
    ]);
    setRows(list);
    setPatients(pts);
    setProfessionals(profs);
    setAssignments(assigns);
    if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [facilityId]);

  useEffect(() => {
    const match = assignmentsForProfessional;
    if (!match.length) {
      setAssignmentId('');
      return;
    }
    if (!match.some((a) => a.id === assignmentId)) {
      setAssignmentId(match[0].id);
    }
  }, [assignmentsForProfessional, assignmentId, professionalId]);

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
          assignmentId: assignmentId || undefined,
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
        description="Atendimento clínico Siaps-ready (LEDI FAO) · Onda 1"
        actions={
          <>
            <HelpLink id="odonto.atendimento" />
            <Link className="btn ghost" href="/faturamento/lote/fao">
              Lote LEDI FAO
            </Link>
            <Link className="btn ghost" href="/faturamento/odonto">
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
          <Link href="/faturamento/odonto">fila de faturamento</Link> do mês.
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
            <select
              value={professionalId}
              onChange={(e) => {
                setProfessionalId(e.target.value);
                setAssignmentId('');
              }}
            >
              <option value="">—</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.civilName}
                </option>
              ))}
            </select>
          </label>
          <label className="span-2">
            Lotação / equipe
            <select
              value={assignmentId}
              onChange={(e) => setAssignmentId(e.target.value)}
              disabled={!assignmentsForProfessional.length}
            >
              {!assignmentsForProfessional.length ? (
                <option value="">Nenhuma lotação ativa nesta unidade</option>
              ) : (
                assignmentsForProfessional.map((a) => (
                  <option key={a.id} value={a.id}>
                    CBO {a.cbo}
                    {a.team?.name ? ` · ${a.team.name}` : ''}
                    {a.team?.ine ? ` · INE ${a.team.ine}` : ' · sem INE'}
                    {a.roleLabel ? ` · ${a.roleLabel}` : ''}
                  </option>
                ))
              )}
            </select>
          </label>
          {!assignmentsForProfessional.length && professionalId ? (
            <p className="muted span-2" style={{ margin: 0 }}>
              Cadastre lotação em <Link href="/lotacoes">/lotacoes</Link> (CBO + equipe com INE se
              obrigatório).
            </p>
          ) : null}
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
                <td>{statusLabel(r.status)}</td>
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
