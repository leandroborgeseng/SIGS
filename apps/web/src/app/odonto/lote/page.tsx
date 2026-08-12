'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError, getToken } from '@/lib/api';
import { isAsyncJobResponse, waitForJob } from '@/lib/jobs';
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
import { ErrorGuideModal } from './ErrorGuideModal';
import { FichaFixModal } from './FichaFixModal';
import { CodeSearchSelect } from '@/components/ui/CodeSearchSelect';

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

async function downloadClosureReport(batchId: string) {
  const report = await api<{ markdown: string; name: string }>(
    `/v1/dental/ledi/batches/${batchId}/closure-report`,
  );
  const blob = new Blob([report.markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledi-fechamento-${batchId.slice(0, 8)}.md`;
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

/** Próximo alerta a tratar: mantém o atual se ainda houver fichas; senão o próximo vermelho (depois laranja). */
function pickNextPriorityCode(
  summary: BatchSummary,
  justFixed?: string,
): { code: string; same: boolean; severity: string } | null {
  const entries = [
    ...(summary.topCodes || []).map((c) => ({
      code: c.code,
      files: c.files,
      severity: String(resolveSeverity(c.code, 'BLOCKER')),
    })),
    ...(summary.previne?.codeCounts || []).map((c) => ({
      code: c.code,
      files: c.files,
      severity: c.severity || String(resolveSeverity(c.code, 'MONEY_RISK')),
    })),
  ].filter((c) => c.files > 0);

  if (justFixed) {
    const still = entries.find((e) => e.code === justFixed);
    if (still) return { code: justFixed, same: true, severity: still.severity };
  }

  const sorted = [...entries].sort(compareBySeverityThenCount);
  const next =
    sorted.find((e) => e.severity === 'BLOCKER') ||
    sorted.find((e) => e.severity === 'MONEY_RISK') ||
    sorted[0];
  return next ? { code: next.code, same: false, severity: next.severity } : null;
}


export default function OdontoLotePage() {
  const [batches, setBatches] = useState<BatchListRow[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
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
  const [condutas, setCondutas] = useState('');
  const [focusField, setFocusField] = useState<string>('');

  const loadBatches = useCallback(async () => {
    const list = await api<BatchListRow[]>('/v1/dental/ledi/batches');
    setBatches(list);
  }, []);

  const loadBatch = useCallback(
    async (id: string, opts?: { code?: string }) => {
      const b = await api<Batch>(`/v1/dental/ledi/batches/${id}`);
      setBatch(b);
      const qs = new URLSearchParams();
      if (statusFilter) qs.set('status', statusFilter);
      const effectiveCode = opts?.code !== undefined ? opts.code : codeFilter;
      if (effectiveCode) qs.set('code', effectiveCode);
      if (tipoFilter) qs.set('tipo', tipoFilter);
      if (treatBucket) qs.set('bucket', treatBucket);
      if (q.trim()) qs.set('q', q.trim());
      qs.set('limit', '200');
      const page = await api<{ total: number; items: ItemRow[] }>(
        `/v1/dental/ledi/batches/${id}/items?${qs}`,
      );
      setItems(page.items);
      setItemsTotal(page.total);
      setSelectedIds(new Set(page.items.map((it) => it.id)));
      return b;
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
      const res = await api<Batch & { touched: number; async?: boolean; jobId?: string }>(
        `/v1/dental/ledi/batches/${batch.id}/auto-fix`,
        {
          method: 'POST',
          json: {
            stNaoPossuiCpf: confirmSt,
            stNaoPossuiCpfWhenAbsent: true,
            ine: ineDefault.trim() || undefined,
            problemasCondicoesDefault: hasProb
              ? [{ ciap: bulkCiap.trim() || undefined, cid10: bulkCid.trim() || undefined }]
              : undefined,
          },
        },
      );
      let finalBatch: Batch & { touched?: number } = res;
      let touched = res.touched ?? 0;
      if (isAsyncJobResponse(res)) {
        const job = await waitForJob(res.jobId);
        if (job.status !== 'completed') {
          throw new Error(job.errorMessage || `Job ${job.status}`);
        }
        touched = Number((job.result as { touched?: number } | null)?.touched ?? 0);
        finalBatch = await api<Batch>(`/v1/dental/ledi/batches/${batch.id}`);
      }
      setBatch(finalBatch);
      await advanceAfterFix(
        batch.id,
        confirmSt ? 'ST_NAO_POSSUI_CPF' : hasProb ? 'PROBLEMAS_MISSING' : ineDefault.trim() ? 'INE_MISSING' : undefined,
        `Auto-correção do lote aplicada em ${touched} fichas.`,
      );
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
      justificativa,
      justificativaUnexpected,
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
              : guide.ui === 'justificativa'
                ? 'Selecione a justificativa de não ter CPF no guia antes de aplicar.'
                : guide.ui === 'justificativa_unexpected'
                  ? 'Escolha: remove (tirar justificativa) ou force_st (marcar não possui CPF).'
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
      const res = await api<Batch & { touched: number; async?: boolean; jobId?: string }>(
        `/v1/dental/ledi/batches/${batch.id}/auto-fix`,
        {
          method: 'POST',
          json: body,
        },
      );
      let finalBatch: Batch & { touched?: number } = res;
      let touched = res.touched ?? 0;
      if (isAsyncJobResponse(res)) {
        const job = await waitForJob(res.jobId);
        if (job.status !== 'completed') {
          throw new Error(job.errorMessage || `Job ${job.status}`);
        }
        touched = Number((job.result as { touched?: number } | null)?.touched ?? 0);
        finalBatch = await api<Batch>(`/v1/dental/ledi/batches/${batch.id}`);
      }
      setBatch(finalBatch);
      await advanceAfterFix(
        batch.id,
        repairCode,
        `“${guide.title}”: corrigidas ${touched} ficha(s).`,
      );
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
      setCondutas('');
      const prefer =
        detail.findings.find((f) => f.code === 'JUSTIFICATIVA_CPF_MISSING') ||
        detail.findings.find((f) => f.severity === 'BLOCKER') ||
        detail.findings[0];
      const guide = prefer ? lookupRepair(prefer.code) : undefined;
      setFocusField(guide?.focusField || (guide?.ui === 'justificativa' ? 'justificativa' : ''));
      setFichaModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir ficha');
    }
  }

  function focusIndividualEdit(field?: string) {
    setFocusField(field || 'xml');
    setFichaModalOpen(true);
    window.setTimeout(() => setFocusField(''), 3500);
  }

  function filterByCode(code: string) {
    setCodeFilter((prev) => {
      if (prev === code) {
        setErrorModalOpen(false);
        return '';
      }
      setErrorModalOpen(true);
      return code;
    });
    setSelected(null);
    setFichaModalOpen(false);
    setTreatBucket('');
  }

  function closeErrorModal() {
    setErrorModalOpen(false);
    setCodeFilter('');
  }

  function closeFichaModal() {
    setFichaModalOpen(false);
  }

  /** Após correção: reabre o mesmo erro se ainda houver, senão o próximo vermelho (depois laranja). */
  async function advanceAfterFix(batchId: string, justFixed: string | undefined, baseMsg: string) {
    const fresh = await loadBatch(batchId, { code: '' });
    const next = pickNextPriorityCode(fresh.summary, justFixed);
    if (!next) {
      setCodeFilter('');
      setErrorModalOpen(false);
      setFichaModalOpen(false);
      setOk(`${baseMsg} Sem alertas prioritários restantes — revise o painel e exporte o ZIP.`);
      await loadBatch(batchId, { code: '' });
      return;
    }

    const title = lookupRepair(next.code)?.title || next.code;
    setCodeFilter(next.code);
    setErrorModalOpen(true);
    setFichaModalOpen(false);
    setTreatBucket('');
    await loadBatch(batchId, { code: next.code });

    if (next.same) {
      setOk(`${baseMsg} Ainda há fichas com “${title}” — continue neste guia.`);
    } else if (next.severity === 'BLOCKER') {
      setOk(`${baseMsg} Próximo bloqueio de envio: “${title}”.`);
    } else if (next.severity === 'MONEY_RISK') {
      setOk(`${baseMsg} Bloqueios de envio ok. Agora risco de faturamento: “${title}”.`);
    } else {
      setOk(`${baseMsg} Próximo: “${title}”.`);
    }
  }

  function setFichaForm(patch: Partial<{
    ciap: string;
    cid10: string;
    editIne: string;
    editCbo: string;
    vigilancia: string;
    tipoConsulta: string;
    turno: string;
    gestante: string;
    localAtend: string;
    cnes: string;
    ibge: string;
    justificativa: string;
    justificativaUnexpected: string;
    cpf: string;
    cns: string;
    keepId: string;
    nascimento: string;
    sexo: string;
    profCns: string;
    dataAtend: string;
    horaIni: string;
    horaFim: string;
    condutas: string;
    procExtra: string;
    focusField: string;
  }>) {
    if (patch.ciap !== undefined) setCiap(patch.ciap);
    if (patch.cid10 !== undefined) setCid10(patch.cid10);
    if (patch.editIne !== undefined) setEditIne(patch.editIne);
    if (patch.editCbo !== undefined) setEditCbo(patch.editCbo);
    if (patch.vigilancia !== undefined) setVigilancia(patch.vigilancia);
    if (patch.tipoConsulta !== undefined) setTipoConsulta(patch.tipoConsulta);
    if (patch.turno !== undefined) setTurno(patch.turno);
    if (patch.gestante !== undefined) setGestante(patch.gestante);
    if (patch.localAtend !== undefined) setLocalAtend(patch.localAtend);
    if (patch.cnes !== undefined) setCnes(patch.cnes);
    if (patch.ibge !== undefined) setIbge(patch.ibge);
    if (patch.justificativa !== undefined) setJustificativa(patch.justificativa);
    if (patch.justificativaUnexpected !== undefined) setJustificativaUnexpected(patch.justificativaUnexpected);
    if (patch.cpf !== undefined) setCpf(patch.cpf);
    if (patch.cns !== undefined) setCns(patch.cns);
    if (patch.keepId !== undefined) setKeepId(patch.keepId);
    if (patch.nascimento !== undefined) setNascimento(patch.nascimento);
    if (patch.sexo !== undefined) setSexo(patch.sexo);
    if (patch.profCns !== undefined) setProfCns(patch.profCns);
    if (patch.dataAtend !== undefined) setDataAtend(patch.dataAtend);
    if (patch.horaIni !== undefined) setHoraIni(patch.horaIni);
    if (patch.horaFim !== undefined) setHoraFim(patch.horaFim);
    if (patch.condutas !== undefined) setCondutas(patch.condutas);
    if (patch.procExtra !== undefined) setProcExtra(patch.procExtra);
    if (patch.focusField !== undefined) setFocusField(patch.focusField);
  }

  async function patchSelected(body: Record<string, unknown>, okMsg: string, justFixed?: string) {
    if (!batch || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`, {
        method: 'PATCH',
        json: body,
      });
      setSelected(detail);
      const stillBlocks = detail.findings.some((f) => f.severity === 'BLOCKER');
      if (stillBlocks) {
        setOk(`${okMsg} Ainda há bloqueio nesta ficha — continue no modal.`);
        await loadBatch(batch.id);
        setFichaModalOpen(true);
      } else {
        await advanceAfterFix(batch.id, justFixed, okMsg);
      }
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
    if (guide.mode === 'individual' || guide.mode === 'reexport') {
      focusIndividualEdit(guide.focusField);
      setOk(`Edite a ficha abaixo: ${guide.how}`);
      return;
    }
    if (guide.ui === 'st_cpf') {
      await patchSelected({ stNaoPossuiCpf: true }, `${guide.title} aplicado em ${selected?.fileName}.`, code);
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
      justificativa,
      justificativaUnexpected,
    });
    if (!patch) {
      setError(
        guide.ui === 'ine'
          ? 'Informe o INE no campo da ficha.'
          : guide.ui === 'cnes'
            ? 'Informe CNES com 7 dígitos.'
            : guide.ui === 'justificativa'
              ? 'Selecione a justificativa de não ter CPF.'
              : guide.ui === 'justificativa_unexpected'
                ? 'Escolha: remove ou force_st.'
              : 'Campos incompletos.',
      );
      focusIndividualEdit(guide.focusField || guide.ui);
      return;
    }
    await patchSelected(patch, `${guide.title} aplicado em ${selected?.fileName}.`, code);
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
    if (condutas.trim()) {
      const codes = condutas
        .split(/[,;\s]+/)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (codes.length) body.tiposEncamOdonto = codes;
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
    await patchSelected(body, `Ficha ${selected.fileName} revalidada.`, codeFilter || undefined);
  }

  async function deleteBatch(id: string, name?: string) {
    const label = name || id.slice(0, 8);
    if (!window.confirm(`Excluir a análise “${label}”? Isso apaga o lote e todas as fichas dele.`)) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/v1/dental/ledi/batches/${id}`, { method: 'DELETE' });
      if (batch?.id === id) {
        setBatch(null);
        setItems([]);
        setSelected(null);
        setSelectedIds(new Set());
      }
      setOk(`Análise “${label}” excluída.`);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao excluir');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAllBatches() {
    if (!batches.length) return;
    if (
      !window.confirm(
        `Excluir TODAS as ${batches.length} análises/lotes LEDI? Isso limpa o lixo de testes e não tem volta.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ deleted: number }>('/v1/dental/ledi/batches', { method: 'DELETE' });
      setBatch(null);
      setItems([]);
      setSelected(null);
      setSelectedIds(new Set());
      setOk(`${res.deleted} análise(s) excluída(s).`);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao limpar lotes');
    } finally {
      setBusy(false);
    }
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
        description="Clique no erro → guia em modal → corrija em lote ou abra a ficha. Fluxo simples até ficar pronta para o governo."
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
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>Análises salvas</strong>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                style={{ color: 'var(--danger)' }}
                onClick={() => void deleteAllBatches()}
              >
                Limpar todas ({batches.length})
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {batches.map((b) => (
                <div key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <button
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
                  <button
                    type="button"
                    className="btn btn-ghost"
                    title="Excluir esta análise"
                    disabled={busy}
                    style={{ color: 'var(--danger)', padding: '4px 8px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteBatch(b.id, b.name);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
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

            <div
              className="lote-funnel-legend"
              style={{
                marginTop: 10,
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 8,
                border: '1px solid var(--line)',
                background: 'var(--surface-2)',
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              <strong style={{ display: 'block', marginBottom: 8 }}>O que significam estes números</strong>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li>
                  <strong>Total fichas</strong> — quantidade de XMLs neste lote (cada arquivo = uma ficha
                  odontológica).
                </li>
                <li>
                  <strong>Prontas Siaps</strong> — fichas <em>sem bloqueio de envio</em> (zero BLOCKER LEDI).
                  Podem ir para o Siaps/SISAB. Não garante qualidade de indicador.
                </li>
                <li>
                  <strong>Prontas Previne</strong> — fichas sem risco de dinheiro/indicador Previne ESB
                  (B1–B6 / INE / vigilância etc.). Aceitas no Siaps ainda podem ficar fora desta conta.
                </li>
                <li>
                  <strong>Envio final OK</strong> — interseção: Siaps-ready <em>e</em> Previne-ready. É o
                  alvo ideal antes de baixar o ZIP “conformes” para o governo.
                </li>
              </ul>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
                Ex.: 90% Siaps e 21% envio final = a maior parte já envia, mas ainda falta qualidade Previne
                (ou ambos) em muitas fichas. Trate vermelho → laranja → verde.
              </p>
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

            {codeFilter ? (
              <div className="lote-toolbar" style={{ marginTop: 14 }}>
                <span>
                  Filtro ativo:{' '}
                  <strong>{activeRepair?.title || codeFilter}</strong>
                </span>
                <button type="button" className="btn btn-primary" onClick={() => setErrorModalOpen(true)}>
                  Abrir guia do erro
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeErrorModal}>
                  Limpar filtro
                </button>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 14, fontSize: 13 }}>
                Clique numa barra de erro acima para abrir o <strong>guia em modal</strong> com correção em lote ou
                lista de fichas.
              </p>
            )}

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
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      const dry = await api<{
                        wouldTouch: number;
                        before: { withBlockers: number; siapsReady: number };
                        after: { withBlockers: number; siapsReady: number };
                        codeDelta: Array<{ code: string; before: number; after: number; delta: number }>;
                      }>(`/v1/dental/ledi/batches/${batch.id}/dry-run`, {
                        method: 'POST',
                        json: { stNaoPossuiCpf: true },
                      });
                      const top = dry.codeDelta
                        .slice(0, 5)
                        .map((d) => `${d.code}: ${d.before}→${d.after}`)
                        .join(' · ');
                      setOk(
                        `Dry-run: tocariam ${dry.wouldTouch} fichas · blockers ${dry.before.withBlockers}→${dry.after.withBlockers} · Siaps ${dry.before.siapsReady}→${dry.after.siapsReady}${top ? ` · ${top}` : ''}`,
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Falha no dry-run');
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Dry-run (simular auto)
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  void downloadClosureReport(batch.id).catch((e) =>
                    setError(e instanceof Error ? e.message : String(e)),
                  )
                }
              >
                Relatório fechamento (.md)
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                style={{ color: 'var(--danger)' }}
                onClick={() => void deleteBatch(batch.id, batch.name)}
              >
                Excluir esta análise
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              <div className="field">
                <label>Código da equipe (INE)</label>
                <input
                  value={ineDefault}
                  onChange={(e) => setIneDefault(e.target.value)}
                  placeholder="0002165929"
                />
              </div>
              <CodeSearchSelect
                kind="ciap"
                label="Problema/diagnóstico (CIAP)"
                value={bulkCiap}
                onChange={setBulkCiap}
                placeholder="Buscar CIAP…"
              />
              <CodeSearchSelect
                kind="cid10"
                label="Diagnóstico (CID-10)"
                value={bulkCid}
                onChange={setBulkCid}
                placeholder="Buscar CID-10…"
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Aplicar no lote inteiro e revalidar
            </button>
          </form>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>4. Fichas do lote</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Clique numa ficha para abrir o <strong>modal de correção</strong>. Ou clique num erro no gráfico
              acima para o guia completo (lote ou ficha a ficha).
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
            </div>
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
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
                        background: selected?.id === it.id && fichaModalOpen ? 'var(--ok-bg)' : undefined,
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

          {activeRepair && codeFilter ? (
            <ErrorGuideModal
              open={errorModalOpen}
              code={codeFilter}
              repair={activeRepair}
              affected={items}
              affectedTotal={itemsTotal || items.length}
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
                justificativa,
                justificativaUnexpected,
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
                else if (key === 'justificativa') setJustificativa(value);
                else if (key === 'justificativaUnexpected') setJustificativaUnexpected(value);
              }}
              onClose={closeErrorModal}
              onFixAllAffected={() => void applySelectedRepair(codeFilter, { allAffected: true })}
              onOpenFicha={(id) => void openItem(id)}
            />
          ) : null}

          <FichaFixModal
            open={fichaModalOpen && !!selected}
            selected={selected}
            busy={busy}
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
            onClose={closeFichaModal}
            onSave={saveItem}
            onApplyGap={(code) => void applyGapRepair(code)}
            onFocusField={focusIndividualEdit}
          />

        </>
      ) : null}
    </AppShell>
  );
}
