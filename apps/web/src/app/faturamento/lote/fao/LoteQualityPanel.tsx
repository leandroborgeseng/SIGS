'use client';

type Props = {
  total: number;
  siapsReady?: number;
  previneReady?: number;
  readyForFinalSend?: number;
  /** FAO | FAI | PROC — só muda o texto do “total” */
  fichaLabel?: string;
  /** FAO usa Previne ESB B1–B6; FAI/PROC falam qualidade LEDI (sem odonto). */
  kind?: 'fao' | 'fai' | 'proc';
  /** Fichas com aviso de qualidade (MONEY_RISK / QUALITY_WARN), útil no FAI. */
  withWarn?: number;
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
  kind = 'fao',
  withWarn,
}: Props) {
  const isFao = kind === 'fao';
  const pSiaps = pct(siapsReady, total);
  const pPrevine = pct(previneReady, total);
  const pFinal = pct(readyForFinalSend, total);
  const soEnvio = Math.max(0, (siapsReady || 0) - (readyForFinalSend || 0));
  const qualityGaps = withWarn ?? Math.max(0, (siapsReady || 0) - (readyForFinalSend || 0));
  const pQuality = pct(qualityGaps, total);
  const col3Label = isFao ? 'Pronto Previne' : 'Alerta qualidade';
  const col3Value = isFao ? previneReady : qualityGaps;
  const col3Pct = isFao ? pPrevine : pQuality;

  return (
    <div className="lote-quality-panel" style={{ marginBottom: 16 }}>
      <div className="lote-funnel">
        <div className="lote-funnel-item">
          <div className="muted">Total fichas</div>
          <strong>{total}</strong>
        </div>
        <div className="lote-funnel-item">
          <div className="muted">Pronto Siaps</div>
          <strong>
            {siapsReady ?? '—'}
            <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
              {' '}
              ({pSiaps}%)
            </span>
          </strong>
        </div>
        <div className="lote-funnel-item">
          <div className="muted">{col3Label}</div>
          <strong>
            {col3Value ?? '—'}
            <span className="muted" style={{ fontSize: 13, fontWeight: 400 }}>
              {' '}
              ({col3Pct}%)
            </span>
          </strong>
        </div>
        <div className="lote-funnel-item">
          <div className="muted">100% OK</div>
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
          <strong>com qual qualidade</strong>
          {isFao ? ' (produção aceita × indicadores Previne ESB).' : ' (produção aceita × alertas LEDI).'}
        </p>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li style={{ marginBottom: 6 }}>
            <strong>Total fichas ({total})</strong> — {fichaLabel}s neste lote (cada XML = uma ficha).
          </li>
          <li style={{ marginBottom: 6 }}>
            <strong>Prontas Siaps ({siapsReady ?? 0} · {pSiaps}%)</strong> — sem bloqueio LEDI (BLOCKER = 0).
            Estas <em>podem ser enviadas</em> ao Siaps/SISAB. Enviar aqui = produção contabilizada
            {isFao ? (
              <>
                , <em>não</em> garante indicador Previne.
              </>
            ) : (
              '.'
            )}
          </li>
          {isFao ? (
            <li style={{ marginBottom: 6 }}>
              <strong>Prontas Previne ({previneReady ?? 0} · {pPrevine}%)</strong> — sem alerta de
              qualidade Previne ESB (INE, B1–B6, vigilância etc.). Uma ficha pode estar no Siaps e ainda
              assim fora do Previne.
            </li>
          ) : (
            <li style={{ marginBottom: 6 }}>
              <strong>Alerta qualidade ({qualityGaps} · {pQuality}%)</strong> — fichas que enviam (ou quase)
              mas ainda têm aviso LEDI (INE, dados incompletos). Não é indicador de saúde bucal (B1–B6).
            </li>
          )}
          <li style={{ marginBottom: 6 }}>
            <strong>Envio final OK ({readyForFinalSend ?? 0} · {pFinal}%)</strong>
            {isFao
              ? ' — Siaps e Previne ok. É o ZIP “conformes” recomendado: envio com qualidade.'
              : ' — sem BLOCKER (e sem risco extra). ZIP “só conformes” recomendado para o envio.'}
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
          {isFao && soEnvio > 0 ? (
            <>
              ; dessas, <strong>{soEnvio}</strong> ainda têm qualidade Previne incompleta
            </>
          ) : !isFao && qualityGaps > 0 ? (
            <>
              ; <strong>{qualityGaps}</strong> ainda com alerta de qualidade
            </>
          ) : null}
          . O alvo ideal de fechamento é subir o <strong>Envio final OK</strong> ({pFinal}% agora).
          Ordem: vermelho (bloqueio) → laranja (qualidade) → verde (indicadores).
        </p>
      </div>
    </div>
  );
}
