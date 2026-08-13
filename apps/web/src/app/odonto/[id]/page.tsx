'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import {
  OdontogramGrid,
  type OdontogramArches,
  type OdontogramCondition,
  type OdontogramScopes,
} from '@/components/odonto/OdontogramGrid';
import { CodeSearchSelect } from '@/components/ui/CodeSearchSelect';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError } from '@/lib/api';
import { displayPatientName, formatDateTime } from '@/lib/labels';
import { getLediError } from '@/lib/ledi/error-registry';

/** Espelha procedurePlacementFromKey do domínio API (FDI → tooth; Q/S/BOCA → region). */
function procedurePlacementFromKey(key: string): { tooth?: string; region?: string } {
  const k = String(key || '').trim();
  if (/^\d{2}$/.test(k)) return { tooth: k };
  const scope = k.toUpperCase();
  if (/^Q[1-4]$/.test(scope) || /^S[1-6]$/.test(scope) || scope === 'BOCA') {
    return { region: scope };
  }
  return {};
}

function selectionKeyFromProcedure(p: {
  tooth?: string | null;
  region?: string | null;
}): string {
  const tooth = String(p.tooth || '').trim();
  if (/^\d{2}$/.test(tooth)) return tooth;
  const region = String(p.region || '').trim().toUpperCase();
  if (/^Q[1-4]$/.test(region) || /^S[1-6]$/.test(region) || region === 'BOCA') return region;
  return tooth || '';
}

function clientScopeFromKey(key: string): string | null {
  const k = String(key || '').trim();
  if (/^\d{2}$/.test(k)) return 'tooth';
  const u = k.toUpperCase();
  if (/^Q[1-4]$/.test(u)) return 'quadrant';
  if (/^S[1-6]$/.test(u)) return 'sextant';
  if (u === 'BOCA') return 'mouth';
  return null;
}

function catalogFitsSelection(
  item: { scopes: string[] },
  selectedKey: string,
): boolean {
  if (item.scopes.length === 1 && item.scopes[0] === 'encounter') return true;
  const scope = clientScopeFromKey(selectedKey);
  if (!scope) return item.scopes.includes('encounter');
  return item.scopes.includes(scope);
}

function procedureLine(p: {
  tooth?: string;
  region?: string;
  code: string;
  label: string;
}): string {
  const loc = p.tooth || p.region || 'atendimento';
  return `${p.code} · ${p.label} (${loc})`;
}

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
  odontogram?: {
    conditions: OdontogramCondition[];
    arches: OdontogramArches;
    scopes?: OdontogramScopes;
    note?: string;
  };
  predefinedProcedures?: {
    procedures: Array<{
      code: string;
      label: string;
      group: string;
      scopes: string[];
      previne?: string | null;
    }>;
    note?: string;
  };
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
  procedures: Array<{
    tooth?: string;
    region?: string;
    code: string;
    label: string;
    done?: boolean;
  }>;
  odontogram?: Record<string, string>;
  care: Care;
  voidMeta?: {
    postCompleted?: boolean;
    localOnly?: boolean;
    ministryRecall?: boolean;
    warning?: string | null;
  };
};

type FaoFinding = {
  severity: string;
  code: string;
  message: string;
  hint?: string;
};

type PrevineGap = {
  code: string;
  indicator: string;
  severity: string;
  message: string;
  hint?: string;
  repair?: string;
};

type PrevineXray = {
  channel: string;
  gaps: PrevineGap[];
  summary: { moneyRisks: number; qualityWarns: number; infos: number; gapCount: number };
  signals?: { vigilanciaOnly99?: boolean };
};

type FaoReport = {
  conformant: boolean;
  summary: { blockers: number; moneyRisks: number; qualityWarns: number };
  findings: FaoFinding[];
  previneXray?: PrevineXray;
  previneReady?: boolean;
  siapsReady?: boolean;
};

type PreviewResponse = {
  fao: FaoReport;
  siapsReady: boolean;
  previne?: PrevineXray | null;
  previneReady?: boolean;
  vigilanciaOnly99?: boolean;
  canFinish?: boolean;
};

