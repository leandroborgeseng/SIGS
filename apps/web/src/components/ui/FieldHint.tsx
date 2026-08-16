import type { CSSProperties, ReactNode } from 'react';

/** Eixo A = envio legal LEDI/Siaps; eixo B = indicadores Previne / qualidade. */
export type FieldTone = 'siaps' | 'previne' | 'neutral';

const BADGE_LABEL: Record<Exclude<FieldTone, 'neutral'>, string> = {
  siaps: 'Siaps',
  previne: 'Previne',
};

export function FieldBadge({
  tone,
  label,
}: {
  tone: FieldTone;
  /** Override: ex. "Indicador" no lugar de "Previne". */
  label?: string;
}) {
  if (tone === 'neutral') return null;
  return (
    <span className={`field-badge field-badge--${tone}`} title={tone === 'siaps' ? 'Obrigatório para envio Siaps/LEDI' : 'Impacta indicador Previne / qualidade'}>
      {label || BADGE_LABEL[tone]}
    </span>
  );
}

export function FieldHint({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: FieldTone;
  children?: ReactNode;
  className?: string;
}) {
  if (!children && tone === 'neutral') return null;
  return (
    <p className={`field-hint field-hint--${tone} ${className}`.trim()}>
      {children}
    </p>
  );
}

type LabeledFieldProps = {
  label: ReactNode;
  tone?: FieldTone;
  badgeLabel?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Quando o controle já traz o próprio label (ex.: checkbox). */
  hideLabel?: boolean;
};

/**
 * Campo com borda/fundo por tom + badge Siaps | Previne.
 * Use `tone="siaps"` só para BLOCKER de envio (error-registry / validators).
 * Use `tone="previne"` para MONEY_RISK / indicadores (não bloqueia finish Siaps).
 */
export function LabeledField({
  label,
  tone = 'neutral',
  badgeLabel,
  hint,
  children,
  className = '',
  style,
  hideLabel = false,
}: LabeledFieldProps) {
  const toneClass = tone === 'neutral' ? '' : `field--tone-${tone}`;
  return (
    <div className={`field ${toneClass} ${className}`.trim()} style={style} data-field-tone={tone}>
      {!hideLabel ? (
        <div className="field-label-row">
          <span className="field-label">{label}</span>
          <FieldBadge tone={tone} label={badgeLabel} />
        </div>
      ) : null}
      {hint ? <FieldHint tone={tone}>{hint}</FieldHint> : null}
      {children}
    </div>
  );
}

type FieldSectionProps = {
  title: ReactNode;
  tone?: FieldTone;
  badgeLabel?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Título de bloco (fieldset / h2) com o mesmo tom visual. */
export function FieldSection({
  title,
  tone = 'neutral',
  badgeLabel,
  hint,
  children,
  className = '',
}: FieldSectionProps) {
  const toneClass = tone === 'neutral' ? '' : `field-section--tone-${tone}`;
  return (
    <section className={`field-section ${toneClass} ${className}`.trim()} data-field-tone={tone}>
      <div className="field-label-row field-section__head">
        <h2 className="field-section__title">{title}</h2>
        <FieldBadge tone={tone} label={badgeLabel} />
      </div>
      {hint ? <FieldHint tone={tone}>{hint}</FieldHint> : null}
      {children}
    </section>
  );
}

/** Legenda curta no topo da ficha. */
export function FieldToneLegend({ className = '' }: { className?: string }) {
  return (
    <p className={`field-tone-legend ${className}`.trim()}>
      <FieldBadge tone="siaps" /> obrigatório para envio legal (Siaps/LEDI) ·{' '}
      <FieldBadge tone="previne" /> qualidade / indicador Previne (não bloqueia envio se Siaps ok)
    </p>
  );
}
