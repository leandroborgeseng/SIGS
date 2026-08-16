'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { CodeSearchSelect } from '@/components/ui/CodeSearchSelect';
import { FieldToneLegend, LabeledField } from '@/components/ui/FieldHint';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Patient = { id: string; civilName: string; socialName?: string | null };
type Professional = { id: string; civilName: string };
type Catalog = {
  careTypes: Array<{ id: string; label: string }>;
  shifts: Array<{ id: string; label: string }>;
  desfechos?: Array<{ id: string; label: string }>;
  encounterTypes?: Array<{ id: string; label: string }>;
  careLocations?: Array<{ id: string; label: string }>;
  condicoesAvaliadas?: Array<{ id: string; label: string; lediId: number }>;
  maxChildren?: number;
  defaultProcedure: string;
  procedureHints: Array<{ id: string; label: string }>;
};
type Row = {
  id: string;
  status: string;
  careType: string;
  shift?: string;
  visitedAt: string;
  childCount?: number;
  patient: Patient;
  productionBatchId?: string | null;
};
type PreflightFinding = {
  code: string;
  severity: string;
  message: string;
  hint?: string;
};
type PreviewRes = {
  canFinish: boolean;
  childCount?: number;
  preflight?: {
    blockers: number;
    moneyRisks: number;
    qualityWarns: number;
    findings: PreflightFinding[];
  };
};

