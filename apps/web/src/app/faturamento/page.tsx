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
    href: '/faturamento/lote/cadastro-individual',
    title: 'Cadastro Individual',
    badge: 'Tipo 2 · sintético',
    desc: 'Wizard ZIP — críticas header/identidade; dump Franca sem amostra.',
  },
  {
    href: '/faturamento/lote/domicilio',
    title: 'Cadastro Domiciliar',
    badge: 'Tipo 3 · sintético',
    desc: 'Wizard ZIP CDS território; origem /territorio.',
  },
  {
    href: '/faturamento/lote/fai',
    title: 'Lote FAI',
    badge: 'Tipo 4 · individual',
    desc: 'Validar, corrigir e baixar ZIP de atendimento individual (dump Franca).',
  },
  {
    href: '/faturamento/lote/fao',
    title: 'Lote FAO',
    badge: 'Tipo 5 · odonto',
    desc: 'Upload, correção e export ZIP de fichas odontológicas.',
  },
  {
    href: '/faturamento/lote/coletivo',
    title: 'Atividade Coletiva',
    badge: 'Tipo 6 · sintético',
    desc: 'Wizard ZIP coletivo (B4/Previne); origem /coletivo.',
  },
  {
    href: '/faturamento/lote/proc',
    title: 'Lote Procedimentos',
    badge: 'Tipo 7',
    desc: 'Ficha de procedimentos — export ZIP, dry-run e relatório.',
  },
  {
    href: '/faturamento/lote/visita-acs',
    title: 'Visita ACS',
    badge: 'Tipo 8 · sintético',
    desc: 'Wizard ZIP visitas ACS; origem Território.',
  },
  {
    href: '/faturamento/lote/ad',
    title: 'Atenção Domiciliar',
    badge: 'Tipo 10 · sintético',
    desc: 'Wizard ZIP AD; origem /ad.',
  },
];

const EXTRA = [
  {
    href: '/faturamento/auditoria',
    title: 'Auditoria de faturamento',
    desc: 'Cruza fichas da competência com CNES/INE, lotação CNS/CBO e SIGTAP (bloqueia envio vs qualidade).',
  },
  {
    href: '/producao',
    title: 'Produção / BPA',
    desc: 'Lotes de produção e pré-voo de faturamento (fora do XML LEDI por tipo).',
  },
];

const HELP_REGRAS = [
  {
    href: '/ajuda?artigo=faturamento.funil-pre-envio',
    title: 'Funil pré-envio',
    desc: 'Upload → crítica → autofix → aptos/pendentes → governo.',
  },
  {
    href: '/ajuda?artigo=faturamento.regras-por-tipo',
    title: 'Checagens por tipo de ficha',
    desc: 'Tipos 2, 3, 4, 5, 6, 7, 8, 10 e 14 — o que o sistema olha.',
  },
  {
    href: '/ajuda?artigo=faturamento.cruzamentos',
    title: 'Cruzamentos',
    desc: 'Produção × cadastro × CNES × equipe.',
  },
  {
    href: '/ajuda?artigo=faturamento.siaps-vs-previne',
    title: 'Siaps × Previne',
    desc: 'Envio legal (vermelho) vs financiamento (laranja).',
  },
];

export default function FaturamentoHubPage() {
  return (
    <AppShell helpId="faturamento.hub">
      <PageHeader
        title="Faturamento & Validação"
        description="Filas odonto/APS e tratamento de lotes LEDI (tipos 2–8 e 10) — separado do atendimento clínico."
        actions={<HelpLink id="faturamento.hub" />}
      />

      <section style={{ marginBottom: 20, maxWidth: 720 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: 'var(--ink-3)' }}>
          Regras internas (ajuda)
        </h3>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
          Visível a todos os usuários na Central de Ajuda — funil, checagens por tipo, cruzamentos e
          Siaps × Previne.
        </p>
        <div className="stack" style={{ gap: 10 }}>
          {HELP_REGRAS.map((item) => (
            <Link key={item.href} href={item.href} className="unit-card" style={{ textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{item.desc}</div>
              </div>
              <span style={{ color: 'var(--ink-4)' }}>›</span>
            </Link>
          ))}
        </div>
      </section>

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
          Mesmo wizard: upload → gate de tipo → críticas Siaps/faturamento → autofix → 2 ZIPs (aptos /
          pendentes). Tipos 2/3/6/8/10 usam schema sintético (dump Franca só trouxe 4/5/7). API:{' '}
          <code>GET /v1/faturamento/ledi-cds-lotes</code>.
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
        <div className="stack" style={{ gap: 10 }}>
          {EXTRA.map((item) => (
            <Link key={item.href} href={item.href} className="unit-card" style={{ textAlign: 'left' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{item.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{item.desc}</div>
              </div>
              <span style={{ color: 'var(--ink-4)' }}>›</span>
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
