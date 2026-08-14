'use client';

import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { HelpLink, PageHeader } from '@/components/ui/PageHeader';

const FILAS = [
  {
    href: '/faturamento/odonto',
    title: 'Fila faturamento odonto',
    desc: 'Produção do mês, cores LEDI e atalho para exportar no lote FAO quando houver prontas Siaps.',
    cta: 'Abrir fila',
  },
  {
    href: '/faturamento/aps',
    title: 'Fila faturamento APS',
    desc: 'Atendimento individual (FAI tipo 4) do mês — mesmas cores LEDI e atalho para o lote FAI.',
    cta: 'Abrir fila',
  },
];

const LOTES = [
  {
    href: '/faturamento/lote/fao',
    title: 'Lote FAO',
    badge: 'Tipo 5 · odonto',
    desc: 'Upload, correção e export ZIP de fichas odontológicas.',
  },
  {
    href: '/faturamento/lote/fai',
    title: 'Lote FAI',
    badge: 'Tipo 4 · individual',
    desc: 'Mesmo fluxo: validar, corrigir e baixar ZIP de atendimento individual.',
  },
  {
    href: '/faturamento/lote/proc',
    title: 'Lote Procedimentos',
    badge: 'Tipo 7',
    desc: 'Ficha de procedimentos — export ZIP, dry-run e relatório iguais aos demais lotes.',
  },
];

const EXTRA = {
  href: '/producao',
  title: 'Produção / BPA',
  desc: 'Lotes de produção e pré-voo de faturamento (fora do XML LEDI por tipo).',
};

export default function FaturamentoHubPage() {
  return (
    <AppShell helpId="faturamento.hub">
      <PageHeader
        title="Faturamento & Validação"
        description="Filas odonto/APS e tratamento de lotes LEDI (FAO · FAI · Procedimentos) — separado do atendimento clínico."
        actions={<HelpLink id="faturamento.hub" />}
      />

      <section style={{ marginBottom: 20, maxWidth: 720 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
          Filas
        </h3>
        <div className="stack" style={{ gap: 10 }}>
          {FILAS.map((fila) => (
            <Link key={fila.href} href={fila.href} className="unit-card" style={{ textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{fila.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{fila.desc}</div>
              </div>
              <span className="btn btn-secondary" style={{ pointerEvents: 'none', flexShrink: 0 }}>
                {fila.cta}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 20, maxWidth: 720 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
          Tratamento de lotes LEDI
        </h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
          Escolha o tipo da ficha. Os três usam o mesmo painel: upload → alertas → export ZIP / dry-run /
          relatório. Vacina, AD e coletivo geram lote na origem (Operação) — não há tela de ZIP XML nesta
          fase.
        </p>
        <div className="stack" style={{ gap: 10 }}>
          {LOTES.map((item) => (
            <Link key={item.href} href={item.href} className="unit-card" style={{ textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'baseline',
                    flexWrap: 'wrap',
                    marginBottom: 2,
                  }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{item.title}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>{item.badge}</span>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{item.desc}</div>
              </div>
              <span style={{ color: 'var(--ink-4)' }}>›</span>
            </Link>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 720 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
          Outros
        </h3>
        <Link href={EXTRA.href} className="unit-card" style={{ textAlign: 'left' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 600 }}>{EXTRA.title}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{EXTRA.desc}</div>
          </div>
          <span style={{ color: 'var(--ink-4)' }}>›</span>
        </Link>
      </section>
    </AppShell>
  );
}
