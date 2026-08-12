'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError, getToken } from '@/lib/api';

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
    indicators: Array<{ id: string; title: string; status: string; note?: string }>;
  };
};

/** Catálogo UI: alerta → como corrigir na tela. */
type AlertRepair = {
  where: string;
  how: string;
  ui?: 'ine' | 'ciap' | 'cbo' | 'proc_b1' | 'proc_prev' | 'proc_art' | 'encam_15' | 'vigilancia' | 'lote' | 'manual';
  button?: string;
};

const PREVINE_REPAIR: Record<string, AlertRepair> = {
  PREVINE_INE_MISSING: {
    where: 'Lote (INE padrão) ou ficha → INE',
    how: 'Informe o INE da eSB e salve / aplique auto-correção.',
    ui: 'ine',
    button: 'Preencher INE desta ficha',
  },
  PREVINE_CBO_NOT_ESB: {
    where: 'Ficha → CBO',
    how: 'Troque para CBO odonto elegível (ex.: 223208 dentista ESF).',
    ui: 'cbo',
    button: 'Aplicar CBO 223208',
  },
  PREVINE_PROBLEMAS_MISSING: {
    where: 'Lote (CIAP padrão) ou ficha → CIAP/CID',
    how: 'Inclua CIAP (ex. D82) ou CID-10 clínico real.',
    ui: 'ciap',
    button: 'Incluir CIAP D82',
  },
  PREVINE_VIGILANCIA_99: {
    where: 'Ficha → vigilância',
    how: 'Troque 99 por código específico (ex.: 1 cárie, 3 periodontal).',
    ui: 'vigilancia',
    button: 'Trocar vigilância p/ 1+3',
  },
  PREVINE_B1_NO_FIRST_CONSULTA: {
    where: 'Ficha → procedimento B1',
    how: 'Se for 1ª consulta programada, acrescente SIGTAP 0301010153.',
    ui: 'proc_b1',
    button: 'Acrescentar 1ª consulta (0301010153)',
  },
  PREVINE_B2_NO_CONCLUSAO: {
    where: 'Ficha → conduta 15',
    how: 'Ao concluir o plano, registre tiposEncamOdonto=15 (+ consulta 1 ou 2).',
    ui: 'encam_15',
    button: 'Marcar tratamento concluído (15)',
  },
  PREVINE_B2_NO_PAIR: {
    where: 'Ficha',
    how: 'B2 precisa do par 1ª consulta + conclusão na janela — use os botões B1 e conduta 15 se cabível.',
    ui: 'manual',
  },
  PREVINE_B3_HIGH_EXODONTIA: {
    where: 'Produção / registro',
    how: 'Revise se preventivos/curativos estão sendo faturados; alta exodontia piora B3 no período.',
    ui: 'manual',
  },
  PREVINE_B3_LOW_EXODONTIA_SHARE: {
    where: 'Informativo',
    how: 'Faixa local abaixo do ótimo B3 — ajuste só se o mix clínico exigir.',
    ui: 'manual',
  },
  PREVINE_B3_NO_EXODONTIA: {
    where: 'Informativo',
    how: 'Sem exodontia neste XML — ok se o perfil for preventivo.',
    ui: 'manual',
  },
  PREVINE_B5_NO_PREVENTIVE: {
    where: 'Ficha → preventivo',
    how: 'Acrescente preventivo elegível (ex. orientação higiene 0101020104).',
    ui: 'proc_prev',
    button: 'Acrescentar preventivo (0101020104)',
  },
  PREVINE_B5_LOW_PREVENTIVE: {
    where: 'Ficha → preventivo',
    how: 'Aumente registro de preventivos vs só curativos.',
    ui: 'proc_prev',
    button: 'Acrescentar preventivo (0101020104)',
  },
  PREVINE_B5_HIGH_PREVENTIVE: {
    where: 'Informativo',
    how: '>85% preventivo também é Regular no B5 — equilíbrio clínico.',
    ui: 'manual',
  },
  PREVINE_B5_NO_PROCS: {
    where: 'Ficha / origem',
    how: 'Confira coMsProcedimento SIGTAP no XML de origem.',
    ui: 'manual',
  },
  PREVINE_B6_NO_ART: {
    where: 'Ficha → ART',
    how: 'Quando aplicável, registre TRA/ART 0307010074.',
    ui: 'proc_art',
    button: 'Acrescentar ART (0307010074)',
  },
  PREVINE_B6_NO_RESTORATIVE: {
    where: 'Informativo',
    how: 'B6 não se aplica sem restauração neste atendimento.',
    ui: 'manual',
  },
};

