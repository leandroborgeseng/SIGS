'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type Severity = 'error' | 'warn' | 'info';

type Finding = {
  code: string;
  severity: Severity;
  message: string;
  entityType: string;
  entityId?: string | null;
  cnes?: string | null;
  ine?: string | null;
  ibgeCode?: string | null;
  details?: Record<string, unknown>;
};

type InventoryRow = {
  id: string;
  name: string;
  cnes?: string | null;
  ine?: string | null;
  active: boolean;
  typeId?: string | null;
  teamCount?: number;
  facilityName?: string | null;
};

type AuditReport = {
  ibgeCode: string;
  generatedAt: string;
  snapshotPath?: string;
  needsSync?: boolean;
  gestao?: string;
  gestaoCriterion?: string;
  counts: {
    findings: number;
    bySeverity: Record<Severity, number>;
    byCode: Record<string, number>;
    facilitiesInScope: number;
    teamsInScope: number;
    snapshotEstablishments?: number;
    snapshotTeams?: number;
    snapshotEstablishmentsCity?: number;
    snapshotTeamsCity?: number;
  };
  inventory?: {
    facilities: InventoryRow[];
    teams: InventoryRow[];
  };
  findings: Finding[];
  heuristics: { teamFacilityType: string };
};

type SyncResult = {
  ibgeCode: string;
  source: string;
  gestao?: string;
  filter?: {
    mode: string;
    criterion: string;
    before: { establishments: number; teams: number };
    after: { establishments: number; teams: number };
  };
  facilities: { created: number; updated: number; skipped: number };
  teams: { created: number; updated: number; skipped: number };
  totals: {
    establishments: number;
    teams: number;
    establishmentsActive: number;
    establishmentsCity?: number;
    teamsCity?: number;
  };
};

const SEV_LABEL: Record<Severity, string> = {
  error: 'Erro',
  warn: 'Alerta',
  info: 'Info',
};

