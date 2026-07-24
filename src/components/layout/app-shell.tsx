'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { logoutAction, switchContextAction } from '@/modules/auth/actions';
import type { AppShellContext } from '@/lib/app-shell.server';

type NavItem = {
  href: string;
  label: string;
};

function buildAdminNav(context: AppShellContext): NavItem[] {
  if (!context.session) {
    return [
      { href: '/admin', label: 'Início' },
      { href: '/admin/organizacoes', label: 'Organizações' },
      { href: '/admin/conta', label: 'Conta' },
    ];
  }

  return [
    { href: '/admin', label: 'Início' },
    { href: '/admin/configuracoes', label: 'Configurações' },
    { href: '/admin/disponibilidade', label: 'Disponibilidade' },
    { href: '/admin/membros', label: 'Membros/Músicos' },
    { href: '/admin/eventos', label: 'Eventos' },
    { href: '/admin/escala', label: 'Escala' },
    { href: '/admin/organizacoes', label: 'Organizações' },
    { href: '/admin/conta', label: 'Conta' },
  ];
}

function buildMemberNav(): NavItem[] {
  return [
    { href: '/membro', label: 'Início' },
    { href: '/membro/disponibilidade', label: 'Disponibilidade' },
    { href: '/membro/escala', label: 'Escala' },
    { href: '/membro/organizacoes', label: 'Organizações' },
    { href: '/membro/conta', label: 'Conta' },
  ];
}

function isNavActive(activePath: string | undefined, href: string): boolean {
  if (!activePath) return false;
  if (activePath === href) return true;
  if (href === '/admin' || href === '/membro') return false;
  return activePath.startsWith(`${href}/`) || activePath === href;
}

export function AppShell({
  context,
  title,
  children,
}: {
  context: AppShellContext;
  title: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const session = context.session;
  const isAdmin = session?.loginMode === 'admin';
  const navItems = session?.loginMode === 'user' ? buildMemberNav() : buildAdminNav(context);
  const roleLabel = !session
    ? 'Sem organização ativa'
    : isAdmin
      ? session.isPrimaryAdmin
        ? 'Admin principal'
        : 'Admin'
      : 'Membro';

  const organizationLabel = session?.organizationName ?? 'Nenhuma organização selecionada';

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-zinc-200 bg-white pt-[env(safe-area-inset-top)]">
          <div className="border-b border-zinc-100 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Gerador de Escala</p>
            <p className="mt-2 truncate text-sm font-medium text-zinc-900">{organizationLabel}</p>
            <p className="truncate text-xs text-zinc-500">{roleLabel}</p>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
            {navItems.map((item) => {
              const active = isNavActive(pathname, item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm ${
                    active
                      ? 'bg-zinc-900 font-medium text-white'
                      : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="space-y-2 border-t border-zinc-100 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {session?.isAdmin ? (
              <form action={switchContextAction}>
                <input type="hidden" name="membershipId" value={session.membershipId} />
                <input type="hidden" name="loginMode" value={isAdmin ? 'user' : 'admin'} />
                <button
                  type="submit"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-left text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  {isAdmin ? 'Ver como Usuário' : 'Ver como Admin'}
                </button>
              </form>
            ) : null}
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              >
                Sair
              </button>
            </form>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-zinc-200 bg-white px-6 py-4">
            <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">{title}</h1>
          </header>
          <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
