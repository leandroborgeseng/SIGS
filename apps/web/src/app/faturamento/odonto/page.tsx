'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, OkBox, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/labels';
import {
  resolveSeverity,
  severityLabel,
  severityRank,
  severityTone,
} from '@/app/faturamento/lote/fao/error-catalog';

type Finding = { severity: string; code: string; message: string; hint?: string };

type QueueItem = {
  encounterId: string;
  productionBatchId?: string | null;
  patient: { id: string; name: string; cpf?: string | null; cns?: string | null };
  facility: { id: string; name: string; cnes: string };
  professionalName?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  encounterStatus: string;
  batchStatus: string;
  bucket: 'blocker' | 'money' | 'quality' | 'ok' | 'incomplete';
  summary: { blockers: number; moneyRisks: number; qualityWarns: number };
  topCodes: string[];
  findings: Finding[];
  missing: Array<{ code: string; severity: string; message: string }>;
  href: string;
};

type QueueResponse = {
  competencia: string;
  totals: {
    total: number;
    blocker: number;
    money: number;
    quality: number;
    incomplete: number;
    ok: number;
    ready: number;
    sent: number;
    open: number;
  };
  items: QueueItem[];
  limit?: number;
  matchedTotal?: number;
  capped?: boolean;
};

type BusyMode = 'idle' | 'load' | 'forceSync' | 'batchSync';

function currentCompetencia() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function bucketLabel(b: string) {
  if (b === 'blocker') return 'Bloqueia envio';
  if (b === 'money') return 'Qualidade incompleta';
  if (b === 'quality') return 'Indicadores';
  if (b === 'ok') return 'Pronto';
  if (b === 'incomplete') return 'Em preenchimento';
  return b;
}

function bucketSevClass(b: string) {
  if (b === 'blocker') return 'BLOCKER';
  if (b === 'money') return 'MONEY_RISK';
  if (b === 'quality') return 'QUALITY_WARN';
  if (b === 'ok') return 'ok';
  return 'INFO';
}

function itemMatchesFocus(
  item: QueueItem,
  encounterId: string | null,
  batchId: string | null,
): boolean {
  if (encounterId && item.encounterId === encounterId) return true;
  if (batchId && item.productionBatchId === batchId) return true;
  return false;
}

function shortId(id: string) {
  return `${id.slice(0, 8)}…`;
}

