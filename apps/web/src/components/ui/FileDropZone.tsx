'use client';

import { useState, type DragEvent, type ReactNode } from 'react';

/** Área de arrastar/soltar — às vezes funciona quando o seletor de Downloads falha. */
export function FileDropZone({
  disabled,
  acceptHint,
  onFiles,
  children,
}: {
  disabled?: boolean;
  acceptHint?: string;
  onFiles: (files: FileList | File[]) => void;
  children?: ReactNode;
}) {
  const [over, setOver] = useState(false);

  function onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setOver(true);
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault();
    setOver(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    if (disabled) return;
    const list = e.dataTransfer?.files;
    if (list?.length) onFiles(list);
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        border: `2px dashed ${over ? 'var(--accent, #1565c0)' : 'var(--line)'}`,
        borderRadius: 8,
        padding: 16,
        background: over ? 'var(--ok-bg, #e8f5e9)' : 'transparent',
        marginBottom: 8,
      }}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Arraste o <strong>.zip</strong> (ou XMLs) para cá
        {acceptHint ? ` — ${acceptHint}` : ''}. Se der “I/O read failed”, copie antes para o{' '}
        <strong>Desktop</strong> e arraste de lá.
      </p>
      {children}
    </div>
  );
}
