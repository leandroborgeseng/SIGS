'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/labels';

type Opt = { id: string; label: string };
type Catalog = {
  activityTypes: Opt[];
  audiences: Opt[];
  themes: Opt[];
};
type Row = {
  id: string;
  status: string;
  activityType: string;
  theme: string;
  audience: string;
  participantCount: number;
  heldAt: string;
  productionBatchId?: string | null;
};

export default function CollectivePage() {
  const { facilityId } = useAuth();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityType, setActivityType] = useState('EDUCACAO_SAUDE');
  const [theme, setTheme] = useState('ALIMENTACAO');
  const [audience, setAudience] = useState('COMUNIDADE');
  const [participantCount, setParticipantCount] = useState(10);
  const [notes, setNotes] = useState('');
  const [shift, setShift] = useState('MANHA');

  async function load() {
    const qs = facilityId ? `?facilityId=${facilityId}` : '';
    const [c, list] = await Promise.all([
      api<Catalog>('/v1/catalog/collective'),
      api<Row[]>(`/v1/collective-activities${qs}`),
    ]);
    setCatalog(c);
    setRows(list);
  }

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha'))
      .finally(() => setLoading(false));
  }, [facilityId]);

  async function open(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    setError(null);
    setOk(null);
    try {
      const row = await api<{ id: string }>('/v1/collective-activities', {
        method: 'POST',
        json: {
          facilityId,
          activityType,
          theme,
          audience,
          shift,
          participantCount,
          notes: notes || undefined,
          procedures: ['0101050011'],
        },
      });
      setNotes('');
      setOk(`Atividade aberta (${row.id.slice(0, 8)}…). Finalize para gerar lote BPA.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao registrar');
    }
  }

  async function finish(id: string, count: number) {
    setError(null);
    setOk(null);
    try {
      const res = await api<{ productionBatch?: { id: string } }>(`/v1/collective-activities/${id}/finish`, {
        method: 'POST',
        json: { participantCount: Math.max(1, count) },
      });
      setOk(
        res.productionBatch?.id
          ? `Finalizada — lote ${res.productionBatch.id.slice(0, 8)}… (qty = participantes).`
          : 'Atividade finalizada.',
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao finalizar');
    }
  }

  const typeLabel = (id: string) => catalog?.activityTypes.find((t) => t.id === id)?.label || id;
  const themeLabel = (id: string) => catalog?.themes.find((t) => t.id === id)?.label || id;

  return (
    <AppShell helpId="coletivo.stub">
      <PageHeader
        title="Atividade coletiva"
        eyebrow="Operação"
        description="Ficha coletiva APS (RF-3.53) — educação em saúde, reunião e temas."
        actions={
          <>
            <HelpLink id="coletivo.stub" />
            <Link className="btn btn-secondary" href="/producao">
              Produção
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      <form className="card grid-2" onSubmit={open} style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Tipo de atividade</label>
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            {(catalog?.activityTypes || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Tema / prática</label>
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {(catalog?.themes || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Público-alvo</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {(catalog?.audiences || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Turno</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="MANHA">Manhã</option>
            <option value="TARDE">Tarde</option>
            <option value="NOITE">Noite</option>
          </select>
        </div>
        <div className="field">
          <label>Nº de participantes</label>
          <input
            className="mono"
            type="number"
            min={0}
            value={participantCount}
            onChange={(e) => setParticipantCount(Number(e.target.value))}
          />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Observações</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">
          Registrar atividade
        </button>
      </form>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Tipo</th>
              <th>Tema</th>
              <th>Participantes</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{formatDateTime(r.heldAt)}</td>
                <td>{typeLabel(r.activityType)}</td>
                <td>{themeLabel(r.theme)}</td>
                <td className="mono">{r.participantCount}</td>
                <td>{r.status}</td>
                <td>
                  {r.status !== 'COMPLETED' ? (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => void finish(r.id, r.participantCount)}
                    >
                      Finalizar
                    </button>
                  ) : (
                    <span className="mono">{r.productionBatchId?.slice(0, 8)}…</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <TableStateRow
                colSpan={6}
                loading={loading}
                empty={
                  facilityId
                    ? 'Nenhuma atividade coletiva nesta unidade.'
                    : 'Selecione uma unidade para listar atividades.'
                }
              />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
