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
  topCodes: Array<{ code: string; files: number; pct: number }>;
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
};

type Finding = {
  severity: string;
  code: string;
  message: string;
  field?: string;
  hint?: string;
};

type ItemDetail = {
  id: string;
  fileName: string;
  status: string;
  findings: Finding[];
  autoFixableCodes: string[];
  currentXml: string;
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
      setCiap('D82');
      setCid10('');
      setTipoConsulta('1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir ficha');
    }
  }

  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!batch || !selected) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (editIne.trim()) body.ine = editIne.trim();
      if (ciap.trim() || cid10.trim()) {
        body.problemasCondicoes = [{ ciap: ciap.trim() || undefined, cid10: cid10.trim() || undefined }];
      }
      if (tipoConsulta) body.tiposConsultaOdonto = [Number(tipoConsulta)];
      if (!Object.keys(body).length) {
        setError('Informe CIAP/CID, consulta ou INE para salvar.');
        setBusy(false);
        return;
      }
      const detail = await api<ItemDetail>(
        `/v1/dental/ledi/batches/${batch.id}/items/${selected.id}`,
        { method: 'PATCH', json: body },
      );
      setSelected(detail);
      setOk(`Ficha ${detail.fileName} revalidada — status ${detail.status}.`);
      await loadBatch(batch.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell helpId="odonto.lote-ledi">
      <PageHeader
        title="Lote LEDI FAO"
        eyebrow="Odontologia · Siaps/RNDS"
        description="Envie XMLs odontológicos, veja inconsistências, corrija em lote o que for automático e edite o restante antes de baixar os XMLs corrigidos."
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
                <div className="muted">Conformes</div>
                <strong>{batch.summary.conformant}</strong>
              </div>
              <div>
                <div className="muted">Com blocker</div>
                <strong>{batch.summary.withBlockers}</strong>
              </div>
              <div>
                <div className="muted">Auto-corrigíveis</div>
                <strong>{batch.summary.autoFixableItems}</strong>
              </div>
            </div>
            {batch.summary.topCodes?.length ? (
              <table style={{ width: '100%', marginTop: 12, fontSize: 14 }}>
                <thead>
                  <tr>
                    <th align="left">Código</th>
                    <th align="right">Fichas</th>
                    <th align="right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {batch.summary.topCodes.map((c) => (
                    <tr key={c.code}>
                      <td>
                        <code>{c.code}</code>
                      </td>
                      <td align="right">{c.files}</td>
                      <td align="right">{c.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                Baixar só conformes
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
                    <th>Status</th>
                    <th>Blockers</th>
                    <th align="left">Códigos</th>
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
                      <td align="center">{it.status}</td>
                      <td align="center">{it.blockers}</td>
                      <td>
                        <code>{it.topCodes.join(', ')}</code>
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
            Status atual: <strong>{selected.status}</strong>
          </p>
          <table style={{ width: '100%', fontSize: 13, marginBottom: 12 }}>
            <thead>
              <tr>
                <th align="left">Sev</th>
                <th align="left">Código</th>
                <th align="left">Mensagem</th>
              </tr>
            </thead>
            <tbody>
              {selected.findings.map((f, i) => (
                <tr key={`${f.code}-${i}`}>
                  <td>{f.severity}</td>
                  <td>
                    <code>{f.code}</code>
                  </td>
                  <td>
                    {f.message}
                    {f.hint ? <div className="muted">{f.hint}</div> : null}
                  </td>
                </tr>
              ))}
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
          </div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Salvar correção e revalidar XML
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
