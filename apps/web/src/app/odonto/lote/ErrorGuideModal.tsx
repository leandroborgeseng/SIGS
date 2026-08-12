'use client';

import { Modal } from '@/components/ui/Modal';
import { CodeSearchSelect } from '@/components/ui/CodeSearchSelect';
import {
  fieldsForRepairUi,
  type AlertRepair,
} from './repair-catalog';
import { resolveSeverity, severityLabel } from './error-catalog';
import { JUSTIFICATIVA_NAO_POSSUI_CPF } from './justificativa-cpf';

export type AffectedFichaRow = {
  id: string;
  fileName: string;
  siapsReady?: boolean;
  previneReady?: boolean;
  topCodes?: string[];
};

type Props = {
  open: boolean;
  code: string;
  repair: AlertRepair;
  affected: AffectedFichaRow[];
  affectedTotal: number;
  busy?: boolean;
  fieldValues: Record<string, string>;
  onFieldChange: (key: string, value: string) => void;
  onClose: () => void;
  onFixAllAffected: () => void;
  onOpenFicha: (id: string) => void;
};

export function ErrorGuideModal({
  open,
  code,
  repair,
  affected,
  affectedTotal,
  busy,
  fieldValues,
  onFieldChange,
  onClose,
  onFixAllAffected,
  onOpenFicha,
}: Props) {
  const sev = resolveSeverity(code, repair.channel === 'PREVINE' ? 'MONEY_RISK' : 'BLOCKER');
  const fields = fieldsForRepairUi(repair.ui);
  const canAuto =
    repair.mode === 'auto' && repair.batchable !== false && repair.ui !== 'manual';

  return (
    <Modal
      open={open}
      size="xl"
      onClose={onClose}
      title={repair.title}
      subtitle={
        <span>
          <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>{' '}
          <span className={`lote-mode ${repair.mode}`}>
            {repair.mode === 'auto' ? 'Pode corrigir em lote' : repair.mode === 'individual' ? 'Ficha a ficha' : repair.mode === 'reexport' ? 'Só na origem' : 'Só orientação'}
          </span>{' '}
          · {affectedTotal} ficha(s) com este problema
        </span>
      }
      footer={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Voltar ao painel
          </button>
          {canAuto ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || affectedTotal === 0}
              onClick={onFixAllAffected}
            >
              {repair.button || 'Corrigir'} em todas as {affectedTotal} afetada(s)
            </button>
          ) : null}
        </div>
      }
    >
      <div className="lote-guide-grid">
          <div>
            <h4 style={{ marginTop: 0 }}>1. Entenda o problema</h4>
            <p style={{ marginTop: 0, fontSize: 14, lineHeight: 1.45 }}>{repair.why || repair.how}</p>
            <h4>2. O que fazer</h4>
            <p style={{ marginTop: 0, fontSize: 14, lineHeight: 1.45 }}>{repair.how}</p>
            {repair.readyGoal ? (
              <>
                <h4>3. Meta antes do envio</h4>
                <p style={{ marginTop: 0, fontSize: 14, lineHeight: 1.45 }}>{repair.readyGoal}</p>
              </>
            ) : null}
            <h4>Roteiro</h4>
            <ol className="lote-guide-steps">
              {(repair.steps || []).map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>

          <div>
            {canAuto ? (
              <div className="lote-guide-actions" style={{ marginTop: 0 }}>
                <h4 style={{ marginTop: 0 }}>Correção em lote</h4>
                <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
                  Preencha o que for preciso e aplique em todas as fichas com este erro. Depois confira se o
                  contador caiu no painel.
                </p>
                {fields.length ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                    {fields.map((f) =>
                      f.key === 'ciap' ? (
                        <CodeSearchSelect
                          key={f.key}
                          kind="ciap"
                          label={f.label}
                          value={fieldValues[f.key] || ''}
                          onChange={(v) => onFieldChange(f.key, v)}
                          placeholder={f.placeholder}
                        />
                      ) : f.key === 'cid10' ? (
                        <CodeSearchSelect
                          key={f.key}
                          kind="cid10"
                          label={f.label}
                          value={fieldValues[f.key] || ''}
                          onChange={(v) => onFieldChange(f.key, v)}
                          placeholder={f.placeholder}
                        />
                      ) : f.key === 'justificativa' ? (
                        <div className="field" key={f.key} style={{ gridColumn: '1 / -1' }}>
                          <label>{f.label}</label>
                          <select
                            value={fieldValues[f.key] || ''}
                            onChange={(e) => onFieldChange(f.key, e.target.value)}
                          >
                            <option value="">Selecione o motivo…</option>
                            {JUSTIFICATIVA_NAO_POSSUI_CPF.map((opt) => (
                              <option key={opt.code} value={String(opt.code)}>
                                {opt.code} — {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : f.key === 'justificativaUnexpected' ? (
                        <div className="field" key={f.key} style={{ gridColumn: '1 / -1' }}>
                          <label>{f.label}</label>
                          <select
                            value={fieldValues[f.key] || ''}
                            onChange={(e) => onFieldChange(f.key, e.target.value)}
                          >
                            <option value="">Escolha a correção…</option>
                            <option value="remove">Remover justificativa</option>
                            <option value="force_st">Marcar “não possui CPF” (st=true)</option>
                          </select>
                        </div>
                      ) : (
                        <div className="field" key={f.key}>
                          <label>{f.label}</label>
                          <input
                            value={fieldValues[f.key] || ''}
                            placeholder={f.placeholder}
                            onChange={(e) => onFieldChange(f.key, e.target.value)}
                          />
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Não precisa de valor extra — o sistema aplica o padrão seguro.
                  </p>
                )}
              </div>
            ) : null}

            {repair.mode === 'individual' || repair.mode === 'reexport' ? (
              <div className="lote-guide-actions" style={{ marginTop: 0 }}>
                <h4 style={{ marginTop: 0 }}>
                  {repair.mode === 'reexport' ? 'Reexportar / outro fluxo' : 'Correção ficha a ficha'}
                </h4>
                <p style={{ fontSize: 14, marginTop: 0 }}>
                  {repair.mode === 'reexport'
                    ? 'Este erro depende de reexportação ou de enviar a ficha na tela do tipo certo. Exclua do lote ou corrija na origem.'
                    : 'Este erro depende de dado único (CPF, CNS, data…) ou de reexportação. Abra cada ficha na lista abaixo, corrija os campos e salve.'}
                </p>
              </div>
            ) : null}

            {repair.mode === 'info' ? (
              <div className="lote-guide-actions" style={{ marginTop: 0 }}>
                <h4 style={{ marginTop: 0 }}>Orientação</h4>
                <p style={{ fontSize: 14, marginTop: 0 }}>
                  Não bloqueia o envio sozinho. Trate depois dos bloqueios vermelhos e dos riscos laranja.
                </p>
              </div>
            ) : null}

            <h4 style={{ marginTop: 16 }}>Fichas com este erro</h4>
            <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
              Clique numa linha para abrir a ficha completa e corrigir antes do envio.
            </p>
            <div className="lote-modal-list">
              {affected.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="lote-modal-list-item"
                  onClick={() => onOpenFicha(it.id)}
                >
                  <span>
                    <strong>{it.fileName}</strong>
                    <div className="muted" style={{ fontSize: 12 }}>
                      Siaps {it.siapsReady ? 'ok' : 'bloqueia'} · Previne {it.previneReady ? 'ok' : 'risco'}
                    </div>
                  </span>
                  <span className="btn btn-secondary" style={{ pointerEvents: 'none', fontSize: 12 }}>
                    Abrir ficha
                  </span>
                </button>
              ))}
              {!affected.length ? <p className="muted">Nenhuma ficha neste filtro (já pode ter sido corrigida).</p> : null}
              {affectedTotal > affected.length ? (
                <p className="muted" style={{ fontSize: 12 }}>
                  Mostrando {affected.length} de {affectedTotal}. As demais seguem o mesmo padrão.
                </p>
              ) : null}
            </div>
          </div>
        </div>
    </Modal>
  );
}