function toggleNum(list: number[], id: number): number[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function toggleStr(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function findingTitle(code: string, fallback: string): string {
  return getLediError(code)?.title || fallback;
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
  const [procedures, setProcedures] = useState<
    Array<{ tooth?: string; region?: string; code: string; label: string; done?: boolean }>
  >([]);
  const [catalogCode, setCatalogCode] = useState('');
  const [selectedKey, setSelectedKey] = useState('11');
  const [odontogram, setOdontogram] = useState<Record<string, string>>({});
  const [showDeciduous, setShowDeciduous] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveValidating, setLiveValidating] = useState(false);
  const [finishSummary, setFinishSummary] = useState<{
    siapsReady: boolean;
    productionBatchId?: string;
    blockers: number;
  } | null>(null);
  const skipLiveRef = useRef(true);
  const liveSeqRef = useRef(0);

  const load = useCallback(async () => {
    const [cat, row] = await Promise.all([
      api<Catalog>('/v1/catalog/dental'),
      api<Encounter>(`/v1/dental-encounters/${id}`),
    ]);
    skipLiveRef.current = true;
    setCatalog(cat);
    setEnc(row);
    setCare(row.care);
    setAnamnese(row.anamnese || '');
    const p0 = row.care.problemasCondicoes?.[0];
    setCiap(p0?.ciap || '');
    setCid10(p0?.cid10 || '');
    const proc0 = row.procedures?.[0];
    if (proc0) {
      const key = selectionKeyFromProcedure(proc0);
      if (key) setSelectedKey(key);
    }
    setProcedures(row.procedures || []);
    setOdontogram(row.odontogram || {});
    const marked = Object.keys(row.odontogram || {});
    if (marked.some((t) => /^\d{2}$/.test(t) && Number(t) >= 51)) setShowDeciduous(true);
    if (row.status === 'COMPLETED') {
      setFinishSummary((prev) =>
        prev || {
          siapsReady: true,
          productionBatchId: row.productionBatchId || undefined,
          blockers: 0,
        },
      );
    }
  }, [id]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [load]);

  async function refreshPreview(opts?: { quiet?: boolean }) {
    try {
      const res = await api<PreviewResponse>(`/v1/dental-encounters/${id}/preview-fao`);
      setPreview(res);
      return res;
    } catch (err) {
      setPreview(null);
      if (!opts?.quiet && err instanceof ApiError) {
        setError(err.message);
      }
      return null;
    }
  }

  const buildPatchBody = useCallback(() => {
    if (!care) return null;
    const problemas =
      ciap.trim() || cid10.trim()
        ? [{ ciap: ciap.trim() || undefined, cid10: cid10.trim() || undefined }]
        : [];
    return {
      anamnese,
      ...care,
      problemasCondicoes: problemas,
      procedures,
      odontogram,
    };
  }, [care, anamnese, ciap, cid10, procedures, odontogram]);

  const draftFingerprint = useMemo(
    () => JSON.stringify(buildPatchBody()),
    [buildPatchBody],
  );

  async function save(e?: FormEvent, opts?: { quiet?: boolean }): Promise<boolean> {
    e?.preventDefault();
    if (!care || !enc || enc.status !== 'IN_PROGRESS') return false;
    const body = buildPatchBody();
    if (!body) return false;
    if (!opts?.quiet) {
      setBusy(true);
      setError(null);
      setOk(null);
    }
    try {
      const row = await api<Encounter>(`/v1/dental-encounters/${id}`, {
        method: 'PATCH',
        json: body,
      });
      skipLiveRef.current = true;
      setEnc(row);
      setCare(row.care);
      setOdontogram(row.odontogram || {});
      if (!opts?.quiet) {
        setOk('Rascunho salvo.');
        await refreshPreview();
      }
      return true;
    } catch (err) {
      if (!opts?.quiet) {
        setError(err instanceof Error ? err.message : 'Falha ao salvar');
      }
      return false;
    } finally {
      if (!opts?.quiet) setBusy(false);
    }
  }

  /** Salva rascunho + preview FAO (debounce / Validar agora). */
  async function syncAndPreview(opts?: { fromLive?: boolean; showErrors?: boolean }) {
    if (!care || !enc || enc.status !== 'IN_PROGRESS') return;
    const body = buildPatchBody();
    if (!body) return;
    const seq = ++liveSeqRef.current;
    if (opts?.fromLive) setLiveValidating(true);
    try {
      const row = await api<Encounter>(`/v1/dental-encounters/${id}`, {
        method: 'PATCH',
        json: body,
      });
      if (seq !== liveSeqRef.current) return;
      skipLiveRef.current = true;
      setEnc(row);
      setCare(row.care);
      await refreshPreview({ quiet: !opts?.showErrors });
    } catch (err) {
      if (opts?.showErrors) {
        setError(err instanceof Error ? err.message : 'Falha ao validar');
      }
    } finally {
      if (opts?.fromLive && seq === liveSeqRef.current) setLiveValidating(false);
    }
  }

  useEffect(() => {
    if (!enc || enc.status !== 'IN_PROGRESS' || !care) return;
    if (skipLiveRef.current) {
      skipLiveRef.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void syncAndPreview({ fromLive: true });
    }, 900);
    return () => window.clearTimeout(t);
    // Intencional: só reage ao fingerprint do rascunho (debounce sem spam).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFingerprint]);

  async function finish() {
    if (!care) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const saved = await save(undefined, { quiet: true });
      if (!saved) {
        setError('Não foi possível salvar antes de finalizar.');
        return;
      }
      const res = await api<{
        fao: FaoReport;
        productionBatch?: { id: string };
        encounter?: Encounter;
      }>(`/v1/dental-encounters/${id}/finish`, {
        method: 'POST',
        json: { enforceFaoConformity: true },
      });
      setFinishSummary({
        siapsReady: res.fao.conformant && res.fao.summary.blockers === 0,
        productionBatchId: res.productionBatch?.id,
        blockers: res.fao.summary.blockers,
      });
      setOk(
        res.fao.summary.blockers === 0
          ? 'Atendimento finalizado e enviado à fila de faturamento.'
          : 'Finalizado com avisos.',
      );
      await load();
      setPreview({
        fao: res.fao,
        siapsReady: res.fao.summary.blockers === 0,
        previne: res.fao.previneXray || null,
        previneReady: res.fao.previneReady,
        vigilanciaOnly99: !!res.fao.previneXray?.signals?.vigilanciaOnly99,
        canFinish: res.fao.summary.blockers === 0,
      });
    } catch (err) {
      if (err instanceof ApiError && err.body && typeof err.body === 'object' && 'fao' in (err.body as object)) {
        const body = err.body as { message?: string; fao?: FaoReport };
        setPreview(
          body.fao
            ? {
                fao: body.fao,
                siapsReady: false,
                previne: body.fao.previneXray || null,
                canFinish: false,
              }
            : null,
        );
        setError(body.message || err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Falha ao finalizar');
      }
    } finally {
      setBusy(false);
    }
  }

  async function voidEncounter() {
    if (!enc || (enc.status !== 'IN_PROGRESS' && enc.status !== 'COMPLETED')) return;

    if (enc.status === 'IN_PROGRESS') {
      if (!confirm('Anular este atendimento em andamento? Ele sairá da fila de faturamento.')) {
        return;
      }
    } else {
      const okVoid = confirm(
        [
          'Anular atendimento já FINALIZADO?',
          '',
          'Isto é anulação LOCAL no SIGS:',
          '• status → VOID e lote sai da fila (error)',
          '• NÃO há estorno/XML de exclusão no Ministério/Siaps',
          '• se o XML já foi enviado, o recall não é feito por aqui',
          '',
          'Confirma anulação local?',
        ].join('\n'),
      );
      if (!okVoid) return;
    }

    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const row = await api<Encounter>(`/v1/dental-encounters/${id}/void`, {
        method: 'POST',
        json: {
          reason:
            enc.status === 'COMPLETED'
              ? 'Anulado na UI clínica (pós-COMPLETED, local)'
              : 'Anulado na UI clínica (rascunho)',
          ...(enc.status === 'COMPLETED' ? { acknowledgeLocalOnly: true } : {}),
        },
      });
      skipLiveRef.current = true;
      setEnc(row);
      setFinishSummary(null);
      setOk(
        row.voidMeta?.warning
          ? `Atendimento anulado (VOID). ${row.voidMeta.warning}`
          : 'Atendimento anulado (VOID).',
      );
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao anular');
    } finally {
      setBusy(false);
    }
  }

  const blockers = useMemo(
    () => preview?.fao.findings.filter((f) => f.severity === 'BLOCKER') || [],
    [preview],
  );

  const previneGaps = useMemo(() => {
    const gaps = preview?.previne?.gaps || preview?.fao.previneXray?.gaps || [];
    return gaps.filter((g) => g.severity !== 'INFO');
  }, [preview]);

  const vigilanciaOnly99Live = useMemo(() => {
    if (!care?.vigilanciaSaudeBucal?.length) return false;
    return care.vigilanciaSaudeBucal.every((v) => v === 99);
  }, [care]);

  if (!enc || !care || !catalog) {
    return (
      <AppShell helpId="odonto.atendimento">
        <PageHeader
          title="Atendimento odonto"
          description="Carregando…"
          actions={<HelpLink id="odonto.atendimento" />}
        />
        <ErrorBox message={error} />
      </AppShell>
    );
  }

  const readonly = enc.status !== 'IN_PROGRESS';
  const showTelaC = enc.status === 'COMPLETED' || !!finishSummary;
  const voided = enc.status === 'VOID';
  const canVoid = enc.status === 'IN_PROGRESS' || enc.status === 'COMPLETED';
  const queueBatchId = finishSummary?.productionBatchId || enc.productionBatchId || null;
  const filaHref = (() => {
    const qs = new URLSearchParams({ encounterId: enc.id });
    if (queueBatchId) qs.set('batchId', queueBatchId);
    return `/faturamento/odonto?${qs}`;
  })();
  const previneSummary = preview?.previne?.summary || preview?.fao.previneXray?.summary;

  return (
    <AppShell helpId="odonto.atendimento">
      <PageHeader
        title={displayPatientName(enc.patient)}
        description={`${enc.facility.name} · CNES ${enc.facility.cnes} · ${enc.status}`}
        actions={
          <>
            <HelpLink id="odonto.atendimento" />
            <Link className="btn ghost" href="/odonto">
              Voltar
            </Link>
            <Link className="btn ghost" href={filaHref}>
              Fila faturamento
            </Link>
            <Link className="btn ghost" href="/faturamento/lote/fao">
              Lote LEDI
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      {ok && <p className="ok">{ok}</p>}

      {voided && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Atendimento anulado</h2>
          <p className="muted">
            Status <strong>VOID</strong> — não fatura. Anulação pós-finalização é{' '}
            <strong>local no SIGS</strong> (fila/lote em error); não há recall automático no
            Ministério/Siaps.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href="/odonto">
              Voltar à lista
            </Link>
          </div>
        </section>
      )}

      {showTelaC && !voided && (
        <section className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Pós-fechamento</h2>
          <p style={{ marginTop: 0 }}>
            {(finishSummary?.siapsReady ?? preview?.siapsReady) ? (
              <strong className="ok">Siaps-ready · finalizado</strong>
            ) : (
              <strong>Finalizado — revise avisos no painel LEDI</strong>
            )}
          </p>
          <ul className="muted" style={{ marginTop: 0 }}>
            <li>Status: {enc.status}</li>
            <li>Fim: {formatDateTime(enc.finishedAt)}</li>
            {(finishSummary?.productionBatchId || enc.productionBatchId) && (
              <li>
                Lote de produção:{' '}
                <code>
                  {(finishSummary?.productionBatchId || enc.productionBatchId || '').slice(0, 8)}…
                </code>
              </li>
            )}
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link className="btn" href={filaHref}>
              Abrir fila de faturamento
            </Link>
            <Link className="btn ghost" href="/faturamento/lote/fao">
              Lote LEDI FAO
            </Link>
            <Link className="btn ghost" href="/odonto">
              Voltar à lista
            </Link>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => void voidEncounter()}
              style={{ marginLeft: 'auto' }}
            >
              Anular (local)
            </button>
          </div>
          <p className="muted" style={{ marginBottom: 0, fontSize: 13 }}>
            Anular após finalizar retira da fila no SIGS. Não estorna XML já enviado ao Ministério.
          </p>
        </section>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <form className="card" onSubmit={(e) => void save(e)}>
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

          <h2>Odontograma (RF-12.12)</h2>
          {catalog.odontogram ? (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  disabled={readonly}
                  checked={showDeciduous}
                  onChange={(e) => setShowDeciduous(e.target.checked)}
                />
                Mostrar dentição decídua
              </label>
              <OdontogramGrid
                value={odontogram}
                conditions={catalog.odontogram.conditions}
                arches={catalog.odontogram.arches}
                scopes={catalog.odontogram.scopes}
                selectedKey={selectedKey}
                onSelectKey={setSelectedKey}
                onChange={setOdontogram}
                disabled={readonly}
                showDeciduous={showDeciduous}
              />
              {catalog.odontogram.note && (
                <p className="muted" style={{ fontSize: 12 }}>
                  {catalog.odontogram.note}
                </p>
              )}
            </>
          ) : (
            <p className="muted">Catálogo de odontograma indisponível — reinicie a API.</p>
          )}

          <div className="row-3">
            <label>
              Local do procedimento
              <input
                disabled={readonly}
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value.trim())}
                placeholder="FDI, Q1–Q4, S1–S6 ou BOCA"
              />
            </label>
            <label>
              Catálogo SIGTAP (RF-12.13)
              <select
                disabled={readonly}
                value={catalogCode}
                onChange={(e) => setCatalogCode(e.target.value)}
              >
                <option value="">Selecione…</option>
                {(catalog.predefinedProcedures?.procedures || [])
                  .filter((p) => catalogFitsSelection(p, selectedKey))
                  .map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} — {p.label}
                      {p.previne ? ` (${p.previne})` : ''}
                    </option>
                  ))}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn ghost"
                disabled={readonly || !catalogCode}
                onClick={() => {
                  const item = catalog.predefinedProcedures?.procedures.find(
                    (p) => p.code === catalogCode,
                  );
                  if (!item) return;
                  const encounterOnly =
                    item.scopes.length === 1 && item.scopes[0] === 'encounter';
                  const placement = encounterOnly ? {} : procedurePlacementFromKey(selectedKey);
                  const next = {
                    ...placement,
                    code: item.code,
                    label: item.label,
                    done: false,
                  };
                  setProcedures((prev) => {
                    const key = `${next.code}|${next.tooth || ''}|${(next.region || '').toUpperCase()}`;
                    const rest = prev.filter(
                      (p) => `${p.code}|${p.tooth || ''}|${(p.region || '').toUpperCase()}` !== key,
                    );
                    return [...rest, next];
                  });
                }}
              >
                Adicionar planejado
              </button>
              <button
                type="button"
                className="btn"
                disabled={readonly || !catalogCode}
                onClick={() => {
                  const item = catalog.predefinedProcedures?.procedures.find(
                    (p) => p.code === catalogCode,
                  );
                  if (!item) return;
                  const encounterOnly =
                    item.scopes.length === 1 && item.scopes[0] === 'encounter';
                  const placement = encounterOnly ? {} : procedurePlacementFromKey(selectedKey);
                  const next = {
                    ...placement,
                    code: item.code,
                    label: item.label,
                    done: true,
                  };
                  setProcedures((prev) => {
                    const key = `${next.code}|${next.tooth || ''}|${(next.region || '').toUpperCase()}`;
                    const rest = prev.filter(
                      (p) => `${p.code}|${p.tooth || ''}|${(p.region || '').toUpperCase()}` !== key,
                    );
                    return [...rest, next];
                  });
                }}
              >
                Adicionar e concluir
              </button>
            </div>
          </div>
          {catalog.predefinedProcedures?.note && (
            <p className="muted" style={{ fontSize: 12 }}>
              {catalog.predefinedProcedures.note}
            </p>
          )}
          {procedures.length ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
              {procedures.map((p, idx) => (
                <li
                  key={`${p.code}-${p.tooth || p.region || 'enc'}-${idx}`}
                  className="check"
                  style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
                >
                  <label className="check" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      disabled={readonly}
                      checked={p.done !== false}
                      onChange={(e) => {
                        const done = e.target.checked;
                        setProcedures((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, done } : row)),
                        );
                      }}
                    />
                    Concluído
                  </label>
                  <span>{procedureLine(p)}</span>
                  {!readonly && (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setProcedures((prev) => prev.filter((_, i) => i !== idx))}
                    >
                      Remover
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhum procedimento no odontograma — escolha no catálogo.</p>
          )}

          <h2>Problemas (CIAP/CID) *</h2>
          <div className="row-2">
            <CodeSearchSelect
              kind="ciap"
              label="CIAP"
              value={ciap}
              onChange={setCiap}
              disabled={readonly}
              placeholder="Buscar CIAP…"
            />
            <CodeSearchSelect
              kind="cid10"
              label="CID-10"
              value={cid10}
              onChange={setCid10}
              disabled={readonly}
              placeholder="Buscar CID-10…"
            />
          </div>

          <h2>Vigilância saúde bucal *</h2>
          {(vigilanciaOnly99Live || preview?.vigilanciaOnly99) && (
            <p className="muted" style={{ color: 'var(--warn, #a15c00)' }}>
              Qualidade Previne: vigilância só com <code>99</code> (não se aplica) mascara produção.
              Prefira códigos específicos quando houver condição observada. Não bloqueia o envio
              Siaps.
            </p>
          )}
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
              {canVoid && (
                <button
                  className="btn ghost"
                  type="button"
                  disabled={busy}
                  onClick={() => void voidEncounter()}
                  style={{ marginLeft: 'auto' }}
                >
                  Anular
                </button>
              )}
            </div>
          )}
        </form>

        <aside className="card">
          <h2 style={{ marginTop: 0 }}>Painel LEDI FAO</h2>
          {liveValidating && <p className="muted">Validando…</p>}
          {preview ? (
            <>
              <p>
                {preview.siapsReady ? (
                  <strong className="ok">Siaps-ready (eixo A)</strong>
                ) : (
                  <strong>BLOCKER: {preview.fao.summary.blockers}</strong>
                )}
                <br />
                <span className="muted">
                  LEDI warn {preview.fao.summary.qualityWarns}
                  {previneSummary
                    ? ` · Previne riscos ${previneSummary.moneyRisks} · warn ${previneSummary.qualityWarns}`
                    : ''}
                </span>
              </p>
              <p className="muted" style={{ fontSize: 13 }}>
                Finalizar exige zero BLOCKER Siaps. Alertas Previne (B1–B6) orientam qualidade e{' '}
                <strong>não</strong> bloqueiam o envio.
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

              <h3 style={{ marginBottom: 4 }}>Previne ESB (eixo B)</h3>
              <ul className="findings">
                {previneGaps.map((g, i) => (
                  <li key={`${g.code}-${i}`}>
                    <span className="muted">[{g.indicator}]</span>{' '}
                    <code>{g.code}</code> — {findingTitle(g.code, g.message)}
                    {(g.repair || g.hint) && (
                      <div className="muted">{g.repair || g.hint}</div>
                    )}
                  </li>
                ))}
                {!previneGaps.length && (
                  <li className="muted">Sem gaps Previne relevantes neste recorte.</li>
                )}
              </ul>
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
          <button className="btn ghost" type="button" onClick={() => router.push('/odonto')}>
            Lista
          </button>
        </aside>
      </div>
    </AppShell>
  );
}
