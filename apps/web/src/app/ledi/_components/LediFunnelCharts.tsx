'use client';

export type LediChartSummary = {
  total: number;
  siapsReady?: number;
  withBlockers?: number;
  withWarn?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  autoFixableItems?: number;
  individualItems?: number;
  treatment?: {
    baseline?: {
      fichas?: number;
      bloqueioEnvio?: number;
      riscoFaturamento?: number;
      indicadores?: number;
      ideais?: number;
    };
    current?: {
      fichas?: number;
      bloqueioEnvio?: number;
      riscoFaturamento?: number;
      indicadores?: number;
      ideais?: number;
    };
    fichasCorrigidasAcumulado?: number;
    camposCorrigidosAcumulado?: number;
  };
};

type Slice = { key: string; label: string; value: number; color: string };

function slicesFromSummary(summary: LediChartSummary, useBaseline = false): Slice[] {
  const t = useBaseline ? summary.treatment?.baseline : summary.treatment?.current;
  const total = Math.max(0, summary.total || t?.fichas || 0);
  const bloqueio = t?.bloqueioEnvio ?? summary.withBlockers ?? 0;
  const qualidade = t?.riscoFaturamento ?? summary.withWarn ?? 0;
  const indicadores = t?.indicadores ?? 0;
  const ideais = t?.ideais ?? summary.readyForFinalSend ?? 0;
  const known = bloqueio + qualidade + indicadores + ideais;
  const resto = Math.max(0, total - known);
  return [
    { key: 'bloqueio', label: 'Bloqueio', value: bloqueio, color: 'var(--danger)' },
    { key: 'qualidade', label: 'Qualidade', value: qualidade, color: 'var(--warn)' },
    { key: 'indicadores', label: 'Indicadores', value: indicadores, color: '#0f766e' },
    { key: 'ideais', label: '100% OK', value: ideais, color: 'var(--ok)' },
    ...(resto > 0 ? [{ key: 'resto', label: 'Demais', value: resto, color: '#94a3b8' }] : []),
  ];
}

function FunnelBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const width = total ? Math.min(100, Math.max(value ? 3 : 0, pct)) : 0;
  return (
    <div className="ledi-chart-bar-row">
      <span className="ledi-chart-bar-label">{label}</span>
      <span className="lote-bar-track" style={{ flex: 1 }}>
        <span className="lote-bar-fill" style={{ width: `${width}%`, background: color }} />
      </span>
      <span className="ledi-chart-bar-n">
        {value}
        <span className="muted"> · {pct}%</span>
      </span>
    </div>
  );
}

