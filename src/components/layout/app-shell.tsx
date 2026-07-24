import Link from 'next/link';
import type { ReactNode } from 'react';
import { logoutAction, switchContextAction } from '@/modules/auth/actions';
import { canViewPlans } from '@/modules/auth/permissions';
import type { SessionPayload } from '@/modules/auth/types';

export function AppShell({
  session,
  title,
  children,
}: {
  session: SessionPayload;
  title: string;
  children: ReactNode;
}) {
  const isAdmin = session.loginMode === 'admin';
  const basePath = isAdmin ? '/admin' : '/membro';
  const roleLabel = isAdmin
    ? session.isPrimaryAdmin
      ? 'Admin principal'
      : 'Admin'
    : 'Membro';

  return (
    <div className="min-h-screen bg-zinc-50 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-zinc-500">
              {session.organizationName}
              <span className="mx-1.5 text-zinc-300">·</span>
              {roleLabel}
            </p>
            <h1 className="truncate text-base font-semibold text-zinc-900 sm:text-lg">{title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link
                href="/organizacoes"
                className="rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-800"
              >
                Trocar organização
              </Link>
              {session.isAdmin ? (
                <form action={switchContextAction}>
                  <input type="hidden" name="membershipId" value={session.membershipId} />
                  <input
                    type="hidden"
                    name="loginMode"
                    value={isAdmin ? 'user' : 'admin'}
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white"
                  >
                    {isAdmin ? 'Ver como Usuário' : 'Ver como Admin'}
                  </button>
                </form>
              ) : null}
            </div>
          </div>
          <form action={logoutAction}>
            <button type="submit" className="shrink-0 text-sm text-zinc-700 underline">
              Sair
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-3 overflow-x-auto px-4 pb-3 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href={basePath} className="text-zinc-700 hover:text-zinc-900">
            Início
          </Link>
          {isAdmin ? (
            <>
              <Link href="/admin/configuracoes" className="text-zinc-700 hover:text-zinc-900">
                Configurações
              </Link>
              <Link href="/admin/disponibilidade" className="text-zinc-700 hover:text-zinc-900">
                Disponibilidade
              </Link>
              <Link href="/admin/membros" className="text-zinc-700 hover:text-zinc-900">
                Membros/Músicos
              </Link>
              <Link href="/admin/eventos" className="text-zinc-700 hover:text-zinc-900">
                Eventos
              </Link>
              <Link href="/admin/escala" className="text-zinc-700 hover:text-zinc-900">
                Escala
              </Link>
              {canViewPlans(session) ? (
                <Link href="/admin/planos" className="text-zinc-700 hover:text-zinc-900">
                  Planos
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <Link href="/membro/disponibilidade" className="text-zinc-700 hover:text-zinc-900">
                Disponibilidade
              </Link>
              <Link href="/membro/escala" className="text-zinc-700 hover:text-zinc-900">
                Escala
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
