'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, StatusPill, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { APPOINTMENT_STATUS_LABEL, displayPatientName, formatDateTime } from '@/lib/labels';

type Professional = { id: string; civilName: string; socialName?: string | null };
type Patient = { id: string; civilName: string; socialName?: string | null };
type Assignment = {
  id: string;
  cbo: string;
  roleLabel?: string | null;
  active: boolean;
  professionalId: string;
  team?: { id: string; name: string; ine?: string | null } | null;
};
type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  professionalId: string;
  patientId?: string | null;
  professional?: Professional;
  patient?: Patient | null;
  notes?: string | null;
  dentalEncounter?: { id: string; status: string } | null;
};

function dayBounds(isoDate: string) {
  const start = new Date(`${isoDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function OdontoAgendaPage() {
  const router = useRouter();
  const { facilityId } = useAuth();
  const [day, setDay] = useState(todayInputValue);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [professionalId, setProfessionalId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const range = useMemo(() => dayBounds(day), [day]);

  const assignmentsForProfessional = useMemo(
    () =>
      assignments.filter(
        (a) => a.active && (!professionalId || a.professionalId === professionalId),
      ),
    [assignments, professionalId],
  );

  async function load() {
    setError(null);
    if (!facilityId) {
      setSlots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        from: range.from,
        to: range.to,
        facilityId,
      });
      const assignQs = new URLSearchParams({ activeOnly: '1', facilityId });
      const [s, p, pts, assigns] = await Promise.all([
        api<Slot[]>(`/v1/appointments?${qs}`),
        api<Professional[]>('/v1/professionals'),
        api<Patient[]>('/v1/patients'),
        api<Assignment[]>(`/v1/assignments?${assignQs}`),
      ]);
      setSlots(s);
      setProfessionals(p);
      setPatients(pts);
      setAssignments(assigns);
      if (!professionalId && p[0]) setProfessionalId(p[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar agenda odonto');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId, range.from, range.to]);

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

  async function createSlot(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    setError(null);
    setOk(null);
    try {
      await api('/v1/appointments', {
        method: 'POST',
        json: {
          facilityId,
          professionalId,
          patientId: patientId || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          notes: 'odonto',
        },
      });
      setStartsAt('');
      setEndsAt('');
      setOk('Agendamento odonto criado.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar agendamento');
    }
  }

  async function openDental(slot: Slot) {
    if (!slot.patient && !slot.patientId) {
      setError('Vincule um paciente ao slot antes de abrir o atendimento.');
      return;
    }
    if (slot.dentalEncounter?.status === 'IN_PROGRESS') {
      router.push(`/odonto/${slot.dentalEncounter.id}`);
      return;
    }
    if (slot.dentalEncounter?.id) {
      router.push(`/odonto/${slot.dentalEncounter.id}`);
      return;
    }
    setBusyId(slot.id);
    setError(null);
    setOk(null);
    try {
      const assignForSlot =
        assignments.find((a) => a.active && a.professionalId === slot.professionalId) ||
        assignmentsForProfessional[0];
      const row = await api<{ id: string }>(`/v1/appointments/${slot.id}/open-dental`, {
        method: 'POST',
        json: {
          assignmentId: assignForSlot?.id || assignmentId || undefined,
        },
      });
      setOk('Atendimento odonto aberto a partir da agenda.');
      router.push(`/odonto/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir atendimento');
    } finally {
      setBusyId(null);
    }
  }

  async function markNoShow(id: string) {
    try {
      await api(`/v1/appointments/${id}/status`, {
        method: 'PATCH',
        json: { status: 'NO_SHOW' },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao marcar falta');
    }
  }

  return (
    <AppShell helpId="odonto.agenda">
      <PageHeader
        title="Agenda odontológica"
        eyebrow="RF-12.1 · parcial"
        description="Lista do dia · criar slot · abrir atendimento odonto a partir do agendamento."
        actions={
          <>
            <HelpLink id="odonto.agenda" />
            <Link className="btn btn-secondary" href="/odonto">
              Atendimentos
            </Link>
            <Link className="btn ghost" href="/agenda">
              Agenda geral
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {!facilityId ? (
        <div className="alert brand">Selecione uma unidade para ver a agenda odonto do dia.</div>
      ) : null}

      <div className="card row" style={{ marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Dia</label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <form className="card grid-2" onSubmit={createSlot} style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, gridColumn: '1 / -1' }}>Novo agendamento</h2>
        <div className="field">
          <label>Profissional</label>
          <select required value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {displayPatientName(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Lotação (para abertura)</label>
          <select
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            disabled={!assignmentsForProfessional.length}
          >
            {!assignmentsForProfessional.length ? (
              <option value="">Nenhuma lotação ativa</option>
            ) : (
              assignmentsForProfessional.map((a) => (
                <option key={a.id} value={a.id}>
                  CBO {a.cbo}
                  {a.team?.name ? ` · ${a.team.name}` : ''}
                  {a.team?.ine ? ` · INE ${a.team.ine}` : ' · sem INE'}
                </option>
              ))
            )}
          </select>
        </div>
        <div className="field">
          <label>Paciente</label>
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">—</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {displayPatientName(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Início</label>
          <input type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
        </div>
        <div className="field">
          <label>Fim</label>
          <input type="datetime-local" required value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
        </div>
        <div className="row" style={{ gridColumn: '1 / -1' }}>
          <button className="btn btn-primary" type="submit" disabled={!facilityId}>
            Agendar
          </button>
          <span className="muted">Na abertura, LEDI usa tipoAtendimento=2 (consulta agendada).</span>
        </div>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Horário</th>
              <th>Profissional</th>
              <th>Paciente</th>
              <th>Status</th>
              <th>Atendimento</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s) => (
              <tr key={s.id}>
                <td className="mono">{formatDateTime(s.startsAt)}</td>
                <td>{s.professional ? displayPatientName(s.professional) : '—'}</td>
                <td>{s.patient ? displayPatientName(s.patient) : '—'}</td>
                <td>
                  <StatusPill status={s.status} map={APPOINTMENT_STATUS_LABEL} />
                </td>
                <td>
                  {s.dentalEncounter ? (
                    <Link href={`/odonto/${s.dentalEncounter.id}`}>
                      {s.dentalEncounter.status === 'IN_PROGRESS' ? 'Em andamento' : s.dentalEncounter.status}
                    </Link>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        busyId === s.id ||
                        !s.patient ||
                        s.status === 'NO_SHOW' ||
                        s.status === 'CANCELLED' ||
                        s.status === 'COMPLETED'
                      }
                      onClick={() => void openDental(s)}
                    >
                      {busyId === s.id
                        ? 'Abrindo…'
                        : s.dentalEncounter
                          ? 'Continuar'
                          : 'Abrir atendimento'}
                    </button>
                    {s.status === 'SCHEDULED' || s.status === 'PRESENT' ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void markNoShow(s.id)}
                      >
                        Falta
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {!slots.length ? (
              <TableStateRow
                colSpan={6}
                loading={loading}
                empty={facilityId ? 'Nenhum agendamento neste dia nesta unidade.' : 'Selecione uma unidade.'}
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
