'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Eye,
  FlaskConical,
  LogOut,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import { logoutAction, switchContextAction } from '@/modules/auth/actions';
import type { AppShellContext } from '@/lib/app-shell.server';

const SIDEBAR_COLLAPSED_KEY = 'equipgestor.sidebarCollapsed';

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

function buildAdminNav(context: AppShellContext): NavItem[] {
  if (!context.session) {
    return [
      { href: '/admin/organizacoes', label: 'Equipe', icon: <Building2 className="h-4 w-4" /> },
      { href: '/admin/conta', label: 'Conta', icon: <UserRound className="h-4 w-4" /> },
    ];
  }

  return [
    { href: '/admin/escala', label: 'Escala', icon: <CalendarCheck className="h-4 w-4" /> },
    { href: '/admin/configuracoes', label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
    { href: '/admin/membros', label: 'Membros', icon: <Users className="h-4 w-4" /> },
    { href: '/admin/eventos', label: 'Eventos', icon: <CalendarRange className="h-4 w-4" /> },
    { href: '/admin/organizacoes', label: 'Equipe', icon: <Building2 className="h-4 w-4" /> },
    { href: '/admin/conta', label: 'Conta', icon: <UserRound className="h-4 w-4" /> },
    ...(context.isDeveloper
      ? [
          {
            href: '/admin/dev/membros-teste',
            label: 'Admin',
            icon: <FlaskConical className="h-4 w-4" />,
          },
        ]
      : []),
  ];
}

function buildMemberNav(): NavItem[] {
  return [
    { href: '/membro/escala', label: 'Escala', icon: <CalendarCheck className="h-4 w-4" /> },
    {
      href: '/membro/disponibilidade',
      label: 'Disponibilidade',
      icon: <CalendarDays className="h-4 w-4" />,
    },
    { href: '/membro/organizacoes', label: 'Equipe', icon: <Building2 className="h-4 w-4" /> },
    { href: '/membro/conta', label: 'Conta', icon: <UserRound className="h-4 w-4" /> },
  ];
}

function isNavActive(activePath: string | undefined, href: string): boolean {
  if (!activePath) return false;
  if (activePath === href) return true;
  return activePath.startsWith(`${href}/`);
}

export function AppShell({
  context,
  children,
}: {
  context: AppShellContext;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const session = context.session;
  const isAdmin = session?.loginMode === 'admin';
  const navItems = session?.loginMode === 'user' ? buildMemberNav() : buildAdminNav(context);
  const orgName = session?.organizationName ?? 'Equipgestor';
  const logoUrl = session?.organizationLogoUrl ?? null;
  const [collapsed, setCollapsed] = useState(false);
  const autoCollapsedPathRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // ignore storage access errors
    }
  }, []);

  // The admin schedule grid is wide, so entering it collapses the menu once.
  // Expanding it manually afterwards sticks until the route changes again.
  useEffect(() => {
    if (!pathname) return;
    const isAdminSchedule = isNavActive(pathname, '/admin/escala');
    if (!isAdminSchedule) {
      autoCollapsedPathRef.current = null;
      return;
    }
    if (autoCollapsedPathRef.current === pathname) return;
    autoCollapsedPathRef.current = pathname;
    setCollapsed(true);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        // ignore storage access errors
      }
      return next;
    });
  }

  const isAdminSchedule = Boolean(pathname && isNavActive(pathname, '/admin/escala'));

  return (
    <div className="app-shell relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-slate-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-slate-500/10 blur-3xl" />
      </div>

      <div className="flex min-h-screen">
        <aside
          className={`glass-panel fixed inset-y-0 left-0 z-40 flex flex-col transition-[width] duration-200 ${
            collapsed ? 'w-[4.5rem]' : 'w-60'
          }`}
        >
          <div
            className={`flex items-start gap-2.5 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] ${
              collapsed ? 'justify-center px-1.5' : 'px-2'
            }`}
          >
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200/80 bg-slate-100/90">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            {!collapsed ? (
              <p className="min-w-0 flex-1 break-words pt-0.5 font-display text-base font-bold leading-snug tracking-tight text-[var(--text-primary)]">
                {orgName}
              </p>
            ) : null}
          </div>

          <nav
            className={`flex min-h-0 flex-1 flex-col py-2 ${collapsed ? 'px-1.5' : 'px-2'}`}
          >
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = isNavActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center rounded-xl text-sm transition-colors ${
                      collapsed ? 'justify-center px-1.5 py-2' : 'gap-3 px-2.5 py-2'
                    } ${
                      active
                        ? 'bg-[var(--btn-primary-bg)] font-medium text-[var(--btn-primary-text)]'
                        : 'text-[var(--nav-item-inactive)] hover:bg-slate-200/50'
                    }`}
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'bg-slate-200/40 text-[var(--text-primary)]'
                      }`}
                    >
                      {item.icon}
                    </span>
                    {!collapsed ? item.label : null}
                  </Link>
                );
              })}
            </div>

            <button
              type="button"
              onClick={toggleCollapsed}
              className={`mt-2 flex min-h-8 w-full items-center py-1 text-[var(--text-secondary)] transition hover:text-[var(--text-primary)] ${
                collapsed ? 'justify-center' : 'justify-end pr-1'
              }`}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? (
                <ChevronRight className="h-5 w-5" strokeWidth={2} />
              ) : (
                <ChevronLeft className="h-5 w-5" strokeWidth={2} />
              )}
            </button>
          </nav>

          <div
            className={`space-y-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1 ${
              collapsed ? 'invisible pointer-events-none px-1.5' : 'px-3'
            }`}
            aria-hidden={collapsed}
          >
            {context.userEmail ? (
              <p
                className="truncate px-1 text-[11px] leading-snug text-[var(--text-secondary)]"
                title={context.userEmail}
              >
                {context.userEmail}
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-3">
              <form action={logoutAction}>
                <button
                  type="submit"
                  tabIndex={collapsed ? -1 : undefined}
                  title="Sair"
                  className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs text-[var(--text-secondary)] transition hover:bg-slate-200/60 hover:text-[var(--text-primary)]"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  Sair
                </button>
              </form>

              {session?.isAdmin ? (
                <form action={switchContextAction}>
                  <input type="hidden" name="membershipId" value={session.membershipId} />
                  <input type="hidden" name="loginMode" value={isAdmin ? 'user' : 'admin'} />
                  <button
                    type="submit"
                    tabIndex={collapsed ? -1 : undefined}
                    title={isAdmin ? 'Ver como Membro' : 'Ver como Admin'}
                    className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-medium text-[var(--text-primary)] transition hover:bg-slate-200/60"
                  >
                    <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    {isAdmin ? 'Membro' : 'Admin'}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
        </aside>

        <div
          className={`flex min-w-0 flex-1 flex-col transition-[margin] duration-200 ${
            collapsed ? 'ml-[4.5rem]' : 'ml-60'
          }`}
        >
          <main
            className={
              isAdminSchedule
                ? 'flex-1 px-3 py-4 sm:px-4 sm:py-6'
                : 'flex-1 px-[60px] py-6 sm:py-8'
            }
          >
            <div
              className={`mx-auto w-full ${isAdminSchedule ? 'max-w-none' : 'max-w-5xl'}`}
            >
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
