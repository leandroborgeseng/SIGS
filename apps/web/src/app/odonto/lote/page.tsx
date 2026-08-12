'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError, getToken } from '@/lib/api';
import { uploadLediBatchMultipart } from '@/lib/ledi-batch-upload';
import { formatUploadError } from '@/lib/format-upload-error';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { bodyForRepairUi, lookupRepair, type AlertRepair } from './repair-catalog';
import {
  compareBySeverityThenCount,
  resolveSeverity,
  severityLabel,
  severityRank,
  severityTone,
} from './error-catalog';
import { TreatmentDashboard, type TreatBucket } from './TreatmentDashboard';
import type { TreatmentProgress } from './treatment-types';
import { ErrorGuidePanel } from './ErrorGuidePanel';

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
  treatment?: TreatmentProgress;
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

function codesToFriendly(codes: string[]): string {
  if (!codes.length) return '—';
  return codes
    .slice(0, 4)
    .map((c) => lookupRepair(c)?.title || c)
    .join(' · ');
}


export default function OdontoLotePage() {
  const [batches, setBatches] = useState<BatchListRow[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [tipoFilter, setTipoFilter] = useState('');
  const [treatBucket, setTreatBucket] = useState<TreatBucket>('');
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
  const [turno, setTurno] = useState('2');
  const [gestante, setGestante] = useState('false');
  const [localAtend, setLocalAtend] = useState('1');
  const [cnes, setCnes] = useState('');
  const [ibge, setIbge] = useState('3516200');
  const [focusField, setFocusField] = useState<string>('');
  const editPanelRef = useRef<HTMLDivElement>(null);

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
      if (treatBucket) qs.set('bucket', treatBucket);
      if (q.trim()) qs.set('q', q.trim());
      qs.set('limit', '200');
      const page = await api<{ total: number; items: ItemRow[] }>(
        `/v1/dental/ledi/batches/${id}/items?${qs}`,
      );
      setItems(page.items);
      setItemsTotal(page.total);
      setSelectedIds(new Set());
    },
    [statusFilter, codeFilter, tipoFilter, treatBucket, q],
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

  async function onUpload(files: FileList | File[] | null) {
    const listLike = files ? Array.from(files as ArrayLike<File>) : [];
    if (!listLike.length) return;
    setError(null);
    setOk(null);
    setBusy(true);
    try {
      const list = listLike.filter(
        (f) => f.name.toLowerCase().endsWith('.xml') || f.name.toLowerCase().endsWith('.zip'),
      );
      if (!list.length) throw new Error('Selecione arquivos .xml ou um .zip');
      const { batch: created, uploaded, failedNames } = await uploadLediBatchMultipart<Batch>({
        files: list,
        name: batchName.trim() || `FAO ${new Date().toLocaleString('pt-BR')}`,
        expectedTipo: 'FAO',
        onProgress: setUploadProgress,
      });
      setBatch(created);
      setCodeFilter('');
      const failNote = failedNames.length
        ? ` · ${failedNames.length} não lidos (ex.: ${failedNames[0]}) — copie a pasta para o Desktop e reenvie só esses.`
        : '';
      setOk(
        `Lote criado: ${uploaded} enviadas · ${created.summary.withBlockers} com blocker · ${created.summary.conformant} conformes.${failNote}`,
      );
      await loadBatches();
    } catch (err) {
      setError(formatUploadError(err));
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
      setError('Marque ao menos uma correção (campo de CPF, código da equipe ou diagnóstico).');
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

  async function applySelectedRepair(code?: string, opts?: { allAffected?: boolean }) {
    if (!batch) return;
    const repairCode = code || codeFilter;
    const guide = repairCode ? lookupRepair(repairCode) : undefined;
    if (!guide || guide.mode !== 'auto' || !guide.ui || guide.ui === 'manual') {
      setError(
        guide?.mode === 'individual'
          ? 'Este alerta exige correção individual — abra a ficha e edite os campos.'
          : 'Este alerta não tem correção automática em lote.',
      );
      return;
    }

    let ids = [...selectedIds];
    if (opts?.allAffected && repairCode) {
      setBusy(true);
      try {
        const page = await api<{ total: number; items: ItemRow[] }>(
          `/v1/dental/ledi/batches/${batch.id}/items?code=${encodeURIComponent(repairCode)}&limit=500`,
        );
        ids = page.items.map((it) => it.id);
        setSelectedIds(new Set(ids));
        setItems(page.items);
        setItemsTotal(page.total);
      } catch (err) {
        setBusy(false);
        setError(err instanceof Error ? err.message : 'Falha ao listar fichas afetadas');
        return;
      }
    }

    if (!ids.length) {
      setBusy(false);
      setError('Selecione ao menos uma ficha na lista (ou use “todas as afetadas”).');
      return;
    }

    const fields = {
      ine: ineDefault || editIne,
      ciap: bulkCiap || ciap,
      cid10: bulkCid || cid10,
      cbo: editCbo,
      vigilancia,
      tipoConsulta,
      turno,
      gestante,
      local: localAtend,
      cnes,
      ibge,
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
        setBusy(false);
        setError(
          guide.ui === 'ine'
            ? 'Informe o código da equipe (INE) no guia antes de aplicar.'
            : guide.ui === 'cnes'
              ? 'Informe CNES com 7 dígitos no guia.'
              : 'Preencha os campos do guia necessários para esta correção.',
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
      setOk(
        `“${guide.title}”: corrigidas ${res.touched} ficha(s). Veja se o contador deste erro caiu; se ainda houver vermelho, clique no próximo.`,
      );
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
      setTurno('2');
      setGestante('false');
      setLocalAtend('1');
      setCnes('');
      setIbge('3516200');
      setFocusField('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir ficha');
    }
  }

  function focusIndividualEdit(field?: string) {
    setFocusField(field || 'xml');
    editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setFocusField(''), 3500);
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
    if (!guide) {
      setError('Alerta sem guia de correção.');
      return;
    }
    if (guide.mode === 'info') {
      setError('Alerta informativo — sem correção automática segura.');
      return;
    }
    if (guide.mode === 'individual') {
      focusIndividualEdit(guide.focusField);
      setOk(`Edite a ficha abaixo: ${guide.how}`);
      return;
    }
    if (guide.ui === 'st_cpf') {
      await patchSelected({ stNaoPossuiCpf: true }, `${guide.title} aplicado em ${selected?.fileName}.`);
      return;
    }
    if (!guide.ui || guide.ui === 'manual') {
      focusIndividualEdit(guide.focusField);
      return;
    }
    const patch = bodyForRepairUi(guide.ui, {
      ine: editIne || ineDefault,
      ciap,
      cid10,
      cbo: editCbo,
      vigilancia,
      tipoConsulta,
      turno,
      gestante,
      local: localAtend,
      cnes,
      ibge,
    });
    if (!patch) {
      setError(
        guide.ui === 'ine'
          ? 'Informe o INE no campo da ficha.'
          : guide.ui === 'cnes'
            ? 'Informe CNES com 7 dígitos.'
            : 'Campos incompletos.',
      );
      focusIndividualEdit(guide.focusField || guide.ui);
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
    if (turno) body.turno = Number(turno);
    if (gestante === 'true' || gestante === 'false') body.gestante = gestante === 'true';
    if (localAtend) body.localAtendimento = Number(localAtend);
    if (cnes.replace(/\D/g, '').length === 7) body.cnes = cnes.replace(/\D/g, '');
    if (ibge.replace(/\D/g, '').length === 7) body.codigoIbgeMunicipio = ibge.replace(/\D/g, '');
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
    setTreatBucket('');
  }

  /** Quando o filtro de erro carrega a lista, seleciona todas para facilitar a correção. */
  useEffect(() => {
    if (!codeFilter || !items.length) return;
    setSelectedIds(new Set(items.map((it) => it.id)));
  }, [codeFilter, items]);

  return (
    <AppShell helpId="odonto.lote-ledi">
      <PageHeader
        title="Lote LEDI FAO"
        eyebrow="Raio-x · correção · envio"
        description="Clique em cada erro para ver o roteiro completo: o que significa, como corrigir e auto-correção quando for seguro."
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
        <h3 style={{ marginTop: 0 }}>1. Enviar XMLs ou ZIP</h3>
        <p className="muted">
          Para pastas grandes em Downloads: no Finder, clique direito na pasta → <strong>Comprimir</strong> e envie o
          .zip (mais confiável).
        </p>
        <div className="field">
          <label>Nome do lote (opcional)</label>
          <input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Ex.: Franca 5974691" />
        </div>
        <div className="field">
          <label>Arquivos .xml ou .zip</label>
          <FileDropZone disabled={busy} acceptHint="FAO tipo 5" onFiles={(f) => void onUpload(f as FileList)}>
            <input
              type="file"
              accept=".xml,.zip,text/xml,application/xml,application/zip"
              multiple
              disabled={busy}
              onChange={(e) => void onUpload(e.target.files)}
            />
          </FileDropZone>
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
              Ordem de trabalho: primeiro liberar o envio, depois proteger o faturamento/Previne, por último
              melhorar indicadores e informação ao governo.
            </p>

            <div className="lote-priority">
              <div className="lote-priority-card blocker">
                <div className="step">1º · Vermelho</div>
                <strong>Bloqueia envio</strong>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Sem corrigir, a ficha não passa no Siaps/Ministério. Produção não entra.
                </div>
              </div>
              <div className="lote-priority-card money">
                <div className="step">2º · Laranja</div>
                <strong>Risco de faturamento</strong>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Envia, mas pode perder ponto/repasse (Previne e produção que não pontua).
                </div>
              </div>
              <div className="lote-priority-card quality">
                <div className="step">3º · Verde</div>
                <strong>Indicadores / info</strong>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Qualidade dos indicadores e dados para o governo — tratar depois dos dois acima.
                </div>
              </div>
            </div>

            <TreatmentDashboard
              treatment={batch.summary.treatment}
              readyForFinalSend={batch.summary.readyForFinalSend}
              activeBucket={treatBucket}
              onFilterBucket={(bucket) => {
                setTreatBucket(bucket);
                setCodeFilter('');
              }}
            />

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
                  Clique numa barra para filtrar. Estes erros impedem o aceite do envio (Siaps/Ministério) — a
                  produção não “entra” até corrigir.
                </p>
                <div className="lote-bars">
                  {[...(batch.summary.topCodes || [])]
                    .map((c) => ({
                      ...c,
                      severity: resolveSeverity(c.code, 'BLOCKER'),
                    }))
                    .sort(compareBySeverityThenCount)
                    .map((c) => {
                      const guide = lookupRepair(c.code);
                      const sev = c.severity;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          className={`lote-bar-row ${codeFilter === c.code ? 'active' : ''}`}
                          onClick={() => filterByCode(c.code)}
                          title={guide?.how || c.code}
                        >
                          <span>
                            <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
                            <strong style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
                              {guide?.title || c.code}
                            </strong>
                            {guide?.why ? (
                              <div className="muted">
                                {guide.why.slice(0, 110)}
                                {guide.why.length > 110 ? '…' : ''}
                              </div>
                            ) : null}
                          </span>
                          <span className="lote-bar-track">
                            <span
                              className={`lote-bar-fill ${severityTone(sev)}`}
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
                <h4 style={{ marginBottom: 6 }}>Raio-x Previne (qualidade / indicadores)</h4>
                <p className="muted" style={{ marginTop: 0, marginBottom: 8 }}>
                  O <strong>Previne Brasil</strong> dá nota (e influencia repasse) conforme a saúde bucal da cidade.
                  Em linguagem simples:
                </p>
                <ul className="muted" style={{ marginTop: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.45 }}>
                  <li>
                    <strong>B1</strong> — quantas pessoas tiveram a <em>1ª consulta</em> com o dentista da equipe
                  </li>
                  <li>
                    <strong>B2</strong> — entre quem começou, quantos <em>concluíram</em> o tratamento
                  </li>
                  <li>
                    <strong>B3</strong> — quanto é <em>extração</em> (ideal: menos extração, mais prevenção)
                  </li>
                  <li>
                    <strong>B4</strong> — escovação em grupo (não entra nesta ficha individual)
                  </li>
                  <li>
                    <strong>B5</strong> — quanto é <em>prevenção</em> (flúor, limpeza, orientação)
                  </li>
                  <li>
                    <strong>B6</strong> — uso de ART/TRA quando há restauração
                  </li>
                </ul>
                <p className="muted" style={{ marginTop: 0 }}>
                  Clique numa barra para filtrar. “Risco” pode significar produção que <em>não pontua</em> no Previne,
                  mesmo que o envio seja aceito.
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
                      {[...(batch.summary.previne.codeCounts || [])]
                        .slice()
                        .sort(compareBySeverityThenCount)
                        .slice(0, 10)
                        .map((c) => {
                          const guide = lookupRepair(c.code);
                          const sev = c.severity || resolveSeverity(c.code, 'MONEY_RISK');
                          return (
                            <button
                              key={c.code}
                              type="button"
                              className={`lote-bar-row ${codeFilter === c.code ? 'active' : ''}`}
                              onClick={() => filterByCode(c.code)}
                              title={guide?.how || c.code}
                            >
                              <span>
                                <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
                                <strong style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
                                  {guide?.title || c.code}
                                </strong>
                                <div className="muted">
                                  {c.indicator ? `${c.indicator} · ` : ''}
                                  {guide?.why
                                    ? `${guide.why.slice(0, 100)}${guide.why.length > 100 ? '…' : ''}`
                                    : ''}
                                </div>
                              </span>
                              <span className="lote-bar-track">
                                <span
                                  className={`lote-bar-fill ${severityTone(sev)}`}
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

            {codeFilter && activeRepair ? (
              <ErrorGuidePanel
                code={codeFilter}
                repair={activeRepair}
                affectedCount={itemsTotal || items.length}
                selectedCount={selectedIds.size}
                busy={busy}
                fieldValues={{
                  ine: ineDefault || editIne,
                  ciap: bulkCiap || ciap,
                  cid10: bulkCid || cid10,
                  cbo: editCbo,
                  vigilancia,
                  tipoConsulta,
                  turno,
                  gestante,
                  local: localAtend,
                  cnes,
                  ibge,
                }}
                onFieldChange={(key, value) => {
                  if (key === 'ine') {
                    setIneDefault(value);
                    setEditIne(value);
                  } else if (key === 'ciap') {
                    setBulkCiap(value);
                    setCiap(value);
                  } else if (key === 'cid10') {
                    setBulkCid(value);
                    setCid10(value);
                  } else if (key === 'cbo') setEditCbo(value);
                  else if (key === 'vigilancia') setVigilancia(value);
                  else if (key === 'tipoConsulta') setTipoConsulta(value);
                  else if (key === 'turno') setTurno(value);
                  else if (key === 'gestante') setGestante(value);
                  else if (key === 'local') setLocalAtend(value);
                  else if (key === 'cnes') setCnes(value);
                  else if (key === 'ibge') setIbge(value);
                }}
                onClear={() => setCodeFilter('')}
                onFixSelected={() => void applySelectedRepair(codeFilter)}
                onFixAllAffected={() => void applySelectedRepair(codeFilter, { allAffected: true })}
                onSelectAllVisible={() => setSelectedIds(new Set(items.map((it) => it.id)))}
              />
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
              Aplicar automaticamente: “informar se o cidadão tem CPF”
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
              <div className="field">
                <label>Código da equipe (INE)</label>
                <input
                  value={ineDefault}
                  onChange={(e) => setIneDefault(e.target.value)}
                  placeholder="0002165929"
                />
              </div>
              <div className="field">
                <label>Problema/diagnóstico (CIAP)</label>
                <input value={bulkCiap} onChange={(e) => setBulkCiap(e.target.value)} placeholder="D82" />
              </div>
              <div className="field">
                <label>Diagnóstico (CID-10)</label>
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
                  <option value="blocker">Com bloqueio de envio</option>
                  <option value="warn">Com aviso / risco</option>
                  <option value="conformant">Conformes</option>
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
                {selectedIds.size && activeRepair?.mode === 'auto' && activeRepair.batchable ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => void applySelectedRepair()}
                  >
                    Auto-corrigir selecionadas ({activeRepair.title})
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
                      <th align="left">Problemas</th>
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
                        <td style={{ fontSize: 12 }}>
                          {codesToFriendly([...it.topCodes, ...(it.previneTopCodes || [])])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card lote-sticky" ref={editPanelRef}>
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

                  <h4 style={{ marginBottom: 8 }}>Alertas — em linguagem simples</h4>
                  <p className="muted" style={{ marginTop: 0, fontSize: 12 }}>
                    Ordem na lista: <span className="lote-sev BLOCKER">Bloqueia envio</span> →{' '}
                    <span className="lote-sev MONEY_RISK">Risco faturamento</span> →{' '}
                    <span className="lote-sev QUALITY_WARN">Indicadores</span> →{' '}
                    <span className="lote-sev INFO">Info governo</span>
                  </p>
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
                        ]
                          .map((f) => {
                            const code = 'code' in f ? f.code : '';
                            const sev =
                              ('severity' in f && f.severity
                                ? String(f.severity)
                                : resolveSeverity(code)) || '';
                            return { f, code, sev };
                          })
                          .sort((a, b) => severityRank(a.sev) - severityRank(b.sev))
                          .map(({ f, code, sev }, i) => {
                            const guide = lookupRepair(code);
                            const mode = guide?.mode || 'individual';
                            const tone = severityTone(sev);
                            return (
                              <tr key={`${code}-${i}`} className={`lote-alert-row ${tone}`}>
                                <td>
                                  <span className={`lote-mode ${mode}`}>
                                    {mode === 'auto' ? 'Auto' : mode === 'individual' ? 'Individual' : 'Info'}
                                  </span>
                                  <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
                                  <div style={{ marginTop: 4 }}>
                                    <strong>{guide?.title || code}</strong>
                                  </div>
                                  {guide?.why ? (
                                    <div className="muted" style={{ marginTop: 4 }}>
                                      <strong>O que isso significa:</strong> {guide.why}
                                    </div>
                                  ) : 'message' in f && f.message ? (
                                    <div className="muted">{f.message}</div>
                                  ) : null}
                                  {guide ? (
                                    <div className="muted">
                                      <strong>O que fazer:</strong> {guide.how}
                                    </div>
                                  ) : null}
                                </td>
                                <td>
                                  {mode === 'auto' && guide?.button ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      disabled={busy}
                                      style={{ fontSize: 12 }}
                                      onClick={() => void applyGapRepair(code)}
                                    >
                                      {guide.button}
                                    </button>
                                  ) : mode === 'individual' ? (
                                    <button
                                      type="button"
                                      className="btn btn-secondary"
                                      style={{ fontSize: 12 }}
                                      onClick={() => focusIndividualEdit(guide?.focusField)}
                                    >
                                      Editar ficha
                                    </button>
                                  ) : (
                                    <span className="muted">só orientação</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className={`field ${focusField === 'ciap' ? 'focus-hint' : ''}`}>
                      <label>CIAP</label>
                      <input value={ciap} onChange={(e) => setCiap(e.target.value)} />
                    </div>
                    <div className="field">
                      <label>CID-10</label>
                      <input value={cid10} onChange={(e) => setCid10(e.target.value)} />
                    </div>
                    <div className={`field ${focusField === 'ine' ? 'focus-hint' : ''}`}>
                      <label>INE</label>
                      <input value={editIne} onChange={(e) => setEditIne(e.target.value)} />
                    </div>
                    <div className={`field ${focusField === 'cbo' ? 'focus-hint' : ''}`}>
                      <label>CBO</label>
                      <input value={editCbo} onChange={(e) => setEditCbo(e.target.value)} />
                    </div>
                    <div className={`field ${focusField === 'vigilancia' ? 'focus-hint' : ''}`}>
                      <label>Vigilância</label>
                      <input value={vigilancia} onChange={(e) => setVigilancia(e.target.value)} />
                    </div>
                    <div className={`field ${focusField === 'consulta' ? 'focus-hint' : ''}`}>
                      <label>Consulta</label>
                      <select value={tipoConsulta} onChange={(e) => setTipoConsulta(e.target.value)}>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                    <div className={`field ${focusField === 'turno' ? 'focus-hint' : ''}`}>
                      <label>Turno</label>
                      <select value={turno} onChange={(e) => setTurno(e.target.value)}>
                        <option value="1">1 manhã</option>
                        <option value="2">2 tarde</option>
                        <option value="3">3 noite</option>
                      </select>
                    </div>
                    <div className={`field ${focusField === 'gestante' ? 'focus-hint' : ''}`}>
                      <label>Gestante</label>
                      <select value={gestante} onChange={(e) => setGestante(e.target.value)}>
                        <option value="false">false</option>
                        <option value="true">true</option>
                      </select>
                    </div>
                    <div className={`field ${focusField === 'local' ? 'focus-hint' : ''}`}>
                      <label>Local atendimento</label>
                      <input value={localAtend} onChange={(e) => setLocalAtend(e.target.value)} />
                    </div>
                    <div className={`field ${focusField === 'cnes' ? 'focus-hint' : ''}`}>
                      <label>CNES (7 dígitos)</label>
                      <input value={cnes} onChange={(e) => setCnes(e.target.value)} placeholder="2077432" />
                    </div>
                    <div className={`field ${focusField === 'ibge' ? 'focus-hint' : ''}`}>
                      <label>IBGE município</label>
                      <input value={ibge} onChange={(e) => setIbge(e.target.value)} placeholder="3516200" />
                    </div>
                    <div className={`field ${focusField === 'proc' ? 'focus-hint' : ''}`} style={{ gridColumn: '1 / -1' }}>
                      <label>Procs SIGTAP extras</label>
                      <input
                        value={procExtra}
                        onChange={(e) => setProcExtra(e.target.value)}
                        placeholder="0301010153,0101020104"
                      />
                    </div>
                    <div
                      className={`field ${focusField === 'xml' ? 'focus-hint' : ''}`}
                      style={{ gridColumn: '1 / -1' }}
                    >
                      <label className="muted">
                        Campos de CPF/CNS/datas/UUID exigem ajuste no XML de origem ou reexportação — use o botão
                        “Editar ficha” do alerta e, se necessário, baixe o XML e corrija na origem.
                      </label>
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
                    Cada alerta mostra <strong>Auto</strong> (botão corrige o XML) ou <strong>Individual</strong>{' '}
                    (abra a ficha e edite). Filtre pelo gráfico para auto-corrigir várias selecionadas.
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
