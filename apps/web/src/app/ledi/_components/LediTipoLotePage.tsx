'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { isAsyncJobResponse, jobChartSummary, jobProgressLabel, waitForJob } from '@/lib/jobs';
import {
  isAnalyzingProgress,
  isChunkUploadError,
  parseParteProgress,
  uploadLediBatchMultipart,
  type LediChunkResume,
} from '@/lib/ledi-batch-upload';
import { formatUploadError, isIoReadError, isNetworkError } from '@/lib/format-upload-error';
import { FileDropZone } from '@/components/ui/FileDropZone';
import {
  compareBySeverityThenCount,
  explainError,
  resolveSeverity,
  severityLabel,
  severityRank,
  severityTone,
} from '@/app/faturamento/lote/fao/error-catalog';
import { TreatmentDashboard, type TreatBucket } from '@/app/faturamento/lote/fao/TreatmentDashboard';
import type { TreatmentProgress } from '@/app/faturamento/lote/fao/treatment-types';
import { ErrorGuideModal } from '@/app/faturamento/lote/fao/ErrorGuideModal';
import { FichaFixModal } from '@/app/faturamento/lote/fao/FichaFixModal';
import { LoteQualityPanel } from '@/app/faturamento/lote/fao/LoteQualityPanel';
import { baselineFromTreatment } from '@/app/faturamento/lote/fao/ModalQualityMiniDash';
import {
  bodyForRepairUi,
  lookupRepair as lookupFaoRepair,
} from '@/app/faturamento/lote/fao/repair-catalog';
import { faiBodyForRepairUi, lookupFaiRepair } from '@/app/faturamento/lote/fai/repair-catalog';
import { PendingReportPanel } from '@/app/ledi/_components/PendingReportPanel';
import { LediFunnelCharts, type LediChartSummary } from '@/app/ledi/_components/LediFunnelCharts';
import {
  LediJobProgressModal,
  LediJobProgressPanel,
  type LediJobUi,
} from '@/app/ledi/_components/LediJobProgressModal';
import { isLediCondutaOdontoId } from '@/app/faturamento/lote/fao/condutas-odonto';
import {
  isLediTipoMismatchError,
  parseLediTipoMismatch,
  type LediTipoMismatchError,
} from '@/lib/ledi-xml-batch';

type LoteTipo = 'FAO' | 'FAI' | 'PROCEDIMENTOS';
type ExportAction = 'zip-current' | 'zip-conformant' | 'zip-pending' | 'dry-run' | 'closure';
type WizardStep = 'upload' | 'recusado' | 'analise' | 'tratar' | 'fechamento' | 'individual';

type BatchSummary = {
  total: number;
  conformant: number;
  withBlockers: number;
  withWarn: number;
  autoFixableItems: number;
  individualItems?: number;
  siapsReady?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  expectedTipo?: string;
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
  summary: BatchSummary;
};

type BatchListRow = {
  id: string;
  name: string;
  status: string;
  itemCount: number;
  summary: BatchSummary;
};

type ItemRow = {
  id: string;
  fileName: string;
  status: string;
  blockers: number;
  moneyRisks?: number;
  qualityWarns?: number;
  autoFixableCodes: string[];
  topCodes: string[];
  siapsReady: boolean;
  previneReady?: boolean;
  readyForFinalSend?: boolean;
  fichaTipo?: string | null;
};

