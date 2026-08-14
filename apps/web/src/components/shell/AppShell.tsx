'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const NAV_STORAGE_KEY = 'sigs.nav.openGroup';
const NAV_SUB_STORAGE_KEY = 'sigs.nav.openSubgroup';

type NavLink = { href: string; label: string };
type NavSubgroup = { id: string; group: string; items: readonly NavLink[] };
type NavItem = NavLink | NavSubgroup;

type NavGroupId =
  | 'inicio'
  | 'clinico'
  | 'faturamento'
  | 'cadastros'
  | 'operacao'
  | 'gestao'
  | 'suporte';

function isNavSubgroup(item: NavItem): item is NavSubgroup {
  return 'items' in item;
}

const LEDI_LOTES_SUBGROUP: NavSubgroup = {
  id: 'ledi-lotes',
  group: 'Tratamento de lotes LEDI',
  items: [
    { href: '/faturamento/lote/fao', label: 'Lote FAO' },
    { href: '/faturamento/lote/fai', label: 'Lote FAI' },
    { href: '/faturamento/lote/proc', label: 'Lote Procedimentos' },
  ],
};

const NAV: Array<{ id: NavGroupId; group: string; items: readonly NavItem[] }> = [
  {
    id: 'inicio',
    group: 'Início',
    items: [{ href: '/dashboard', label: 'Painel' }],
  },
  {
    id: 'clinico',
    group: 'Atendimento clínico',
    items: [
      { href: '/aps', label: 'Atendimento APS' },
      { href: '/aps/agenda', label: 'Agenda APS' },
      { href: '/odonto', label: 'Odontologia' },
      { href: '/odonto/agenda', label: 'Agenda odonto' },
    ],
  },
  {
    id: 'faturamento',
    group: 'Faturamento & Validação',
    items: [
      { href: '/faturamento', label: 'Visão geral' },
      { href: '/faturamento/odonto', label: 'Fila odonto' },
      { href: '/faturamento/aps', label: 'Fila APS' },
      LEDI_LOTES_SUBGROUP,
      { href: '/producao', label: 'Produção / BPA' },
    ],
  },
  {
    id: 'cadastros',
    group: 'Cadastros',
    items: [
      { href: '/pacientes', label: 'Pacientes' },
      { href: '/unidades', label: 'Unidades' },
      { href: '/territorio', label: 'Território' },
      { href: '/lotacoes', label: 'Lotações' },
    ],
  },
  {
    id: 'operacao',
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
    id: 'gestao',
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
    id: 'suporte',
    group: 'Suporte',
    items: [{ href: '/ajuda', label: 'Central de Ajuda' }],
  },
];

function itemMatches(pathname: string, href: string) {
  if (href === '/faturamento') return pathname === '/faturamento';
  if (href === '/odonto/agenda') {
    return pathname === '/odonto/agenda' || pathname.startsWith('/odonto/agenda/');
  }
  if (href === '/aps/agenda') {
    return pathname === '/aps/agenda' || pathname.startsWith('/aps/agenda/');
  }
  if (href === '/odonto') {
    if (pathname.startsWith('/odonto/agenda')) return false;
    return pathname === '/odonto' || /^\/odonto\/[^/]+/.test(pathname);
  }
  if (href === '/aps') {
    if (pathname.startsWith('/aps/agenda')) return false;
    return pathname === '/aps' || /^\/aps\/[^/]+/.test(pathname);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navItemMatches(pathname: string, item: NavItem) {
  if (isNavSubgroup(item)) {
    return item.items.some((sub) => itemMatches(pathname, sub.href));
  }
  return itemMatches(pathname, item.href);
}

function groupForPath(pathname: string): NavGroupId {
  for (const g of NAV) {
    if (g.items.some((item) => navItemMatches(pathname, item))) return g.id;
  }
  if (pathname.startsWith('/faturamento')) return 'faturamento';
  if (pathname.startsWith('/odonto') || pathname.startsWith('/aps')) return 'clinico';
  if (pathname.startsWith('/admin')) return 'gestao';
  return 'inicio';
}

function subgroupForPath(pathname: string): string | null {
  if (LEDI_LOTES_SUBGROUP.items.some((item) => itemMatches(pathname, item.href))) {
    return LEDI_LOTES_SUBGROUP.id;
  }
  return null;
}

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
  const [openGroup, setOpenGroup] = useState<NavGroupId | null>(() => groupForPath(pathname));
  const [openSubgroup, setOpenSubgroup] = useState<string | null>(
    () => subgroupForPath(pathname) ?? LEDI_LOTES_SUBGROUP.id,
  );

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

  useEffect(() => {
    const fromRoute = groupForPath(pathname);
    setOpenGroup(fromRoute);
    const fromSub = subgroupForPath(pathname);
    if (fromSub) setOpenSubgroup(fromSub);
    try {
      localStorage.setItem(NAV_STORAGE_KEY, fromRoute);
      if (fromSub) localStorage.setItem(NAV_SUB_STORAGE_KEY, fromSub);
    } catch {
      /* ignore */
    }
  }, [pathname]);

  function toggleGroup(id: NavGroupId) {
    setOpenGroup((prev) => {
      const next = prev === id ? null : id;
      try {
        if (next) localStorage.setItem(NAV_STORAGE_KEY, next);
        else localStorage.removeItem(NAV_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleSubgroup(id: string) {
    setOpenSubgroup((prev) => {
      const next = prev === id ? null : id;
      try {
        if (next) localStorage.setItem(NAV_SUB_STORAGE_KEY, next);
        else localStorage.removeItem(NAV_SUB_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return next;
    });
  }

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
          {NAV.map((g) => {
            const expanded = openGroup === g.id;
            const panelId = `nav-panel-${g.id}`;
            return (
              <div key={g.id} className="nav-accordion">
                <button
                  type="button"
                  className="nav-group-btn"
                  aria-expanded={expanded}
                  aria-controls={panelId}
                  onClick={() => toggleGroup(g.id)}
                >
                  <span>{g.group}</span>
                  <span className="nav-chevron" aria-hidden>
                    ▸
                  </span>
                </button>
                {expanded ? (
                  <div id={panelId} className="nav-group-items" role="region" aria-label={g.group}>
                    {g.items.map((item) => {
                      if (isNavSubgroup(item)) {
                        const subExpanded = openSubgroup === item.id;
                        const subPanelId = `nav-sub-${item.id}`;
                        return (
                          <div key={item.id} className="nav-subgroup">
                            <button
                              type="button"
                              className="nav-subgroup-btn"
                              aria-expanded={subExpanded}
                              aria-controls={subPanelId}
                              onClick={() => toggleSubgroup(item.id)}
                            >
                              <span>{item.group}</span>
                              <span className="nav-chevron" aria-hidden>
                                ▸
                              </span>
                            </button>
                            {subExpanded ? (
                              <div
                                id={subPanelId}
                                className="nav-subgroup-items"
                                role="region"
                                aria-label={item.group}
                              >
                                {item.items.map((sub) => {
                                  const active = itemMatches(pathname, sub.href);
                                  return (
                                    <Link
                                      key={sub.href}
                                      href={sub.href}
                                      className={`nav-item${active ? ' active' : ''}`}
                                    >
                                      {sub.label}
                                    </Link>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        );
                      }
                      const active = itemMatches(pathname, item.href);
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
                ) : null}
              </div>
            );
          })}
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
