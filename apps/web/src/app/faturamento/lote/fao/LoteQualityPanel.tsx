'use client';

type Props = {
  total: number;
  siapsReady?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  /** FAO | FAI | PROC — só muda o texto do “total” */
  fichaLabel?: string;
};

function pct(n: number | undefined, total: number) {
  if (!total) return 0;
  return Math.round(((n || 0) / total) * 100);
}

/**
 * Legenda operacional do funil Siaps × Previne × envio final.
 * Fica na tela para quem processa o lote saber o que está enviando e com qual qualidade.
 */
export function LoteQualityPanel({
  total,
  siapsReady,
  previneReady,
  readyForFinalSend,
  fichaLabel = 'ficha',
}: Props) {
  const pSiaps = pct(siapsReady, total);
  const pPrevine = pct(previneReady, total);
  const pFinal = pct(readyForFinalSend, total);
  const soEnvio = Math.max(0, (siapsReady || 0) - (readyForFinalSend || 0));

  return (
    <div className="lote-quality-panel" style={{ marginBottom: 16 }}>
      <div className="lote-funnel">
        <div className="lote-funnel-item">
          <div className="muted">Total fichas</div>
          <strong>{total}</strong>
        </div>
        <div className="lote-funnel-item">
          <div className="muted">Prontas Siaps</div>
          <strong>
            {siapsReady ?? '—'}
            <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
              {' '}
              ({pSiaps}%)
            </span>
          </strong>
        </div>
        <div className="lote-funnel-item">
          <div className="muted">Prontas Previne</div>
          <strong>
            {previneReady ?? '—'}
            <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
              {' '}
              ({pPrevine}%)
            </span>
          </strong>
        </div>
        <div className="lote-funnel-item">
          <div className="muted">Envio final OK</div>
          <strong>
            {readyForFinalSend ?? '—'}
            <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
              {' '}
              ({pFinal}%)
            </span>
          </strong>
        </div>
      </div>

      <div
        role="note"
        aria-label="Legenda da qualidade do envio"
        style={{
          marginTop: 10,
          padding: '14px 16px',
          borderRadius: 8,
          border: '1px solid var(--line)',
          background: 'var(--surface-2)',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <strong style={{ display: 'block', marginBottom: 6, fontSize: 15 }}>
          Qualidade do que você está enviando
        </strong>
        <p style={{ margin: '0 0 10px' }}>
          Este resumo mostra <strong>quanto do lote pode ir ao governo</strong> e{' '}
          <strong>com qual qualidade</strong> (produção aceita × indicadores Previne).
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>Total fichas ({total})</strong> — {fichaLabel}s neste lote (cada XML = uma ficha).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Prontas Siaps ({siapsReady ?? 0} · {pSiaps}%)</strong> — sem bloqueio LEDI (BLOCKER = 0).
            Estas <em>podem ser enviadas</em> ao Siaps/SISAB. Enviar aqui = produção contabilizada,{' '}
            <em>não</em> garante indicador Previne.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Prontas Previne ({previneReady ?? 0} · {pPrevine}%)</strong> — sem alerta de
            qualidade Previne ESB (INE, B1–B6, vigilância etc.). Uma ficha pode estar no Siaps e ainda
            assim fora do Previne.
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Envio final OK ({readyForFinalSend ?? 0} · {pFinal}%)</strong> — Siaps <em>e</em>{' '}
            Previne ok. É o ZIP “conformes” recomendado: envio com qualidade.
          </li>
        </ul>
        <p
          style={{
            margin: '12px 0 0',
            padding: '10px 12px',
            borderRadius: 6,
            background: 'var(--surface)',
            border: '1px solid var(--line)',
            fontSize: 13,
          }}
        >
          <strong>Leitura deste lote:</strong> {pSiaps}% já podem ir ao Siaps
          {soEnvio > 0 ? (
            <>
              ; dessas, <strong>{soEnvio}</strong> ainda têm qualidade Previne incompleta
            </>
          ) : null}
          . O alvo ideal de fechamento é subir o <strong>Envio final OK</strong> ({pFinal}% agora).
          Ordem: vermelho (bloqueio) → laranja (qualidade) → verde (indicadores).
        </p>
      </div>
    </div>
  );
}
