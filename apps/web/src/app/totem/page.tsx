'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Opt = { id: string; label: string; prefix: string };
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
};

export default function TotemPage() {
  const { facilityId } = useAuth();
  const [types, setTypes] = useState<Opt[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [serviceType, setServiceType] = useState('NORMAL');
  const [patientId, setPatientId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!facilityId) return;
    setLoading(true);
    try {
      const [cat, pts, list] = await Promise.all([
        api<{ serviceTypes: Opt[] }>('/v1/queue/catalog'),
        api<Patient[]>('/v1/patients'),
        api<Ticket[]>(`/v1/queue/tickets?facilityId=${facilityId}&status=WAITING`),
      ]);
      setTypes(cat.serviceTypes);
      setPatients(pts);
      setTickets(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar totem');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId]);

  async function emit(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    setError(null);
    setOk(null);
    try {
      const row = await api<Ticket>('/v1/queue/tickets', {
        method: 'POST',
        json: {
          facilityId,
          serviceType,
          patientId: patientId || undefined,
          displayName: displayName || undefined,
        },
      });
      setLastCode(row.code);
      setOk(`Senha emitida: ${row.code}`);
      setDisplayName('');
      setPatientId('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao emitir senha');
    }
  }

  return (
    <AppShell helpId="fila.totem">
      <PageHeader
        title="Totem de senhas"
        eyebrow="Operação"
        description="Retirada de senha por tipo de serviço (RF-3.11)."
        actions={
          <>
            <HelpLink id="fila.totem" />
            <Link className="btn btn-secondary" href="/guiche">
              Guichê
            </Link>
            <Link className="btn btn-secondary" href={`/painel?facilityId=${facilityId || ''}`} target="_blank">
              Abrir painel
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {lastCode ? (
        <div
          className="card"
          style={{
            marginBottom: 16,
            textAlign: 'center',
            padding: 28,
            background: 'var(--brand-soft)',
            borderColor: 'var(--brand)',
          }}
        >
          <div className="section-label">Sua senha</div>
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: '0.04em', fontFamily: 'var(--font-mono, monospace)' }}>
            {lastCode}
          </div>
          <p style={{ margin: 0, color: 'var(--ink-3)' }}>Aguarde a chamada no painel.</p>
        </div>
      ) : null}

      <form className="card grid-2" onSubmit={emit} style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Tipo de serviço</label>
          <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
            {(types.length
              ? types
              : [
                  { id: 'NORMAL', label: 'Atendimento comum', prefix: 'N' },
                  { id: 'PRIORITARIO', label: 'Prioritário', prefix: 'P' },
                ]
            ).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Paciente (opcional)</label>
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            <option value="">— sem vínculo —</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {displayPatientName(p)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Nome no painel (opcional)</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ex.: Maria E." />
        </div>
        <button className="btn btn-primary" type="submit" style={{ fontSize: 16, minHeight: 48 }}>
          Emitir senha
        </button>
      </form>

      <div className="section-label">Aguardando agora</div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Senha</th>
              <th>Tipo</th>
              <th>Paciente / nome</th>
              <th>Entrada</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id}>
                <td className="mono" style={{ fontWeight: 700 }}>
                  {t.code}
                </td>
                <td>{t.serviceType}</td>
                <td>{t.patient ? displayPatientName(t.patient) : t.displayName || '—'}</td>
                <td className="mono">{formatDateTime(t.createdAt)}</td>
              </tr>
            ))}
            {!tickets.length ? (
              <TableStateRow colSpan={4} loading={loading} empty="Nenhuma senha aguardando." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
