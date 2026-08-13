'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ErrorBox } from '@/components/ui/PageHeader';

type Facility = { id: string; name: string; cnes: string };

export default function SelectUnitPage() {
  const { user, loading, selectFacility, facilityId } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Facility[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('UBS Centro Demonstração');
  const [cnes, setCnes] = useState('9999999');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  async function load() {
    try {
      const rows = await api<Facility[]>('/v1/facilities');
      setItems(rows);
      if (!facilityId && rows.length === 1) {
        selectFacility(rows[0].id);
        router.replace('/dashboard');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao listar unidades');
    }
  }

  useEffect(() => {
    if (user) void load();
  }, [user]);

  async function createDemo() {
    setCreating(true);
    setError(null);
    try {
      await api('/v1/facilities', { method: 'POST', json: { name, cnes } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar unidade');
    } finally {
      setCreating(false);
    }
  }

  function choose(id: string) {
    selectFacility(id);
    router.push('/dashboard');
  }

  if (loading || !user) return <div className="content">Carregando…</div>;

  return (
    <div className="sgs-screen" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <img src="/brand/franca-mark.png" alt="" style={{ width: 32, height: 40, objectFit: 'contain', marginBottom: 12 }} />
          <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px' }}>
            Selecione sua unidade de trabalho
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--ink-3)', margin: 0 }}>
            {user.name} · {user.roleName}
          </p>
        </div>
        <ErrorBox message={error} />
        {items.length === 0 ? (
          <div className="card stack">
            <div className="alert">Nenhuma unidade cadastrada. Crie a primeira para continuar.</div>
            <div className="field">
              <label>Nome</label>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="field">
              <label>CNES</label>
              <input className="mono" value={cnes} onChange={(e) => setCnes(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="button" disabled={creating} onClick={createDemo}>
              Criar unidade
            </button>
          </div>
        ) : (
          <div className="stack">
            {items.map((f) => (
              <button key={f.id} type="button" className="unit-card" onClick={() => choose(f.id)}>
                <div className="unit-icon">⌂</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600 }}>{f.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
                    CNES <span className="mono">{f.cnes}</span>
                  </div>
                </div>
                <span style={{ color: 'var(--ink-4)' }}>›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
