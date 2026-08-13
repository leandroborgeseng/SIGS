'use client';

export type LotQualitySnapshot = {
  total: number;
  siapsReady?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  withBlockers?: number;
};

type Props = {
  current: LotQualitySnapshot;
  /** Snapshot do início do tratamento do lote (para mostrar ganho). */
  baseline?: LotQualitySnapshot | null;
  /** Compacto no topo do modal. */
  dense?: boolean;
};

function pct(n: number | undefined, total: number) {
  if (!total) return 0;
  return Math.round(((n || 0) / total) * 100);
}

function delta(curr: number | undefined, base: number | undefined) {
  if (curr == null || base == null) return null;
  const d = curr - base;
  if (d === 0) return null;
  return d;
}

function DeltaBadge({ d, goodUp = true }: { d: number | null; goodUp?: boolean }) {
  if (d == null) return null;
  const up = d > 0;
  const good = goodUp ? up : !up;
  return (
    <span
      style={{
        marginLeft: 4,
        fontSize: 11,
        fontWeight: 600,
        color: good ? '#166534' : '#b91c1c',
      }}
    >
      {up ? '↑' : '↓'}
      {Math.abs(d)}
    </span>
  );
}

function MiniBar({
  value,
  total,
  tone,
  label,
}: {
  value: number;
  total: number;
  tone: 'ok' | 'money' | 'blocker' | 'quality';
  label: string;
}) {
  const width = total ? Math.min(100, Math.round((value / total) * 1000) / 10) : 0;
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          marginBottom: 2,
          gap: 8,
        }}
      >
        <span className="muted">{label}</span>
        <span>
          {value}/{total} ({pct(value, total)}%)
        </span>
      </div>
      <div className="lote-bar-track" style={{ height: 6 }}>
        <span
          className={`lote-bar-fill ${tone === 'ok' ? '' : tone}`}
          style={{
            width: `${width}%`,
            ...(tone === 'ok' ? { background: '#22c55e' } : {}),
          }}
        />
      </div>
    </div>
  );
}

/**
 * Mini-dashboard no topo dos modais de correção:
 * mostra evolução Siaps / Previne / envio final enquanto o operador corrige.
 */
export function ModalQualityMiniDash({ current, baseline, dense }: Props) {
  const total = current.total || 0;
  const siaps = current.siapsReady ?? 0;
  const previne = current.previneReady ?? 0;
  const finalOk = current.readyForFinalSend ?? 0;
  const blockers = current.withBlockers ?? Math.max(0, total - siaps);

  const dSiaps = delta(siaps, baseline?.siapsReady);
  const dPrevine = delta(previne, baseline?.previneReady);
  const dFinal = delta(finalOk, baseline?.readyForFinalSend);
  const dBlock = delta(blockers, baseline?.withBlockers);

  return (
    <div
      className="modal-quality-mini"
      style={{
        marginBottom: dense ? 10 : 14,
        padding: dense ? '10px 12px' : '12px 14px',
        borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--surface-2)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 8,
          alignItems: 'baseline',
        }}
      >
        <strong style={{ fontSize: 13 }}>Qualidade do lote → governo</strong>
        <span className="muted" style={{ fontSize: 12 }}>
          Atualiza a cada correção · setas = ganho desde o início do lote
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div>
          <div className="muted" style={{ fontSize: 11 }}>
            Total
          </div>
          <strong style={{ fontSize: 16 }}>{total}</strong>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>
            <span className="lote-sev BLOCKER" style={{ marginRight: 4 }}>
              Bloqueio
            </span>
          </div>
          <strong style={{ fontSize: 16 }}>
            {blockers}
            <DeltaBadge d={dBlock} goodUp={false} />
          </strong>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>
            Prontas Siaps
          </div>
          <strong style={{ fontSize: 16 }}>
            {siaps}{' '}
            <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              ({pct(siaps, total)}%)
            </span>
            <DeltaBadge d={dSiaps} />
          </strong>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>
            Prontas Previne
          </div>
          <strong style={{ fontSize: 16 }}>
            {previne}{' '}
            <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              ({pct(previne, total)}%)
            </span>
            <DeltaBadge d={dPrevine} />
          </strong>
        </div>
        <div>
          <div className="muted" style={{ fontSize: 11 }}>
            Envio final OK
          </div>
          <strong style={{ fontSize: 16, color: '#166534' }}>
            {finalOk}{' '}
            <span className="muted" style={{ fontSize: 12, fontWeight: 400, color: 'inherit' }}>
              ({pct(finalOk, total)}%)
            </span>
            <DeltaBadge d={dFinal} />
          </strong>
        </div>
      </div>

      <MiniBar value={siaps} total={total} tone="ok" label="Siaps (podem enviar)" />
      <MiniBar value={previne} total={total} tone="money" label="Previne (qualidade da informação)" />
      <MiniBar value={finalOk} total={total} tone="quality" label="Envio final OK (Siaps + Previne)" />

      <p className="muted" style={{ margin: '8px 0 0', fontSize: 11, lineHeight: 1.4 }}>
        Meta: subir <strong>Envio final OK</strong>. Siaps alto com Previne baixo = já envia, mas a
        qualidade da informação ainda está incompleta.
      </p>
    </div>
  );
}

/** Monta baseline aproximada a partir do tratamento (início do lote). */
export function baselineFromTreatment(
  total: number,
  treatment?: {
    baseline?: { bloqueioEnvio?: number; ideais?: number; fichas?: number };
  } | null,
  current?: LotQualitySnapshot,
): LotQualitySnapshot | null {
  const b = treatment?.baseline;
  if (!b || !total) return null;
  const fichas = b.fichas || total;
  const blockers = b.bloqueioEnvio ?? 0;
  return {
    total: fichas,
    withBlockers: blockers,
    siapsReady: Math.max(0, fichas - blockers),
    // Sem previne no baseline de tratamento — usa current como fallback neutro
    previneReady: current?.previneReady,
    readyForFinalSend: b.ideais ?? 0,
  };
}
