'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/shell/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';
import { HELP_ARTICLES } from '@/lib/help';

function HelpInner() {
  const params = useSearchParams();
  const initial = params.get('artigo') || HELP_ARTICLES[0].id;
  const [selected, setSelected] = useState(initial);
  const [q, setQ] = useState('');

  useEffect(() => {
    const a = params.get('artigo');
    if (a) setSelected(a);
  }, [params]);

  const article = useMemo(
    () => HELP_ARTICLES.find((a) => a.id === selected) || HELP_ARTICLES[0],
    [selected],
  );

  const list = HELP_ARTICLES.filter((a) => {
    if (!q.trim()) return true;
    const hay = `${a.title} ${a.module} ${a.summary}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <>
      <PageHeader title="Central de Ajuda" description="Artigos por módulo com versão e data." />
      <div className="split-clinical">
        <aside className="stack">
          <input
            style={{ minHeight: 44, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--line)' }}
            placeholder="Buscar artigo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {list.map((a) => (
            <button
              key={a.id}
              type="button"
              className={`btn ${selected === a.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left' }}
              onClick={() => setSelected(a.id)}
            >
              <span>
                <strong style={{ display: 'block' }}>{a.title}</strong>
                <span style={{ fontSize: 12, fontWeight: 400 }}>{a.module}</span>
              </span>
            </button>
          ))}
        </aside>
        <article className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0 }}>{article.title}</h2>
            <span className="pill brand">
              v{article.version} · {article.updatedAt}
            </span>
          </div>
          <p style={{ color: 'var(--ink-3)' }}>{article.summary}</p>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{article.body}</div>
        </article>
      </div>
    </>
  );
}

export default function HelpPage() {
  return (
    <AppShell helpId="plataforma.login">
      <Suspense fallback={<p>Carregando ajuda…</p>}>
        <HelpInner />
      </Suspense>
    </AppShell>
  );
}
