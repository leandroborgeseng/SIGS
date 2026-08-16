'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { CodeSearchSelect } from '@/components/ui/CodeSearchSelect';
import { FieldSection, FieldToneLegend, LabeledField } from '@/components/ui/FieldHint';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError } from '@/lib/api';
import { displayPatientName, formatDateTime } from '@/lib/labels';
import { getLediError } from '@/lib/ledi/error-registry';

type Catalog = {
  config: { requireIneOnApsOpen: boolean; defaultTipoAtendimento: number; fichaTipo: number };
  tipoAtendimento: Array<{ id: number; label: string }>;
  localAtendimento: Array<{ id: number; label: string }>;
  turno: Array<{ id: number; label: string }>;
  condutas: Array<{ id: string; label: string; lediId: number }>;
  justificativaNaoPossuiCpf: Array<{ id: number; label: string }>;
  procedimentos: Array<{ code: string; label: string; group?: string }>;
};

type Care = {
  faiOrigin: boolean;
  tipoAtendimento: number;
  localAtendimento: number;
  turno: number;
  outcomes: string[];
  problemasCondicoes: Array<{ ciap?: string; cid10?: string }>;
  procedimentos: Array<{ code: string; label: string; quantidade?: number }>;
  stNaoPossuiCpf: boolean;
  justificativaNaoPossuiCpf?: number | null;
  gestante?: boolean;
  soapSubjective?: string;
  soapObjective?: string;
  soapAssessment?: string;
  soapPlan?: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
};

type Encounter = {
  id: string;
  status: string;
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
  care: Care;
};

type Finding = { severity: string; code: string; message: string; hint?: string };
type FaiReport = {
  conformant: boolean;
  siapsReady?: boolean;
  summary: { blockers: number; moneyRisks: number; qualityWarns: number };
  findings: Finding[];
};
type PreviewResponse = {
  fai: FaiReport;
  siapsReady: boolean;
  canFinish?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Em atendimento',
  WAITING: 'Aguardando',
  COMPLETED: 'Finalizado',
  VOID: 'Anulado',
};

