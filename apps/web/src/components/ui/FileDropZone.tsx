'use client';

import { useRef, useState, type DragEvent, type ReactNode } from 'react';

const DEFAULT_ACCEPT = '.xml,.zip,application/xml,text/xml,application/zip';

/**
 * Dropzone + seletor de arquivo.
 * Limpa o input antes de abrir (permite reescolher o mesmo .zip)
 * e destaca “Escolher de novo” quando a leitura/envio I/O falhou.
 */
export function FileDropZone({
  disabled,
  acceptHint,
  accept = DEFAULT_ACCEPT,
  multiple = true,
  onFiles,
  ioFailed,
  children,
}: {
  disabled?: boolean;
  acceptHint?: string;
  accept?: string;
  multiple?: boolean;
  onFiles: (files: FileList | File[]) => void;
  /** Exibe CTA “Escolher de novo” após falha de leitura/envio. */
  ioFailed?: boolean;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function openPicker() {
    const el = inputRef.current;
    if (!el || disabled) return;
    el.value = '';
    el.click();
  }

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
        {acceptHint ? ` — ${acceptHint}` : ''}, ou use o botão abaixo.
      </p>
      <p className="muted" style={{ fontSize: 13 }}>
        ZIP até 100 MB: cada fatia (512 KiB) é lida e enviada na hora. Se o
        Safari falhar ao ler (“I/O read” / “Blob loading failed”), use{' '}
        <strong>Escolher de novo</strong> pelo botão (não arraste do Finder),
        ou <strong>envie via Chrome ou Edge</strong>. No Mac:{' '}
        <code>node tools/split-ledi-zip.cjs &lt;arquivo.zip&gt;</code> gera
        pedaços ~4 MB no Desktop. O arquivo não precisa estar no iCloud.
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled}
          onClick={openPicker}
        >
          Escolher .zip ou XMLs…
        </button>
        {ioFailed ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled}
              onClick={openPicker}
            >
              Escolher de novo
            </button>
            <span className="muted" style={{ alignSelf: 'center', fontSize: 13 }}>
              ou envie via Chrome / Edge
            </span>
          </>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
        }}
      />
      {children}
    </div>
  );
}
