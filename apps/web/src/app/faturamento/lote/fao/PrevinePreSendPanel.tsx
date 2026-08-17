'use client';

type Indicator = {
  id: string;
  title: string;
  withSignal: number;
  withGap: number;
  status: 'ok' | 'gap' | 'partial' | 'n/a';
  note: string;
};

type Props = {
  files: number;
  indicators: Indicator[];
  signalRates?: {
    withIne?: number;
    vigilancia99?: number;
  };
  onFilterCode?: (code: string) => void;
  topGapCodes?: Array<{ code: string; files: number; indicator: string }>;
};

function statusLabel(s: Indicator['status']) {
  if (s === 'ok') return 'ok';
  if (s === 'partial') return 'parcial';
  if (s === 'n/a') return 'n/a';
  return 'gap';
}

function statusTone(s: Indicator['status']) {
  if (s === 'ok') return 'ok';
  if (s === 'partial') return 'brand';
  if (s === 'n/a') return '';
  return 'warn';
}

/**
 * Painel pré-envio Previne ESB B1–B6 com contagens honestas (proxy por ficha).
 * Não substitui o denominador oficial municipal — só mostra o que o lote FAO carrega.
 */
export function PrevinePreSendPanel({
  files,
  indicators,
  signalRates,
  onFilterCode,
  topGapCodes,
}: Props) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Pré-envio Previne — B1–B6</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13, lineHeight: 1.45 }}>
        Contagens <strong>honestas por ficha deste lote</strong> ({files} XML). Não são o denominador
        oficial do Previne Brasil (janela municipal/equipe). B4 = n/a na FAO (usar lote Coletivo).
      </p>

      <div className="table-wrap" style={{ marginBottom: 12 }}>
        <table className="data">
          <thead>
            <tr>
              <th>Indicador</th>
              <th>Com sinal</th>
              <th>Com gap</th>
              <th>Status</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind) => (
              <tr key={ind.id}>
                <td>
                  <strong>{ind.id}</strong> · {ind.title}
                </td>
                <td className="mono">
                  {ind.status === 'n/a' ? '—' : `${ind.withSignal}/${files}`}
                </td>
                <td className="mono">
                  {ind.status === 'n/a' ? '—' : `${ind.withGap}/${files}`}
                </td>
                <td>
                  <span className={`pill ${statusTone(ind.status)}`}>
                    {statusLabel(ind.status)}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--ink-3)' }}>{ind.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {signalRates ? (
        <p style={{ fontSize: 13, margin: '0 0 8px' }}>
          Qualidade do vínculo neste lote:{' '}
          <strong>{signalRates.withIne ?? 0}</strong> com INE ·{' '}
          <strong>{signalRates.vigilancia99 ?? 0}</strong> só vigilância 99.
        </p>
      ) : null}

      {topGapCodes && topGapCodes.length ? (
        <div style={{ fontSize: 13 }}>
          <div className="muted" style={{ marginBottom: 6 }}>
            Gaps Previne mais frequentes (clique para filtrar):
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {topGapCodes.slice(0, 8).map((c) => (
              <button
                key={c.code}
                type="button"
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '4px 8px' }}
                onClick={() => onFilterCode?.(c.code)}
              >
                {c.code} · {c.files} · {c.indicator}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
