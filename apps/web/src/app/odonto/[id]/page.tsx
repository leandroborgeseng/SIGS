'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError } from '@/lib/api';
import { displayPatientName, formatDateTime } from '@/lib/labels';

type Catalog = {
  config: {
    requireIneOnDentalOpen: boolean;
    defaultTipoAtendimento: number;
  };
  tipoAtendimento: Array<{ id: number; label: string }>;
  tiposConsultaOdonto: Array<{ id: number; label: string }>;
  localAtendimento: Array<{ id: number; label: string }>;
  turno: Array<{ id: number; label: string }>;
  vigilanciaSaudeBucal: Array<{ id: number; label: string }>;
  condutas: Array<{ id: string; label: string; lediId: number }>;
  fornecimentos: Array<{ id: string; label: string }>;
  justificativaNaoPossuiCpf: Array<{ id: number; label: string }>;
};

type Care = {
  tipoAtendimento: number;
  tiposConsultaOdonto: number[];
  localAtendimento: number;
  turno: number;
  gestante: boolean;
  necessidadesEspeciais: boolean;
  outcomes: string[];
  vigilanciaSaudeBucal: number[];
  fornecimentos: string[];
  problemasCondicoes: Array<{ ciap?: string; cid10?: string }>;
  stNaoPossuiCpf: boolean;
  justificativaNaoPossuiCpf?: number | null;
};

type Encounter = {
  id: string;
  status: string;
  anamnese?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  productionBatchId?: string | null;
  patient: {
    id: string;
    civilName: string;
    socialName?: string | null;
    cpf?: string | null;
    cns?: string | null;
    sex?: string;
    birthDate?: string;
  };
  facility: { id: string; name: string; cnes: string; ibgeCode?: string | null };
  professional?: { id: string; civilName: string } | null;
  procedures: Array<{ tooth?: string; code: string; label: string; done?: boolean }>;
  care: Care;
};

type FaoFinding = {
  severity: string;
  code: string;
  message: string;
  hint?: string;
};

type FaoReport = {
  conformant: boolean;
  summary: { blockers: number; moneyRisks: number; qualityWarns: number };
  findings: FaoFinding[];
};

