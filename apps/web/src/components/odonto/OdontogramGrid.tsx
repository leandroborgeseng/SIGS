'use client';

export type OdontogramCondition = { code: string; label: string };

export type OdontogramArches = {
  upperPermanent: string[];
  lowerPermanent: string[];
  upperDeciduous: string[];
  lowerDeciduous: string[];
};

type Props = {
  value: Record<string, string>;
  conditions: OdontogramCondition[];
  arches: OdontogramArches;
  selectedTooth: string;
  onSelectTooth: (tooth: string) => void;
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

function ArchRow({
  teeth,
  value,
  selectedTooth,
  disabled,
  onSelectTooth,
}: {
  teeth: string[];
  value: Record<string, string>;
  selectedTooth: string;
  disabled?: boolean;
  onSelectTooth: (t: string) => void;
}) {
  const mid = Math.floor(teeth.length / 2);
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {teeth.slice(0, mid).map((t) => (
        <ToothButton
          key={t}
          tooth={t}
          code={value[t]}
          selected={selectedTooth === t}
          disabled={disabled}
          onSelect={() => onSelectTooth(t)}
        />
      ))}
      <span style={{ width: 8 }} aria-hidden />
      {teeth.slice(mid).map((t) => (
        <ToothButton
          key={t}
          tooth={t}
          code={value[t]}
          selected={selectedTooth === t}
          disabled={disabled}
          onSelect={() => onSelectTooth(t)}
        />
      ))}
    </div>
  );
}

export function OdontogramGrid({
  value,
  conditions,
  arches,
  selectedTooth,
  onSelectTooth,
  onChange,
  disabled,
  showDeciduous,
}: Props) {
  const current = selectedTooth ? value[selectedTooth] : undefined;

  function setCondition(code: string | null) {
    if (disabled || !selectedTooth) return;
    const next = { ...value };
    if (!code) delete next[selectedTooth];
    else next[selectedTooth] = code;
    onChange(next);
  }

  const marked = Object.keys(value).length;

  return (
    <div className="odontogram" style={{ display: 'grid', gap: 10 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        Clique no dente (FDI) e marque a condição. O dente selecionado preenche o campo do
        procedimento SIGTAP. Marcações: {marked}.
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
              selectedTooth={selectedTooth}
              disabled={disabled}
              onSelectTooth={onSelectTooth}
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
          selectedTooth={selectedTooth}
          disabled={disabled}
          onSelectTooth={onSelectTooth}
        />
      </div>
      <div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>
          Inferior permanente
        </div>
        <ArchRow
          teeth={arches.lowerPermanent}
          value={value}
          selectedTooth={selectedTooth}
          disabled={disabled}
          onSelectTooth={onSelectTooth}
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
            selectedTooth={selectedTooth}
            disabled={disabled}
            onSelectTooth={onSelectTooth}
          />
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="muted" style={{ fontSize: 13 }}>
          Dente {selectedTooth || '—'}:
        </span>
        {conditions.map((c) => (
          <button
            key={c.code}
            type="button"
            className="btn ghost"
            disabled={disabled || !selectedTooth}
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
          disabled={disabled || !selectedTooth || !current}
          onClick={() => setCondition(null)}
          style={{ padding: '4px 8px', fontSize: 12 }}
        >
          Limpar
        </button>
      </div>
    </div>
  );
}
