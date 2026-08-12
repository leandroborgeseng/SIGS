'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type CodeOption = { code: string; display: string };

type CatalogKind = 'ciap' | 'cid10';

const cache: Partial<Record<CatalogKind, CodeOption[]>> = {};
const loading: Partial<Record<CatalogKind, Promise<CodeOption[]>>> = {};

async function loadCatalog(kind: CatalogKind): Promise<CodeOption[]> {
  if (cache[kind]) return cache[kind]!;
  if (!loading[kind]) {
    loading[kind] = (async () => {
      const url = kind === 'ciap' ? '/data/ciap2.json' : '/data/cid10.json';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Falha ao carregar catálogo ${kind}`);
      const rows = (await res.json()) as Array<[string, string]>;
      const options = rows.map(([code, display]) => ({ code, display }));
      cache[kind] = options;
      return options;
    })();
  }
  return loading[kind]!;
}

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function scoreMatch(opt: CodeOption, q: string): number {
  if (!q) return 0;
  const code = normalize(opt.code);
  const display = normalize(opt.display);
  const nq = normalize(q).replace(/\s+/g, ' ').trim();
  const codeCompact = code.replace(/\./g, '');
  const qCompact = nq.replace(/\./g, '');
  if (code === nq || codeCompact === qCompact) return 100;
  if (code.startsWith(nq) || codeCompact.startsWith(qCompact)) return 90;
  if (code.includes(nq) || codeCompact.includes(qCompact)) return 70;
  if (display.startsWith(nq)) return 60;
  if (display.includes(nq)) return 40;
  const tokens = nq.split(' ').filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => display.includes(t) || code.includes(t))) return 50;
  return -1;
}

function defaultList(options: CodeOption[], kind: CatalogKind): CodeOption[] {
  if (kind === 'cid10') {
    // Prefer K00–K14 (doenças da boca/dentes)
    const odonto = options.filter((o) => {
      const c = o.code.replace('.', '');
      return /^K0[0-9]|^K1[0-4]/.test(c);
    });
    return odonto.length ? odonto.slice(0, 80) : options.slice(0, 80);
  }
  if (kind === 'ciap') {
    const preferred = ['D82', 'D83', 'D19', 'D20', 'A01'];
    const head = preferred
      .map((code) => options.find((o) => o.code === code))
      .filter(Boolean) as CodeOption[];
    const odonto = options.filter(
      (o) => (o.code.startsWith('D8') || o.code.startsWith('D0') || o.code.startsWith('D1')) && !preferred.includes(o.code),
    );
    return [...head, ...odonto, ...options.filter((o) => !head.includes(o) && !odonto.includes(o))].slice(
      0,
      80,
    );
  }
  return options.slice(0, 80);
}

type Props = {
  kind: CatalogKind;
  label: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  allowEmpty?: boolean;
};

export function CodeSearchSelect({
  kind,
  label,
  value,
  onChange,
  placeholder,
  allowEmpty = true,
}: Props) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<CodeOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadingState(true);
    loadCatalog(kind)
      .then((list) => {
        if (!alive) return;
        setOptions(list);
        setLoadError(null);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e instanceof Error ? e.message : 'Erro ao carregar catálogo');
      })
      .finally(() => {
        if (alive) setLoadingState(false);
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = useMemo(
    () => options.find((o) => o.code.toUpperCase() === value.trim().toUpperCase()),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return defaultList(options, kind);
    return options
      .map((o) => ({ o, s: scoreMatch(o, q) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.o.code.localeCompare(b.o.code))
      .slice(0, 80)
      .map((x) => x.o);
  }, [options, query, kind]);

  const inputValue = open ? query : selected ? `${selected.code} — ${selected.display}` : value;

  return (
    <div className="field code-search" ref={rootRef}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        value={inputValue}
        placeholder={placeholder || (kind === 'ciap' ? 'Buscar CIAP…' : 'Buscar CID-10…')}
        onFocus={() => {
          setOpen(true);
          setQuery(value || '');
        }}
        onChange={(e) => {
          const typed = e.target.value;
          setQuery(typed);
          setOpen(true);
        }}
        onBlur={() => {
          // se digitou um código exato do catálogo, aplica
          const typed = query.trim().toUpperCase();
          if (!typed) return;
          const hit = options.find(
            (o) =>
              o.code.toUpperCase() === typed ||
              o.code.replace(/\./g, '').toUpperCase() === typed.replace(/\./g, ''),
          );
          if (hit) onChange(hit.code);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && filtered[0]) {
            e.preventDefault();
            onChange(filtered[0].code);
            setQuery('');
            setOpen(false);
          }
        }}
      />
      {loadingState ? <div className="muted" style={{ fontSize: 12 }}>Carregando catálogo…</div> : null}
      {loadError ? <div className="muted" style={{ fontSize: 12, color: 'var(--danger)' }}>{loadError}</div> : null}
      {open && !loadingState && !loadError ? (
        <div className="code-search-menu" role="listbox">
          {allowEmpty ? (
            <button
              type="button"
              className="code-search-option"
              onClick={() => {
                onChange('');
                setQuery('');
                setOpen(false);
              }}
            >
              <span className="muted">— limpar —</span>
            </button>
          ) : null}
          {!query.trim() && kind === 'cid10' ? (
            <div className="code-search-hint">Sugestões odonto (K00–K14). Digite para buscar em todos os {options.length} CIDs.</div>
          ) : null}
          {!query.trim() && kind === 'ciap' ? (
            <div className="code-search-hint">Sugestões digestivo/boca. Digite para buscar em todos os {options.length} CIAPs.</div>
          ) : null}
          {filtered.map((o) => (
            <button
              key={o.code}
              type="button"
              role="option"
              className={`code-search-option ${o.code === value ? 'active' : ''}`}
              onClick={() => {
                onChange(o.code);
                setQuery('');
                setOpen(false);
              }}
            >
              <strong>{o.code}</strong>
              <span>{o.display}</span>
            </button>
          ))}
          {!filtered.length ? <div className="code-search-hint">Nenhum resultado para “{query}”.</div> : null}
        </div>
      ) : null}
      {selected && !open ? (
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {selected.display}
        </div>
      ) : null}
    </div>
  );
}
