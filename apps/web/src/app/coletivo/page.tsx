'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { FieldToneLegend, LabeledField } from '@/components/ui/FieldHint';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/labels';

type Opt = { id: string; label: string };
type Catalog = {
  activityTypes: Opt[];
  audiences: Opt[];
  themes: Array<Opt & { group?: string }>;
  shifts?: Opt[];
  procedureHints?: Opt[];
};
type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
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
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activityType, setActivityType] = useState('EDUCACAO_SAUDE');
  const [theme, setTheme] = useState('ALIMENTACAO');
  const [audience, setAudience] = useState('COMUNIDADE');
  const [participantCount, setParticipantCount] = useState(10);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [procedureCode, setProcedureCode] = useState('0101050011');
  const [notes, setNotes] = useState('');
  const [shift, setShift] = useState('MANHA');

  const isReuniao = activityType.startsWith('REUNIAO');
  const themeOptions = (catalog?.themes || []).filter((t) =>
    isReuniao ? t.group === 'reuniao' : t.group !== 'reuniao',
  );

  async function load() {
    const qs = facilityId ? `?facilityId=${facilityId}` : '';
    const [c, list, pts, profs] = await Promise.all([
      api<Catalog>('/v1/catalog/collective'),
      api<Row[]>(`/v1/collective-activities${qs}`),
      api<Patient[]>('/v1/patients'),
      api<Professional[]>('/v1/professionals'),
    ]);
    setCatalog(c);
    setRows(list);
    setPatients(pts);
    setProfessionals(profs);
    if (!professionalId && profs[0]) setProfessionalId(profs[0].id);
    if (c?.procedureHints?.[0]) setProcedureCode((p) => p || c.procedureHints![0].id);
  }

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha'))
      .finally(() => setLoading(false));
  }, [facilityId]);

  useEffect(() => {
    if (!themeOptions.some((t) => t.id === theme) && themeOptions[0]) {
      setTheme(themeOptions[0].id);
    }
  }, [activityType, catalog]);

  async function open(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    setError(null);
    setOk(null);
    try {
      const count = Math.max(participantCount, participantIds.length, 1);
      const row = await api<{ id: string }>('/v1/collective-activities', {
        method: 'POST',
        json: {
          facilityId,
          professionalId: professionalId || undefined,
          activityType,
          theme,
          audience,
          shift,
          participantCount: count,
          participantIds: participantIds.length ? participantIds : undefined,
          notes: notes || undefined,
          procedures: [procedureCode].filter(Boolean),
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

  function toggleParticipant(id: string) {
    setParticipantIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const typeLabel = (id: string) => catalog?.activityTypes.find((t) => t.id === id)?.label || id;
  const themeLabel = (id: string) => catalog?.themes.find((t) => t.id === id)?.label || id;

  return (
    <AppShell helpId="coletivo.stub">
      <PageHeader
        title="Atividade coletiva"
        eyebrow="Operação"
        description="Ficha coletiva APS (RF-3.53) — enums LEDI, participantes nominais e lotação."
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
        <div style={{ gridColumn: '1 / -1' }}>
          <FieldToneLegend />
        </div>
        <div className="field">
          <label>Profissional (lotação)</label>
          <select value={professionalId} onChange={(e) => setProfessionalId(e.target.value)}>
            <option value="">Opcional…</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.civilName}
              </option>
            ))}
          </select>
        </div>
        <LabeledField label="Tipo de atividade" tone="siaps">
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            {(catalog?.activityTypes || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField label="Tema / prática" tone="siaps">
          <select value={theme} onChange={(e) => setTheme(e.target.value)}>
            {themeOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField label="Público-alvo" tone="siaps">
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {(catalog?.audiences || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField label="Turno" tone="previne" badgeLabel="Indicador">
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
        </LabeledField>
        <LabeledField
          label="Procedimento (SIGTAP)"
          tone="previne"
          hint="Ex.: 01.01.05.001-1 escovação supervisionada — Previne B4 (fora da FAO individual)."
        >
          <select value={procedureCode} onChange={(e) => setProcedureCode(e.target.value)}>
            {(catalog?.procedureHints || [{ id: '0101050011', label: 'Escovação' }]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField
          label="Nº de participantes"
          tone="siaps"
          hint="COLLECTIVE_QTY — BLOCKER se participantes < 1."
        >
          <input
            className="mono"
            type="number"
            min={0}
            value={participantCount}
            onChange={(e) => setParticipantCount(Number(e.target.value))}
          />
        </LabeledField>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Participantes nominais (opcional)</label>
          <div style={{ maxHeight: 140, overflow: 'auto', display: 'grid', gap: 4 }}>
            {patients.slice(0, 40).map((p) => (
              <label key={p.id} className="check" style={{ display: 'flex', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={participantIds.includes(p.id)}
                  onChange={() => toggleParticipant(p.id)}
                />
                {p.socialName || p.civilName}
              </label>
            ))}
            {!patients.length ? <span className="muted">Cadastre pacientes para lista nominal.</span> : null}
          </div>
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