export default function HomeCarePage() {
  const { facilityId } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [patientIds, setPatientIds] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [careType, setCareType] = useState('AD1');
  const [shift, setShift] = useState('MANHA');
  const [encounterType, setEncounterType] = useState('ATENDIMENTO_PROGRAMADO');
  const [careLocation, setCareLocation] = useState('DOMICILIO');
  const [procCode, setProcCode] = useState('0101040024');
  const [notes, setNotes] = useState('');
  const [desfecho, setDesfecho] = useState('PERMANENCIA');
  const [condicoes, setCondicoes] = useState<number[]>([]);
  const [ciap, setCiap] = useState('');
  const [cid10, setCid10] = useState('');
  const [addPatientId, setAddPatientId] = useState('');
  const [preview, setPreview] = useState<{ visitId: string; data: PreviewRes } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  function problemasPayload() {
    if (!ciap.trim() && !cid10.trim()) return undefined;
    return [{ ciap: ciap.trim() || undefined, cid10: cid10.trim() || undefined }];
  }

  function finishBody() {
    return {
      procedures: [procCode, 'VISITA', 'ORIENTACAO'],
      desfecho,
      encounterType,
      careLocation,
      condicoesAvaliadas: condicoes.length ? condicoes : undefined,
      problemasCondicoes: problemasPayload(),
    };
  }

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

  function togglePatient(id: string) {
    setPatientIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleCondicao(lediId: number) {
    setCondicoes((prev) =>
      prev.includes(lediId) ? prev.filter((x) => x !== lediId) : [...prev, lediId],
    );
  }

  async function open(e: FormEvent) {
    e.preventDefault();
    if (!facilityId) return setError('Selecione uma unidade.');
    if (!patientIds.length) return setError('Selecione ao menos um cidadão.');
    setError(null);
    setOk(null);
    setPreview(null);
    try {
      const row = await api<{ id: string; careType: string; childCount?: number }>(
        '/v1/home-care-visits',
        {
          method: 'POST',
          json: {
            patientIds,
            facilityId,
            professionalId: professionalId || undefined,
            careType,
            shift,
            encounterType,
            careLocation,
            notes,
            procedures: [procCode, 'VISITA'].filter(Boolean),
            condicoesAvaliadas: condicoes.length ? condicoes : undefined,
            problemasCondicoes: problemasPayload(),
          },
        },
      );
      setNotes('');
      setOk(
        `Ficha ${row.careType} aberta com ${row.childCount ?? patientIds.length} atendimento(s) (${row.id.slice(0, 8)}…). Finalize para gerar lote.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir');
    }
  }

  async function addChild(visitId: string) {
    if (!addPatientId) return setError('Selecione o paciente a incluir.');
    setError(null);
    setOk(null);
    try {
      const res = await api<{ childCount?: number; children?: unknown[] }>(
        `/v1/home-care-visits/${visitId}/children`,
        {
          method: 'POST',
          json: {
            patientId: addPatientId,
            careType,
            shift,
            problemasCondicoes: problemasPayload(),
          },
        },
      );
      setAddPatientId('');
      setOk(`Cidadão incluído — ficha com ${res.childCount ?? res.children?.length ?? '?'} atendimentos.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao incluir');
    }
  }

  async function runPreview(id: string) {
    setError(null);
    setOk(null);
    try {
      const data = await api<PreviewRes>(`/v1/home-care-visits/${id}/preview`, {
        method: 'POST',
        json: finishBody(),
      });
      setPreview({ visitId: id, data });
      const w = data.preflight?.qualityWarns ?? 0;
      const m = data.preflight?.moneyRisks ?? 0;
      setOk(
        data.canFinish
          ? `Preflight OK (${data.childCount ?? '?'} children · ${w} aviso(s) · ${m} risco$).`
          : `Preflight com ${data.preflight?.blockers ?? '?'} blocker(s) — corrija antes de finalizar.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no preflight');
    }
  }

  async function finish(id: string) {
    setError(null);
    setOk(null);
    try {
      const res = await api<{
        productionBatch?: { id: string; payload?: { atendimentosDomiciliares?: unknown[] } };
        visit?: { childCount?: number };
      }>(`/v1/home-care-visits/${id}/finish`, {
        method: 'POST',
        json: finishBody(),
      });
      const n =
        res.productionBatch?.payload?.atendimentosDomiciliares?.length ??
        res.visit?.childCount ??
        1;
      setPreview(null);
      setOk(
        res.productionBatch?.id
          ? `Finalizada — lote ${res.productionBatch.id.slice(0, 8)}… com ${n} atendimento(s) LEDI (SIGTAP 0101040024 × ${n}).`
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
        description="Ficha AD multi-cidadão (1–99) → lote home_care LEDI/BPA · RF-3.54 · CIAP/CID + preflight."
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
        <div style={{ gridColumn: '1 / -1' }}>
          <FieldToneLegend />
        </div>
        <div className="field field--tone-siaps" style={{ gridColumn: '1 / -1' }}>
          <div className="field-label-row">
            <span className="field-label">Cidadãos na ficha ({patientIds.length})</span>
            <span className="field-badge field-badge--siaps">Siaps</span>
          </div>
          <p className="field-hint field-hint--siaps">AD_CHILD_MISSING — ≥1 cidadão; máx. 99 (BLOCKER).</p>
          <div style={{ maxHeight: 160, overflow: 'auto', display: 'grid', gap: 4 }}>
            {patients.slice(0, 60).map((p) => (
              <label key={p.id} className="check" style={{ display: 'flex', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={patientIds.includes(p.id)}
                  onChange={() => togglePatient(p.id)}
                />
                {displayPatientName(p)}
              </label>
            ))}
            {!patients.length ? <span className="muted">Cadastre pacientes para montar a ficha.</span> : null}
          </div>
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
        <LabeledField
          label="Modalidade"
          tone="siaps"
          hint="AD_MODALITY_MISSING — MONEY_RISK/BLOCKER se AD1/AD2/AD3 ausente."
        >
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
        </LabeledField>
        <LabeledField label="Turno" tone="previne" badgeLabel="Indicador" hint="QUALITY_WARN se ausente no child.">
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
        <LabeledField label="Tipo de atendimento (LEDI)" tone="previne" badgeLabel="Indicador">
          <select value={encounterType} onChange={(e) => setEncounterType(e.target.value)}>
            {(catalog?.encounterTypes || [
              { id: 'ATENDIMENTO_PROGRAMADO', label: 'Programado' },
              { id: 'ATENDIMENTO_NAO_PROGRAMADO', label: 'Não programado' },
              { id: 'VISITA_DOMICILIAR_POS_OBITO', label: 'Pós-óbito' },
            ]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <div className="field">
          <label>Local</label>
          <select value={careLocation} onChange={(e) => setCareLocation(e.target.value)}>
            {(catalog?.careLocations || [{ id: 'DOMICILIO', label: 'Domicílio' }]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <LabeledField label="Procedimento (SIGTAP / stub)" tone="siaps">
          <select value={procCode} onChange={(e) => setProcCode(e.target.value)}>
            {(catalog?.procedureHints || [{ id: '0101040024', label: 'Visita domiciliar' }]).map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <LabeledField
          label="Desfecho (ao finalizar)"
          tone="previne"
          badgeLabel="Indicador"
          hint="AD_DESFECHO_MISSING — QUALITY_WARN."
        >
          <select value={desfecho} onChange={(e) => setDesfecho(e.target.value)}>
            {(catalog?.desfechos || [
              { id: 'PERMANENCIA', label: 'Permanência' },
              { id: 'ALTA', label: 'Alta clínica' },
            ]).map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </LabeledField>
        <div className="field">
          <CodeSearchSelect
            kind="ciap"
            domain="aps"
            label="CIAP (problema)"
            value={ciap}
            onChange={setCiap}
            placeholder="Buscar CIAP…"
            tone="previne"
            badgeLabel="Indicador"
          />
        </div>
        <div className="field">
          <CodeSearchSelect
            kind="cid10"
            domain="aps"
            label="CID-10"
            value={cid10}
            onChange={setCid10}
            placeholder="Buscar CID-10…"
            tone="previne"
            badgeLabel="Indicador"
          />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Condições avaliadas (LEDI)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 4 }}>
            {(catalog?.condicoesAvaliadas || []).slice(0, 12).map((c) => (
              <label key={c.lediId} className="check" style={{ display: 'flex', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={condicoes.includes(c.lediId)}
                  onChange={() => toggleCondicao(c.lediId)}
                />
                {c.label}
              </label>
            ))}
            {!catalog?.condicoesAvaliadas?.length ? (
              <span className="muted">Catálogo carregará com a API.</span>
            ) : null}
          </div>
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label>Notas clínicas / orientação</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit">
          Registrar ficha AD
        </button>
      </form>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
        <div className="field" style={{ flex: 1, minWidth: 200 }}>
          <label>Incluir cidadão em ficha aberta</label>
          <select value={addPatientId} onChange={(e) => setAddPatientId(e.target.value)}>
            <option value="">Selecionar…</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {displayPatientName(p)}
              </option>
            ))}
          </select>
        </div>
        <span className="muted" style={{ alignSelf: 'center' }}>
          Use o botão “+ cidadão” na linha da visita.
        </span>
      </div>

      {preview ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-label">
            Preflight AD · {preview.visitId.slice(0, 8)}… · blockers {preview.data.preflight?.blockers ?? 0} ·
            avisos {preview.data.preflight?.qualityWarns ?? 0}
          </div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
            {(preview.data.preflight?.findings || []).slice(0, 12).map((f, i) => (
              <li key={`${f.code}-${i}`}>
                <span className="mono">{f.severity}</span> · {f.message}
                {f.hint ? <span className="muted"> — {f.hint}</span> : null}
              </li>
            ))}
            {!preview.data.preflight?.findings?.length ? (
              <li className="muted">Sem achados — pode finalizar.</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Quando</th>
              <th>Âncora</th>
              <th>Cidadãos</th>
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
                <td className="mono">{r.childCount ?? 1}</td>
                <td>{r.careType}</td>
                <td>{r.shift || '—'}</td>
                <td>{r.status}</td>
                <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.status !== 'COMPLETED' ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void addChild(r.id)}
                        disabled={!addPatientId}
                      >
                        + cidadão
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void runPreview(r.id)}
                      >
                        Preflight
                      </button>
                      <button type="button" className="btn btn-primary" onClick={() => void finish(r.id)}>
                        Finalizar
                      </button>
                    </>
                  ) : (
                    <span className="mono">{r.productionBatchId?.slice(0, 8)}…</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>Nenhuma visita domiciliar nesta unidade.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
