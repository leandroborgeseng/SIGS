'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
type Catalog = {
  careTypes: Array<{ id: string; label: string }>;
  shifts: Array<{ id: string; label: string }>;
  defaultProcedure: string;
  procedureHints: Array<{ id: string; label: string }>;
};
type Row = {
  id: string;
  status: string;
  careType: string;
  shift?: string;
  visitedAt: string;
  patient: Patient;
  productionBatchId?: string | null;
};

export default function HomeCarePage() {
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [patientId, setPatientId] = useState('');
  const [professionalId, setProfessionalId] = useState('');
  const [careType, setCareType] = useState('AD1');
  const [shift, setShift] = useState('MANHA');
  const [procCode, setProcCode] = useState('0101040024');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function load() {
    const qs = facilityId ? `?facilityId=${facilityId}` : '';
    const [list, pts, profs, cat] = await Promise.all([
      api<Row[]>(`/v1/home-care-visits${qs}`),
      api<Patient[]>('/v1/patients'),
      api<Professional[]>('/v1/professionals'),
      api<Catalog>('/v1/catalog/home-care'),
    ]);
    setRows(list);
    setPatients(pts);
    setProfessionals(profs);
    setCatalog(cat);
    if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
    if (cat?.defaultProcedure) setProcCode((c) => c || cat.defaultProcedure);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [facilityId]);

  async function open(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    setError(null);
    setOk(null);
    try {
      const row = await api<{ id: string; careType: string }>('/v1/home-care-visits', {
        method: 'POST',
        json: {
          patientId,
          facilityId,
          professionalId: professionalId || undefined,
          careType,
          shift,
          notes,
          procedures: [procCode, 'VISITA'].filter(Boolean),
        },
      });
      setNotes('');
      setOk(`Visita ${row.careType} aberta (${row.id.slice(0, 8)}…). Finalize para gerar lote BPA.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir');
    }
  }

  async function finish(id: string) {
    setError(null);
    setOk(null);
    try {
      const res = await api<{ productionBatch?: { id: string } }>(`/v1/home-care-visits/${id}/finish`, {
        method: 'POST',
        json: { procedures: [procCode, 'VISITA', 'ORIENTACAO'] },
      });
      setOk(
        res.productionBatch?.id
          ? `Finalizada — lote ${res.productionBatch.id.slice(0, 8)}… em Produção (SIGTAP 0101040024).`
          : 'Visita domiciliar finalizada.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao finalizar');
    }
  }

  return (
    <AppShell helpId="ad.stub">
      <PageHeader
        title="Atenção domiciliar"
        eyebrow="Operação"
        description="Visita AD1/AD2/AD3 → lote home_care (LEDI/BPA stub · RF-3.54)."
        actions={
          <>
            <HelpLink id="ad.stub" />
            <Link className="btn btn-secondary" href="/producao">
              Produção
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      {ok ? (
        <div className="alert" style={{ borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)', marginBottom: 12 }}>
          {ok}
        </div>
      ) : null}
      <form className="card grid-2" onSubmit={open} style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Paciente</label>
          <select required value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">Selecionar…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {displayPatientName(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Profissional</label>
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Opcional…</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.civilName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Modalidade</label>
          <select value={careType} onChange={(e) => setCareType(e.target.value)}>
            {(catalog?.careTypes || [
              { id: 'AD1', label: 'AD1' },
              { id: 'AD2', label: 'AD2' },
              { id: 'AD3', label: 'AD3' },
            ]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Turno</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            {(catalog?.shifts || [
              { id: 'MANHA', label: 'Manhã' },
              { id: 'TARDE', label: 'Tarde' },
              { id: 'NOITE', label: 'Noite' },
            ]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Procedimento (SIGTAP / stub)</label>
          <select value={procCode} onChange={(e) => setProcCode(e.target.value)}>
            {(catalog?.procedureHints || [{ id: '0101040024', label: 'Visita domiciliar' }]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Notas clínicas / orientação</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">
          Registrar visita
        </button>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Paciente</th>
              <th>Tipo</th>
              <th>Turno</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatDateTime(r.visitedAt)}</td>
                <td>{displayPatientName(r.patient)}</td>
                <td>{r.careType}</td>
                <td>{r.shift || '—'}</td>
                <td>{r.status}</td>
                <td>
                  {r.status !== 'COMPLETED' ? (
                    <button type="button" className="btn btn-primary" onClick={() => void finish(r.id)}>
                      Finalizar
                    </button>
                  ) : (
                    <span className="mono">{r.productionBatchId?.slice(0, 8)}…</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>Nenhuma visita domiciliar nesta unidade.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
