'use client';

import { useEffect, type ReactNode } from 'react';
import { lockBodyScroll, unlockBodyScroll } from '@/lib/body-scroll-lock';

type Props = {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
  /** Se true, fecha ao clicar no backdrop */
  closeOnBackdrop?: boolean;
  /** Empilhar acima de outro modal (ex.: ficha sobre guia do erro). */
  layer?: 1 | 2;
};

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'lg',
  closeOnBackdrop = true,
  layer = 1,
}: Props) {
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`ui-modal-root ${layer === 2 ? 'ui-modal-layer-2' : ''}`}
      role="presentation"
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`ui-modal ui-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ui-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="ui-modal-head">
          <div>
            <h2 id="ui-modal-title">{title}</h2>
            {subtitle ? <div className="ui-modal-sub">{subtitle}</div> : null}
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Fechar">
            Fechar
          </button>
        </header>
        <div className="ui-modal-body">{children}</div>
        {footer ? <footer className="ui-modal-foot">{footer}</footer> : null}
      </div>
    </div>
  );
}
