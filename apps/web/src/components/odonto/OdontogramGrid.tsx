'use client';

import { useEffect, useState } from 'react';

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
};

const CONDITION_COLOR: Record<string, string> = {
  C: '#c45c26',
  R: '#2f6fed',
  E: '#6b7280',
  F: '#b45309',
  S: '#0d9488',
  T: '#7c3aed',
  P: '#be185d',
  X: '#dc2626',
  O: '#4b5563',
};

const FACE_NEED_COLOR: Record<string, string> = {
  AM: '#b45309',
  RE: '#2563eb',
  CA: '#c45c26',
  SE: '#0d9488',
  FR: '#7c3aed',
  OU: '#4b5563',
};

function ToothButton({
  tooth,
  code,
  faceCount,
  selected,
  disabled,
  onSelect,
}: {
  tooth: string;
  code?: string;
  faceCount?: number;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const bg = code ? CONDITION_COLOR[code] || '#334155' : 'transparent';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      title={
        code
          ? `${tooth}: ${code}${faceCount ? ` · ${faceCount} face(s)` : ''}`
          : tooth
      }
      aria-pressed={selected}
      style={{
        width: 28,
        height: 36,
        padding: 0,
        fontSize: 11,
        fontWeight: 600,
        borderRadius: 4,
        border: selected ? '2px solid var(--fg, #111)' : '1px solid var(--border, #cbd5e1)',
        background: code ? bg : 'var(--bg, #fff)',
        color: code ? '#fff' : 'inherit',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled && !code ? 0.7 : 1,
        position: 'relative',
      }}
    >
      {tooth}
      {!!faceCount && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            right: 1,
            bottom: 1,
            width: 6,
            height: 6,
            borderRadius: 99,
            background: '#0f172a',
          }}
        />
      )}
    </button>
  );
}

