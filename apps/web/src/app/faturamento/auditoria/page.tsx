'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, HelpLink, PageHeader, TableStateRow } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';

type Severity = 'blocker' | 'quality';

type Finding = {
  code: string;
  severity: Severity;
  message: string;
  sourceType: string;
  sourceId: string;
  fichaTipo?: string | null;
  cnes?: string | null;
  ine?: string | null;
  professionalCns?: string | null;
  cbo?: string | null;
  procedureCode?: string | null;
  href?: string | null;
  patientId?: string | null;
};

type AuditReport = {
  competencia: string;
  competenciaYm: string;
  ibgeCode: string;
  generatedAt: string;
  gestao?: string;
  gestaoCriterion?: string;
  counts: {
    findings: number;
    bySeverity: Record<Severity, number>;
    byCode: Record<string, number>;
    sources: { batches: number; productionRecords: number; encounters: number };
    cnesMunicipal?: number;
    cnesCity?: number;
    teamsMunicipal?: number;
    teamsCity?: number;
    vinculo?: {
      activeLinks: number;
      patientsWithActiveLink: number;
      patientsIndexed: number;
      unitsChecked: number;
      semVinculo: number;
      ineNeq: number;
      note: string | null;
    };
    cadastroIncompleto?: { siaps: number; previne: number; patientsEvaluated: number };
  };
  findings: Finding[];
};

const SEV_LABEL: Record<Severity, string> = {
  blocker: 'Bloqueia envio',
  quality: 'Qualidade',
};

const VINCULO_CADASTRO_CODES = [
  'PRODUCAO_SEM_VINCULO_EQUIPE',
  'PRODUCAO_INE_NEQ_VINCULO',
  'CADASTRO_INCOMPLETO_SIAPS',
  'CADASTRO_INCOMPLETO_PREVINE',
] as const;

