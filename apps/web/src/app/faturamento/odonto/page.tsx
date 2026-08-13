'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { ErrorBox, PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/labels';
import {
  resolveSeverity,
  severityLabel,
  severityRank,
  severityTone,
} from '@/app/faturamento/lote/fao/error-catalog';

type Finding = { severity: string; code: string; message: string; hint?: string };

type QueueItem = {
  encounterId: string;
  productionBatchId?: string | null;
  patient: { id: string; name: string; cpf?: string | null; cns?: string | null };
  facility: { id: string; name: string; cnes: string };
  professionalName?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  encounterStatus: string;
  batchStatus: string;
  bucket: 'blocker' | 'money' | 'quality' | 'ok' | 'incomplete';
  summary: { blockers: number; moneyRisks: number; qualityWarns: number };
  topCodes: string[];
  findings: Finding[];
  missing: Array<{ code: string; severity: string; message: string }>;
  href: string;
};

type QueueResponse = {
  competencia: string;
  totals: {
    total: number;
    blocker: number;
    money: number;
    quality: number;
    incomplete: number;
    ok: number;
    ready: number;
    sent: number;
    open: number;
  };
  items: QueueItem[];
};

function currentCompetencia() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function bucketLabel(b: string) {
  if (b === 'blocker') return 'Bloqueia envio';
  if (b === 'money') return 'Qualidade incompleta';
  if (b === 'quality') return 'Indicadores';
  if (b === 'ok') return 'Pronto';
  if (b === 'incomplete') return 'Em preenchimento';
  return b;
}

function bucketSevClass(b: string) {
  if (b === 'blocker') return 'BLOCKER';
  if (b === 'money') return 'MONEY_RISK';
  if (b === 'quality') return 'QUALITY_WARN';
  if (b === 'ok') return 'ok';
  return 'INFO';
}

