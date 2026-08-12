'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Facility = {
  id: string;
  name: string;
  cnes: string;
  ibgeCode?: string | null;
  active: boolean;
  typeId?: string | null;
};

export default function UnidadesPage() {
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [ibgeCode, setIbgeCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await api<Facility[]>('/v1/facilities');
      setRows(list);
      const current = list.find((f) => f.id === facilityId) || list[0] || null;
      setSelected(current);
      if (current) {
        setIbgeCode(current.ibgeCode || '');
        setName(current.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar unidades');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [facilityId]);

  function pick(f: Facility) {
    setSelected(f);
    setIbgeCode(f.ibgeCode || '');
    setName(f.name);
    setOk(null);
    setError(null);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setOk(null);
    try {
      const updated = await api<Facility>(`/v1/facilities/${selected.id}`, {
        method: 'PATCH',
        json: { name: name.trim() || undefined, ibgeCode: ibgeCode.trim() || undefined },
      });
      setOk(`Unidade atualizada. IBGE: ${updated.ibgeCode || '—'}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  }

  return (
    <AppShell>
      <PageHeader
        title="Unidades"
        description="CNES e código IBGE do município (header LEDI)"
        actions={<HelpLink id="cadastros.unidades" />}
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      <div className="grid-2">
        <div className="card">
          <div className="section-label">Lista</div>
          {loading ? <p className="muted">Carregando…</p> : null}
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNES</th>
                <th>IBGE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr
                  key={f.id}
                  className={selected?.id === f.id ? 'is-selected' : undefined}
                  onClick={() => pick(f)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>{f.name}</td>
                  <td className="mono">{f.cnes}</td>
                  <td className="mono">{f.ibgeCode || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="card" onSubmit={onSave}>
          <div className="section-label">Editar unidade</div>
          {!selected ? (
            <p className="muted">Selecione uma unidade.</p>
          ) : (
            <>
              <div className="field">
                <label>Nome</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>CNES</label>
                <input className="mono" value={selected.cnes} disabled />
              </div>
              <div className="field">
                <label>IBGE município (7 dígitos)</label>
                <input
                  className="mono"
                  value={ibgeCode}
                  onChange={(e) => setIbgeCode(e.target.value)}
                  placeholder="3516200"
                  maxLength={7}
                />
                <p className="muted" style={{ marginTop: 6 }}>
                  Franca/SP = <span className="mono">3516200</span>. Vai para{' '}
                  <span className="mono">codigoIbgeMunicipio</span> no lote LEDI.
                </p>
              </div>
              <button className="btn btn-primary" type="submit">
                Salvar
              </button>
            </>
          )}
        </form>
      </div>
    </AppShell>
  );
}