function defaultCompetencia() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FaturamentoAuditoriaPage() {
  const [competencia, setCompetencia] = useState(defaultCompetencia);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState<'' | Severity>('');
  const [code, setCode] = useState('');
  const [q, setQ] = useState('');
  const [focusVinculoCadastro, setFocusVinculoCadastro] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        competencia,
        ibge: '3516200',
        gestao: 'municipal',
      });
      const data = await api<AuditReport>(`/v1/faturamento/audit?${qs.toString()}`);
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao carregar auditoria de faturamento');
    } finally {
      setLoading(false);
    }
  }, [competencia]);

  useEffect(() => {
    void load();
  }, [load]);

  const codes = useMemo(() => {
    if (!report) return [];
    return Object.keys(report.counts.byCode || {}).sort();
  }, [report]);

  const filtered = useMemo(() => {
    if (!report) return [];
    return report.findings.filter((f) => {
      if (focusVinculoCadastro && !VINCULO_CADASTRO_CODES.includes(f.code as (typeof VINCULO_CADASTRO_CODES)[number])) {
        return false;
      }
      if (severity && f.severity !== severity) return false;
      if (code && f.code !== code) return false;
      if (!q.trim()) return true;
      const hay =
        `${f.code} ${f.message} ${f.cnes || ''} ${f.ine || ''} ${f.fichaTipo || ''} ${f.procedureCode || ''}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [report, severity, code, q, focusVinculoCadastro]);

  const vinculoCadastroCount = useMemo(() => {
    if (!report) return 0;
    return report.findings.filter((f) =>
      VINCULO_CADASTRO_CODES.includes(f.code as (typeof VINCULO_CADASTRO_CODES)[number]),
    ).length;
  }, [report]);

  function exportCsv(scope: 'filtered' | 'vinculo-cadastro' = 'filtered') {
    const rows =
      scope === 'vinculo-cadastro'
        ? (report?.findings || []).filter((f) =>
            VINCULO_CADASTRO_CODES.includes(f.code as (typeof VINCULO_CADASTRO_CODES)[number]),
          )
        : filtered.length
          ? filtered
          : report?.findings || [];
    const header = [
      'severity',
      'code',
      'message',
      'sourceType',
      'sourceId',
      'fichaTipo',
      'cnes',
      'ine',
      'professionalCns',
      'cbo',
      'procedureCode',
      'patientId',
      'href',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [
      header.join(','),
      ...rows.map((f) =>
        [
          f.severity,
          f.code,
          f.message,
          f.sourceType,
          f.sourceId,
          f.fichaTipo,
          f.cnes,
          f.ine,
          f.professionalCns,
          f.cbo,
          f.procedureCode,
          f.patientId,
          f.href,
        ]
          .map(esc)
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const suffix = scope === 'vinculo-cadastro' ? 'vinculo-cadastro' : 'full';
    a.download = `faturamento-auditoria-${suffix}-${competencia}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell helpId="faturamento.auditoria">
      <PageHeader
        title="Auditoria de faturamento"
        eyebrow="Faturamento & Validação"
        description="Cruza fichas/lotes da competência com a rede municipal CNES (Prefeitura), INE, lotação CNS/CBO e SIGTAP (IBGE 3516200)."
        actions={
          <>
            <HelpLink id="faturamento.auditoria" />
            <HelpLink id="faturamento.cruzamentos" label="Cruzamentos" />
            <HelpLink id="faturamento.siaps-vs-previne" label="Siaps × Previne" />
            <button type="button" className="btn btn-secondary" onClick={() => void load()} disabled={loading}>
              Recarregar
            </button>
            <button type="button" className="btn" onClick={() => exportCsv('filtered')} disabled={!report?.findings.length}>
              Export CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => exportCsv('vinculo-cadastro')}
              disabled={!vinculoCadastroCount}
              title="Só PRODUCAO_* vínculo e CADASTRO_INCOMPLETO_*"
            >
              CSV vínculo/cadastro
            </button>
          </>
        }
      />
      <ErrorBox message={error} />

      <div className="card" style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
        <label style={{ fontSize: 13 }}>
          Competência{' '}
          <input
            className="field-input mono"
            type="month"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            style={{ minHeight: 40, padding: '8px 10px', marginLeft: 6 }}
          />
        </label>
        <span className="muted" style={{ fontSize: 12.5 }}>
          Escopo: rede municipal (Prefeitura) · IBGE 3516200 · blocker = bloqueia envio
        </span>
      </div>

      {report ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 13 }}>
            <span>
              Escopo CNES: <strong>Rede municipal</strong>
              {report.counts.cnesMunicipal != null
                ? ` (${report.counts.cnesMunicipal}/${report.counts.cnesCity ?? '—'} est. · ${report.counts.teamsMunicipal ?? '—'}/${report.counts.teamsCity ?? '—'} eq.)`
                : ''}
            </span>
            <span>
              Findings: <strong>{report.counts.findings}</strong>
            </span>
            <span style={{ color: 'var(--danger, #b91c1c)' }}>
              Bloqueia envio: {report.counts.bySeverity.blocker || 0}
            </span>
            <span>Qualidade: {report.counts.bySeverity.quality || 0}</span>
            <span className="muted">
              Fontes: {report.counts.sources.batches} lotes · {report.counts.sources.productionRecords}{' '}
              registros · {report.counts.sources.encounters} encounters
            </span>
          </div>
          {report.gestaoCriterion ? (
            <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
              Critério CNES: {report.gestaoCriterion}
            </p>
          ) : null}
        </div>
      ) : null}

      {report?.counts.vinculo || report?.counts.cadastroIncompleto ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: 14 }}>Sem vínculo / cadastro incompleto (NT 30 · tipo 2)</strong>
            <button
              type="button"
              className={`btn ${focusVinculoCadastro ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={() => {
                setFocusVinculoCadastro((v) => !v);
                if (!focusVinculoCadastro) setCode('');
              }}
            >
              {focusVinculoCadastro ? 'Mostrando só estes' : `Filtrar (${vinculoCadastroCount})`}
            </button>
            <Link href="/territorio" className="btn ghost" style={{ fontSize: 12, padding: '4px 8px' }}>
              /territorio
            </Link>
            <Link href="/pacientes" className="btn ghost" style={{ fontSize: 12, padding: '4px 8px' }}>
              /pacientes
            </Link>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontSize: 13 }}>
            {report.counts.vinculo ? (
              <>
                <span>
                  Links ativos: <strong>{report.counts.vinculo.activeLinks}</strong>
                  {' · '}
                  pacientes c/ vínculo: {report.counts.vinculo.patientsWithActiveLink}/
                  {report.counts.vinculo.patientsIndexed}
                </span>
                <span>
                  Unidades checadas: {report.counts.vinculo.unitsChecked}
                  {' · '}
                  <span style={{ color: 'var(--warn, #b45309)' }}>
                    sem vínculo: {report.counts.vinculo.semVinculo}
                  </span>
                  {' · '}
                  INE ≠ vínculo: {report.counts.vinculo.ineNeq}
                </span>
              </>
            ) : null}
            {report.counts.cadastroIncompleto ? (
              <span>
                Cadastro incompleto — Siaps:{' '}
                <strong style={{ color: 'var(--danger, #b91c1c)' }}>
                  {report.counts.cadastroIncompleto.siaps}
                </strong>
                {' · '}
                Previne: {report.counts.cadastroIncompleto.previne}
                {' · '}
                pacientes avaliados: {report.counts.cadastroIncompleto.patientsEvaluated}
              </span>
            ) : null}
          </div>
          {report.counts.vinculo?.note ? (
            <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5 }}>
              {report.counts.vinculo.note}
            </p>
          ) : null}
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
          <option value="blocker">Bloqueia envio</option>
          <option value="quality">Qualidade</option>
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
          placeholder="Filtrar mensagem, CNES, INE, SIGTAP…"
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
              <th>SIGTAP</th>
              <th>Fonte</th>
              <th>Abrir</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f, i) => (
              <tr key={`${f.code}-${f.sourceId}-${f.procedureCode || ''}-${i}`}>
                <td>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        f.severity === 'blocker' ? 'var(--danger, #b91c1c)' : 'var(--warn, #b45309)',
                    }}
                  >
                    {SEV_LABEL[f.severity]}
                  </span>
                </td>
                <td className="mono">{f.code}</td>
                <td>{f.message}</td>
                <td className="mono">{f.cnes || '—'}</td>
                <td className="mono">{f.ine || '—'}</td>
                <td className="mono">{f.procedureCode || '—'}</td>
                <td className="mono" style={{ fontSize: 12 }}>
                  {f.sourceType}
                  {f.fichaTipo ? ` · ${f.fichaTipo}` : ''}
                  {f.sourceId ? ` · ${f.sourceId.slice(0, 8)}` : ''}
                </td>
                <td>
                  {f.href ? (
                    <Link className="btn ghost" href={f.href} style={{ fontSize: 12, padding: '4px 8px' }}>
                      {f.sourceType === 'encounter'
                        ? 'Fila'
                        : f.sourceType === 'production_record'
                          ? 'Paciente'
                          : 'Lote'}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
            {!filtered.length ? (
              <TableStateRow colSpan={8} loading={loading} empty="Nenhum finding com os filtros atuais." />
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
