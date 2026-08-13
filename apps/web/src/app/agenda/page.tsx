'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, StatusPill, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { APPOINTMENT_STATUS_LABEL, displayPatientName, formatDateTime } from '@/lib/labels';

type Professional = { id: string; civilName: string; socialName?: string | null };
type Patient = { id: string; civilName: string; socialName?: string | null };
type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  professional?: Professional;
  patient?: Patient | null;
  notes?: string | null;
};

export default function AgendaPage() {
  const { facilityId } = useAuth();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [professionalId, setProfessionalId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');

  const weekRange = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }, []);

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
        from: weekRange.from,
        to: weekRange.to,
        facilityId,
      });
      const [s, p, pts] = await Promise.all([
        api<Slot[]>(`/v1/appointments?${qs}`),
        api<Professional[]>('/v1/professionals'),
        api<Patient[]>('/v1/patients'),
      ]);
      setSlots(s);
      setProfessionals(p);
      setPatients(pts);
      if (!professionalId && p[0]) setProfessionalId(p[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar agenda');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId, weekRange.from, weekRange.to]);

  async function createSlot(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade para criar slots.');
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
        },
      });
      setStartsAt('');
      setEndsAt('');
      setOk('Slot criado na unidade atual.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar slot');
    }
  }

  async function createProfessional() {
    try {
      await api('/v1/professionals', {
        method: 'POST',
        json: { civilName: 'Profissional Demonstração', cns: '898001234567890' },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar profissional');
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await api(`/v1/appointments/${id}/status`, { method: 'PATCH', json: { status } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao atualizar status');
    }
  }

  async function removeSlot(id: string, status: string) {
    if (status !== 'SCHEDULED') {
      setError('Exclusão permitida somente quando o status é Agendado.');
      return;
    }
    if (!confirm('Excluir este slot? Só é permitido se estiver Agendado.')) return;
    try {
      await api(`/v1/appointments/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao excluir');
    }
  }

  return (
    <AppShell helpId="agenda.slots">
      <PageHeader
        title="Agenda"
        eyebrow="Operação"
        description="Grade da semana da unidade atual · exclusão só se status = Agendado."
        actions={
          <>
            <HelpLink id="agenda.slots" />
            <Link className="btn btn-secondary" href="/odonto/agenda">
              Agenda odonto
            </Link>
            <Link className="btn btn-secondary" href="/atendimento">
              Fila
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {!facilityId ? (
        <div className="alert brand">Selecione uma unidade para ver e criar slots da agenda.</div>
      ) : null}

      {facilityId && professionals.length === 0 ? (
        <div className="alert" style={{ marginBottom: 12 }}>
          Nenhum profissional.{' '}
          <button type="button" className="btn btn-secondary" onClick={() => void createProfessional()}>
            Criar demonstração
          </button>
        </div>
      ) : null}

      <form className="card grid-2" onSubmit={createSlot} style={{ marginBottom: 16 }}>
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
          <label>Paciente (opcional)</label>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">— livre —</option>
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
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={!facilityId}>
            Criar slot
          </button>
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
                  <div className="row">
                    <select
                      value={s.status}
                      onChange={(e) => void updateStatus(s.id, e.target.value)}
                      style={{ minHeight: 36 }}
                    >
                      {Object.keys(APPOINTMENT_STATUS_LABEL)
                        .filter((k) => k !== 'DELETED')
                        .map((k) => (
                          <option key={k} value={k}>
                            {APPOINTMENT_STATUS_LABEL[k].label}
                          </option>
                        ))}
                    </select>
                    {s.patient ? (
                      <Link className="btn btn-secondary" href="/odonto/agenda">
                        Odonto
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={s.status !== 'SCHEDULED'}
                      title={s.status !== 'SCHEDULED' ? 'Só Agendado pode ser excluído' : 'Excluir'}
                      onClick={() => void removeSlot(s.id, s.status)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!slots.length ? (
              <TableStateRow
                colSpan={5}
                loading={loading}
                empty={facilityId ? 'Nenhum slot nesta semana nesta unidade.' : 'Selecione uma unidade.'}
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