type ItemDetail = ItemRow & {
  findings: Array<{ severity: string; code: string; message: string; hint?: string }>;
  fichaTipoLabel?: string | null;
  fichaTipoCode?: number | null;
  correctionPath?: string | null;
  odontoLoteSupported?: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const META: Record<
  LoteTipo,
  {
    title: string;
    help: string;
    label: string;
    helpId: string;
    fileSlug: string;
    siblingHref: string;
    siblingLabel: string;
    variant: 'fao' | 'fai' | 'proc';
    acceptHint: string;
    fichaLabel: string;
    queueHref: string;
    queueLabel: string;
    clinicalHref: string;
    clinicalLabel: string;
    defaultCbo: string;
  }
> = {
  FAO: {
    title: 'Lote LEDI FAO',
    help: 'Ficha de Atendimento Odontológico (tipo 5). Wizard: upload → análise → problema a problema → dois ZIPs.',
    label: 'FAO',
    helpId: 'faturamento.lote-fao',
    fileSlug: 'fao',
    siblingHref: '/faturamento/lote/fai',
    siblingLabel: 'Lote FAI',
    variant: 'fao',
    acceptHint: 'FAO tipo 5',
    fichaLabel: 'ficha odontológica',
    queueHref: '/faturamento/odonto',
    queueLabel: 'Fila odonto',
    clinicalHref: '/odonto',
    clinicalLabel: 'Atendimentos odonto',
    defaultCbo: '223208',
  },
  FAI: {
    title: 'Lote LEDI FAI',
    help: 'Ficha de Atendimento Individual (tipo 4) — não é odonto. Wizard de lote: ficha a ficha, auto vs pessoa, Siaps ≠ Previne ≠ 100% OK.',
    label: 'FAI',
    helpId: 'faturamento.lote-fai',
    fileSlug: 'fai',
    siblingHref: '/faturamento/lote/proc',
    siblingLabel: 'Lote Procedimentos',
    variant: 'fai',
    acceptHint: 'FAI tipo 4',
    fichaLabel: 'ficha individual',
    queueHref: '/faturamento/aps',
    queueLabel: 'Fila APS',
    clinicalHref: '/aps',
    clinicalLabel: 'Atendimentos APS',
    defaultCbo: '',
  },
  PROCEDIMENTOS: {
    title: 'Lote LEDI Procedimentos',
    help: 'Ficha de Procedimentos (tipo 7). Mesmo wizard de lote FAI/FAO: gate de tipo, análise, tratamento e dois ZIPs.',
    label: 'Procedimentos',
    helpId: 'faturamento.lote-proc',
    fileSlug: 'proc',
    siblingHref: '/faturamento/lote/fai',
    siblingLabel: 'Lote FAI',
    variant: 'proc',
    acceptHint: 'PROC tipo 7',
    fichaLabel: 'ficha de procedimentos',
    queueHref: '/faturamento',
    queueLabel: 'Hub faturamento',
    clinicalHref: '/faturamento',
    clinicalLabel: 'Hub',
    defaultCbo: '',
  },
};

function pickNextPriorityCode(
  summary: BatchSummary,
  justFixed?: string,
): { code: string; same: boolean } | null {
  const entries = (summary.topCodes || [])
    .filter((c) => c.files > 0)
    .map((c) => ({
      code: c.code,
      files: c.files,
      severity: String(resolveSeverity(c.code, 'BLOCKER')),
    }));
  if (justFixed) {
    const still = entries.find((e) => e.code === justFixed);
    if (still) return { code: justFixed, same: true };
  }
  const sorted = [...entries].sort(compareBySeverityThenCount);
  const next =
    sorted.find((e) => e.severity === 'BLOCKER') ||
    sorted.find((e) => e.severity === 'MONEY_RISK') ||
    sorted[0];
  return next ? { code: next.code, same: false } : null;
}

async function downloadZip(
  batchId: string,
  mode: 'current' | 'conformant' | 'pending',
  fileSlug: string,
) {
  const token = getToken();
  const res = await fetch(
    `${API_BASE}/v1/dental/ledi/batches/${batchId}/export.zip?mode=${mode}`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { message?: string };
      detail = body.message ? `: ${body.message}` : '';
    } catch {
      /* ignore */
    }
    throw new Error(`Exportação falhou (${res.status})${detail}`);
  }
  const blob = await res.blob();
  if (!blob.size) throw new Error('ZIP vazio — nada para exportar neste modo.');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledi-${fileSlug}-lote-${batchId.slice(0, 8)}${
    mode === 'conformant' ? '-aptos-envio' : mode === 'pending' ? '-pendentes' : ''
  }.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadClosureReport(batchId: string, fileSlug: string) {
  const report = await api<{ markdown: string }>(`/v1/dental/ledi/batches/${batchId}/closure-report`);
  const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledi-${fileSlug}-fechamento-${batchId.slice(0, 8)}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LediTipoLotePage({ expectedTipo }: { expectedTipo: LoteTipo }) {
  const meta = META[expectedTipo];
  const lookupRepair = expectedTipo === 'FAI' ? lookupFaiRepair : lookupFaoRepair;
  const [batches, setBatches] = useState<BatchListRow[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [selected, setSelected] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadIoFailed, setUploadIoFailed] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [exportAction, setExportAction] = useState<ExportAction | null>(null);
  const [batchName, setBatchName] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [chunkResume, setChunkResume] = useState<(LediChunkResume & { total: number; fileName: string }) | null>(
    null,
  );
  const lastFilesRef = useRef<File[]>([]);
  const [treatBucket, setTreatBucket] = useState<TreatBucket>('');
  const [codeFilter, setCodeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const anyBusy = busy || exportAction !== null;
  const exportBusy = exportAction !== null;

  const [editIne, setEditIne] = useState('');
  const [editCbo, setEditCbo] = useState(meta.defaultCbo);
  const [turno, setTurno] = useState('2');
  const [gestante, setGestante] = useState('false');
  const [localAtend, setLocalAtend] = useState('1');
  const [cnes, setCnes] = useState('');
  const [ibge, setIbge] = useState('3516200');
  const [justificativa, setJustificativa] = useState('');
  const [justificativaUnexpected, setJustificativaUnexpected] = useState('');
  const [cpf, setCpf] = useState('');
  const [cns, setCns] = useState('');
  const [keepId, setKeepId] = useState('');
  const [nascimento, setNascimento] = useState('');
  const [sexo, setSexo] = useState('');
  const [profCns, setProfCns] = useState('');
  const [dataAtend, setDataAtend] = useState('');
  const [horaIni, setHoraIni] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [procExtra, setProcExtra] = useState('');
  const [ciap, setCiap] = useState('');
  const [cid10, setCid10] = useState('');
  const [condutas, setCondutas] = useState('');
  const [focusField, setFocusField] = useState('');
  const [vigilancia, setVigilancia] = useState('1,3');
  const [tipoConsulta, setTipoConsulta] = useState('1');
  const [jobUi, setJobUi] = useState<LediJobUi | null>(null);
  const [liveSummary, setLiveSummary] = useState<LediChartSummary | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>('upload');
  const [tipoRecusa, setTipoRecusa] = useState<LediTipoMismatchError | null>(null);
  const [deferredCodes, setDeferredCodes] = useState<string[]>([]);
  const [individualQueue, setIndividualQueue] = useState<string[]>([]);
  const [individualIndex, setIndividualIndex] = useState(0);
  const [listOpen, setListOpen] = useState(false);

  const activeRepair = useMemo(
    () => (codeFilter ? lookupRepair(codeFilter) : undefined),
    [codeFilter, lookupRepair],
  );

  const lotQuality = useMemo(() => {
    if (!batch) return null;
    return {
      total: batch.summary.total,
      siapsReady: batch.summary.siapsReady,
      previneReady: batch.summary.previneReady,
      readyForFinalSend: batch.summary.readyForFinalSend,
      withBlockers: batch.summary.withBlockers,
    };
  }, [batch]);
  const lotQualityBaseline = useMemo(
    () =>
      batch
        ? baselineFromTreatment(batch.summary.total, batch.summary.treatment, lotQuality || undefined)
        : null,
    [batch, lotQuality],
  );

  const loadBatches = useCallback(async () => {
    const list = await api<BatchListRow[]>('/v1/dental/ledi/batches');
    setBatches(list.filter((b) => (b.summary?.expectedTipo || 'FAO') === expectedTipo));
  }, [expectedTipo]);

  const loadItems = useCallback(
    async (id: string, code?: string) => {
      const qs = new URLSearchParams();
      qs.set('limit', '300');
      if (treatBucket) qs.set('bucket', treatBucket);
      if (code) qs.set('code', code);
      if (statusFilter) qs.set('status', statusFilter);
      if (q.trim()) qs.set('q', q.trim());
      const page = await api<{ total: number; items: ItemRow[] }>(
        `/v1/dental/ledi/batches/${id}/items?${qs}`,
      );
      setItems(page.items);
      setItemsTotal(page.total);
    },
    [treatBucket, statusFilter, q],
  );

  const loadBatch = useCallback(
    async (id: string) => {
      const b = await api<Batch>(`/v1/dental/ledi/batches/${id}`);
      setBatch(b);
      await loadItems(id, codeFilter || undefined);
    },
    [loadItems, codeFilter],
  );

  useEffect(() => {
    void loadBatches().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [loadBatches]);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('batchId');
    if (!id) return;
    void api<Batch>(`/v1/dental/ledi/batches/${id}`)
      .then((b) => {
        setBatch(b);
        setWizardStep('analise');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, []);

  useEffect(() => {
    if (!batch?.id) return;
    void loadItems(batch.id, codeFilter || undefined).catch((e) =>
      setError(e instanceof Error ? e.message : 'Falha'),
    );
  }, [batch?.id, codeFilter, treatBucket, loadItems]);

  async function onUpload(files: FileList | File[] | null, resume?: LediChunkResume) {
    const listLike = files ? Array.from(files as ArrayLike<File>) : [];
    if (!listLike.length) return;
    setError(null);
    setUploadIoFailed(false);
    setOk(null);
    setBusy(true);
    try {
      const list = listLike.filter(
        (f) => f.name.toLowerCase().endsWith('.xml') || f.name.toLowerCase().endsWith('.zip'),
      );
      if (!list.length) throw new Error('Selecione arquivos .xml ou um .zip');
      lastFilesRef.current = list;
      if (!resume) setChunkResume(null);
      const { batch: created, uploaded, failedNames } = await uploadLediBatchMultipart<Batch>({
        files: list,
        name: batchName.trim() || `${meta.label} ${new Date().toLocaleString('pt-BR')}`,
        expectedTipo,
        onProgress: setUploadProgress,
        onJob: (j) => {
          setJobUi({ jobId: j.id, mode: 'import', job: j });
          const snap = jobChartSummary(j);
          if (snap) setLiveSummary(snap as LediChartSummary);
          const bid = (j.result as { batchId?: string } | null)?.batchId;
          if (bid) {
            void api<Batch>(`/v1/dental/ledi/batches/${bid}`).then(setBatch).catch(() => undefined);
          }
        },
        resume,
      });
      setBatch(created);
      setCodeFilter('');
      setUploadIoFailed(false);
      setChunkResume(null);
      setLiveSummary(created.summary);
      setJobUi(null);
      setWizardStep('analise');
      setTipoRecusa(null);
      setDeferredCodes([]);
      startTreat(created.summary, created.id);
      const failNote = failedNames.length
        ? ` · ${failedNames.length} não lidos (ex.: ${failedNames[0]})`
        : '';
      setOk(
        `Lote ${meta.label}: ${uploaded} enviadas · ${created.summary.withBlockers} com blocker · ${created.summary.conformant} conformes.${failNote}`,
      );
      await loadBatches();
      await loadBatch(created.id);
    } catch (err) {
      const mismatch = parseLediTipoMismatch(err) || (isLediTipoMismatchError(err) ? err : null);
      if (mismatch) {
        setTipoRecusa(mismatch);
        setWizardStep('recusado');
        setBatch(null);
        setLiveSummary(null);
        setJobUi(null);
        setError(null);
        setBusy(false);
        setUploadProgress('');
        return;
      }
      if (isChunkUploadError(err)) {
        setChunkResume({
          uploadId: err.uploadId,
          startIndex: err.failedIndex,
          total: err.total,
          fileName: err.fileName,
        });
      } else if (isIoReadError(err)) {
        setChunkResume(null);
      }
      setUploadIoFailed(isIoReadError(err) || isNetworkError(err) || isChunkUploadError(err));
      setError(formatUploadError(err));
    } finally {
      setBusy(false);
      setUploadProgress('');
    }
  }

  async function advanceAfterFix(batchId: string, justFixed: string | undefined, baseMsg: string) {
    const b = await api<Batch>(`/v1/dental/ledi/batches/${batchId}`);
    setBatch(b);
    const next = pickNextPriorityCode(b.summary, justFixed);
    if (wizardStep === 'tratar') {
      if (next && !next.same) {
        setCodeFilter(next.code);
        setErrorModalOpen(true);
        const files = (b.summary.topCodes || []).find((c) => c.code === next.code)?.files;
        setOk(
          `${baseMsg} Próximo: ${lookupRepair(next.code)?.title || next.code}${files != null ? ` (${files})` : ''}.`,
        );
        await loadItems(batchId, next.code);
        return;
      }
      if (next?.same) {
        setOk(`${baseMsg} Ainda neste alerta — corrija de novo ou deixe para individual.`);
        await loadItems(batchId, next.code);
        return;
      }
      setCodeFilter('');
      setErrorModalOpen(false);
      setWizardStep('fechamento');
      setOk(`${baseMsg} Sem próximos alertas — fechamento da análise.`);
      await loadItems(batchId);
      return;
    }
    if (next) {
      setCodeFilter(next.code);
      setErrorModalOpen(true);
      const files = (b.summary.topCodes || []).find((c) => c.code === next.code)?.files;
      setOk(
        `${baseMsg} ${next.same ? 'Ainda neste alerta' : 'Próximo'}: ${lookupRepair(next.code)?.title || next.code}${files != null ? ` (${files})` : ''}.`,
      );
    } else {
      setCodeFilter('');
      setErrorModalOpen(false);
      setOk(`${baseMsg} Sem próximos alertas no topo do lote.`);
    }
    await loadItems(batchId, next?.code);
  }

  function resetWizardToUpload() {
    setWizardStep('upload');
    setTipoRecusa(null);
    setBatch(null);
    setItems([]);
    setSelected(null);
    setCodeFilter('');
    setErrorModalOpen(false);
    setFichaModalOpen(false);
    setLiveSummary(null);
    setDeferredCodes([]);
    setIndividualQueue([]);
    setIndividualIndex(0);
    setError(null);
    setOk(null);
  }

  function problemEntries(summary: BatchSummary) {
    return (summary.topCodes || [])
      .filter((c) => c.files > 0 && !deferredCodes.includes(c.code))
      .map((c) => ({
        code: c.code,
        files: c.files,
        severity: String(resolveSeverity(c.code, 'BLOCKER')),
      }))
      .sort(compareBySeverityThenCount);
  }

  function startTreat(fromSummary?: BatchSummary, batchId?: string) {
    const s = fromSummary || batch?.summary;
    const id = batchId || batch?.id;
    if (!s) return;
    const queue = problemEntries(s);
    if (!queue.length) {
      setWizardStep('fechamento');
      setErrorModalOpen(false);
      return;
    }
    const first = queue[0]!;
    setWizardStep('tratar');
    setCodeFilter(first.code);
    setErrorModalOpen(true);
    if (id) void loadItems(id, first.code);
  }

  function goNextProblem() {
    if (!batch) {
      setWizardStep('fechamento');
      return;
    }
    const queue = problemEntries(batch.summary).filter((e) => e.code !== codeFilter);
    if (!queue.length) {
      setErrorModalOpen(false);
      setCodeFilter('');
      setWizardStep('fechamento');
      return;
    }
    const next = queue[0]!;
    setCodeFilter(next.code);
    setErrorModalOpen(true);
    void loadItems(batch.id, next.code);
  }

  function deferCurrentProblem() {
    if (codeFilter) setDeferredCodes((prev) => [...prev, codeFilter]);
    goNextProblem();
  }

  async function startIndividual() {
    if (!batch) return;
    setWizardStep('individual');
    setErrorModalOpen(false);
    const page = await api<{ total: number; items: ItemRow[] }>(
      `/v1/dental/ledi/batches/${batch.id}/items?bucket=bloqueio&limit=200`,
    );
    let rows = page.items.filter((it) => !it.siapsReady);
    if (!rows.length) {
      const warn = await api<{ items: ItemRow[] }>(
        `/v1/dental/ledi/batches/${batch.id}/items?status=warn&limit=200`,
      );
      rows = warn.items;
    }
    const ids = rows.map((it) => it.id);
    setIndividualQueue(ids);
    setIndividualIndex(0);
    setListOpen(false);
    if (ids[0]) await openItem(ids[0]);
    else {
      setOk('Nenhuma ficha residual para correção individual.');
      setWizardStep('fechamento');
    }
  }

  async function goNextIndividual() {
    const next = individualIndex + 1;
    if (next >= individualQueue.length) {
      setFichaModalOpen(false);
      setWizardStep('fechamento');
      if (batch) await loadBatch(batch.id);
      return;
    }
    setIndividualIndex(next);
    await openItem(individualQueue[next]!);
  }

  async function applySelectedRepair(code?: string) {
    if (!batch) return;
    const repairCode = code || codeFilter;
    const guide = repairCode ? lookupRepair(repairCode) : undefined;
    if (!guide || guide.mode !== 'auto') {
      setError('Este alerta não tem auto-correção em lote — abra a ficha ou reexporte.');
      return;
    }

    if (guide.suggestOnly) {
      setError('Este alerta exige dado clínico — abra a ficha. Não aplicamos em lote.');
      return;
    }

    const affected = itemsTotal || items.length;
    if (affected < 1) {
      setError('Nenhuma ficha neste filtro.');
      return;
    }

    const fields = {
      ine: editIne,
      ciap,
      cid10,
      cbo: editCbo,
      vigilancia: '',
      tipoConsulta: '',
      turno,
      gestante,
      local: localAtend,
      cnes,
      ibge,
      justificativa,
      justificativaUnexpected,
    };

    // onlyCode no servidor — NÃO mandar onlyItemIds da página (limit 300),
    // senão o job reporta "300 de 300" e ignora o restante do lote.
    let body: Record<string, unknown> = {
      forceSelected: false,
      onlyCode: repairCode,
      stNaoPossuiCpf: false,
    };

    if (guide.ui === 'st_cpf' || !guide.ui || guide.ui === 'manual') {
      body = {
        onlyCode: repairCode,
        stNaoPossuiCpf: guide.ui === 'st_cpf' || repairCode === 'ST_NAO_POSSUI_CPF',
        forceSelected: false,
      };
      if (editIne.trim()) body.ine = editIne.trim();
    } else {
      const patchFn = expectedTipo === 'FAI' ? faiBodyForRepairUi : bodyForRepairUi;
      const patch = patchFn(guide.ui, fields);
      if (!patch) {
        setError(
          expectedTipo === 'FAI' && (guide.ui === 'ciap' || guide.ui === 'cbo')
            ? 'Este ajuste não é automático na FAI — abra a ficha (não inventamos diagnóstico/ocupação).'
            : guide.ui === 'ine'
            ? 'Informe o INE no guia.'
            : guide.ui === 'cnes'
              ? 'Informe CNES com 7 dígitos.'
              : guide.ui === 'justificativa_unexpected'
                ? 'Escolha remove ou force_st.'
                : 'Preencha os campos do guia.',
        );
        return;
      }
      body = { ...body, forceSelected: true, ...patch };
    }

    setBusy(true);
    setError(null);
    try {
      const out = await runBatchAutofix('auto-fix', body);
      const touched = Number(out?.result?.touched ?? 0);
      await advanceAfterFix(
        batch.id,
        repairCode,
        `“${guide.title}”: corrigidas ${touched} ficha(s).`,
      );
      if (selected && items.some((it) => it.id === selected.id)) {
        setSelected(
          await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na correção');
    } finally {
      setBusy(false);
    }
  }

  function resetFichaForm() {
    setEditIne('');
    setEditCbo(meta.defaultCbo);
    setTurno('2');
    setGestante('false');
    setLocalAtend('1');
    setCnes('');
    setIbge('3516200');
    setJustificativa('');
    setJustificativaUnexpected('');
    setCpf('');
    setCns('');
    setKeepId('');
    setNascimento('');
    setSexo('');
    setProfCns('');
    setDataAtend('');
    setHoraIni('');
    setHoraFim('');
    setProcExtra('');
    setCiap('');
    setCid10('');
    setCondutas('');
    setFocusField('');
    setVigilancia('1,3');
    setTipoConsulta('1');
  }

  async function openItem(id: string) {
    if (!batch) return;
    setError(null);
    try {
      const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${id}`);
      setSelected(detail);
      resetFichaForm();
      const first = detail.findings
        .map((f) => ({ f, sev: String(f.severity || resolveSeverity(f.code)) }))
        .sort((a, b) => severityRank(a.sev) - severityRank(b.sev))[0];
      const guide = first ? lookupRepair(first.f.code) : undefined;
      setFocusField(guide?.focusField || '');
      setFichaModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir ficha');
    }
  }

  function setFichaForm(patch: Record<string, string>) {
    if (patch.ciap !== undefined) setCiap(patch.ciap);
    if (patch.cid10 !== undefined) setCid10(patch.cid10);
    if (patch.editIne !== undefined) setEditIne(patch.editIne);
    if (patch.editCbo !== undefined) setEditCbo(patch.editCbo);
    if (patch.turno !== undefined) setTurno(patch.turno);
    if (patch.gestante !== undefined) setGestante(patch.gestante);
    if (patch.localAtend !== undefined) setLocalAtend(patch.localAtend);
    if (patch.cnes !== undefined) setCnes(patch.cnes);
    if (patch.ibge !== undefined) setIbge(patch.ibge);
    if (patch.justificativa !== undefined) setJustificativa(patch.justificativa);
    if (patch.justificativaUnexpected !== undefined) {
      setJustificativaUnexpected(patch.justificativaUnexpected);
    }
    if (patch.cpf !== undefined) setCpf(patch.cpf);
    if (patch.cns !== undefined) setCns(patch.cns);
    if (patch.keepId !== undefined) setKeepId(patch.keepId);
    if (patch.nascimento !== undefined) setNascimento(patch.nascimento);
    if (patch.sexo !== undefined) setSexo(patch.sexo);
    if (patch.profCns !== undefined) setProfCns(patch.profCns);
    if (patch.dataAtend !== undefined) setDataAtend(patch.dataAtend);
    if (patch.horaIni !== undefined) setHoraIni(patch.horaIni);
    if (patch.horaFim !== undefined) setHoraFim(patch.horaFim);
    if (patch.procExtra !== undefined) setProcExtra(patch.procExtra);
    if (patch.condutas !== undefined) setCondutas(patch.condutas);
    if (patch.vigilancia !== undefined) setVigilancia(patch.vigilancia);
    if (patch.tipoConsulta !== undefined) setTipoConsulta(patch.tipoConsulta);
    if (patch.focusField !== undefined) setFocusField(patch.focusField);
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!selected || !batch) return;
    const body: Record<string, unknown> = {};
    if (editIne.trim()) body.ine = editIne.trim();
    if (editCbo.trim()) body.cboCodigo_2002 = editCbo.trim();
    if (turno) body.turno = Number(turno);
    if (gestante === 'true' || gestante === 'false') body.gestante = gestante === 'true';
    if (localAtend) body.localAtendimento = Number(localAtend);
    if (cnes.replace(/\D/g, '').length === 7) body.cnes = cnes.replace(/\D/g, '');
    if (ibge.replace(/\D/g, '').length === 7) body.codigoIbgeMunicipio = ibge.replace(/\D/g, '');
    if (justificativa) {
      const n = Number(justificativa);
      if ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 99].includes(n)) {
        body.justificativaNaoPossuiCpf = n;
      }
    }
    if (justificativaUnexpected === 'remove' || justificativaUnexpected === 'force_st') {
      body.justificativaCpfUnexpected = justificativaUnexpected;
    }
    if (keepId === 'cpf' || keepId === 'cns') body.keepCitizenId = keepId;
    if (cpf.replace(/\D/g, '').length === 11) body.cpfCidadao = cpf.replace(/\D/g, '');
    if (cns.replace(/\D/g, '').length >= 15) body.cnsCidadao = cns.replace(/\D/g, '');
    if (nascimento) body.dtNascimento = nascimento;
    if (sexo === '0' || sexo === '1') body.sexo = sexo;
    if (profCns.replace(/\D/g, '').length >= 15) body.profissionalCNS = profCns.replace(/\D/g, '');
    if (dataAtend) body.dataAtendimento = dataAtend;
    if (horaIni.trim()) body.dataHoraInicialAtendimento = horaIni.trim();
    if (horaFim.trim()) body.dataHoraFinalAtendimento = horaFim.trim();
    if (procExtra.trim()) {
      const codes = procExtra
        .split(/[,;\s]+/)
        .map((x) => x.replace(/\D/g, ''))
        .filter((x) => x.length === 10);
      if (meta.variant === 'proc' && codes.length) {
        body.procedimentosCodes = codes;
      } else if (codes.length) {
        body.procedimentosAdd = codes.map((coMsProcedimento) => ({
          coMsProcedimento,
          quantidade: 1,
        }));
      }
    }
    if (condutas.trim()) {
      const codes = condutas
        .split(',')
        .map((x) => Number(x.trim()))
        .filter((n) => Number.isFinite(n) && n >= 1);
      if (meta.variant === 'fai' && codes.length) body.condutas = codes;
      else if (meta.variant === 'fao' && codes.length) {
        const odonto = codes.filter((n) => isLediCondutaOdontoId(n));
        if (odonto.length) body.tiposEncamOdonto = odonto;
      } else if (codes.length) body.tiposEncamOdonto = codes;
    }
    if (expectedTipo === 'FAO') {
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
    }

    if (!Object.keys(body).length) {
      setError('Preencha ao menos um campo antes de salvar.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const detail = await api<ItemDetail>(
        `/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`,
        { method: 'PATCH', json: body },
      );
      setSelected(detail);
      setOk(`Ficha ${selected.fileName} revalidada.`);
      await loadBatch(batch.id);
      if (wizardStep === 'individual') {
        const stillBlocker = detail.findings.some((f) => String(f.severity) === 'BLOCKER');
        if (!stillBlocker) await goNextIndividual();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBatch(id: string, name?: string) {
    const label = name || id.slice(0, 8);
    if (!window.confirm(`Excluir a análise “${label}”?`)) return;
    setBusy(true);
    try {
      await api(`/v1/dental/ledi/batches/${id}`, { method: 'DELETE' });
      if (batch?.id === id) {
        resetWizardToUpload();
      }
      setOk(`Análise “${label}” excluída.`);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir');
    } finally {
      setBusy(false);
    }
  }

  function openGuide(code: string) {
    setCodeFilter(code);
    setErrorModalOpen(true);
  }

  async function waitLediJob(jobId: string, mode: LediJobUi['mode']) {
    setJobUi({ jobId, mode, job: null });
    const job = await waitForJob(jobId, {
      timeoutMs: 45 * 60_000,
      intervalMs: 1200,
      onProgress: (j) => {
        setJobUi({ jobId, mode, job: j });
        setOk(jobProgressLabel(j));
        const snap = jobChartSummary(j);
        if (snap) setLiveSummary(snap as LediChartSummary);
        const bid = (j.result as { batchId?: string } | null)?.batchId;
        if (bid && mode !== 'import' && batch?.id === bid) {
          void api<Batch>(`/v1/dental/ledi/batches/${bid}`).then(setBatch).catch(() => undefined);
        }
      },
    });
    setJobUi({ jobId, mode, job });
    if (job.status !== 'completed') {
      throw new Error(job.errorMessage || `Job ${job.status}`);
    }
    return job;
  }

  async function runBatchAutofix(path: 'auto-fix' | 'dry-run', body: Record<string, unknown>) {
    if (!batch) return null;
    const res = await api<
      Batch & {
        touched?: number;
        wouldTouch?: number;
        async?: boolean;
        jobId?: string;
        before?: { withBlockers: number; siapsReady: number };
        after?: { withBlockers: number; siapsReady: number };
        samples?: Array<{ fileName: string; applied: string[]; codesRemoved: string[] }>;
        codeDelta?: Array<{ code: string; before: number; after: number; delta: number }>;
      }
    >(`/v1/dental/ledi/batches/${batch.id}/${path}`, { method: 'POST', json: body });
    if (isAsyncJobResponse(res)) {
      const job = await waitLediJob(res.jobId, path === 'dry-run' ? 'dry-run' : 'apply');
      const result = (job.result || {}) as Record<string, unknown>;
      const finalBatch = await api<Batch>(`/v1/dental/ledi/batches/${batch.id}`);
      setBatch(finalBatch);
      setLiveSummary(finalBatch.summary);
      return { job, result, batch: finalBatch };
    }
    if (path === 'auto-fix') {
      setBatch(res);
      setLiveSummary(res.summary);
    }
    return { job: null, result: res as unknown as Record<string, unknown>, batch: res };
  }

  async function runExport(
    action: ExportAction,
    fn: () => Promise<void | string>,
    successMsg?: string,
  ) {
    setError(null);
    setOk(null);
    setExportAction(action);
    try {
      const msg = await fn();
      const final = msg || successMsg;
      if (final) setOk(final);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na exportação');
    } finally {
      setExportAction(null);
    }
  }

  const siapsReady = batch?.summary.siapsReady ?? 0;
  const previneReady = batch?.summary.previneReady ?? 0;
  const readyFinal = batch?.summary.readyForFinalSend ?? 0;
  const withBlockers = batch?.summary.withBlockers ?? 0;
  const totalFichas = batch?.summary.total ?? 0;
  const treatQueue = batch ? problemEntries(batch.summary) : [];
  const treatIndex = Math.max(1, treatQueue.findIndex((e) => e.code === codeFilter) + 1);
  const showUpload = wizardStep === 'upload' || wizardStep === 'recusado';

  const stepLabel: Record<WizardStep, string> = {
    upload: '1. Upload',
    recusado: 'Tipo recusado',
    analise: '3. Análise',
    tratar: '4. Problema a problema',
    fechamento: '5. Fechamento',
    individual: '7. Ficha a ficha',
  };

  return (
    <AppShell helpId={meta.helpId}>
      <PageHeader
        title={meta.title}
        eyebrow="Wizard de lote LEDI"
        description={meta.help}
        actions={
          <>
            <HelpLink id={meta.helpId} />
            <Link className="btn btn-secondary" href="/faturamento">
              Hub faturamento
            </Link>
            {expectedTipo === 'FAO' ? (
              <>
                <Link className="btn btn-secondary" href={meta.clinicalHref}>
                  {meta.clinicalLabel}
                </Link>
                <Link className="btn btn-secondary" href={meta.queueHref}>
                  {meta.queueLabel}
                </Link>
              </>
            ) : null}
            {expectedTipo === 'FAI' ? (
              <>
                <Link className="btn btn-secondary" href={meta.clinicalHref}>
                  {meta.clinicalLabel}
                </Link>
                <Link className="btn btn-secondary" href={meta.queueHref}>
                  {meta.queueLabel}
                </Link>
              </>
            ) : null}
            {expectedTipo !== 'FAO' ? (
              <Link className="btn btn-secondary" href="/faturamento/lote/fao">
                Lote FAO
              </Link>
            ) : (
              <Link className="btn btn-secondary" href="/faturamento/lote/proc">
                Lote Procedimentos
              </Link>
            )}
            <Link className="btn btn-secondary" href={meta.siblingHref}>
              {meta.siblingLabel}
            </Link>
          </>
        }
      />
      {error && wizardStep !== 'recusado' ? <ErrorBox message={error} /> : null}
      {ok ? <div className="alert ok">{ok}</div> : null}

      {!showUpload && batch ? (
        <div className="card" style={{ marginBottom: 16, padding: '10px 14px' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <strong style={{ fontSize: 13 }}>{stepLabel[wizardStep]}</strong>
            <span className="muted" style={{ fontSize: 13 }}>
              {batch.name}
            </span>
            <span style={{ flex: 1 }} />
            <button type="button" className="btn btn-ghost" onClick={resetWizardToUpload}>
              Novo lote
            </button>
          </div>
        </div>
      ) : null}

      {wizardStep === 'recusado' && tipoRecusa ? (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--danger)' }}>
          <h3 style={{ marginTop: 0 }}>Este ZIP não é {meta.label}</h3>
          <p>{tipoRecusa.message}</p>
          <p className="muted" style={{ fontSize: 13 }}>
            Nenhuma ficha foi analisada e nenhum lote foi gravado. Separe os tipos e envie na tela certa.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={resetWizardToUpload}>
              Voltar ao início
            </button>
            {tipoRecusa.href ? (
              <Link className="btn btn-secondary" href={tipoRecusa.href}>
                Ir para {tipoRecusa.detectedTipo === 'FAO' ? 'Lote FAO' : tipoRecusa.detectedTipo === 'PROCEDIMENTOS' ? 'Lote Procedimentos' : 'Lote FAI'}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {showUpload ? (
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>1. Enviar XMLs {meta.label}</h3>
        <p style={{ marginTop: 0, lineHeight: 1.5 }}>
          O sistema abre <strong>ficha a ficha</strong>. Correções automatizáveis entram sozinhas; o que
          precisa de pessoa vai para tratamento depois.
        </p>
        <ul className="muted" style={{ marginTop: 0, lineHeight: 1.55 }}>
          <li>
            <strong>Pronto Siaps</strong> — pode enviar ao Ministério / a produção entra
          </li>
          <li>
            <strong>Pronto Previne</strong> — qualidade / indicador
            {expectedTipo === 'FAO' ? ' (ESB B1–B6)' : ' (qualidade LEDI)'}
          </li>
          <li>
            <strong>100% OK</strong> — Siaps e Previne
          </li>
        </ul>
        <p className="muted" style={{ fontSize: 13 }}>
          {expectedTipo === 'FAI' ? (
            <>
              Esta tela aceita só FAI (tipo 4). FAO vai em <Link href="/faturamento/lote/fao">Lote FAO</Link>.
              Produção nativa APS: <Link href="/faturamento/aps">fila APS</Link>.
            </>
          ) : expectedTipo === 'FAO' ? (
            <>
              Esta tela aceita só FAO (tipo 5). FAI vai em <Link href="/faturamento/lote/fai">Lote FAI</Link>.
              Produção nativa odonto: <Link href="/faturamento/odonto">fila odonto</Link>.
            </>
          ) : (
            <>
              Esta tela aceita só Procedimentos (tipo 7). FAI vai em{' '}
              <Link href="/faturamento/lote/fai">Lote FAI</Link>.
            </>
          )}
        </p>
        <div className="field">
          <label>Nome do lote (opcional)</label>
          <input
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
            placeholder={`Ex.: ${meta.label} competência`}
          />
        </div>
        <FileDropZone
          disabled={anyBusy}
          acceptHint={meta.acceptHint}
          accept=".zip,.xml,application/zip,application/xml,text/xml"
          ioFailed={uploadIoFailed}
          onFiles={(f) => void onUpload(f)}
        />
        {uploadProgress ? (
          <div
            className="alert"
            style={{ marginTop: 12, background: 'var(--surface-2)', border: '1px solid var(--line)' }}
          >
            <strong>
              {isAnalyzingProgress(uploadProgress)
                ? 'Analisando no servidor'
                : /lendo\+enviando/i.test(uploadProgress)
                  ? 'Lendo e enviando'
                  : 'Enviando ZIP'}
            </strong>
            <div style={{ marginTop: 6 }}>{uploadProgress}</div>
            {(() => {
              const parte = parseParteProgress(uploadProgress);
              if (!parte) return null;
              return (
                <progress
                  value={parte.current}
                  max={parte.total}
                  style={{ width: '100%', marginTop: 8 }}
                />
              );
            })()}
            {isAnalyzingProgress(uploadProgress) ? (
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
                Conferência de tipo primeiro. Se o ZIP for de outra tela, paramos — sem análise.
              </p>
            ) : null}
            {jobUi?.mode === 'import' && jobUi.job ? (
              <LediJobProgressPanel job={jobUi.job} mode="import" compact />
            ) : null}
            <LediFunnelCharts summary={liveSummary || batch?.summary} live={Boolean(jobUi?.mode === 'import')} />
          </div>
        ) : null}
        {chunkResume && !busy ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                void onUpload(lastFilesRef.current, {
                  uploadId: chunkResume.uploadId,
                  startIndex: chunkResume.startIndex,
                })
              }
            >
              Retomar envio (parte {chunkResume.startIndex + 1}/{chunkResume.total})
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setChunkResume(null);
                void onUpload(lastFilesRef.current);
              }}
            >
              Recomeçar do zero
            </button>
          </div>
        ) : null}
        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ cursor: 'pointer', fontSize: 13 }}>
            Safari / ZIP grande (fatias 512 KiB)
          </summary>
          <p className="muted" style={{ fontSize: 13, margin: '8px 0 0' }}>
            Cada fatia é lida e enviada na hora — o Safari não monta o ZIP na RAM. Se a leitura
            falhar, use Chrome/Edge ou Escolher de novo pelo botão (não arraste do Finder). Fatia HTTP
            falhou: Retomar ou Recomeçar.
          </p>
        </details>
      </div>
      ) : null}

      {showUpload && batches.length ? (
        <details className="card" style={{ marginBottom: 16, padding: 16 }}>
          <summary style={{ cursor: 'pointer' }}>
            Lotes recentes ({meta.label}) — {batches.length}
          </summary>
          <ul style={{ margin: '12px 0 0', paddingLeft: 0, listStyle: 'none' }}>
            {batches.map((b) => (
              <li
                key={b.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}
              >
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setCodeFilter('');
                    setWizardStep('analise');
                    void loadBatch(b.id);
                  }}
                >
                  {b.name} · {b.itemCount} fichas · {b.status}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={anyBusy}
                  style={{ color: 'var(--danger)', padding: '4px 8px' }}
                  onClick={() => void deleteBatch(b.id, b.name)}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {batch && !showUpload ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>
              {wizardStep === 'fechamento'
                ? `5. Fechamento — ${batch.name}`
                : wizardStep === 'individual'
                  ? `7. Correção ficha a ficha — ${batch.name}`
                  : wizardStep === 'tratar'
                    ? `4. Problema a problema — ${batch.name}`
                    : `3. Análise — ${batch.name}`}
            </h3>
            <p className="muted" style={{ marginTop: 0 }}>
              {wizardStep === 'fechamento'
                ? 'Campos corrigidos, aptas a envio / Previne / 100% OK, e gráfico antes × depois.'
                : wizardStep === 'individual'
                  ? 'Uma ficha por vez: o que falta, salvar, próxima. A lista fica recolhida como busca.'
                  : wizardStep === 'tratar'
                    ? `Um problema por vez, do mais grave e abrangente ao mais leve. ${treatQueue.length ? `Problema ${treatIndex} de ${treatQueue.length}.` : ''}`
                    : 'Quantidade, já podem enviar, erros, corrigem em lote vs individuais.'}{' '}
              {expectedTipo === 'FAI'
                ? 'FAI tipo 4 — atendimento individual, não odonto.'
                : expectedTipo === 'FAO'
                  ? 'FAO tipo 5 — saúde bucal / Previne ESB.'
                  : 'Ficha de procedimentos tipo 7.'}
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
                <strong>Qualidade incompleta</strong>
                <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                  Envia, mas a informação ainda precisa melhorar (dados / equipe).
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

            <LediFunnelCharts
              summary={liveSummary || batch.summary}
              live={Boolean(jobUi && jobUi.mode !== 'import')}
              variant={wizardStep === 'fechamento' ? 'fechamento' : 'analise'}
            />

            {jobUi && jobUi.mode !== 'import' ? (
              <div className="card" style={{ margin: '12px 0', padding: 12, background: 'var(--surface-2)' }}>
                <LediJobProgressPanel job={jobUi.job} mode={jobUi.mode} compact />
              </div>
            ) : null}

            <TreatmentDashboard
              treatment={batch.summary.treatment}
              readyForFinalSend={batch.summary.readyForFinalSend}
              activeBucket={treatBucket}
              kind={meta.variant}
              onFilterBucket={(bucket) => {
                setTreatBucket(bucket);
                setCodeFilter('');
              }}
            />

            <LoteQualityPanel
              total={batch.summary.total}
              siapsReady={batch.summary.siapsReady}
              previneReady={batch.summary.previneReady}
              readyForFinalSend={batch.summary.readyForFinalSend}
              fichaLabel={meta.fichaLabel}
              kind={meta.variant}
              withWarn={batch.summary.withWarn}
            />

            {wizardStep === 'analise' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                <button type="button" className="btn btn-primary" disabled={anyBusy} onClick={() => startTreat()}>
                  Tratar problemas um a um
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={anyBusy}
                  onClick={() => setWizardStep('fechamento')}
                >
                  Ir ao fechamento
                </button>
              </div>
            ) : null}
            {wizardStep === 'tratar' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                <button type="button" className="btn btn-primary" onClick={() => startTreat()}>
                  Continuar tratamento
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setWizardStep('fechamento')}>
                  Ir ao fechamento
                </button>
              </div>
            ) : null}
            {wizardStep === 'fechamento' || wizardStep === 'individual' ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={anyBusy}
                  onClick={() => void startIndividual()}
                >
                  Corrigir ficha a ficha
                </button>
                {wizardStep === 'individual' ? (
                  <button type="button" className="btn btn-secondary" onClick={() => setWizardStep('fechamento')}>
                    Voltar ao fechamento
                  </button>
                ) : null}
              </div>
            ) : null}

            <h4 style={{ marginBottom: 8 }}>Alertas (clique para o guia)</h4>
            <div className="lote-bars">
              {(batch.summary.topCodes || [])
                .map((c) => ({
                  ...c,
                  severity: resolveSeverity(c.code, 'BLOCKER'),
                }))
                .sort(compareBySeverityThenCount)
                .slice(0, 16)
                .map((c) => {
                  const guide = lookupRepair(c.code);
                  const maxFiles = Math.max(1, ...(batch.summary.topCodes || []).map((x) => x.files));
                  return (
                    <button
                      key={c.code}
                      type="button"
                      className={`lote-bar-row ${codeFilter === c.code ? 'active' : ''}`}
                      onClick={() => openGuide(c.code)}
                      title={guide?.how || c.code}
                    >
                      <span>
                        <span className={`lote-sev ${c.severity}`}>{severityLabel(c.severity)}</span>
                        <strong style={{ fontSize: 13, display: 'block', marginTop: 4 }}>
                          {guide?.title || explainError(c.code)?.title || c.code}
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
                          className={`lote-bar-fill ${severityTone(c.severity)}`}
                          style={{ width: `${Math.max(6, (c.files / maxFiles) * 100)}%` }}
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

            {codeFilter ? (
              <div className="lote-toolbar" style={{ marginTop: 14 }}>
                <span>
                  Filtro ativo: <strong>{activeRepair?.title || codeFilter}</strong>
                </span>
                <button type="button" className="btn btn-primary" onClick={() => setErrorModalOpen(true)}>
                  Abrir guia do erro
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => setCodeFilter('')}>
                  Limpar filtro
                </button>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
                Clique numa barra para abrir o <strong>guia em modal</strong> (lote ou ficha a ficha).
              </p>
            )}

            <div
              className="lote-export-panel"
              style={{
                marginTop: 16,
                padding: '14px 16px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: readyFinal > 0 ? 'var(--ok-bg)' : 'var(--surface-2)',
              }}
            >
              <h4 style={{ margin: '0 0 6px' }}>6. Dois ZIPs</h4>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                <strong>{siapsReady}</strong> aptas para envio (Pronto Siaps) ·{' '}
                <strong>{withBlockers}</strong> ainda precisam correção ·{' '}
                <strong>{previneReady}</strong> Pronto Previne · <strong>{readyFinal}</strong> 100% OK.
                O segundo ZIP <strong>não</strong> inclui as já aptas.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={anyBusy || siapsReady < 1}
                  title={
                    siapsReady < 1
                      ? 'Nenhuma ficha pronta Siaps ainda'
                      : 'ZIP só com fichas sem BLOCKER (podem ir ao Siaps agora)'
                  }
                  onClick={() =>
                    void runExport(
                      'zip-conformant',
                      () => downloadZip(batch.id, 'conformant', meta.fileSlug),
                      `ZIP aptos para envio (${siapsReady} Pronto Siaps · ${readyFinal} 100% OK).`,
                    )
                  }
                >
                  {exportAction === 'zip-conformant' ? 'Gerando ZIP…' : 'Baixar aptos para envio'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={anyBusy || withBlockers < 1}
                  title={
                    withBlockers < 1
                      ? 'Nenhuma ficha pendente de correção'
                      : 'ZIP só com fichas que ainda bloqueiam o envio'
                  }
                  onClick={() =>
                    void runExport(
                      'zip-pending',
                      () => downloadZip(batch.id, 'pending', meta.fileSlug),
                      `ZIP pendentes (${withBlockers} ainda precisam correção).`,
                    )
                  }
                >
                  {exportAction === 'zip-pending' ? 'Gerando ZIP…' : 'Baixar ainda precisam correção'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={anyBusy || totalFichas < 1}
                  title="Todas as fichas do lote no estado atual (incluindo com alerta)"
                  onClick={() =>
                    void runExport(
                      'zip-current',
                      () => downloadZip(batch.id, 'current', meta.fileSlug),
                      `ZIP (todas as atuais) baixado · ${totalFichas} ficha(s).`,
                    )
                  }
                >
                  {exportAction === 'zip-current' ? 'Gerando ZIP…' : 'ZIP todas (legado)'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={anyBusy}
                  onClick={() => {
                    void runExport('dry-run', async () => {
                      const out = await runBatchAutofix('dry-run', { stNaoPossuiCpf: true });
                      const dry = out?.result as {
                        wouldTouch?: number;
                        before?: { withBlockers: number; siapsReady: number };
                        after?: { withBlockers: number; siapsReady: number };
                        samples?: Array<{ fileName: string; applied: string[] }>;
                        codeDelta?: Array<{ code: string; before: number; after: number }>;
                      };
                      const top = (dry?.codeDelta || [])
                        .slice(0, 5)
                        .map((d) => `${d.code}: ${d.before}→${d.after}`)
                        .join(' · ');
                      const sample = (dry?.samples || [])[0];
                      const preview = sample
                        ? ` · ex.: ${sample.fileName} [${(sample.applied || []).join(', ')}]`
                        : '';
                      setJobUi(null);
                      return `Dry-run: tocariam ${dry?.wouldTouch ?? 0} fichas · blockers ${dry?.before?.withBlockers}→${dry?.after?.withBlockers} · Siaps ${dry?.before?.siapsReady}→${dry?.after?.siapsReady}${top ? ` · ${top}` : ''}${preview}`;
                    });
                  }}
                >
                  {exportAction === 'dry-run' ? 'Simulando…' : 'Dry-run (simular auto)'}
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={anyBusy || totalFichas < 1}
                  title="Aplica só correções seguras (stNaoPossuiCpf, turno, local, IBGE, UUID, encoding). Não inventa CIAP, conduta nem paciente."
                  onClick={() => {
                    void runExport('dry-run', async () => {
                      const out = await runBatchAutofix('auto-fix', { stNaoPossuiCpf: true });
                      const touched = Number(out?.result?.touched ?? 0);
                      await loadItems(batch.id, codeFilter);
                      setJobUi(null);
                      return `Correções seguras: ${touched} ficha(s) alterada(s). Conduta/CIAP/paciente continuam manuais.`;
                    });
                  }}
                >
                  Corrigir em lote (ajustes seguros)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={anyBusy}
                  onClick={() =>
                    void runExport(
                      'closure',
                      () => downloadClosureReport(batch.id, meta.fileSlug),
                      'Relatório de fechamento (.md) baixado.',
                    )
                  }
                >
                  {exportAction === 'closure' ? 'Gerando relatório…' : 'Relatório fechamento (.md)'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={anyBusy}
                  style={{ color: 'var(--danger)' }}
                  onClick={() => void deleteBatch(batch.id, batch.name)}
                >
                  Excluir esta análise
                </button>
              </div>
              {exportBusy ? (
                <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
                  Aguarde — exportação em andamento…
                </p>
              ) : null}
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>3. Correções em massa (ajustes seguros)</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Lotes grandes (~8 mil fichas) rodam em job no servidor, em fatias. A barra mostra
              “processando ficha 1240 de 8149”. Se cair no meio, o próximo clique retoma o mesmo lote.
              Só o que não inventa dado clínico: <code>stNaoPossuiCpf</code>, turno, local UBS, IBGE
              Franca, UUID, encoding. CIAP/CID, conduta e paciente continuam manuais na ficha.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={anyBusy}
                onClick={() => {
                  void runExport('dry-run', async () => {
                    const out = await runBatchAutofix('dry-run', { stNaoPossuiCpf: true });
                    const dry = out?.result as {
                      wouldTouch?: number;
                      before?: { withBlockers: number; siapsReady: number };
                      after?: { withBlockers: number; siapsReady: number };
                    };
                    setJobUi(null);
                    return `Dry-run: tocariam ${dry?.wouldTouch ?? 0} fichas · blockers ${dry?.before?.withBlockers}→${dry?.after?.withBlockers} · Siaps ${dry?.before?.siapsReady}→${dry?.after?.siapsReady}`;
                  });
                }}
              >
                {exportAction === 'dry-run' ? 'Simulando…' : 'Dry-run (simular auto)'}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={anyBusy || totalFichas < 1}
                title="Aplica só correções seguras. Não inventa CIAP, conduta nem paciente."
                onClick={() => {
                  void runExport('dry-run', async () => {
                    const out = await runBatchAutofix('auto-fix', { stNaoPossuiCpf: true });
                    const touched = Number(out?.result?.touched ?? 0);
                    await loadItems(batch.id, codeFilter);
                    setJobUi(null);
                    return `Correções seguras: ${touched} ficha(s) alterada(s). Não é preciso clicar de novo.`;
                  });
                }}
              >
                Corrigir em lote (ajustes seguros)
              </button>
            </div>
          </div>

          {expectedTipo === 'FAO' && batch.summary.previne ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginTop: 0 }}>Raio-x Previne (qualidade / indicadores)</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Sem R$. B1 1ª consulta · B2 conclusão · B3 extração · B5 prevenção · B6 ART. Clique numa
                barra de alerta acima para filtrar.
              </p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
                  gap: 8,
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
            </div>
          ) : null}

          <PendingReportPanel
            batchId={batch.id}
            fileSlug={meta.fileSlug}
            disabled={anyBusy}
          />

          <details className="card" open={listOpen || wizardStep === 'individual'}>
            <summary
              style={{ cursor: 'pointer' }}
              onClick={(e) => {
                e.preventDefault();
                setListOpen((v) => !v);
              }}
            >
              Busca de fichas (atalho){' '}
              {codeFilter ? `(${itemsTotal} com este alerta)` : `(${itemsTotal})`}
            </summary>
            <p className="muted" style={{ marginTop: 8 }}>
              Fluxo principal é ficha a ficha. Use esta lista só para ir a um arquivo.
            </p>
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
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => batch && void loadItems(batch.id, codeFilter || undefined)}
              >
                Atualizar lista
              </button>
            </div>
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th align="left">Arquivo</th>
                    <th>Tipo</th>
                    <th>Siaps</th>
                    <th>Qualidade</th>
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
                      <td>{it.fileName}</td>
                      <td align="center">
                        <code title={it.fichaTipo || ''}>{it.fichaTipo || '?'}</code>
                      </td>
                      <td align="center">{it.siapsReady ? 'ok' : 'falha'}</td>
                      <td align="center">
                        {it.siapsReady
                          ? (it.qualityWarns || 0) > 0 || (it.moneyRisks || 0) > 0
                            ? 'alerta'
                            : 'ok'
                          : '—'}
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {it.topCodes
                          .slice(0, 4)
                          .map((c) => lookupRepair(c)?.title || explainError(c)?.title || c)
                          .join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : null}

      {activeRepair && codeFilter ? (
        <ErrorGuideModal
          open={errorModalOpen}
          code={codeFilter}
          repair={activeRepair}
          affected={items}
          affectedTotal={itemsTotal || items.length}
          busy={anyBusy}
          fieldValues={{
            ine: editIne,
            ciap,
            cid10,
            cbo: editCbo,
            turno,
            gestante,
            local: localAtend,
            cnes,
            ibge,
            justificativa,
            justificativaUnexpected,
            vigilancia,
            tipoConsulta,
          }}
          onFieldChange={(key, value) => {
            if (key === 'ine') setEditIne(value);
            else if (key === 'ciap') setCiap(value);
            else if (key === 'cid10') setCid10(value);
            else if (key === 'cbo') setEditCbo(value);
            else if (key === 'turno') setTurno(value);
            else if (key === 'gestante') setGestante(value);
            else if (key === 'local') setLocalAtend(value);
            else if (key === 'cnes') setCnes(value);
            else if (key === 'ibge') setIbge(value);
            else if (key === 'justificativa') setJustificativa(value);
            else if (key === 'justificativaUnexpected') setJustificativaUnexpected(value);
            else if (key === 'vigilancia') setVigilancia(value);
            else if (key === 'tipoConsulta') setTipoConsulta(value);
          }}
          onClose={() => {
            setErrorModalOpen(false);
            if (wizardStep === 'tratar') setWizardStep('analise');
          }}
          onFixAllAffected={() => void applySelectedRepair(codeFilter)}
          onOpenFicha={(id) => void openItem(id)}
          lotQuality={lotQuality}
          lotQualityBaseline={lotQualityBaseline}
          sequential={wizardStep === 'tratar'}
          problemIndex={treatIndex}
          problemTotal={treatQueue.length}
          isLastProblem={treatIndex >= treatQueue.length}
          onDeferToIndividual={deferCurrentProblem}
          onNextProblem={goNextProblem}
        />
      ) : null}

      <FichaFixModal
        open={fichaModalOpen && !!selected}
        selected={selected}
        busy={anyBusy}
        variant={meta.variant}
        lotQuality={lotQuality}
        lotQualityBaseline={lotQualityBaseline}
        form={{
          ciap,
          cid10,
          editIne,
          editCbo,
          vigilancia,
          tipoConsulta,
          turno,
          gestante,
          localAtend,
          cnes,
          ibge,
          justificativa,
          justificativaUnexpected,
          cpf,
          cns,
          keepId,
          nascimento,
          sexo,
          profCns,
          dataAtend,
          horaIni,
          horaFim,
          condutas,
          procExtra,
          focusField,
        }}
        setForm={setFichaForm}
        onClose={() => {
          setFichaModalOpen(false);
          if (wizardStep === 'individual') setWizardStep('fechamento');
        }}
        onSave={(e) => void saveItem(e)}
        onApplyGap={(code) => {
          openGuide(code);
          setFichaModalOpen(false);
        }}
        onFocusField={(field) => setFocusField(field || '')}
        sequential={wizardStep === 'individual'}
        fichaIndex={individualIndex + 1}
        fichaTotal={individualQueue.length}
        hasNext={individualIndex + 1 < individualQueue.length}
        onNextFicha={() => void goNextIndividual()}
      />

      <LediJobProgressModal
        open={Boolean(jobUi && jobUi.mode !== 'import')}
        ui={jobUi}
        onDismiss={() => {
          if (jobUi?.job?.status === 'completed' || jobUi?.job?.status === 'failed' || jobUi?.job?.status === 'dead') {
            setJobUi(null);
          }
        }}
      />
    </AppShell>
  );
}
