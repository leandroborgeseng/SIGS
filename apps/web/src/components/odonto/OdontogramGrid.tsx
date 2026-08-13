'use client';

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

type Props = {
  value: Record<string, string>;
  conditions: OdontogramCondition[];
  arches: OdontogramArches;
  scopes?: OdontogramScopes;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
  showDeciduous?: boolean;
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

function ToothButton({
  tooth,
  code,
  selected,
  disabled,
  onSelect,
}: {
  tooth: string;
  code?: string;
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
      title={code ? `${tooth}: ${code}` : tooth}
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
      }}
    >
      {tooth}
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
  selectedKey,
  disabled,
  onSelectKey,
}: {
  teeth: string[];
  value: Record<string, string>;
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
          selected={selectedKey === t}
          disabled={disabled}
          onSelect={() => onSelectKey(t)}
        />
      ))}
    </div>
  );
}

export function OdontogramGrid({
  value,
  conditions,
  arches,
  scopes,
  selectedKey,
  onSelectKey,
  onChange,
  disabled,
  showDeciduous,
}: Props) {
  const current = selectedKey ? value[selectedKey] : undefined;
  const isTooth = /^\d{2}$/.test(selectedKey);

  function setCondition(code: string | null) {
    if (disabled || !selectedKey) return;
    const next = { ...value };
    if (!code) delete next[selectedKey];
    else next[selectedKey] = code;
    onChange(next);
  }

  const marked = Object.keys(value).length;

  return (
    <div className="odontogram" style={{ display: 'grid', gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Clique no dente (FDI) ou no escopo (quadrante / sextante / boca) e marque a condição. A
        seleção preenche tooth ou region do procedimento SIGTAP. Marcações: {marked}.
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
              selectedKey={selectedKey}
              disabled={disabled}
              onSelectKey={onSelectKey}
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
          selectedKey={selectedKey}
          disabled={disabled}
          onSelectKey={onSelectKey}
        />
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Inferior permanente
        </div>
        <ArchRow
          teeth={arches.lowerPermanent}
          value={value}
          selectedKey={selectedKey}
          disabled={disabled}
          onSelectKey={onSelectKey}
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
            selectedKey={selectedKey}
            disabled={disabled}
            onSelectKey={onSelectKey}
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
                onSelect={() => onSelectKey(q.code)}
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
                onSelect={() => onSelectKey(s.code)}
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
              onSelect={() => onSelectKey(scopes.mouth.code)}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 13 }}>
          {isTooth ? 'Dente' : 'Escopo'} {selectedKey || '—'}:
        </span>
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
          Limpar
        </button>
      </div>
    </div>
  );
}
