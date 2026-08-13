'use client';

import Link from 'next/link';
import { AppShell } from '@/components/shell/AppShell';
import { PageHeader } from '@/components/ui/PageHeader';

const LINKS = [
  {
    href: '/faturamento/odonto',
    title: 'Fila faturamento odonto',
    desc: 'Validação e produção do mês (cores do lote LEDI FAO).',
  },
  {
    href: '/faturamento/lote/fao',
    title: 'Lote LEDI FAO',
    desc: 'Upload, correção e exportação XML de odontologia.',
  },
  {
    href: '/faturamento/lote/fai',
    title: 'Lote LEDI FAI',
    desc: 'Ficha de Atendimento Individual (tipo 4).',
  },
  {
    href: '/faturamento/lote/proc',
    title: 'Lote Procedimentos',
    desc: 'Ficha de Procedimentos (tipo 7).',
  },
  {
    href: '/producao',
    title: 'Produção / BPA',
    desc: 'Lotes de produção e pré-voo de faturamento.',
  },
];

export default function FaturamentoHubPage() {
  return (
    <AppShell helpId="faturamento.hub">
      <PageHeader
        title="Faturamento & Validação"
        description="Filas, lotes LEDI e produção — separado do atendimento clínico."
      />
      <div className="stack" style={{ gap: 10, maxWidth: 640 }}>
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="unit-card" style={{ textAlign: 'left' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 600 }}>{item.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{item.desc}</div>
            </div>
            <span style={{ color: 'var(--ink-4)' }}>›</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
