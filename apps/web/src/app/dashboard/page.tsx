'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, StatusPill } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ENCOUNTER_STATUS_LABEL, displayPatientName } from '@/lib/labels';

type Encounter = {
  id: string;
  status: string;
  patient: { civilName: string; socialName?: string | null };
};

export default function DashboardPage() {
  const { user, facilityId, hasPermission } = useAuth();
  const [queue, setQueue] = useState<Encounter[]>([]);
  const [patients, setPatients] = useState(0);
  const [batches, setBatches] = useState(0);
  const [facilityName, setFacilityName] = useState('UBS');
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }, []);

  const firstName = user?.name?.split(/\s+/)[0] || '';

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [],
  );

  async function refresh() {
    setError(null);
    const failures: string[] = [];
    try {
      const q = await api<Encounter[]>(
        `/v1/encounters/queue${facilityId ? `?facilityId=${facilityId}` : ''}`,
      );
      setQueue(q);
    } catch {
      setQueue([]);
      failures.push('fila');
    }
    try {
      const p = await api<unknown[]>('/v1/patients');
      setPatients(p.length);
    } catch {
      setPatients(0);
      failures.push('pacientes');
    }
    try {
      const b = await api<unknown[]>('/v1/production/batches');
      setBatches(b.length);
    } catch {
      setBatches(0);
      failures.push('produção');
    }
    if (facilityId) {
      try {
        const rows = await api<Array<{ id: string; name: string }>>('/v1/facilities');
        const f = rows.find((r) => r.id === facilityId);
        if (f) setFacilityName(f.name);
      } catch {
        failures.push('unidade');
      }
    }
    if (failures.length) {
      setError(`Não foi possível carregar: ${failures.join(', ')}. Tente atualizar.`);
    }
  }

  useEffect(() => {
    void refresh();
  }, [facilityId]);

  async function ensureSeed() {
    setError(null);
    setSeedMsg(null);
    try {
      const res = await api<{ seeded: boolean }>('/v1/demo/seed', { method: 'POST' });
      setSeedMsg(res.seeded ? 'Dados fictícios criados.' : 'Demo já presente.');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no seed');
    }
  }

  return (
    <AppShell helpId="plataforma.painel">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">{facilityName}</div>
          <h1 style={{ fontSize: 23, fontWeight: 700, letterSpacing: '-0.025em', margin: 0 }}>
            {greeting}, {firstName}
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: '4px 0 0', textTransform: 'capitalize' }}>
            {todayLabel}
          </p>
        </div>
        <div className="row">
          <HelpLink id="plataforma.painel" />
          <button type="button" className="btn btn-secondary" onClick={() => void refresh()}>
            Atualizar
          </button>
        </div>
      </div>
      <ErrorBox message={error} />
      {seedMsg ? (
        <div className="alert" style={{ borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)' }}>
          {seedMsg}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 22, marginBottom: 16, borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)' }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Prioridade agora: faturamento odonto (LEDI FAO)</h2>
        <p style={{ marginTop: 0 }}>
          Envie os XMLs do município, corrija inconsistências e baixe o lote pronto para o Siaps/RNDS.
        </p>
        <Link className="btn btn-primary" href="/faturamento/lote/fao">
          Abrir Lote LEDI FAO
        </Link>
      </div>

      <div className="grid-4" style={{ marginBottom: 22, marginTop: 22 }}>
        <div className="stat">
          <span>Pacientes cadastrados</span>
          <strong>{patients}</strong>
        </div>
        <div className="stat">
          <span>Na fila agora</span>
          <strong className="warn">{queue.length}</strong>
        </div>
        <div className="stat">
          <span>Lotes de produção</span>
          <strong className="ok">{batches}</strong>
        </div>
        <div className="stat">
          <span>Perfil</span>
          <strong style={{ fontSize: 16, marginTop: 10 }}>{user?.roleName}</strong>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="section-label" style={{ margin: 0 }}>
              Fila resumida
            </div>
            <Link className="btn btn-ghost" href="/atendimento" style={{ marginLeft: 'auto' }}>
              Ver tudo →
            </Link>
          </div>
          {queue.slice(0, 5).map((r) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 0',
                borderBottom: '1px solid var(--line-2)',
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 500, flex: 1 }}>
                {displayPatientName(r.patient)}
              </span>
              <StatusPill status={r.status} map={ENCOUNTER_STATUS_LABEL} />
            </div>
          ))}
          {queue.length === 0 ? (
            <p style={{ color: 'var(--ink-3)', margin: 0, fontSize: 13 }}>Fila vazia no momento.</p>
          ) : null}
        </div>
        <div className="card">
          <div className="section-label">Atalhos</div>
          <div className="stack">
            <Link className="btn btn-secondary" href="/pacientes" style={{ justifyContent: 'flex-start' }}>
              Buscar paciente
            </Link>
            <Link className="btn btn-secondary" href="/agenda" style={{ justifyContent: 'flex-start' }}>
              Abrir agenda
            </Link>
            <Link className="btn btn-secondary" href="/vacinacao" style={{ justifyContent: 'flex-start' }}>
              Aplicar vacina
            </Link>
            <Link className="btn btn-secondary" href="/producao" style={{ justifyContent: 'flex-start' }}>
              Produção / BPA
            </Link>
            {hasPermission('*') ? (
              <button type="button" className="btn btn-ghost" onClick={() => void ensureSeed()}>
                Garantir dados demo
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