export default function CnesAuditoriaPage() {
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingPf, setSyncingPf] = useState(false);
  const [severity, setSeverity] = useState<'' | Severity>('');
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'findings' | 'equipes' | 'unidades'>('findings');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api<AuditReport>('/v1/cnes/audit?ibge=3516200&gestao=municipal');
      setReport(data);
      if (data.needsSync) setTab('findings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar auditoria CNES');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSync() {
    setSyncing(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<SyncResult>(
        '/v1/cnes/sync?ibge=3516200&source=snapshot&gestao=municipal',
        { method: 'POST' },
      );
      const city = res.filter?.before?.establishments ?? res.totals.establishmentsCity;
      const muni = res.filter?.after?.establishments ?? res.totals.establishments;
      setOk(
        `Rede municipal (Prefeitura) sincronizada (${res.source}): unidades +${res.facilities.created} / ~${res.facilities.updated} · equipes +${res.teams.created} / ~${res.teams.updated} — ${muni} est. municipais` +
          (city != null ? ` de ${city} na cidade` : '') +
          ` · ${res.totals.teams} equipes.`,
      );
      await load();
      setTab('equipes');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha no sync CNES');
    } finally {
      setSyncing(false);
    }
  }

  async function runSyncProfessionals() {
    setSyncingPf(true);
    setError(null);
    setOk(null);
    try {
      const res = await api<{
        professionals: { created: number; updated: number; skipped: number };
        assignments: { created: number; updated: number; skipped: number };
        totals: { professionals: number; assignments: number };
      }>('/v1/cnes/sync-professionals?ibge=3516200', { method: 'POST' });
      setOk(
        `Profissionais lotados (PF): +${res.professionals.created}/~${res.professionals.updated} profissionais · +${res.assignments.created}/~${res.assignments.updated} lotações (snapshot ${res.totals.professionals} / ${res.totals.assignments}).`,
      );
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Falha no sync de profissionais (sincronize a rede municipal antes)',
      );
    } finally {
      setSyncingPf(false);
    }
  }

  const codes = useMemo(() => {
    if (!report) return [];
    return Object.keys(report.counts.byCode || {}).sort();
  }, [report]);

  const filtered = useMemo(() => {
    if (!report) return [];
    return report.findings.filter((f) => {
      if (severity && f.severity !== severity) return false;
      if (code && f.code !== code) return false;
      if (!q.trim()) return true;
      const hay = `${f.code} ${f.message} ${f.cnes || ''} ${f.ine || ''} ${f.entityType}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [report, severity, code, q]);

  function exportCsv() {
    const rows = filtered.length ? filtered : report?.findings || [];
    const header = ['severity', 'code', 'message', 'entityType', 'entityId', 'cnes', 'ine', 'ibgeCode'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      header.join(','),
      ...rows.map((f) =>
        [f.severity, f.code, f.message, f.entityType, f.entityId, f.cnes, f.ine, f.ibgeCode]
          .map(esc)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cnes-auditoria-3516200-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const emptyCadastro =
    !!report?.needsSync ||
    (!!report && report.counts.facilitiesInScope === 0 && report.counts.teamsInScope === 0);

  return (
    <AppShell helpId="cadastros.cnes-auditoria">
      <PageHeader
        title="Auditoria cadastro CNES"
        eyebrow="Cadastros"
        description="Rede municipal (gestão Prefeitura de Franca — natureza jurídica 1244). Não importa particulares/estadual/federal. Sem dados de pacientes."
        actions={
          <>
            <HelpLink id="cadastros.cnes-auditoria" />
            <Link className="btn btn-secondary" href="/equipes">
              Equipes e membros
            </Link>
            <Link className="btn btn-secondary" href="/unidades">
              Unidades
            </Link>
            <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
              Recarregar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void runSync()} disabled={syncing}>
              {syncing ? 'Sincronizando…' : 'Sincronizar rede municipal'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void runSyncProfessionals()}
              disabled={syncingPf || emptyCadastro}
              title={emptyCadastro ? 'Sincronize unidades/equipes antes' : 'Importa CNS+CBO+CNES+INE do CnesWeb'}
            >
              {syncingPf ? 'Importando PF…' : 'Importar profissionais lotados'}
            </button>
            <button type="button" className="btn" onClick={exportCsv} disabled={!report?.findings.length}>
              Export CSV
            </button>
          </>
        }
      />
      <ErrorBox message={error} />
      <OkBox message={ok} />

      {emptyCadastro && !loading ? (
        <div className="card" style={{ marginBottom: 12, borderColor: 'var(--warn, #b45309)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Cadastro da rede municipal vazio neste ambiente</p>
          <p className="muted" style={{ margin: '8px 0 0', maxWidth: 720 }}>
            O snapshot traz a cidade ({report?.counts.snapshotEstablishmentsCity ?? 1346} est.) e filtra a
            Prefeitura ({report?.counts.snapshotEstablishments ?? 66} est. /{' '}
            {report?.counts.snapshotTeams ?? 123} eq.). Clique em <strong>Sincronizar rede municipal</strong>.
          </p>
        </div>
      ) : null}

      {report ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
            <span>
              Escopo: <strong>Rede municipal (Prefeitura)</strong>
            </span>
            <span>
              Findings: <strong>{report.counts.findings}</strong>
            </span>
            <span style={{ color: 'var(--danger, #b91c1c)' }}>
              Erros: {report.counts.bySeverity.error || 0}
            </span>
            <span>Alertas: {report.counts.bySeverity.warn || 0}</span>
            <span>Info: {report.counts.bySeverity.info || 0}</span>
            <span className="muted">
              SIGS: {report.counts.facilitiesInScope} unidades · {report.counts.teamsInScope} equipes
            </span>
            {report.counts.snapshotEstablishments != null ? (
              <span className="muted">
                Snapshot filtrado: {report.counts.snapshotEstablishments} est. /{' '}
                {report.counts.snapshotTeams} eq.
                {report.counts.snapshotEstablishmentsCity != null
                  ? ` (cidade ${report.counts.snapshotEstablishmentsCity}/${report.counts.snapshotTeamsCity})`
                  : ''}
              </span>
            ) : null}
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5, maxWidth: 820 }}>
            Critério: {report.gestaoCriterion || 'natureza jurídica 1244 (Município)'}. Heurística tipo
            equipe × unidade: {report.heuristics.teamFacilityType}
          </p>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(
          [
            ['findings', 'Inconsistências'],
            ['equipes', `Equipes (${report?.counts.teamsInScope ?? 0})`],
            ['unidades', `Unidades (${report?.counts.facilitiesInScope ?? 0})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'btn' : 'btn btn-secondary'}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'findings' ? (
        <>
          <div className="card" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <select
              className="field-input"
              style={{ minHeight: 40, padding: '8px 10px' }}
              value={severity}
              onChange={(e) => setSeverity(e.target.value as '' | Severity)}
            >
              <option value="">Todas severidades</option>
              <option value="error">Erro</option>
              <option value="warn">Alerta</option>
              <option value="info">Info</option>
            </select>
            <select
              className="field-input"
              style={{ minHeight: 40, padding: '8px 10px', minWidth: 220 }}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            >
              <option value="">Todos os códigos</option>
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c} ({report?.counts.byCode[c] || 0})
                </option>
              ))}
            </select>
            <input
              className="field-input"
              style={{ flex: 1, minWidth: 180, minHeight: 40, padding: '8px 10px' }}
              placeholder="Filtrar mensagem, CNES, INE…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Severidade</th>
                  <th>Código</th>
                  <th>Mensagem</th>
                  <th>CNES</th>
                  <th>INE</th>
                  <th>Entidade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => (
                  <tr key={`${f.code}-${f.entityId || i}-${f.cnes || ''}-${f.ine || ''}`}>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            f.severity === 'error'
                              ? 'var(--danger, #b91c1c)'
                              : f.severity === 'warn'
                                ? 'var(--warn, #b45309)'
                                : 'var(--ink-3)',
                        }}
                      >
                        {SEV_LABEL[f.severity]}
                      </span>
                    </td>
                    <td className="mono">{f.code}</td>
                    <td>{f.message}</td>
                    <td className="mono">{f.cnes || '—'}</td>
                    <td className="mono">{f.ine || '—'}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {f.entityType}
                      {f.entityId ? ` · ${f.entityId.slice(0, 8)}` : ''}
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <TableStateRow
                    colSpan={6}
                    loading={loading}
                    empty={
                      emptyCadastro
                        ? 'Nenhuma unidade/equipe no banco — use Sincronizar CNES Franca.'
                        : report && report.counts.findings === 0
                          ? 'Cadastro carregado; nenhuma inconsistência encontrada.'
                          : 'Nenhum finding com os filtros atuais.'
                    }
                  />
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === 'equipes' ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Equipe</th>
                <th>INE</th>
                <th>Tipo</th>
                <th>Membros</th>
                <th>CNES</th>
                <th>Unidade</th>
                <th>Ativa</th>
              </tr>
            </thead>
            <tbody>
              {(report?.inventory?.teams || []).map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/equipes/${t.id}`}>{t.name}</Link>
                  </td>
                  <td className="mono">{t.ine || '—'}</td>
                  <td className="mono">{t.typeId || '—'}</td>
                  <td className="mono">{t.teamCount ?? '—'}</td>
                  <td className="mono">{t.cnes || '—'}</td>
                  <td>{t.facilityName || '—'}</td>
                  <td>{t.active ? 'sim' : 'não'}</td>
                </tr>
              ))}
              {!(report?.inventory?.teams || []).length ? (
                <TableStateRow
                  colSpan={7}
                  loading={loading}
                  empty={
                    emptyCadastro
                      ? 'Sem equipes — sincronize o CNES Franca.'
                      : 'Nenhuma equipe no escopo (amostra até 40).'
                  }
                />
              ) : null}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: 8 }}>
            Amostra de auditoria (até 40).{' '}
            <Link href="/equipes">Ver todas as equipes e membros</Link>
            {' · '}
            <Link href="/equipes?tab=multi">Multi-equipe</Link>.
          </p>
        </div>
      ) : null}

      {tab === 'unidades' ? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Unidade</th>
                <th>CNES</th>
                <th>Tipo</th>
                <th>Equipes</th>
                <th>Ativa</th>
              </tr>
            </thead>
            <tbody>
              {(report?.inventory?.facilities || []).map((f) => (
                <tr key={f.id}>
                  <td>{f.name}</td>
                  <td className="mono">{f.cnes || '—'}</td>
                  <td className="mono">{f.typeId || '—'}</td>
                  <td className="mono">{f.teamCount ?? '—'}</td>
                  <td>{f.active ? 'sim' : 'não'}</td>
                </tr>
              ))}
              {!(report?.inventory?.facilities || []).length ? (
                <TableStateRow
                  colSpan={5}
                  loading={loading}
                  empty={
                    emptyCadastro
                      ? 'Sem unidades — sincronize o CNES Franca.'
                      : 'Nenhuma unidade no escopo (amostra até 40).'
                  }
                />
              ) : null}
            </tbody>
          </table>
          {report && report.counts.facilitiesInScope > (report.inventory?.facilities.length || 0) ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Mostrando {report.inventory?.facilities.length} de {report.counts.facilitiesInScope} unidades.
              Lista completa em <Link href="/unidades">/unidades</Link>.
            </p>
          ) : null}
        </div>
      ) : null}
    </AppShell>
  );
}
