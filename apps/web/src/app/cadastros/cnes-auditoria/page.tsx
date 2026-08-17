'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, OkBox, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import {
  COLUMN_HELP,
  FINDING_CODE_HELP,
  SEVERITY_HELP,
  entityCadastroHref,
  facilityHref,
  isDemoSeed,
  teamHref,
  type FindingSeverity,
} from '@/lib/cnes-audit-glossary';

type Severity = FindingSeverity;

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
  facilityName?: string | null;
  teamName?: string | null;
  entityHref?: string | null;
  demoSeed?: boolean;
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

function CodeCell({ code }: { code: string }) {
  const help = FINDING_CODE_HELP[code];
  const title = help
    ? `${help.title}\n\n${help.meaning}\n\nO que fazer: ${help.action}`
    : code;
  return (
    <td className="mono" title={title} style={{ cursor: help ? 'help' : undefined }}>
      <span style={{ borderBottom: help ? '1px dotted var(--ink-3)' : undefined }}>{code}</span>
      {help ? (
        <div className="muted" style={{ fontSize: 11, fontFamily: 'inherit', marginTop: 2, maxWidth: 220 }}>
          {help.title}
        </div>
      ) : null}
    </td>
  );
}

function DemoBadge() {
  return (
    <span
      title="CNES 9999999 / INE 0000000001 — seed de demonstração do ambiente, não é rede municipal real"
      style={{
        marginLeft: 6,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: 0.02,
        padding: '1px 6px',
        borderRadius: 4,
        background: 'rgba(180, 83, 9, 0.15)',
        color: 'var(--warn, #b45309)',
        whiteSpace: 'nowrap',
      }}
    >
      demo
    </span>
  );
}

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
  const [showGlossary, setShowGlossary] = useState(true);

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
      const hay =
        `${f.code} ${f.message} ${f.cnes || ''} ${f.ine || ''} ${f.entityType} ${f.facilityName || ''} ${f.teamName || ''}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [report, severity, code, q]);

  function exportCsv() {
    const rows = filtered.length ? filtered : report?.findings || [];
    const header = [
      'severity',
      'code',
      'message',
      'entityType',
      'entityId',
      'cnes',
      'ine',
      'facilityName',
      'teamName',
      'demoSeed',
      'ibgeCode',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      header.join(','),
      ...rows.map((f) =>
        [
          f.severity,
          f.code,
          f.message,
          f.entityType,
          f.entityId,
          f.cnes,
          f.ine,
          f.facilityName,
          f.teamName,
          f.demoSeed ? '1' : '',
          f.ibgeCode,
        ]
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

  const codesInReport = useMemo(() => {
    if (!report) return [];
    return Object.keys(report.counts.byCode || {}).sort();
  }, [report]);

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
        {tab === 'findings' ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowGlossary((v) => !v)}
          >
            {showGlossary ? 'Ocultar glossário' : 'Mostrar glossário'}
          </button>
        ) : null}
      </div>

      {tab === 'findings' ? (
        <>
          {showGlossary ? (
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="section-label">Como ler esta tabela</div>
              <div style={{ display: 'grid', gap: 10, fontSize: 13, maxWidth: 900 }}>
                <div>
                  <strong>Severidade</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {(Object.keys(SEVERITY_HELP) as Severity[]).map((s) => (
                      <li key={s}>
                        <span style={{ fontWeight: 600, color: SEVERITY_HELP[s].color }}>
                          {SEVERITY_HELP[s].label}
                        </span>
                        {' — '}
                        {SEVERITY_HELP[s].short}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <strong>Colunas</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                    {COLUMN_HELP.map((c) => (
                      <li key={c.col}>
                        <strong>{c.col}</strong> — {c.meaning}
                      </li>
                    ))}
                  </ul>
                </div>
                {codesInReport.length ? (
                  <div>
                    <strong>Códigos nesta auditoria</strong>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {codesInReport.map((c) => {
                        const h = FINDING_CODE_HELP[c];
                        return (
                          <li key={c} style={{ marginBottom: 6 }}>
                            <span className="mono">{c}</span>
                            {h ? (
                              <>
                                {' '}
                                — {h.meaning}{' '}
                                <span className="muted">O que fazer: {h.action}</span>
                              </>
                            ) : (
                              <span className="muted"> — sem glossário detalhado</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
                <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
                  CNES <span className="mono">9999999</span> / INE <span className="mono">0000000001</span>{' '}
                  = dado de demonstração (seed). Clique em CNES, INE ou entidade para abrir o cadastro.
                </p>
              </div>
            </div>
          ) : null}

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
              placeholder="Filtrar mensagem, CNES, INE, nome…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th title={COLUMN_HELP[0].meaning}>Severidade</th>
                  <th title={COLUMN_HELP[1].meaning}>Código</th>
                  <th title={COLUMN_HELP[2].meaning}>Mensagem</th>
                  <th title={COLUMN_HELP[3].meaning}>CNES</th>
                  <th title={COLUMN_HELP[4].meaning}>INE</th>
                  <th title={COLUMN_HELP[5].meaning}>Entidade</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((f, i) => {
                  const demo = f.demoSeed || isDemoSeed(f.cnes, f.ine);
                  const facLink = f.cnes
                    ? facilityHref(f.cnes, f.entityType === 'facility' ? f.entityId : null)
                    : null;
                  const ineLink = f.ine
                    ? teamHref({
                        entityType: f.entityType,
                        entityId: f.entityType === 'team' ? f.entityId : null,
                        ine: f.ine,
                      })
                    : null;
                  const entLink = entityCadastroHref(f);
                  return (
                    <tr
                      key={`${f.code}-${f.entityId || i}-${f.cnes || ''}-${f.ine || ''}`}
                      style={demo ? { background: 'rgba(180, 83, 9, 0.06)' } : undefined}
                    >
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: SEVERITY_HELP[f.severity]?.color || 'var(--ink-3)',
                          }}
                          title={SEVERITY_HELP[f.severity]?.short}
                        >
                          {SEVERITY_HELP[f.severity]?.label || f.severity}
                        </span>
                      </td>
                      <CodeCell code={f.code} />
                      <td>
                        {f.message}
                        {f.facilityName || f.teamName ? (
                          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                            {[f.facilityName, f.teamName].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                        {demo ? <DemoBadge /> : null}
                      </td>
                      <td className="mono">
                        {facLink && f.cnes ? (
                          <Link href={facLink} title={f.facilityName || `Abrir unidade CNES ${f.cnes}`}>
                            {f.cnes}
                          </Link>
                        ) : (
                          f.cnes || '—'
                        )}
                        {demo && f.cnes ? <DemoBadge /> : null}
                      </td>
                      <td className="mono">
                        {ineLink && f.ine ? (
                          <Link href={ineLink} title={f.teamName || `Abrir equipe INE ${f.ine}`}>
                            {f.ine}
                          </Link>
                        ) : (
                          f.ine || '—'
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {entLink ? (
                          <Link href={entLink} title="Abrir cadastro correspondente">
                            {f.entityType}
                            {f.entityId ? ` · ${f.entityId.slice(0, 8)}` : ''}
                          </Link>
                        ) : (
                          <>
                            {f.entityType}
                            {f.entityId ? ` · ${f.entityId.slice(0, 8)}` : ''}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                  <td className="mono">
                    {t.ine ? <Link href={`/equipes/${t.id}`}>{t.ine}</Link> : '—'}
                  </td>
                  <td className="mono">{t.typeId || '—'}</td>
                  <td className="mono">{t.teamCount ?? '—'}</td>
                  <td className="mono">
                    {t.cnes ? <Link href={facilityHref(t.cnes)}>{t.cnes}</Link> : '—'}
                  </td>
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
                  <td>
                    <Link href={facilityHref(f.cnes, f.id)}>{f.name}</Link>
                  </td>
                  <td className="mono">
                    {f.cnes ? <Link href={facilityHref(f.cnes, f.id)}>{f.cnes}</Link> : '—'}
                  </td>
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