const LEDI_REPAIR: Record<string, AlertRepair> = {
  ST_NAO_POSSUI_CPF: {
    where: 'Lote → auto-correção',
    how: 'Marque stNaoPossuiCpf e aplique (false quando há CNS/CPF).',
    ui: 'lote',
  },
  INE_MISSING: {
    where: 'Lote (INE padrão) ou ficha',
    how: 'Preencha INE da eSB e revalide.',
    ui: 'ine',
    button: 'Preencher INE desta ficha',
  },
  PROBLEMAS_MISSING: {
    where: 'Lote (CIAP) ou ficha',
    how: 'Inclua CIAP/CID no atendimento.',
    ui: 'ciap',
    button: 'Incluir CIAP D82',
  },
  PROBLEMA_SEM_CODIGO: {
    where: 'Ficha → CIAP/CID',
    how: 'Informe CIAP ou CID-10 válido.',
    ui: 'ciap',
    button: 'Incluir CIAP D82',
  },
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

export default function OdontoLotePage() {
  const [batches, setBatches] = useState<BatchListRow[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [batchName, setBatchName] = useState('');
  const [confirmSt, setConfirmSt] = useState(true);
  const [ineDefault, setIneDefault] = useState('');
  const [bulkCiap, setBulkCiap] = useState('');
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

  const loadBatch = useCallback(async (id: string) => {
    const b = await api<Batch>(`/v1/dental/ledi/batches/${id}`);
    setBatch(b);
    const qs = new URLSearchParams();
    if (statusFilter) qs.set('status', statusFilter);
    if (q.trim()) qs.set('q', q.trim());
    qs.set('limit', '150');
    const page = await api<{ total: number; items: ItemRow[] }>(
      `/v1/dental/ledi/batches/${id}/items?${qs}`,
    );
    setItems(page.items);
    setItemsTotal(page.total);
  }, [statusFilter, q]);

  useEffect(() => {
    void loadBatches().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [loadBatches]);

  useEffect(() => {
    if (!batch?.id) return;
    void loadBatch(batch.id).catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [batch?.id, loadBatch]);

  const autoFixHint = useMemo(() => {
    if (!batch?.summary?.topCodes) return null;
    const st = batch.summary.topCodes.find((c) => c.code === 'ST_NAO_POSSUI_CPF');
    const ine = batch.summary.topCodes.find((c) => c.code === 'INE_MISSING');
    return { st, ine };
  }, [batch]);

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

  async function applyAutoFix(e: FormEvent) {
    e.preventDefault();
    if (!batch) return;
    const hasProb = !!(bulkCiap.trim() || bulkCid.trim());
    if (!confirmSt && !ineDefault.trim() && !hasProb) {
      setError('Marque ao menos uma correção (stNaoPossuiCpf, INE ou CIAP/CID em lote).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<Batch & { touched: number }>(
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
      setBatch(res);
      setOk(`Auto-correção aplicada em ${res.touched} fichas. Revalide a lista.`);
      await loadBatch(batch.id);
      if (selected) {
        const detail = await api<ItemDetail>(
          `/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`,
        );
        setSelected(detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na auto-correção');
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
      const detail = await api<ItemDetail>(
        `/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`,
        { method: 'PATCH', json: body },
      );
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
    const guide = PREVINE_REPAIR[code] || LEDI_REPAIR[code];
    if (!guide?.ui || guide.ui === 'manual' || guide.ui === 'lote') {
      setError(
        guide?.ui === 'lote'
          ? 'Use a seção 3 (correções automáticas do lote) para este alerta.'
          : 'Este alerta exige julgamento clínico / origem — sem botão automático.',
      );
      return;
    }
    if (guide.ui === 'ine') {
      const ine = editIne.trim() || ineDefault.trim();
      if (!ine) {
        setError('Informe o INE no campo da ficha (ou INE padrão do lote) antes de aplicar.');
        return;
      }
      await patchSelected({ ine }, `INE ${ine} aplicado em ${selected?.fileName}.`);
      return;
    }
    if (guide.ui === 'ciap') {
      await patchSelected(
        { problemasCondicoes: [{ ciap: ciap.trim() || 'D82', cid10: cid10.trim() || undefined }] },
        `CIAP/CID aplicado em ${selected?.fileName}.`,
      );
      return;
    }
    if (guide.ui === 'cbo') {
      await patchSelected(
        { cboCodigo_2002: editCbo.trim() || '223208' },
        `CBO atualizado em ${selected?.fileName}.`,
      );
      return;
    }
    if (guide.ui === 'proc_b1') {
      await patchSelected(
        { procedimentosAdd: [{ coMsProcedimento: '0301010153', quantidade: 1 }] },
        `1ª consulta programada acrescentada em ${selected?.fileName}.`,
      );
      return;
    }
    if (guide.ui === 'proc_prev') {
      await patchSelected(
        { procedimentosAdd: [{ coMsProcedimento: '0101020104', quantidade: 1 }] },
        `Preventivo 0101020104 acrescentado em ${selected?.fileName}.`,
      );
      return;
    }
    if (guide.ui === 'proc_art') {
      await patchSelected(
        { procedimentosAdd: [{ coMsProcedimento: '0307010074', quantidade: 1 }] },
        `ART 0307010074 acrescentado em ${selected?.fileName}.`,
      );
      return;
    }
    if (guide.ui === 'encam_15') {
      await patchSelected(
        {
          tiposEncamOdontoAdd: [15],
          tiposConsultaOdonto: [Number(tipoConsulta) || 1],
        },
        `Conduta 15 (tratamento concluído) em ${selected?.fileName}.`,
      );
      return;
    }
    if (guide.ui === 'vigilancia') {
      const codes = vigilancia
        .split(/[,;\s]+/)
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!codes.length) {
        setError('Informe códigos de vigilância (ex.: 1,3).');
        return;
      }
      await patchSelected(
        { tiposVigilanciaSaudeBucal: codes },
        `Vigilância atualizada em ${selected?.fileName}.`,
      );
    }
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!batch || !selected) return;
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
      setError('Informe ao menos um campo de correção para salvar.');
      return;
    }
    await patchSelected(body, `Ficha ${selected.fileName} revalidada.`);
  }

  return (
    <AppShell helpId="odonto.lote-ledi">
      <PageHeader
        title="Lote LEDI FAO"
        eyebrow="Odontologia · Siaps/RNDS"
        description="Raio-x do lote: erros de envio Siaps/LEDI + oportunidades Previne (B1–B6) antes do XML final."
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
        <p className="muted" style={{ marginBottom: 0 }}>
          Os arquivos ficam só no servidor SIGS (não vão à RNDS). Evite versionar XMLs com CNS reais.
        </p>
      </div>

      {batches.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Lotes recentes</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {batches.map((b) => (
              <button
                key={b.id}
                type="button"
                className={`btn ${batch?.id === b.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setBatch(b as Batch)}
              >
                {b.name} ({b.itemCount})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {batch ? (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>2. Resumo — {batch.name}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 12 }}>
              <div>
                <div className="muted">Total</div>
                <strong>{batch.summary.total}</strong>
              </div>
              <div>
                <div className="muted">Prontos Siaps</div>
                <strong>{batch.summary.siapsReady ?? '—'}</strong>
              </div>
              <div>
                <div className="muted">Prontos Previne</div>
                <strong>{batch.summary.previneReady ?? '—'}</strong>
              </div>
              <div>
                <div className="muted">Envio final OK</div>
                <strong>{batch.summary.readyForFinalSend ?? '—'}</strong>
              </div>
              <div>
                <div className="muted">Com blocker LEDI</div>
                <strong>{batch.summary.withBlockers}</strong>
              </div>
            </div>
            {batch.summary.topCodes?.length ? (
              <>
                <h4 style={{ marginBottom: 8 }}>Erros / avisos de envio (LEDI) — como corrigir</h4>
                <table style={{ width: '100%', marginTop: 4, fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th align="left">Código</th>
                      <th align="right">Fichas</th>
                      <th align="left">Onde / como na interface</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batch.summary.topCodes.map((c) => {
                      const g = LEDI_REPAIR[c.code];
                      return (
                        <tr key={c.code}>
                          <td>
                            <code>{c.code}</code>
                          </td>
                          <td align="right">
                            {c.files} ({c.pct}%)
                          </td>
                          <td>
                            {g ? (
                              <>
                                <strong>{g.where}</strong>
                                <div className="muted">{g.how}</div>
                              </>
                            ) : (
                              <span className="muted">Abra a ficha e veja a crítica LEDI + hint.</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </>
            ) : null}

            {batch.summary.previne ? (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ marginBottom: 8 }}>Raio-x Previne ESB (qualidade / indicadores)</h4>
                <p className="muted" style={{ marginTop: 0 }}>
                  O que o lote deixa de enviar para pontuar B1–B6 — independente do aceite Siaps.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div className="muted">c/ 1ª consulta</div>
                    <strong>{batch.summary.previne.signalRates.withFirstConsulta}</strong>
                  </div>
                  <div>
                    <div className="muted">c/ conclusão</div>
                    <strong>{batch.summary.previne.signalRates.withConclusao}</strong>
                  </div>
                  <div>
                    <div className="muted">c/ preventivo</div>
                    <strong>{batch.summary.previne.signalRates.withPreventive}</strong>
                  </div>
                  <div>
                    <div className="muted">c/ ART</div>
                    <strong>{batch.summary.previne.signalRates.withArt}</strong>
                  </div>
                  <div>
                    <div className="muted">c/ INE</div>
                    <strong>{batch.summary.previne.signalRates.withIne}</strong>
                  </div>
                  <div>
                    <div className="muted">só vigilância 99</div>
                    <strong>{batch.summary.previne.signalRates.vigilancia99}</strong>
                  </div>
                </div>
                {batch.summary.previne.indicatorGaps?.length ? (
                  <table style={{ width: '100%', fontSize: 13, marginBottom: 12 }}>
                    <thead>
                      <tr>
                        <th align="left">Indicador</th>
                        <th align="right">Fichas c/ gap</th>
                        <th align="right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.summary.previne.indicatorGaps.map((g) => (
                        <tr key={g.id}>
                          <td>
                            <code>{g.id}</code>
                          </td>
                          <td align="right">{g.filesWithGap}</td>
                          <td align="right">{g.pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                {batch.summary.previne.codeCounts?.length ? (
                  <table style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th align="left">Gap</th>
                        <th>Ind.</th>
                        <th>Sev</th>
                        <th align="right">Fichas</th>
                        <th align="left">Como corrigir na UI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batch.summary.previne.codeCounts.slice(0, 16).map((c) => {
                        const g = PREVINE_REPAIR[c.code];
                        return (
                          <tr key={c.code}>
                            <td>
                              <code>{c.code}</code>
                            </td>
                            <td align="center">{c.indicator}</td>
                            <td align="center">{c.severity}</td>
                            <td align="right">{c.files}</td>
                            <td>
                              {g ? (
                                <>
                                  <strong>{g.where}</strong>
                                  <div className="muted">{g.how}</div>
                                </>
                              ) : (
                                <span className="muted">Abra a ficha e use o botão do alerta.</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
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
                Baixar ZIP (todos corrigidos/atuais)
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

          <form className="card" style={{ marginBottom: 16 }} onSubmit={applyAutoFix}>
            <h3 style={{ marginTop: 0 }}>3. Correções automáticas (com confirmação)</h3>
            {autoFixHint?.st ? (
              <p>
                <code>ST_NAO_POSSUI_CPF</code> em {autoFixHint.st.files} fichas — o sistema pode inserir{' '}
                <code>false</code> quando há CNS/CPF.
              </p>
            ) : (
              <p className="muted">Nenhuma ficha pendente de stNaoPossuiCpf neste lote.</p>
            )}
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={confirmSt} onChange={(e) => setConfirmSt(e.target.checked)} />
              Aplicar <code>stNaoPossuiCpf</code> automaticamente
            </label>
            <div className="field">
              <label>
                INE padrão (opcional — para {autoFixHint?.ine?.files ?? 0} fichas com INE_MISSING)
              </label>
              <input
                value={ineDefault}
                onChange={(e) => setIneDefault(e.target.value)}
                placeholder="Ex.: 0002165929"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="field">
                <label>CIAP padrão em lote (PROBLEMAS_MISSING)</label>
                <input
                  value={bulkCiap}
                  onChange={(e) => setBulkCiap(e.target.value)}
                  placeholder="Ex.: D82 — só se fizer sentido clínico"
                />
              </div>
              <div className="field">
                <label>CID-10 padrão em lote (opcional)</label>
                <input value={bulkCid} onChange={(e) => setBulkCid(e.target.value)} placeholder="K02.1" />
              </div>
            </div>
            <p className="muted">
              CIAP/CID em lote é opcional e exige confirmação explícita — use só quando o código for o mesmo
              para o conjunto; senão edite ficha a ficha abaixo.
            </p>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Aplicar correções confirmadas e revalidar
            </button>
          </form>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>4. Fichas com inconsistência</h3>
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
                style={{ minWidth: 220 }}
              />
              <button type="button" className="btn btn-secondary" onClick={() => batch && void loadBatch(batch.id)}>
                Filtrar
              </button>
            </div>
            <p className="muted">
              Mostrando {items.length} de {itemsTotal}. Clique para editar o que a auto-correção não resolve
              (ex.: PROBLEMAS_MISSING).
            </p>
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th align="left">Arquivo</th>
                    <th>Siaps</th>
                    <th>Previne</th>
                    <th>Blockers</th>
                    <th align="left">Envio</th>
                    <th align="left">Gaps Previne</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id}
                      style={{ cursor: 'pointer', background: selected?.id === it.id ? 'var(--ok-bg)' : undefined }}
                      onClick={() => void openItem(it.id)}
                    >
                      <td>{it.fileName}</td>
                      <td align="center">{it.siapsReady ? 'ok' : 'falha'}</td>
                      <td align="center">{it.previneReady ? 'ok' : `risco(${it.previneMoneyRisks ?? 0})`}</td>
                      <td align="center">{it.blockers}</td>
                      <td>
                        <code>{it.topCodes.join(', ')}</code>
                      </td>
                      <td>
                        <code>{(it.previneTopCodes || []).join(', ') || '—'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {selected && batch ? (
        <form className="card" onSubmit={saveItem}>
          <h3 style={{ marginTop: 0 }}>5. Editar ficha — {selected.fileName}</h3>
          <p>
            Status LEDI: <strong>{selected.status}</strong>
            {' · '}
            Siaps: <strong>{selected.siapsReady ? 'pronto' : 'bloquear'}</strong>
            {' · '}
            Previne: <strong>{selected.previneReady ? 'ok' : 'há MONEY_RISK'}</strong>
            {' · '}
            Envio final: <strong>{selected.readyForFinalSend ? 'recomendado' : 'reparar antes'}</strong>
          </p>

          {selected.previneXray ? (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ marginBottom: 8 }}>Raio-x Previne desta ficha — alertas e correção</h4>
              <p className="muted" style={{ marginTop: 0 }}>
                Sinais: 1ª consulta={String(selected.previneXray.signals.hasFirstConsultaProgramada)} ·
                conclusão={String(selected.previneXray.signals.hasTratamentoConcluido)} · preventivos=
                {selected.previneXray.signals.preventiveCount} · ART={selected.previneXray.signals.artCount} · INE=
                {String(selected.previneXray.signals.inePresent)}
              </p>
              <table style={{ width: '100%', fontSize: 13, marginBottom: 12 }}>
                <thead>
                  <tr>
                    <th align="left">Sev</th>
                    <th>Ind.</th>
                    <th align="left">Alerta</th>
                    <th align="left">Correção na interface</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.previneXray.gaps
                    .filter((g) => g.severity !== 'INFO' || g.code !== 'PREVINE_B4_NOT_IN_FAO')
                    .map((g, i) => {
                      const guide = PREVINE_REPAIR[g.code];
                      const canClick =
                        guide?.button &&
                        guide.ui &&
                        guide.ui !== 'manual' &&
                        guide.ui !== 'lote';
                      return (
                        <tr key={`${g.code}-${i}`}>
                          <td>{g.severity}</td>
                          <td align="center">{g.indicator}</td>
                          <td>
                            <code>{g.code}</code>
                            <div>{g.message}</div>
                            {g.repair ? <div className="muted">{g.repair}</div> : null}
                          </td>
                          <td>
                            {guide ? (
                              <>
                                <div>
                                  <strong>{guide.where}</strong>
                                </div>
                                <div className="muted" style={{ marginBottom: 6 }}>
                                  {guide.how}
                                </div>
                              </>
                            ) : null}
                            {canClick ? (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                disabled={busy}
                                style={{ fontSize: 12 }}
                                onClick={() => void applyGapRepair(g.code)}
                              >
                                {guide!.button}
                              </button>
                            ) : (
                              <span className="muted">Sem botão — ajuste clínico / lote</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : null}

          <h4 style={{ marginBottom: 8 }}>Críticas LEDI / Siaps</h4>
          <table style={{ width: '100%', fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr>
                <th align="left">Sev</th>
                <th align="left">Código</th>
                <th align="left">Mensagem</th>
                <th align="left">Ação</th>
              </tr>
            </thead>
            <tbody>
              {selected.findings
                .filter((f) => !String(f.code).startsWith('PREVINE_'))
                .map((f, i) => {
                  const guide = LEDI_REPAIR[f.code];
                  const canClick =
                    guide?.button && guide.ui && guide.ui !== 'manual' && guide.ui !== 'lote';
                  return (
                    <tr key={`${f.code}-${i}`}>
                      <td>{f.severity}</td>
                      <td>
                        <code>{f.code}</code>
                      </td>
                      <td>
                        {f.message}
                        {f.hint ? <div className="muted">{f.hint}</div> : null}
                        {guide ? <div className="muted">{guide.where}: {guide.how}</div> : null}
                      </td>
                      <td>
                        {canClick ? (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={busy}
                            style={{ fontSize: 12 }}
                            onClick={() => void applyGapRepair(f.code)}
                          >
                            {guide!.button}
                          </button>
                        ) : guide?.ui === 'lote' ? (
                          <span className="muted">Seção 3 (lote)</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12 }}>
            <div className="field">
              <label>CIAP (problemasCondicoes)</label>
              <input value={ciap} onChange={(e) => setCiap(e.target.value)} placeholder="D82" />
            </div>
            <div className="field">
              <label>CID-10 (opcional)</label>
              <input value={cid10} onChange={(e) => setCid10(e.target.value)} placeholder="K02.1" />
            </div>
            <div className="field">
              <label>tiposConsultaOdonto</label>
              <select value={tipoConsulta} onChange={(e) => setTipoConsulta(e.target.value)}>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="4">4</option>
              </select>
            </div>
            <div className="field">
              <label>INE desta ficha</label>
              <input value={editIne} onChange={(e) => setEditIne(e.target.value)} placeholder="0002165929" />
            </div>
            <div className="field">
              <label>CBO lotação</label>
              <input value={editCbo} onChange={(e) => setEditCbo(e.target.value)} placeholder="223208" />
            </div>
            <div className="field">
              <label>Vigilância (códigos, vírgula)</label>
              <input value={vigilancia} onChange={(e) => setVigilancia(e.target.value)} placeholder="1,3" />
            </div>
            <div className="field">
              <label>Procedimentos SIGTAP extras</label>
              <input
                value={procExtra}
                onChange={(e) => setProcExtra(e.target.value)}
                placeholder="0301010153,0101020104"
              />
            </div>
          </div>
          <p className="muted">
            Os botões dos alertas usam estes campos (INE, CIAP, CBO, vigilância). Procedimentos B1/B5/B6 e
            conduta 15 também podem ser aplicados direto no alerta.
          </p>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Salvar correção e revalidar XML
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