function toggleNum(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function toggleStr(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export default function OdontoAtendimentoPage() {
  const params = useParams();
  const id = String(params.id || '');
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [enc, setEnc] = useState<Encounter | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [anamnese, setAnamnese] = useState('');
  const [ciap, setCiap] = useState('');
  const [cid10, setCid10] = useState('');
  const [procCode, setProcCode] = useState('0301010030');
  const [procLabel, setProcLabel] = useState('Consulta odontológica');
  const [tooth, setTooth] = useState('11');
  const [preview, setPreview] = useState<{ fao: FaoReport; siapsReady: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [cat, row] = await Promise.all([
      api<Catalog>('/v1/catalog/dental'),
      api<Encounter>(`/v1/dental-encounters/${id}`),
    ]);
    setCatalog(cat);
    setEnc(row);
    setCare(row.care);
    setAnamnese(row.anamnese || '');
    const p0 = row.care.problemasCondicoes?.[0];
    setCiap(p0?.ciap || '');
    setCid10(p0?.cid10 || '');
  }, [id]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [load]);

  async function refreshPreview() {
    try {
      const res = await api<{ fao: FaoReport; siapsReady: boolean }>(
        `/v1/dental-encounters/${id}/preview-fao`,
      );
      setPreview(res);
    } catch (err) {
      setPreview(null);
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function save(e?: FormEvent): Promise<boolean> {
    e?.preventDefault();
    if (!care || !enc || enc.status !== 'IN_PROGRESS') return false;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const problemas =
        ciap.trim() || cid10.trim()
          ? [{ ciap: ciap.trim() || undefined, cid10: cid10.trim() || undefined }]
          : [];
      const procedimentos = [{ tooth, code: procCode, label: procLabel, done: true }];
      const row = await api<Encounter>(`/v1/dental-encounters/${id}`, {
        method: 'PATCH',
        json: {
          anamnese,
          ...care,
          problemasCondicoes: problemas,
          procedures: procedimentos,
        },
      });
      setEnc(row);
      setCare(row.care);
      setOk('Rascunho salvo.');
      await refreshPreview();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!care) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const saved = await save();
      if (!saved) return;
      const res = await api<{ fao: FaoReport; productionBatch?: { id: string } }>(
        `/v1/dental-encounters/${id}/finish`,
        { method: 'POST', json: { enforceFaoConformity: true } },
      );
      setOk(
        res.fao.conformant
          ? `Finalizado Siaps-ready · lote ${res.productionBatch?.id?.slice(0, 8) || ''}…`
          : 'Finalizado com avisos.',
      );
      await load();
      setPreview({ fao: res.fao, siapsReady: res.fao.summary.blockers === 0 });
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'fao' in (err.body as object)) {
        const body = err.body as { message?: string; fao?: FaoReport };
        setPreview(body.fao ? { fao: body.fao, siapsReady: false } : null);
        setError(body.message || err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Falha ao finalizar');
      }
    } finally {
      setBusy(false);
    }
  }

  const blockers = useMemo(
    () => preview?.fao.findings.filter((f) => f.severity === 'BLOCKER') || [],
    [preview],
  );

  if (!enc || !care || !catalog) {
    return (
      <AppShell>
        <PageHeader title="Atendimento odonto" description="Carregando…" />
        <ErrorBox message={error} />
      </AppShell>
    );
  }

  const readonly = enc.status !== 'IN_PROGRESS';

  return (
    <AppShell>
      <PageHeader
        title={displayPatientName(enc.patient)}
        description={`${enc.facility.name} · CNES ${enc.facility.cnes} · ${enc.status}`}
        actions={
          <>
            <Link className="btn ghost" href="/odonto">
              Voltar
            </Link>
            <Link className="btn ghost" href="/odonto/lote">
              Lote LEDI
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      {ok && <p className="ok">{ok}</p>}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <form className="card" onSubmit={save}>
          <h2 style={{ marginTop: 0 }}>Identificação</h2>
          <p className="muted">
            CPF: {enc.patient.cpf || '—'} · CNS: {enc.patient.cns || '—'} · Sexo:{' '}
            {enc.patient.sex || '—'}
            <br />
            Início: {formatDateTime(enc.startedAt)}
            {catalog.config.requireIneOnDentalOpen && (
              <>
                <br />
                INE obrigatório nesta instalação.
              </>
            )}
          </p>
          <label className="check">
            <input
              type="checkbox"
              disabled={readonly}
              checked={care.stNaoPossuiCpf}
              onChange={(e) => setCare({ ...care, stNaoPossuiCpf: e.target.checked })}
            />
            Não possui CPF (`stNaoPossuiCpf`)
          </label>
          {care.stNaoPossuiCpf && (
            <label>
              Justificativa
              <select
                disabled={readonly}
                value={care.justificativaNaoPossuiCpf ?? ''}
                onChange={(e) =>
                  setCare({
                    ...care,
                    justificativaNaoPossuiCpf: e.target.value ? Number(e.target.value) : null,
                  })
                }
              >
                <option value="">—</option>
                {catalog.justificativaNaoPossuiCpf.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.id} — {j.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <h2>Tipo e contexto</h2>
          <label>
            Tipo de atendimento
            <select
              disabled={readonly}
              value={care.tipoAtendimento}
              onChange={(e) => setCare({ ...care, tipoAtendimento: Number(e.target.value) })}
            >
              {catalog.tipoAtendimento.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} — {t.label}
                </option>
              ))}
            </select>
          </label>
          {care.tipoAtendimento === 2 && (
            <fieldset>
              <legend>Tipo de consulta odonto</legend>
              {catalog.tiposConsultaOdonto.map((t) => (
                <label key={t.id} className="check">
                  <input
                    type="checkbox"
                    disabled={readonly}
                    checked={care.tiposConsultaOdonto.includes(t.id)}
                    onChange={() =>
                      setCare({
                        ...care,
                        tiposConsultaOdonto: toggleNum(care.tiposConsultaOdonto, t.id),
                      })
                    }
                  />
                  {t.id} — {t.label}
                </label>
              ))}
            </fieldset>
          )}
          <label>
            Local
            <select
              disabled={readonly}
              value={care.localAtendimento}
              onChange={(e) => setCare({ ...care, localAtendimento: Number(e.target.value) })}
            >
              {catalog.localAtendimento.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} — {t.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Turno
            <select
              disabled={readonly}
              value={care.turno}
              onChange={(e) => setCare({ ...care, turno: Number(e.target.value) })}
            >
              {catalog.turno.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id} — {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              disabled={readonly}
              checked={care.gestante}
              onChange={(e) => setCare({ ...care, gestante: e.target.checked })}
            />
            Gestante
          </label>
          <label className="check">
            <input
              type="checkbox"
              disabled={readonly}
              checked={care.necessidadesEspeciais}
              onChange={(e) => setCare({ ...care, necessidadesEspeciais: e.target.checked })}
            />
            Necessidades especiais
          </label>

          <h2>Clínico</h2>
          <label>
            Anamnese
            <textarea
              disabled={readonly}
              value={anamnese}
              onChange={(e) => setAnamnese(e.target.value)}
              rows={3}
            />
          </label>
          <div className="row-3">
            <label>
              Dente
              <input disabled={readonly} value={tooth} onChange={(e) => setTooth(e.target.value)} />
            </label>
            <label>
              SIGTAP
              <input
                disabled={readonly}
                value={procCode}
                onChange={(e) => setProcCode(e.target.value)}
              />
            </label>
            <label>
              Label
              <input
                disabled={readonly}
                value={procLabel}
                onChange={(e) => setProcLabel(e.target.value)}
              />
            </label>
          </div>

          <h2>Problemas (CIAP/CID) *</h2>
          <div className="row-2">
            <label>
              CIAP
              <input disabled={readonly} value={ciap} onChange={(e) => setCiap(e.target.value)} />
            </label>
            <label>
              CID-10
              <input disabled={readonly} value={cid10} onChange={(e) => setCid10(e.target.value)} />
            </label>
          </div>

          <h2>Vigilância saúde bucal *</h2>
          {catalog.vigilanciaSaudeBucal.map((v) => (
            <label key={v.id} className="check">
              <input
                type="checkbox"
                disabled={readonly}
                checked={care.vigilanciaSaudeBucal.includes(v.id)}
                onChange={() =>
                  setCare({
                    ...care,
                    vigilanciaSaudeBucal: toggleNum(care.vigilanciaSaudeBucal, v.id),
                  })
                }
              />
              {v.id} — {v.label}
            </label>
          ))}

          <h2>Condutas / desfecho *</h2>
          {catalog.condutas.map((c) => (
            <label key={c.id} className="check">
              <input
                type="checkbox"
                disabled={readonly}
                checked={care.outcomes.includes(c.id)}
                onChange={() => setCare({ ...care, outcomes: toggleStr(care.outcomes, c.id) })}
              />
              {c.lediId} — {c.label}
            </label>
          ))}

          <h2>Fornecimentos (RF-12.8)</h2>
          {catalog.fornecimentos.map((f) => (
            <label key={f.id} className="check">
              <input
                type="checkbox"
                disabled={readonly}
                checked={care.fornecimentos.includes(f.id)}
                onChange={() =>
                  setCare({ ...care, fornecimentos: toggleStr(care.fornecimentos, f.id) })
                }
              />
              {f.label}
            </label>
          ))}

          {!readonly && (
            <div className="actions" style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <button className="btn ghost" type="submit" disabled={busy}>
                Salvar rascunho
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => void finish()}>
                Finalizar e faturar
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={busy}
                onClick={() => void refreshPreview()}
              >
                Validar agora
              </button>
            </div>
          )}
        </form>

        <aside className="card">
          <h2 style={{ marginTop: 0 }}>Painel LEDI FAO</h2>
          {preview ? (
            <>
              <p>
                {preview.siapsReady ? (
                  <strong className="ok">Siaps-ready</strong>
                ) : (
                  <strong>BLOCKER: {preview.fao.summary.blockers}</strong>
                )}
                <br />
                <span className="muted">
                  $ {preview.fao.summary.moneyRisks} · warn {preview.fao.summary.qualityWarns}
                </span>
              </p>
              <ul className="findings">
                {blockers.map((f, i) => (
                  <li key={`${f.code}-${i}`}>
                    <code>{f.code}</code> — {f.message}
                    {f.hint ? <div className="muted">{f.hint}</div> : null}
                  </li>
                ))}
                {!blockers.length && <li className="muted">Nenhum blocker.</li>}
              </ul>
            </>
          ) : (
            <p className="muted">Salve ou clique em “Validar agora”.</p>
          )}
          {enc.productionBatchId && (
            <p>
              Production batch: <code>{enc.productionBatchId}</code>
            </p>
          )}
          <button className="btn ghost" type="button" onClick={() => router.push('/odonto')}>
            Lista
          </button>
        </aside>
      </div>
    </AppShell>
  );
}
