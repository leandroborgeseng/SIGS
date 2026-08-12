'use client';

import { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { CodeSearchSelect } from '@/components/ui/CodeSearchSelect';
import { lookupRepair } from './repair-catalog';
import {
  resolveSeverity,
  severityLabel,
  severityRank,
  severityTone,
} from './error-catalog';

type FindingLike = {
  code: string;
  severity?: string;
  message?: string;
};

type GapLike = {
  code: string;
  severity: string;
  message?: string;
};

type SelectedFicha = {
  id: string;
  fileName: string;
  status: string;
  fichaTipo?: string | null;
  fichaTipoLabel?: string | null;
  fichaTipoCode?: number | null;
  correctionPath?: string | null;
  odontoLoteSupported?: boolean;
  siapsReady?: boolean;
  previneReady?: boolean;
  readyForFinalSend?: boolean;
  findings: FindingLike[];
  previneXray?: { gaps: GapLike[] } | null;
};

type FormState = {
  ciap: string;
  cid10: string;
  editIne: string;
  editCbo: string;
  vigilancia: string;
  tipoConsulta: string;
  turno: string;
  gestante: string;
  localAtend: string;
  cnes: string;
  ibge: string;
  procExtra: string;
  focusField: string;
};

type Props = {
  open: boolean;
  selected: SelectedFicha | null;
  busy?: boolean;
  form: FormState;
  setForm: (patch: Partial<FormState>) => void;
  onClose: () => void;
  onSave: (e: FormEvent) => void;
  onApplyGap: (code: string) => void;
  onFocusField: (field?: string) => void;
};

export function FichaFixModal({
  open,
  selected,
  busy,
  form,
  setForm,
  onClose,
  onSave,
  onApplyGap,
  onFocusField,
}: Props) {
  if (!selected) return null;

  const alerts = [
    ...selected.findings.filter((f) => !String(f.code).startsWith('PREVINE_')),
    ...(selected.previneXray?.gaps.filter(
      (g) => g.severity !== 'INFO' || g.code !== 'PREVINE_B4_NOT_IN_FAO',
    ) || []),
  ]
    .map((f) => {
      const code = f.code;
      const sev = (f.severity ? String(f.severity) : resolveSeverity(code)) || '';
      return { f, code, sev };
    })
    .sort((a, b) => severityRank(a.sev) - severityRank(b.sev));

  return (
    <Modal
      open={open}
      size="xl"
      layer={2}
      closeOnBackdrop={false}
      onClose={onClose}
      title={`Corrigir ficha · ${selected.fileName}`}
      subtitle={
        <span className="muted">
          {selected.fichaTipoLabel || selected.fichaTipo || '—'}
          {selected.fichaTipoCode != null ? ` (${selected.fichaTipoCode})` : ''} · Siaps{' '}
          {selected.siapsReady ? 'ok' : 'bloqueia'} · Previne {selected.previneReady ? 'ok' : 'risco'} · Envio{' '}
          {selected.readyForFinalSend ? 'recomendado' : 'ainda não'}
        </span>
      }
      footer={
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={(e) => onSave(e as unknown as FormEvent)}>
            Salvar e revalidar
          </button>
        </div>
      }
    >
      {selected.odontoLoteSupported === false ? (
        <div className="alert danger" style={{ marginBottom: 12 }}>
          Esta ficha <strong>não é FAO</strong>. Use o fluxo do tipo indicado
          {selected.correctionPath ? `: ${selected.correctionPath}` : ''}.
        </div>
      ) : null}

      <div className="lote-ficha-modal-grid">
        <div>
          <h4 style={{ marginTop: 0 }}>Alertas desta ficha</h4>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Comece pelos vermelhos. Auto = um clique. Individual = preencha à direita e salve.
          </p>
          <div className="lote-modal-list" style={{ maxHeight: 360 }}>
            {alerts.map(({ f, code, sev }, i) => {
              const guide = lookupRepair(code);
              const mode = guide?.mode || 'individual';
              const tone = severityTone(sev);
              return (
                <div key={`${code}-${i}`} className={`lote-alert-row ${tone}`} style={{ padding: 10, marginBottom: 8, borderRadius: 8 }}>
                  <span className={`lote-mode ${mode}`}>
                    {mode === 'auto' ? 'Auto' : mode === 'individual' ? 'Individual' : 'Info'}
                  </span>
                  <span className={`lote-sev ${sev}`}>{severityLabel(sev)}</span>
                  <div style={{ marginTop: 6 }}>
                    <strong>{guide?.title || code}</strong>
                  </div>
                  {guide?.how ? <div className="muted" style={{ fontSize: 13 }}>{guide.how}</div> : null}
                  {'message' in f && f.message && !guide?.how ? (
                    <div className="muted" style={{ fontSize: 13 }}>{f.message}</div>
                  ) : null}
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {mode === 'auto' && guide?.button ? (
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={busy}
                        style={{ fontSize: 12 }}
                        onClick={() => onApplyGap(code)}
                      >
                        {guide.button}
                      </button>
                    ) : null}
                    {mode === 'individual' ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ fontSize: 12 }}
                        onClick={() => onFocusField(guide?.focusField)}
                      >
                        Destacar campo
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!alerts.length ? <p className="muted">Nenhum alerta restante nesta ficha.</p> : null}
          </div>
        </div>

        <form onSubmit={onSave}>
          <h4 style={{ marginTop: 0 }}>Campos para corrigir</h4>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Preencha só o que o alerta pedir. Depois clique em “Salvar e revalidar”.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className={form.focusField === 'ciap' ? 'focus-hint' : undefined}>
              <CodeSearchSelect
                kind="ciap"
                label="CIAP (problema)"
                value={form.ciap}
                onChange={(v) => setForm({ ciap: v })}
              />
            </div>
            <CodeSearchSelect
              kind="cid10"
              label="CID-10"
              value={form.cid10}
              onChange={(v) => setForm({ cid10: v })}
            />
            <div className={`field ${form.focusField === 'ine' ? 'focus-hint' : ''}`}>
              <label>Código da equipe (INE)</label>
              <input value={form.editIne} onChange={(e) => setForm({ editIne: e.target.value })} />
            </div>
            <div className={`field ${form.focusField === 'cbo' ? 'focus-hint' : ''}`}>
              <label>CBO</label>
              <input value={form.editCbo} onChange={(e) => setForm({ editCbo: e.target.value })} />
            </div>
            <div className={`field ${form.focusField === 'vigilancia' ? 'focus-hint' : ''}`}>
              <label>Vigilância</label>
              <input value={form.vigilancia} onChange={(e) => setForm({ vigilancia: e.target.value })} />
            </div>
            <div className={`field ${form.focusField === 'consulta' ? 'focus-hint' : ''}`}>
              <label>Tipo de consulta</label>
              <select value={form.tipoConsulta} onChange={(e) => setForm({ tipoConsulta: e.target.value })}>
                <option value="1">1 — 1ª consulta</option>
                <option value="2">2 — retorno</option>
                <option value="4">4</option>
              </select>
            </div>
            <div className={`field ${form.focusField === 'turno' ? 'focus-hint' : ''}`}>
              <label>Turno</label>
              <select value={form.turno} onChange={(e) => setForm({ turno: e.target.value })}>
                <option value="1">1 manhã</option>
                <option value="2">2 tarde</option>
                <option value="3">3 noite</option>
              </select>
            </div>
            <div className={`field ${form.focusField === 'gestante' ? 'focus-hint' : ''}`}>
              <label>Gestante</label>
              <select value={form.gestante} onChange={(e) => setForm({ gestante: e.target.value })}>
                <option value="false">Não</option>
                <option value="true">Sim</option>
              </select>
            </div>
            <div className={`field ${form.focusField === 'local' ? 'focus-hint' : ''}`}>
              <label>Local de atendimento</label>
              <input value={form.localAtend} onChange={(e) => setForm({ localAtend: e.target.value })} />
            </div>
            <div className={`field ${form.focusField === 'cnes' ? 'focus-hint' : ''}`}>
              <label>CNES (7 dígitos)</label>
              <input value={form.cnes} onChange={(e) => setForm({ cnes: e.target.value })} />
            </div>
            <div className={`field ${form.focusField === 'ibge' ? 'focus-hint' : ''}`}>
              <label>IBGE município</label>
              <input value={form.ibge} onChange={(e) => setForm({ ibge: e.target.value })} />
            </div>
            <div className={`field ${form.focusField === 'proc' ? 'focus-hint' : ''}`} style={{ gridColumn: '1 / -1' }}>
              <label>Procedimentos SIGTAP extras</label>
              <input
                value={form.procExtra}
                onChange={(e) => setForm({ procExtra: e.target.value })}
                placeholder="0301010153,0101020104"
              />
            </div>
            {form.focusField === 'xml' ? (
              <div className="field focus-hint" style={{ gridColumn: '1 / -1' }}>
                <label>
                  Este alerta exige ajuste no XML de origem (CPF/CNS/data/UUID). Corrija no sistema legado,
                  reexporte e reenvie o arquivo neste lote.
                </label>
              </div>
            ) : null}
          </div>
        </form>
      </div>
    </Modal>
  );
}
