'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

export type OdontogramCondition = { code: string; label: string };

export type OdontogramArches = {
  upperPermanent: string[];
  lowerPermanent: string[];
  upperDeciduous: string[];
  lowerDeciduous: string[];
};

export type OdontogramScopes = {
  quadrants: OdontogramCondition[];
  sextants: OdontogramCondition[];
  mouth: OdontogramCondition;
};

export type OdontogramFaceDef = { code: string; label: string };
export type OdontogramFaceNeed = { code: string; label: string };
export type OdontogramFacesMap = Record<string, Partial<Record<string, string>>>;

/** Indicadores visuais de procedimentos SIGTAP por dente/escopo (não altera careJson). */
export type OdontogramProcedureMark = {
  planned?: number;
  done?: number;
};

type Props = {
  value: Record<string, string>;
  conditions: OdontogramCondition[];
  arches: OdontogramArches;
  scopes?: OdontogramScopes;
  faces?: OdontogramFaceDef[];
  faceNeeds?: OdontogramFaceNeed[];
  facesValue?: OdontogramFacesMap;
  onChangeFaces?: (next: OdontogramFacesMap) => void;
  toothNote?: string;
  onChangeToothNote?: (note: string) => void;
  selectedKey?: string;
  onSelectKey?: (key: string) => void;
  onChange?: (next: Record<string, string>) => void;
  disabled?: boolean;
  showDeciduous?: boolean;
  /** Snapshot somente leitura (RF-12.11) — esconde o editor de condição. */
  hideEditor?: boolean;
  /** Planejado / realizado por chave FDI ou escopo (Q/S/BOCA). */
  procedureMarks?: Record<string, OdontogramProcedureMark>;
};

const CONDITION_COLOR: Record<string, string> = {
  C: '#c45c26',
  R: '#1d6fb8',
  E: '#6b7280',
  F: '#b45309',
  S: '#0d9488',
  T: '#0f766e',
  P: '#be185d',
  X: '#dc2626',
  O: '#4b5563',
};

const FACE_NEED_COLOR: Record<string, string> = {
  AM: '#b45309',
  RE: '#1d6fb8',
  CA: '#c45c26',
  SE: '#0d9488',
  FR: '#a16207',
  OU: '#4b5563',
};

