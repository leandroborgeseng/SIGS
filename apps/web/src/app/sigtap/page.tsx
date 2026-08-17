'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Proc = {
  id: string;
  code: string;
  name: string;
  complex?: string | null;
  groupName?: string | null;
  source: string;
  competencia?: string | null;
  active: boolean;
};

type ValidateOut = {
  total: number;
  valid: number;
  invalid: number;
  results: Array<{ code: string; valid: boolean; name: string | null }>;
};

export default function SigtapPage() {
  const { hasPermission } = useAuth();
  const canImport = hasPermission('*') || hasPermission('production.manage');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Proc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [validateCodes, setValidateCodes] = useState('0301010064\n9999999999');
  const [validation, setValidation] = useState<ValidateOut | null>(null);
  const [msCompetencia, setMsCompetencia] = useState('202608');
  const [msBusy, setMsBusy] = useState(false);
  const [offlineHint, setOfflineHint] = useState<string | null>(null);
  const [importJson, setImportJson] = useState(
    JSON.stringify(
      {
        competencia: '202608',
        items: [
          {
            code: '0301010072',
            name: 'Consulta de profissionais de nível superior na atenção básica (exceto médico)',
            complex: 'Atenção Básica',
            groupCode: '03',
            groupName: 'Procedimentos clínicos',
          },
        ],
      },
      null,
      2,
    ),
  );

  async function search(term = q) {
    setError(null);
    setLoading(true);
    try {
      setRows(await api<Proc[]>(`/v1/sigtap/procedures${term ? `?q=${encodeURIComponent(term)}` : ''}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha na busca');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void search('');
    void api<{ hint?: string; discoveredFile?: string | null }>('/v1/sigtap/offline-status')
      .then((s) => {
        setOfflineHint(
          s.discoveredFile
            ? `Arquivo local: ${s.discoveredFile}`
            : s.hint || 'Coloque ZIP/TXT em data/sigtap/',
        );
      })
      .catch(() => undefined);
  }, []);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    await search();
  }

  async function onValidate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const codes = validateCodes
        .split(/[\n,;]+/)
        .map((c) => c.trim())
        .filter(Boolean);
      setValidation(await api<ValidateOut>('/v1/sigtap/validate', { method: 'POST', json: { codes } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na validação');
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    try {
      const body = JSON.parse(importJson) as { competencia?: string; items: unknown[] };
      const res = await api<{ upserted: number; competencia?: string }>('/v1/sigtap/import', {
        method: 'POST',
        json: body,
      });
      setOk(`JSON stub: ${res.upserted} procedimento(s) · competência ${res.competencia || '—'}`);
      await search('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no import (JSON ou permissão)');
    }
  }

  async function importMsContent(content: string) {
    setMsBusy(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<{
        upserted: number;
        skipped: number;
        competencia: string;
        format: string;
      }>('/v1/sigtap/import-ms', {
        method: 'POST',
        json: { content, competencia: msCompetencia || undefined },
      });
      setOk(
        `MS ${res.format}: ${res.upserted} upsert(s) · competência ${res.competencia}` +
          (res.skipped ? ` · ${res.skipped} linha(s) ignorada(s)` : ''),
      );
      await search('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no import MS');
    } finally {
      setMsBusy(false);
    }
  }

  async function onMsFile(file: File | null) {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip') || lower.endsWith('.csv') || file.type === 'application/zip') {
      setMsBusy(true);
      setError(null);
      setOk(null);
      try {
        const fd = new FormData();
        fd.append('file', file);
        if (msCompetencia) fd.append('competencia', msCompetencia);
        const res = await api<{
          upserted: number;
          skipped?: number;
          competencia: string;
          format: string;
        }>('/v1/sigtap/import-file', { method: 'POST', body: fd });
        setOk(
          `${res.format}: ${res.upserted} upsert(s) · competência ${res.competencia}` +
            (res.skipped ? ` · ${res.skipped} ignorada(s)` : ''),
        );
        await search('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha no upload ZIP/CSV');
      } finally {
        setMsBusy(false);
      }
      return;
    }
    const text = await file.text();
    await importMsContent(text);
  }

  async function importLocalFolder() {
    setMsBusy(true);
    setError(null);
    setOk(null);
    try {
      const qs = msCompetencia ? `?competencia=${encodeURIComponent(msCompetencia)}` : '';
      const res = await api<{
        upserted: number;
        competencia?: string;
        file?: string;
        kind?: string;
        format?: string;
      }>(`/v1/sigtap/import-local${qs}`, { method: 'POST' });
      setOk(
        `Local ${res.kind || res.format || ''}: ${res.upserted} · ${res.file || 'data/sigtap/'} · competência ${res.competencia || '—'}`,
      );
      await search('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no import local');
    } finally {
      setMsBusy(false);
    }
  }

  async function syncSeed() {
    setError(null);
    setOk(null);
    try {
      const res = await api<{
        created: number;
        updated: number;
        count: number;
        seedSize: number;
      }>('/v1/sigtap/seed?force=1', { method: 'POST' });
      setOk(
        `Seed sincronizado: +${res.created} · ~${res.updated} atualizados · ${res.count}/${res.seedSize} no catálogo.`,
      );
      await search('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao sincronizar seed (precisa perfil TI)');
    }
  }

  return (
    <AppShell helpId="sigtap.catalogo">
      <PageHeader
        title="SIGTAP"
        eyebrow="Faturamento"
        description="Catálogo local APS · import offline ZIP/TXT/CSV (data/sigtap/) · seed piloto. Sem depender do site DATASUS."
        actions={
          <>
            <HelpLink id="sigtap.catalogo" />
            {canImport ? (
              <>
                <button type="button" className="btn btn-secondary" onClick={() => void syncSeed()}>
                  Sincronizar seed
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={msBusy}
                  onClick={() => void importLocalFolder()}
                >
                  Importar pasta local
                </button>
              </>
            ) : null}
            <Link className="btn btn-secondary" href="/producao">
              Produção
            </Link>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />
      {offlineHint ? (
        <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 0 }}>{offlineHint}</p>
      ) : null}
      <form className="card row" onSubmit={onSearch} style={{ marginBottom: 16 }}>
        <input
          style={{ flex: 1, minHeight: 38, padding: '0 12px', borderRadius: 10, border: '1px solid var(--line)' }}
          placeholder="Buscar por código ou nome…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Buscar
        </button>
      </form>

      <div className="table-wrap" style={{ marginBottom: 16 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Código</th>
              <th>Nome</th>
              <th>Complexidade</th>
              <th>Grupo</th>
              <th>Fonte</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="mono">{r.code}</td>
                <td>{r.name}</td>
                <td>{r.complex || '—'}</td>
                <td>{r.groupName || '—'}</td>
                <td>
                  <span className={`pill ${r.source === 'ms' ? 'ok' : r.source === 'seed' ? 'brand' : 'ok'}`}>
                    <span className="dot" />
                    {r.source}
                  </span>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <TableStateRow
                colSpan={5}
                loading={loading}
                empty="Nenhum procedimento — seed automático ou importe TB_PROCEDIMENTO / JSON."
              />
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <form className="card" onSubmit={onValidate}>
          <div className="section-label">Validar códigos</div>
          <div className="field">
            <label>Um código por linha</label>
            <textarea rows={5} className="mono" value={validateCodes} onChange={(e) => setValidateCodes(e.target.value)} />
          </div>
          <button className="btn btn-secondary" type="submit">
            Validar
          </button>
          {validation ? (
            <p style={{ marginTop: 12, fontSize: 13 }}>
              {validation.valid}/{validation.total} válidos
              {validation.invalid ? ` · ${validation.invalid} desconhecidos` : ''}
            </p>
          ) : null}
        </form>

        {canImport ? (
          <div className="card">
            <div className="section-label">Importar SIGTAP (ZIP / TXT / CSV)</div>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 0 }}>
              Preferência: ZIP oficial da competência com <span className="mono">TB_PROCEDIMENTO.txt</span>.
              Site DATASUS costuma cair — veja fontes em <span className="mono">data/sigtap/README.md</span> ou
              use a fixture / seed.
            </p>
            <div className="field">
              <label>Competência fallback (YYYYMM)</label>
              <input className="mono" value={msCompetencia} onChange={(e) => setMsCompetencia(e.target.value)} />
            </div>
            <div className="field">
              <label>Arquivo</label>
              <input
                type="file"
                accept=".zip,.txt,.csv,application/zip,text/plain,text/csv"
                disabled={msBusy}
                onChange={(e) => void onMsFile(e.target.files?.[0] || null)}
              />
            </div>
            {msBusy ? <p style={{ fontSize: 13 }}>Importando…</p> : null}
          </div>
        ) : null}
      </div>

      {canImport ? (
        <form className="card" onSubmit={onImport}>
          <div className="section-label">Importar JSON stub (legado)</div>
          <div className="field">
            <label>Payload</label>
            <textarea rows={8} className="mono" value={importJson} onChange={(e) => setImportJson(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="submit">
            Importar JSON
          </button>
        </form>
      ) : null}
    </AppShell>
  );
}
