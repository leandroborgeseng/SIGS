'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, getToken } from '@/lib/api';
import { isAsyncJobResponse, waitForJob } from '@/lib/jobs';
import { uploadLediBatchMultipart } from '@/lib/ledi-batch-upload';
import { formatUploadError, isIoReadError } from '@/lib/format-upload-error';
import { FileDropZone } from '@/components/ui/FileDropZone';
import {
  explainError,
  resolveSeverity,
  severityLabel,
  severityRank,
} from '@/app/faturamento/lote/fao/error-catalog';
import { TreatmentDashboard, type TreatBucket } from '@/app/faturamento/lote/fao/TreatmentDashboard';
import type { TreatmentProgress } from '@/app/faturamento/lote/fao/treatment-types';
import { ErrorGuideModal } from '@/app/faturamento/lote/fao/ErrorGuideModal';
import { FichaFixModal } from '@/app/faturamento/lote/fao/FichaFixModal';
import { LoteQualityPanel } from '@/app/faturamento/lote/fao/LoteQualityPanel';
import { baselineFromTreatment } from '@/app/faturamento/lote/fao/ModalQualityMiniDash';
import {
  bodyForRepairUi,
  lookupRepair,
} from '@/app/faturamento/lote/fao/repair-catalog';

type LoteTipo = 'FAI' | 'PROCEDIMENTOS';
type ExportAction = 'zip-current' | 'zip-conformant' | 'dry-run' | 'closure';

type BatchSummary = {
  total: number;
  conformant: number;
  withBlockers: number;
  withWarn: number;
  autoFixableItems: number;
  siapsReady?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  expectedTipo?: string;
  topCodes: Array<{ code: string; files: number; pct: number }>;
  treatment?: TreatmentProgress;
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
    variant: 'fai' | 'proc';
    acceptHint: string;
  }
> = {
  FAI: {
    title: 'Lote LEDI FAI',
    help: 'Atendimento Individual (tipo 4). Clique no alerta → guia → corrija em lote ou na ficha; exporte ZIP quando houver prontas Siaps.',
    label: 'FAI',
    helpId: 'faturamento.lote-fai',
    fileSlug: 'fai',
    siblingHref: '/faturamento/lote/proc',
    siblingLabel: 'Lote Procedimentos',
    variant: 'fai',
    acceptHint: 'FAI tipo 4',
  },
  PROCEDIMENTOS: {
    title: 'Lote LEDI Procedimentos',
    help: 'Ficha de Procedimentos (tipo 7). Prioridade: CPF/CNS, turno, CNES; ABPG → SIGTAP na ficha. Export ZIP igual ao FAO.',
    label: 'Procedimentos',
    helpId: 'faturamento.lote-proc',
    fileSlug: 'proc',
    siblingHref: '/faturamento/lote/fai',
    siblingLabel: 'Lote FAI',
    variant: 'proc',
    acceptHint: 'PROC tipo 7',
  },
};

