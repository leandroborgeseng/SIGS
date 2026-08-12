'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError, getToken } from '@/lib/api';
import { bodyForRepairUi, lookupRepair, type AlertRepair } from './repair-catalog';

type BatchSummary = {
  total: number;
  conformant: number;
  withBlockers: number;
  withWarn: number;
  autoFixableItems: number;
  siapsReady?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  topCodes: Array<{ code: string; files: number; pct: number }>;
  byTipo?: Array<{ id: string; files: number; pct: number }>;
  previne?: {
    files: number;
    codeCounts: Array<{
      code: string;
      indicator: string;
      files: number;
      severity: string;
      sample: string;
    }>;
    indicatorGaps: Array<{ id: string; filesWithGap: number; pct: number }>;
    signalRates: {
      withFirstConsulta: number;
      withConclusao: number;
      withPreventive: number;
      withArt: number;
      withIne: number;
      vigilancia99: number;
    };
  };
};

type Batch = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  summary: BatchSummary;
  statusCounts?: Record<string, number>;
};

type BatchListRow = Batch & { itemCount: number };

type ItemRow = {
  id: string;
  fileName: string;
  status: string;
  blockers: number;
  moneyRisks: number;
  qualityWarns: number;
  autoFixableCodes: string[];
  topCodes: string[];
  siapsReady?: boolean;
  previneReady?: boolean;
  readyForFinalSend?: boolean;
  previneMoneyRisks?: number;
  previneTopCodes?: string[];
  fichaTipo?: string | null;
  fichaTipoCode?: number | null;
  fichaTipoLabel?: string | null;
};

