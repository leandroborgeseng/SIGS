'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, PageHeader } from '@/components/ui/PageHeader';
import { api, ApiError, getToken } from '@/lib/api';
import { uploadLediBatchMultipart } from '@/lib/ledi-batch-upload';
import { formatUploadError } from '@/lib/format-upload-error';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { explainError, resolveSeverity, severityLabel, severityRank, severityTone } from '@/app/odonto/lote/error-catalog';
import { TreatmentDashboard, type TreatBucket } from '@/app/odonto/lote/TreatmentDashboard';
import type { TreatmentProgress } from '@/app/odonto/lote/treatment-types';

type LoteTipo = 'FAI' | 'PROCEDIMENTOS';

type BatchSummary = {
  total: number;
  conformant: number;
  withBlockers: number;
  withWarn: number;
  autoFixableItems: number;
  siapsReady?: number;
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
  previneMoneyRisks?: number;
  fichaTipo?: string | null;
};

type ItemDetail = ItemRow & {
  findings: Array<{ severity: string; code: string; message: string; hint?: string }>;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const META: Record<
  LoteTipo,
  { title: string; help: string; label: string; siblingHref: string; siblingLabel: string }
> = {
  FAI: {
    title: 'Lote LEDI FAI',
    help: 'Atendimento Individual (tipo 4). Prioridade: informar se o cidadão tem CPF e código da equipe (INE).',
    label: 'FAI',
    siblingHref: '/procedimentos/lote',
    siblingLabel: 'Lote Procedimentos',
  },
  PROCEDIMENTOS: {
    title: 'Lote LEDI Procedimentos',
    help: 'Ficha de Procedimentos (tipo 7). Prioridade: informar se o cidadão tem CPF; procedimentos ABPG são rejeitados.',
    label: 'Procedimentos',
    siblingHref: '/aps/lote',
    siblingLabel: 'Lote FAI',
  },
};

function downloadZip(batchId: string, mode: 'current' | 'conformant') {
  const token = getToken();
  return fetch(`${API_BASE}/v1/dental/ledi/batches/${batchId}/export.zip?mode=${mode}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (res) => {
    if (!res.ok) throw new Error(`Exportação falhou (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledi-lote-${batchId.slice(0, 8)}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

export function LediTipoLotePage({ expectedTipo }: { expectedTipo: LoteTipo }) {
  const meta = META[expectedTipo];
  const [batches, setBatches] = useState<BatchListRow[]>([]);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selected, setSelected] = useState<ItemDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [batchName, setBatchName] = useState('');
  const [confirmSt, setConfirmSt] = useState(true);
  const [ineDefault, setIneDefault] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [treatBucket, setTreatBucket] = useState<TreatBucket>('');

  const loadBatches = useCallback(async () => {
    const list = await api<BatchListRow[]>('/v1/dental/ledi/batches');
    setBatches(list.filter((b) => (b.summary?.expectedTipo || 'FAO') === expectedTipo));
  }, [expectedTipo]);

  const loadBatch = useCallback(
    async (id: string) => {
      const b = await api<Batch>(`/v1/dental/ledi/batches/${id}`);
      setBatch(b);
      const qs = new URLSearchParams();
      qs.set('limit', '300');
      if (treatBucket) qs.set('bucket', treatBucket);
      const page = await api<{ total: number; items: ItemRow[] }>(
        `/v1/dental/ledi/batches/${id}/items?${qs}`,
      );
      setItems(page.items);
    },
    [treatBucket],
  );

  useEffect(() => {
    void loadBatches().catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [loadBatches]);

  useEffect(() => {
    if (!batch?.id) return;
    void loadBatch(batch.id).catch((e) => setError(e instanceof Error ? e.message : 'Falha'));
  }, [batch?.id, loadBatch]);

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
        name: batchName.trim() || `${meta.label} ${new Date().toLocaleString('pt-BR')}`,
        expectedTipo,
        onProgress: setUploadProgress,
      });
      setBatch(created);
      const failNote = failedNames.length
        ? ` · ${failedNames.length} não lidos (ex.: ${failedNames[0]}) — copie a pasta para o Desktop e reenvie só esses.`
        : '';
      setOk(
        `Lote ${meta.label}: ${uploaded} enviadas · ${created.summary.withBlockers} com blocker · ${created.summary.conformant} conformes.${failNote}`,
      );
      await loadBatches();
      await loadBatch(created.id);
    } catch (err) {
      setError(formatUploadError(err));
    } finally {
      setBusy(false);
      setUploadProgress('');
    }
  }

  async function applyAutoFix(e: FormEvent) {
    e.preventDefault();
    if (!batch) return;
    if (!confirmSt && !ineDefault.trim()) {
      setError('Marque “informar se o cidadão tem CPF” e/ou informe o código da equipe (INE).');
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
        },
      });
      setBatch(res);
      setOk(`Auto-correção aplicada em ${res.touched} fichas.`);
      await loadBatch(batch.id);
      if (selected) {
        const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`);
        setSelected(detail);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha');
    } finally {
      setBusy(false);
    }
  }

  async function openItem(id: string) {
    if (!batch) return;
    const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${id}`);
    setSelected(detail);
  }

  async function fixSelectedSt() {
    if (!batch || !selected) return;
    setBusy(true);
    try {
      const detail = await api<ItemDetail>(`/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`, {
        method: 'PATCH',
        json: { stNaoPossuiCpf: true },
      });
      setSelected(detail);
      setOk(`Campo “informar se o cidadão tem CPF” aplicado em ${selected.fileName}`);
      await loadBatch(batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell helpId="odonto.lote-ledi">
      <PageHeader
        title={meta.title}
        description={meta.help}
        actions={
          <>
            <Link className="btn btn-secondary" href="/odonto/lote">
              Lote FAO (odonto)
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
          Se aparecer erro de I/O: copie o ZIP para o <strong>Desktop</strong> e envie de lá (ou arraste). Ignore FAO
          aqui — use <Link href="/odonto/lote">/odonto/lote</Link>.
        </p>
        <div className="field">
          <label>Nome do lote</label>
          <input value={batchName} onChange={(e) => setBatchName(e.target.value)} />
        </div>
        <FileDropZone disabled={busy} acceptHint={meta.label} onFiles={(f) => void onUpload(f as FileList)}>
          <input
            type="file"
            accept=".xml,.zip,application/xml,text/xml,application/zip"
            multiple
            disabled={busy}
            onChange={(e) => void onUpload(e.target.files)}
          />
        </FileDropZone>
        {uploadProgress ? <p className="muted">{uploadProgress}</p> : null}
      </div>

      {batches.length ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Lotes recentes ({meta.label})</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {batches.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void loadBatch(b.id).then(() => setBatch(b as Batch))}
                >
                  {b.name} · {b.itemCount} fichas · {b.status}
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
            <p>
              Total {batch.summary.total} · blockers {batch.summary.withBlockers} · Siaps ok{' '}
              {batch.summary.siapsReady ?? '—'} · prontas {batch.summary.readyForFinalSend ?? '—'}
            </p>
            <div className="lote-priority" style={{ marginTop: 0 }}>
              <div className="lote-priority-card blocker">
                <div className="step">1º · Vermelho</div>
                <strong>Bloqueia envio</strong>
              </div>
              <div className="lote-priority-card money">
                <div className="step">2º · Laranja</div>
                <strong>Risco de faturamento</strong>
              </div>
              <div className="lote-priority-card quality">
                <div className="step">3º · Verde</div>
                <strong>Indicadores / info</strong>
              </div>
            </div>

            <TreatmentDashboard
              treatment={batch.summary.treatment}
              readyForFinalSend={batch.summary.readyForFinalSend}
              activeBucket={treatBucket}
              onFilterBucket={setTreatBucket}
            />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(batch.summary.topCodes || [])
                .map((c) => ({
                  ...c,
                  severity: resolveSeverity(c.code, 'BLOCKER'),
                }))
                .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.files - a.files)
                .slice(0, 8)
                .map((c) => (
                  <span key={c.code} className={`lote-sev ${c.severity}`} style={{ fontSize: 12 }}>
                    {severityLabel(c.severity)} · {explainError(c.code)?.title || c.code} ({c.files})
                  </span>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void downloadZip(batch.id, 'current').catch((e) => setError(String(e.message || e)))}
              >
                Baixar ZIP
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() =>
                  void downloadZip(batch.id, 'conformant').catch((e) => setError(String(e.message || e)))
                }
              >
                Baixar só conformes
              </button>
            </div>
          </div>

          <form className="card" style={{ marginBottom: 16 }} onSubmit={applyAutoFix}>
            <h3 style={{ marginTop: 0 }}>3. Auto-correção em massa</h3>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
              <input type="checkbox" checked={confirmSt} onChange={(e) => setConfirmSt(e.target.checked)} />
              Corrigir automaticamente: “informar se o cidadão tem CPF” (campo obrigatório do Ministério)
            </label>
            <div className="field">
              <label>Código da equipe (INE), se estiver faltando</label>
              <input value={ineDefault} onChange={(e) => setIneDefault(e.target.value)} placeholder="0002321246" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={busy}>
              Aplicar no lote e revalidar
            </button>
          </form>

          <div className="lote-split">
            <div className="card">
              <h3 style={{ marginTop: 0 }}>4. Fichas</h3>
              <div style={{ maxHeight: 420, overflow: 'auto' }}>
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
            <div className="card lote-sticky">
              <h3 style={{ marginTop: 0 }}>5. Ficha</h3>
              {selected ? (
                <>
                  <p>
                    <strong>{selected.fileName}</strong>
                    <br />
                    <span className="muted">
                      {selected.fichaTipo} · {selected.status} · Siaps {selected.siapsReady ? 'ok' : 'bloquear'}
                    </span>
                  </p>
                  <ul style={{ paddingLeft: 0, listStyle: 'none', fontSize: 13 }}>
                    {[...selected.findings]
                      .map((f) => ({
                        f,
                        sev: String(f.severity || resolveSeverity(f.code)),
                      }))
                      .sort((a, b) => severityRank(a.sev) - severityRank(b.sev))
                      .map(({ f, sev }, i) => {
                        const guide = explainError(f.code);
                        const tone = severityTone(sev);
                        return (
                          <li
                            key={`${f.code}-${i}`}
                            className={`lote-alert-row ${tone}`}
                            style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6 }}
                          >
                            <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
                            <strong style={{ display: 'block', marginTop: 4 }}>
                              {guide?.title || f.code}
                            </strong>
                            {guide?.why ? (
                              <div className="muted">{guide.why}</div>
                            ) : (
                              <div className="muted">{f.message}</div>
                            )}
                            {guide?.how ? (
                              <div className="muted">
                                <strong>O que fazer:</strong> {guide.how}
                              </div>
                            ) : f.hint ? (
                              <div className="muted">{f.hint}</div>
                            ) : null}
                          </li>
                        );
                      })}
                  </ul>
                  {selected.findings.some((f) => f.code === 'ST_NAO_POSSUI_CPF') ? (
                    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void fixSelectedSt()}>
                      Corrigir: informar se o cidadão tem CPF
                    </button>
                  ) : (
                    <p className="muted">Nenhum bloqueio de “informar se tem CPF” nesta ficha.</p>
                  )}
                </>
              ) : (
                <p className="muted">Selecione uma ficha na lista.</p>
              )}
            </div>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
