'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  LogOut,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import { logoutAction, switchContextAction } from '@/modules/auth/actions';
import type { AppShellContext } from '@/lib/app-shell.server';

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

function buildAdminNav(context: AppShellContext): NavItem[] {
  if (!context.session) {
    return [
      { href: '/admin/organizacoes', label: 'Organizações', icon: <Building2 className="h-4 w-4" /> },
      { href: '/admin/conta', label: 'Conta', icon: <UserRound className="h-4 w-4" /> },
    ];
  }

  return [
    { href: '/admin/escala', label: 'Escala', icon: <CalendarCheck className="h-4 w-4" /> },
    { href: '/admin/configuracoes', label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
    {
      href: '/admin/disponibilidade',
      label: 'Disponibilidade',
      icon: <CalendarDays className="h-4 w-4" />,
    },
    { href: '/admin/membros', label: 'Membros/Músicos', icon: <Users className="h-4 w-4" /> },
    { href: '/admin/eventos', label: 'Eventos', icon: <CalendarRange className="h-4 w-4" /> },
    { href: '/admin/organizacoes', label: 'Organizações', icon: <Building2 className="h-4 w-4" /> },
    { href: '/admin/conta', label: 'Conta', icon: <UserRound className="h-4 w-4" /> },
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
    { href: '/membro/organizacoes', label: 'Organizações', icon: <Building2 className="h-4 w-4" /> },
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

  return (
    <div className="app-shell relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-slate-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-slate-500/10 blur-3xl" />
      </div>

      <div className="flex min-h-screen">
        <aside className="glass-panel fixed inset-y-0 left-0 z-40 flex w-60 flex-col">
          <div className="flex items-start gap-2.5 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-slate-200/80 bg-slate-100/90">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <p className="min-w-0 flex-1 break-words pt-0.5 font-display text-base font-bold leading-snug tracking-tight text-[var(--text-primary)]">
              {orgName}
            </p>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
            {navItems.map((item) => {
              const active = isNavActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                    active
                      ? 'bg-[var(--btn-primary-bg)] font-medium text-[var(--btn-primary-text)]'
                      : 'text-[var(--nav-item-inactive)] hover:bg-slate-200/50'
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 place-items-center rounded-lg ${
                      active ? 'bg-white/15 text-white' : 'bg-slate-200/40 text-[var(--text-primary)]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            {session?.isAdmin ? (
              <form action={switchContextAction}>
                <input type="hidden" name="membershipId" value={session.membershipId} />
                <input type="hidden" name="loginMode" value={isAdmin ? 'user' : 'admin'} />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-200/40 px-3 py-2 text-left text-xs font-medium text-[var(--text-primary)] transition hover:bg-slate-200/70"
                >
                  {isAdmin ? 'Ver como Usuário' : 'Ver como Admin'}
                </button>
              </form>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-[var(--text-secondary)] transition hover:bg-slate-200/50 hover:text-[var(--text-primary)]"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </button>
            </form>
          </div>
        </aside>

        <div className="ml-60 flex min-w-0 flex-1 flex-col">
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