type Finding = {
  severity: string;
  code: string;
  message: string;
  field?: string;
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

type ItemDetail = {
  id: string;
  fileName: string;
  status: string;
  findings: Finding[];
  autoFixableCodes: string[];
  currentXml: string;
  siapsReady?: boolean;
  previneReady?: boolean;
  readyForFinalSend?: boolean;
  fichaTipo?: string | null;
  fichaTipoCode?: number | null;
  fichaTipoLabel?: string | null;
  correctionPath?: string;
  odontoLoteSupported?: boolean;
  previneXray?: {
    summary: { moneyRisks: number; qualityWarns: number; infos: number };
    signals: {
      hasFirstConsultaProgramada: boolean;
      hasTratamentoConcluido: boolean;
      preventiveCount: number;
      artCount: number;
      inePresent: boolean;
      vigilanciaOnly99: boolean;
      procCodes: string[];
    };
    gaps: PrevineGap[];
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function downloadZip(batchId: string, mode: 'current' | 'conformant') {
  const token = getToken();
  const res = await fetch(`${API_BASE}/v1/dental/ledi/batches/${batchId}/export.zip?mode=${mode}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Exportação falhou (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledi-fao-lote-${batchId.slice(0, 8)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Falha ao ler arquivo'));
    reader.readAsText(file);
  });
}

function barTone(severity?: string, channel?: string) {
  if (severity === 'BLOCKER' || severity === 'MONEY_RISK') return 'danger';
  if (severity === 'QUALITY_WARN') return 'warn';
  if (channel === 'PREVINE') return 'previne';
  return '';
}

export default function OdontoLotePage() {
  const [batches, setBatches] = useState<BatchListRow[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [q, setQ] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [batchName, setBatchName] = useState('');
  const [confirmSt, setConfirmSt] = useState(true);
  const [ineDefault, setIneDefault] = useState('');
  const [bulkCiap, setBulkCiap] = useState('D82');
  const [bulkCid, setBulkCid] = useState('');
  const [ciap, setCiap] = useState('D82');
  const [cid10, setCid10] = useState('');
  const [tipoConsulta, setTipoConsulta] = useState('1');
  const [editIne, setEditIne] = useState('');
  const [editCbo, setEditCbo] = useState('223208');
  const [vigilancia, setVigilancia] = useState('1,3');
  const [procExtra, setProcExtra] = useState('');

  const loadBatches = useCallback(async () => {
    const list = await api<BatchListRow[]>('/v1/dental/ledi/batches');
    setBatches(list);
  }, []);

  const loadBatch = useCallback(
    async (id: string) => {
      const b = await api<Batch>(`/v1/dental/ledi/batches/${id}`);
      setBatch(b);
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      if (codeFilter) qs.set('code', codeFilter);
      if (tipoFilter) qs.set('tipo', tipoFilter);
      if (q.trim()) qs.set('q', q.trim());
      qs.set('limit', '200');
      const page = await api<{ total: number; items: ItemRow[] }>(
        `/v1/dental/ledi/batches/${id}/items?${qs}`,
      );
      setItems(page.items);
      setItemsTotal(page.total);
      setSelectedIds(new Set());
    },
    [statusFilter, codeFilter, tipoFilter, q],
  );

  useEffect(() => {
    void loadBatches().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [loadBatches]);

  useEffect(() => {
    if (!batch?.id) return;
    void loadBatch(batch.id).catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [batch?.id, loadBatch]);

  const total = batch?.summary.total || 0;
  const maxLedi = Math.max(1, ...(batch?.summary.topCodes?.map((c) => c.files) || [1]));
  const maxPrev = Math.max(1, ...(batch?.summary.previne?.codeCounts?.map((c) => c.files) || [1]));

  const activeRepair: AlertRepair | undefined = useMemo(
    () => (codeFilter ? lookupRepair(codeFilter) : undefined),
    [codeFilter],
  );

  const allVisibleSelected = items.length > 0 && items.every((it) => selectedIds.has(it.id));

  function toggleAllVisible() {
    if (allVisibleSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((it) => it.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onUpload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const list = Array.from(files).filter((f) => f.name.toLowerCase().endsWith('.xml'));
      if (!list.length) throw new Error('Selecione arquivos .xml');
      setUploadProgress(`Lendo ${list.length} arquivos…`);
      const payload: Array<{ name: string; xml: string }> = [];
      const chunk = 40;
      for (let i = 0; i < list.length; i += chunk) {
        const slice = list.slice(i, i + chunk);
        const parts = await Promise.all(
          slice.map(async (f) => ({ name: f.name, xml: await readFileAsText(f) })),
        );
        payload.push(...parts);
        setUploadProgress(`Lidos ${payload.length}/${list.length}…`);
      }
      setUploadProgress(`Validando lote (${payload.length} fichas)…`);
      const created = await api<Batch>('/v1/dental/ledi/batches', {
        method: 'POST',
        json: {
          name: batchName.trim() || `FAO ${new Date().toLocaleString('pt-BR')}`,
          files: payload,
        },
      });
      setBatch(created);
      setCodeFilter('');
      setOk(
        `Lote criado: ${created.summary.total} fichas · ${created.summary.withBlockers} com blocker · ${created.summary.conformant} conformes.`,
      );
      await loadBatches();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Falha no upload');
    } finally {
      setBusy(false);
      setUploadProgress('');
    }
  }

  async function applyLoteAutoFix(e: FormEvent) {
    e.preventDefault();
    if (!batch) return;
    const hasProb = !!(bulkCiap.trim() || bulkCid.trim());
    if (!confirmSt && !ineDefault.trim() && !hasProb) {
      setError('Marque ao menos uma correção (stNaoPossuiCpf, INE ou CIAP/CID).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<Batch & { touched: number }>(`/v1/dental/ledi/batches/${batch.id}/auto-fix`, {
        method: 'POST',
        json: {
          stNaoPossuiCpf: confirmSt,
          stNaoPossuiCpfWhenAbsent: true,
          ine: ineDefault.trim() || undefined,
          problemasCondicoesDefault: hasProb
            ? [{ ciap: bulkCiap.trim() || undefined, cid10: bulkCid.trim() || undefined }]
            : undefined,
        },
      });
      setBatch(res);
      setOk(`Auto-correção do lote aplicada em ${res.touched} fichas.`);
      await loadBatch(batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na auto-correção');
    } finally {
      setBusy(false);
    }
  }

  async function applySelectedRepair(code?: string) {
    if (!batch) return;
    const ids = [...selectedIds];
    if (!ids.length) {
      setError('Selecione ao menos uma ficha na lista.');
      return;
    }
    const repairCode = code || codeFilter;
    const guide = repairCode ? lookupRepair(repairCode) : undefined;
    if (!guide?.ui || guide.ui === 'manual' || guide.ui === 'lote') {
      setError('Este alerta não tem correção automática em lote — edite ficha a ficha ou use a seção 3.');
      return;
    }

    const fields = {
      ine: ineDefault || editIne,
      ciap: bulkCiap || ciap,
      cid10: bulkCid || cid10,
      cbo: editCbo,
      vigilancia,
      tipoConsulta,
    };

    let body: Record<string, unknown> = {
      forceSelected: true,
      onlyItemIds: ids,
      stNaoPossuiCpf: false,
    };

    if (guide.ui === 'st_cpf') {
      body = { ...body, stNaoPossuiCpf: true, forceSelected: false };
    } else {
      const patch = bodyForRepairUi(guide.ui, fields);
      if (!patch) {
        setError(
          guide.ui === 'ine'
            ? 'Informe o INE no campo padrão antes de aplicar em lote.'
            : 'Preencha os campos necessários para esta correção.',
        );
        return;
      }
      body = { ...body, ...patch };
      if (guide.ui === 'ciap') {
        body.problemasCondicoesDefault = patch.problemasCondicoes;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const res = await api<Batch & { touched: number }>(`/v1/dental/ledi/batches/${batch.id}/auto-fix`, {
        method: 'POST',
        json: body,
      });
      setBatch(res);
      setOk(`Correção “${guide.title}” aplicada em ${res.touched} ficha(s) selecionada(s).`);
      await loadBatch(batch.id);
      if (selected && ids.includes(selected.id)) {
        const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`);
        setSelected(detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na correção em lote');
    } finally {
      setBusy(false);
    }
  }

  async function openItem(id: string) {
    if (!batch) return;
    setError(null);
    try {
      const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${id}`);
      setSelected(detail);
      setEditIne('');
      setEditCbo('223208');
      setVigilancia('1,3');
      setProcExtra('');
      setCiap('D82');
      setCid10('');
      setTipoConsulta('1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir ficha');
    }
  }

  async function patchSelected(body: Record<string, unknown>, okMsg: string) {
    if (!batch || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`, {
        method: 'PATCH',
        json: body,
      });
      setSelected(detail);
      setOk(okMsg);
      await loadBatch(batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function applyGapRepair(code: string) {
    const guide = lookupRepair(code);
    if (!guide?.ui || guide.ui === 'manual') {
      setError('Este alerta exige julgamento clínico — sem botão automático.');
      return;
    }
    if (guide.ui === 'lote' || guide.ui === 'st_cpf') {
      setError('Use a correção do lote (seção 3) ou selecione fichas e aplique stNaoPossuiCpf em lote.');
      return;
    }
    const patch = bodyForRepairUi(guide.ui, {
      ine: editIne || ineDefault,
      ciap,
      cid10,
      cbo: editCbo,
      vigilancia,
      tipoConsulta,
    });
    if (!patch) {
      setError(guide.ui === 'ine' ? 'Informe o INE no campo da ficha.' : 'Campos incompletos.');
      return;
    }
    await patchSelected(patch, `${guide.title} aplicado em ${selected?.fileName}.`);
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const body: Record<string, unknown> = {};
    if (editIne.trim()) body.ine = editIne.trim();
    if (editCbo.trim()) body.cboCodigo_2002 = editCbo.trim();
    if (ciap.trim() || cid10.trim()) {
      body.problemasCondicoes = [{ ciap: ciap.trim() || undefined, cid10: cid10.trim() || undefined }];
    }
    if (tipoConsulta) body.tiposConsultaOdonto = [Number(tipoConsulta)];
    if (vigilancia.trim()) {
      const codes = vigilancia
        .split(/[,;\s]+/)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (codes.length) body.tiposVigilanciaSaudeBucal = codes;
    }
    if (procExtra.trim()) {
      body.procedimentosAdd = procExtra
        .split(/[,;\s]+/)
        .map((c) => c.replace(/\D/g, ''))
        .filter((c) => c.length >= 8)
        .map((coMsProcedimento) => ({ coMsProcedimento, quantidade: 1 }));
    }
    if (!Object.keys(body).length) {
      setError('Informe ao menos um campo de correção.');
      return;
    }
    await patchSelected(body, `Ficha ${selected.fileName} revalidada.`);
  }

  function filterByCode(code: string) {
    setCodeFilter((prev) => (prev === code ? '' : code));
    setSelected(null);
  }

  return (
    <AppShell helpId="odonto.lote-ledi">
      <PageHeader
        title="Lote LEDI FAO"
        eyebrow="Raio-x · correção · envio"
        description="Diagnóstico Siaps/LEDI + Previne ESB, filtro por tipo de erro e correção individual ou em lote."
        actions={
          <>
            <HelpLink id="odonto.lote-ledi" />
            <Link className="btn btn-secondary" href="/odonto">
              Voltar odonto
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

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>1. Enviar XMLs</h3>
        <div className="field">
          <label>Nome do lote (opcional)</label>
          <input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Ex.: Franca 5974691" />
        </div>
        <div className="field">
          <label>Arquivos .esus.xml / .xml (múltiplos)</label>
          <input
            type="file"
            accept=".xml,text/xml"
            multiple
            disabled={busy}
            onChange={(e) => void onUpload(e.target.files)}
          />
        </div>
        {uploadProgress ? <p className="muted">{uploadProgress}</p> : null}
        {batches.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {batches.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn ${batch?.id === b.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setBatch(b as Batch);
                  setCodeFilter('');
                  setSelected(null);
                }}
              >
                {b.name} ({b.itemCount})
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {batch ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>2. Diagnóstico — {batch.name}</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Fluxo: corrigir blockers LEDI → reduzir MONEY_RISK Previne → exportar ZIP só quando “Envio final”
              estiver alto.
            </p>

            <div className="lote-funnel">
              <div className="lote-funnel-item">
                <div className="muted">Total fichas</div>
                <strong>{total}</strong>
              </div>
              <div className="lote-funnel-item">
                <div className="muted">Prontas Siaps</div>
                <strong>
                  {batch.summary.siapsReady ?? '—'}
                  <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
                    {' '}
                    ({total ? Math.round(((batch.summary.siapsReady || 0) / total) * 100) : 0}%)
                  </span>
                </strong>
              </div>
              <div className="lote-funnel-item">
                <div className="muted">Prontas Previne</div>
                <strong>
                  {batch.summary.previneReady ?? '—'}
                  <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
                    {' '}
                    ({total ? Math.round(((batch.summary.previneReady || 0) / total) * 100) : 0}%)
                  </span>
                </strong>
              </div>
              <div className="lote-funnel-item">
                <div className="muted">Envio final OK</div>
                <strong>
                  {batch.summary.readyForFinalSend ?? '—'}
                  <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
                    {' '}
                    ({total ? Math.round(((batch.summary.readyForFinalSend || 0) / total) * 100) : 0}%)
                  </span>
                </strong>
              </div>
            </div>

            {batch.summary.byTipo?.length ? (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ marginBottom: 6 }}>Tipos de ficha neste lote</h4>
                <p className="muted" style={{ marginTop: 0 }}>
                  FAO (5) = odonto nesta tela · FAI (4) = atendimento individual · Procedimentos (7) = ficha de
                  procedimentos. Clique para filtrar.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {batch.summary.byTipo.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`btn ${tipoFilter === t.id ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setTipoFilter((prev) => (prev === t.id ? '' : t.id))}
                    >
                      {t.id} · {t.files} ({t.pct}%)
                    </button>
                  ))}
                  {tipoFilter ? (
                    <button type="button" className="btn btn-ghost" onClick={() => setTipoFilter('')}>
                      Limpar tipo
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="lote-split">
              <div>
                <h4 style={{ marginBottom: 6 }}>Inconsistências de envio (LEDI/Siaps)</h4>
                <p className="muted" style={{ marginTop: 0 }}>
                  Clique numa barra para filtrar a lista. Corrigir estes códigos libera o aceite.
                </p>
                <div className="lote-bars">
                  {(batch.summary.topCodes || []).map((c) => {
                    const guide = lookupRepair(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        className={`lote-bar-row ${codeFilter === c.code ? 'active' : ''}`}
                        onClick={() => filterByCode(c.code)}
                        title={guide?.how || c.code}
                      >
                        <span>
                          <code>{c.code}</code>
                          {guide ? <div className="muted">{guide.title}</div> : null}
                        </span>
                        <span className="lote-bar-track">
                          <span
                            className={`lote-bar-fill ${barTone('BLOCKER')}`}
                            style={{ width: `${Math.max(6, (c.files / maxLedi) * 100)}%` }}
                          />
                        </span>
                        <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {c.files}
                        </span>
                      </button>
                    );
                  })}
                  {!batch.summary.topCodes?.length ? <p className="muted">Nenhum alerta LEDI.</p> : null}
                </div>
              </div>

              <div>
                <h4 style={{ marginBottom: 6 }}>Raio-x Previne (qualidade / B1–B6)</h4>
                <p className="muted" style={{ marginTop: 0 }}>
                  O que o lote deixa de “carregar” para indicador — clique para filtrar.
                </p>
                {batch.summary.previne ? (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                        gap: 8,
                        marginBottom: 12,
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <div className="muted">1ª consulta</div>
                        <strong>{batch.summary.previne.signalRates.withFirstConsulta}</strong>
                      </div>
                      <div>
                        <div className="muted">Conclusão</div>
                        <strong>{batch.summary.previne.signalRates.withConclusao}</strong>
                      </div>
                      <div>
                        <div className="muted">Preventivo</div>
                        <strong>{batch.summary.previne.signalRates.withPreventive}</strong>
                      </div>
                      <div>
                        <div className="muted">ART</div>
                        <strong>{batch.summary.previne.signalRates.withArt}</strong>
                      </div>
                      <div>
                        <div className="muted">c/ INE</div>
                        <strong>{batch.summary.previne.signalRates.withIne}</strong>
                      </div>
                      <div>
                        <div className="muted">só vig. 99</div>
                        <strong>{batch.summary.previne.signalRates.vigilancia99}</strong>
                      </div>
                    </div>
                    <div className="lote-bars">
                      {(batch.summary.previne.codeCounts || []).slice(0, 10).map((c) => {
                        const guide = lookupRepair(c.code);
                        return (
                          <button
                            key={c.code}
                            type="button"
                            className={`lote-bar-row ${codeFilter === c.code ? 'active' : ''}`}
                            onClick={() => filterByCode(c.code)}
                          >
                            <span>
                              <code>{c.code}</code>
                              <div className="muted">
                                {c.indicator} · {guide?.title || c.severity}
                              </div>
                            </span>
                            <span className="lote-bar-track">
                              <span
                                className={`lote-bar-fill ${barTone(c.severity, 'PREVINE')}`}
                                style={{ width: `${Math.max(6, (c.files / maxPrev) * 100)}%` }}
                              />
                            </span>
                            <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                              {c.files}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="muted">Sem raio-x Previne neste lote.</p>
                )}
              </div>
            </div>

            {codeFilter ? (
              <div className="lote-toolbar" style={{ marginTop: 14 }}>
                <span>
                  Filtro ativo: <code>{codeFilter}</code>
                  {activeRepair ? ` — ${activeRepair.title}` : ''}
                </span>
                {activeRepair ? <span className="muted">{activeRepair.how}</span> : null}
                <button type="button" className="btn btn-secondary" onClick={() => setCodeFilter('')}>
                  Limpar filtro
                </button>
                {activeRepair?.batchable ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy || selectedIds.size === 0}
                    onClick={() => void applySelectedRepair(codeFilter)}
                  >
                    Corrigir {selectedIds.size || '…'} selecionada(s)
                  </button>
                ) : null}
              </div>
            ) : null}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void downloadZip(batch.id, 'current').catch((e) => setError(String(e.message || e)))}
              >
                Baixar ZIP (atuais)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  void downloadZip(batch.id, 'conformant').catch((e) => setError(String(e.message || e)))
                }
              >
                Baixar só conformes LEDI
              </button>
            </div>
          </div>

          <form className="card" style={{ marginBottom: 16 }} onSubmit={applyLoteAutoFix}>
            <h3 style={{ marginTop: 0 }}>3. Correções em massa (todo o lote)</h3>
            <p className="muted">
              Use quando o mesmo ajuste vale para quase todas as fichas. Para um subconjunto, filtre pelo gráfico,
              selecione e use “Corrigir selecionadas”.
            </p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={confirmSt} onChange={(e) => setConfirmSt(e.target.checked)} />
              Aplicar <code>stNaoPossuiCpf</code> automaticamente
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div className="field">
                <label>INE padrão</label>
                <input
                  value={ineDefault}
                  onChange={(e) => setIneDefault(e.target.value)}
                  placeholder="0002165929"
                />
              </div>
              <div className="field">
                <label>CIAP padrão</label>
                <input value={bulkCiap} onChange={(e) => setBulkCiap(e.target.value)} placeholder="D82" />
              </div>
              <div className="field">
                <label>CID-10 padrão</label>
                <input value={bulkCid} onChange={(e) => setBulkCid(e.target.value)} placeholder="K02.1" />
              </div>
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Aplicar no lote inteiro e revalidar
            </button>
          </form>

          <div className="lote-split" style={{ marginBottom: 16 }}>
            <div className="card">
              <h3 style={{ marginTop: 0 }}>4. Fichas</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Todos status</option>
                  <option value="blocker">blocker</option>
                  <option value="warn">warn</option>
                  <option value="conformant">conformant</option>
                </select>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filtrar nome do arquivo"
                  style={{ minWidth: 180 }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => batch && void loadBatch(batch.id)}>
                  Atualizar lista
                </button>
              </div>
              <div className="lote-toolbar">
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    className="lote-check"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                  Selecionar visíveis ({items.length})
                </label>
                <span className="muted">
                  {selectedIds.size} selecionada(s) · mostrando {items.length} de {itemsTotal}
                </span>
                {selectedIds.size && activeRepair?.batchable ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void applySelectedRepair()}
                  >
                    Corrigir selecionadas ({activeRepair.title})
                  </button>
                ) : null}
              </div>
              <div style={{ maxHeight: 440, overflow: 'auto' }}>
                <table style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }} />
                      <th align="left">Arquivo</th>
                      <th>Tipo</th>
                      <th>Siaps</th>
                      <th>Previne</th>
                      <th align="left">Códigos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        style={{
                          cursor: 'pointer',
                          background: selected?.id === it.id ? 'var(--ok-bg)' : undefined,
                        }}
                        onClick={() => void openItem(it.id)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <input
                            className="lote-check"
                            type="checkbox"
                            checked={selectedIds.has(it.id)}
                            onChange={() => toggleOne(it.id)}
                          />
                        </td>
                        <td>{it.fileName}</td>
                        <td align="center">
                          <code title={it.fichaTipoLabel || ''}>
                            {it.fichaTipo || '?'}
                            {it.fichaTipoCode != null ? `/${it.fichaTipoCode}` : ''}
                          </code>
                        </td>
                        <td align="center">{it.siapsReady ? 'ok' : 'falha'}</td>
                        <td align="center">{it.previneReady ? 'ok' : `risco(${it.previneMoneyRisks ?? 0})`}</td>
                        <td>
                          <code style={{ fontSize: 11 }}>
                            {[...it.topCodes, ...(it.previneTopCodes || [])].slice(0, 5).join(', ') || '—'}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card lote-sticky">
              {selected ? (
                <form onSubmit={saveItem}>
                  <h3 style={{ marginTop: 0 }}>5. Editar ficha</h3>
                  <p style={{ marginTop: 0 }}>
                    <strong>{selected.fileName}</strong>
                    <br />
                    <span className="muted">
                      Tipo:{' '}
                      <strong>
                        {selected.fichaTipoLabel || selected.fichaTipo || '—'}
                        {selected.fichaTipoCode != null ? ` (${selected.fichaTipoCode})` : ''}
                      </strong>
                      {selected.correctionPath ? ` · Corrigir em: ${selected.correctionPath}` : ''}
                      <br />
                      LEDI {selected.status} · Siaps {selected.siapsReady ? 'ok' : 'bloquear'} · Previne{' '}
                      {selected.previneReady ? 'ok' : 'risco'} · Envio{' '}
                      {selected.readyForFinalSend ? 'recomendado' : 'reparar'}
                    </span>
                  </p>
                  {selected.odontoLoteSupported === false ? (
                    <div className="alert danger" style={{ marginBottom: 12 }}>
                      Esta ficha <strong>não é FAO</strong>. A correção odonto desta tela não se aplica — use o
                      fluxo do tipo indicado acima.
                    </div>
                  ) : null}

                  <h4 style={{ marginBottom: 8 }}>Alertas e como corrigir</h4>
                  <div style={{ maxHeight: 280, overflow: 'auto', marginBottom: 12 }}>
                    <table style={{ width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th align="left">Alerta</th>
                          <th align="left">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...selected.findings.filter((f) => !String(f.code).startsWith('PREVINE_')),
                          ...(selected.previneXray?.gaps.filter(
                            (g) => g.severity !== 'INFO' || g.code !== 'PREVINE_B4_NOT_IN_FAO',
                          ) || []),
                        ].map((f, i) => {
                          const code = 'code' in f ? f.code : '';
                          const guide = lookupRepair(code);
                          const can =
                            guide?.button && guide.ui && guide.ui !== 'manual' && guide.ui !== 'lote' && guide.ui !== 'st_cpf';
                          return (
                            <tr key={`${code}-${i}`}>
                              <td>
                                <span className={`lote-sev ${'severity' in f ? f.severity : ''}`}>
                                  {'severity' in f ? f.severity : ''}
                                </span>{' '}
                                <code>{code}</code>
                                <div>{'message' in f ? f.message : ''}</div>
                                {guide ? <div className="muted">{guide.how}</div> : null}
                              </td>
                              <td>
                                {can ? (
                                  <button
                                    type="button"
                                    className="btn btn-secondary"
                                    disabled={busy}
                                    style={{ fontSize: 12 }}
                                    onClick={() => void applyGapRepair(code)}
                                  >
                                    {guide!.button}
                                  </button>
                                ) : (
                                  <span className="muted">manual / lote</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="field">
                      <label>CIAP</label>
                      <input value={ciap} onChange={(e) => setCiap(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>CID-10</label>
                      <input value={cid10} onChange={(e) => setCid10(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>INE</label>
                      <input value={editIne} onChange={(e) => setEditIne(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>CBO</label>
                      <input value={editCbo} onChange={(e) => setEditCbo(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Vigilância</label>
                      <input value={vigilancia} onChange={(e) => setVigilancia(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Consulta</label>
                      <select value={tipoConsulta} onChange={(e) => setTipoConsulta(e.target.value)}>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                    <div className="field" style={{ gridColumn: '1 / -1' }}>
                      <label>Procs SIGTAP extras</label>
                      <input
                        value={procExtra}
                        onChange={(e) => setProcExtra(e.target.value)}
                        placeholder="0301010153,0101020104"
                      />
                    </div>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 8 }}>
                    Salvar e revalidar
                  </button>
                </form>
              ) : (
                <>
                  <h3 style={{ marginTop: 0 }}>5. Editar ficha</h3>
                  <p className="muted">
                    Selecione uma linha na lista para ver explicação do alerta e corrigir individualmente. Ou marque
                    várias e corrija em lote pelo filtro do gráfico.
                  </p>
                </>
              )}
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
