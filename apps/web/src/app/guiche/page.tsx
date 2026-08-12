'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Professional = { id: string; civilName: string };
type Patient = { id: string; civilName: string; socialName?: string | null };
type Ticket = {
  id: string;
  code: string;
  serviceType: string;
  status: string;
  displayName?: string | null;
  deskLabel?: string | null;
  createdAt: string;
  patient?: Patient | null;
  encounterId?: string | null;
};

export default function GuichePage() {
  const { facilityId } = useAuth();
  const [waiting, setWaiting] = useState<Ticket[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [deskLabel, setDeskLabel] = useState('Guichê 1');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastCalled, setLastCalled] = useState<string | null>(null);

  async function load() {
    if (!facilityId) return;
    setLoading(true);
    try {
      const [list, profs] = await Promise.all([
        api<Ticket[]>(`/v1/queue/tickets?facilityId=${facilityId}&status=WAITING`),
        api<Professional[]>('/v1/professionals'),
      ]);
      setWaiting(list);
      setProfessionals(profs);
      if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar fila');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 8000);
    return () => clearInterval(t);
  }, [facilityId]);

  async function callNext() {
    if (!facilityId) return;
    setError(null);
    setOk(null);
    try {
      const row = await api<Ticket>('/v1/queue/call-next', {
        method: 'POST',
        json: {
          facilityId,
          deskLabel,
          professionalId: professionalId || undefined,
          openEncounter: true,
        },
      });
      setLastCalled(row.code);
      setOk(`Chamando ${row.code}${row.encounterId ? ' · atendimento aberto' : ''}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao chamar');
    }
  }

  async function callOne(id: string) {
    setError(null);
    setOk(null);
    try {
      const row = await api<Ticket>(`/v1/queue/tickets/${id}/call`, {
        method: 'POST',
        json: {
          deskLabel,
          professionalId: professionalId || undefined,
          openEncounter: true,
        },
      });
      setLastCalled(row.code);
      setOk(`Chamando ${row.code}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao chamar');
    }
  }

  async function finish(id: string, status: 'COMPLETED' | 'NO_SHOW') {
    try {
      await api(`/v1/queue/tickets/${id}/finish`, { method: 'POST', json: { status } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao finalizar');
    }
  }

  return (
    <AppShell helpId="fila.guiche">
      <PageHeader
        title="Guichê / chamada"
        eyebrow="Operação"
        description="Chame a próxima senha no painel (RF-3.10 / RF-3.23)."
        actions={
          <>
            <HelpLink id="fila.guiche" />
            <Link className="btn btn-secondary" href="/totem">
              Totem
            </Link>
            <Link className="btn btn-secondary" href={`/painel?facilityId=${facilityId || ''}`} target="_blank">
              Painel TV
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      <div className="card grid-2" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Local / guichê</label>
          <input value={deskLabel} onChange={(e) => setDeskLabel(e.target.value)} />
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
        <button className="btn btn-primary" type="button" style={{ minHeight: 48, fontSize: 16 }} onClick={() => void callNext()}>
          Chamar próxima
        </button>
        {lastCalled ? (
          <div style={{ alignSelf: 'center', fontSize: 28, fontWeight: 700 }} className="mono">
            {lastCalled}
          </div>
        ) : null}
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Senha</th>
              <th>Tipo</th>
              <th>Paciente</th>
              <th>Entrada</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {waiting.map((t) => (
              <tr key={t.id}>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {t.code}
                </td>
                <td>{t.serviceType}</td>
                <td>{t.patient ? displayPatientName(t.patient) : t.displayName || '—'}</td>
                <td className="mono">{formatDateTime(t.createdAt)}</td>
                <td>
                  <div className="row">
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => void callOne(t.id)}>
                      Chamar
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => void finish(t.id, 'NO_SHOW')}>
                      Não aguardou
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!waiting.length ? (
              <TableStateRow colSpan={5} loading={loading} empty="Fila vazia." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
