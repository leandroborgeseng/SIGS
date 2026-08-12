import Link from 'next/link';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="page-eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({
  status,
  map,
}: {
  status: string;
  map: Record<string, { label: string; tone: string }>;
}) {
  const meta = map[status] || { label: status, tone: 'off' };
  return (
    <span className={`pill ${meta.tone}`}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return <div className="alert danger">{message}</div>;
}

export function OkBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="alert" style={{ borderColor: 'var(--ok-bd)', background: 'var(--ok-bg)', marginBottom: 12 }}>
      {message}
    </div>
  );
}

/** Empty / loading row for data tables */
export function TableStateRow({
  colSpan,
  loading,
  empty,
}: {
  colSpan: number;
  loading?: boolean;
  empty?: string;
}) {
  if (loading) {
    return (
      <tr>
        <td colSpan={colSpan} className="table-state">
          Carregando…
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td colSpan={colSpan} className="table-state">
        {empty || 'Nenhum registro.'}
      </td>
    </tr>
  );
}

export function HelpLink({ id, label = 'Ajuda desta tela' }: { id: string; label?: string }) {
  return (
    <Link className="btn btn-ghost" href={`/ajuda?artigo=${id}`}>
      {label}
    </Link>
  );
}
