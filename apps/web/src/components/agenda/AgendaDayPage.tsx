'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, StatusPill, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  APPOINTMENT_ITEM_TYPE_LABEL,
  APPOINTMENT_STATUS_LABEL,
  displayPatientName,
  formatDateTime,
  formatTime,
  toDatetimeLocalValue,
} from '@/lib/labels';

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
  itemType?: string | null;
  careLine?: string | null;
  professional?: Professional;
  patient?: Patient | null;
  notes?: string | null;
  dentalEncounter?: { id: string; status: string } | null;
  encounter?: { id: string; status: string } | null;
};
type DayGrid = {
  slotMinutes: number;
  professionals: Professional[];
  bands: Array<{ startsAt: string; endsAt: string; cells: Record<string, Slot[]> }>;
  slots: Slot[];
};

function dayBounds(isoDate: string) {
  const start = new Date(`${isoDate}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

function gridBounds(isoDate: string, fullDay: boolean) {
  if (fullDay) return dayBounds(isoDate);
  const from = new Date(`${isoDate}T07:00:00`);
  const to = new Date(`${isoDate}T19:00:00`);
  return { from: from.toISOString(), to: to.toISOString() };
}

function todayInputValue() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type AgendaDayPageProps = {
  careLine: 'ODONTO' | 'APS';
  title: string;
  helpId: string;
  eyebrow: string;
  description: string;
  listHref: string;
  listLabel: string;
  openEndpoint: 'open-dental' | 'open-aps';
  encounterPath: (id: string) => string;
};

export function AgendaDayPage({
  careLine,
  title,
  helpId,
  eyebrow,
  description,
  listHref,
  listLabel,
  openEndpoint,
  encounterPath,
}: AgendaDayPageProps) {
  const router = useRouter();
  const { facilityId } = useAuth();
  const [day, setDay] = useState(todayInputValue);
  const [fullDay, setFullDay] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [grid, setGrid] = useState<DayGrid | null>(null);
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
  const [itemType, setItemType] = useState<'CONSULTA' | 'ENCAIXE'>('CONSULTA');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [filterProfessionalId, setFilterProfessionalId] = useState('');

  const range = useMemo(() => dayBounds(day), [day]);
  const gridRange = useMemo(() => gridBounds(day, fullDay), [day, fullDay]);
  const careLineFilter = `${careLine},GENERAL`;

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
      setGrid(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const listQs = new URLSearchParams({
        from: range.from,
        to: range.to,
        facilityId,
        careLine: careLineFilter,
      });
      const gridQs = new URLSearchParams({
        from: gridRange.from,
        to: gridRange.to,
        facilityId,
        careLine: careLineFilter,
        slotMinutes: String(slotMinutes),
      });
      if (filterProfessionalId) {
        listQs.set('professionalId', filterProfessionalId);
        gridQs.set('professionalId', filterProfessionalId);
      }
      const assignQs = new URLSearchParams({ activeOnly: '1', facilityId });
      const [s, g, p, pts, assigns] = await Promise.all([
        api<Slot[]>(`/v1/appointments?${listQs}`),
        api<DayGrid>(`/v1/appointments/day-grid?${gridQs}`),
        api<Professional[]>('/v1/professionals'),
        api<Patient[]>('/v1/patients'),
        api<Assignment[]>(`/v1/assignments?${assignQs}`),
      ]);
      setSlots(s);
      setGrid(g);
      setProfessionals(p);
      setPatients(pts);
      setAssignments(assigns);
      if (!professionalId && p[0]) setProfessionalId(p[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar agenda');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId, range.from, range.to, gridRange.from, gridRange.to, slotMinutes, filterProfessionalId]);

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

  const gridProfessionals = useMemo(() => {
    const fromGrid = grid?.professionals ?? [];
    if (fromGrid.length) return fromGrid;
    const selected = professionals.find((p) => p.id === professionalId);
    return selected ? [selected] : [];
  }, [grid, professionals, professionalId]);

  function linkedEncounter(slot: Slot) {
    if (careLine === 'ODONTO') return slot.dentalEncounter ?? null;
    return slot.encounter ?? null;
  }

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
          itemType,
          careLine,
        },
      });
      setStartsAt('');
      setEndsAt('');
      setOk(itemType === 'ENCAIXE' ? 'Encaixe criado.' : 'Consulta agendada.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar agendamento');
    }
  }

  async function openFromSlot(slot: Slot) {
    if (!slot.patient && !slot.patientId) {
      setError('Vincule um paciente ao slot antes de abrir o atendimento.');
      return;
    }
    const linked = linkedEncounter(slot);
    if (linked?.id) {
      router.push(encounterPath(linked.id));
      return;
    }
    setBusyId(slot.id);
    setError(null);
    setOk(null);
    try {
      const assignForSlot =
        assignments.find((a) => a.active && a.professionalId === slot.professionalId) ||
        assignmentsForProfessional[0];
      const row = await api<{ id: string }>(`/v1/appointments/${slot.id}/${openEndpoint}`, {
        method: 'POST',
        json: {
          assignmentId: assignForSlot?.id || assignmentId || undefined,
        },
      });
      setOk('Atendimento aberto a partir da agenda.');
      router.push(encounterPath(row.id));
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

  function pickBand(professional: Professional, bandStart: string, bandEnd: string) {
    setProfessionalId(professional.id);
    setStartsAt(toDatetimeLocalValue(bandStart));
    setEndsAt(toDatetimeLocalValue(bandEnd));
    setOk(`Horário ${formatTime(bandStart)} preenchido — confirme o paciente e agende.`);
  }

  const tipoHint = itemType === 'ENCAIXE' ? 'tipoAtendimento=5 (consulta no dia)' : 'tipoAtendimento=2 (consulta agendada)';
  const otherAgenda =
    careLine === 'ODONTO'
      ? { href: '/aps/agenda', label: 'Agenda APS' }
      : { href: '/odonto/agenda', label: 'Agenda odonto' };

  function slotActions(s: Slot) {
    const linked = linkedEncounter(s);
    return (
      <div className="row">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={
            busyId === s.id ||
            !s.patient ||
            s.status === 'NO_SHOW' ||
            s.status === 'CANCELLED' ||
            s.status === 'COMPLETED'
          }
          onClick={() => void openFromSlot(s)}
        >
          {busyId === s.id ? 'Abrindo…' : linked ? 'Continuar' : 'Abrir'}
        </button>
        {s.status === 'SCHEDULED' || s.status === 'PRESENT' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void markNoShow(s.id)}>
            Falta
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <AppShell helpId={helpId}>
      <PageHeader
        title={title}
        eyebrow={eyebrow}
        description={description}
        actions={
          <>
            <HelpLink id={helpId} />
            <Link className="btn btn-secondary" href={listHref}>
              {listLabel}
            </Link>
            <Link className="btn ghost" href={otherAgenda.href}>
              {otherAgenda.label}
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
        <div className="alert brand">Selecione uma unidade para ver a agenda do dia.</div>
      ) : null}

      <div className="card row" style={{ marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div className="field" style={{ margin: 0 }}>
          <label>Dia</label>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Faixa</label>
          <select value={fullDay ? 'full' : 'clinic'} onChange={(e) => setFullDay(e.target.value === 'full')}>
            <option value="clinic">07:00–19:00</option>
            <option value="full">Dia inteiro</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Intervalo</label>
          <select value={String(slotMinutes)} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
            <option value="15">15 min</option>
            <option value="20">20 min</option>
            <option value="30">30 min</option>
            <option value="60">60 min</option>
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Profissional (filtro)</label>
          <select value={filterProfessionalId} onChange={(e) => setFilterProfessionalId(e.target.value)}>
            <option value="">Todos com agenda no dia</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {displayPatientName(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label>Vista</label>
          <select value={view} onChange={(e) => setView(e.target.value as 'grid' | 'list')}>
            <option value="grid">Grade</option>
            <option value="list">Lista</option>
          </select>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Atualizar
        </button>
      </div>

      <form className="card grid-2" onSubmit={createSlot} style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0, gridColumn: '1 / -1' }}>Novo item</h2>
        <div className="field">
          <label>Tipo</label>
          <select value={itemType} onChange={(e) => setItemType(e.target.value as 'CONSULTA' | 'ENCAIXE')}>
            <option value="CONSULTA">Consulta agendada (tipo 2)</option>
            <option value="ENCAIXE">Encaixe / consulta no dia (tipo 5)</option>
          </select>
        </div>
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
          <span className="muted">Na abertura, LEDI usa {tipoHint}.</span>
        </div>
      </form>

      {view === 'grid' ? (
        <div className="agenda-grid-wrap">
          <table className="agenda-grid">
            <thead>
              <tr>
                <th className="agenda-time">Hora</th>
                {gridProfessionals.map((p) => (
                  <th key={p.id}>{displayPatientName(p)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(grid?.bands ?? []).map((band) => (
                <tr key={band.startsAt}>
                  <td className="agenda-time mono">{formatTime(band.startsAt)}</td>
                  {gridProfessionals.map((p) => {
                    const cellSlots = band.cells[p.id] ?? [];
                    return (
                      <td
                        key={p.id}
                        className={`agenda-cell${cellSlots.length ? '' : ' empty'}`}
                        onClick={
                          cellSlots.length
                            ? undefined
                            : () => pickBand(p, band.startsAt, band.endsAt)
                        }
                      >
                        {cellSlots.map((s) => {
                          const linked = linkedEncounter(s);
                          return (
                            <div
                              key={s.id}
                              className={`agenda-slot${s.itemType === 'ENCAIXE' ? ' encaixe' : ''}`}
                            >
                              <strong>{s.patient ? displayPatientName(s.patient) : 'Sem paciente'}</strong>
                              <span className="muted">
                                {APPOINTMENT_ITEM_TYPE_LABEL[s.itemType || 'CONSULTA']?.label || s.itemType} ·{' '}
                                {formatTime(s.startsAt)}–{formatTime(s.endsAt)}
                              </span>
                              <StatusPill status={s.status} map={APPOINTMENT_STATUS_LABEL} />
                              {linked ? (
                                <Link href={encounterPath(linked.id)}>
                                  {linked.status === 'IN_PROGRESS' ? 'Em andamento' : linked.status}
                                </Link>
                              ) : null}
                              {slotActions(s)}
                            </div>
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!gridProfessionals.length || !(grid?.bands.length) ? (
                <TableStateRow
                  colSpan={Math.max(2, gridProfessionals.length + 1)}
                  loading={loading}
                  empty={
                    facilityId
                      ? 'Nenhum horário na faixa. Crie um item ou mude a vista para lista.'
                      : 'Selecione uma unidade.'
                  }
                />
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Tipo</th>
                <th>Profissional</th>
                <th>Paciente</th>
                <th>Status</th>
                <th>Atendimento</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s) => {
                const linked = linkedEncounter(s);
                return (
                  <tr key={s.id}>
                    <td className="mono">{formatDateTime(s.startsAt)}</td>
                    <td>
                      <StatusPill status={s.itemType || 'CONSULTA'} map={APPOINTMENT_ITEM_TYPE_LABEL} />
                    </td>
                    <td>{s.professional ? displayPatientName(s.professional) : '—'}</td>
                    <td>{s.patient ? displayPatientName(s.patient) : '—'}</td>
                    <td>
                      <StatusPill status={s.status} map={APPOINTMENT_STATUS_LABEL} />
                    </td>
                    <td>
                      {linked ? (
                        <Link href={encounterPath(linked.id)}>
                          {linked.status === 'IN_PROGRESS' ? 'Em andamento' : linked.status}
                        </Link>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>{slotActions(s)}</td>
                  </tr>
                );
              })}
              {!slots.length ? (
                <TableStateRow
                  colSpan={7}
                  loading={loading}
                  empty={facilityId ? 'Nenhum agendamento neste dia nesta unidade.' : 'Selecione uma unidade.'}
                />
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
