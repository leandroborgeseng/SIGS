'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const NAV = [
  {
    group: 'Faturamento LEDI',
    items: [
      { href: '/odonto/lote', label: 'Lote LEDI FAO' },
      { href: '/aps/lote', label: 'Lote LEDI FAI' },
      { href: '/procedimentos/lote', label: 'Lote Procedimentos' },
      { href: '/odonto', label: 'Odontologia' },
      { href: '/producao', label: 'Produção / BPA' },
    ],
  },
  {
    group: 'Início',
    items: [{ href: '/dashboard', label: 'Painel' }],
  },
  {
    group: 'Cadastros',
    items: [
      { href: '/pacientes', label: 'Pacientes' },
      { href: '/unidades', label: 'Unidades' },
      { href: '/territorio', label: 'Território' },
      { href: '/lotacoes', label: 'Lotações' },
    ],
  },
  {
    group: 'Operação',
    items: [
      { href: '/agenda', label: 'Agenda' },
      { href: '/atendimento', label: 'Atendimento' },
      { href: '/prescricoes', label: 'Prescrições' },
      { href: '/totem', label: 'Totem' },
      { href: '/guiche', label: 'Guichê' },
      { href: '/vacinacao', label: 'Vacinação' },
      { href: '/ad', label: 'Atenção domiciliar' },
      { href: '/coletivo', label: 'Atividade coletiva' },
      { href: '/regulacao', label: 'Regulação' },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { href: '/relatorios', label: 'Relatórios' },
      { href: '/sigtap', label: 'SIGTAP' },
      { href: '/admin/usuarios', label: 'Usuários' },
      { href: '/admin/grupos', label: 'Grupos e perfis' },
      { href: '/admin/auditoria', label: 'Auditoria' },
    ],
  },
  {
    group: 'Suporte',
    items: [{ href: '/ajuda', label: 'Central de Ajuda' }],
  },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'SG';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AppShell({ children, helpId }: { children: ReactNode; helpId?: string }) {
  const { user, loading, logout, facilityId } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [facilityName, setFacilityName] = useState('Unidade');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user && !facilityId && pathname !== '/selecionar-unidade') {
      router.replace('/selecionar-unidade');
    }
  }, [loading, user, facilityId, pathname, router]);

  useEffect(() => {
    if (!facilityId) return;
    void api<Array<{ id: string; name: string }>>('/v1/facilities')
      .then((rows) => {
        const f = rows.find((r) => r.id === facilityId);
        if (f) setFacilityName(f.name);
      })
      .catch(() => undefined);
  }, [facilityId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        router.push('/pacientes');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  if (loading || !user) {
    return (
      <div className="content">
        <p>Carregando sessão…</p>
      </div>
    );
  }

  return (
    <div className="app-shell sgs-screen">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/brand/franca-mark.png" alt="" />
          <strong>SIGS Franca</strong>
        </div>
        <nav>
          {NAV.map((g) => (
            <div key={g.group}>
              <div className="nav-group">{g.group}</div>
              {g.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${active ? ' active' : ''}`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{initials(user.name)}</div>
          <div className="meta">
            <strong>{user.name}</strong>
            <span>{facilityName}</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            title="Sair"
            onClick={() => {
              logout();
              router.push('/login');
            }}
          >
            ⎋
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <Link className="search-chip" href="/pacientes" title="Buscar paciente (Ctrl K)">
            <span aria-hidden>⌕</span>
            Buscar paciente, CPF, CNS…
            <kbd>Ctrl K</kbd>
          </Link>
          <div className="row" style={{ marginLeft: 'auto' }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{user.roleName}</span>
            <Link className="btn btn-secondary btn-sm" href="/selecionar-unidade">
              Trocar unidade
            </Link>
            <Link
              className="icon-btn lg"
              href={helpId ? `/ajuda?artigo=${helpId}` : '/ajuda'}
              title="Ajuda desta tela"
            >
              ?
            </Link>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
