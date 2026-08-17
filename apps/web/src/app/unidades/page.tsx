'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
  cnpj?: string | null;
  municipalNetwork?: boolean;
  addressStreet?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  _count?: { teams: number };
};

type SyncResult = {
  source: string;
  gestao?: string;
  filter?: {
    before: { establishments: number; teams: number };
    after: { establishments: number; teams: number };
  };
  facilities: { created: number; updated: number; skipped: number };
  teams: { created: number; updated: number; skipped: number };
  totals: {
    establishments: number;
    teams: number;
    establishmentsActive: number;
    establishmentsCity?: number;
  };
};

/** Escopo da lista: rede Prefeitura (default) vs todos CNES do IBGE. */
type ListaEscopo = 'municipal' | 'todos';

function UnidadesPageInner() {
  const searchParams = useSearchParams();
  const focusCnes = searchParams.get('cnes')?.replace(/\D/g, '') || '';
  const focusId = searchParams.get('id') || '';
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Facility[]>([]);
  const [selected, setSelected] = useState<Facility | null>(null);
  const [ibgeCode, setIbgeCode] = useState('');
  const [name, setName] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [escopo, setEscopo] = useState<ListaEscopo>('municipal');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [deepLinkTried, setDeepLinkTried] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (activeOnly) qs.set('active', 'true');
      qs.set('ibge', '3516200');
      qs.set('gestao', escopo);
      const list = await api<Facility[]>(`/v1/facilities?${qs.toString()}`);
      setRows(list);
      const byDeep =
        (focusId && list.find((f) => f.id === focusId)) ||
        (focusCnes && list.find((f) => f.cnes.replace(/\D/g, '') === focusCnes)) ||
        null;
      const current = byDeep || list.find((f) => f.id === facilityId) || list[0] || null;
      setSelected(current);
      if (current) {
        setIbgeCode(current.ibgeCode || '');
        setName(current.name);
      }
      if ((focusCnes || focusId) && !byDeep && !deepLinkTried) {
        // Deep-link pode estar fora do escopo municipal — tenta «todos»
        if (escopo === 'municipal') {
          setEscopo('todos');
          setDeepLinkTried(true);
        } else if (!byDeep) {
          setOk(
            `CNES/id da URL não encontrado nesta lista${focusCnes ? ` (${focusCnes})` : ''}.`,
          );
          setDeepLinkTried(true);
        }
      } else if (byDeep && (focusCnes || focusId)) {
        setOk(`Unidade selecionada via auditoria: ${byDeep.name} (CNES ${byDeep.cnes}).`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar unidades');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filters / deep-link change
  }, [facilityId, activeOnly, escopo, focusCnes, focusId]);

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

  async function onSyncCnes() {
    setSyncing(true);
    setError(null);
    setOk(null);
    try {
      const out = await api<SyncResult>(
        '/v1/cnes/sync?ibge=3516200&source=snapshot&gestao=municipal',
        { method: 'POST' },
      );
      const city = out.filter?.before?.establishments ?? out.totals.establishmentsCity;
      const muni = out.filter?.after?.establishments ?? out.totals.establishments;
      setEscopo('municipal');
      setOk(
        `Rede municipal sincronizada (${out.source}): +${out.facilities.created}/~${out.facilities.updated} unidades · +${out.teams.created}/~${out.teams.updated} equipes (${muni} est. Prefeitura` +
          (city != null ? ` de ${city} na cidade` : '') +
          `). Esperado ~66 / ~59 ativos.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no sync CNES');
    } finally {
      setSyncing(false);
    }
  }

  const escopoLabel =
    escopo === 'municipal'
      ? 'Rede Prefeitura (mantenedora)'
      : 'Todos IBGE (cidade inteira)';

  return (
    <AppShell>
      <PageHeader
        title="Unidades"
        description="Default: rede Prefeitura de Franca (natureza 1244 / CNPJ mantenedora). Não a cidade inteira."
        actions={
          <>
            <HelpLink id="cadastros.unidades" />
            <Link className="btn btn-secondary" href="/equipes">
              Equipes
            </Link>
            <Link className="btn btn-secondary" href="/cadastros/cnes-auditoria">
              Auditoria CNES
            </Link>
            <button className="btn btn-primary" type="button" disabled={syncing} onClick={() => void onSyncCnes()}>
              {syncing ? 'Sincronizando…' : 'Sincronizar rede municipal'}
            </button>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {!loading && rows.length === 0 && escopo === 'municipal' ? (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--warn, #b45309)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma unidade da rede municipal no banco</p>
          <p className="muted" style={{ margin: '8px 0 0' }}>
            Clique em <strong>Sincronizar rede municipal</strong> para importar só a Prefeitura (~66
            estabelecimentos / ~59 ativos; a cidade tem ~545 ativos / ~1346 CNES). Depois confira a{' '}
            <Link href="/cadastros/cnes-auditoria">auditoria CNES</Link>.
          </p>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="card">
          <div className="section-label">Lista</div>
          <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              type="radio"
              name="escopo"
              checked={escopo === 'municipal'}
              onChange={() => setEscopo('municipal')}
            />
            Rede Prefeitura (mantenedora)
          </label>
          <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              type="radio"
              name="escopo"
              checked={escopo === 'todos'}
              onChange={() => setEscopo('todos')}
            />
            Todos IBGE (cidade inteira)
          </label>
          <label className="muted" style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Só unidades ativas
          </label>
          {loading ? <p className="muted">Carregando…</p> : null}
          <p className="muted">
            {escopoLabel}
            {activeOnly ? ' · ativas' : ''} · IBGE 3516200 · {rows.length} unidade(s)
            {escopo === 'municipal' ? ' (esperado ~59 ativas / ~66 total)' : ' (cidade ~545 ativas)'}
            {focusCnes ? (
              <>
                {' '}
                · foco CNES <span className="mono">{focusCnes}</span>
              </>
            ) : null}
          </p>
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>CNES</th>
                <th>Tipo</th>
                <th>Equipes</th>
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
                  <td className="mono">{f.typeId || '—'}</td>
                  <td className="mono">{f._count?.teams ?? '—'}</td>
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
                <label>CNPJ (mantenedora / estabelecimento)</label>
                <p className="mono muted" style={{ margin: 0 }}>
                  {selected.cnpj || '—'}
                  {selected.municipalNetwork ? ' · rede Prefeitura' : ''}
                </p>
              </div>
              <div className="field">
                <label>Endereço</label>
                <p className="muted">
                  {[selected.addressStreet, selected.addressNeighborhood, selected.addressCity]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
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

export default function UnidadesPage() {
  return (
    <Suspense fallback={<AppShell><p className="muted">Carregando unidades…</p></AppShell>}>
      <UnidadesPageInner />
    </Suspense>
  );
}