function ScopeChip({
  code,
  label,
  marked,
  selected,
  disabled,
  onSelect,
}: {
  code: string;
  label: string;
  marked?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const bg = marked ? CONDITION_COLOR[marked] || '#334155' : undefined;
  return (
    <button
      type="button"
      className="btn ghost"
      disabled={disabled}
      onClick={onSelect}
      title={marked ? `${label}: ${marked}` : label}
      aria-pressed={selected}
      style={{
        padding: '4px 8px',
        fontSize: 12,
        border: selected ? '2px solid var(--fg, #111)' : undefined,
        background: bg,
        color: marked ? '#fff' : undefined,
      }}
    >
      {code}
      {marked ? ` · ${marked}` : ''}
    </button>
  );
}

function ArchRow({
  teeth,
  value,
  facesValue,
  selectedKey,
  disabled,
  onSelectKey,
}: {
  teeth: string[];
  value: Record<string, string>;
  facesValue?: OdontogramFacesMap;
  selectedKey: string;
  disabled?: boolean;
  onSelectKey: (t: string) => void;
}) {
  const mid = Math.floor(teeth.length / 2);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {teeth.slice(0, mid).map((t) => (
        <ToothButton
          key={t}
          tooth={t}
          code={value[t]}
          faceCount={facesValue?.[t] ? Object.keys(facesValue[t]!).length : 0}
          selected={selectedKey === t}
          disabled={disabled}
          onSelect={() => onSelectKey(t)}
        />
      ))}
      <span style={{ width: 8 }} aria-hidden />
      {teeth.slice(mid).map((t) => (
        <ToothButton
          key={t}
          tooth={t}
          code={value[t]}
          faceCount={facesValue?.[t] ? Object.keys(facesValue[t]!).length : 0}
          selected={selectedKey === t}
          disabled={disabled}
          onSelect={() => onSelectKey(t)}
        />
      ))}
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
    const bg = need ? FACE_NEED_COLOR[need] || '#334155' : 'var(--bg, #fff)';
    const def = byCode[code];
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelectFace(code)}
        title={
          need
            ? `${def?.label || code}: ${faceNeeds.find((n) => n.code === need)?.label || need}`
            : def?.label || code
        }
        aria-pressed={selectedFace === code}
        style={{
          width: 36,
          height: 36,
          fontSize: 11,
          fontWeight: 700,
          border:
            selectedFace === code
              ? '2px solid var(--fg, #111)'
              : '1px solid var(--border, #cbd5e1)',
          background: bg,
          color: need ? '#fff' : 'inherit',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {code}
        {need ? `·${need}` : ''}
      </button>
    );
  };

  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div className="muted" style={{ fontSize: 12 }}>
        Faces do dente {tooth} (cruz clínica — só careJson; não vai ao Thrift FAO)
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '36px 36px 36px',
          gridTemplateRows: '36px 36px 36px',
          gap: 4,
          width: 'fit-content',
        }}
      >
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

  return (
    <div className="odontogram" style={{ display: 'grid', gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {hideEditor
          ? `Snapshot somente leitura. Marcações: ${marked}.`
          : `Clique no dente (FDI) ou no escopo (quadrante / sextante / boca). Marcadores do dente e faces (cruz) são clínicos; procedimentos planejados/realizados ficam na lista SIGTAP. Marcações: ${marked}.`}
      </p>
      {showDeciduous && (
        <>
          <div>
            <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
              Superior decídua
            </div>
            <ArchRow
              teeth={arches.upperDeciduous}
              value={value}
              facesValue={facesValue}
              selectedKey={selectedKey}
              disabled={disabled}
              onSelectKey={selectKey}
            />
          </div>
        </>
      )}
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Superior permanente
        </div>
        <ArchRow
          teeth={arches.upperPermanent}
          value={value}
          facesValue={facesValue}
          selectedKey={selectedKey}
          disabled={disabled}
          onSelectKey={selectKey}
        />
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Inferior permanente
        </div>
        <ArchRow
          teeth={arches.lowerPermanent}
          value={value}
          facesValue={facesValue}
          selectedKey={selectedKey}
          disabled={disabled}
          onSelectKey={selectKey}
        />
      </div>
      {showDeciduous && (
        <div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
            Inferior decídua
          </div>
          <ArchRow
            teeth={arches.lowerDeciduous}
            value={value}
            facesValue={facesValue}
            selectedKey={selectedKey}
            disabled={disabled}
            onSelectKey={selectKey}
          />
        </div>
      )}

      {scopes && (
        <div style={{ display: 'grid', gap: 6 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Escopos (RF-12.12)
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Quadrante
            </span>
            {scopes.quadrants.map((q) => (
              <ScopeChip
                key={q.code}
                code={q.code}
                label={q.label}
                marked={value[q.code]}
                selected={selectedKey === q.code}
                disabled={disabled}
                onSelect={() => selectKey(q.code)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Sextante
            </span>
            {scopes.sextants.map((s) => (
              <ScopeChip
                key={s.code}
                code={s.code}
                label={s.label}
                marked={value[s.code]}
                selected={selectedKey === s.code}
                disabled={disabled}
                onSelect={() => selectKey(s.code)}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              Boca
            </span>
            <ScopeChip
              code={scopes.mouth.code}
              label={scopes.mouth.label}
              marked={value[scopes.mouth.code]}
              selected={selectedKey === scopes.mouth.code}
              disabled={disabled}
              onSelect={() => selectKey(scopes.mouth.code)}
            />
          </div>
        </div>
      )}

      {hideEditor ? (
        selectedKey ? (
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            {isTooth ? 'Dente' : 'Escopo'} {selectedKey}:{' '}
            {current
              ? `${current} — ${conditions.find((c) => c.code === current)?.label || current}`
              : 'sem marcação'}
          </p>
        ) : null
      ) : (
        <>
          <div style={{ display: 'grid', gap: 6 }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Marcadores do dente / escopo {selectedKey || '—'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {conditions.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className="btn ghost"
                  disabled={disabled || !selectedKey}
                  onClick={() => setCondition(c.code)}
                  style={{
                    padding: '4px 8px',
                    fontSize: 12,
                    borderColor: current === c.code ? CONDITION_COLOR[c.code] : undefined,
                    background: current === c.code ? CONDITION_COLOR[c.code] : undefined,
                    color: current === c.code ? '#fff' : undefined,
                  }}
                >
                  {c.code} — {c.label}
                </button>
              ))}
              <button
                type="button"
                className="btn ghost"
                disabled={disabled || !selectedKey || !current}
                onClick={() => setCondition(null)}
                style={{ padding: '4px 8px', fontSize: 12 }}
              >
                Limpar dente
              </button>
            </div>
          </div>

          {isTooth && faces?.length && faceNeeds?.length && onChangeFaces ? (
            <div style={{ display: 'grid', gap: 8 }}>
              <FaceCross
                tooth={selectedKey}
                faces={facesValue[selectedKey] || {}}
                faceDefs={faces}
                faceNeeds={faceNeeds}
                selectedFace={selectedFace}
                onSelectFace={setSelectedFace}
                disabled={disabled}
              />
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Face {selectedFace || '—'}:
                </span>
                {faceNeeds.map((n) => (
                  <button
                    key={n.code}
                    type="button"
                    className="btn ghost"
                    disabled={disabled || !selectedFace}
                    onClick={() => setFaceNeed(n.code)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      background:
                        currentFaceNeed === n.code ? FACE_NEED_COLOR[n.code] : undefined,
                      color: currentFaceNeed === n.code ? '#fff' : undefined,
                    }}
                  >
                    {n.code} — {n.label}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn ghost"
                  disabled={disabled || !selectedFace || !currentFaceNeed}
                  onClick={() => setFaceNeed(null)}
                  style={{ padding: '4px 8px', fontSize: 12 }}
                >
                  Limpar face
                </button>
              </div>
            </div>
          ) : null}

          {isTooth && onChangeToothNote ? (
            <label>
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
        </>
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