function Pie({ slices, size = 132 }: { slices: Slice[]; size?: number }) {
  const sum = slices.reduce((a, s) => a + s.value, 0);
  const r = size / 2 - 4;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  if (sum <= 0) {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={18} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribuição do lote">
      <g transform={`rotate(-90 ${c} ${c})`}>
        {slices
          .filter((s) => s.value > 0)
          .map((s) => {
            const len = (s.value / sum) * circ;
            const el = (
              <circle
                key={s.key}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={18}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
      </g>
    </svg>
  );
}

function CountsRow({ summary }: { summary: LediChartSummary }) {
  const total = summary.total || summary.treatment?.current?.fichas || 0;
  const siaps = summary.siapsReady ?? Math.max(0, total - (summary.withBlockers ?? 0));
  const erros = (summary.withBlockers ?? 0) + (summary.withWarn ?? 0);
  const lote = summary.autoFixableItems ?? 0;
  const individual = summary.individualItems ?? Math.max(0, erros - lote);
  const cells = [
    { label: 'Fichas', value: total },
    { label: 'Já podem enviar (Siaps)', value: siaps },
    { label: 'Com erro', value: erros },
    { label: 'Corrigem em lote', value: lote },
    { label: 'Individuais', value: individual },
  ];
  return (
    <div
      className="ledi-wizard-counts"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
        gap: 8,
        marginBottom: 12,
      }}
    >
      {cells.map((c) => (
        <div key={c.label} className="lote-funnel-item" style={{ padding: '8px 10px' }}>
          <div className="muted" style={{ fontSize: 12 }}>
            {c.label}
          </div>
          <strong>{c.value}</strong>
        </div>
      ))}
    </div>
  );
}

/** Funil + pizza do summary LEDI (sem R$). Atualiza no poll do job. */
export function LediFunnelCharts({
  summary,
  live,
  variant = 'analise',
}: {
  summary?: LediChartSummary | null;
  live?: boolean;
  variant?: 'analise' | 'fechamento';
}) {
  if (!summary || !(summary.total > 0 || (summary.treatment?.current?.fichas || 0) > 0)) {
    return null;
  }
  const total = summary.total || summary.treatment?.current?.fichas || 0;
  const siaps = summary.siapsReady ?? Math.max(0, total - (summary.withBlockers ?? 0));
  const previne = summary.previneReady ?? 0;
  const ok100 = summary.readyForFinalSend ?? summary.treatment?.current?.ideais ?? 0;
  const slices = slicesFromSummary(summary);
  const t = summary.treatment?.current;
  const base = summary.treatment?.baseline;
  const fechamento = variant === 'fechamento' && base;

  return (
    <div className="ledi-charts" aria-live={live ? 'polite' : undefined}>
      {live ? (
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 12 }}>
          Gráficos ao vivo — atualizam enquanto o servidor analisa.
        </p>
      ) : null}
      {variant === 'analise' ? <CountsRow summary={summary} /> : null}
      {fechamento ? (
        <p className="muted" style={{ margin: '0 0 8px', fontSize: 13 }}>
          Campos corrigidos:{' '}
          <strong>{summary.treatment?.camposCorrigidosAcumulado ?? 0}</strong>
          {' · '}
          fichas tocadas: <strong>{summary.treatment?.fichasCorrigidasAcumulado ?? 0}</strong>
        </p>
      ) : null}
      <div className="ledi-charts-grid">
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>
            {fechamento ? 'Funil agora' : 'Funil do lote'}
          </h4>
          <FunnelBar label="Total" value={total} total={total} color="#64748b" />
          <FunnelBar label="Pronto Siaps" value={siaps} total={total} color="var(--ok)" />
          <FunnelBar label="Pronto Previne" value={previne} total={total} color="#0f766e" />
          <FunnelBar label="100% OK" value={ok100} total={total} color="var(--ok)" />
          <FunnelBar
            label="Bloqueio"
            value={t?.bloqueioEnvio ?? summary.withBlockers ?? 0}
            total={total}
            color="var(--danger)"
          />
          {variant === 'analise' ? (
            <>
              <FunnelBar
                label="Corrigem em lote"
                value={summary.autoFixableItems ?? 0}
                total={total}
                color="#2563eb"
              />
              <FunnelBar
                label="Individuais"
                value={summary.individualItems ?? 0}
                total={total}
                color="var(--warn)"
              />
            </>
          ) : null}
        </div>
        <div className="ledi-charts-pie">
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Composição</h4>
          <Pie slices={slices} />
          <ul className="ledi-charts-legend">
            {slices.map((s) => (
              <li key={s.key}>
                <span className="ledi-charts-swatch" style={{ background: s.color }} />
                {s.label} · {s.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {fechamento && base ? (
        <div style={{ marginTop: 14 }}>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Antes × depois</h4>
          <FunnelBar
            label="Bloqueio antes"
            value={base.bloqueioEnvio ?? 0}
            total={base.fichas || total}
            color="#fecaca"
          />
          <FunnelBar
            label="Bloqueio agora"
            value={t?.bloqueioEnvio ?? 0}
            total={total}
            color="var(--danger)"
          />
          <FunnelBar
            label="100% OK antes"
            value={base.ideais ?? 0}
            total={base.fichas || total}
            color="#bbf7d0"
          />
          <FunnelBar label="100% OK agora" value={t?.ideais ?? ok100} total={total} color="var(--ok)" />
        </div>
      ) : null}
    </div>
  );
}
