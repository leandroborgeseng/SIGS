'use client';

import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { HelpLink, PageHeader } from '@/components/ui/PageHeader';

export type CdsLoteStubProps = {
  title: string;
  tipoCode: number;
  masterTag: string;
  nativeHref: string;
  nativeLabel: string;
  helpId?: string;
  rf?: string;
};

/**
 * Stub de lote XML CDS (tipos 3/8/10): sem upload — só orientação + origem nativa.
 */
export function CdsLoteStubPage(props: CdsLoteStubProps) {
  const helpId = props.helpId || 'faturamento.lote-cds-stub';
  return (
    <AppShell helpId={helpId}>
      <PageHeader
        title={props.title}
        description={`Tipo LEDI ${props.tipoCode} — lote XML ainda em stub (sem wizard ZIP).`}
        actions={<HelpLink id={helpId} />}
      />

      <div className="unit-card" style={{ maxWidth: 720, textAlign: 'left', display: 'block' }}>
        <p style={{ margin: '0 0 10px', fontSize: 14 }}>
          O dump Franca usado no piloto só trouxe fichas <strong>4 / 5 / 7</strong> (FAI · FAO ·
          Procedimentos). Sem amostra XML deste tipo, não há validação nem export ZIP — evita inventar
          BLOCKER.
        </p>
        <ul style={{ margin: '0 0 14px', paddingLeft: 18, fontSize: 13.5, color: 'var(--ink-2)' }}>
          <li>
            Envelope: <code>tipoDadoSerializado = {props.tipoCode}</code>
          </li>
          <li>
            Tag: <code>{props.masterTag}</code>
          </li>
          {props.rf ? <li>RF: {props.rf}</li> : null}
        </ul>
        <p style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--ink-3)' }}>
          Use a origem nativa para registrar produção. Quando houver ZIP de amostra municipal, o wizard
          reutilizará o mesmo shell dos lotes FAI/FAO/PROC.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Link className="btn" href={props.nativeHref}>
            Abrir {props.nativeLabel}
          </Link>
          <Link className="btn btn-secondary" href="/faturamento">
            Hub faturamento
          </Link>
          <Link className="btn ghost" href="/faturamento/lote/fai">
            Lote FAI (live)
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
