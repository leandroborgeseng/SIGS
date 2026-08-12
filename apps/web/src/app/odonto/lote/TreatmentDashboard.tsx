'use client';

import type { TreatmentProgress } from './treatment-types';
import {
  deltaDown,
  estimateRecoveredBrl,
  estimateRiskBrl,
  formatBrl,
  pct,
  ESTIMATE_BRL,
} from './treatment-estimate';

export type TreatBucket = '' | 'bloqueio' | 'risco' | 'indicadores' | 'ideal';

type Props = {
  treatment?: TreatmentProgress | null;
  readyForFinalSend?: number;
  onFilterBucket?: (bucket: TreatBucket) => void;
  activeBucket?: TreatBucket;
};

function ProgressBar({
  value,
  max,
  tone,
}: {
  value: number;
  max: number;
  tone: 'blocker' | 'money' | 'quality' | 'ok';
}) {
  const width = max ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <span className="lote-bar-track" style={{ display: 'block', marginTop: 6 }}>
      <span className={`lote-bar-fill ${tone === 'ok' ? '' : tone}`} style={{ width: `${width}%` }} />
    </span>
  );
}

export function TreatmentDashboard({
  treatment,
  readyForFinalSend = 0,
  onFilterBucket,
  activeBucket = '',
}: Props) {
  if (!treatment?.current) return null;
  const { baseline: b, current: c } = treatment;
  const total = Math.max(c.fichas, 1);
  const riscoAgora = estimateRiskBrl(c);
  const recuperado = estimateRecoveredBrl(treatment);
  const liberadas = deltaDown(b.bloqueioEnvio, c.bloqueioEnvio);
  const melhoradas = deltaDown(b.riscoFaturamento, c.riscoFaturamento);
  const alertasBaixaram =
    deltaDown(b.alertasBloqueio, c.alertasBloqueio) +
    deltaDown(b.alertasRisco, c.alertasRisco) +
    deltaDown(b.alertasIndicadores, c.alertasIndicadores);
  const ideaisPct = pct(readyForFinalSend || c.ideais, c.fichas);
  const registrosTratadosApprox = Math.round(
    (treatment.fichasCorrigidasAcumulado / Math.max(c.fichas, 1)) * c.registros,
  );

  return (
    <div className="lote-treat" style={{ marginBottom: 16 }}>
      <div className="lote-treat-head">
        <div>
          <h4 style={{ margin: 0 }}>Painel de tratamento</h4>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Meta: zerar bloqueios → reduzir risco de faturamento → maximizar fichas ideais para o governo.
            Os valores em R$ são <strong>estimativa de priorização</strong> (não tabela oficial).
          </p>
        </div>
        <div className="lote-treat-money">
          <div>
            <div className="muted" style={{ fontSize: 11 }}>
              Ainda em risco (est.)
            </div>
            <strong style={{ color: 'var(--danger)', fontSize: 20 }}>{formatBrl(riscoAgora)}</strong>
          </div>
          <div>
            <div className="muted" style={{ fontSize: 11 }}>
              Já recuperado (est.)
            </div>
            <strong style={{ color: 'var(--ok)', fontSize: 20 }}>{formatBrl(recuperado)}</strong>
          </div>
        </div>
      </div>

      <div className="lote-treat-kpis">
        <div className="lote-treat-kpi">
          <div className="muted">Linhas (fichas XML)</div>
          <strong>{c.fichas}</strong>
        </div>
        <div className="lote-treat-kpi">
          <div className="muted">Registros (atendimentos)</div>
          <strong>{c.registros}</strong>
        </div>
        <div className="lote-treat-kpi">
          <div className="muted">Fichas corrigidas nesta sessão</div>
          <strong>{treatment.fichasCorrigidasAcumulado}</strong>
          {treatment.ultimaCorrecaoQtd ? (
            <div className="muted" style={{ fontSize: 12 }}>
              última leva: −{treatment.ultimaCorrecaoQtd} tocada(s)
              {alertasBaixaram ? ` · ${alertasBaixaram} alerta(s) a menos vs início` : ''}
            </div>
          ) : null}
        </div>
        <div className="lote-treat-kpi">
          <div className="muted">Registros tocados (aprox.)</div>
          <strong>{registrosTratadosApprox}</strong>
        </div>
        <div className="lote-treat-kpi">
          <div className="muted">Ideais p/ envio</div>
          <strong>
            {readyForFinalSend || c.ideais}/{c.fichas} ({ideaisPct}%)
          </strong>
          <ProgressBar value={readyForFinalSend || c.ideais} max={total} tone="ok" />
        </div>
      </div>

      <div className="lote-treat-buckets">
        <button
          type="button"
          className={`lote-treat-bucket blocker ${activeBucket === 'bloqueio' ? 'active' : ''}`}
          onClick={() => onFilterBucket?.(activeBucket === 'bloqueio' ? '' : 'bloqueio')}
        >
          <div className="step">1º · Vermelho</div>
          <strong>Bloqueia envio</strong>
          <div className="lote-treat-nums">
            <span>{c.bloqueioEnvio} fichas</span>
            <span className="muted">{c.alertasBloqueio} alertas</span>
          </div>
          {liberadas ? (
            <div className="lote-treat-delta ok">↓ {liberadas} desde o início</div>
          ) : (
            <div className="lote-treat-delta muted">sem redução ainda</div>
          )}
          <ProgressBar value={c.bloqueioEnvio} max={Math.max(b.bloqueioEnvio, c.bloqueioEnvio, 1)} tone="blocker" />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Est. {formatBrl(c.bloqueioEnvio * ESTIMATE_BRL.porFichaBloqueada)} em produção parada
          </div>
        </button>

        <button
          type="button"
          className={`lote-treat-bucket money ${activeBucket === 'risco' ? 'active' : ''}`}
          onClick={() => onFilterBucket?.(activeBucket === 'risco' ? '' : 'risco')}
        >
          <div className="step">2º · Laranja</div>
          <strong>Não fatura bem</strong>
          <div className="lote-treat-nums">
            <span>{c.riscoFaturamento} fichas</span>
            <span className="muted">{c.alertasRisco} alertas</span>
          </div>
          {melhoradas ? (
            <div className="lote-treat-delta ok">↓ {melhoradas} desde o início</div>
          ) : (
            <div className="lote-treat-delta muted">sem redução ainda</div>
          )}
          <ProgressBar
            value={c.riscoFaturamento}
            max={Math.max(b.riscoFaturamento, c.riscoFaturamento, 1)}
            tone="money"
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
            Est. {formatBrl(c.riscoFaturamento * ESTIMATE_BRL.porFichaRisco)} em risco Previne
          </div>
        </button>

        <button
          type="button"
          className={`lote-treat-bucket quality ${activeBucket === 'indicadores' ? 'active' : ''}`}
          onClick={() => onFilterBucket?.(activeBucket === 'indicadores' ? '' : 'indicadores')}
        >
          <div className="step">3º · Verde</div>
          <strong>Indicadores / info</strong>
          <div className="lote-treat-nums">
            <span>{c.indicadores} fichas</span>
            <span className="muted">{c.alertasIndicadores} alertas</span>
          </div>
          <div className="lote-treat-delta muted">tratar por último</div>
          <ProgressBar
            value={c.indicadores}
            max={Math.max(b.indicadores, c.indicadores, 1)}
            tone="quality"
          />
        </button>

        <button
          type="button"
          className={`lote-treat-bucket ok ${activeBucket === 'ideal' ? 'active' : ''}`}
          onClick={() => onFilterBucket?.(activeBucket === 'ideal' ? '' : 'ideal')}
        >
          <div className="step">Meta</div>
          <strong>Prontas p/ governo</strong>
          <div className="lote-treat-nums">
            <span>{readyForFinalSend || c.ideais} fichas</span>
            <span className="muted">{ideaisPct}%</span>
          </div>
          <div className="lote-treat-delta ok">
            ↑ {Math.max(0, (readyForFinalSend || c.ideais) - (b.ideais || 0))} desde o início
          </div>
          <ProgressBar value={readyForFinalSend || c.ideais} max={total} tone="ok" />
        </button>
      </div>
    </div>
  );
}