function FaturamentoOdontoInner() {
  const { facilityId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusEncounterId = searchParams.get('encounterId');
  const focusBatchId = searchParams.get('batchId');

  const [competencia, setCompetencia] = useState(currentCompetencia());
  const [bucket, setBucket] = useState('all');
  const [data, setData] = useState<QueueResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyMode, setBusyMode] = useState<BusyMode>('idle');
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [focusToast, setFocusToast] = useState<string | null>(null);
  const focusToastKey = useRef<string | null>(null);

  const busy = busyMode !== 'idle';

  const load = useCallback(
    async (opts?: {
      forceSync?: boolean;
      keepSyncNote?: boolean;
      busyAs?: BusyMode;
    }): Promise<boolean> => {
      const mode: BusyMode =
        opts?.busyAs || (opts?.forceSync ? 'forceSync' : 'load');
      setBusyMode(mode);
      if (!opts?.keepSyncNote) setError(null);
      if (!opts?.forceSync && !opts?.keepSyncNote) setSyncNote(null);
      try {
        const qs = new URLSearchParams({ competencia });
        if (facilityId) qs.set('facilityId', facilityId);
        if (bucket !== 'all') qs.set('bucket', bucket);
        if (opts?.forceSync) qs.set('forceSync', '1');
        const res = await api<QueueResponse>(`/v1/dental/faturamento-queue?${qs}`);
        setData(res);
        if (opts?.forceSync) {
          const cap =
            res.capped && res.matchedTotal != null && res.limit != null
              ? ` · limite ${res.limit} de ${res.matchedTotal}`
              : '';
          setSyncNote(
            `Pendências revalidadas · ${res.totals.total} itens na competência${cap}`,
          );
        }
        return true;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : opts?.forceSync
              ? 'Falha ao revalidar pendências (forceSync)'
              : 'Falha ao carregar fila',
        );
        return false;
      } finally {
        setBusyMode('idle');
      }
    },
    [competencia, facilityId, bucket],
  );

  const syncBatch = useCallback(async () => {
    setBusyMode('batchSync');
    setError(null);
    setSyncNote(null);
    try {
      const body: { competencia: string; facilityId?: string; encounterIds?: string[] } = {
        competencia,
      };
      if (facilityId) body.facilityId = facilityId;
      if (focusEncounterId) body.encounterIds = [focusEncounterId];
      const out = await api<{
        synced: number;
        failed: number;
        total: number;
        matchedTotal?: number;
        limit?: number;
        capped?: boolean;
      }>('/v1/dental/faturamento-queue/sync', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const cap =
        out.capped && out.matchedTotal != null && out.limit != null
          ? ` · limite ${out.limit} de ${out.matchedTotal}`
          : '';
      const note =
        `Sync em lote: ${out.synced}/${out.total} ok` +
        (out.failed ? ` · ${out.failed} falha(s)` : '') +
        cap;
      setSyncNote(note);
      const partialError = out.failed
        ? `Revalidação parcial: ${out.failed} falha(s) de ${out.total}`
        : null;
      const ok = await load({ keepSyncNote: true, busyAs: 'batchSync' });
      setSyncNote(note);
      if (ok && partialError) setError(partialError);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao sincronizar pendências');
      setBusyMode('idle');
    }
  }, [competencia, facilityId, focusEncounterId, load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (focusEncounterId) setExpanded(focusEncounterId);
  }, [focusEncounterId]);

  useEffect(() => {
    if (!focusEncounterId || !data) return;
    const el = document.getElementById(`queue-${focusEncounterId}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusEncounterId, data]);

  const sorted = useMemo(() => {
    const items = [...(data?.items || [])];
    items.sort((a, b) => {
      const aFocus = itemMatchesFocus(a, focusEncounterId, focusBatchId) ? 0 : 1;
      const bFocus = itemMatchesFocus(b, focusEncounterId, focusBatchId) ? 0 : 1;
      if (aFocus !== bFocus) return aFocus - bFocus;
      const ra = severityRank(
        a.bucket === 'blocker'
          ? 'BLOCKER'
          : a.bucket === 'money'
            ? 'MONEY_RISK'
            : a.bucket === 'quality'
              ? 'QUALITY_WARN'
              : 'INFO',
      );
      const rb = severityRank(
        b.bucket === 'blocker'
          ? 'BLOCKER'
          : b.bucket === 'money'
            ? 'MONEY_RISK'
            : b.bucket === 'quality'
              ? 'QUALITY_WARN'
              : 'INFO',
      );
      if (ra !== rb) return ra - rb;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
    return items;
  }, [data, focusEncounterId, focusBatchId]);

  const focusedItems = useMemo(
    () => sorted.filter((i) => itemMatchesFocus(i, focusEncounterId, focusBatchId)),
    [sorted, focusEncounterId, focusBatchId],
  );

  const hasFocus = !!(focusEncounterId || focusBatchId);
  const visible = hasFocus && focusedItems.length > 0 ? focusedItems : sorted;
  const focusMiss = hasFocus && focusedItems.length === 0 && !!data && !busy;

  useEffect(() => {
    if (!focusMiss) return;
    const key = `${focusEncounterId || ''}|${focusBatchId || ''}|${competencia}|${bucket}`;
    if (focusToastKey.current === key) return;
    focusToastKey.current = key;
    const parts: string[] = [];
    if (focusEncounterId) parts.push(`encounterId ${shortId(focusEncounterId)}`);
    if (focusBatchId) parts.push(`batchId ${shortId(focusBatchId)}`);
    setFocusToast(
      `Deep-link não encontrou a ficha (${parts.join(' · ')}) nesta competência/filtro.`,
    );
  }, [focusMiss, focusEncounterId, focusBatchId, competencia, bucket]);

  function clearFocus() {
    setFocusToast(null);
    focusToastKey.current = null;
    const qs = new URLSearchParams();
    if (competencia) qs.set('competencia', competencia);
    const q = qs.toString();
    router.replace(q ? `/faturamento/odonto?${q}` : '/faturamento/odonto');
  }

  const t = data?.totals;
  const capped = !!(data?.capped && data.limit != null);
  const forceSyncBusy = busyMode === 'forceSync';
  const batchSyncBusy = busyMode === 'batchSync';
  const loadBusy = busyMode === 'load';

  return (
    <AppShell>
      <PageHeader
        title="Fila de faturamento odonto"
        description="Validação + produção do mês — mesmas cores do lote LEDI FAO"
        actions={
          <>
            <Link className="btn ghost" href="/odonto">
              Atendimentos
            </Link>
            <Link className="btn ghost" href="/faturamento/lote/fao">
              Lote XML
            </Link>
            <button
              className="btn ghost"
              type="button"
              disabled={busy}
              onClick={() => void syncBatch()}
              title="Revalida pendências LEDI via sync em lote"
            >
              {batchSyncBusy ? 'Revalidando…' : 'Revalidar pendências'}
            </button>
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => void load({ forceSync: true })}
              title="Recarrega a fila e força sync das pendências"
            >
              {forceSyncBusy ? 'Atualizando…' : 'Atualizar'}
            </button>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={syncNote} />
      {focusToast && (
        <div className="alert queue-focus-miss" role="status">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <strong>Ficha não encontrada</strong>
            <span>{focusToast}</span>
            <button type="button" className="btn ghost" onClick={() => setFocusToast(null)}>
              Dispensar
            </button>
            <button type="button" className="btn ghost" onClick={clearFocus}>
              Ver fila completa
            </button>
          </div>
        </div>
      )}

      {hasFocus && (
        <section
          className={`card queue-focus-banner ${focusMiss ? 'miss' : ''}`}
          style={{ marginBottom: 16 }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
            <strong>Deep-link ativo</strong>
            {focusEncounterId && (
              <span className="muted">
                encounterId <code>{shortId(focusEncounterId)}</code>
              </span>
            )}
            {focusBatchId && (
              <span className="muted">
                batchId <code>{shortId(focusBatchId)}</code>
              </span>
            )}
            {focusMiss ? (
              <span className="muted">— não encontrado nesta competência/filtro</span>
            ) : (
              <span className="muted">— destacando {focusedItems.length} item(ns)</span>
            )}
            <button type="button" className="btn ghost" onClick={clearFocus}>
              Ver fila completa
            </button>
          </div>
        </section>
      )}

      <section className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
          <label>
            Competência
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              disabled={busy}
            />
          </label>
          <label>
            Filtro
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              disabled={busy}
            >
              <option value="all">Todos</option>
              <option value="blocker">Bloqueia envio</option>
              <option value="money">Qualidade incompleta</option>
              <option value="quality">Indicadores</option>
              <option value="incomplete">Em preenchimento</option>
              <option value="ok">Prontos</option>
            </select>
          </label>
          {busy && (
            <span className="muted queue-busy-hint">
              {batchSyncBusy
                ? 'Sincronizando pendências…'
                : forceSyncBusy
                  ? 'Revalidando e atualizando fila…'
                  : 'Carregando fila…'}
            </span>
          )}
        </div>
        {capped && (
          <div className="alert queue-cap-banner" role="status" style={{ marginTop: 14 }}>
            Limite da fila: exibindo {data!.limit} de {data!.matchedTotal} atendimentos desta
            competência. Refine o filtro ou competência para ver o restante.
          </div>
        )}
        {t && (
          <div className="lote-bars" style={{ marginTop: 14 }}>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'blocker' ? 'active' : ''}`}
              onClick={() => setBucket('blocker')}
              disabled={busy}
            >
              <span className="lote-sev BLOCKER">Bloqueia envio</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill blocker"
                  style={{ width: `${t.total ? (t.blocker / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.blocker}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'money' ? 'active' : ''}`}
              onClick={() => setBucket('money')}
              disabled={busy}
            >
              <span className="lote-sev MONEY_RISK">Qualidade incompleta</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill money"
                  style={{ width: `${t.total ? (t.money / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.money}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'quality' ? 'active' : ''}`}
              onClick={() => setBucket('quality')}
              disabled={busy}
            >
              <span className="lote-sev QUALITY_WARN">Indicadores</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill quality"
                  style={{ width: `${t.total ? (t.quality / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.quality}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'incomplete' ? 'active' : ''}`}
              onClick={() => setBucket('incomplete')}
              disabled={busy}
            >
              <span className="lote-sev INFO">Em preenchimento</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill info"
                  style={{ width: `${t.total ? (t.incomplete / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.incomplete}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'ok' ? 'active' : ''}`}
              onClick={() => setBucket('ok')}
              disabled={busy}
            >
              <span className="lote-sev ok" style={{ background: '#dcfce7', color: '#166534' }}>
                Pronto / Siaps
              </span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill"
                  style={{
                    width: `${t.total ? (t.ok / t.total) * 100 : 0}%`,
                    background: '#22c55e',
                  }}
                />
              </span>
              <strong>{t.ok}</strong>
            </button>
          </div>
        )}
        {t && (
          <p className="muted" style={{ marginBottom: 0 }}>
            {t.total} itens · {t.open} abertos · {t.ready} ready · {t.sent} sent · competência{' '}
            <strong>{competencia}</strong>
            {data?.limit != null && (
              <>
                {' '}
                · cap <strong>{data.limit}</strong>
                {data.matchedTotal != null && data.matchedTotal !== t.total && (
                  <> ({data.matchedTotal} na competência)</>
                )}
              </>
            )}
          </p>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Itens a faturar</h2>
        {(loadBusy || forceSyncBusy || batchSyncBusy) && !visible.length && (
          <p className="muted queue-empty-loading">
            {batchSyncBusy
              ? 'Revalidando pendências…'
              : forceSyncBusy
                ? 'Atualizando e sincronizando…'
                : 'Carregando fila…'}
          </p>
        )}
        {!busy && !visible.length && (
          <div className="queue-empty">
            {error ? (
              <>
                <p style={{ marginTop: 0 }}>
                  Não foi possível carregar a fila. Tente atualizar ou revalidar as pendências.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => void load({ forceSync: true })}
                  >
                    Tentar novamente
                  </button>
                  <Link className="btn ghost" href="/faturamento/lote/fao">
                    Abrir lote LEDI FAO
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="muted" style={{ marginTop: 0 }}>
                  {focusMiss
                    ? 'Nenhum item corresponde ao deep-link nesta competência/filtro.'
                    : bucket !== 'all'
                      ? 'Nenhum atendimento neste filtro da competência.'
                      : 'Nenhum atendimento nesta competência.'}
                </p>
                <p className="muted">
                  Para XML importado / correção em lote LEDI, use o lote FAO.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Link className="btn" href="/faturamento/lote/fao">
                    Abrir lote LEDI FAO
                  </Link>
                  <Link className="btn ghost" href="/odonto">
                    Novo atendimento
                  </Link>
                  {hasFocus && (
                    <button type="button" className="btn ghost" onClick={clearFocus}>
                      Limpar deep-link
                    </button>
                  )}
                  {bucket !== 'all' && (
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => setBucket('all')}
                    >
                      Limpar filtro
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
        {visible.map((item) => {
          const open = expanded === item.encounterId;
          const focused = itemMatchesFocus(item, focusEncounterId, focusBatchId);
          const tone = severityTone(
            item.bucket === 'blocker'
              ? 'BLOCKER'
              : item.bucket === 'money'
                ? 'MONEY_RISK'
                : item.bucket === 'quality'
                  ? 'QUALITY_WARN'
                  : 'INFO',
          );
          const findingsSorted = [...item.findings].sort(
            (a, b) =>
              severityRank(resolveSeverity(a.code, a.severity)) -
              severityRank(resolveSeverity(b.code, b.severity)),
          );
          return (
            <div
              key={item.encounterId}
              id={`queue-${item.encounterId}`}
              className={`lote-alert-row ${tone === 'blocker' || tone === 'money' || tone === 'quality' ? tone : ''} ${focused ? 'queue-focus' : ''}`}
              style={{
                marginBottom: 10,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--line)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  {focused && <span className="lote-sev INFO">Em foco</span>}
                  <span className={`lote-sev ${bucketSevClass(item.bucket)}`}>
                    {bucketLabel(item.bucket)}
                  </span>
                  <strong>{item.patient.name}</strong>
                  <span className="muted">
                    {' '}
                    · {formatDateTime(item.startedAt)} · {item.facility.name}
                  </span>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    Status atendimento: {item.encounterStatus} · lote: {item.batchStatus}
                    {item.productionBatchId && (
                      <>
                        {' '}
                        · batch <code>{shortId(item.productionBatchId)}</code>
                      </>
                    )}
                    {item.summary.blockers > 0 && <> · {item.summary.blockers} blockers</>}
                    {item.topCodes.length > 0 && (
                      <> · {item.topCodes.slice(0, 4).map((c) => `\`${c}\``).join(' ')}</>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setExpanded(open ? null : item.encounterId)}
                  >
                    {open ? 'Ocultar' : 'Pendências'}
                  </button>
                  <Link className="btn" href={item.href}>
                    Abrir ficha
                  </Link>
                </div>
              </div>
              {open && (
                <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18 }}>
                  {findingsSorted.length === 0 && (
                    <li className="muted">Sem pendências registradas.</li>
                  )}
                  {findingsSorted.map((f, i) => {
                    const sev = resolveSeverity(f.code, f.severity);
                    return (
                      <li key={`${f.code}-${i}`} style={{ marginBottom: 6 }}>
                        <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
                        <code>{f.code}</code> — {f.message}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}

export default function FaturamentoOdontoPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <PageHeader title="Fila de faturamento odonto" description="Carregando…" />
        </AppShell>
      }
    >
      <FaturamentoOdontoInner />
    </Suspense>
  );
}