function toggleStr(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function findingTitle(code: string, fallback: string): string {
  return getLediError(code)?.title || fallback;
}

export default function ApsAtendimentoPage() {
  const params = useParams();
  const id = String(params.id || '');
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [enc, setEnc] = useState<Encounter | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  const [ciap, setCiap] = useState('');
  const [cid10, setCid10] = useState('');
  const [procCode, setProcCode] = useState('');
  const [sigtapQ, setSigtapQ] = useState('');
  const [sigtapHits, setSigtapHits] = useState<Array<{ code: string; name: string }>>([]);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveValidating, setLiveValidating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const readonly = enc?.status === 'COMPLETED' || enc?.status === 'VOID';

  async function load() {
    const [c, e] = await Promise.all([
      api<Catalog>('/v1/catalog/aps'),
      api<Encounter>(`/v1/encounters/${id}`),
    ]);
    setCatalog(c);
    setEnc(e);
    setCare(e.care);
    const first = e.care.problemasCondicoes?.[0];
    setCiap(first?.ciap || '');
    setCid10(first?.cid10 || '');
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [id]);

  const saveDraft = useCallback(
    async (nextCare: Care) => {
      await api(`/v1/encounters/${id}/clinical`, {
        method: 'PUT',
        json: {
          tipoAtendimento: nextCare.tipoAtendimento,
          localAtendimento: nextCare.localAtendimento,
          turno: nextCare.turno,
          outcomes: nextCare.outcomes,
          problemasCondicoes: [
            ...(ciap || cid10 ? [{ ciap: ciap || undefined, cid10: cid10 || undefined }] : []),
          ],
          procedimentos: nextCare.procedimentos,
          stNaoPossuiCpf: nextCare.stNaoPossuiCpf,
          justificativaNaoPossuiCpf: nextCare.justificativaNaoPossuiCpf,
          gestante: nextCare.gestante,
          soapSubjective: nextCare.soapSubjective || undefined,
          soapObjective: nextCare.soapObjective || undefined,
          soapAssessment: nextCare.soapAssessment || undefined,
          soapPlan: nextCare.soapPlan || undefined,
          weightKg: nextCare.weightKg,
          heightCm: nextCare.heightCm,
          headCircumferenceCm: nextCare.headCircumferenceCm,
        },
      });
    },
    [id, ciap, cid10],
  );

  const syncAndPreview = useCallback(
    async (opts?: { showErrors?: boolean }) => {
      if (!care || readonly) return;
      setLiveValidating(true);
      if (opts?.showErrors) setError(null);
      try {
        await saveDraft(care);
        const p = await api<PreviewResponse>(`/v1/encounters/${id}/preview-fai`);
        setPreview(p);
      } catch (err) {
        if (opts?.showErrors) {
          setError(err instanceof Error ? err.message : 'Falha na validação');
        }
      } finally {
        setLiveValidating(false);
      }
    },
    [care, id, readonly, saveDraft],
  );

  useEffect(() => {
    if (!care || readonly) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void syncAndPreview();
    }, 1000);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [care, ciap, cid10, readonly, syncAndPreview]);

  useEffect(() => {
    const q = sigtapQ.trim();
    if (q.length < 2) {
      setSigtapHits([]);
      return;
    }
    const t = setTimeout(() => {
      void api<Array<{ code: string; name: string }>>(
        `/v1/sigtap/procedures?q=${encodeURIComponent(q)}`,
      )
        .then(setSigtapHits)
        .catch(() => setSigtapHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [sigtapQ]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!care) return;
    setBusy(true);
    setError(null);
    try {
      await saveDraft(care);
      await load();
      await syncAndPreview({ showErrors: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
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
      await saveDraft(care);
      const res = await api<{ productionBatch?: { id: string } }>(`/v1/encounters/${id}/finish`, {
        method: 'POST',
        json: { outcomes: care.outcomes },
      });
      setOk('Atendimento finalizado e enviado à fila de faturamento APS.');
      await load();
      if (res.productionBatch?.id) {
        setEnc((prev) =>
          prev ? { ...prev, status: 'COMPLETED', productionBatchId: res.productionBatch!.id } : prev,
        );
      }
    } catch (err) {
      const body = err instanceof ApiError ? err.body : null;
      const msg =
        body && typeof body === 'object' && 'message' in body
          ? String((body as { message: unknown }).message)
          : err instanceof Error
            ? err.message
            : 'Falha ao finalizar';
      setError(msg);
      await syncAndPreview({ showErrors: true });
    } finally {
      setBusy(false);
    }
  }

  function addProc(code: string, label: string) {
    if (!care || !code) return;
    setCare({
      ...care,
      procedimentos: [
        ...care.procedimentos.filter((p) => p.code !== code),
        { code, label, quantidade: 1 },
      ],
    });
    setProcCode('');
    setSigtapQ('');
  }

  const blockers = useMemo(
    () => preview?.fai.findings.filter((f) => f.severity === 'BLOCKER') || [],
    [preview],
  );
  const warns = useMemo(
    () => preview?.fai.findings.filter((f) => f.severity !== 'BLOCKER') || [],
    [preview],
  );

  if (!catalog || !enc || !care) {
    return (
      <AppShell helpId="aps.atendimento">
        <p>Carregando ficha APS…</p>
        <ErrorBox message={error} />
      </AppShell>
    );
  }

  const filaHref = (() => {
    const qs = new URLSearchParams({ encounterId: enc.id });
    if (enc.productionBatchId) qs.set('batchId', enc.productionBatchId);
    return `/faturamento/aps?${qs}`;
  })();

  return (
    <AppShell helpId="aps.atendimento">
      <PageHeader
        title="Ficha APS — FAI tipo 4"
        description={`${displayPatientName(enc.patient)} · ${STATUS_LABEL[enc.status] || enc.status}`}
        actions={
          <>
            <HelpLink id="aps.atendimento" />
            <Link className="btn ghost" href="/aps">
              Lista
            </Link>
            <Link className="btn ghost" href={filaHref}>
              Fila faturamento
            </Link>
            <Link className="btn ghost" href="/faturamento/lote/fai">
              Lote FAI
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      {ok && <p className="ok">{ok}</p>}

      {enc.status === 'COMPLETED' && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Pós-fechamento</h2>
          <p style={{ marginTop: 0 }}>
            <strong className="ok">Finalizado</strong> — lote{' '}
            <code>individual_encounter</code> na fila APS.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={filaHref}>
              Abrir fila de faturamento
            </Link>
            <Link className="btn ghost" href="/faturamento/lote/fai">
              Lote LEDI FAI
            </Link>
          </div>
        </section>
      )}

      <div className="split-clinical">
        <form className="card stack" onSubmit={onSave}>
          <FieldToneLegend />
          <p className="muted" style={{ marginTop: 0 }}>
            Aberto em {formatDateTime(enc.startedAt)}
            {enc.professional ? ` · ${enc.professional.civilName}` : ''}
            {' · '}
            {enc.facility.name} (CNES {enc.facility.cnes})
          </p>

          <LabeledField
            label="Não possui CPF (`stNaoPossuiCpf`)"
            tone="siaps"
            hint="BLOCKER LEDI — identificação do cidadão no envio."
          >
            <label className="check" style={{ margin: 0 }}>
              <input
                type="checkbox"
                disabled={readonly}
                checked={care.stNaoPossuiCpf}
                onChange={(e) => setCare({ ...care, stNaoPossuiCpf: e.target.checked })}
              />
              Marcar quando o cidadão não tem CPF
            </label>
          </LabeledField>
          {care.stNaoPossuiCpf && (
            <LabeledField label="Justificativa" tone="siaps">
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
            </LabeledField>
          )}

          <h2>Tipo e contexto</h2>
          <LabeledField
            label="Tipo de atendimento"
            tone="siaps"
            hint="Também influencia Previne C1 (programada × espontânea) — finish exige tipo LEDI válido."
          >
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
          </LabeledField>
          <LabeledField label="Local" tone="siaps">
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
          </LabeledField>
          <LabeledField
            label="Turno"
            tone="previne"
            badgeLabel="Indicador"
            hint="QUALITY_WARN no pré-envio se ausente."
          >
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
          </LabeledField>
          <LabeledField
            label="Gestante"
            tone="previne"
            hint="Abre denominadores clínicos Previne (ex. C3) quando marcado com coerência de sexo."
          >
            <label className="check" style={{ margin: 0 }}>
              <input
                type="checkbox"
                disabled={readonly}
                checked={!!care.gestante}
                onChange={(e) => setCare({ ...care, gestante: e.target.checked })}
              />
              Gestante
            </label>
          </LabeledField>

          <FieldSection
            title="Antropometria (LEDI medições)"
            tone="previne"
            hint="Peso/altura no mesmo registro alimentam indicadores C2–C6 (doc 15). Não são BLOCKER FAI sozinhos."
          >
            <div className="row-2">
              <label>
                Peso (kg)
                <input
                  type="number"
                  step="0.1"
                  min={0.5}
                  max={500}
                  disabled={readonly}
                  value={care.weightKg ?? ''}
                  onChange={(e) =>
                    setCare({
                      ...care,
                      weightKg: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label>
                Altura (cm)
                <input
                  type="number"
                  step="0.1"
                  min={20}
                  max={250}
                  disabled={readonly}
                  value={care.heightCm ?? ''}
                  onChange={(e) =>
                    setCare({
                      ...care,
                      heightCm: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </label>
            </div>
            <label>
              Perímetro cefálico (cm)
              <input
                type="number"
                step="0.1"
                min={10}
                max={200}
                disabled={readonly}
                value={care.headCircumferenceCm ?? ''}
                onChange={(e) =>
                  setCare({
                    ...care,
                    headCircumferenceCm: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </label>
          </FieldSection>

          <h2>SOAP</h2>
          <label>
            Subjetivo (S)
            <textarea
              disabled={readonly}
              rows={2}
              value={care.soapSubjective || ''}
              onChange={(e) => setCare({ ...care, soapSubjective: e.target.value })}
              placeholder="Queixa / história…"
            />
          </label>
          <label>
            Objetivo (O)
            <textarea
              disabled={readonly}
              rows={2}
              value={care.soapObjective || ''}
              onChange={(e) => setCare({ ...care, soapObjective: e.target.value })}
              placeholder="Exame físico / achados…"
            />
          </label>
          <label>
            Avaliação (A)
            <textarea
              disabled={readonly}
              rows={2}
              value={care.soapAssessment || ''}
              onChange={(e) => setCare({ ...care, soapAssessment: e.target.value })}
              placeholder="Hipóteses / diagnóstico…"
            />
          </label>
          <label>
            Plano (P)
            <textarea
              disabled={readonly}
              rows={2}
              value={care.soapPlan || ''}
              onChange={(e) => setCare({ ...care, soapPlan: e.target.value })}
              placeholder="Conduta / plano terapêutico…"
            />
          </label>

          <FieldSection
            title="Problemas (CIAP/CID) *"
            tone="siaps"
            hint="Obrigatório para FAI Siaps-ready (problemasCondicoes)."
          >
            <div className="row-2">
              <CodeSearchSelect
                kind="ciap"
                domain="aps"
                label="CIAP"
                value={ciap}
                onChange={setCiap}
                disabled={readonly}
                placeholder="Buscar CIAP…"
                tone="siaps"
              />
              <CodeSearchSelect
                kind="cid10"
                domain="aps"
                label="CID-10"
                value={cid10}
                onChange={setCid10}
                disabled={readonly}
                placeholder="Buscar CID-10…"
                tone="siaps"
              />
            </div>
          </FieldSection>

          <h2>Procedimentos SIGTAP</h2>
          <label>
            Catálogo APS
            <select
              disabled={readonly}
              value={procCode}
              onChange={(e) => setProcCode(e.target.value)}
            >
              <option value="">Selecione…</option>
              {catalog.procedimentos.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.code} — {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn ghost"
            disabled={readonly || !procCode}
            onClick={() => {
              const item = catalog.procedimentos.find((p) => p.code === procCode);
              if (item) addProc(item.code, item.label);
            }}
          >
            Adicionar
          </button>
          <label>
            Buscar SIGTAP
            <input
              disabled={readonly}
              value={sigtapQ}
              onChange={(e) => setSigtapQ(e.target.value)}
              placeholder="Código ou nome…"
            />
          </label>
          {sigtapHits.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {sigtapHits.slice(0, 8).map((h) => (
                <li key={h.code}>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={readonly}
                    onClick={() => addProc(h.code, h.name)}
                  >
                    {h.code} — {h.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {care.procedimentos.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
              {care.procedimentos.map((p) => (
                <li key={p.code} className="check" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span>
                    {p.code} · {p.label}
                  </span>
                  {!readonly && (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() =>
                        setCare({
                          ...care,
                          procedimentos: care.procedimentos.filter((x) => x.code !== p.code),
                        })
                      }
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhum procedimento — escolha no catálogo APS ou busque SIGTAP.</p>
          )}

          <FieldSection
            title="Condutas / encaminhamentos FAI *"
            tone="siaps"
            hint="OUTCOMES_MISSING — BLOCKER. Catálogo TipoEncaminhamentoIndividual (não odonto)."
          >
            <p className="muted" style={{ marginTop: 0 }}>
              Catálogo TipoEncaminhamentoIndividual — não usar condutas odonto.
            </p>
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
          </FieldSection>

          {!readonly && (
            <div className="actions" style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn ghost" type="submit" disabled={busy}>
                Salvar rascunho
              </button>
              <button className="btn" type="button" disabled={busy} onClick={() => void finish()}>
                Finalizar e faturar
              </button>
              <button
                className="btn ghost"
                type="button"
                disabled={busy || liveValidating}
                onClick={() => void syncAndPreview({ showErrors: true })}
              >
                Validar agora
              </button>
            </div>
          )}
        </form>

        <aside className="card">
          <h2 style={{ marginTop: 0 }}>Painel LEDI FAI</h2>
          {liveValidating && <p className="muted">Validando…</p>}
          {preview ? (
            <>
              <p>
                {preview.siapsReady ? (
                  <strong className="ok">Siaps-ready (FAI tipo 4)</strong>
                ) : (
                  <strong>BLOCKER: {preview.fai.summary.blockers}</strong>
                )}
                <br />
                <span className="muted">LEDI warn {preview.fai.summary.qualityWarns}</span>
              </p>
              <p className="muted" style={{ fontSize: 13 }}>
                Finalizar exige zero BLOCKER Siaps. Depois: fila{' '}
                <Link href="/faturamento/aps">/faturamento/aps</Link> · XML legado em{' '}
                <Link href="/faturamento/lote/fai">/faturamento/lote/fai</Link>.
              </p>
              <h3 style={{ marginBottom: 4 }}>Siaps / LEDI</h3>
              <ul className="findings">
                {blockers.map((f, i) => (
                  <li key={`${f.code}-${i}`}>
                    <code>{f.code}</code> — {findingTitle(f.code, f.message)}
                    {f.hint ? <div className="muted">{f.hint}</div> : null}
                  </li>
                ))}
                {!blockers.length && <li className="muted">Nenhum blocker.</li>}
              </ul>
              {warns.length ? (
                <ul className="findings">
                  {warns.map((f, i) => (
                    <li key={`w-${f.code}-${i}`}>
                      <code>{f.code}</code> — {findingTitle(f.code, f.message)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="muted">
              A validação roda ~1s após editar (salva rascunho + preview). Ou use “Validar agora”.
            </p>
          )}
          {enc.productionBatchId && (
            <p>
              Production batch: <code>{enc.productionBatchId}</code>
            </p>
          )}
          <button className="btn ghost" type="button" onClick={() => router.push('/aps')}>
            Lista
          </button>
        </aside>
      </div>
    </AppShell>
  );
}