async function downloadZip(
  batchId: string,
  mode: 'current' | 'conformant',
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
  a.download = `ledi-${fileSlug}-lote-${batchId.slice(0, 8)}${mode === 'conformant' ? '-conformes' : ''}.zip`;
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
  const [treatBucket, setTreatBucket] = useState<TreatBucket>('');
  const [codeFilter, setCodeFilter] = useState('');
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const anyBusy = busy || exportAction !== null;
  const exportBusy = exportAction !== null;

  const [editIne, setEditIne] = useState('');
  const [editCbo, setEditCbo] = useState('223208');
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
  const [focusField, setFocusField] = useState('');

  const activeRepair = useMemo(
    () => (codeFilter ? lookupRepair(codeFilter) : undefined),
    [codeFilter],
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
      const page = await api<{ total: number; items: ItemRow[] }>(
        `/v1/dental/ledi/batches/${id}/items?${qs}`,
      );
      setItems(page.items);
      setItemsTotal(page.total);
    },
    [treatBucket],
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
    if (!batch?.id) return;
    void loadItems(batch.id, codeFilter || undefined).catch((e) =>
      setError(e instanceof Error ? e.message : 'Falha'),
    );
  }, [batch?.id, codeFilter, treatBucket, loadItems]);

  async function onUpload(files: FileList | File[] | null) {
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
      const { batch: created, uploaded, failedNames } = await uploadLediBatchMultipart<Batch>({
        files: list,
        name: batchName.trim() || `${meta.label} ${new Date().toLocaleString('pt-BR')}`,
        expectedTipo,
        onProgress: setUploadProgress,
      });
      setBatch(created);
      setCodeFilter('');
      setUploadIoFailed(false);
      const failNote = failedNames.length
        ? ` · ${failedNames.length} não lidos (ex.: ${failedNames[0]})`
        : '';
      setOk(
        `Lote ${meta.label}: ${uploaded} enviadas · ${created.summary.withBlockers} com blocker · ${created.summary.conformant} conformes.${failNote}`,
      );
      await loadBatches();
      await loadBatch(created.id);
    } catch (err) {
      setUploadIoFailed(isIoReadError(err));
      setError(formatUploadError(err));
    } finally {
      setBusy(false);
      setUploadProgress('');
    }
  }

  async function advanceAfterFix(batchId: string, justFixed: string | undefined, baseMsg: string) {
    const b = await api<Batch>(`/v1/dental/ledi/batches/${batchId}`);
    setBatch(b);
    const next = (b.summary.topCodes || []).find((c) => c.code !== justFixed && c.files > 0);
    if (next) {
      setCodeFilter(next.code);
      setErrorModalOpen(true);
      setOk(`${baseMsg} Próximo: ${lookupRepair(next.code)?.title || next.code} (${next.files}).`);
    } else {
      setCodeFilter('');
      setErrorModalOpen(false);
      setOk(`${baseMsg} Sem próximos alertas no topo do lote.`);
    }
    await loadItems(batchId, next?.code);
  }

  async function applySelectedRepair(code?: string) {
    if (!batch) return;
    const repairCode = code || codeFilter;
    const guide = repairCode ? lookupRepair(repairCode) : undefined;
    if (!guide || guide.mode !== 'auto') {
      setError('Este alerta não tem auto-correção em lote — abra a ficha ou reexporte.');
      return;
    }

    const ids = items.map((it) => it.id);
    if (!ids.length) {
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

    let body: Record<string, unknown> = {
      forceSelected: false,
      onlyItemIds: ids,
      stNaoPossuiCpf: false,
    };

    if (guide.ui === 'st_cpf' || !guide.ui || guide.ui === 'manual') {
      body = {
        onlyItemIds: ids,
        stNaoPossuiCpf: guide.ui === 'st_cpf' || repairCode === 'ST_NAO_POSSUI_CPF',
        forceSelected: false,
      };
      if (editIne.trim()) body.ine = editIne.trim();
    } else {
      const patch = bodyForRepairUi(guide.ui, fields);
      if (!patch) {
        setError(
          guide.ui === 'ine'
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
      const res = await api<Batch & { touched: number; async?: boolean; jobId?: string }>(
        `/v1/dental/ledi/batches/${batch.id}/auto-fix`,
        { method: 'POST', json: body },
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
    setEditCbo('223208');
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
    setFocusField('');
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
        setBatch(null);
        setItems([]);
        setSelected(null);
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
  const readyFinal = batch?.summary.readyForFinalSend ?? 0;
  const withBlockers = batch?.summary.withBlockers ?? 0;
  const totalFichas = batch?.summary.total ?? 0;

  return (
    <AppShell helpId={meta.helpId}>
      <PageHeader
        title={meta.title}
        eyebrow="Raio-x · correção · export"
        description={meta.help}
        actions={
          <>
            <HelpLink id={meta.helpId} />
            <Link className="btn btn-secondary" href="/faturamento">
              Hub faturamento
            </Link>
            <Link className="btn btn-secondary" href="/faturamento/lote/fao">
              Lote FAO
            </Link>
            <Link className="btn btn-secondary" href={meta.siblingHref}>
              {meta.siblingLabel}
            </Link>
          </>
        }
      />
      {error ? <ErrorBox message={error} /> : null}
      {ok ? <div className="alert ok">{ok}</div> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>1. Enviar XMLs {meta.label}</h3>
        <p className="muted">
          Para pastas grandes: no Finder, clique direito → <strong>Comprimir</strong> e envie o .zip
          (preferível a partir do Desktop).
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
        {uploadProgress ? <p className="muted">{uploadProgress}</p> : null}
      </div>

      {batches.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Lotes recentes ({meta.label})</h3>
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
                    void loadBatch(b.id).then(() => setBatch(b as Batch));
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
        </div>
      ) : null}

      {batch ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>2. Resumo — {batch.name}</h3>

            <LoteQualityPanel
              total={batch.summary.total}
              siapsReady={batch.summary.siapsReady}
              previneReady={batch.summary.previneReady}
              readyForFinalSend={batch.summary.readyForFinalSend}
              fichaLabel={expectedTipo === 'FAI' ? 'ficha individual' : 'ficha de procedimentos'}
            />

            <TreatmentDashboard
              treatment={batch.summary.treatment}
              readyForFinalSend={batch.summary.readyForFinalSend}
              activeBucket={treatBucket}
              onFilterBucket={setTreatBucket}
            />

            <h4 style={{ marginBottom: 8 }}>Alertas (clique para o guia)</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(batch.summary.topCodes || [])
                .map((c) => ({
                  ...c,
                  severity: resolveSeverity(c.code, 'BLOCKER'),
                }))
                .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.files - a.files)
                .slice(0, 12)
                .map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className={`lote-bar-row ${codeFilter === c.code ? 'active' : ''}`}
                    onClick={() => openGuide(c.code)}
                    style={{ textAlign: 'left' }}
                  >
                    <span className={`lote-sev ${c.severity}`}>{severityLabel(c.severity)}</span>{' '}
                    {explainError(c.code)?.title || c.code} · {c.files} ficha(s)
                  </button>
                ))}
            </div>

            {codeFilter ? (
              <p style={{ marginTop: 12 }}>
                Filtro: <strong>{activeRepair?.title || codeFilter}</strong>{' '}
                <button type="button" className="btn btn-ghost" onClick={() => setCodeFilter('')}>
                  Limpar
                </button>
              </p>
            ) : null}

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
              <h4 style={{ margin: '0 0 6px' }}>Exportar / baixar ZIP</h4>
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                {readyFinal > 0 ? (
                  <>
                    <strong>{readyFinal}</strong> ficha(s) com envio final OK — use o ZIP só conformes para
                    fechar o lote {meta.label}.
                  </>
                ) : siapsReady > 0 ? (
                  <>
                    <strong>{siapsReady}</strong> pronta(s) Siaps
                    {withBlockers > 0 ? (
                      <>
                        {' '}
                        · ainda <strong>{withBlockers}</strong> com bloqueio
                      </>
                    ) : null}
                    . O ZIP conformes exclui as com BLOCKER; o ZIP atuais inclui tudo (corrigido + pendente).
                  </>
                ) : withBlockers > 0 ? (
                  <>
                    Ainda há <strong>{withBlockers}</strong> ficha(s) bloqueando envio. Corrija os vermelhos
                    antes de exportar — ou baixe o ZIP atuais só para conferência.
                  </>
                ) : (
                  <>
                    Quando houver fichas prontas, baixe o ZIP só conformes (recomendado) ou o ZIP com todas as
                    fichas atuais. Mesmos endpoints do lote FAO.
                  </>
                )}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={anyBusy || siapsReady < 1}
                  title={
                    siapsReady < 1
                      ? 'Nenhuma ficha pronta Siaps ainda'
                      : 'ZIP só com fichas sem BLOCKER (recomendado para envio)'
                  }
                  onClick={() =>
                    void runExport(
                      'zip-conformant',
                      () => downloadZip(batch.id, 'conformant', meta.fileSlug),
                      `ZIP só conformes baixado (${siapsReady} pronta(s) Siaps · ${readyFinal} envio final OK).`,
                    )
                  }
                >
                  {exportAction === 'zip-conformant' ? 'Gerando ZIP…' : 'Baixar ZIP só conformes'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
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
                  {exportAction === 'zip-current' ? 'Gerando ZIP…' : 'Baixar ZIP (todas as atuais)'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={anyBusy}
                  onClick={() => {
                    void runExport('dry-run', async () => {
                      const dry = await api<{
                        wouldTouch: number;
                        before: { withBlockers: number; siapsReady: number };
                        after: { withBlockers: number; siapsReady: number };
                        codeDelta?: Array<{
                          code: string;
                          before: number;
                          after: number;
                          delta: number;
                        }>;
                      }>(`/v1/dental/ledi/batches/${batch.id}/dry-run`, {
                        method: 'POST',
                        json: { stNaoPossuiCpf: true },
                      });
                      const top = (dry.codeDelta || [])
                        .slice(0, 5)
                        .map((d) => `${d.code}: ${d.before}→${d.after}`)
                        .join(' · ');
                      return `Dry-run: tocariam ${dry.wouldTouch} fichas · blockers ${dry.before.withBlockers}→${dry.after.withBlockers} · Siaps ${dry.before.siapsReady}→${dry.after.siapsReady}${top ? ` · ${top}` : ''}`;
                    });
                  }}
                >
                  {exportAction === 'dry-run' ? 'Simulando…' : 'Dry-run (simular auto)'}
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

          <div className="card">
            <h3 style={{ marginTop: 0 }}>
              3. Fichas {codeFilter ? `(${itemsTotal} com este alerta)` : `(${itemsTotal})`}
            </h3>
            <div style={{ maxHeight: 480, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th align="left">Arquivo</th>
                    <th>Siaps</th>
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
                      <td align="center">{it.siapsReady ? 'ok' : 'falha'}</td>
                      <td style={{ fontSize: 12 }}>
                        {it.topCodes
                          .slice(0, 4)
                          .map((c) => explainError(c)?.title || c)
                          .join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
          }}
          onClose={() => setErrorModalOpen(false)}
          onFixAllAffected={() => void applySelectedRepair(codeFilter)}
          onOpenFicha={(id) => void openItem(id)}
          lotQuality={lotQuality}
          lotQualityBaseline={lotQualityBaseline}
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
          vigilancia: '',
          tipoConsulta: '',
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
          condutas: '',
          procExtra,
          focusField,
        }}
        setForm={setFichaForm}
        onClose={() => setFichaModalOpen(false)}
        onSave={(e) => void saveItem(e)}
        onApplyGap={(code) => {
          openGuide(code);
          setFichaModalOpen(false);
        }}
        onFocusField={(field) => setFocusField(field || '')}
      />
    </AppShell>
  );
}