function ToothButton({
  tooth,
  code,
  faceCount,
  planned,
  done,
  selected,
  disabled,
  onSelect,
}: {
  tooth: string;
  code?: string;
  faceCount?: number;
  planned?: number;
  done?: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const bg = code ? CONDITION_COLOR[code] || '#334155' : undefined;
  const titleParts = [
    code ? `${tooth}: ${code}` : tooth,
    faceCount ? `${faceCount} face(s)` : null,
    planned ? `${planned} planejado(s)` : null,
    done ? `${done} realizado(s)` : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className={[
        'odg-tooth',
        code ? 'is-marked' : '',
        selected ? 'is-selected' : '',
        disabled ? 'is-disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      onClick={onSelect}
      title={titleParts.join(' · ')}
      aria-pressed={selected}
      style={
        code
          ? ({
              '--odg-tooth-bg': bg,
              '--odg-tooth-fg': '#fff',
            } as CSSProperties)
          : undefined
      }
      data-condition={code || undefined}
    >
      <span className="odg-tooth__num">{tooth}</span>
      {code ? <span className="odg-tooth__code">{code}</span> : null}
      <span className="odg-tooth__marks" aria-hidden>
        {!!faceCount && <i className="odg-dot odg-dot--face" title="Faces" />}
        {!!planned && <i className="odg-dot odg-dot--planned" title="Planejado" />}
        {!!done && <i className="odg-dot odg-dot--done" title="Realizado" />}
      </span>
    </button>
  );
}

function ScopeChip({
  code,
  label,
  marked,
  planned,
  done,
  selected,
  disabled,
  onSelect,
}: {
  code: string;
  label: string;
  marked?: string;
  planned?: number;
  done?: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const bg = marked ? CONDITION_COLOR[marked] || '#334155' : undefined;
  return (
    <button
      type="button"
      className={[
        'odg-scope',
        marked ? 'is-marked' : '',
        selected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      onClick={onSelect}
      title={[
        marked ? `${label}: ${marked}` : label,
        planned ? `${planned} planejado(s)` : null,
        done ? `${done} realizado(s)` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      aria-pressed={selected}
      style={
        marked
          ? ({
              '--odg-scope-bg': bg,
              '--odg-scope-fg': '#fff',
            } as CSSProperties)
          : undefined
      }
    >
      <span className="odg-scope__code">{code}</span>
      {marked ? <span className="odg-scope__mark">{marked}</span> : null}
      {(planned || done) && (
        <span className="odg-scope__proc" aria-hidden>
          {!!planned && <i className="odg-dot odg-dot--planned" />}
          {!!done && <i className="odg-dot odg-dot--done" />}
        </span>
      )}
    </button>
  );
}

function ArchRow({
  teeth,
  value,
  facesValue,
  procedureMarks,
  selectedKey,
  disabled,
  onSelectKey,
}: {
  teeth: string[];
  value: Record<string, string>;
  facesValue?: OdontogramFacesMap;
  procedureMarks?: Record<string, OdontogramProcedureMark>;
  selectedKey: string;
  disabled?: boolean;
  onSelectKey: (t: string) => void;
}) {
  const mid = Math.floor(teeth.length / 2);
  return (
    <div className="odg-arch-row">
      <div className="odg-arch-half">
        {teeth.slice(0, mid).map((t) => (
          <ToothButton
            key={t}
            tooth={t}
            code={value[t]}
            faceCount={facesValue?.[t] ? Object.keys(facesValue[t]!).length : 0}
            planned={procedureMarks?.[t]?.planned}
            done={procedureMarks?.[t]?.done}
            selected={selectedKey === t}
            disabled={disabled}
            onSelect={() => onSelectKey(t)}
          />
        ))}
      </div>
      <span className="odg-midline" aria-hidden />
      <div className="odg-arch-half">
        {teeth.slice(mid).map((t) => (
          <ToothButton
            key={t}
            tooth={t}
            code={value[t]}
            faceCount={facesValue?.[t] ? Object.keys(facesValue[t]!).length : 0}
            planned={procedureMarks?.[t]?.planned}
            done={procedureMarks?.[t]?.done}
            selected={selectedKey === t}
            disabled={disabled}
            onSelect={() => onSelectKey(t)}
          />
        ))}
      </div>
    </div>
  );
}

/** Cruz 5 faces: V cima · M esquerda · O centro · D direita · L baixo. */
function FaceCross({
  tooth,
  faces,
  faceDefs,
  faceNeeds,
  selectedFace,
  onSelectFace,
  disabled,
}: {
  tooth: string;
  faces: Partial<Record<string, string>>;
  faceDefs: OdontogramFaceDef[];
  faceNeeds: OdontogramFaceNeed[];
  selectedFace: string;
  onSelectFace: (face: string) => void;
  disabled?: boolean;
}) {
  const byCode = Object.fromEntries(faceDefs.map((f) => [f.code, f]));
  const cell = (code: string) => {
    const need = faces[code];
    const bg = need ? FACE_NEED_COLOR[need] || '#334155' : undefined;
    const def = byCode[code];
    return (
      <button
        type="button"
        className={[
          'odg-face',
          need ? 'is-marked' : '',
          selectedFace === code ? 'is-selected' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        disabled={disabled}
        onClick={() => onSelectFace(code)}
        title={
          need
            ? `${def?.label || code}: ${faceNeeds.find((n) => n.code === need)?.label || need}`
            : def?.label || code
        }
        aria-pressed={selectedFace === code}
        style={
          need
            ? ({
                '--odg-face-bg': bg,
                '--odg-face-fg': '#fff',
              } as CSSProperties)
            : undefined
        }
      >
        <span className="odg-face__code">{code}</span>
        {need ? <span className="odg-face__need">{need}</span> : null}
      </button>
    );
  };

  return (
    <div className="odg-face-cross">
      <div className="odg-face-cross__title">
        Faces · dente <strong className="mono">{tooth}</strong>
        <span className="odg-face-cross__hint">clínico (careJson)</span>
      </div>
      <div className="odg-face-grid" role="group" aria-label={`Faces do dente ${tooth}`}>
        <span />
        {cell('V')}
        <span />
        {cell('M')}
        {cell('O')}
        {cell('D')}
        <span />
        {cell('L')}
        <span />
      </div>
    </div>
  );
}

function Legend({
  conditions,
  faceNeeds,
}: {
  conditions: OdontogramCondition[];
  faceNeeds?: OdontogramFaceNeed[];
}) {
  return (
    <div className="odg-legend">
      <div className="odg-legend__block">
        <span className="odg-legend__label">Condições</span>
        <ul className="odg-legend__list">
          {conditions.map((c) => (
            <li key={c.code}>
              <i
                className="odg-swatch"
                style={{ background: CONDITION_COLOR[c.code] || '#334155' }}
                aria-hidden
              />
              <span className="mono">{c.code}</span>
              <span className="odg-legend__name">{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
      {faceNeeds && faceNeeds.length > 0 ? (
        <div className="odg-legend__block">
          <span className="odg-legend__label">Faces</span>
          <ul className="odg-legend__list">
            {faceNeeds.map((n) => (
              <li key={n.code}>
                <i
                  className="odg-swatch"
                  style={{ background: FACE_NEED_COLOR[n.code] || '#334155' }}
                  aria-hidden
                />
                <span className="mono">{n.code}</span>
                <span className="odg-legend__name">{n.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="odg-legend__block odg-legend__block--marks">
        <span className="odg-legend__label">Marcas</span>
        <ul className="odg-legend__list">
          <li>
            <i className="odg-dot odg-dot--face" aria-hidden />
            <span className="odg-legend__name">Faces marcadas</span>
          </li>
          <li>
            <i className="odg-dot odg-dot--planned" aria-hidden />
            <span className="odg-legend__name">Procedimento planejado</span>
          </li>
          <li>
            <i className="odg-dot odg-dot--done" aria-hidden />
            <span className="odg-legend__name">Procedimento realizado</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function OdontogramGrid({
  value,
  conditions,
  arches,
  scopes,
  faces,
  faceNeeds,
  facesValue = {},
  onChangeFaces,
  toothNote = '',
  onChangeToothNote,
  selectedKey = '',
  onSelectKey,
  onChange,
  disabled,
  showDeciduous,
  hideEditor,
  procedureMarks,
}: Props) {
  const current = selectedKey ? value[selectedKey] : undefined;
  const isTooth = /^\d{2}$/.test(selectedKey);
  const [selectedFace, setSelectedFace] = useStateFace(selectedKey);

  function selectKey(key: string) {
    onSelectKey?.(key);
  }

  function setCondition(code: string | null) {
    if (disabled || hideEditor || !selectedKey || !onChange) return;
    const next = { ...value };
    if (!code) delete next[selectedKey];
    else next[selectedKey] = code;
    onChange(next);
  }

  function setFaceNeed(need: string | null) {
    if (disabled || hideEditor || !isTooth || !selectedFace || !onChangeFaces) return;
    const toothFaces = { ...(facesValue[selectedKey] || {}) };
    if (!need) delete toothFaces[selectedFace];
    else toothFaces[selectedFace] = need;
    const next = { ...facesValue };
    if (Object.keys(toothFaces).length === 0) delete next[selectedKey];
    else next[selectedKey] = toothFaces;
    onChangeFaces(next);
  }

  const marked = Object.keys(value).length;
  const currentFaceNeed =
    isTooth && selectedFace ? facesValue[selectedKey]?.[selectedFace] : undefined;

  const selectionLabel = useMemo(() => {
    if (!selectedKey) return 'Nenhum dente/escopo';
    if (isTooth) return `Dente ${selectedKey}`;
    const q = scopes?.quadrants.find((x) => x.code === selectedKey);
    if (q) return q.label;
    const s = scopes?.sextants.find((x) => x.code === selectedKey);
    if (s) return s.label;
    if (scopes?.mouth.code === selectedKey) return scopes.mouth.label;
    return selectedKey;
  }, [selectedKey, isTooth, scopes]);

  const archProps = {
    value,
    facesValue,
    procedureMarks,
    selectedKey,
    disabled,
    onSelectKey: selectKey,
  };

  return (
    <div className={`odontogram${hideEditor ? ' is-readonly' : ''}`}>
      <header className="odg-toolbar">
        <div className="odg-toolbar__lead">
          <p className="odg-toolbar__title">Odontograma FDI</p>
          <p className="odg-toolbar__meta">
            {hideEditor
              ? `Snapshot · ${marked} marcação${marked === 1 ? '' : 'ões'}`
              : `${marked} marcação${marked === 1 ? '' : 'ões'} · faces clínicas + SIGTAP à parte`}
          </p>
        </div>
        {!hideEditor && (
          <p className="odg-toolbar__hint">
            Clique no dente ou escopo. Condição pinta o dente; faces usam a cruz; procedimentos
            planejados/realizados aparecem como pontos.
          </p>
        )}
      </header>

      <div className="odg-stage">
        {showDeciduous && (
          <section className="odg-arch odg-arch--deciduous">
            <div className="odg-arch__head">
              <span className="odg-arch__tag">Decídua</span>
              <h3 className="odg-arch__title">Superior</h3>
            </div>
            <ArchRow teeth={arches.upperDeciduous} {...archProps} />
          </section>
        )}

        <section className="odg-arch odg-arch--permanent">
          <div className="odg-arch__head">
            <span className="odg-arch__tag">Permanente</span>
            <h3 className="odg-arch__title">Superior</h3>
          </div>
          <ArchRow teeth={arches.upperPermanent} {...archProps} />
        </section>

        <div className="odg-bite" aria-hidden>
          <span>linha média</span>
        </div>

        <section className="odg-arch odg-arch--permanent">
          <div className="odg-arch__head">
            <span className="odg-arch__tag">Permanente</span>
            <h3 className="odg-arch__title">Inferior</h3>
          </div>
          <ArchRow teeth={arches.lowerPermanent} {...archProps} />
        </section>

        {showDeciduous && (
          <section className="odg-arch odg-arch--deciduous">
            <div className="odg-arch__head">
              <span className="odg-arch__tag">Decídua</span>
              <h3 className="odg-arch__title">Inferior</h3>
            </div>
            <ArchRow teeth={arches.lowerDeciduous} {...archProps} />
          </section>
        )}
      </div>

      {scopes && (
        <div className="odg-scopes">
          <div className="odg-scopes__group">
            <span className="odg-scopes__label">Quadrante</span>
            <div className="odg-scopes__chips">
              {scopes.quadrants.map((q) => (
                <ScopeChip
                  key={q.code}
                  code={q.code}
                  label={q.label}
                  marked={value[q.code]}
                  planned={procedureMarks?.[q.code]?.planned}
                  done={procedureMarks?.[q.code]?.done}
                  selected={selectedKey === q.code}
                  disabled={disabled}
                  onSelect={() => selectKey(q.code)}
                />
              ))}
            </div>
          </div>
          <div className="odg-scopes__group">
            <span className="odg-scopes__label">Sextante</span>
            <div className="odg-scopes__chips">
              {scopes.sextants.map((s) => (
                <ScopeChip
                  key={s.code}
                  code={s.code}
                  label={s.label}
                  marked={value[s.code]}
                  planned={procedureMarks?.[s.code]?.planned}
                  done={procedureMarks?.[s.code]?.done}
                  selected={selectedKey === s.code}
                  disabled={disabled}
                  onSelect={() => selectKey(s.code)}
                />
              ))}
            </div>
          </div>
          <div className="odg-scopes__group">
            <span className="odg-scopes__label">Boca</span>
            <div className="odg-scopes__chips">
              <ScopeChip
                code={scopes.mouth.code}
                label={scopes.mouth.label}
                marked={value[scopes.mouth.code]}
                planned={procedureMarks?.[scopes.mouth.code]?.planned}
                done={procedureMarks?.[scopes.mouth.code]?.done}
                selected={selectedKey === scopes.mouth.code}
                disabled={disabled}
                onSelect={() => selectKey(scopes.mouth.code)}
              />
            </div>
          </div>
        </div>
      )}

      <Legend conditions={conditions} faceNeeds={faceNeeds} />

      {hideEditor ? (
        selectedKey ? (
          <p className="odg-readonly-sel">
            {isTooth ? 'Dente' : 'Escopo'} <strong className="mono">{selectedKey}</strong>:{' '}
            {current
              ? `${current} — ${conditions.find((c) => c.code === current)?.label || current}`
              : 'sem marcação'}
          </p>
        ) : null
      ) : (
        <div className="odg-workspace">
          <aside className="odg-panel">
            <div className="odg-panel__head">
              <span className="odg-panel__eyebrow">Seleção</span>
              <h4 className="odg-panel__title">{selectionLabel}</h4>
              {current ? (
                <p className="odg-panel__status">
                  <i
                    className="odg-swatch"
                    style={{ background: CONDITION_COLOR[current] || '#334155' }}
                    aria-hidden
                  />
                  {current} — {conditions.find((c) => c.code === current)?.label || current}
                </p>
              ) : (
                <p className="odg-panel__status muted">Sem condição</p>
              )}
            </div>

            <div className="odg-panel__section">
              <span className="odg-panel__label">Condição do dente / escopo</span>
              <div className="odg-cond-grid">
                {conditions.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className={[
                      'odg-cond',
                      current === c.code ? 'is-active' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    disabled={disabled || !selectedKey}
                    onClick={() => setCondition(c.code)}
                    style={
                      {
                        '--odg-cond-color': CONDITION_COLOR[c.code] || '#334155',
                      } as CSSProperties
                    }
                  >
                    <span className="odg-cond__code mono">{c.code}</span>
                    <span className="odg-cond__label">{c.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="odg-clear"
                disabled={disabled || !selectedKey || !current}
                onClick={() => setCondition(null)}
              >
                Limpar condição
              </button>
            </div>

            {isTooth && onChangeToothNote ? (
              <label className="odg-note">
                Observações do dente {selectedKey}
                <textarea
                  disabled={disabled}
                  value={toothNote}
                  onChange={(e) => onChangeToothNote(e.target.value)}
                  rows={2}
                  placeholder="Observação clínica deste dente"
                />
              </label>
            ) : null}
          </aside>

          {isTooth && faces?.length && faceNeeds?.length && onChangeFaces ? (
            <div className="odg-faces-pane">
              <FaceCross
                tooth={selectedKey}
                faces={facesValue[selectedKey] || {}}
                faceDefs={faces}
                faceNeeds={faceNeeds}
                selectedFace={selectedFace}
                onSelectFace={setSelectedFace}
                disabled={disabled}
              />
              <div className="odg-panel__section">
                <span className="odg-panel__label">
                  Necessidade da face <strong className="mono">{selectedFace || '—'}</strong>
                </span>
                <div className="odg-cond-grid odg-cond-grid--faces">
                  {faceNeeds.map((n) => (
                    <button
                      key={n.code}
                      type="button"
                      className={[
                        'odg-cond',
                        currentFaceNeed === n.code ? 'is-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      disabled={disabled || !selectedFace}
                      onClick={() => setFaceNeed(n.code)}
                      style={
                        {
                          '--odg-cond-color': FACE_NEED_COLOR[n.code] || '#334155',
                        } as CSSProperties
                      }
                    >
                      <span className="odg-cond__code mono">{n.code}</span>
                      <span className="odg-cond__label">{n.label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="odg-clear"
                  disabled={disabled || !selectedFace || !currentFaceNeed}
                  onClick={() => setFaceNeed(null)}
                >
                  Limpar face
                </button>
              </div>
            </div>
          ) : (
            <div className="odg-faces-pane odg-faces-pane--empty">
              <p>
                {selectedKey
                  ? 'Selecione um dente FDI para editar a cruz de faces (M/D/V/L/O).'
                  : 'Selecione um dente ou escopo à esquerda.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Mantém face selecionada ao trocar de dente (padrão O). */
function useStateFace(selectedKey: string): [string, (f: string) => void] {
  const [face, setFace] = useState('O');
  useEffect(() => {
    if (/^\d{2}$/.test(selectedKey)) setFace((prev) => prev || 'O');
  }, [selectedKey]);
  return [face, setFace];
}
