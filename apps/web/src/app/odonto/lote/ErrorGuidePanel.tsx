'use client';

import {
  fieldsForRepairUi,
  type AlertRepair,
} from './repair-catalog';
import { resolveSeverity, severityLabel, severityTone } from './error-catalog';

type Props = {
  code: string;
  repair: AlertRepair;
  affectedCount: number;
  selectedCount: number;
  busy?: boolean;
  /** Valores dos campos dinâmicos do guia */
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onClear: () => void;
  onFixSelected: () => void;
  onFixAllAffected: () => void;
  onSelectAllVisible: () => void;
};

export function ErrorGuidePanel({
  code,
  repair,
  affectedCount,
  selectedCount,
  busy,
  fieldValues,
  onFieldChange,
  onClear,
  onFixSelected,
  onFixAllAffected,
  onSelectAllVisible,
}: Props) {
  const sev = resolveSeverity(code, repair.channel === 'PREVINE' ? 'MONEY_RISK' : 'BLOCKER');
  const tone = severityTone(sev);
  const fields = fieldsForRepairUi(repair.ui);
  const canAuto = repair.mode === 'auto' && repair.batchable !== false && repair.ui && repair.ui !== 'manual';

  return (
    <div className={`lote-guide lote-guide-${tone}`} style={{ marginTop: 14 }}>
      <div className="lote-guide-head">
        <div>
          <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
          <span className={`lote-mode ${repair.mode}`}>
            {repair.mode === 'auto' ? 'Auto-correção' : repair.mode === 'individual' ? 'Ficha a ficha' : 'Orientação'}
          </span>
          <h3 style={{ margin: '8px 0 4px' }}>{repair.title}</h3>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {affectedCount} ficha(s) com este alerta · {selectedCount} selecionada(s)
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          Fechar guia
        </button>
      </div>

      <div className="lote-guide-grid">
        <div>
          <h4 style={{ marginTop: 0 }}>O que isso significa</h4>
          <p style={{ marginTop: 0, fontSize: 14, lineHeight: 1.45 }}>{repair.why || repair.how}</p>
          <h4>O que fazer</h4>
          <p style={{ marginTop: 0, fontSize: 14, lineHeight: 1.45 }}>{repair.how}</p>
          {repair.readyGoal ? (
            <>
              <h4>Meta “pronta para o governo”</h4>
              <p style={{ marginTop: 0, fontSize: 14, lineHeight: 1.45 }}>{repair.readyGoal}</p>
            </>
          ) : null}
        </div>

        <div>
          <h4 style={{ marginTop: 0 }}>Roteiro até zerar este erro</h4>
          <ol className="lote-guide-steps">
            {(repair.steps || []).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>

          {canAuto ? (
            <div className="lote-guide-actions">
              {fields.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
                  {fields.map((f) => (
                    <div className="field" key={f.key}>
                      <label>{f.label}</label>
                      <input
                        value={fieldValues[f.key] || ''}
                        placeholder={f.placeholder}
                        onChange={(e) => onFieldChange(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted" style={{ fontSize: 13 }}>
                  Esta correção não precisa de valor extra — o sistema aplica o padrão seguro.
                </p>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy || affectedCount === 0}
                  onClick={onFixAllAffected}
                >
                  {repair.button || 'Corrigir'} · todas as {affectedCount} afetada(s)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy || selectedCount === 0}
                  onClick={onFixSelected}
                >
                  Só nas {selectedCount} selecionada(s)
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={onSelectAllVisible}>
                  Selecionar todas da lista
                </button>
              </div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 0 }}>
                Depois de aplicar, o painel de tratamento deve mostrar o contador deste erro caindo. Se sobrar
                vermelho, clique no próximo alerta.
              </p>
            </div>
          ) : null}

          {repair.mode === 'individual' ? (
            <div className="lote-guide-actions">
              <p style={{ fontSize: 14, marginTop: 0 }}>
                Não dá para corrigir em massa com segurança (dado único do cidadão/profissional ou reexportação).
              </p>
              <ol className="lote-guide-steps" style={{ marginBottom: 8 }}>
                <li>Clique numa ficha da lista filtrada à esquerda.</li>
                <li>
                  No painel da ficha, use <strong>Editar ficha</strong> / campos destacados
                  {repair.focusField ? ` (foco: ${repair.focusField})` : ''}.
                </li>
                <li>Se o erro veio do sistema antigo, corrija lá e reenvie o XML neste lote.</li>
                <li>Repita até o filtro deste erro zerar.</li>
              </ol>
              <button type="button" className="btn btn-secondary" onClick={onSelectAllVisible}>
                Destacar todas as afetadas na lista
              </button>
            </div>
          ) : null}

          {repair.mode === 'info' ? (
            <div className="lote-guide-actions">
              <p style={{ fontSize: 14, marginTop: 0 }}>
                Não bloqueia o Siaps sozinho. Use só para melhorar indicador/qualidade depois que o envio estiver
                liberado.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