export default function FaturamentoOdontoPage() {
  const { facilityId } = useAuth();
  const [competencia, setCompetencia] = useState(currentCompetencia());
  const [bucket, setBucket] = useState('all');
  const [data, setData] = useState<QueueResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ competencia });
      if (facilityId) qs.set('facilityId', facilityId);
      if (bucket !== 'all') qs.set('bucket', bucket);
      const res = await api<QueueResponse>(`/v1/dental/faturamento-queue?${qs}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar fila');
    } finally {
      setBusy(false);
    }
  }, [competencia, facilityId, bucket]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    const items = [...(data?.items || [])];
    items.sort((a, b) => {
      const ra = severityRank(
        a.bucket === 'blocker'
          ? 'BLOCKER'
          : a.bucket === 'money'
            ? 'MONEY_RISK'
            : a.bucket === 'quality'
              ? 'QUALITY_WARN'
              : 'INFO',
      );
      const rb = severityRank(
        b.bucket === 'blocker'
          ? 'BLOCKER'
          : b.bucket === 'money'
            ? 'MONEY_RISK'
            : b.bucket === 'quality'
              ? 'QUALITY_WARN'
              : 'INFO',
      );
      if (ra !== rb) return ra - rb;
      return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
    });
    return items;
  }, [data]);

  const t = data?.totals;

  return (
    <AppShell>
      <PageHeader
        title="Fila de faturamento odonto"
        description="Validação + produção do mês — mesmas cores do lote LEDI FAO"
        actions={
          <>
            <Link className="btn ghost" href="/odonto">
              Atendimentos
            </Link>
            <Link className="btn ghost" href="/faturamento/lote/fao">
              Lote XML
            </Link>
            <button className="btn" type="button" disabled={busy} onClick={() => void load()}>
              Atualizar
            </button>
          </>
        }
      />
      <ErrorBox message={error} />

      <section className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
          <label>
            Competência
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
            />
          </label>
          <label>
            Filtro
            <select value={bucket} onChange={(e) => setBucket(e.target.value)}>
              <option value="all">Todos</option>
              <option value="blocker">Bloqueia envio</option>
              <option value="money">Qualidade incompleta</option>
              <option value="quality">Indicadores</option>
              <option value="incomplete">Em preenchimento</option>
              <option value="ok">Prontos</option>
            </select>
          </label>
        </div>
        {t && (
          <div className="lote-bars" style={{ marginTop: 14 }}>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'blocker' ? 'active' : ''}`}
              onClick={() => setBucket('blocker')}
            >
              <span className="lote-sev BLOCKER">Bloqueia envio</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill blocker"
                  style={{ width: `${t.total ? (t.blocker / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.blocker}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'money' ? 'active' : ''}`}
              onClick={() => setBucket('money')}
            >
              <span className="lote-sev MONEY_RISK">Qualidade incompleta</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill money"
                  style={{ width: `${t.total ? (t.money / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.money}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'quality' ? 'active' : ''}`}
              onClick={() => setBucket('quality')}
            >
              <span className="lote-sev QUALITY_WARN">Indicadores</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill quality"
                  style={{ width: `${t.total ? (t.quality / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.quality}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'incomplete' ? 'active' : ''}`}
              onClick={() => setBucket('incomplete')}
            >
              <span className="lote-sev INFO">Em preenchimento</span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill info"
                  style={{ width: `${t.total ? (t.incomplete / t.total) * 100 : 0}%` }}
                />
              </span>
              <strong>{t.incomplete}</strong>
            </button>
            <button
              type="button"
              className={`lote-bar-row ${bucket === 'ok' ? 'active' : ''}`}
              onClick={() => setBucket('ok')}
            >
              <span className="lote-sev ok" style={{ background: '#dcfce7', color: '#166534' }}>
                Pronto / Siaps
              </span>
              <span className="lote-bar-track">
                <span
                  className="lote-bar-fill"
                  style={{
                    width: `${t.total ? (t.ok / t.total) * 100 : 0}%`,
                    background: '#22c55e',
                  }}
                />
              </span>
              <strong>{t.ok}</strong>
            </button>
          </div>
        )}
        {t && (
          <p className="muted" style={{ marginBottom: 0 }}>
            {t.total} itens · {t.open} abertos · {t.ready} ready · {t.sent} sent · competência{' '}
            <strong>{competencia}</strong>
          </p>
        )}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Itens a faturar</h2>
        {!sorted.length && <p className="muted">Nenhum atendimento nesta competência.</p>}
        {sorted.map((item) => {
          const open = expanded === item.encounterId;
          const tone = severityTone(
            item.bucket === 'blocker'
              ? 'BLOCKER'
              : item.bucket === 'money'
                ? 'MONEY_RISK'
                : item.bucket === 'quality'
                  ? 'QUALITY_WARN'
                  : 'INFO',
          );
          const findingsSorted = [...item.findings].sort(
            (a, b) =>
              severityRank(resolveSeverity(a.code, a.severity)) -
              severityRank(resolveSeverity(b.code, b.severity)),
          );
          return (
            <div
              key={item.encounterId}
              className={`lote-alert-row ${tone === 'blocker' || tone === 'money' || tone === 'quality' ? tone : ''}`}
              style={{
                marginBottom: 10,
                padding: 12,
                borderRadius: 8,
                border: '1px solid var(--line)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <span className={`lote-sev ${bucketSevClass(item.bucket)}`}>
                    {bucketLabel(item.bucket)}
                  </span>
                  <strong>{item.patient.name}</strong>
                  <span className="muted">
                    {' '}
                    · {formatDateTime(item.startedAt)} · {item.facility.name}
                  </span>
                  <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                    Status atendimento: {item.encounterStatus} · lote: {item.batchStatus}
                    {item.summary.blockers > 0 && <> · {item.summary.blockers} blockers</>}
                    {item.topCodes.length > 0 && (
                      <> · {item.topCodes.slice(0, 4).map((c) => `\`${c}\``).join(' ')}</>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setExpanded(open ? null : item.encounterId)}
                  >
                    {open ? 'Ocultar' : 'Pendências'}
                  </button>
                  <Link className="btn" href={item.href}>
                    Abrir ficha
                  </Link>
                </div>
              </div>
              {open && (
                <ul style={{ marginTop: 10, marginBottom: 0, paddingLeft: 18 }}>
                  {findingsSorted.length === 0 && (
                    <li className="muted">Sem pendências registradas.</li>
                  )}
                  {findingsSorted.map((f, i) => {
                    const sev = resolveSeverity(f.code, f.severity);
                    return (
                      <li key={`${f.code}-${i}`} style={{ marginBottom: 6 }}>
                        <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
                        <code>{f.code}</code> — {f.message}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>
    </AppShell>
  );
}
